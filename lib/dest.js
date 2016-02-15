/* Created by tommyZZM on 2016/1/27. */
"use strict"
const cwd = process.cwd();
const path = require("path");
const Readable = require('stream').Readable;
const File = require("vinyl")
const vfs = require('vinyl-fs');
const xtend = require('xtend');
const through = require("through2");
const minimatch = require("minimatch");
const asyncreplace = require("async-replace");
const quote = require("quote");
const replaceFunction = require("./utils/replace-function");
const isUrlAbsolute = require("./utils").isUrlAbsolute
const normalizePath = require("./utils").normalizePath
const queryStringSplit = require("./tools/plugin/querify").queryStringSplit;
const queryStringPrase = require("./tools/plugin/querify").queryStringPrase;

const switcher = require("./utils/pattern-switcher");

const regexGetUrl = new RegExp("url\\(['\"]?(.*?)['\"]?\\)", "ig")

/**
 *
 * @param outFolder
 * @param opts
 * @returns {*}
 *
 * dest的高阶方法，主要功能：
 * 1.处理js和css文件中的url以及__url依赖
 */
exports.dest = function dest(outFolder, opts) {

    if(!outFolder)outFolder = "./";
    let options = xtend({
            assetsDest:false
            ,assetsBases:[]
            ,assetsPipeline:(s,p)=>p
        }
        ,opts);

    if(!Array.isArray( options.assetsBases )){
        options.assetsBases = (typeof options.assetsBases==="string")?[ options.assetsBases ]:[];
    }

    let urlResolvers = {};
    function addUrlReplacer(glob,replacer,write){
        return urlResolvers[glob] = {
            replacer:replacer
            ,defaultWrapper:write
        };
    }

    addUrlReplacer("*.css",function(contents,url,done){
        //TODO:use rework
        return asyncreplace(contents, regexGetUrl
            , (propDefault, propPath, pos, string, done)=>{
                url("",propPath,done)
            }
            , done)
    },(content)=>"url("+quote(content)+")");

    addUrlReplacer("*.js",function(contents,url,done){
        return replaceFunction("__url", contents, function (callee, args, done) {
            if(args[0].type==="string"){
                return url(callee.name,args[0].value,done)
            }
            done(null, callee(callee.defaultArguments));
        }).then(contents=>done(null, contents))
    },(content)=>quote(content));

    //let urlTransforms = [];
    //function addUrlTransforms(transform){
    //    transform(add);
    //    function add(condition,fn,wrapper){
    //        urlTransforms.push({condition:condition,transformer:fn,wrapper:wrapper});
    //    }
    //}
    //
    //addUrlTransforms(add=>{
    //    //path standardize transform
    //    add((parentfile,sourcefile,query)=>true
    //        ,function(basedir,targetbase,sourcefile,query,done){
    //            done(null,normalizePath(path.join(targetbase,path.basename(sourcefile))));
    //        }
    //    );
    //
    //    //image file to base64
    //    add((filename,query)=>query.base64
    //        ,function(basedir,targetbase,sourcefile,query,done){
    //
    //        }
    //    )
    //})

    return resolveUrl(outFolder,options)//resultStream.pipe(vfs.dest(outFolder,options));

    function resolveUrl(basedir,options){
        let globs = Object.keys(urlResolvers);
        return through.obj((file, env, next)=>{
            file.base = basedir||"./";

            let resolver = {replacer:(contents,url,done)=>done(null,contents)}
            let filename = path.basename(file.path);
            globs.some(glob=>minimatch(filename,glob)?(resolver=urlResolvers[glob]):false);

            let info = xtend(options
                ,{basedir:basedir,defaultWrapper:resolver.defaultWrapper});

            resolver.replacer(file.contents.toString()
                ,(name,url,done)=>loadUrlContents(parseUrlQuery(url,path.dirname(file.path)),file,info,done)
                ,(err,contents)=>{
                    file.contents = new Buffer(contents);
                    next(null,file);
                })
        })
    }

    function parseUrlQuery(url,basedir){
        let urlPath = url;
        let queryOptions = {};
        let absolute = true;
        if(!isUrlAbsolute(url)){
            absolute = false;
            let querySplit = queryStringSplit(url)
            if(querySplit.query !== void 0){
                queryOptions = queryStringPrase(querySplit.query);
            }
            urlPath = normalizePath(path.join(basedir,querySplit.path))
        }
        return {
            absolute:absolute
            ,path:urlPath
            ,query:queryOptions
        }
    }

    function loadUrlContents(parsed,parent,options,done){
        if(parsed.absolute){
            return done(null,options.defaultWrapper(parsed.path));
        }

        let sourcepath = parsed.path;
        let targetbase = options.assetsDest;
        let query = parsed.query;
        let basedir = path.join(cwd,options.basedir);
        let assetsPipeline = options.assetsPipeline;
        let parentfilename = path.basename(parent.path);

        if(options.assetsDest){
            options.assetsBases.some(base=>
                (minimatch(sourcepath,normalizePath(path.join(cwd,base,"**/*")),{matchBase:true})
                    ?(targetbase=path.join(options.assetsDest,path.relative(path.join(cwd,base),path.dirname(sourcepath)))):false)
            );
        }else{
            targetbase = path.relative(basedir,path.dirname(sourcepath));
        }

        let pipelineEntry = through.obj()
        let sourceInfo = {
            basedir:basedir
            ,targetbase: targetbase
            ,sourcepath: sourcepath
            ,query:query
            ,contents: new Buffer(normalizePath(path.join(targetbase,path.basename(sourcepath))))
        };

        pipelineEntry.push(sourceInfo);
        pipelineEntry.push(null);

        let pipelineSwitcher = switcher([parentfilename,sourcepath,query],[sourcepath,query])

        let pipelineFinally = assetsPipeline(
            pipelineSwitcher
            ,pipelineEntry);

        pipelineSwitcher.finally();

        pipelineFinally.pipe(through.obj(function(file,env,next){
            let wrapper = (typeof file.wrapper==="function")?file.wrapper:options.defaultWrapper;

            if(typeof file.wrapper==="object"){
                Object.keys(file.wrapper).some(glob=>(typeof file.wrapper[glob]==="function"
                    && minimatch(parentfilename,glob))?(wrapper=file.wrapper[glob]):false)
            }

            done(null,wrapper(file.contents.toString()))
            this.push(null);
        }))
    }
}

exports.write = function write(){

}


