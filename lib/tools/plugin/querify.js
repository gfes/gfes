/* Created by tommyZZM on 2016/1/28. */
"use strict"
const cwd = process.cwd();
const fs = require("fs");
const path = require("path");
const through = require("through2");
const minimatch = require("minimatch");
const asyncreplace = require("async-replace");
const queryString = require('query-string');
const xtend = require("xtend");
const streamifier = require("streamifier");
const renameFunctionCalls = require("rename-function-calls");
const Promise = require("bluebird");
const quote = require("quote");

const isUrlAbsolute = require("../../utils").isUrlAbsolute
const isReadableStream = require("../../utils").isReadableStream
const normalizePath = require("../../utils").normalizePath

const replaceFunction = require("../../utils/replace-function");
const contentLoadersGroup = require("../../utils/content-loader").contentLoadersGroup
const contentLoader = require("../../utils/content-loader").contentLoader

const noopResolver = n=>n;
exports.browserifyPlugin = browserifyPlugin;
exports.transformObj = transformObj;

/**
 * browserify的replacer插件
 * @param b
 * @param opts
 * opts.replacer = (fullPath,destPath,keyword,queryOptions) => Stream|string
 */
function browserifyPlugin(b, opts){
    //let options = xtend(opts);
    if(!b.redirectReadingFile){
        //TODO:log require "resolvify" browserify plugin
        return;
    }

    //let redirectOueryLoader = Promise.promisify(loaderFunctionCreater());
    let queryLoaders = [];
    let loaderAndQueryCache = {};
    let queryLoaderAPI = {};
    let queryLoaderAPIArray = [];

    b.queryloader = function(loader){
        loader(addloader);
        return b;
    }

    function addloader(name, loader, options){
        let opts = xtend(options);

        let conditionfn = _=>true;
        let loaderfn = loader;
        if(typeof loader==="object"){
            conditionfn = loader.if;
            if(typeof loader.if==="string"){
                conditionfn = file => minimatch(file, loader.if, {matchBase: true})
            }
            loaderfn = loader.loader;
        }

        if(!(typeof loaderfn === "function") && !(typeof name === "string")){
            //TODO:log err
            return;
        }

        queryLoaders.unshift({
            name:name
            ,if:(id,query)=> !!query[name] && conditionfn(id,query)
            ,loader:Promise.promisify(loaderfn)
        });

        //是否添加内置命令
        if(opts.inlineBuiltins){
            queryLoaderAPI["__"+name]=name;
            queryLoaderAPIArray = Object.keys(queryLoaderAPI).concat("require");
        }

        return this;
    }

    //如果模块id使用了querystring并且符合规则,则重定向
    //->2
    b.redirectReadingFile((fileAbsolute, id) => {
            let query = queryStringPrase(queryStringSplit(id).query);
            //如果存在相应的loader则缓存
            return !!queryStringSplit(id).query && queryLoaders.some(loader=> {
                    if (loader.if(id, query)) {
                        loaderAndQueryCache[fileAbsolute] = {query: query, loader: loader.loader};
                        return true;
                    }
                });
        }
        , function (fileAbsolute, id) {
            let tr = through();
            let loaderAndQuery = loaderAndQueryCache[fileAbsolute];
            let query = loaderAndQuery.query;
            let file = normalizePath(path.relative(cwd,fileAbsolute));

            loaderAndQuery.loader(file, id, query)
                .then(contents=>end("module.exports = " + contents))

            return tr;

            function end(content) {
                tr.push(new Buffer(content))
                tr.push(null);
            }
        }
    )

    //transform
    b.on("prebundle",function(){
        b.transform(function (file, opts) {
            //->1
            return through(function(buf,env,next){
                //->3 如果已经重定向过则不再重定向
                if(!!loaderAndQueryCache[file]){
                    return next(null,buf)
                }

                //把loaderAPI方法替换成require,并且标准化所有querystring
                replaceFunction(queryLoaderAPIArray,buf.toString(),function(callee,args,done){
                    let arg0ToString = args[0].value;

                    if(args[0].type==="string"){
                        let arg0Split = queryStringSplit(arg0ToString);
                        let arg0Prase = queryStringPrase(arg0Split.query);

                        if(callee.name!=="require"){
                            arg0Prase[queryLoaderAPI[callee.name]] = true;
                        }

                        let arg0Query = queryString.stringify(arg0Prase);

                        if(arg0Query){
                            arg0ToString = arg0Split.path+"?"+arg0Query;
                        }

                        return done(null,callee(quote(arg0ToString),"require"))
                    }

                    //TODO:function type param transform

                    return done(null,callee(callee.defaultArguments))
                }).then(content=>next(null,new Buffer(content)))
            })
        });
    })
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
            let loaderFromPath = loaderFunctionCreater(filepath, {urlqueryer: urlqueryer, keyword: "url",quote:"\""})
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
            return replaceFunction("__url", contents, function (callee, args, done) {
                if (args[0].type === "string") {
                    return loaderFromPath(args[0].value, args[0].value, function (err, result) {
                        done(null, quote(result) );
                    })
                }
                args = args.map(args=>args.value).join(",")
                return done(null, args)
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
    let normoizeRelativeUrl = function(file,url){
        url = path.join(path.dirname(file),url)
        return normalizePath(path.relative(cwd,url));
    };
    let keyword = opts.keyword||"";

    var result = str => keyword+((typeof opts.quote==="string")?"("+quote({quotes:opts.quote})(str)+")":(str)) ;

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
