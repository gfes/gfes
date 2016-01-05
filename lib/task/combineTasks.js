"use strict";
var mergeStream = require("merge-stream");

var tasksMap = require("../utils/configableTask").tasksMap;
var configableTaskWrapper = require("../utils/configableTask.js").configableTaskWrapper;

var resolve = require("../utils/pipe/resolve-content").resolve;

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
            .map(task=>task.stream)
            .forEach(s=>{
                merged.add(s);
        });

        return merged;
    });

    return task
}

module.exports = combineTasks;
