/* Created by tommyZZM on 2016/1/29. */
"use strict"

var Promise = require("bluebird");
var detective = require("detective");

function returnTypeAndValueByEval(str){
    let result = {
        type:"unknow",
        value:str
        , __argument:true
    }
    try {
        let value = eval("("+str+")");
        let type = typeof value;
        result.type = type
        result.value = value
        return result;
    }catch(e){
        return result
    }
}

function getReplacements(functionName, src) {
    let functionNameRe = new RegExp('\\b' + functionName + '\\b'); //todo:cache?
    let res = detective.find(src, { word: functionName
        , nodes: true
        , parse: {
            tolerant: true
            , range: true
            , ecmaVersion:7
            , sourceType:"module"
        }
        , isRequire: function (node) {
            return node.callee.type === 'Identifier'
                && functionNameRe.test(node.callee.name)
                ;
        }
    })

    //let calleeCache = {};

    return res.nodes.map(n=> {
        var calleeNode = n.callee;
        let calleeName = src.substring(calleeNode.range[0], calleeNode.range[1])
        let args = n.arguments;
        let argsFrom = n.callee.end+1;
        let argsTo = n.end - 1;
        let callee = eval("(function "+calleeName+"(content,renamecallee){" +
            "return (typeof renamecallee===\"string\"?renamecallee:calleeName)+\"(\"+content+\")\";" +
            "})");

        callee.defaultArguments = src.substring(argsFrom, argsTo);

        return {
            from:n.start
            , to:n.end
            , length:n.end-n.start
            , callee:callee
            //, argsFrom: argsFrom
            //, argsTo: argsTo
            //, argsLength:argsTo-argsFrom
            , args: args.map(arg=>src.substring(arg.range[0], arg.range[1])).map(arg=>{
                return returnTypeAndValueByEval(arg);
            })
        };
    });
}

module.exports = Promise.promisify(function(functionNames,origSrc,replacer,done){

    //TODO:typeof replacer==="function"

    let src = origSrc;
    let functionName = functionNames;

    if( Array.isArray(functionName) ){
        functionName = functionName.join("|")
    }
    functionName = "("+functionName+")";

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
        return replacer(replacement.callee,replacement.args.concat([])).then(result=>{
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

