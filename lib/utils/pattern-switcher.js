/* Created by tommyZZM on 2016/2/5. */
"use strict"

module.exports = function switcher(conditionArguments,thenArguments){
    if(!Array.isArray(conditionArguments)){
        conditionArguments = [];
    }
    if(!Array.isArray(thenArguments)){
        thenArguments = [];
    }

    var caserQuery = [];
    return {
        case:function(condition,then){
            caserQuery.push({condition:conditionify(condition),then:then});
            return this;
        }
        ,break:function(){
            caserQuery.push("break");
            return this;
        }
        ,finally:function(){
            //let inital = initialValue;
            caserQuery.some(caser=>{
                if(caser==="break")return true;
                if(caser.condition.apply(null,conditionArguments)){
                    caser.then.apply(null,thenArguments);
                }
            })
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