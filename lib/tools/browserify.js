"use strict";

var path = require("path");
var buffer = require('vinyl-buffer');
var browserify = require("browserify");
var builtins = require("browserify/lib/builtins");
//var globby = require('globby');
var extend = require('deep-extend');
var source = require('vinyl-source-stream');
var gutil = require("gulp-util");
var through = require("through2");

var resolvify = require("./plugin/resolvify")
var querify = require("./plugin/querify")

var defaultOptions = {
    insertGlobalVars:{
        __url:function (file, basedir) {
            return "require(\"__noop\")";
        }
    },
    builtins:extend(builtins,{
        __noop: require.resolve('../res/__noop.js')
    })
}

module.exports = function(entryFiles,options){
    let _options = extend(defaultOptions,options,{entryFiles:[]});

    if(typeof _options.standalone!=="string"){
        _options.standalone = false;
    }

    let br = browserify(_options);
    br.plugin(resolvify,{resolve:_options.resolve})

    br.originBundle = br.bundle;
    br.bundle = function(bundleFilename){
        br.plugin(querify.browserifyPlugin)
        br.add(entryFiles);
        let bundle = this.originBundle()
            .on('error', function (error) {
                gutil.log(gutil.colors.red(error.toString()));
            })
            .pipe(source(bundleFilename))
            .pipe(buffer())
            .pipe(through.obj((f,env,next)=>{
                f.isBrowserifyBundle = true;
                next(null,f)
            }))

        return bundle;
    }

    return br;
};