/* Created by tommyZZM on 2016/2/5. */
"use strict"

module.exports = function switcher(){
    var caserQuery = [];
    var defaultHandeler = false
    return {
        case:function(condition,then){
            caserQuery.push({condition:conditionify(condition),then:then});
            return this;
        }
        ,break:function(){
            caserQuery.push("break");
            return this;
        }
        ,run:function(conditionArguments,initalValue,thenArguments){
            //let inital = initialValue;

            if(!Array.isArray(conditionArguments)){
                conditionArguments = [];
            }
            if(!Array.isArray(thenArguments)){
                thenArguments = [];
            }

            let last = initalValue;
            let isMatched = false;
            if(!defaultHandeler){
                defaultHandeler = _ => initalValue
            }
            if(!caserQuery.some(caser=>{
                if(caser==="break" && isMatched)return true;
                if(caser.condition && caser.condition.apply(null,conditionArguments)){
                    last = caser.then.apply(null,[last].concat(thenArguments));
                    isMatched = true;
                }
            })){
                last = defaultHandeler();
            }
            return last;
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