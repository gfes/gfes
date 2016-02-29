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
        if(typeof processor!=="function")return this;
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
                        //TODO:SourceMap
                        .case((arg0)=>arg0.type==="string" ,(inital) => {
                            let processArguments = args.map(arg=>arg.type==="unknow"?arg:arg.value)
                            let isInline = true;
                            let returnType;
                            let isAccepted = false;

                            let acceptPromise = function (codition){
                                let promise = new Promise(function(pass,reject){
                                    if(codition.apply(null,processArguments)){
                                        isAccepted = true;
                                        pass(processArguments);
                                    }
                                })
                                promise.catch(_=>false);

                                return {
                                    then:function(fn){
                                        return promise.then(args=>fn.apply(null,args))
                                    }
                                };
                            }

                            let processorPromise = processor({
                                inline:boo=>{
                                    isInline = boo
                                }
                                , return:type=>returnType = type
                            },acceptPromise,filepath);

                            //console.log("isInline",processArguments,isInline);

                            if(typeof processorPromise!=="undefined" &&
                                typeof processorPromise.then === "function" && isAccepted){
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
                    //TODO:SourceMap
                    .case((arg0)=>arg0.type === "function", _=> {
                        let md5 = compileProcessorModule("module.exports = function(require,done){ p.call(this,require,done) }\n"
                            + "var p = " + args[0].value+";module.exports.__filename = __filename;", filepath);

                        return new Promise((pass,reject)=>{
                            runProcessor(md5,(content)=>{
                                pass(content)
                            })
                        })
                    })
                    .break()
                    .run("undefined/**!processor!**/")
                    .then(result=>done(null, result))
            }).then(contents=>{
                next(null, contents)
            })
        })
    })

    function processorResultPromisify(result){
        return new Promise((pass,reject)=>{
            if(utils.isReadWriteableStream(result)){
                let entry = through.obj();
                entry.push({});
                entry.push(null);
                entry.pipe(result);

                let haspassed = false
                return result.on("data",obj=>{
                    if(haspassed)return haspassed = true;
                    pass(obj);
                })
            }
            return pass(result);
        })
    }

    b.redirect(function(check){

        check((file,id)=>/#$/.test(id))
            .redirect(function(modulePath){
                let id = createProcessorModule(modulePath,{
                    exports:require(modulePath.substring(0,modulePath.length-1)+".js")
                })
                let tr = through();
                runProcessor(id,(contents)=>{
                    tr.push("module.exports = " + contents + ";")
                    tr.push(null);
                });
                return tr;
            })

        check((file,id)=>!!processorsMD5Map[id])
            .redirect(function(file,id){
                let tr = through();
                runProcessor(id,(contents)=>{
                    tr.push("module.exports = " + contents + ";")
                    tr.push(null);
                });
                return tr
            })
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

    function runProcessor(id,callbck){
        let fn = processorsMD5Map[id];
        let returnType;
        let context = {
            return:type=>returnType = type
        }
        fn.call(context,function(id){
            if(typeof id!=="string" || id.substring(0,1)!=="."){
                return require(id)
            }
            return require(path.join(path.dirname(fn.__filename),id));
        },(err, result)=> {
            let contents = resolveProcessorResult(result,returnType)||"undefined;/**"+id+"**/";
            callbck(contents)
        })
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


