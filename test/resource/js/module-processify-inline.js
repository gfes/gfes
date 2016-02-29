/* Created by tommyZZM on 2016/2/1. */
"use strict";

var module1 = require("./module1-change.js")

var version = __process(function(require,done){
    var fs = require("fs");
    var gulp =require("browserify")
    done(null,require("./package.json").version);
})

import * as actions from './actions'