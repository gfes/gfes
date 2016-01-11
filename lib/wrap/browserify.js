"use strict";

var path = require("path");
var through = require('through2');
var mergeStream = require("merge-stream");
var buffer = require('vinyl-buffer');
var browserify = require("browserify");
//var globby = require('globby');
var extend = require('deep-extend');
var source = require('vinyl-source-stream');
var crypto = require('crypto');
var gutil = require("gulp-util");
var defined = require('defined');

var factorBundle = require("./browserify.plugin.factor-bundle.js");
//var metaify = require("./browserify.transform.metaify.js");

module.exports = function(entryFiles,options){
    let _options = extend({multiplyOutput:false},options);

    let merged = mergeStream();

    if(!Array.isArray(entryFiles) && typeof entryFiles==="string"){
        entryFiles = [entryFiles];
    }
    if(!Array.isArray(entryFiles)){
        return merged;
    }

    if(entryFiles.length===1){
        _options.multiplyOutput = false;
    }

    let entryFileOutputs = new mergeStream();

    let outputFileNames = ""

    if(entryFiles.length>1 && !!_options.multiplyOutput){
        if(Array.isArray(_options.standalone) && _options.standalone.length>0){
            _options.standaloneArray = _options.standalone
        }

        if(_options.multiplyOutput.extractCommon){
            _options.extractCommonMd5
                = "common"+crypto.createHash('md5').update(new Buffer((new Date()).getTime()+"")).digest("hex").substring(0,9);
            _options.standalone = _options.extractCommonMd5
        }

        _options.entryFileOutputs = entryFiles.map((filename,i)=>{
            if(outputFileNames[i]){
                let output = through.obj().pipe(source(outputFileNames[i]));
                merged.add(output);
                return output
            }
        }).filter(outputs=>!!outputs)

        merged.add(entryFileOutputs.pipe(buffer()))
    }else{
        if(typeof _options.standalone!=="string"){
            _options.standalone = false;
        }
    }

    let br = browserify({
        entries: entryFiles,
        standalone: _options.standalone
    });

    //br = browserifyAddPluginsAndTransforms(br, _options.plugins, _options.transforms);

    br.plugin(factorBundle,_options)

    br.originBundle = br.bundle;
    br.bundle = function(bundleFilenames){
        outputFileNames = entryFiles.map((filename,i)=>{
            let dirnames = path.basename(path.dirname(filename))+".js";
            let outputName
            if(Array.isArray(_options.standalone)){
                outputName = _options.standalone[i]+".js"
            }
            if(Array.isArray(bundleFilenames)){
                outputName = bundleFilenames[i]+".js"
            }
            if(typeof bundleFilenames === "string" && i===0 && !!bundleFilenames){
                outputName = bundleFilenames
            }
            return defined(outputName,dirnames)
        });

        let bundle = this.originBundle()
            .on('error', function (error) {
                gutil.log(gutil.colors.red(error.toString()));
            })
            .pipe(source(_options.multiplyOutput.extractCommon?"common.js":outputFileNames[0]))
            .pipe(buffer())

        if((_options.multiplyOutput.extractCommon && options.multiplyOutput) || !options.multiplyOutput){
            merged.add(bundle);
        }

        return merged;
    }

    return br;
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