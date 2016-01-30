/* Created by tommyZZM on 2016/1/27. */
"use strict"
var path = require("path");
var globby = require("globby")
var mergeStream = require("merge-stream")
var gfes = require("../index.js");

describe('gfes.dest', function() {
    it('dest', function(done) {

        this.slow(300);

        let ss = gfes.style("./test/resource/style/style.scss")
        let jss = gfes.browserify("./test/resource/js/module-url.js").bundle("app.js")
            //.on("data",function(f){console.log(f.contents.toString())})

        let s = mergeStream([ss,jss])

        s.on("data", f=>{})
            .pipe(gfes.dest(null, null))
            .on("finish", done)
            .on("data", f=>{
                //console.log(f.contents.toString())
            })
    });
})