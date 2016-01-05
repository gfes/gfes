"use strict";

var path = require("path");
var through2 = require('through2');
var mergeStream = require("merge-stream");
var File = require('vinyl');
var buffer = require('vinyl-buffer');
var browserify = require("browserify");
var globby = require('globby');
var extend = require('deep-extend');
var source = require('vinyl-source-stream');

var gutil = require("gulp-util");

var browserifyBundleExtend = require("./browserify.bundle.plugin.js")

module.exports = function(entryFilesGolob,options){
    let _options = extend(options,options);
    if(!Array.isArray(entryFilesGolob) && typeof entryFiles==="string"){
        entryFilesGolob = [entryFilesGolob];
    }
    if(!Array.isArray(entryFilesGolob)){
        return;
    }

    globby(entryFilesGolob).then(function(entryFiles) {

        let merged = mergeStream();

        let entryFileDirName = path.basename(path.dirname(entryFiles))+".js";

        let br = browserify({
            entries: entryFiles,
            standalone: _options.standalone
        });

        br = browserifyAddPluginsAndTransforms(br, _options.plugins, _options.transforms);

        function bundle() {
            return br
                .plugin(browserifyBundleExtend)
                .bundle()
                .on('error', function (error) {
                    gutil.log(gutil.colors.red(error.toString()));
                })
                .pipe(source(entryFileDirName))
                .pipe(buffer())
        }

        //merged.on("data",(f)=>console.log(f))

        return merged.add(bundle());

    }).catch(function(err) {
        gutil.log(err);
    });
};

function browserifyAddPluginsAndTransforms(b,plugins,transforms){
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