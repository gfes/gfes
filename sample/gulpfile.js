/* Created by tommyZZM on 2015/12/21. */
"use strict";

var gulp = require("gulp");
var gfes = require("../index.js");

gfes.scriptTask("hello","./src/Main.js")
    .beowserify({
        transforms:[
            [gfes.metaify()]
        ]
    })
    .pipeline(gulp.dest("./dist/js"))
    .pipeline(gfes.resolve());

gfes.styleTask("hello","./style/style.scss")
    .pipeline(gulp.dest("./dist/css"))
    .pipeline(gfes.resolve());

gfes.combineTasks("hello",["css@hello","js@hello"]);

gulp.task("default",["js@hello"]);

