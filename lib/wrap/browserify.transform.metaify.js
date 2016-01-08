/* Created by tommyZZM on 2015/12/29. */
"use strict";

var Module = module.constructor;
var EventEmitter = require("events").EventEmitter;

var fs = require("fs");
var path = require("path");
var gutil = require("gulp-util");
var babel = require("babel-core");
var parser = require("character-parser");
var extend = require("deep-extend");
var Promise = require("bluebird");
var through = require("through2");

var cwd = process.cwd();

function metaify (filePath,options) {
    let entries = options._flags.entries;

    let transform = function (buffer, encoding, callback) {
        resolveMeta(buffer.toString(),filePath).then(content=>{
            this.push(new Buffer(content));
            callback();
        });
    };

    let flush = callback => callback();

    return through.obj(transform, flush);
}
module.exports = metaify;

var regexMeta = /__meta\$/gi;
var __relativeDirName = path.relative(process.cwd(), __filename);
__relativeDirName = __relativeDirName.split("\\").join("\\\\");

var resolveMeta = Promise.promisify(function resolveMeta(content, filepath, callback) {
    if (typeof callback !== "function") {
        return;
    }

    let result = content
        , indicesResult
        , indices = []
        , substrings;
    let dirname = path.dirname(filepath);
    let filename = path.basename(filepath);

    while ((indicesResult = regexMeta.exec(content))) {
        indices.push(indicesResult.index);
    }

    substrings = indices.map((index, i)=> {
        return content.substring(index, indices[i + 1] || content.length);
    });

    let context = new evalSectionContext();
    let subModuleCount = 0;

    let promise = new Promise(cb=>cb(result));

    substrings.forEach(substring=> {
        let section = parser.parseUntil(substring, ')', {start: substring.indexOf("(") + 1});
        let src = section.src;
        src = "module.exports = (" + src + ")";
        let fn = context.tryEvalSection(src, path.join(dirname, filename + subModuleCount + ".js").replace("\/", "/"));
        let fnResult = (typeof fn === "function")?fn():fn;

        if(typeof fnResult === "function"){
            promise = promise.then(Promise.promisify((content,callback)=>{
                Promise.promisify(fnResult)()
                    .then((result)=>
                        content.replace("__meta$(" + section.src + ")", (!!result ? ((typeof result === "string") ?
                            ("\"" + result + "\"") : result.toString()) : "undefined"))
                    )
                    .then((content)=> {
                        callback(null, content)
                    })
            }));
        }else{
            promise = promise.then((content)=>
                content.replace("__meta$(" + section.src + ")", (!!fnResult ? ((typeof fnResult === "string") ?
                    ("\"" + fnResult + "\"") : fnResult.toString()) : "undefined"))
            )
        }
    });

    promise.then((content)=> {
        callback(null, content)
    })
});

class evalSectionContext extends EventEmitter {
    constructor() {
        super();
        this.contextWrapper();
    }

    contextWrapper() {
        this.tryEvalSection = function (src, filename) {
            let result;
            let m = new Module();
            try {
                apiMap.forEach(function (api, apiName) {
                    let apiVar = "var " + apiName + "= require('" + __relativeDirName + "').apiMap.get('" + apiName + "').api" +
                        ((api.pure || typeof api.api!=="function")?"":(".bind(null,'" + filename.split("\\").join("\\\\") + "')")) +
                        ";\n";

                    src = apiVar +"\n"+ src;
                });

                m.filename = filename;
                m._compile(src, filename);
                result = m.exports;
            } catch (e) {
                result = ()=>gutil.log(gutil.colors.red("warnning!"), e, "\n" + src) || "undefined";
            }

            return result;
        }
    }
}

var apiMap = new Map();
function defApi(name, api, pure) {
    if (typeof name === "string" && typeof api !== "undefined" && !apiMap.has(name)) {
        apiMap.set(name, {api:api,pure:pure})
    }
}

metaify.defApi = defApi;
metaify.apiMap = apiMap;

defApi("require", function (filename, p) {
    if (p.indexOf(".\/") >= 0) {
        p = path.join(path.dirname(filename), p);
    }

    let content = (fs.existsSync(p))?(fs.readFileSync(p, "utf-8")):(undefined);
    if (path.extname(p) === ".json" && !!content) {
        let contentString = content;
        content = JSON.parse(content);
        content.toString = function () {
            return contentString
        };
    }
    return content;
});

defApi("locateBase", function (filename, url) {
    //todo:定位
    return {
        toString:function(){
            return "__locate$('"+url+"')"
        }
    };
});

defApi("locate",function(filename,url){
    let dirname = path.dirname(filename);
    let resultPath = "./"+path.relative(cwd,path.join(dirname,url)).replace(/\\/g,"\/")

    return apiMap.get("locateBase").api(filename,resultPath)
})

defApi("inlineBase", function (filename, url) {
    return {
        toString:function(){
            return "__inline$('"+url+"')"
        }
    };
});

defApi("inline",function(filename,url){
    let dirname = path.dirname(filename);
    let resultPath = "./"+path.relative(cwd,path.join(dirname,url)).replace(/\\/g,"\/")

    return apiMap.get("inlineBase").api(filename,resultPath)
})


defApi("Promise", require("bluebird"), true);
defApi("multimatch", require("multimatch"), true);