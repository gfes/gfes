/* Created by tommyZZM on 2016/1/27. */
"use strict"
var path = require("path");
var Readable = require('stream').Readable;
var vfs = require('vinyl-fs');
var xtend = require('xtend')
var querifyTransform = require("./tools/plugin/querify.js").transformObj

var contentReplacers = require("./utils/content-replacer.js").contentReplacers;
var cssUrlReplacer = require("./tools/plugin/querify.js").cssUrlReplacer;
var jsUrlReplacer = require("./tools/plugin/querify.js").jsUrlReplacer;

/**
 *
 * @param outFolder
 * @param opt
 * @param resolver
 * @returns {*}
 *
 * dest的高阶方法，主要功能：
 * 1.处理js和css文件中的url以及__url依赖
 * 2.处理js文件中可能存在的外联依赖
 */
module.exports = function dest(outFolder, opts) {

    let options = xtend(opts)

    if(!Array.isArray(options.replacers))options.replacers=[]

    let resultStream = querifyTransform(xtend(options,{
        replacers:contentReplacers(([cssUrlReplacer,jsUrlReplacer]).concat(options.replacers))
        , urlqueryer:function(fullPath, queryOptions){
            console.log(fullPath,queryOptions)
            return fullPath
        }
    }))

    if(outFolder){
        resultStream = resultStream.pipe(vfs.dest(outFolder,options))
    }

    return resultStream
}

function createStreamFromString(str){
    let s = new Readable();
    s._read = function noop() {
        this.push(new Buffer(str))
        this.push(null)
    };
    return s
}
