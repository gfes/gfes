"use strict"
var fs = require('fs');
var path = require("path");
var through = require('through2');
var defined = require('defined');

module.exports = function (b, opts) {

    let cwd = defined(opts.basedir, b._options.basedir, process.cwd())

    let files = [];

    console.log(files);

    b.on('reset', addHooks);
    addHooks();

    function addHooks () {
        b.pipeline.get('record').push(through.obj(function(row, enc, next) {
            //console.log(row.file)
            if (row.file) {
                files.push(row.file);
            }
            next(null, row);
        }, function(next) {

            let outputs = Array.isArray(opts.outputs)?opts.outputs:[];

            outputs = outopt.map(function (o) {
                if (isStream(o)) return o;
                return fs.createWriteStream(o);
            });

            next();
        }));

        b.pipeline.get('label').push(through.obj(function(row, enc, next) {
            console.log(path.resolve(cwd, row.file))
            next(null, row);
        }));
    }
};