/* Created by tommyZZM on 2015/12/21. */
"use strict";

var gulp = require("gulp");
var deepMerge = require("deep-extend");

var tasksMap = new Map();

class ConfigableTaskWrapper {
    constructor(name, defaultOptions) {
        this.success = false;
        this.makeStreamResult = ()=> {};
        this.defPipeFns = [];

        if (tasksMap.has(name)) {
            //TODO:log error
        } else {
            tasksMap.set(name,this);
            this.name = name;
            this.success = true;
            this.options = defaultOptions || {};
            this._taskFn = ()=>{
                let s = this.makeStreamResult();
                this.defPipeFns.forEach(fn=>s=s.pipe(fn));
                return s;
            };
            gulp.task(name, this._taskFn);
        }
    }

    config(options) {
        deepMerge(this.options, options);
        return this;
    }

    makeStream(callback) {
        if (typeof callback === "function") {
            this.makeStreamResult = ()=>callback.call(this, this.options);
            this.pipeline = (fn)=>{
                typeof fn === "function" || this.defPipeFns.push(fn);
                if(Array.isArray(fn.followPipelines)){
                    fn.followPipelines.forEach(pipefn=>this.pipeline(pipefn));
                }
                return this;
            };
        }
    }

    pipeline(fn){
    }

    get streamFn(){
        return this._taskFn
    }
}

exports.configableTaskWrapper = ConfigableTaskWrapper;

exports.tasksMap = tasksMap;