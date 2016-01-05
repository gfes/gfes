````
var gulp = require("gulp");
var gfes = require("gulp-front-end-solution");

var jst = gfes.scriptTask("./src/Main.ts")
    .evalMeta()
    .browserify({
        export:true
        , plugins: [
            {
               module:require("tsify")
               ,options:{
                    jsx:"react"
               }
            }
        ]
        , transforms: []
    })
    .defPipe(gfes.version("yymmdd@hash"))
    .defPipe(...)

jst.name = "javascript@hello"
//gulp jst@hello

````

```
var csst = gfes.styleTask("style","./style.scss")
    .defPipe(gfes.resolveRes())
csst.taskname = "css@style"
```

```
var htmlt = gfes.htmlTask("index","./index.jade")
    
htmlt.taskname = "html@index"
```

```
gfes.defineResources("assetsPNG",{"./assets/**/*.png":"./dist/assets"})
```

```
gfes.combineAsGroup("solA",[jst,csst,htmlt])
    .defPipe
    .defPipe(...)

// gulp preview@solA
// gulp preview@solA@watch
// gulp deploy@solA

```

```

gfes.relation({...});

gfes.loadplugin()

gfes.task(function(){
    return gfes.browserify(({
           transforms:[
               [gfes.metaifyJS()]
           ]
        })
        .pipe(...)
        .pipe(gfes.dest("./dist/js")) //resolve url location
})

gfes.task(function(){
    return gfes.style(...,{...})
        .pipe(gfes.dest("./dist/css"))
})

gfes.task(function(){
    return gfes.html(...)
        .pipe(gfes.dest("./dist/"))
})

gfes.combine("com",["js","css","html"],function(bundle){ //setbase
    bundle.pipe(gfes.write()) //update gfes.relation-ship.json
})

```


### API

```
scriptTask
styleTask
htmlTask

config
rely
pipe
```

### directionaryStructure

```
- project
  - node_modules/...
  - node_gfes/...
  - dist/...
  - src/...
  - tests/...
  - examples/...
  - gulpfiles.js
  - ...
```

```
- project
  - node_modules/...
  - node_gfes/...
  - bin-_release/
    - js/...
    - css/...
    - assets/...
    - html/...
    - index.html
  - bin-tests/
    - components/...
      - head/...
      - awidget/...
      - ...
    - js/...
    - assets/...
    - index.html
    - ...
  - src-app
    - components
    - script
    - style
    - index.html
  - gulpfile.js
  - ...
```

### ref
- [F.I.S 三种语言能力](https://github.com/fex-team/fis/wiki/%E4%B8%89%E7%A7%8D%E8%AF%AD%E8%A8%80%E8%83%BD%E5%8A%9B)