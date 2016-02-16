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

const processBuiltins = "__process";

module.exports = function(b, opts){
    let processors = {};

    /**
     * @transform require processor
     * require("./xxx#")
     */
    b.redirectReadingFile((file,id)=>/#$/.test(file)
        ,(file,id,parent)=>{
            let tr = through();

            let fullname = file.substring(0,file.length-1)
            if(!path.extname(file)){
                parent.extensions.some(extname=>{
                    if(!!fs.existsSync(fullname+extname)){
                        fullname+=extname;
                        return true;
                    }
                })
            }

            tr.push("module.exports = require("+quote(createProcessModule(fs.readFileSync(fullname).toString(),fullname))+");");
            tr.push(null);

            return tr;
        }
    )

    /**
     * @transform inline processor
     * __process(function(require,done){...})
     */
    //transform
    b.on("prebundle",function(){
        b.transform(function (file, opts) {
            return through(function(buf, env, next){
                replaceFunction(processBuiltins,buf.toString(),function(callee,args,done){
                    if (args[0].type === "function") {
                        return done(null,callee(quote(
                            createProcessModule("module.exports = function(done){ p(require,done) }\n"
                            +"var p = "+args[0].value,file)),"require"));
                    }
                    return done(null,callee("","__noop"));
                })
                .then(content=>next(null,new Buffer(content)))
            });
        })
    })

    //加载processor
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
                    case "boolean":{
                        contents = result
                        break;
                    }
                    case "object":{
                        contents = stringify(result)
                        break;
                    }
                }

                tr.push("module.exports = " + contents + ";")
                tr.push(null);
            })
            return tr;
        })

    function createProcessModule(source,parentPath){
        let processorMd5 = quote({ quotes: '@' })(md5(source).substring(10,20))
        let processorFileName = path.join(path.dirname(parentPath),processorMd5+".js");

        //创建一个虚拟Nodejs Module;
        var processor = new Module(processorFileName);
        processor.filename = processorFileName;
        processor._compile(source,processorFileName);

        processors[processorMd5] = (typeof processor.exports==="function")?processor.exports:done=>done(null,processor.exports);
        return processorMd5
    }
}
