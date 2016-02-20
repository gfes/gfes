/* Created by tommyZZM on 2016/2/18. */
"use strict"
const cwd = process.cwd();
const path = require("path");
const through = require("through2")
const browserify = require("../lib/tools/browserify")
const watchify = require("watchify");
const fs = require("fs")

const expect = require("chai").expect

describe('browserify', function() {
    this.slow(160);

    it('base', function (done) {
        let b = browserify("./test/resource/js/module1.js")
        b.source("app.js")
            .pipe(through.obj((file, env, next)=> {
                expect(path.basename(file.path)).to.equal("app.js")
                next(null, file)
            }))
            .on("finish", function () {
                done()
            })
    });

    it('watchify', function (done) {
        let targetfile = "./test/resource/js/module1-change.js"
        let b = watchify(browserify(targetfile))
        let updateDate = new Date();
        b.on("update",function(){
            this.source("app.js")
                .on("data",file=>expect(file.contents.toString()).to.include(updateDate))
                .on("finish", done)
        })
        b.source("app.js")
            .on("finish", function () {
                let contents = fs.readFileSync(targetfile).toString();
                contents = contents.replace(/(time:)\((.+)\)/gi, function (matched, title) {
                    return title + "(" + updateDate + ")"
                })
                fs.writeFileSync(targetfile, new Buffer(contents))
            })
    });

    it('base:redirect', function (done) {
        let b = browserify("./test/resource/js/module-redirect-module3.js",{
            resolve:{
                module3:"./test/resource/js/module3.js"
            }
        })
        b.source("app.js")
            .pipe(through.obj((file, env, next)=> {
                expect(file.contents.toString()).to.include("exports.name = \"module3\"")
                next(null, file)
            }))
            .on("finish", function () {
                done()
            })
    });

    it('processify:inline', function (done) {
        let b = browserify("./test/resource/js/module-processify-inline.js")
        b.source("app.js")
            .pipe(through.obj((file, env, next)=> {
                expect(file.contents.toString()).to.include("module.exports = \"0.0.1\"")
                next(null, file)
            }))
            .on("finish", function () {
                done()
            })
    });

    it('processify:require', function (done) {
        let b = browserify("./test/resource/js/module-processify-require.js")
        b.source("app.js")
            .pipe(through.obj((file, env, next)=> {
                expect(file.contents.toString()).to.include("module.exports = \""+cwd+"\"")
                next(null, file)
            }))
            .on("finish", function () {
                done()
            })
    });

    it('processify:custom', function (done) {
        let b = browserify("./test/resource/js/module-processify-custom.js")

        b.processor(function(add){
            add("resource").handle(function(file,resPath){
                return path.relative(cwd,path.join(file,resPath))
            })
        })

        b.source("app.js")
            .pipe(through.obj((file, env, next)=> {
                expect(file.contents.toString()).to.include("module.exports = \""+"test\\resource\\js\\assets\\a.png"+"\"")
                next(null, file)
            }))
            .on("finish", function () {
                done()
            })
    });
})