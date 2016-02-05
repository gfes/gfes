/* Created by tommyZZM on 2016/2/2. */
"use strict"

module.exports = function(loader){
    loader("url",function(file,id,query,done){
        return done(null,"__url"+"(\""+file + "?" + id.split("?")[1]+"\");");
    },{inlineBuiltins:true});
}