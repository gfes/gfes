/* Created by tommyZZM on 2016/1/29. */
"use strict"
var chai = require("chai");
chai.use(require('chai-string'));
var expect = chai.expect;

var replaceArguments = require("../lib/utils/replace-function")

describe('utils', function() {
    it("replace-function-arguments",function(done){

        var code = [
            'function log(s)   { console.error(s); }'
            , 'function print(s) { console.log(s); }'
            , 'print(\'hello\');'
            , 'log(\'world\');'
        ].join('\n');

        replaceArguments(["log","print"],code,function(callee,args,callback){
            //console.log(callee.name);
            callback(null,callee("\"hahaha\""))
        }).then(function(result){
            //console.log("\nresult....\n",result)
            expect(result).to
                .include("log(\"hahaha\")")
                .include("print(\"hahaha\")")
            done();
        })
    })
})