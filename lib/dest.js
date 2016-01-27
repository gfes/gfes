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
 * 高阶的dest方法，主要功能
 * 1.处理js和css文件中的url以及__url依赖
 * 2.处理js文件中可能存在的外联依赖
 */
module.exports = function dest(outFolder, opt, resolver) {
    let urlResolveKeywordGlobs = Object.keys(urlResolveKeyword)
    let urlResolveKeywordRegex = {};
    urlResolveKeywordGlobs.forEach(glob=>{
        urlResolveKeywordRegex[glob]=new RegExp(urlResolveKeyword[glob]+"\\(['\"]?(.*?)['\"]?\\)","ig")
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
        //then
        if(currGlob){
            asyncreplace(contents,urlResolveKeywordRegex[currGlob],function(prop,propUrl,pos,string,done){
                let fullUrl = propUrl
                if(!isUrlAbsolute(propUrl)){
                    fullUrl = path.join(path.dirname(f.path),propUrl)
                    fullUrl = path.relative(cwd,fullUrl);

                    let queryOptions = {};
                    let querySplit = fullUrl.split("?")
                    if(querySplit[1]){
                        fullUrl = querySplit[0]
                        queryOptions = queryString.parse(querySplit[1])
                    }

                    let resolveResult = resolver(fullUrl,queryOptions)
                    if(typeof resolveResult==="string"){
                        prop = urlResolveKeyword[currGlob]+"("+resolveResult+")"
                    }else if(isReadableStream(resolveResult)){
                        prop = ""
                        let errInfo = null;
                        createStreamFromString(fullUrl).pipe(resolveResult)
                        resolveResult.on("data",function(buf){
                            if(buf.contents){
                                prop+=buf.contents.toString()
                            }else{
                                prop+=buf.toString()
                            }
                        }).on("err",function(err){
                            errInfo = err;
                        }).on("finish",function(){
                            console.log("return",propUrl)
                            done(errInfo,prop)
                        })
                        return
                    }
                    console.log("none",propUrl)
                }else{
                    console.log("done",propUrl)
                    done(null,prop)
                }
            },function(err,result){
                //console.log(result)
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
