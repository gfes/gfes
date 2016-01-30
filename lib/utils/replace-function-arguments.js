/* Created by tommyZZM on 2016/1/29. */
"use strict"

var Promise = require("bluebird");
var detective = require("detective");

var regexString = /^["'](.*)["']$/gi
var regexNumber = /\d+/gi
var regexBoolean = /(true|false)/gi

function getReplacements(functionName, src) {
    let res = detective.find(src, { word: functionName
        , nodes: true
        , parse: { tolerant: true, range: true }
    });

    return res.nodes.map(n=> {
        let args = n.arguments;
        let from = n.callee.end+1;
        let to = n.end - 1;

        return {
            from: from
            , to: to
            , length:to-from
            , args: args.map(arg=>src.substring(arg.range[0], arg.range[1])).map(arg=>{
                let string = regexString.exec(arg);
                regexString.lastIndex = 0;
                if(string){
                    return {type:"string",value:string[1]}
                }else if(regexNumber.test(arg)){
                    return {type:"number",value:+arg}
                }else if(regexBoolean.test(arg)){
                    return {type:"boolean",value:arg==="true"}
                }else{
                    return {type:"variable",value:arg}
                }
            })
            , defaultValue:src.substring(from, to)
        };
    });
}

module.exports = Promise.promisify(function(functionName,origSrc,replacer,done){

    //TODO:typeof replacer==="function"

    let src = origSrc;

    let regex = new RegExp(functionName + ' *\\(.*\\)');
    if (!regex.test(src)){
        return done(null,src)
    }

    //移除hashbang避免不必要的解析错误
    let hb = src.match(/^#![^\n]*\n/);
    let hbs = hb ? hb[0] : '';

    let replacements = getReplacements(functionName, src.slice(hbs.length));

    replacer = Promise.promisify(replacer);
    let offset = 0;
    Promise.reduce(replacements,function(src,replacement){
        //console.log(replacement.args)
        return replacer(replacement.args.concat([]),replacement.defaultValue).then(result=>{
            let fromOffset = replacement.from + offset;
            let toOffset   = replacement.to + offset;
            if(typeof result!=="string"){
                result = "";
            }
            let diff = result.length - replacement.length
            offset += diff;
            return src.substring(0, fromOffset) + result + src.substring(toOffset);
        })
    },src).then(src=>done(null,src))
})

