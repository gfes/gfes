"use strict"

var through = require("through2")
var extend = require("deep-extend")

module.exports = function (b, opts) {
    if(typeof opts.resolve!== "object"){
        return;
    }

    let resolveConfig = createResolveConfig(opts.resolve)
    let resolveIds = Object.keys(resolveConfig);
    b._ignore = b._ignore.concat(resolveIds);

    b.pipeline.get('deps').push(through.obj(function(row, enc, next) {
        next(null,row);
    }))

    //Monkeypatching b._mdeps.readFile
    b._mdeps.readFileOrigin = b._mdeps.readFile
    b._mdeps.readFile =  function (file, id, pkg) {
        let tr;
        if(!!resolveConfig[id]){
            tr = through();
            tr.push(resolveConfig[id].source);
            tr.push(null);
            return tr
        }

        return b._mdeps.readFileOrigin(file,id,pkg)
    };
}

var globalString = 'var global = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {}'

function createResolveConfig(optionResolve){
    Object.keys(optionResolve).forEach(key=>{
        let val = optionResolve[key];
        let checkIfGlobalResolve = /^global\:((\w|\$)+)/.exec(val);
        if(checkIfGlobalResolve && checkIfGlobalResolve[1]){
            optionResolve[key] = {
                matcher:checkIfGlobalResolve[1]
                ,source:globalString+="\nmodule.exports = global."+checkIfGlobalResolve[1]
            }
        }else{
            optionResolve[key] = null;
        }
    })

    let result = {};
    Object.keys(optionResolve).forEach(key=>{
        if(optionResolve[key]){
            result[key] = optionResolve[key]
        }
    })

    return result;
}