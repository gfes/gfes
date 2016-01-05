/* Created by tommyZZM on 2015/12/25. */
"use strict";

var path = require("path");
var gulp = require("gulp");
var through = require("through2");
var multimatch = require("multimatch");
var Promise = require("bluebird");

exports.resolve = function(){
    let transform = function(file, encoding, callback) {
        file.base = "./";
        //使用Promise的方式异步处理文件
        resolveFileConent(file,(file)=>{
            this.push(file);
            callback();
        });
    };

    let flush = function(callback){
        callback();
    };

    let result = through.obj(transform,flush);
    result.followPipelines = [gulp.dest("./")];

    return result;
};

function resolveFileConent(file,callback){
    let filename = path.basename(file.path);
    let matchFunctions = resolveFunctionsArray()
        .filter(ele=>multimatch(filename,ele.pattern).length>0)
        .map(ele=>ele.fn);
    let promise = new Promise(cb=>cb(file));

    //文件总是按顺序处理的
    matchFunctions.forEach(fn=>{
        promise = promise.then(fn)
    });
    promise.then(callback);
}

var resolveFunctions = new Map();

defResolve("*.css",function(file,callback){
    console.log("todo:css",file.path);
    file.contents = new Buffer(file.contents.toString());
    callback(null,file);
});

//defResolve("*.js",function(file,callback){
//    console.log("todo:js",file.path);
//    file.contents = new Buffer(file.contents.toString());
//    callback(null,file);
//});

function defResolve(fileNamePattern,fn){
    if(typeof fileNamePattern==="string" && typeof fn==="function"){
        resolveFunctions.set(fileNamePattern,Promise.promisify(fn));
    }
}

function resolveFunctionsArray(){
    let result = [];
    resolveFunctions.forEach((fn,pattern)=>result.push({fn:fn,pattern:pattern}))
    return result;
}