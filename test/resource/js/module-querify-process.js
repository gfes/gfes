/* Created by tommyZZM on 2016/2/1. */
"use strict"

//import a from "extend"

var version = __process(function(require,done){
    var fs = require("fs");
    done(null,require("./package.json").version);
})