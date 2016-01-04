exports.scriptTask = require("./lib/_task/scriptTask.js");
exports.styleTask = require("./lib/_task/styleTask.js");
exports.combineTasks = require("./lib/_task/combineTasks.js");

exports.resolve = require("./lib/_api/resolve");
exports.metaify = require("./lib/_lib/pipe/resolve-js-meta").metaify;