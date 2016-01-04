"use strict";

var path = require("path");

var gulp = require("gulp");
var gutil = require("gulp-util");
var browserify = require("browserify");
var watchify = require("watchify");
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var extend = require('deep-extend');

var configableTaskWrapper = require("../_lib/configableTask.js").configableTaskWrapper;

function scriptTask(taskName,entryFile){
    if(typeof taskName!=="string" || typeof entryFile!=="string"){
        return;
    }

    let entryFileName = path.basename(entryFile);

    let task = new configableTaskWrapper("js@"+taskName);
    task.makeStream(function(options){
        return gulp.src(entryFile);
    });

    task.beowserify = function(options){
        this.makeStream((_options)=>{
            options = extend(options,_options);

            let br = browserify({
                entries:entryFile,
                standalone:options.standalone
            });

            br = broserifyAddPluginsAndTransforms(br,options.plugins,options.transforms);

            function bundle(){
                return br
                    .bundle()
                    .on('error', function (error) { gutil.log(gutil.colors.red(error.toString())); })
                    .pipe(source(entryFileName))
                    .pipe(buffer())
            }

            return bundle();
        });

        this.use = function(){

        };

        return this;
    };

    task.evalMeta = function(){
        this.injectEvalMeta = true;
    };


    return task;
}
module.exports = scriptTask;

function broserifyAddPluginsAndTransforms(b,plugins,transforms){
    var resultB = b;
    applyAddons(plugins,"plugin");
    applyAddons(transforms,"transform");
    function applyAddons(addons,type){
        if(!Array.isArray(addons)){
            return;
        }
        addons.filter(ele=>Array.isArray(ele) && ele[0]).forEach(ele=> {
            let addon = {
                module: ele[0]
                , options: ele[1] || {}
            };
            resultB[type](addon.module, addon.options || {});
        });
    }
    return resultB
}

