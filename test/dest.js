/* Created by tommyZZM on 2016/1/27. */
"use strict"
var fs = require("fs");
var path = require("path");
var globby = require("globby");
var mergeStream = require("merge-stream");
var through = require("through2");
var mime = require("mime");

var gfes = require("../index.js");

describe('gfes.dest', function() {

    it('dest', function(done) {
        this.slow(300);
        let ss = gfes.style("./test/resource/style/style.scss")
        let jss = gfes.browserify("./test/resource/js/module-dest.js").bundle("app.js")
        let s = mergeStream([ss,jss])
        s.pipe(gfes.dest("./test/resource/dist", {
                assetsDest:"./assets"
                ,assetsBases:"./test/resource/assets"
            }))
            .on("finish", done)
            .on("data", f=> {
                //console.log("\n/** final result **/\n", f.contents.toString(), "\n/** **/\n")
            })
    });

    it('dest:assetsPipeline', function(done) {
        this.slow(300);
        let jss = gfes.browserify("./test/resource/js/module-dest-base64.js").bundle("app.js")
        let s = jss
        s.pipe(gfes.dest("./test/resource/dist", {
            assetsPipeline:function(switcher,pipeline){
                switcher
                    .case((parentdir,sourcepath,query)=>query.base64
                        ,_=> pipeline = pipeline.pipe(through.obj(function(obj,env,next){
                            let type = mime.lookup(obj.sourcepath);
                            let contentsBase64 = fs.readFileSync(obj.sourcepath).toString("base64");
                            obj.contents = new Buffer(contentsBase64);
                            next(null,obj)
                        })))
                    .break()
                return pipeline
            }
        }))
        .on("finish", done)
        .on("data", f=> {
            console.log("\n/** final result **/\n", f.contents.toString(), "\n/** **/\n")
        })
    })
})