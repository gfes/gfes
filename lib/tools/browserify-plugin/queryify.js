/** @deprecated **/
"use strict"
var fs = require("fs");

var through = require("through2")
var queryString = require('query-string');
var minimatch = require("minimatch");

module.exports = function (b, opts) {
    let querifyer = new Queryifyer(opts);

    b.redirectReadingFile(querifyer._redirectFile);
    b.while = function(glob,fn){
        querifyer._while(glob,fn)
        return this;
    }

    b.while("*.json",function(s,file,id,params){
        if(params["key"]){
            let props = params["key"].split(",");
            return s.pipe(through(function(buf, env, next){
                let jsonObj = JSON.parse(buf);
                let resultObj = {}
                props.forEach(prop=>{
                    resultObj[prop] = jsonObj[prop]
                })

                next(null,new Buffer(JSON.stringify(resultObj)))
            }))
        }
    })
}

var globDirectionary = {};

class Queryifyer {
    _redirectFile(file,id,options){
        if (fs.existsSync(file) && options._params) {

            let frs = fs.createReadStream(file)
            //console.log(file,id)

            Object.keys(globDirectionary).forEach(glob=> {
                if (minimatch(file, glob, {matchBase: true})) {
                    globDirectionary[glob].forEach(fn=> {
                        let result = fn(frs,file,id,queryString.parse(options._params))
                        if(isReadableStream(result)){
                            frs = result;
                        }
                    })
                }
            })

            return frs;
        }
    }

    _while(glob,fn){
        if(!globDirectionary[glob]){
            globDirectionary[glob] = [];
        }
        globDirectionary[glob].push(fn);
        return this;
    }
}

var isReadableStream = require("../../utils").isReadableStream
