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
        let jss = gfes.browserify("./test/resource/js/module-dest.js").bundle("app.js")

        let s = mergeStream([jss])

        s.on("data", f=> {
            })
            .on("data", f=> {
                //console.log("\n/** final result **/\n",f.contents.toString(),"\n/** **/\n")
            })
            .pipe(gfes.dest(null, {__debug: true}))
            .on("finish", done)
            .on("data", f=> {
                //console.log("\n/** final result **/\n", f.contents.toString(), "\n/** **/\n")
            })
    });
})