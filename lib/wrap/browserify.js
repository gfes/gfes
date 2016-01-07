"use strict";

var path = require("path");
var through2 = require('through2');
var mergeStream = require("merge-stream");
var buffer = require('vinyl-buffer');
var browserify = require("browserify");
var globby = require('globby');
var extend = require('deep-extend');
var source = require('vinyl-source-stream');
var crypto = require('crypto');
var gutil = require("gulp-util");
var defined = require('defined');

var factorBundle = require("./browserify.plugin.factor-bundle.js");

module.exports = function(entryFilesGolob,options){
    let _options = extend({multiplyOutput:false},options);

    if(!Array.isArray(entryFilesGolob) && typeof entryFiles==="string"){
        entryFilesGolob = [entryFilesGolob];
    }
    if(!Array.isArray(entryFilesGolob)){
        return;
    }

    let merged = mergeStream();

    globby(entryFilesGolob).then(function(entryFiles) {

        if(entryFiles.length===1){
            _options.multiplyOutput = false;
        }

        let entryFileOutputs = new mergeStream();

        let outputFileNames = entryFiles.map((filename,i)=>{
            let dirnames = path.basename(path.dirname(filename))+".js";
            let outputName
            if(Array.isArray(_options.standalone)){
                outputName = _options.standalone[i]+".js"
            }
            if(Array.isArray(_options.output)){
                outputName = _options.output[i]+".js"
            }
            if(typeof _options.output === "string" && i===0 && !!_options.output){
                outputName = _options.output
            }
            return defined(outputName,dirnames)
        });
        //TODO:重名

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
                let result =  through2.obj().pipe(source(outputFileNames[i]))
                entryFileOutputs.add(result)
                return result;
            })

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

        br = browserifyAddPluginsAndTransforms(br, _options.plugins, _options.transforms);

        var bundle = (()=>{
            return br
                .plugin(factorBundle,_options)
                .bundle()
                .on('error', function (error) {
                    gutil.log(gutil.colors.red(error.toString()));
                })
                .pipe(source(_options.multiplyOutput.extractCommon?"common.js":outputFileNames[0]))
                .pipe(buffer())
        })()

        if((_options.multiplyOutput.extractCommon && options.multiplyOutput) || !options.multiplyOutput){
            merged.add(bundle);
        }

        return merged;

    }).catch(function(err) {
        gutil.log(err);
    });

    return merged;
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