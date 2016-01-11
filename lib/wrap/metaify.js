/* Created by tommyZZM on 2016/1/11. */
"use strict"

var path = require("path")
var parser = require("character-parser");
var decomment = require("decomment");
var through = require("through2");

function metaify (filePath,options) {
    console.log(filePath,options);

    let transform = function (buffer, encoding, callback) {

        if(path.extname(filePath)===".js"){
            metaCompile(buffer)
        }

        this.push(buffer);
        callback();
    };

    let flush = callback => callback();

    return through.obj(transform, flush);
}

module.exports = metaify;

let brackets = [
    "\/\*#\{\*\/",
    "\/\*#\}\*\/"
]

function metaCompile(buffer){
    let content = buffer.toString();

    let result = content
        , indices
        , substrings
        , codestrings = []

    indices = indicesOf(/\/\*#\{\*\//g,content)

    substrings = indices.map((index, i)=> {
        return content.substring(index, indices[i + 1] || content.length);
    });

    substrings.forEach(substring=> {
        let closeBracket = substring.indexOf(brackets[1]);
        if(closeBracket>0){
            codestrings.push(substring.substring(0,closeBracket+brackets[1].length))
        }
    })

    console.log(codestrings)
}

function indicesOf(substring,string){
    let indices=[]
    string.replace(substring, function (a, index) {
        indices.push(index)
    });
    return indices;
}