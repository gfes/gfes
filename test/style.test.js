/* Created by tommyZZM on 2016/1/26. */
"use strict"

var gfes = require("../index.js");

var through = require("through2")

describe('style:build', function() {
    it('build', function(done) {
        let s = gfes.style("./test/resource/style/style.scss")

        s.pipe(through.obj((f,env,next)=>{
                //console.log(f.contents.toString())
                next(null,f)
            }))
            .on("finish",done)
    });

    it('urlResolve', function(done) {
        let s = gfes.style("./test/resource/style/style.scss")
            .pipe(gfes.styleResolve())
            .on("finish",done)
    });
})