/* Created by tommyZZM on 2016/1/27. */
"use strict"
const path = require("path")
const stream = require('stream');
const queryString = require('query-string');

module.exports.queryStringSplit = queryStringSplit;
module.exports.queryStringPrase = queryStringPrase;

function queryStringSplit(str){
    let querySplit = str.split("?")
    return {path:querySplit[0],query:querySplit[1]}
}

function queryStringPrase(str){
    let parsed = queryString.parse(str);
    Object.keys(parsed).forEach(key=>{
        if(!parsed[key] && typeof parsed[key]!=="number"){
            return parsed[key] = true;
        }
        if(parsed[key]==="true"){
            return parsed[key] = true;
        }else if(parsed[key]==="false"){
            return parsed[key] = false;
        }
    })
    return parsed;
}


exports.ArrayFirstMatch = function(array,callback,thisArg){
    let result;
    array.some(function(ele){
        if(callback.apply(thisArg,arguments)){
            result = ele;
        }
    })
    return result
}

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