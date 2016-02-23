/* Created by tommyZZM on 2016/2/17. */
"use strict"
const cwd = process.cwd();
const fs = require("fs");
const path = require("path");
const through = require("through2");
const replaceFunction = require("../utils/replace-function");
const switcher = require("../utils/switcher");
const quote = require("quote");
const crypto = require('crypto');
const stringify = require('json-stringify-safe');
const xtend = require("xtend");
const Promise = require("bluebird")
const Module = module.constructor;

const md5 = function (text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

module.exports = function( b , finalTransform ){

    let processors = {}
    let processorsMD5Map = {}

    b.processor = function(processor,options){
        processor(add,options)
        return this;

        function add(api,apiopts){
            apiopts = xtend(apiopts);
            let handlefn = null;
            let promiseCondition =  {
                handle:function(fn,returntype){
                    processors[api].__returntype = returntype;
                    handlefn = fn;
                }
            }
            processors[api] = function(){
                return new Promise(done=>done.apply(null,arguments)).then(_=>handlefn.apply(null,arguments));
            }
            Object.keys(apiopts).forEach(key=>processors[api][key]=apiopts[key])

            return promiseCondition;
        }
    }

    finalTransform(function(file){
        return through((buf ,enc ,next)=>{
            replaceFunction("__process",buf.toString(), function (callee, args, done) {
                switcher(args[0],args[1])
                    .case((arg0)=>arg0.type==="string" && !!processors[arg0.value] ,(inital,arg0value) => {
                        //console.log("finaltransform",inital,arg0);
                        let subarg = args.map(arg=>(arg.type==="unknow")?"":arg.value)
                        subarg.shift();
                        subarg = [path.relative(cwd,file)].concat(subarg)

                        return processors[arg0value].apply(null,subarg).then(result=>{

                            if(processors[arg0value].inline){
                                return resolveProcessorResult(result,processors[arg0value].__returntype);
                            }

                            let resultModule = createProcessorModule(JSON.stringify(subarg),{
                                exports:result
                            },arg0value)

                            return callee(quote(resultModule),"require");
                        });
                    })
                    .break()
                    .case((arg0)=>arg0.type==="string" && arg0.value[0]==="." ,(_,arg0value) => {
                        let modulePath = path.join(path.dirname(file),arg0value);
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
                    .run(/*callee(callee.defaultArguments)*/"undefined;/**processor**/",[args[0].value])
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
                let contents = resolveProcessorResult(result)||"undefined/**"+id+"**/";

                stream.push("module.exports = " + contents + ";")
                stream.push(null);
            })
            return stream
        }
    })

    return b;

    function createProcessorModule(id,module,prefix){
        if(prefix === void 0)prefix = "";
        let processorIdMd5 = quote({ quotes: '@' })(md5(id).substring(10,20))
        processorsMD5Map[prefix+processorIdMd5] = processorFunctionOrString(module);
        return prefix+processorIdMd5
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

    function resolveProcessorResult(result,type){
        let contents = void 0;
        let typecheck = type || typeof result;
        switch (typecheck) {
            default:
            case "string":{
                contents = quote(JSON.stringify(result));
                break;
            }
            case "function":
            case "boolean":{
                contents = result
                break;
            }
            case "object":{
                contents = stringify(result)
                break;
            }
        }
        return contents
    }
}

global.__process = function(args){}
