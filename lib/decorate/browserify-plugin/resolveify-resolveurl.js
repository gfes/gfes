"use strict";
var path = require("path");
var through = require("through2")
var cwd = process.cwd();

var standlizeUrl = require("../../utils").standlizeUrl

module.exports = function(file, opts){
    return through(function(buf, env, next){
        if(path.extname(file)===".js"){
            let contents = standlizeUrl(cwd,file,"__url")(buf.toString());
            return next(null,new Buffer(contents));
        }
        return next(null,buf);
    })
}