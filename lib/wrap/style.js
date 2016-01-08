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
var isUrlAbsolute = require("is-absolute-url");
var extend = require("extend");
var defined = require("defined");

var globby = require('globby');

var cwd = process.cwd();

function style(entryFilesGlob,options){
    let styleStream = through.obj();
    if(options === void 0)options = {};
    extend(options ,{relativeUrls:true})

    globby(entryFilesGlob).then(function(entryFiles){
        let streams = entryFiles.map(entryFile=>{
            let s = vfs.src(entryFile);
            let entryFileResolved = path.resolve(entryFile);
            let entryDirBase = path.dirname(entryFileResolved);
            let extname = path.extname(entryFile);
            let cssBuildPipeline = cssBuildPipelines.get(extname);
            if(typeof cssBuildPipeline==="function"){
                s = s.pipe(cssBuildPipeline(options,entryDirBase))
            }

            s = s.pipe(cssUrlStandlize(cwd,entryFileResolved))

            return s;
        })

        let merged = streams[0];
        if(streams.length>1){
            merged = mergeStream(streams)
        }
        merged.pipe(styleStream)
    })

    return styleStream
}
module.exports = style

var cssBuildPipelines = new Map();
cssBuildPipelines.set(".scss",sassBuild);
cssBuildPipelines.set(".sass",sassBuild);

function sassBuild(options, entryDirBase){
    if(!!options.relativeUrls){
        options.importer = sassRelativeUrlsImporter(entryDirBase)
    }
    return sass(options).on('error', sass.logError)
}

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
    }
}

function cssUrlStandlize(base,dirName){
    let reg = /url\(['"]?(.*?)['"]?\)/ig;

    let result = through.obj(function(file,env,next){
        let s = new Readable();
        s._read = function noop() {
            this.push(new Buffer(file.contents))
            this.push(null)
        };
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

