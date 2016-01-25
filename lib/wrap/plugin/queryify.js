/* Created by tommyZZM on 2016/1/21. */
"use strict"
var fs = require("fs");
var through = require("through2")
var queryString = require('query-string');

var regexWithQueryString = /.+(\?.*)/
module.exports = function (b, opts) {
    var readFileOrigin = b._mdeps.readFile.bind(b._mdeps);
    b._mdeps.readFile =  function (file, id, pkg) {

        let tr;
        if (!fs.existsSync(file)) {
            let withQueryString = regexWithQueryString.exec(id);
            if(withQueryString){
                console.log(queryString.parse(withQueryString[1]));
                tr = through();
                tr.push("");
                tr.push(null);
                return tr
            }

        }

        return readFileOrigin(file,id,pkg)
    }
}