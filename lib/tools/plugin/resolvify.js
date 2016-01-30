"use strict"

var path = require("path")
var fs = require("fs");
var stream = require('stream');

var xtend = require("xtend");
var through = require("through2")
var extend = require("deep-extend")
var cwd = process.cwd();
var normalizePath = require("../../utils").normalizePath
var defaultResolve = {

};

module.exports = function (b, opts) {
    let resolveConfigs = xtend({},defaultResolve,opts.resolve)

    //获得重定向的模块,并忽略
    let resolveModules = getResolveModules(resolveConfigs)
    let singleModulesIds = Object.keys(resolveModules);
    let readFileOrigin = b._mdeps.readFile.bind(b._mdeps);
    let readFileRedirecter = [];
    let redurectIdMap = {}

    b._ignore = b._ignore.concat(singleModulesIds);

    //处理文件名和id
    b._mdeps.resolverOrigin = b._mdeps.resolver;
    b._mdeps.resolver = function (id, parent, cb) {
        let resolvedPath = id;

        // 重定向读取文件
        // ->1 :如果有重定向器符合条件,则cb返回预测的文件名路径
        if(readFileRedirecter.some(redirecter=>{
                if(redirecter.checker(id)){
                    //标记该id需要被重定向,并保存重定向器
                    redurectIdMap[id] = redirecter;
                    return true;
                }
            })){

            let parentDirName = cwd;
            if(/^\./.test(id)){
                parentDirName = path.dirname(parent.filename);
            }

            let fileName = id;
            if(!path.extname(fileName)){
                fileName+=".js"
            }

            resolvedPath = path.join(parentDirName,fileName);
            return cb(null, resolvedPath,{})
        }

        return b._mdeps.resolverOrigin(id,parent,cb)
    }

    b.redirectReadingFile = function(checker,tr,options){
        readFileRedirecter.push({checker:checker,tr:tr,options:options})
    }

    b._mdeps.readFile =  function (file, id, pkg) {
        let tr;
        //->2 如果该id需要被重定向
        let redirecter = redurectIdMap[id]
        if(redirecter){
            //使用重定向器
            tr = redirecter.tr(file,id,pkg)
            tr.on('error', err => { this.emit('error', err) });
            this.emit('file', file, id);
        }

        //->2 否则使用默认的browserify readFile
        if(!tr){
            tr = readFileOrigin(file,id,pkg)
        }

        return tr
            //.pipe(self.getTransforms(...)
            // 默认的module-deps会在读完文件后进行transform
    };

    //基本重定向器,映射id到特定模块
    b.redirectReadingFile(id=>!!resolveModules[id] && !!resolveModules[id].content
        ,function(file,id,pkg){
            let tr = through();
            tr.push(resolveModules[id].content);
            tr.push(null)
            return tr;
        })
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
                return resolveModules[key] = {
                    content: globalString += "\nmodule.exports = global." + checkIfGlobalResolve[1]+";"
                }
            }

            //redirect
            return resolveModules[key] = {
                content: "module.exports = require('" + val + "');"
            }
        }
    })

    return resolveModules;
}
