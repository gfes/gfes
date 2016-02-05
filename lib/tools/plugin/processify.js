/* Created by tommyZZM on 2016/2/3. */
"use strict"
const path = require("path");
const fs = require("fs");
const resolve = require("resolve");
const through = require("through2");
const crypto = require('crypto');
const quote = require("quote");
const stringify = require('json-stringify-safe');
const Module = module.constructor;

function md5 (text) {
    return crypto.createHash('md5').update(text).digest('hex');
}
const replaceFunction = require("../../utils/replace-function");

const processBuiltins = "process";

module.exports = function(b, opts){

    let processors = {};

    b.redirectReadingFile((file, id) => !!processors[id]
        ,(file,id)=>{
            let tr = through();

            processors[id]((err, result)=> {
                let contents = "undefined";
                switch (typeof result) {
                    case "string":{
                        contents = quote(result);
                        break;
                    }
                    case "object":{
                        contents = quote(stringify(result))
                        break;
                    }
                }

                tr.push("module.exports = " + contents + ";")
                tr.push(null);
            })
            return tr;
    })

    //transform
    b.on("prebundle",function(){
        b.transform(function (file, opts) {
            return through(function(buf, env, next){
                replaceFunction("__"+processBuiltins,buf.toString(),function(callee,args,done){
                    if (args[0].type === "function") {
                        let processorMd5 = quote({ quotes: '#' })(md5(args[0].value).substring(10,20))
                        let processorFileName = path.join(path.dirname(file),processorMd5+".js");

                        //创建一个虚拟Nodejs Module;
                        var processor = new Module(processorFileName);
                        processor.filename = processorFileName;
                        processor._compile("module.exports = function(done){ p(require,done) }\n"
                            +"var p = "+args[0].value,processorFileName);

                        processors[processorMd5] = processor.exports;
                        return done(null,callee(quote(processorMd5),"require"));
                    }
                    return done(null,callee("","__noop"));
                })
                    .then(content=>next(null,new Buffer(content)))
            });
        })
    })
}
