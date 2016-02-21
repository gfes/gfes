/* Created by tommyZZM on 2016/2/18. */
"use strict"

const cwd = process.cwd();
const path = require("path");
const browserify = require("browserify");
const builtins = require("browserify/lib/builtins");
const gutil = require("gulp-util");
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const through = require("through2");
const extend = require('deep-extend');

const redirectify = require("./redirectify")
const processorify = require("./processify")
const utils = require("../utils")

module.exports = function(entryFiles,opts){

    let options = extend({
        insertGlobalVars:{
            __noop:_ => "require(\"__noop\")"
        }
        , builtins:extend(builtins,{
            __noop: require.resolve('../res/__noop.js')
        })
        , resolve:{}
    },opts,{entryFiles:[]});

    if(typeof options.standalone!=="string"){
        options.standalone = false;
    }

    let b = browserify()
    let finalTransforms = []
    let finalTransform = tr => finalTransforms.push(tr)

    redirectify(b);
    processorify(b,finalTransform);
    b.redirect(resolveRedirect);
    b._bundled = true;b.reset();b._bundled = false;

    let initalSource = false
    b.source = function(output){
        let result = through.obj()

        if(!initalSource){
            initalSource = true;
            finalTransforms.forEach(tr=>b.transform(tr));
            this.add(entryFiles);
        }

        let bundled = this.bundle()
        bundled.on('error', err=>{
            gutil.log('Browserify Error',err.toString())
        })

        return bundled
            .pipe(source(output))
            .pipe(buffer())
            .pipe(result)
    }

    return b;

    function resolveRedirect(condition){
        let regexIfGlobalResolve = /^global\.((\w|\$)+)/;

        condition((file,id)=>typeof options.resolve[id]==="string")
            .redirect((file,id,parent)=>{
                let tr = through()
                let resolveID = options.resolve[id];
                let execGlobal = regexIfGlobalResolve.exec(resolveID)
                if(execGlobal){
                    tr.push("module.exports = global." + execGlobal[1]+";")
                    tr.push(null);
                    return tr;
                }

                //if(resolveID[0]==="."){
                //    resolveID = utils.normalizePath(path.relative(path.join(cwd,path.dirname(parent)),path.join(cwd,resolveID)));
                //}

                tr.push("module.exports = require(\"" + resolveID +"\");")
                tr.push(null);
                return tr;
            })
    }
}

