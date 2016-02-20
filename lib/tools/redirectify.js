/* Created by tommyZZM on 2016/2/17. */
"use strict"
const cwd = process.cwd();
const fs = require("fs");
const path = require("path");
const browserify = require("browserify");
const switcher = require("../utils/switcher");
const ArrayFirstMatch = require("../utils").ArrayFirstMatch

module.exports = function redirectify( b ) {
    if(!(b instanceof browserify))return;
    let redirecters = []
    let redirecterId2Content = {};

    //处理文件名和id
    let readFileOrigin = b._mdeps.readFile.bind(b._mdeps);
    let resolverOrigin = b._mdeps.resolver.bind(b._mdeps);

    b.redirect = function(fn){
        fn(condition)
        return this;

        function condition(condition){

            let redirecter = null
            let promiseCondition =  {
                redirect:function(fn){
                    redirecter = fn;
                }
            }

            redirecters.push({condition:condition,getRedirecter:_=>redirecter})

            return promiseCondition;
        }
    }

    b._originCreateDeps = b._createDeps

    b._createDeps = function(opts){
        let mdeps = this._originCreateDeps(opts)
        mdeps.resolver = function (id, parent, cb) {
            // 重定向读取文件
            // ->1 :如果有重定向器符合条件,则cb返回特定的文件名路径
            let parentDirName = cwd;
            if(/^\./.test(id)){
                parentDirName = path.dirname(parent.filename);
            }

            b._bresolve(id, parent, function (err, file, pkg) {
                let fileAbsolute = file || path.join(parentDirName,id);//获取模块的绝对路径地址
                let parentPath = path.relative(cwd,parent.filename);
                let redirecter = ArrayFirstMatch(redirecters,redirecter=>
                redirecter.condition(file,id,parentPath) && !!redirecter.getRedirecter())

                if(!!redirecter){
                    redirecterId2Content[fileAbsolute] = redirecter.getRedirecter().bind(null,fileAbsolute,id,parentPath)
                    return cb(null, fileAbsolute, {})
                }

                return resolverOrigin(id,parent,cb)
            })

            //let redirectSwitcher = switcher();
            //redirectSwitcher.default(_=>);
            //redirectSwitcher.case()
            //
            //return redirectSwitcher.run([fileAbsolute,id],null,[fileAbsolute,id,parent,cb])
        }

        mdeps.readFile =  function (file, id, pkg) {
            let tr;
            //->2 如果该id需要被重定向
            let redirecter = redirecterId2Content[file]
            if(redirecter){
                //使用重定向器
                tr = redirecter()
                tr.on('error', err => { this.emit('error', err) });
                if(fs.exists(file)){
                    this.emit('file', file, id);
                }
                return tr;
            }

            //->2 否则使用默认的browserify readFile
            tr = readFileOrigin(file,id,pkg)
            return tr
        };

        return mdeps
    }

    return b;
}