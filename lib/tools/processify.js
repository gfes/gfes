/* Created by tommyZZM on 2016/2/17. */
"use strict"
const cwd = process.cwd();
const fs = require("fs");
const path = require("path");
const through = require("through2");
const quote = require("quote");
const crypto = require('crypto');
const stringify = require('json-stringify-safe');
const string2stream = require("string-to-stream");
const xtend = require("xtend");
const Promise = require("bluebird")
const Module = module.constructor;
const duplexer = require('duplexify');
const combine = require('stream-combiner2');
const objectpath = require("object-path")

const utils = require("../utils")
const replaceFunction = require("../utils/replace-function");
const switcher = require("../utils/switcher");

const md5 = function (text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

module.exports = function( b ,finalTransform ){
    let processorsMD5Map = {}

    b.processor = function(processor,options){
        this.transform(processorTransformer(makeProcessor(processor,options)));
        return this;

        function makeProcessor(processor,options){
            return function(context,accept,filepath){
                return processor.call(context || {},accept,filepath,options) //should return (args)=>:readableStream
            }
        }
    }

    function processorTransformer(processor){
        return filepath =>
            through((buf ,enc ,next)=>{
                replaceFunction("__process",buf.toString(), function (callee, args, done) {
                    switcher(args[0],args[1])
                        .case((arg0)=>arg0.type==="string" ,(inital) => {
                            let processArguments = args.map(arg=>arg.type==="unknow"?arg:arg.value)
                            let isInline = true;
                            let returnType;
                            let isAccepted = false;

                            let acceptPromise = function (codition){
                                let promise = new Promise(function(pass,reject){
                                    if(codition.apply(null,processArguments)){
                                        isAccepted = true;
                                        pass.apply(null,processArguments);
                                    }
                                })
                                promise.catch(_=>false)
                                return promise;
                            }

                            let processorPromise = processor({
                                inline:boo=>{
                                    isInline = boo
                                }
                                , return:type=>returnType = type
                            },acceptPromise,filepath);

                            //console.log("isInline",processArguments,isInline);

                            if(typeof processorPromise.then === "function" && isAccepted){
                                return processorPromise
                                    .then((result=>{
                                        //console.log("isInline",processArguments,isInline);
                                        return processorResultPromisify(result)
                                    }))
                                    .then((result)=>{
                                        if(result instanceof Buffer){
                                            result = result.toString();
                                        }
                                        if(isInline){
                                            return resolveProcessorResult(result,returnType);
                                        }else{
                                            let resultModule = createProcessorModule(JSON.stringify(args.map(arg=>arg.value).join(","))
                                                ,{
                                                    exports:result
                                                })
                                            return callee(quote(resultModule),"require");
                                        }
                                    })
                                    .finally(_=>inital)
                            }else{
                                return inital;
                            }
                        })
                        .break()
                        .run(callee(callee.defaultArguments))
                        .then(result=>done(null, result))
                }).then(contents=>next(null, contents))
            })
    }

    finalTransform(function(filepath) {
        return through((buf, enc, next)=> {
            replaceFunction("__process", buf.toString(), function (callee, args, done) {
                switcher(args[0], args[1])
                    .case((arg0)=>arg0.type === "function", _=> {
                        return callee(quote(
                            compileProcessorModule("module.exports = function(done){ p(require,done) }\n"
                                + "var p = " + args[0].value, filepath)), "require")
                    })
                    .break()
                    .run("/!**processor**!/")
                    .then(result=>done(null, result))
            }).then(contents=>next(null, contents))
        })
    })

    function processorResultPromisify(result){
        return new Promise((pass,reject)=>{
            if(utils.isReadWriteableStream(result)){
                let haspassed = false
                result.on("data",obj=>{
                    if(haspassed)return haspassed = true;
                    pass(obj);
                })
            }
            pass(result);
        })
    }

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
                let contents = resolveProcessorResult(result)||"undefined;/**"+id+"**/";

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

    function resolveProcessorResult(result,forceType){
        let contents = void 0;
        let typecheck = forceType || typeof result;
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

var __process = function(args){}


