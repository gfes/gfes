/* Created by tommyZZM on 2016/1/29. */
"use strict"

var replaceArguments = require("../lib/utils/replace-function-arguments")

describe('utils', function() {
    it("replace-function-arguments",function(done){

        var code = [
            'function log(s)   { console.error(s); }'
            , 'function print(s) { console.log(s); }'
            , 'print(\'hello\');'
            , 'log(\'world\');'
        ].join('\n')

        replaceArguments("log",code,function(args,callback){
            //console.log(args)
            callback(null,"\"hahaha\"")
        }).then(function(result){
            //console.log(result);
            done();
        })
    })
})