/* Created by tommyZZM on 2016/1/7. */
"use strict"
var path = require("path")

var gulp = require("gulp");
var gfes = require("../index.js");

var through = require("through2")

var chai = require('chai');
chai.use(require('chai-string'));

var should = chai.should;
var expect = chai.expect;
var assert = chai.assert

//todo:usual,
//测试包装后browserify的日常使用是否正常
describe('gfes.browserify', function() {
    it('browserify single bundle', function(done) {
        let b = gfes.browserify("./test/resource/js/module1.js")
        b.bundle("app.js")
            .pipe(through.obj((f,env,next)=>{
                expect(path.basename(f.path)).to.equal("app.js")
                next(null,f)
            }))
            .on("finish",function(){
                done()
            })
    });
});

describe('gfes.browserify:defaultOptions', function() {
    it('insertGlobals.__url', function(done) {
        let b = gfes.browserify("./test/resource/js/module-inserGlobals.js")
        b.bundle("app.js")
            .pipe(through.obj((f,env,next)=>{
                //console.log(f.contents.toString())
                expect(path.basename(f.path)).to.equal("app.js")
                next(null,f)
            }))
            .on("finish",done)
    });
})

//测试resolve参数
describe('gfes.browserify:resolvify', function() {
    //todo:resolve
    it('resolve global', function(done) {
        let b = gfes.browserify("./test/resource/js/module-require-react.js",{
            resolve:{
                react:"global:React"
            }
        })
        b.bundle("app.js")
            .pipe(through.obj((f,env,next)=>{expect('abcdef').to.be.singleLine();
                assert.include(f.contents.toString(),"module.exports = global.React")
                next(null,f)
            }))
            .on("finish",done)
    });

    //todo:resolve:redirect
    it('resolve redirect', function(done) {
        let b = gfes.browserify("./test/resource/js/module-redirect-module3.js",{
            resolve:{
                module3:"./test/resource/js/module3.js"
            }
        })
        b.bundle("app.js")
            .pipe(through.obj((f,env,next)=>{expect('abcdef').to.be.singleLine();
                assert.include(f.contents.toString(),"require('./test/resource/js/module3.js')")
                next(null,f)
            }))
            .on("finish",done)
    });
})

//todo:querify
//测试通过require传递参数

