/* Created by tommyZZM on 2016/1/27. */
"use strict"
var path = require("path");
var vfs = require("vinyl-fs")
var through = require("through2");
var mergeStream = require("merge-stream")
var cwd = process.cwd();
var gfes = require("../index.js");

describe('gfes.dest', function() {
    it('build', function(done) {
        let ss = gfes.style("./test/resource/style/style.scss")
        let jss = gfes.browserify("./test/resource/js/module-inserGlobals.js").bundle("app.js")

        let s = mergeStream([ss])

        s.pipe(gfes.dest(null,null,function(sth,opts){
            //console.log("test",sth,opts);
        })).pipe(gfes.dest(null,null,function(filePath,opts){
                return through(function(buf,env,next){
                    vfs.src(filePath).on("data",function(buf){
                        console.log(buf)
                    }).on("finish",function(){
                        next(null,buf)
                    })
                })
            }))
            .on("finish",done)
    });
})