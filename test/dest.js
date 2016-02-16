/* Created by tommyZZM on 2016/1/27. */
"use strict"
var fs = require("fs");
var path = require("path");
var globby = require("globby");
var mergeStream = require("merge-stream");
var mime = require("mime");
var gfes = require("../index.js");

var expect = require("chai").expect;

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
        let jss = gfes.browserify("./test/resource/js/module-dest-assetspipeline.js").bundle("app.js")
        let s = jss
        s.pipe(gfes.dest("./test/resource/dist", {
                assetsPipeline: switcher=>switcher
                    .case(query=>query.test
                        , pipeline => pipeline.through(file=> {
                            expect(file.resolvePath).to.be.a('string');
                            return file
                        }))
                    .break()
            }
        ))
        .on("finish", done)
        .on("data", f=> {
            //console.log("\n/** final result **/\n", f.contents.toString(), "\n/** **/\n")
        })
    })

    it('dest:assetsHash', function(done) {
        this.slow(300);
        let ss = gfes.style("./test/resource/style/style.scss")
        let jss = gfes.browserify("./test/resource/js/module-dest.js").bundle("app.js")
        let s = mergeStream([ss,jss])
        s.pipe(gfes.dest("./test/resource/dist", {
                assetsDest:"./assets"
                ,assetsRev:true
            }
            ))
            .on("finish", done)
            .on("data", f=> {
                //console.log("\n/** final result **/\n", f.contents.toString(), "\n/** **/\n")
            })
    })
})