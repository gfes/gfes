/* Created by tommyZZM on 2016/1/27. */
"use strict"
var path = require("path")
var stream = require('stream');

exports.isReadableStream = function(obj) {
    return (obj instanceof stream.Stream &&
    typeof obj._read === 'function')
}

exports.isStreamObjectMode = function(obj) {
    if(!(obj instanceof stream.Stream) && !obj._writableState){
        return false;
    }
    return obj._writableState.objectMode
}

function normalizePath(p){

    if(!path.isAbsolute(p) && !/^\./.test(p)){
        p = "./"+p
    }

    return p.replace(/\\/g, "/")
}
exports.normalizePath = normalizePath

exports.standlizeUrl =  function (base,dirName,keywords){
    if(keywords===void 0) keywords = "url";

    let reg = new RegExp(keywords+"\\(['\"]?(.*?)['\"]?\\)","ig");///url\(['"]?(.*?)['"]?\)/ig;

    return function(contents){
        return contents.replace(reg, (prop, propUrl)=>{
            let standarUrl = propUrl;
            if(isUrlAbsolute(standarUrl)){
                return prop;
            }
            standarUrl = path.relative(base, path.join(path.dirname(dirName), propUrl));
            return keywords+'("' + normalizePath(standarUrl) + '")';
        });
    }
}

var regexIsUrlAbsolute = /(^(?:\w+:)\/\/)/ ;
var regexIsUrlBase64 = /data:(\w+)\/(\w+);/
function isUrlAbsolute (url) {
    if (typeof url !== 'string') {
        throw new TypeError('Expected a string');
    }

    if(regexIsUrlAbsolute.test(url)){
        return true;
    }

    return !!regexIsUrlBase64.test(url);
}
exports.isUrlAbsolute = isUrlAbsolute;