/* Created by tommyZZM on 2016/1/29. */
"use strict"
var Promise = require("bluebird");

/**
 * 创建一只内容替换机
 * @param replacersArray:[]:(file,contents,opts)=>Promise
 */
exports.contentLoadersGroup =
    function contentLoadersGroup(replacersArray) {
        if (!Array.isArray(replacersArray))replacersArray = [];

        let replacers = function (file, contents, opts) {
            let lastContents = contents;
            return new Promise(function (resolve) {
                Promise.reduce(replacersArray, function (curr, next) {
                    return curr(file, lastContents, opts).then(function (contents) {
                        return next(file, lastContents = contents, opts)
                    })
                }).then(resolve)
            })
        }
        return replacers
    }

/**
 * 创建一只内容替换机
 * @param checker
 * @param replacerfn
 */
exports.contentLoader =
    function contentLoader(checker, replacerfn) {
        return Promise.promisify(function (file, contents, opts, done) {
            if (checker(file)) {
                return replacerfn(file, contents, opts, done)
            }
            return done(null, contents)
        })
    }