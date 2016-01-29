/* Created by tommyZZM on 2016/1/28. */
"use strict"
var cwd = process.cwd();
var path = require("path");
var through = require("through2")
var minimatch = require("minimatch");
var asyncreplace = require("async-replace");
var queryString = require('query-string');
var xtend = require("xtend");
var streamifier = require("streamifier");
var renameFunctionCalls = require("rename-function-calls");

var isUrlAbsolute = require("../../utils").isUrlAbsolute
var isReadableStream = require("../../utils").isReadableStream
var normalizePath = require("../../utils").normalizePath

var replaceFunctionArguments = require("../../utils/replace-function-arguments");
var contentReplacers = require("../../utils/content-replacer").contentReplacers
var contentReplacer = require("../../utils/content-replacer").contentReplacer

var noopResolver = n=>n;

//exports.transform = transform;
exports.browserifyPlugin = browserifyPlugin;
exports.transformObj = transformObj;

/**
 * browserify的replacer插件
 * @param b
 * @param opts
 * opts.replacer = (fullPath,destPath,keyword,queryOptions) => Stream|string
 */
function browserifyPlugin(b, opts){
    opts = xtend(opts);
    let resolveHandeler = resolveHandelerCreater("",opts);
    let redirectedFiles = {};

    //重定向
    //->2
    b.redirectReadingFile(id=>praseQuerySplit(id).query!==void 0
        ,function(file,id){
            let tr = through();

            redirectedFiles[file] = true;

            resolveHandeler("(\""+file+"\");",file,function(err,result){
                let resultModule = "module.exports = __url(\""+result + "?" + praseQuerySplit(id).query+"\");"
                tr.push(new Buffer(resultModule))
                tr.push(null);
            })

            return tr;
    })

    //transform
    b.transform(function (file, opts) {

        //->3
        if(redirectedFiles[file]){
            return through()
        }

        //->1
        return transform(file, xtend(opts, {
            replacers: contentReplacers([jsUrlReplacer])
            ,urlqueryer: function replaceFunctionArguments(fullPath, queryOptions) {
                let getPathOnly = {"___u": true}
                fullPath = fullPath + "?" + queryString.stringify(xtend(queryOptions, getPathOnly))
                return fullPath
            }
        })).pipe(through(function(buf,env,next){
            buf = new Buffer(renameFunctionCalls("__url","require",buf.toString()))
            next(null,buf)
        }))
    });
}

function transformObj(opts){
    opts = xtend(opts);
    return through.obj(function(f,env,next){
        let file = f.path;
        let buf = f.contents;

        streamifier.createReadStream(buf)
            .pipe(transform(file,opts))
            .pipe(through(function(buf,env,bufnext){
                f.contents = buf;
                bufnext(null,buf);
            },function(){
                next(null,f);
            }))
    })
}

function transform(file, opts){
    let replacers = opts.replacers;

    return through(function(buf, env, next){
        let contents = buf.toString()

        replacers(file,contents,opts).then(function(contentsResolved){
            return next(null,new Buffer(contentsResolved));
        })
    })
}

var cssUrlReplacer = exports.cssUrlReplacer =
contentReplacer(filepath=>minimatch(filepath, "*.css", { matchBase: true })
    , function (filepath, contents, opts, done) {
        let replaceHandeler = resolveHandelerCreater(filepath, xtend(opts,{keyword:"url"}))
        let regexGetUrl = new RegExp("url\\(['\"]?(.*?)['\"]?\\)", "ig")

        return asyncreplace(contents, regexGetUrl, function (propDefault, propPath, pos, string, done) {
            replaceHandeler(propDefault, propPath, done)
        }, done)

    });

var jsUrlReplacer = exports.jsUrlReplacer =
contentReplacer(filepath=>minimatch(filepath, "*.js", { matchBase: true })
    , function (filepath, contents, opts, done) {
        if(opts)opts.keyword = "";
        let replaceHandeler = resolveHandelerCreater(filepath, opts)
        return replaceFunctionArguments("__url",contents,function(args,defaultValue,done){
            if(args[0].type==="string"){
                return replaceHandeler(args[0].value, args[0].value, function(err,result){
                    done(null,"\""+result+"\"");
                })
            }
            return done(null,defaultValue)
        }).then(contents=>done(null,contents))
    });

/**
 *
 * @param file
 * @param opts
 * @returns {(prop,keyword,propPath,done)=>void}
 */
function resolveHandelerCreater(file, opts){
    opts = xtend(opts)
    let urlqueryer = (typeof opts.urlqueryer==="function")?opts.urlqueryer:noopResolver;
    //let destPath = opts.dest||cwd;
    let keyword = opts.keyword||"";

    var result = str => keyword?(keyword+"(\""+str+"\")"):(str);

    return function replaceHandeler(propDefault,propPath,done){
        let fullPath = propPath;
        //console.log(!isUrlAbsolute(fullPath),file,fullPath)
        if(!isUrlAbsolute(fullPath)){
            let queryOptions = {};
            let querySplit = praseQuerySplit(fullPath)
            fullPath = querySplit.path
            if(querySplit.query !== void 0){
                let parsed = queryString.parse(querySplit.query);
                Object.keys(parsed).forEach(key=>{
                    if(!parsed[key] && typeof parsed[key]!=="number"){
                        return queryOptions[key] = true;
                    }
                    return queryOptions[key] = parsed[key]
                })
            }

            fullPath = path.join(path.dirname(file),fullPath)
            //console.log("beforeNormalize",fullPath)

            fullPath = normalizePath(path.relative(cwd,fullPath));
            //console.log("afterNormalize",fullPath)

            let resolveResult = urlqueryer(fullPath,queryOptions);
            let resolveResultString = "";

            if(typeof resolveResult==="string"){
                resolveResultString = resolveResult;
                return done(null,result(resolveResultString))
            }

            if(isReadableStream(resolveResult)){
                let errInfo = null;
                resolveResult.on("data", function (buf) {
                    if (buf.contents) {
                        resolveResultString += buf.contents.toString()
                    } else {
                        resolveResultString += buf.toString()
                    }
                }).on("err", function (err) {
                    errInfo = err;
                }).on("finish", function () {
                    done(errInfo, result(resolveResultString))
                })
                return 0;
            }

            return done(null, result(resolveResultString))
        }
        return done(null, propDefault)
    }
}

function praseQuerySplit(str){
    let querySplit = str.split("?")
    return {path:querySplit[0],query:querySplit[1]}
}
