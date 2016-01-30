/* Created by tommyZZM on 2016/1/27. */
"use strict"
var path = require("path");
var Readable = require('stream').Readable;
var vfs = require('vinyl-fs');
var xtend = require('xtend')
var querifyTransform = require("./tools/plugin/querify.js").transformObj

var contentLoadersGroup = require("./utils/content-loader.js").contentLoadersGroup;
var CssUrlLoader = require("./tools/plugin/querify.js").CssUrlLoader;
var JsUrlLoader = require("./tools/plugin/querify.js").JsUrlLoader;

/**
 *
 * @param outFolder
 * @param opts
 * @returns {*}
 *
 * dest的高阶方法，主要功能：
 * 1.处理js和css文件中的url以及__url依赖
 * 2.处理js文件中可能存在的外联依赖
 */
module.exports = function dest(outFolder, opts) {

    let options = xtend(opts)

    if(!Array.isArray(options.contentloader))options.contentloader=[]

    let cssUrlLoader = CssUrlLoader(urlloaderer)
    let jsUrlLoader = JsUrlLoader(urlloaderer)
    function urlloaderer(fullPath, queryOptions){
        //console.log(fullPath,queryOptions)
        return fullPath
    }

    let resultStream = querifyTransform(xtend(options,{
        contentloader:contentLoadersGroup(([cssUrlLoader,jsUrlLoader]).concat(options.contentloader))
    }))

    if(options.__debug){
        return resultStream
    }
    return resultStream.pipe(vfs.dest(outFolder,options));
}

function createStreamFromString(str){
    let s = new Readable();
    s._read = function noop() {
        this.push(new Buffer(str))
        this.push(null)
    };
    return s
}
