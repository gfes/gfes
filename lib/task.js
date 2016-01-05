/* Created by tommyZZM on 2016/1/4. */
"use strict";

var gulp = require("gulp");
var tasks = new Map();

module.exports = function(name,fn){
    if(typeof name === "string" && tasks.has(name)){
        return;
    }

    if(typeof name==="function"){
        fn = name;
    }

    if(typeof fn === "function"){
        let result = {};
        let gfn = ()=>{
            let result = fn();
            if(fn.gfesDest){
                result = result.pipe(gulp.dest(fn.gfesDest))
            }
            return result;
        };

        result = {fn:fn,gfn:gfn};

        if(name){
            tasks.set(name,result);
        }

        return result;
    }else{
        //TODO:warning
    }
};
