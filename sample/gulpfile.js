/* Created by tommyZZM on 2015/12/21. */
"use strict";

var gulp = require("gulp");
var gfes = require("../index.js");

gulp.task("default",function(){
    return gfes.browserify(["./src1/Main.js","./src2/Main.js"],{
        output:["app.js","app2.js"]
    }).pipe(gulp.dest("./dist"))
})

