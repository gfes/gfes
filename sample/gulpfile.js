/* Created by tommyZZM on 2015/12/21. */
"use strict";

var gulp = require("gulp");
var gfes = require("../index.js");

gulp.task("js",()=>
    gfes.browserify("./src/Main.js", {
            resolve: {
                react:"global:React"
                //,dep:"./src/Dep.js"
            }
        })
        //.transform(require("browserify-shim"),{shim:{
        //    react:"global:React"
        //}})
        .bundle("app.js")
        .pipe(gulp.dest("./dist"))
)

gulp.task("style",()=>
    gfes.sass("./style/style.scss")
        .pipe(gulp.dest("./dist"))
)
