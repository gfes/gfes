/* Created by tommyZZM on 2016/1/27. */
"use strict"
var path = require("path");
var Readable = require('stream').Readable;
var vfs = require('vinyl-fs');
var through = require('through2')
var minimatch = require("minimatch");
var asyncreplace = require("async-replace");
var queryString = require('query-string');
var cwd = process.cwd();

var isUrlAbsolute = require("./utils").isUrlAbsolute
var isReadableStream = require("./utils").isReadableStream
var normalizePath = require("./utils").normalizePath
var c = require("./utils").create

var urlResolveKeyword = {
    "*.js":"__url"
    ,"*.css":"url"
}

/**
 *
 * @param outFolder
 * @param opt
 * @param resolver
 * @returns {*}
 *
 * dest的高阶方法，主要功能：
 * 1.处理js和css文件中的url以及__url依赖
 * 2.处理js文件中可能存在的外联依赖
 */
module.exports = function dest(outFolder, opt, resolver) {
    let urlResolveKeywordGlobs = Object.keys(urlResolveKeyword)
    let urlResolveKeywordRegex = {};
    urlResolveKeywordGlobs.forEach(glob=>{
        urlResolveKeywordRegex[glob]=new RegExp("("+urlResolveKeyword[glob]+")\\(['\"]?(.*?)['\"]?\\)","ig")
    })

    if(typeof resolver!=="function"){
        //TODO:warnning!
        return through();
    }

    let resolveUrlStream = through.obj(function(f,env,next){
        let contents = f.contents.toString();
        let currGlob = null;

        //if match glob
        urlResolveKeywordGlobs.some(glob=>{
            if(minimatch(f.path,glob,{matchBase: true}) && urlResolveKeywordRegex[glob]){
                currGlob = glob
                return true;
            }
        })
        //then //TODO:make promise
        if(currGlob){
            return asyncreplace(contents,urlResolveKeywordRegex[currGlob],function(prop,keyword,propUrl,pos,string,done){
                let fullPath = propUrl
                if(!isUrlAbsolute(propUrl)){
                    fullPath = path.join(path.dirname(f.path),propUrl)
                    fullPath = path.relative(cwd,fullPath);

                    let queryOptions = {};
                    let querySplit = fullPath.split("?")
                    if(querySplit[1]){
                        fullPath = querySplit[0]
                        queryOptions = queryString.parse(querySplit[1])
                    }
                    queryOptions["$keyword"] = keyword

                    let resolveResult = resolver(fullPath,outFolder,queryOptions)
                    if(typeof resolveResult==="string"){
                        return prop = urlResolveKeyword[currGlob]+"("+resolveResult+")"
                    }else if(isReadableStream(resolveResult)){
                        prop = ""
                        let errInfo = null;
                        return createStreamFromString(fullPath)
                            .pipe(resolveResult)
                            .on("data", function (buf) {
                                if (buf.contents) {
                                    prop += buf.contents.toString()
                                } else {
                                    prop += buf.toString()
                                }
                            }).on("err", function (err) {
                                errInfo = err;
                            }).on("finish", function () {
                                done(errInfo, prop)
                            })
                    }
                }
                done(null,prop)
            },function(err,result){
                next(err,f)
            })
        }

        next(null,f)
    })

    if(outFolder){
        resolveUrlStream = resolveUrlStream.pipe(vfs.dest(outFolder,opt))
    }

    return resolveUrlStream
}

function createStreamFromString(str){
    let s = new Readable();
    s._read = function noop() {
        this.push(new Buffer(str))
        this.push(null)
    };
    return s
}
