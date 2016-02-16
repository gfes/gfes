/* Created by tommyZZM on 2016/1/28. */
"use strict"
const cwd = process.cwd();
const fs = require("fs");
const path = require("path");
const through = require("through2");
const minimatch = require("minimatch");
const queryString = require('query-string');
const xtend = require("xtend");
const streamifier = require("streamifier");
const Promise = require("bluebird");
const quote = require("quote");

const normalizePath = require("../../utils").normalizePath
const replaceFunction = require("../../utils/replace-function");

/**
 * browserify的replacer插件
 * @param b
 * @param opts
 * opts.replacer = (fullPath,destPath,keyword,queryOptions) => Stream|string
 */
module.exports = function(b, opts){
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
        if(!(typeof name === "string")){
            //TODO:log err
            return;
        }

        let opts = xtend(options);

        let conditionfn = (id, query)=>!!query[name];
        let loaderfn = loader;
        if(typeof loader==="object"){
            conditionfn = loader.if;
            if(typeof loader.if==="string"){
                conditionfn = file => minimatch(file, loader.if, {matchBase: true})
            }
            loaderfn = loader.loader;
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
            let file = normalizePath(path.relative(cwd,queryStringSplit(fileAbsolute).path));

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

module.exports.queryStringSplit = queryStringSplit;
module.exports.queryStringPrase = queryStringPrase;

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
