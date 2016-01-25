"use strict"

var path = require("path")
var fs = require("fs");

var xtend = require("xtend");
var through = require("through2")
var extend = require("deep-extend")
var queryString = require('query-string')
var cwd = process.cwd();

module.exports = function (b, opts) {
    if(typeof opts.resolve!== "object"){
        return;
    }

    let resolveModules = getResolveModules(opts.resolve)

    let moduleDirectories= opts.moduleDirs.concat([]);
    moduleDirectories = (moduleDirectories).concat(["node_modules"])

    let regexIsRequireFromPath = p => regexRelativePath.test(p) || path.isAbsolute(p);
    let singleModulesIds = Object.keys(resolveModules);
    b._ignore = b._ignore.concat(singleModulesIds);

    b._mdeps.resolverOrigin = b._mdeps.resolver;
    b._mdeps.resolver = function (id, parent, cb) {

        let isRequireFromPath = regexIsRequireFromPath(id)

        if(resolveModules[id] && (typeof resolveModules[id].content === "string")){
            //需要传入一个不可能存在的路径
            return cb(null, path.join(cwd,id+".@resolve.js"), {});
        }

        let withQueryString = regexWithQueryString.exec(id);
        if(withQueryString){
            return cb(null, path.join(cwd,id), {});
        }

        if(!isRequireFromPath && !resolveModules[id]){
            parent.moduleDirectory = moduleDirectories;
        }

        b._mdeps.resolverOrigin(id,parent,cb)
    }

    var readFileOrigin = b._mdeps.readFile.bind(b._mdeps);
    b._mdeps.readFile =  function (file, id, pkg) {
        //在读取文件之前,判断文件是否存在,如果不存在则尝试返回重定向内容
        //console.log(pkg)
        let tr;
        if (!fs.existsSync(file)) {
            //检查是否为需要预处理的模块
            if(resolveModules[id] && resolveModules[id].content){
                tr = through();
                tr.push(resolveModules[id].content);
                tr.push(null);
                return tr
            }
        }

        return readFileOrigin(file,id,pkg)
            //.pipe(self.getTransforms(fakePath || file, pkg, {
            //   builtin: builtin,
            //   inNodeModules: parent.inNodeModules
            // }))
            // ...
            // 默认的module-deps会在读完文件后进行transform
    };
}

var globalString = 'var global = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {}'

var regexRelativePath = /^\.+(\\|\/)+.+/;
var regexWithQueryString = /.+(\?.*)/
//var regexValidGlobFormart = /^((\.(\\|\/))?((\w|\-)+(\\|\/))*)\*$/;

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
