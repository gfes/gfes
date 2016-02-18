/* Created by tommyZZM on 2016/1/27. */
"use strict"
const cwd = process.cwd();
const fs = require("fs");
const path = require("path");
const Readable = require('stream').Readable;
const File = require("vinyl")
const vfs = require('vinyl-fs');
const mime = require("mime");
const xtend = require('xtend');
const through = require("through2");
const minimatch = require("minimatch");
const asyncreplace = require("async-replace");
const quote = require("quote");
const Promise = require("bluebird");
const rev = require('gulp-rev');
const mergeStream = require("merge-stream");
const mkdirp = require('mkdirp');

const replaceFunction = require("./utils/replace-function");
const isUrlAbsolute = require("./utils").isUrlAbsolute
const normalizePath = require("./utils").normalizePath
const queryStringSplit = require("./utils").queryStringSplit;
const queryStringPrase = require("./utils").queryStringPrase;
const switcher = require("./utils/switcher");
const regexGetUrl = new RegExp("url\\(['\"]?(.*?)['\"]?\\)", "ig")

/**
 *
 * @param outFolder
 * @param opts
 * @returns {*}
 *
 * dest的封装方法，主要功能：
 * 1.处理js和css文件中的url(__url)依赖
 *   - 添加hash
 *   - 处理路径
 *   - 捆绑输出
 */
exports.dest = function dest(outFolder, opts) {

    let assetsFinalCache = {}

    if(!outFolder)outFolder = "./";
    let options = xtend({
            assetsDest:false
            ,assetsBases:[]
            ,assetsRev:true
            //,assetsPipeline:s => s
        }, opts);

    if(!Array.isArray( options.assetsBases )){
        options.assetsBases = (typeof options.assetsBases==="string")?[ options.assetsBases ]:[];
    }

    let urlResolvers = {};
    function addUrlReplacer(glob,replacer,wrap){
        return urlResolvers[glob] = {
            replacer:replacer
            ,defaultWrapper:wrap
        };
    }

    addUrlReplacer("*.css",function(contents,url,done){
        //TODO:use rework
        return asyncreplace(contents, regexGetUrl
            , (propDefault, propPath, pos, string, done)=>{
                url("",propPath,done)
            }
            , done)
    },(relativePath)=>"url("+quote(relativePath)+")");

    addUrlReplacer("*.js",function(contents,url,done){
        return replaceFunction("__url", contents, function (callee, args, done) {
            if(args[0].type==="string"){
                return url(callee.name,args[0].value,done)
            }
            done(null, callee(callee.defaultArguments));
        }).then(contents=>done(null, contents))
    },(relativePath)=>quote(relativePath));

    let writeStream = _ => vfs.dest(outFolder,{base:(file)=>file.base});

    let resultStream = through.obj(function(file, enc, next){
        let entry = through.obj();
        let resolve = entry.pipe(resolveUrl(outFolder,options));
        let assets = file.assets = through.obj();
        let merged = mergeStream(resolve,assets);
        let write = merged

        //if silentmode then no output
        if(!options.__silent){
            write = merged.pipe(writeStream())
        }
        entry.push(file);
        entry.push(null);
        write.on("data",file=>{
            this.push(file);
        });
        write.on("end",next)
    });

    return resultStream

    function resolveUrl(outputdir,options){
        let globs = Object.keys(urlResolvers);
        return through.obj((file, env, next)=>{
            let sourcedir = path.dirname(file.path);
            let resolver = {replacer:(contents,url,done)=>done(null,contents)}
            let filename = path.basename(file.path);

            file.base = path.join(outputdir,path.isAbsolute(file.base)?"./":file.base);
            file.path = path.join(file.base,filename);

            globs.some(glob=>minimatch(filename,glob)?(resolver=urlResolvers[glob]):false);

            let info = xtend(options
                ,{basedir:outputdir,defaultWrapper:resolver.defaultWrapper});

            resolver.replacer(file.contents.toString()
                ,(name,url,done)=>loadUrlContents(parseUrlQuery(url,sourcedir),file,info,done)
                ,(err,contents)=>{
                    file.contents = new Buffer(contents);
                    file.assets.push(null);
                    //console.log("resolved",file)
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
        let targetbase = options.assetsDest||"";
        let query = parsed.query;
        let basedir = path.join(cwd,options.basedir);
        //let assetsPipeline = options.assetsPipeline;
        let parentfilename = path.basename(parent.path);

        if(options.assetsDest){
            options.assetsBases.some(base=>
                (minimatch(sourcepath,normalizePath(path.join(cwd,base,"**/*")),{matchBase:true})
                    ?(targetbase=path.join(options.assetsDest,path.relative(path.join(cwd,base),path.dirname(sourcepath)))):false)
            );
        }else{
            targetbase = path.relative(basedir,path.dirname(sourcepath));
        }

        //create a vinyl File
        var sourceFile = new File({
            path:normalizePath(path.join(path.relative(cwd,basedir),targetbase,path.basename(sourcepath)))
            , contents: fs.existsSync(sourcepath)?fs.readFileSync(sourcepath):new Buffer("")
            //todo:readcache
        });
        sourceFile.queryOptions = query;
        sourceFile.resolveFileName = path.basename(sourcepath);
        sourceFile.resolvePath = targetbase;
        sourceFile.base = path.dirname(sourceFile.path);
        sourceFile.resolveUrl = _ => normalizePath(path.join(sourceFile.resolvePath,sourceFile.resolveFileName))
        //sourceFile.lazyRead = function(){this.contents = fs.existsSync(sourcepath)?fs.readFileSync(sourcepath):new Buffer(null)}

        let pipelineEntry = through.obj();
        pipelineEntry.push(sourceFile);
        pipelineEntry.push(null);
        easythrough(pipelineEntry)

        let pipelineSwitcher = switcher([query,parentfilename,sourcepath]);

        //pipelineSwitcher = pipelineSwitcher.case(
        //    query => query.url
        //    , pipeline => pipeline
        //).break();

        //pipelineSwitcher = assetsPipeline(pipelineSwitcher)

        /** @assetsPipeline 为图片添加hash后缀 */
        pipelineSwitcher = pipelineSwitcher.case(
            _ => !!options.assetsDest && !!options.assetsRev
            , (pipeline,query) => easythrough(pipeline.pipe(rev())).through(file=>{
                sourceFile.resolveFileName = path.basename(file.path);
                return file;
            })
        )

        /** @assetsPipeline 处理base64 */
        pipelineSwitcher = pipelineSwitcher.case(
            query => query.base64
            , (pipeline,query) => easythrough(pipeline).through(file=>{
                let mimeType = mime.lookup(sourcepath);
                let contentsBase64 = file.contents.toString("base64");
                file.resolveUrl = new Buffer(contentsBase64);
                switch (path.extname(parentfilename)){
                    case ".css":{
                        file.wrapper = _ =>"url("+quote("data:"+mimeType+";base64,"+contentsBase64)+")"
                        break;
                    }
                    case ".js":{
                        file.wrapper = _ =>quote("data:"+mimeType+";base64,"+contentsBase64)
                        break;
                    }
                }
                return file;
            })
        ).break();


        pipelineSwitcher.run(pipelineEntry,[query]).then(pipelineFinally=>{
            easythrough(pipelineFinally).through(file=>{
                //todo:finally cache;
                //console.log(file.path)
                if(!assetsFinalCache[file.path]){
                    assetsFinalCache[file.path] = true;
                    parent.assets.push(file);
                }
                let resolveUrl = file.resolveUrl;
                if(typeof resolveUrl!=="function"){resolveUrl = _ => file.resolveUrl.toString()}
                let wrapper = (typeof file.wrapper==="function")?file.wrapper:options.defaultWrapper;
                done(null,wrapper(resolveUrl()));
                return file
            })
        })


    }
}

//silentmode
exports.dest.silent = function(outFolder, opts){
    return exports.dest(outFolder, xtend(opts,{__silent:true}))
}

function easythrough(s){
    let self = easythrough;
    s.through = function(fn){
        return this.pipe(
            self(through.obj((file,env,next)=>(f=>new Promise(done=>done(f)))(file)
                .then(fn).then(file=>next(null,file))))
        )
    }
    return s;
}