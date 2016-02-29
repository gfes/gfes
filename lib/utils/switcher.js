/* Created by tommyZZM on 2016/2/5. */
"use strict"

const Promise = require("bluebird")

module.exports = function switcher(){
    var caserQuery = [];
    var defaultHandeler = false

    let conditionArguments = Array.from(arguments)

    return {
        case:function(condition,then){
            caserQuery.push({condition:conditionify(condition),then:function(){
                return new Promise(done=>done()).then(_=>then.apply(null,arguments));
            }});
            return this;
        }
        ,break:function(){
            caserQuery.push("break");
            return this;
        }
        ,run:function(initalValue,thenArguments){

            if(!Array.isArray(thenArguments)){
                thenArguments = [];
            }

            //let inital = initialValue;
            let last = initalValue;
            let isMatched = false;
            if(!defaultHandeler){
                defaultHandeler = _ => initalValue
            }

            this.case(_=>true,_=>defaultHandeler())

            let promise = new Promise(done=>done(initalValue))

            caserQuery.some(caser=> {
                if (caser === "break" && isMatched)return true;
                if (caser.condition && caser.condition.apply(null, conditionArguments)) {
                    promise = promise.then(_=>caser.then.apply(null, [last].concat(thenArguments)))
                    isMatched = true;
                }
            })

            return promise;
        }
        ,default:function(fn){
            if(typeof fn === "function"){
                return defaultHandeler = fn;
            }
            return defaultHandeler = _ => fn;
        }
    }

    function conditionify(condition){
        switch (typeof condition){
            case "boolean":{
                return _=>condition
            }
            case "function":{
                return condition
            }
            default:{
                return _=>false
            }
        }
    }
}