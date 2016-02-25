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

module.exports = function( b , finalTransform ){

    //let processors = {}
    let processorTransforms = []
    let processorsMD5Map = {}

    b.processor = function(processor,options){
        makeProcessor(processor,options)
        return this;

        function makeProcessor(processor,options){
            let processorPromise = function(filepath){
                return processor(filepath,options) //should return (args)=>:readableStream
            }
            processorTransforms.push(processorPromise);
        }
    }

    function createProcessTransformsPipeline(file,transformArguments){
        let input = through.obj();
        let output = through.obj();

        let context = {
            inline:function(boo){
                this._inline = boo;
                return this;
            }
            , type:function(type){
                this._type = type
                return this;
            }
        }

        let curr = combine.obj(processorTransforms.map(processor=>processor(file))
            .filter(createTr=>typeof createTr==="function")
            .map((createTr,i)=>{
                let tr = createTr.apply(context,transformArguments);
                let trStream = tr || through.obj();
                if(!utils.isReadWriteableStream(trStream)){
                    trStream = through.obj(function(_, enc,next){
                        if(typeof tr.then==="function"){
                            tr.then(result=>next(null,tr))
                        }else{
                            next(null,tr)
                        }
                    })

                }
                return wrapTransform(trStream)
            }))

        input.pipe(curr).pipe(output)
        var dup = duplexer.obj(input, output);
        dup.forceInline = context._inline;
        dup.forceType = context._type;
        return dup;
    }

    finalTransform(function(file){
        return through((buf ,enc ,next)=>{
            replaceFunction("__process",buf.toString(), function (callee, args, done) {
                switcher(args[0],args[1])
                    .case((arg0)=>arg0.type==="string" ,(inital) => {
                        let transformArguments = args.map(arg=>{
                            if(arg.type==="unknow"){
                                return arg
                            }
                            return arg.value
                        });


                        let transforms = createProcessTransformsPipeline(file,transformArguments);
                        let result = "/**processor:( "+transformArguments.join(", ")+" )**/";
                        let entryStream = through.obj();
                        entryStream.push(result);
                        entryStream.push(null);

                        let isInline = transforms.forceInline || objectpath.get(args[1],"value.inline");
                        let resultType = transforms.forceType;

                        return new Promise((pass,reject)=>{
                            entryStream
                                .pipe(transforms)
                                .pipe(through.obj((trresult ,enc ,next)=>{
                                    if(trresult instanceof Buffer){
                                        trresult = trresult.toString();
                                    }
                                    if(isInline){
                                        result = resolveProcessorResult(trresult,resultType);
                                    }else{
                                        let resultModule = createProcessorModule(JSON.stringify(args.map(arg=>arg.value).join(","))
                                            ,{
                                                exports:trresult
                                            })
                                        result = callee(quote(resultModule),"require");
                                    }
                                    next();
                                }))
                                .on("finish",()=>{
                                    pass(result)
                                })
                                .on("error",reject)
                        })
                    })
                    .break()
                    .case((arg0)=>arg0.type==="function" ,_=>{
                        return callee(quote(
                            compileProcessorModule("module.exports = function(done){ p(require,done) }\n"
                                +"var p = "+args[0].value,file)),"require")
                    })
                    .break()
                    .run(/*callee(callee.defaultArguments)*/"/**processor**/")
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

function wrapTransform (tr) {
    if (typeof tr.read === 'function') return tr;
    var input = through.obj(), output = through.obj();
    input.pipe(tr).pipe(output);
    var wrapper = duplexer.obj(input, output);
    tr.on('error', function (err) { wrapper.emit('error', err) });
    return wrapper;
}

var __process = function(args){}


