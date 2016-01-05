/* Created by tommyZZM on 2015/11/10.*/
"use strict";

var fs = require("fs");
var path = require("path");
var url = require("url");

var gulp = require('gulp');
var sass = require('gulp-sass');
var less = require('gulp-less');
var deepMerge = require("deep-extend");
var replaceStream = require("replacestream");
var isUrlAbsolute = require("is-absolute-url");

var configableTaskWrapper = require("../utils/configableTask.js").configableTaskWrapper;

function styleTask(taskName,entryFile){
    if(typeof taskName!=="string" || typeof entryFile!=="string"){
        return;
    }

    let task = new configableTaskWrapper("css@"+taskName);

    task.makeStream(function(options){
        options.relativeUrls = (options.relativeUrls === void 0?true:!!options.relativeUrls);

        let s = gulp.src(entryFile);
        let entryDirBase = path.dirname(path.resolve(entryFile));
        let extname = path.extname(entryFile);
        let task = tasks.get(extname);
        if(typeof task==="function"){
            s = task(s,options,entryDirBase)
        }

        return s;
    });

    return task;
}
module.exports = styleTask;

var tasks = new Map();
tasks.set(".less",lessBuild);
tasks.set(".scss",sassBuild);
tasks.set(".sass",sassBuild);

function sassBuild(stream, options, entryDirBase){
    if(!!options.relativeUrls){
        options.importer = sassRelativeUrlsImporter(entryDirBase)
    }
    return stream
        .pipe(sass(deepMerge(options)).on('error', sass.logError))
}


function sassRelativeUrlsImporter(entryDirBase){
    let reg = /url\(['"]?(.*?)['"]?\)/ig;
    return function(targetUrl, prev, done) {
        if(path.extname(targetUrl)!==".scss"){
            targetUrl += ".scss";
        }
        targetUrl = path.isAbsolute(targetUrl)?targetUrl:path.join(entryDirBase,targetUrl);

        //let relative = path.relative(path.dirname(targetUrl),entryDirBase);

        let finalContnets = "";
        let s = fs.createReadStream(targetUrl);
        s.pipe(replaceStream(reg, function (prop, propUrl) {
                let standarUrl = propUrl;
                if(isUrlAbsolute(standarUrl)){
                    return prop;
                }
                standarUrl = path.relative(entryDirBase, path.join(path.dirname(targetUrl), propUrl));
                return 'url("' + standarUrl.replace(/\\/g, "/") + '")';
            }))
            .on("data", (chunk)=> {
                finalContnets += chunk
            });
        s.on('end', ()=> {
            done({contents: finalContnets.toString()})
        });
    }
}

function lessBuild(stream, options){
    return stream
        .pipe(less(options))
}

