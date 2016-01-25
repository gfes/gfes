/* Created by tommyZZM on 2015/12/21. */
"use strict";

/*#{*/
var packagejson = require("../../package.json?get=[version]")
/*#}*/

var extend = require("xtend")

var reactTap = require("react")

require('test')

//require("a");

require('../assets/a.png?linline&minfiy')

console.log(__filename)

var a =  require("dep");

global.abc = "abc"
