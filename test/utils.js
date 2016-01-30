/* Created by tommyZZM on 2016/1/29. */
"use strict"
var chai = require("chai");
chai.use(require('chai-string'));
var expect = chai.expect;

var replaceArguments = require("../lib/utils/replace-function-arguments")

describe('utils', function() {
    it("replace-function-arguments",function(done){

        var code = [
            'function log(s)   { console.error(s); }'
            , 'function print(s) { console.log(s); }'
            , 'print(\'hello\');'
            , 'log(\'world\');'
        ].join('\n')

        replaceArguments("log",code,function(args,defaultValue,callback){
            callback(null,"\"hahaha\"")
        }).then(function(result){
            expect(result).to.include("log(\"hahaha\")")
            done();
        })
    })
})