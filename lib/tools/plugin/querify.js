/* Created by tommyZZM on 2016/1/28. */
"use strict"
var cwd = process.cwd();
var fs = require("fs");
var path = require("path");
var through = require("through2")
var minimatch = require("minimatch");
var asyncreplace = require("async-replace");
var queryString = require('query-string');
var xtend = require("xtend");
var streamifier = require("streamifier");
var renameFunctionCalls = require("rename-function-calls");
var Promise = require("bluebird");

var isUrlAbsolute = require("../../utils").isUrlAbsolute
var isReadableStream = require("../../utils").isReadableStream
var normalizePath = require("../../utils").normalizePath

var replaceFunctionArguments = require("../../utils/replace-function-arguments");
var contentLoadersGroup = require("../../utils/content-loader").contentLoadersGroup
var contentLoader = require("../../utils/content-loader").contentLoader

var noopResolver = n=>n;
let urlFunctionName = "__url";
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
    let options = xtend(opts);
    if(!b.redirectReadingFile){
        //TODO:log require "resolvify" browserify plugin
        return;
    }

    let redirectOueryLoader = loaderFunctionCreater();

    let redirectedFiles = {};
    let queryLoaders = [];

    b.queryloader = function(condition,loaderfn){
        let conditionfn = condition;
        if(typeof condition==="string"){
            conditionfn = (file,id,options)=>{
                return minimatch(file, condition, {matchBase: true})
            }
        }
        queryLoaders.unshift((file,options,id,absoluteId) => {
            return new Promise(function (resolve, reject) {
                if(conditionfn(file,id,options)){
                    return (new Promise(function(resolve, reject){
                        loaderfn(function(err,result){
                            if(!err){
                                resolve(result);
                            }else {
                                reject(err);
                            }
                        },file,options,id,absoluteId);

                    }))
                        .then(resolve)
                        .error(reject)
                }
                return resolve(false)
            })
        });
        return this;
    }

    b.queryloader((file,id,queryoptions)=>!/^\./.test(id),function(done,file,options,id){
        return done(null,"require(\""+queryStringSplit(id).path+"\");");
    })

    b.queryloader((file,id,queryoptions)=>!!queryoptions.url,function(done,file,options,id,absoluteId){
        redirectedFiles[absoluteId] = true;
        return done(null,urlFunctionName+"(\""+file + "?" + queryStringSplit(id).query+"\");");
    })

    //如果模块id使用了querystring则重定向
    //->2
    b.redirectReadingFile(id=>queryStringSplit(id).query!==void 0
        ,function(absoluteId,id){
            let tr = through();

            let queryoptions = queryStringPrase(queryStringSplit(id).query);

            redirectOueryLoader("",absoluteId,function(err,file){
                let resultModuleContents = "null";
                //TODO:custom loader,自定义重定向规则

                Promise.reduce(queryLoaders,function(contents,loader){
                    return loader(file,queryoptions,id,absoluteId).then(contents=>{
                        if(!!contents){
                            resultModuleContents = contents
                        }
                        return resultModuleContents;
                    })
                },"null")
                    .then(contents=>end("module.exports = "+contents))
            })
            return tr;

            function end(content){
                tr.push(new Buffer(content))
                tr.push(null);
            }
    })

    //transform
    b.transform(function (file, opts) {
        //->1
        let asurl = "url=true"
        return through(function(buf,env,next){
            //->3
            if(redirectedFiles[file]){
                return next(null,buf)
            }

            //判断__url方法里的参数,如果是字符串则添加url=true的
            replaceFunctionArguments(urlFunctionName,buf.toString(),function(args,defaultValue,done){
                if(args[0].type==="string"){
                    let arg0ToString = args[0].value
                    let arg0Prase = queryStringSplit(arg0ToString)
                    if(arg0Prase.query){
                        if(!arg0Prase.query.asurl){
                            arg0ToString+="&"+asurl;
                        }
                    }else{
                        arg0ToString+="?"+asurl;
                    }
                    return done(null,"\""+arg0ToString+"\"")
                }
                return done(null,"null")
            }).then(content=>{
                //把__url方法重命名成require方法
                buf = new Buffer(renameFunctionCalls(urlFunctionName,"require",content));
                next(null,buf);
            })
        })
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
    let contentResolveloader = opts.contentloader;
    return through(function(buf, env, next){
        let content = buf.toString()
        contentResolveloader(file,content,opts).then(content=>next(null,new Buffer(content)))
    })
}

/**
 * CssUrlReplacer
 * @param urlqueryer
 * @constructor
 */
exports.CssUrlLoader = function (urlqueryer) {
    return contentLoader(filepath=>minimatch(filepath, "*.css", {matchBase: true})
        , function (filepath, contents, opts, done) {
            let loaderFromPath = loaderFunctionCreater(filepath, {urlqueryer: urlqueryer, keyword: "url"})
            let regexGetUrl = new RegExp("url\\(['\"]?(.*?)['\"]?\\)", "ig")

            return asyncreplace(contents, regexGetUrl, function (propDefault, propPath, pos, string, done) {
                loaderFromPath(propDefault, propPath, done)
            }, done)

        });
}

/**
 * JsUrlReplacer
 * @param urlqueryer
 * @constructor
 */
exports.JsUrlLoader = function (urlqueryer) {
    return contentLoader(filepath=>minimatch(filepath, "*.js", {matchBase: true})
        , function (filepath, contents, opts, done) {
            let loaderFromPath = loaderFunctionCreater(filepath, {urlqueryer: urlqueryer, keyword: ""})
            return replaceFunctionArguments(urlFunctionName, contents, function (args, defaultValue, done) {
                if (args[0].type === "string") {
                    return loaderFromPath(args[0].value, args[0].value, function (err, result) {
                        done(null, "\"" + result + "\"");
                    })
                }
                return done(null, defaultValue)
            }).then(contents=>done(null, contents))
        });
}


/**
 *
 * @param file
 * @param opts
 * @returns {(prop,keyword,propPath,done)=>void}
 */
function loaderFunctionCreater(file, opts){
    opts = xtend(opts)
    let urlqueryer = (typeof opts.urlqueryer==="function")?opts.urlqueryer:noopResolver;
    let normoizeRelativeUrl = (typeof opts.normalizeUrl==="function")?opts.normalizeUrl:function(file,url){
        url = path.join(path.dirname(file),url)
        return normalizePath(path.relative(cwd,url));
    };
    let keyword = opts.keyword||"";

    var result = str => keyword?(keyword+"(\""+str+"\")"):(str);

    return function loaderFromPath(propDefault,propPath,done){
        let fullPath = propPath;
        //console.log(!isUrlAbsolute(fullPath),file,fullPath)
        if(!isUrlAbsolute(fullPath)){
            let queryOptions = {};
            let querySplit = queryStringSplit(fullPath)
            fullPath = querySplit.path
            if(querySplit.query !== void 0){
                queryOptions = queryStringPrase(querySplit.query);
            }

            //console.log("beforeNormalize",fullPath)
            fullPath = normoizeRelativeUrl(file,fullPath)
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

function queryStringSplit(str){
    let querySplit = str.split("?")
    return {path:querySplit[0],query:querySplit[1]}
}

function queryStringPrase(str){
    let parsed = queryString.parse(str);
    Object.keys(parsed).forEach(key=>{
        if(!parsed[key] && typeof parsed[key]!=="number"){
            return parsed[key] = true;
        }
        if(parsed[key]==="true"){
            return parsed[key] = true;
        }else if(parsed[key]==="false"){
            return parsed[key] = false;
        }
    })
    return parsed;
}
