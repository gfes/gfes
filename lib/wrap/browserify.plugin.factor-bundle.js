"use strict"
var fs = require('fs');
var path = require("path");
var through = require('through2');
var Transform = require('stream').Transform;
var Readable = require('stream').Readable;
var util = require('util')

var extend = require('deep-extend');
var defined = require('defined');
var splicer = require('labeled-stream-splicer');
var pack = require('browser-pack');
var nub = require('nub');
var umd = require('umd');

module.exports = function (b, opts) {

    if(!opts.multiplyOutput){
        return;
    }

    let cwd = defined(opts.basedir, b._options.basedir, process.cwd());

    let files = [];

    let extractCommonMd5 = opts.extractCommonMd5;
    b.on('reset', addHooks);
    addHooks();

    function addHooks () {
        b.pipeline.get('record').push(through.obj(function(row, enc, next) {
            if (row.file) {
                files.push(row.file);
            }
            next(null, row);
        }, function(next) {

            let outputs = Array.isArray(opts.entryFileOutputs)?opts.entryFileOutputs:[];

            files.map(file=>{
                if(!path.isAbsolute(file)){
                    return path.resolve(cwd, file)
                }
                return file
            })

            let pipelines = files.reduce(function (pipelines, file, index) {
                let pipeline = splicer.obj([
                    'pack', [ pack({
                        raw: true,
                        hasExports: false
                    }) ],
                    'wrap', []
                ]);


                if (outputs[index]){
                    pipeline.pipe(outputs[index])
                }

                pipelines.push({file:file,pipeline:pipeline});

                return pipelines;
            }, []);

            let pipelinesMap = {};
            pipelines.forEach(function (p) {
                pipelinesMap[p.file] = p.pipeline;
                b.emit('factor.pipeline', p.file, p.pipeline);
            })

            //b._bpack.hasExports = true; //将会export 一个全局 require 方法,会造成全局污染。

            let s = createStream(files, extend(opts
                ,{
                    extractCommonMd5:extractCommonMd5
                    ,browserify:b
                    ,cwd:cwd
                    ,objectMode:true
                    ,raw:true
                    ,rmap:{}
                }));
            s.on('stream', function (bundle) {
                bundle.pipe(pipelinesMap[bundle.file]);
            });

            //console.log(b._bpack.standaloneModule)
            //b._bpack.standaloneModule = md5hexId;

            b.pipeline.get('pack').unshift(s);

            files = [];

            next();
        }));


        b.pipeline.get('label').push(through.obj(
            function(row, enc, next) {
                opts.rmap[row.id] = path.resolve(cwd, row.file);
                next(null, row);
            }
            , function(next) {
                //force standaloneModule to commonModule
                b._bpack.standaloneModule = extractCommonMd5;
                next()
            }
        ));
    }
};

var JSONStream = require('JSONStream');
var combine = require('stream-combiner');
var depsTopoSort = require('deps-topo-sort');
var reverse = require('reversepoint');

function createStream (files, opts) {

    var fr = new Factor(files, opts);
    var dup;

    dup = combine(depsTopoSort(), reverse(), fr);

    fr.on('error', function (err) { dup.emit('error', err) });
    fr.on('stream', function (s) {
        dup.emit('stream', s)
    });
    return dup;
}


class Factor extends Transform{
    constructor(files, opts){
        super({ objectMode: true })

        this.basedir = defined(opts.basedir, process.cwd());
        this._streams = {};
        this._groups = {};

        this._ensureCommon = {};
        this._files = files.reduce((acc, file)=>{
            acc[path.resolve(this.basedir, file)] = true;
            return acc;
        }, {});

        this._rmap = opts.rmap;

        this._thresholdVal = typeof opts.threshold === "number"
            ? opts.threshold : 1
        ;
        this._defaultThreshold = function(row, group) {
            return group.length > this._thresholdVal || group.length === 0;
        };
        this._threshold = typeof opts.threshold === "function"
            ? opts.threshold
            : this._defaultThreshold
        ;

        this._opts = opts;
        this._cwd = opts.cwd;
        this._extractCommonMd5 = opts.extractCommonMd5;
        this._bundleDeps = {};
        this._extractCommon = opts.multiplyOutput.extractCommon
    }

    _transform (row, enc, next) {
        let groups = nub(this._groups[row.id] || []);
        let id = this._resolveMap(row.id);

        if (this._files[id]) {
            let s = this._streams[id];
            if (!s) s = this._makeStream(row);
            groups.push(id);
        }
        groups.forEach((gid)=>{
            Object.keys(row.deps || {}).forEach((key)=>{
                var file = row.deps[key];
                var g = this._groups[file];
                if (!g) g = this._groups[file] = [];
                g.push(gid);
            });
        });

        // ensure common code brock here

        if (this._extractCommon && (this._ensureCommon[row.id] || this._threshold(row, groups))) {

            Object.keys(row.deps).forEach(function(k) {
                this._ensureCommon[row.deps[k]] = true;
            });
            this.push(row);
            this._bundleDeps[path.relative(this._cwd,row.file).replace("\\","/")] = row.id;

            let commonRow = extend({},row)
            commonRow.source =
                "var row = (typeof global."+this._extractCommonMd5+"!== 'undefined')?" +
                "(global."+this._extractCommonMd5+"["+row.id+"]):undefined;\n" +
                "module.exports = row;\n";

            groups.forEach((id)=>{
                this._streams[id].push(commonRow);
            });

            //TODO:hash name a new var
        }
        else {
            groups.forEach((id)=>{
                this._streams[id].push(row);
            });
        }

        next();
    }

    _flush () {
        if (this._extractCommon){
            let bundleRowSource = "var common = {};\nmodule.exports = common;\n";

            Object.keys(this._bundleDeps).forEach(key=>{
                bundleRowSource+="common["+this._bundleDeps[key]+"] = "+"require(\""+key+"\");\n"
            })

            let bundleRow = {
                id:this._extractCommonMd5
                , source:bundleRowSource
                , deps:this._bundleDeps
                , file:path.join(this._cwd,this._extractCommonMd5+".js")
                , index: 2
                , indexDeps: this._bundleDeps
            }

            this.push(bundleRow);
        }


        Object.keys(this._streams).forEach(key=>this._streams[key].push(null));
        this.push(null);
    }

    _makeStream (row) {
        var s = new Readable({ objectMode: true });
        var id = this._resolveMap(row.id);
        s.file = id;
        s._read = function () {};
        this._streams[id] = s;
        this.emit('stream', s);
        return s;
    }

    _resolveMap (id) {
        return this._rmap[id] || id;
    }
}