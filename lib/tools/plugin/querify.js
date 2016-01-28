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
var renameFunctionCalls = require("rename-function-calls")

var isUrlAbsolute = require("../../utils").isUrlAbsolute
var isReadableStream = require("../../utils").isReadableStream
var normalizePath = require("../../utils").normalizePath

//exports.transform = transform;
exports.browserifyPlugin = browserifyPlugin;
exports.transformObj = transformObj;

var urlResolveKeyword = {
    "*.js":"__url"
    ,"*.css":"url"
}

var urlResolveKeywordGlobs = Object.keys(urlResolveKeyword)
var urlResolveKeywordRegex = {};
urlResolveKeywordGlobs.forEach(glob=>{
    urlResolveKeywordRegex[glob]=new RegExp("("+urlResolveKeyword[glob]+")\\(['\"]?(.*?)['\"]?\\)","ig")
})
var defaultUrlResolver = n=>n;

/**
 *
 * @param b
 * @param opts
 * opts.resolver = (fullPath,destPath,keyword,queryOptions) => Stream|string
 */
function browserifyPlugin(b, opts){
    opts = xtend(opts);
    let optionsResolver = (typeof opts.resolver==="function")?opts.resolver:defaultUrlResolver;
    let resolver = resolverCreater("",xtend(opts,{resolver:optionsResolver}));
    let redirectedFiles = {};

    //重定向
    b.redirectReadingFile(id=>praseQuerySplit(id).query!==void 0
        ,function(file,id){
            let tr = through();

            redirectedFiles[file] = true;

            resolver("(\""+file+"\");","",file,function(err,result){
                tr.push(new Buffer("module.exports = __url(\""+result + "?" + praseQuerySplit(id).query+"\");"))
                tr.push(null);
            })

            return tr;
    })

    //transform
    b.transform(function (file, opts) {

        if(redirectedFiles[file]){
            return through()
        }

        return transform(file, xtend(opts, {
            resolver: function resolveFunctionArguments(fullPath, destPath, keyword, queryOptions) {
                let getPathOnly = {"!": true}
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

    let resolver = resolverCreater(file, opts)

    return through(function(buf, env, next){
        let contents = buf.toString()

        let globmatched = urlResolveKeywordGlobs.some(glob=>{
            if(minimatch(file,glob,{matchBase: true})){
                asyncreplace(contents,urlResolveKeywordRegex[glob],function(prop,keyword,propPath,pos,string,done){
                    resolver(prop,keyword,propPath,done)
                },function(err,result){
                    //console.log(result)
                    next(err,new Buffer(result))
                })
                return true;
            }
        })

        if(globmatched)return 0;

        return next(null,buf);
    })
}

function resolverCreater(file, opts){
    opts = xtend(opts)
    let resolver = (typeof opts.resolver==="function")?opts.resolver:defaultUrlResolver;
    let destPath = opts.dest||cwd;

    return function resolverWrapper(prop,keyword,propPath,done){
        let fullPath = propPath;
        if(!isUrlAbsolute(fullPath)){
            let queryOptions = {};
            let querySplit = praseQuerySplit(fullPath)
            if(querySplit.query !== void 0){
                fullPath = querySplit.path
                let parsed = queryString.parse(querySplit.query);
                Object.keys(parsed).forEach(key=>{
                    if(!parsed[key] && typeof parsed[key]!=="number"){
                        return queryOptions[key] = true;
                    }
                    return queryOptions[key] = parsed[key]
                })
            }

            fullPath = path.join(path.dirname(file),fullPath)
            fullPath = normalizePath(path.relative(cwd,fullPath));

            let resolveResult = resolver(fullPath,destPath,keyword,queryOptions);
            let resolveResultString = "";

            if(typeof resolveResult==="string"){
                resolveResultString = resolveResult;
                return done(null,keyword?keyword+"(\""+resolveResultString+"\")":resolveResultString)
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
                    done(errInfo, resolveResultString)
                })
                return 0;
            }

            return done(null, keyword+"("+fullPath+")")
        }
        return done(null, prop)
    }
}

function praseQuerySplit(str){
    let querySplit = str.split("?")
    return {path:querySplit[0],query:querySplit[1]}
}
