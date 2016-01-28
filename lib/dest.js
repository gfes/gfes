/* Created by tommyZZM on 2016/1/27. */
"use strict"
var path = require("path");
var Readable = require('stream').Readable;
var vfs = require('vinyl-fs');
var through = require('through2')
var querifyTransform = require("./tools/plugin/querify.js").transformObj

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
module.exports = function dest(outFolder, opt) {

    let resultStream = querifyTransform()

    if(outFolder){
        resultStream = resultStream.pipe(vfs.dest(outFolder,opt))
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
