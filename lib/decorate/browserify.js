"use strict";

var path = require("path");
var buffer = require('vinyl-buffer');
var browserify = require("browserify");
//var globby = require('globby');
var extend = require('deep-extend');
var source = require('vinyl-source-stream');
var crypto = require('crypto');
var gutil = require("gulp-util");

var resolvify = require("./browserify-plugin/resolvify")
var queryify = require("./browserify-plugin/queryify")
var resolvifyUrl = require("./browserify-plugin/resolveify-resolveurl.js")

var defaultOptions = {
    insertGlobalVars:{
        __url:function (file, basedir) {
            return "require(\"__noop\")";
        }
    }
}

module.exports = function(entryFiles,options){
    let _options = extend(defaultOptions,options,{entryFiles:[]});

    if(typeof _options.standalone!=="string"){
        _options.standalone = false;
    }

    let br = browserify(_options);
    br.plugin(resolvify,{resolve:_options.resolve})
    //br.plugin(queryify)

    br.originBundle = br.bundle;
    br.bundle = function(bundleFilename){
        br.add(entryFiles);

        //final transform
        br.transform(resolvifyUrl)

        let bundle = this.originBundle()
            .on('error', function (error) {
                gutil.log(gutil.colors.red(error.toString()));
            })
            .pipe(source(bundleFilename))
            .pipe(buffer())

        return bundle;
    }

    return br;
};