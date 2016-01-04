"use strict";
var mergeStream = require("merge-stream");

var tasksMap = require("../_lib/configableTask").tasksMap;
var configableTaskWrapper = require("../_lib/configableTask.js").configableTaskWrapper;

var resolve = require("../_lib/pipe/resolve-content").resolve;

function combineTasks(taskName,targetTaskNames){
    if(typeof taskName!=="string" || !Array.isArray(targetTaskNames) || targetTaskNames.length<=0){
        return;
    }

    targetTaskNames = targetTaskNames.filter(taskName=>typeof taskName==="string");

    let merged;
    let task = new configableTaskWrapper("com@"+taskName);

    task.makeStream(function(options){
        merged = mergeStream();
        let targetTasks = targetTaskNames
            .map(taskName=>tasksMap.get(taskName))
            .filter(task=>!!task);

        targetTasks
            .map(task=>task.streamFn())
            .forEach(s=>{
                merged.add(s);
        });

        return merged;
    });

    return task
}

module.exports = combineTasks;
