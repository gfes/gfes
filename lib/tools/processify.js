/* Created by tommyZZM on 2016/2/17. */
"use strict"
const fs = require("fs");
const path = require("path");
const through = require("through2");
const replaceFunction = require("../utils/replace-function");
const switcher = require("../utils/switcher");
const quote = require("quote");
const crypto = require('crypto');
const stringify = require('json-stringify-safe');
const Promise = require("bluebird")
const Module = module.constructor;

const md5 = function (text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

module.exports = function( b , transform ){

    let processors = {}
    let processorsMD5Map = {}

    b.processor = function(processor,options){
        processor(add,options)
        return this;

        function add(api){
            let handlefn = null;
            let promiseCondition =  {
                handle:function(fn){
                    handlefn = fn;
                }
            }
            processors[api] = function(){
                return new Promise(done=>done.apply(null,arguments)).then(_=>handlefn.apply(null,arguments));
            }

            return promiseCondition;
        }
    }

    transform(function(file){
        return through((buf ,enc ,next)=>{
            replaceFunction("__process",buf.toString(), function (callee, args, done) {
                switcher(args[0],args[1])
                    .case((arg0)=>arg0.type==="string" && !!processors[arg0.value] ,(inital,arg0) => {
                        let subarg = args.map(arg=>(arg.type==="unknow")?"":arg.value)
                        subarg.shift();
                        subarg = [file].concat(subarg)

                        return processors[args[0].value].apply(null,subarg).then(result=>{
                            let resultModule = createProcessorModule(JSON.stringify(subarg),{
                                exports:result
                            })

                            return callee(quote(resultModule),"require");
                        });
                    })
                    .break()
                    .case((arg0)=>arg0.type==="string" ,(_,arg0) => {
                        let modulePath = path.join(path.dirname(file),arg0.value);
                        if(fs.existsSync(modulePath)){
                            return callee(quote(createProcessorModule(modulePath,require(modulePath))),"require")
                            //...
                        }
                    })
                    .break()
                    .case((arg0)=>arg0.type==="function" ,_=>{
                        return callee(quote(
                            compileProcessorModule("module.exports = function(done){ p(require,done) }\n"
                                +"var p = "+args[0].value,file)),"require")
                    })
                    .break()
                    .run(/*callee(callee.defaultArguments)*/"undefined;/**processor**/",[args[0]])
                    .then(result=>done(null, result))
            }).then(contents=>next(null, contents))
            //next(null,buf)
        })
    })

    b.redirect(function(check){

        check((file,id)=>/#$/.test(id))
            .redirect(function(modulePath){
                let id = createProcessorModule(modulePath,{
                    exports:require(modulePath.substring(0,modulePath.length-1)+".js")
                })
                return runProcessor(through(),id);
            })

        check((file,id)=>!!processorsMD5Map[id])
            .redirect(function(file,id){
                return runProcessor(through(),id);
            })

        function runProcessor(stream,id){
            processorsMD5Map[id]((err, result)=> {
                let contents = "undefined/**"+id+"**/";
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

                stream.push("module.exports = " + contents + ";")
                stream.push(null);
            })
            return stream
        }
    })

    return b;

    function createProcessorModule(id,module){
        let processorIdMd5 = quote({ quotes: '@' })(md5(id).substring(10,20))
        processorsMD5Map[processorIdMd5] = processorFunctionOrString(module);
        return processorIdMd5
    }

    function compileProcessorModule(source,basePath){
        let processor;

        let processorFileName = path.join(path.dirname(basePath),md5(source)+".js");

        if(typeof basePath==="string"){
            processor = new Module(processorFileName);
            processor.filename = processorFileName;
            processor._compile(source,processorFileName);
        }

        let processorMd5 = createProcessorModule(source,processor)
        return processorMd5
    }

    function processorFunctionOrString(processor){
        return (typeof processor.exports==="function")?processor.exports:done=>done(null,processor.exports)
    }
}

