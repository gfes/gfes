"use strict";

var path = require("path");
var buffer = require('vinyl-buffer');
var browserify = require("browserify");
//var globby = require('globby');
var extend = require('deep-extend');
var source = require('vinyl-source-stream');
var crypto = require('crypto');
var gutil = require("gulp-util");

module.exports = function(entryFiles,options){
    let _options = extend({},options,{entryFiles:[]});

    if(typeof _options.standalone!=="string"){
        _options.standalone = false;
    }

    let br = browserify(_options);
    br.plugin(require("./plugin/resolvify"),{resolve:_options.resolve,moduleDirs:_options.moduleDirs})
    br.plugin(require("./plugin/queryify"))

    br.originBundle = br.bundle;
    br.bundle = function(bundleFilename){
        br.add(entryFiles);
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