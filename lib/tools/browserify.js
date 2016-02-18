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
    let transform = tr => finalTransforms.push(tr)

    redirectify(b,transform);
    processorify(b,transform);

    b.redirect(resolveRedirect)

    b.originBundle = b.bundle;
    b.bundle = function(output){
        let result = through.obj();

        finalTransforms.forEach(tr=>b.transform(tr));

        b.add(entryFiles);
        let bundle = this.originBundle()
            .on('error', function (error) {
                gutil.log(gutil.colors.red(error.toString()));
                bundle.emit("error",error.toString())
            })
            .pipe(source(output))
            .pipe(buffer())
            .pipe(through.obj((file,enc,next)=>{
                file.type = "javascript"
                next(null,file)
            }))
            .pipe(result);

        return result;
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
                    tr.push("\nmodule.exports = global." + execGlobal[1]+";")
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

