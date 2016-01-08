/* Created by tommyZZM on 2015/12/21. */
"use strict";

var gulp = require("gulp");
var gfes = require("../index.js");

gulp.task("js",()=>
    gfes.browserify("./src/Main.js",{})
        .bundle("app.js")
        .pipe(gulp.dest("./dist"))
)

gulp.task("style",()=>
    gfes.style("./style/style.scss")
        .pipe(gulp.dest("./dist"))
)
