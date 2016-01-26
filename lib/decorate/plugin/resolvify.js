"use strict"

var path = require("path")
var fs = require("fs");
var stream = require('stream');

var xtend = require("xtend");
var through = require("through2")
var extend = require("deep-extend")
var cwd = process.cwd();

var regexRelativePath = /^\.+(\\|\/)+.+/;

module.exports = function (b, opts) {
    if(typeof opts.resolve!== "object"){
        opts.resolve = {}
    }

    //获得重定向的模块,并忽略
    let resolveModules = getResolveModules(opts.resolve)
    //let moduleDirectories= opts.moduleDirs.concat([]);
    //moduleDirectories = (moduleDirectories).concat(["node_modules"])
    let regexIsRequireFromPath = p => regexRelativePath.test(p) || path.isAbsolute(p);
    let singleModulesIds = Object.keys(resolveModules);
    b._ignore = b._ignore.concat(singleModulesIds);

    //
    let paramedFileMap = {};
    let paramedSingleCount = 0

    //处理文件名和id
    //注意,传入的文件名会被缓存,如果多次依赖的时候只会使用第一次的缓存
    b._mdeps.resolverOrigin = b._mdeps.resolver;
    b._mdeps.resolver = function (id, parent, cb) {
        let resolvedPath = id;
        let idParase = parasePathIfWithQueryString(id)
        let isRequireFromPath = regexIsRequireFromPath(idParase.file)

        if( idParase.params && isRequireFromPath){

            //判断文件是否会从缓存读取同一个文件,
            // 因为我们可能在不同的地方通过不同参数引用同一个被依赖文件
            // 因此这里有一个简单的缓存机制,默认情况下,这些依赖都会指向同一个文件,而参数会被合并
            //在引用文件前添加!则会每次都单独读取文件
            if(idParase.cache){
                //为文件添加特殊后缀名,使其和正常的模块区分开来
                resolvedPath = path.join(path.dirname(parent.filename),idParase.file+"@paramed");
            }else{
                resolvedPath = path.join(path.dirname(parent.filename),idParase.file+"@paramed"+(paramedSingleCount++));
            }

            //因为browserify会对.json后缀的文件进行特殊处理,所以如果原文件为json则添加.json
            if(path.extname(idParase.file)===".json"){
                resolvedPath+=".json";
            }

            if(!paramedFileMap[resolvedPath]){
                paramedFileMap[resolvedPath] = "";
            }

            paramedFileMap[resolvedPath] += "&"+idParase.params
            return cb(null, resolvedPath,{});
        }

        if( resolveModules[id] && resolveModules[id].content ){
            resolvedPath = path.join(cwd,idParase.file+"@resolved");
            return cb(null, resolvedPath,{})
        }

        return b._mdeps.resolverOrigin(id,parent,cb)
    }

    let readFileOrigin = b._mdeps.readFile.bind(b._mdeps);
    let readFileRedirecterSet = new Set();
    let readFileRedirecter = [];

    b.redirectReadingFile = function(tr,options){
        if(!readFileRedirecterSet.has(tr)){
            readFileRedirecterSet.add(tr);
            readFileRedirecter.push({tr:tr,options:options});
        }
    }

    //重定向模块
    b.redirectReadingFile(function(file,id){
        id = parasePathIfWithQueryString(id).file
        if(resolveModules[id] && resolveModules[id].content){
            let tr = through();
            tr.push(resolveModules[id].content);
            tr.push(null)
            return tr;
        }
    })

    b._mdeps.readFile =  function (file, id, pkg) {

        let tr;
        let params = ""
        if(paramedFileMap[file]){
            params = paramedFileMap[file]
        }

        file = file.replace(/@(\w|\.|\-)+$/,"");

        //重定向读取文件
        readFileRedirecter.some(redirecter=>{
            let result
            if(typeof redirecter.tr==="function"){
                result = redirecter.tr(file,id,xtend(redirecter.options,{_pkg:pkg,_params:params}));
            }

            if(isReadableStream(result)){
                tr = result;
                return true;
            }
        });

        if(!tr){
            tr = readFileOrigin(file,id,pkg)
        }else{
            tr.on('error', err => { this.emit('error', err) });
            this.emit('file', file, id);
        }
        return tr
            //.pipe(self.getTransforms(...)
            // 默认的module-deps会在读完文件后进行transform
    };
}

var globalString = 'var global = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {}'

function getResolveModules(optionResolve){
    let resolveModules = {};

    let optionResolveKeys = Object.keys(optionResolve)

    optionResolveKeys.forEach(key=>{
        let val = optionResolve[key];

        if(typeof val === "string") {
            let checkIfGlobalResolve = /^global\:((\w|\$)+)/.exec(val);

            //import from global
            if (checkIfGlobalResolve && checkIfGlobalResolve[1]) {
                resolveModules[key] = {
                    content: globalString += "\nmodule.exports = global." + checkIfGlobalResolve[1]+";"
                }
            }

            //redirect
            if (regexRelativePath.test(val)){
                resolveModules[key] = {
                    content: "module.exports = require('" + val + "');"
                }
            }
        }
    })

    return resolveModules;
}

function isReadableStream(obj) {
    return (obj instanceof stream.Stream &&
        typeof obj._read === 'function')
}

var regexWithQueryString = /(.+)\?(.*)/
function parasePathIfWithQueryString(somePath){
    let cache = true;
    if((/^!.+/).test(somePath)){
        somePath = somePath.replace(/^!/,"")
        cache = false
    }

    let execResult = regexWithQueryString.exec(somePath)

    if( execResult ){
        return {file:execResult[1], params:execResult[2], cache:cache}
    }
    return {file:somePath}
}