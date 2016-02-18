/* Created by tommyZZM on 2016/2/18. */
"use strict"
const cwd = process.cwd();
const path = require("path");
const through = require("through2")
const browserify = require("../lib/tools/browserify")

const expect = require("chai").expect

describe('browserify', function() {
    this.slow(100);

    it('base', function (done) {
        let b = browserify("./test/resource/js/module1.js")
        b.bundle("app.js")
            .pipe(through.obj((file, env, next)=> {
                expect(path.basename(file.path)).to.equal("app.js")
                next(null, file)
            }))
            .on("finish", function () {
                done()
            })
    });

    it('base:redirect', function (done) {
        let b = browserify("./test/resource/js/module-redirect-module3.js",{
            resolve:{
                module3:"./test/resource/js/module3.js"
            }
        })
        b.bundle("app.js")
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
        b.bundle("app.js")
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
        b.bundle("app.js")
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

        b.bundle("app.js")
            .pipe(through.obj((file, env, next)=> {
                expect(file.contents.toString()).to.include("module.exports = \""+"test\\resource\\js\\assets\\a.png"+"\"")
                next(null, file)
            }))
            .on("finish", function () {
                done()
            })
    });
})