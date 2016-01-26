/* Created by tommyZZM on 2016/1/7. */
"use strict"
var fs = require("fs");
var path = require("path");
var url = require("url");
var Readable = require('stream').Readable;

var vfs = require('vinyl-fs');
var sass = require('gulp-sass');
//var less = require('gulp-less');
var through = require("through2")
var mergeStream = require("merge-stream");
var replaceStream = require("replacestream");
var extend = require("extend");
var defined = require("defined");

var globby = require('globby');
var minimatch = require('minimatch');

var cwd = process.cwd();

function styleCompile(entryFilesGlob,options){
    let handel = through.obj();
    if(!Array.isArray(entryFilesGlob)){entryFilesGlob = [entryFilesGlob]}
    if(options === void 0)options = {};
    extend(options ,{relativeUrls:true})

    globby(entryFilesGlob).then(function(entryFiles){
        //TODO:if length===0 throw error
        let streams = entryFiles
            .filter(file=>minimatch(path.basename(file),"*.+(scss|sass)"))
            .map(file=>{
                let s = vfs.src(file);
                let fileFullPath = path.resolve(file);
                let entryDirBase = path.dirname(fileFullPath);
                s = s.pipe(sassBuild(options,entryDirBase))
                return s;
        })

        let merged = defined(streams[0],through.obj());
        if(streams.length>1){
            merged = mergeStream(streams)
        }
        merged.pipe(handel)
        if(!streams[0]){
            merged.push(null)
        }
    })

    return handel
}
exports = module.exports = styleCompile

//gulp-sass
function sassBuild(options, entryDirBase){
    if(!!options.relativeUrls){
        options.importer = sassRelativeUrlsImporter(entryDirBase)
    }
    return sass(options).on('error', sass.logError)
}

//scss中url路径以入口文件为基准进行标准化
//TODO:其他一些类型的资源路径
function sassRelativeUrlsImporter(entryDirBase){
    return function(targetUrl, prev, done) {
        if(path.extname(targetUrl)!==".scss"){
            targetUrl += ".scss";
        }
        targetUrl = path.isAbsolute(targetUrl)?targetUrl:path.join(entryDirBase,targetUrl);

        //let relative = path.relative(path.dirname(targetUrl),entryDirBase);

        let finalContnets = "";
        let s = vfs.src(targetUrl);

        s.pipe(cssUrlStandlize(entryDirBase, targetUrl))
            .on("data", (file)=> {
                finalContnets += file.contents.toString()
            })
            .on('end', ()=> {
                done({contents: finalContnets})
            });

        //TODO:处理重复引入
    }

    function cssUrlStandlize(base,dirName){
        let reg = /url\(['"]?(.*?)['"]?\)/ig;

        let result = through.obj(function(file,env,next){
            let s = readStreamFromString(file.contents.toString())
            let contents = "";
            s.pipe(replaceStream(reg, (prop, propUrl)=>{
                let standarUrl = propUrl;
                if(isUrlAbsolute(standarUrl)){
                    return prop;
                }
                standarUrl = path.relative(base, path.join(path.dirname(dirName), propUrl));
                return 'url("' + standarUrl.replace(/\\/g, "/") + '")';
            })).on('data', function(chunk) {
                contents+=chunk.toString();
            }).on('end', ()=>{
                file.contents = new Buffer(contents);
                this.push(file)
                next();
            })
        })

        return result
    }
}

//TODO:处理css中的路径
function urlResolve(fn){
    return through.obj(function(f, env, next){
        var contents = f.contents.toString();
        contents.replace(/url\(['"]?(.*?)['"]?\)/ig,function(prop,propUrl,pos){
            return prop
        })
        next(null,f)
    })
}
exports.styleResolve = urlResolve

/********
 * utils
 ********/
var regexIsUrlAbsolute = /(^(?:\w+:)\/\/)/ ;
var regexIsUrlBase64 = /data:(\w+)\/(\w+);/
function isUrlAbsolute (url) {
    if (typeof url !== 'string') {
        throw new TypeError('Expected a string');
    }

    if(regexIsUrlAbsolute.test(url)){
        return true;
    }

    return !!regexIsUrlBase64.test(url);
}

function readStreamFromString(str){
    let s = new Readable();
    s._read = function noop() {
        this.push(new Buffer(str))
        this.push(null)
    };
    return s
}