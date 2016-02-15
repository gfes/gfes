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
var processify = require("./plugin/processify")

var defaultOptions = {
    insertGlobalVars:{
        __noop:function (file, basedir) {
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

    let b = browserify(_options);
    b.plugin(resolvify,{resolve:_options.resolve});
    b.plugin(querify);
    b.plugin(processify)

    b.queryloader(require("./loader/urlloader.js"))

    b.originBundle = b.bundle;
    b.bundle = function(bundleFilename){
        b.emit("prebundle");
        b.add(entryFiles);
        let bundle = this.originBundle()
            .on('error', function (error) {
                gutil.log(gutil.colors.red(error.toString()));
                bundle.emit("error",error.toString())
            })
            .pipe(source(bundleFilename))
            .pipe(buffer())
            .pipe(through.obj((f,env,next)=>{
                f.isBrowserifyBundle = true;
                next(null,f)
            }))

        return bundle;
    }

    return b;
};