/* Created by tommyZZM on 2016/1/27. */
"use strict"
const fs = require("fs");
const path = require("path");
const globby = require("globby");
const mergeStream = require("merge-stream");
const mime = require("mime");
const gfes = require("../index.js");
const browserify = require("../lib/tools/browserify")
const style = require("../lib/tools/style")

var expect = require("chai").expect;

describe('gfes.dest', function() {

    it('dest', function(done) {
        this.slow(300);
        let ss = style("./test/resource/style/style.scss")
        let jss = browserify("./test/resource/js/module-dest.js").source("app.js")
        let s = mergeStream([ss,jss])
        s.pipe(gfes.dest("./test/resource/dist", {
                assetsDest:"./assets"
                ,assetsBases:"./test/resource/assets"
                ,assetsRev:true
            }))
            .on("finish", done)
            .on("data", f=> {
                //console.log(f.contents.toString())
            })
    });
})