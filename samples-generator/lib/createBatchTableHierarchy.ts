// @ts-ignore
import { Promise } from 'bluebird';
import { calculateFilenameExt } from './calculateFilenameExt';
import { createFeatureHierarchySubExtension } from './createFeatureHierarchySubExtension';
import { Gltf, GltfType, GLenumName } from './gltfType';
import { FeatureHierarchyClass } from './featureHierarchyClass';
import { Material } from './Material';
import { Mesh } from './Mesh';
import {
    clone as CesiumClone,
    Cartesian3,
    defaultValue,
    defined,
    Math as CesiumMath,
    Matrix4,
    Matrix3,
    Quaternion,
} from 'cesium';
var Cesium = require('cesium');

const gltfPipeline = require('gltf-pipeline');
var gltfToGlb = gltfPipeline.gltfToGlb;
const glbToGltf = gltfPipeline.glbToGltf;
var fsExtra = require('fs-extra');
var path = require('path');
var gltfConversionOptions = { resourceDirectory: path.join(__dirname, '../') };
import createGltf = require('./createGltf');
import { createTilesetJsonSingle } from './createTilesetJsonSingle';
import { createFeatureMetadataExtension } from './createFeatureMetadataExtension';
import { Extensions } from './Extensions';
import { getGltfFromGlbUri } from "./gltfFromUri";

var typeConversion = require('./typeConversion');
var getMinMax = require('./getMinMax');

var createB3dm = require('./createB3dm');
var createGlb = require('./createGlb');
var getBufferPadded = require('./getBufferPadded');
var saveBinary = require('./saveBinary');
var saveJson = require('./saveJson');
// add own dependency
import { readXml,ElementInfo} from "./readXml";
var readGltfNames = require('./readGltfNames');
var math_ds = require('math-ds');
var PointOctree = require('sparse-octree');
import {JSONPath} from 'jsonpath-plus';
import {generateInstancesBatchTable} from "./createInstancesTile";
import {FLOAT32_SIZE_BYTES, UINT16_SIZE_BYTES, UINT32_SIZE_BYTES, UINT8_SIZE_BYTES} from "./typeSize";
const createI3dm = require('./createI3dm');
import { ReOrganizeModel } from './ReOrganizeModel';
import CreateI3DMTile from "./createI3DMTile";

var sizeOfFloat = 4;
var sizeOfUint16 = 2;

var whiteOpaqueMaterial = new Material([1.0, 1.0, 1.0, 1.0]);

/**
 * Create a tileset that uses a batch table hierarchy,
 * by default using the 3DTILES_batch_table_hierarchy extension.
 *
 * @param {Object} options An object with the following properties:
 * @param {String} options.directory Directory in which to save the tileset.
 * @param {Boolean} [options.batchTableBinary=false] Create a batch table binary for the b3dm tile.
 * @param {Boolean} [options.noParents=false] Don't set any instance parents.
 * @param {Boolean} [options.multipleParents=false] Set multiple parents to some instances.
 * @param {Boolean} [options.legacy=false] Generate the batch table hierarchy as part of the base Batch Table, now deprecated.
 * @param {Matrix4} [options.transform=Matrix4.IDENTITY] The tile transform.
 * @param {Boolean} [options.gzip=false] Gzip the saved tile.
 * @param {Boolean} [options.prettyJson=true] Whether to prettify the JSON.
 * @param {Boolean} [options.use3dTilesNext=false] Whether to use 3dTilesNext (gltf)
 * @param {Boolean} [options.useGlb=false] Whether to use glb with 3dTilesNexxt
 * @returns {Promise} A promise that resolves when the tileset is saved.
 */
let buildStoreyMap;
let xmlJson;
export function createBatchTableHierarchy(options) {
    const use3dTilesNext = defaultValue(options.use3dTilesNext, false);
    const useGlb = defaultValue(options.useGlb, false);
    const gzip = defaultValue(options.gzip, false);
    const useBatchTableBinary = defaultValue(options.batchTableBinary, false);
    const noParents = defaultValue(options.noParents, false);
    const multipleParents = defaultValue(options.multipleParents, false);
    const transform = defaultValue(options.transform, Matrix4.IDENTITY);

    const compressDracoMeshes = defaultValue(options.compressDracoMeshes, false);

    const directoryPath = path.join(options.input,'/');
    const outputPath = defaultValue(options.output,path.join(directoryPath,'output'))
    options.gltfDirectory = directoryPath;
    options.outputPath = outputPath;

    const gltfUrl = "../data/bim/gltfdecompose/chuang01.gltf";
    const resultBasePath = "D:/Code/CesiumTools/3d-tiles-validator/samples-generator/data/bim/gltfdecompose/output/";
    return fsExtra.readJson(gltfUrl)
        .then(function (gltf) {
            const meshes = Mesh.decomposeGltf(gltf);
            const promiseArray = [];
            for (let i = 0; i < meshes.length; i++) {
                const promise = createGltf({
                    mesh : meshes[i],
                    compressDracoMeshes : false,
                    resourcePath: "data/bim/gltfdecompose/",
                    useBatchIds : false
                });
                promiseArray.push(promise);
            }
            return Promise.all(promiseArray).then(function (results) {
                for (let i = 0; i < results.length; i++) {
                    const outputname = path.join(resultBasePath, i + ".gltf");
                    saveJson(outputname, results[i], true);
                }
                console.log("done");
            }).catch(error => {
                console.error(error);
            })
            /*return createGltf({
                mesh : meshes[3],
                compressDracoMeshes : false,
                resourcePath: "data/bim/gltfdecompose/",
                useBatchIds : false
            }).then((data) => {
                debugger
                // console.log(data);
                const outputname = path.join(resultBasePath, "4.gltf");
                return saveJson(outputname, data, true);
            }).catch(error =>{
                console.error(error);
            });*/
        }).catch(function (reason) {
            console.error(reason);
        });
    return ;
    readXml({directoryPath:directoryPath}).then((value:any) =>  {
        // const xmlJson = value.xmlJson;
        xmlJson = value.xmlJson;
        buildStoreyMap = createStoreyMap(xmlJson);
        options.xmlJson = xmlJson;
        const xmlMap:Map<String,ElementInfo> = value.elementInfoMap;
        // console.log(xmlMap);
        options.xmlMap = xmlMap;
        var rootbounds;
        for (let k of xmlMap.keys()) {  //es6中的用法，tsconfig.json中配置"target": "es6" 非"es5"
            if(k.indexOf('IfcProject') >= 0){
                rootbounds = xmlMap.get(k);
                break;
            }
        }
        /*var buildingbounds;
        for (let k of xmlMap.keys()) {
            if(k.indexOf('IfcBuilding') >= 0){
                buildingbounds = xmlMap.get(k);
                break;
            }
        }*/

        readGltfNames({directoryPath:directoryPath}).then(async function (gltfMap) {
            //es6 模式下使用
            /*for(var [key, value] of gltfMap){
                gltfMap.set(key,xmlMap.get(key));
            }*/
            gltfMap.forEach(function(value,key){
                xmlMap.forEach(function (value1,key1) {
                    const gltfMapkey = key.substring(0,key.length - 4);
                    const xmlMapkey = key1.substring(0,key1.length -4);
                    if(gltfMapkey.includes(xmlMapkey)){
                        gltfMap.set(key,xmlMap.get(key1));
                    }
                })
            });
            //console.log(gltfMap);
            const tilesetJsonPath = path.join(outputPath, 'tileset.json');

            //3dTiles中是OBB,而非AABB，可以将向量进行旋转实现*/
            var box = [
                rootbounds.center.x , rootbounds.center.y , rootbounds.center.z,
                rootbounds.dimensions.x / 2, 0 , 0,
                0 , rootbounds.dimensions.y / 2,0,
                0 , 0 , rootbounds.dimensions.z / 2
            ];
            var geometricError = computeSSE(rootbounds);

            let opts:any = {
                // contentUri : contentUri,
                geometricError : geometricError,
                box : box,
                transform : transform
            };
            var tilesetJson = createTilesetJsonSingle(opts);
            delete tilesetJson.root['content'];
            if (!options.legacy) {
                Extensions.addExtensionsUsed(tilesetJson, '3DTILES_batch_table_hierarchy');
                Extensions.addExtensionsRequired(tilesetJson, '3DTILES_batch_table_hierarchy');
            }

            // return createI3dmTile(options);

            if(gltfMap.size < 40){   //小于40个模型合并为单个b3dm
                const gltfNameArr = [];
                gltfMap.forEach((value,key) =>{
                    gltfNameArr.push(key);
                })

                options.nameArray = gltfNameArr;
                options.b3dmName = 'tile.b3dm';
                try {
                    tilesetJson.root['content'] = {uri: options.b3dmName};
                    return createB3dmTile(options).then(value => {
                        const tilePath = path.join(options.outputPath , value.name);
                        console.log("done");
                        return Promise.all([
                            saveJson(tilesetJsonPath, tilesetJson, options.prettyJson),
                            saveBinary(tilePath, value.b3dm, options.gzip)
                        ]);
                    });
                }catch (e) {
                    console.error(e);
                }
            }

            try {
                /*var box1 = new math_ds.Box3(
                    new math_ds.Vector3( rootbounds.center.z - rootbounds.dimensions.z / 2,
                        rootbounds.center.x - rootbounds.dimensions.x / 2, rootbounds.center.y - rootbounds.dimensions.y / 2),
                    new math_ds.Vector3( rootbounds.center.z + rootbounds.dimensions.z / 2,
                        rootbounds.center.x + rootbounds.dimensions.x / 2, rootbounds.center.y + rootbounds.dimensions.y / 2),
                );
                console.log(box1);*/
                //获取模型包围盒中心点的范围
                const centerPoints = [];
                const xArr = [];
                const yArr = [];
                const zArr = [];
                gltfMap.forEach(function(value,key){
                    xArr.push(value.center.z);
                    yArr.push(value.center.x);
                    zArr.push(value.center.y);
                    centerPoints.push(new math_ds.Vector3(value.center.z,value.center.x,value.center.y));
                });
                const rootbox = new math_ds.Box3(
                    new math_ds.Vector3(Math.min.apply(null,xArr),Math.min.apply(null,yArr),Math.min.apply(null,zArr)),
                    new math_ds.Vector3(Math.max.apply(null,xArr),Math.max.apply(null,yArr),Math.max.apply(null,zArr))
                );

                /*var rootbox = new math_ds.Box3(
                    new math_ds.Vector3(rootbounds.minXYZ[2],rootbounds.minXYZ[0],rootbounds.minXYZ[1]),
                    new math_ds.Vector3(rootbounds.maxXYZ[2],rootbounds.maxXYZ[0],rootbounds.maxXYZ[1])
                );*/
                //console.log(box);
                /**
                 * Constructs a new point octree.  constructor(min, max, bias = 0.0, maxPoints = 8, maxDepth = 8)
                 *
                 * @param {Vector3} [min] - The lower bounds of the tree.
                 * @param {Vector3} [max] - The upper bounds of the tree.
                 * @param {Number} [bias=0.0] - An octant boundary bias.
                 * @param {Number} [maxPoints=8] - Number of distinct points per octant before it splits up.
                 * @param {Number} [maxDepth=8] - The maximum tree depth level, starting at 0.
                 */
                const maxPoints = Math.round(gltfMap.size / 8);

                const octree = new PointOctree.PointOctree(rootbox.min, rootbox.max, 0.0, maxPoints);  //200 50 20
                gltfMap.forEach(function(value,key){
                    //octree 源码中put方法中取消点是否存在的判断，否则部分点不会添加到八叉树空间中，具体代码为，需注释掉 exists = octant.points[i].equals(point);重build
                    octree.put(new math_ds.Vector3(value.center.z, value.center.x, value.center.y), {name:key,value:value});
                });
                /*for(var [key, value] of restB3dm){
                    octree.put(new math_ds.Vector3(value.center.z, value.center.x, value.center.y), {name:key,value:value});
                }*/

                if(octree.pointCount !== gltfMap.size){
                    console.error("模型缺失！");
                }
                if(octree.getDepth() > 0){
                    octree.root.tile = null;
                }
                const iterator = octree.leaves();

                let i = 0;
                // var children = [];
                while(!iterator.next().done) {
                    // console.log(iterator.indices);
                    var indicesArr = iterator.indices;
                    let currentOctant = iterator.result.value;
                    // currentOctant.tile = null;
                    if(currentOctant.children === null){
                        if(currentOctant.data !== null){
                            // children.push(computeTile(currentOctant.data));
                            currentOctant.tile = computeTile(currentOctant.data,indicesArr);
                            currentOctant.tile.geometricError = 0;
                        }
                    }else {
                        //octree.leaves()返回子节点迭代器，因而不会执行到非子节点来,此else不会执行
                        if(currentOctant.data !== null){
                            currentOctant.tile.children.push(computeTile(currentOctant.data,indicesArr));
                            currentOctant.tile = computeTile(currentOctant.data,indicesArr);
                        }else {
                            //有子节点的卦限point一定为null
                            // currentOctant.tile = computeTile(currentOctant.data,indicesArr);
                        }
                    }
                    ++i;
                }
                /*console.log(i);
                console.log(JSON.stringify(octree));*/
                try {
                    var depth = octree.getDepth();
                    for (let j = 1; j < depth; j++) {
                        var octants = octree.findOctantsByLevel(j);
                        for (let k = 0; k < octants.length; k++) {
                            let currentOctant = octants[k];
                            var minAndmaxobj = modifyOctantWithChildren_MinMax(currentOctant,undefined);
                            if(currentOctant.children !== null){   //包含子节点的修改
                                currentOctant.min.x = Math.min.apply(null, minAndmaxobj.minX);
                                currentOctant.min.y = Math.min.apply(null, minAndmaxobj.minY);
                                currentOctant.min.z = Math.min.apply(null, minAndmaxobj.minZ);
                                currentOctant.max.x = Math.max.apply(null, minAndmaxobj.maxX);
                                currentOctant.max.y = Math.max.apply(null, minAndmaxobj.maxY);
                                currentOctant.max.z = Math.max.apply(null, minAndmaxobj.maxZ);
                            }
                        }
                    }
                    // console.log(JSON.stringify(octree.root.children));

                    var testss = getRootJSONFromOctree(octree.root);
                    deleteNull(testss);

                    // console.log(JSON.stringify(testss));
                    const children = JSON.parse(JSON.stringify(testss.children));
                    tilesetJson.root.children = children;
                    // console.log(JSON.stringify(tilesetJson));
                }catch (e) {
                    console.error(e);
                }

            }catch (e) {
                console.error(e);
            }

            // return createB3dmTile11(options);
            try {
                var promiseArr = createB3DMTask(options,tilesetJson.root.children,undefined);
                saveJson(tilesetJsonPath, tilesetJson, options.prettyJson);
                return Promise.all(promiseArr).then(function (results) {
                    var b3dmNameArr = getChildrenName(tilesetJson.root.children,undefined);
                    for (let i = 0; i < results.length; i++) {
                        var tilePath = path.join(outputPath , results[i]["name"]);
                        saveBinary(tilePath, results[i]["b3dm"], options.gzip)
                    }
                    console.log("done");
                }).catch(error => {
                    console.error(error);
                })
            }catch (e) {
                console.error(e)
            }

        })

    });

}

function modifyOctantWithChildren_MinMax(octant,temObj) {
    temObj = !temObj ? {minX:[],minY:[],minZ:[],maxX:[],maxY:[],maxZ:[]} : temObj;
    if(octant.children !== null){
        for (let i = 0; i < octant.children.length; i++){
            var child = octant.children[i];
            if(child.children === null){
                if(!!child.tile){
                    temObj.minX.push(child.tile.minXYZ[0]);
                    temObj.minY.push(child.tile.minXYZ[1]);
                    temObj.minZ.push(child.tile.minXYZ[2]);
                    temObj.maxX.push(child.tile.maxXYZ[0]);
                    temObj.maxY.push(child.tile.maxXYZ[1]);
                    temObj.maxZ.push(child.tile.maxXYZ[2]);
                }else{

                }
            }else {
                modifyOctantWithChildren_MinMax(child,temObj);
            }
        }
    }else{
        // debugger
    }
    return temObj;
}

function modifyOctantMinAndMax(tilesetRootChild,minXYZ,maxXYZ) {
    // minXYZ = !minXYZ ? new Array(tilesetRootChild.min.x,tilesetRootChild.min.y,tilesetRootChild.min.z) : minXYZ;
    // maxXYZ = !maxXYZ ? new Array(tilesetRootChild.max.x,tilesetRootChild.max.y,tilesetRootChild.max.z) : maxXYZ;
    if(tilesetRootChild.children !== null){
        for (let i = 0; i < tilesetRootChild.children.length; i++) {
            var child = tilesetRootChild.children[i];
            if(child.children === null){
                if(!!child.tile){
                    minXYZ = !minXYZ ? new Array(child.tile.minXYZ[0],child.tile.minXYZ[1],child.tile.minXYZ[2]) : minXYZ;
                    maxXYZ = !maxXYZ ? new Array(child.tile.maxXYZ[0],child.tile.maxXYZ[1],child.tile.maxXYZ[2]) : maxXYZ;
                    if(child.tile.minXYZ[0] <= minXYZ[0]){
                        minXYZ[0] = child.tile.minXYZ[0];
                    }
                    if(child.tile.minXYZ[1] <= minXYZ[1]){
                        minXYZ[1] = child.tile.minXYZ[1];
                    }
                    if(child.tile.minXYZ[2] <= minXYZ[2]){
                        minXYZ[2] = child.tile.minXYZ[2];
                    }
                    if(child.tile.maxXYZ[0] >= maxXYZ[0]){
                        maxXYZ[0] = child.tile.maxXYZ[0];
                    }
                    if(child.tile.maxXYZ[1] >= maxXYZ[1]){
                        maxXYZ[1] = child.tile.maxXYZ[1];
                    }
                    if(child.tile.maxXYZ[2] >= maxXYZ[2]){
                        maxXYZ[2] = child.tile.maxXYZ[2];
                    }
                }else {
                    var ss = child;
                    debugger
                }

            }else {
                modifyOctantMinAndMax(child,minXYZ,maxXYZ);
            }

        }
        if(minXYZ !== undefined ){
            tilesetRootChild.min.x = minXYZ[0];
            tilesetRootChild.min.y = minXYZ[1];
            tilesetRootChild.min.z = minXYZ[2];
            tilesetRootChild.max.x = maxXYZ[0];
            tilesetRootChild.max.y = maxXYZ[1];
            tilesetRootChild.max.z = maxXYZ[2];
        }

    }else {
        if(!!tilesetRootChild.tile){
            /*tilesetRootChild.min.x = tilesetRootChild.tile.minXYZ[0];
            tilesetRootChild.min.y = tilesetRootChild.tile.minXYZ[1];
            tilesetRootChild.min.z = tilesetRootChild.tile.minXYZ[2];
            tilesetRootChild.max.x = tilesetRootChild.tile.maxXYZ[0];
            tilesetRootChild.max.y = tilesetRootChild.tile.maxXYZ[1];
            tilesetRootChild.max.z = tilesetRootChild.tile.maxXYZ[2];*/
        }
    }
}

function getChildrenName(children,nameArray) {
    nameArray = !nameArray ? new Array : nameArray;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if(!!child.content){
            nameArray.push(child.content.uri);
        }
        if(child.hasOwnProperty("children") && child['children'] instanceof Array){
            getChildrenName(child.children,nameArray);
        }
    }
    return nameArray;
}

function createB3DMTask(options,children,promiseArray) {
    promiseArray = !promiseArray ? new Array : promiseArray;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if(!!child.content){
            options.nameArray = child.content.nameArray;
            options.b3dmName = child.content.uri;
            delete child.content['nameArray'];
            delete child['minXYZ'];
            delete child['maxXYZ'];
            promiseArray.push(createB3dmTile(options));
        }
        if(child.hasOwnProperty("children") && child['children'] instanceof Array){
            createB3DMTask(options,child.children,promiseArray);
            /*for (let j = 0; j < child['children'].length; j++) {

            }*/
        }
    }
    return promiseArray;
}

function createB3dmTile(options) {
    // var deferred = Cesium.when.defer();
    var useBatchTableBinary = defaultValue(options.batchTableBinary, false);
    var noParents = defaultValue(options.noParents, false);
    var multipleParents = defaultValue(options.multipleParents, false);
    var transform = defaultValue(options.transform, Matrix4.IDENTITY);
    const useVertexColors:boolean = defaultValue(options.useVertexColors,false);
    var compressDracoMeshes = defaultValue(options.compressDracoMeshes, false);


    // Mesh urls listed in the same order as features in the classIds arrays
    var urls = options.nameArray;
    /*urls.forEach(function (value) {
        value = options.gltfDirectory + value;
    })*/
    for (let i = 0; i < urls.length; i++) {
        urls[i] = options.gltfDirectory + urls[i];
    }
    // console.log("ssssssssssssss" + urls.length);

    var instances = createInstances(noParents, multipleParents,urls.length,urls,options.xmlJson);
    //创建batchtableJson
    var batchTableJson = createBatchTableJson(instances, options);

    var batchTableBinary;
    if (useBatchTableBinary) {
        batchTableBinary = createBatchTableBinary(batchTableJson, options);  // Modifies the json in place
    }

    /*var buildingPositions = [
        new Cartesian3(-29.73924456, 79.6033968, 0)     //若ifcopenshell未指定use-world-coord，则导出dae时最顶层mesh包含matrix信息，需要每个ifcElement中转换矩阵的平移量 -y*LengthUnit  x*LengthUnit,对应gltf中的mesh0Matrix
    ];*/

    var buildingPositions = [
        new Cartesian3(0,0,0)   //ifcopenshell指定use-world-coord,gltf中顶点位置已含转换信息，无需再做平移变换
    ];

    // glTF models are initially y-up, transform to z-up
    var yUpToZUp = Quaternion.fromAxisAngle(Cartesian3.UNIT_X, CesiumMath.PI_OVER_TWO);
    var zUpRotation90 = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, CesiumMath.PI_OVER_TWO);            //每个ifcElement中转换矩阵旋转矩阵为单位阵时使用,cesium1.53版本使用，1.57不用旋转
    var zUpRotation0 = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, 0);
    var scale = new Cartesian3(1.0, 1.0, 1.0); // Scale the models up a bit

    // Local transforms of the buildings within the tile
    var buildingTransforms = [
        Matrix4.fromTranslationQuaternionRotationScale(buildingPositions[0], zUpRotation0, scale)
    ];
    /* var buildingTransforms = [
         Matrix4.fromTranslation(buildingPositions[0])
     ];*/

    var contentUri = options.b3dmName;
    var directory = options.outputPath;
    var tilePath = path.join(directory, contentUri);

    var buildingsLength = 1;
    var meshesLength = urls.length;
    var batchLength = buildingsLength * meshesLength;

    var featureTableJson = {
        BATCH_LENGTH : batchLength
    };

    return Promise.map(urls, function(url) {
        //console.log(url);
        const glb = fsExtra.readFileSync(url);
        return glbToGltf(glb).then(function(result) {
            try { //{gltf:gltf,separateResources:{}}
                return Mesh.fromGltf(result.gltf,useVertexColors);               //丢失了gltf中mesh0的matrix信息，在ifcopenshell中指定use-world-coords，最后将顶点信息写入gltf_buffer
            }catch (e) {
                console.error(e);
                console.log(url);
            }
        }).catch(function (error) {
            console.error(error);
        });

        /*return fsExtra.readJson(url)     //读取gltf文件
            .then(function(gltf) {
                try {
                    return Mesh.fromGltf(gltf);               //丢失了gltf中mesh0的matrix信息，在ifcopenshell中指定use-world-coords，最后将顶点信息写入gltf_buffer
                }catch (e) {
                    console.error(e);
                    console.log(url);
                }
            }).catch(function (reason) {
                console.error(reason);
            });*/
    }).then(function(meshes) { // promise队列返回resolve的value值不要修改，否则会value混乱
        var meshesLength = meshes.length;
        // console.log("ssssssss"+ meshesLength);
        var clonedMeshes = [];
        for (var i = 0; i < buildingsLength; ++i) {
            for (var j = 0; j < meshesLength; ++j) {
                var mesh = Mesh.clone(meshes[j]);
                //mesh.material = whiteOpaqueMaterial;
                mesh.transform(buildingTransforms[i]);
                clonedMeshes.push(mesh);
            }
        }
        var batchedMesh = Mesh.batch(clonedMeshes);
        try {
            return createGltf({
                mesh : batchedMesh,
                compressDracoMeshes : compressDracoMeshes,
                //useBatchIds : false
            });
        }catch (e) {
            console.error(e);
        }

    }).then(function(glb) {
        // console.log(glb);
        var b3dm = createB3dm({
            glb : glb,
            featureTableJson : featureTableJson,
            batchTableJson : batchTableJson,
            batchTableBinary : batchTableBinary
        });
        return Promise.resolve({
            b3dm : b3dm,
            name : contentUri
        });
        /*deferred.resolve({
            b3dm : b3dm,
            name : contentUri
        });
        return deferred.promise;*/
    });
}
// 合并模型为b3dm的测试代码
function createB3dmTile11(options) {
    var useBatchTableBinary = defaultValue(options.batchTableBinary, false);
    var noParents = defaultValue(options.noParents, false);
    var multipleParents = defaultValue(options.multipleParents, false);
    var transform = defaultValue(options.transform, Matrix4.IDENTITY);
    var compressDracoMeshes = defaultValue(options.compressDracoMeshes, false);


    // Mesh urls listed in the same order as features in the classIds arrays
    var urls = [];
    return fsExtra.readFile("../data/bim/sample_i3dm/name.txt", 'utf-8', function (err,data) {
        if(err){
            console.error(err);
        }
        else{
            var str_array = data.split(",");
            str_array.forEach(function (value) {
                urls.push('../data/bim/sample_i3dm/'+value);
            })

            var instances = createInstances11(noParents, multipleParents,urls.length,urls);
            var batchTableJson = createBatchTableJson(instances, options);

            var batchTableBinary;
            if (useBatchTableBinary) {
                batchTableBinary = createBatchTableBinary(batchTableJson, options);  // Modifies the json in place
            }

            /*var buildingPositions = [
                new Cartesian3(-29.73924456, 79.6033968, 0)     //若ifcopenshell未指定use-world-coord，则导出dae时最顶层mesh包含matrix信息，需要每个ifcElement中转换矩阵的平移量 -y*LengthUnit  x*LengthUnit,对应gltf中的mesh0Matrix
            ];*/

            var buildingPositions = [
                new Cartesian3(0,0,0)   //ifcopenshell指定use-world-coord,gltf中顶点位置已含转换信息，无需再做平移变换
            ];

            // glTF models are initially y-up, transform to z-up
            var yUpToZUp = Quaternion.fromAxisAngle(Cartesian3.UNIT_X, CesiumMath.PI_OVER_TWO);
            var zUpRotation0 = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, 0);            //每个ifcElement中转换矩阵旋转矩阵为单位阵时使用
            var scale = new Cartesian3(1.0, 1.0, 1.0); // Scale the models up a bit

            // Local transforms of the buildings within the tile
            var buildingTransforms = [
                Matrix4.fromTranslationQuaternionRotationScale(buildingPositions[0], zUpRotation0, scale)
            ];
            /* var buildingTransforms = [
                 Matrix4.fromTranslation(buildingPositions[0])
             ];*/


            var contentUri = 'tile.b3dm';
            var directory = options.directory;
            var tilePath = path.join(directory, contentUri);
            var tilesetJsonPath = path.join(directory, 'tileset.json');

            var buildingsLength = 1;
            var meshesLength = urls.length;
            var batchLength = buildingsLength * meshesLength;
            var geometricError = 70.0;

            var box = [
                -22.48, 52.06, 5.33,
                78.55, 0, 0,
                0, 159.535, 0,
                0, 0, 7.155
            ];
            /* var box = [
                 0, 0, -1.17,
                 10, 0, 0,
                 0, 10, 0,
                 0, 0, 6.955
             ];*/
            /* var box = [
                 0, 0, 10,
                 50, 0, 0,
                 0, 50, 0,
                 0, 0, 10
             ];*/

            var tilesetJson = createTilesetJsonSingle({
                contentUri : contentUri,
                geometricError : geometricError,
                box : box,
                transform : transform
            } as any);

            if (!options.legacy) {
                Extensions.addExtensionsUsed(tilesetJson, '3DTILES_batch_table_hierarchy');
                Extensions.addExtensionsRequired(tilesetJson, '3DTILES_batch_table_hierarchy');
            }

            var featureTableJson = {
                BATCH_LENGTH : batchLength
            };

            return Promise.map(urls, function(url) {
                //console.log(url);
                const glb = fsExtra.readFileSync(url);
                return glbToGltf(glb).then(function(result) {
                    try { //{gltf:gltf,separateResources:{}}
                        /*if(url.indexOf("3k78sW2oH8swtbeSMzotXs") >= 0)
                            debugger*/
                        return Mesh.fromGltf(result.gltf,false);               //丢失了gltf中mesh0的matrix信息，在ifcopenshell中指定use-world-coords，最后将顶点信息写入gltf_buffer
                    }catch (e) {
                        console.error(e);
                        console.log(url);
                    }
                }).catch(function (error) {
                    console.error(error);
                });
                /*return fsExtra.readJson(url)
                    .then(function(gltf) {
                        return Mesh.fromGltf(gltf,true);               //丢失了gltf中mesh0的matrix信息，在ifcopenshell中指定use-world-coords，最后将顶点信息写入gltf_buffer
                    }).catch(function (reason) {
                        console.error(reason);
                    });*/
            }).then(function(meshes) {
                var meshesLength = meshes.length;
                console.log("ssssssss"+ meshesLength);
                var clonedMeshes = [];
                for (var i = 0; i < buildingsLength; ++i) {
                    for (var j = 0; j < meshesLength; ++j) {
                        var mesh = Mesh.clone(meshes[j]);
                        //mesh.material = whiteOpaqueMaterial;
                        mesh.transform(buildingTransforms[i]);
                        clonedMeshes.push(mesh);
                    }
                }
                var batchedMesh = Mesh.batch(clonedMeshes);
                //var batchedMesh = clonedMeshes[0];
                try {
                    return createGltf({
                        mesh : batchedMesh,
                        compressDracoMeshes : false,
                        //useBatchIds : false
                    });
                }catch (e) {
                    console.error(e);
                }

            }).then(function(glb) {
                console.log(glb);
                return saveBinary(tilePath, glb, options.gzip)
                var b3dm = createB3dm({
                    glb : glb,
                    featureTableJson : featureTableJson,
                    batchTableJson : batchTableJson,
                    batchTableBinary : batchTableBinary
                });
                return Promise.all([
                    saveJson(tilesetJsonPath, tilesetJson, options.prettyJson),
                    saveBinary(tilePath, b3dm, options.gzip)
                ]);
            });
        }
    });
}

function deleteNull(tempObj) {
    for (let i = tempObj.children.length - 1; i >= 0; i--) {
        var child = tempObj.children[i];
        if(child === undefined){
            tempObj.children.splice(i,1);
        }
        if(!!child && child.children instanceof Array){
            deleteNull(child);
        }
    }
}

function computeOctantBoundingbox(minObj,maxobj) {
    var boundingBox = {
        box:[]
    };
    var center = {};
    center["x"] = (minObj.x + maxobj.x) / 2;
    center["y"] = (minObj.y + maxobj.y) / 2;
    center["z"] = (minObj.z + maxobj.z) / 2;
    // center.z = (minXYZ[1] + maxXYZ[1]) / 2;


    var dimensions = {};
    dimensions["x"] = maxobj.x - minObj.x;
    dimensions["y"] = maxobj.y - minObj.y;
    dimensions["z"] = maxobj.z - minObj.z;
    var box = [
        center["x"] , center["y"] , center["z"],
        dimensions["x"] / 2, 0 , 0,
        0 , dimensions["y"] / 2,0,
        0 , 0 , dimensions["z"] / 2
    ];
    boundingBox.box = box;
    return boundingBox;
}

function getRootJSONFromOctree(octreeRoot){
    var tempObj = octreeRoot;
    if(tempObj.children !== null){
        tempObj.boundingVolume = computeOctantBoundingbox(tempObj['min'],tempObj['max']);
        tempObj.geometricError = computeSSEFromBox(tempObj.boundingVolume.box);
        delete tempObj['data'];
        delete tempObj['points'];
        delete tempObj['min'];
        delete tempObj['max'];
        delete tempObj['tile'];

        for (let i = tempObj.children.length - 1; i >= 0; i--) {
            var child = tempObj.children[i];
            if(child.children === null && child.tile === null){
                tempObj.children.splice(i,1);
            }else if(child.children === null && child.tile !== null){
                tempObj.children[i] = child.tile;
            }else if(child.children !== null){
                child.boundingVolume = computeOctantBoundingbox(child['min'],child['max']);
                child.geometricError = computeSSEFromBox(child.boundingVolume.box);
                getRootJSONFromOctree(child);
            }else if(child.children !== null && child.tile !== null){

            }
        }
    }else if(tempObj.children === null && tempObj.tile === null){
        tempObj = {};
    }else if(tempObj.children === null && tempObj.tile !== null){
        tempObj = tempObj.tile;
    }
    return tempObj;
}

function computeTile(ocantData,indicesArr) {
    var tile = {
        boundingVolume:{},
        children : [],
        content:{},
        geometricError:0.0,
        refine:"ADD"
    };
    var nameArray = [];
    var minX = []; var minY = []; var minZ = [];
    var maxX = []; var maxY = []; var maxZ = [];
    for (let i = 0; i < ocantData.length; i++) {
        var obj = ocantData[i];
        nameArray.push(obj.name);
        minX.push(obj.value.minXYZ[0]); minY.push(obj.value.minXYZ[1]); minZ.push(obj.value.minXYZ[2]);
        maxX.push(obj.value.maxXYZ[0]); maxY.push(obj.value.maxXYZ[1]); maxZ.push(obj.value.maxXYZ[2]);
    }
    var tileMinXYZ = [Math.min.apply(null, minX),Math.min.apply(null, minY),Math.min.apply(null, minZ)];
    var tileMaxXYZ = [Math.max.apply(null, maxX),Math.max.apply(null, maxY),Math.max.apply(null, maxZ)];

    var center = {};
    center["x"] = (tileMinXYZ[0] + tileMaxXYZ[0]) / 2;
    center["y"] = (tileMinXYZ[1] + tileMaxXYZ[1]) / 2;
    center["z"] = (tileMinXYZ[2] + tileMaxXYZ[2]) / 2;
    // center.z = (minXYZ[1] + maxXYZ[1]) / 2;


    var dimensions = {};
    dimensions["x"] = tileMaxXYZ[0] - tileMinXYZ[0];
    dimensions["y"] = tileMaxXYZ[1] - tileMinXYZ[1];
    dimensions["z"] = tileMaxXYZ[2] - tileMinXYZ[2];
    var box = [
        center["x"] , center["y"] , center["z"],
        dimensions["x"] / 2, 0 , 0,
        0 , dimensions["y"] / 2,0,
        0 , 0 , dimensions["z"] / 2
    ];

    var boundsCenter = new Cartesian3(center["x"],center["y"],center["z"]);
    var boundsMax = new Cartesian3(tileMaxXYZ[0],tileMaxXYZ[1],tileMaxXYZ[2]);
    tile.geometricError = Cartesian3.distance(boundsCenter,boundsMax) * 2;
    tile.boundingVolume["box"] = box;
    tile.content["nameArray"] = nameArray;
    tile.content["uri"] = indicesArr.join('-') + ".b3dm";
    if(tile.children.length === 0){
        delete tile['children'];
    }
    tile["minXYZ"] = tileMinXYZ;
    tile["maxXYZ"] = tileMaxXYZ;
    return tile;
}
// 2020
function computeSSEFromBox(box,useXYZ?:boolean) {
    var bounds = {
        center:{
            x : box[0], y: box[1], z: box[2]
        },
        dimensions:{
            x: box[3] * 2,
            y: box[7] * 2,
            z: box[11] * 2
        }
    }
    var SSE = 0.0;
    var boundsCenter = new Cartesian3(bounds.center.x,bounds.center.y,bounds.center.z);
    var boundsMax = new Cartesian3(
        bounds.center.x + bounds.dimensions.x * 0.5,
        bounds.center.y + bounds.dimensions.y * 0.5,
        bounds.center.z + bounds.dimensions.z * 0.5
    );
    if(!!useXYZ){
        var xyzArr = [bounds.dimensions.x,bounds.dimensions.y,bounds.dimensions.z];
        SSE = Math.min.apply(null, xyzArr);
    }else {
        SSE = Cartesian3.distance(boundsCenter,boundsMax) * 2;
    }
    return SSE;
}

function computeSSE(bounds) {
    var SSE = 0.0;
    var boundsCenter = new Cartesian3(bounds.center.x,bounds.center.y,bounds.center.z);
    var boundsMax = new Cartesian3(
        bounds.center.x + bounds.dimensions.x * 0.5,
        bounds.center.y + bounds.dimensions.y * 0.5,
        bounds.center.z + bounds.dimensions.z * 0.5
    );
    SSE = Cartesian3.distance(boundsCenter,boundsMax) * 2;
    return SSE;
}

function createFloatBuffer(values) {
    var buffer = Buffer.alloc(values.length * sizeOfFloat);
    var length = values.length;
    for (var i = 0; i < length; ++i) {
        buffer.writeFloatLE(values[i], i * sizeOfFloat);
    }
    return buffer;
}

function createUInt16Buffer(values) {
    var buffer = Buffer.alloc(values.length * sizeOfUint16);
    var length = values.length;
    for (var i = 0; i < length; ++i) {
        buffer.writeUInt16LE(values[i], i * sizeOfUint16);
    }
    return buffer;
}

function createBatchTableBinary(batchTable, options) {
    var byteOffset = 0;
    var buffers = [];
    var use3dTilesNext = defaultValue(options.use3dTilesNext, false);

    function createBinaryProperty(values, componentType, type?, name?: string) {
        var buffer;
        if (componentType === 'FLOAT') {
            buffer = createFloatBuffer(values);
        } else if (componentType === 'UNSIGNED_SHORT') {
            buffer = createUInt16Buffer(values);
        }
        buffer = getBufferPadded(buffer);
        buffers.push(buffer);
        var binaryReference: any = {
            byteOffset: byteOffset,
            componentType: componentType,
            type: type
        };

        // Create a composite object containing all of the necessary
        // information to split into a GltfAccessor / GltfBufferView
        if (use3dTilesNext) {
            // buffer view
            binaryReference.name = name;
            binaryReference.byteLength = buffer.length;
            binaryReference.target = GLenumName.ARRAY_BUFFER;

            // accessor
            binaryReference.componentType = typeConversion.componentTypeStringToInteger(
                componentType
            );
            binaryReference.count = values.length;
            const minMax = getMinMax(values, 1);
            binaryReference.max = minMax.max;
            binaryReference.min = minMax.min;
            binaryReference.type = GltfType.SCALAR;
        }
        byteOffset += buffer.length;
        return binaryReference;
    }

    // Convert regular batch table properties to binary
    var propertyName;
    for (propertyName in batchTable) {
        if (
            batchTable.hasOwnProperty(propertyName) &&
            propertyName !== 'HIERARCHY' &&
            propertyName !== 'extensions' &&
            propertyName !== 'extras'
        ) {
            if (typeof batchTable[propertyName][0] === 'number') {
                batchTable[propertyName] = createBinaryProperty(
                    batchTable[propertyName],
                    'FLOAT',
                    'SCALAR',
                    propertyName
                );
            }
        }
    }

    // Convert instance properties to binary
    var hierarchy = options.legacy
        ? batchTable.HIERARCHY
        : batchTable.extensions['3DTILES_batch_table_hierarchy'];
    var classes = hierarchy.classes;
    var classesLength = classes.length;
    for (var i = 0; i < classesLength; ++i) {
        var instances = classes[i].instances;
        for (propertyName in instances) {
            if (instances.hasOwnProperty(propertyName)) {
                if (typeof instances[propertyName][0] === 'number') {
                    instances[propertyName] = createBinaryProperty(
                        instances[propertyName],
                        'FLOAT',
                        'SCALAR',
                        propertyName
                    );
                }
            }
        }
    }

    // Convert classIds to binary
    hierarchy.classIds = createBinaryProperty(
        hierarchy.classIds,
        'UNSIGNED_SHORT'
    );

    // Convert parentCounts to binary (if they exist)
    if (defined(hierarchy.parentCounts)) {
        hierarchy.parentCounts = createBinaryProperty(
            hierarchy.parentCounts,
            'UNSIGNED_SHORT'
        );
    }

    // Convert parentIds to binary (if they exist)
    if (defined(hierarchy.parentIds)) {
        hierarchy.parentIds = createBinaryProperty(
            hierarchy.parentIds,
            'UNSIGNED_SHORT'
        );
    }

    return Buffer.concat(buffers);
}

function createBatchTableJson(instances, options) {
    // Create batch table from the instances' regular properties
    var batchTable: any = {};
    var instancesLength = instances.length;
    for (var i = 0; i < instancesLength; ++i) {
        var instance = instances[i];
        var properties = instance.properties;
        if (defined(properties)) {
            for (var propertyName in properties) {
                if (properties.hasOwnProperty(propertyName)) {
                    if (!defined(batchTable[propertyName])) {
                        batchTable[propertyName] = [];
                    }
                    batchTable[propertyName].push(properties[propertyName]);
                }
            }
        }
    }

    var hierarchy = createHierarchy(instances);
    if (options.use3dTilesNext) {
        batchTable.tilesNextHierarchy = hierarchy;
    }

    if (options.legacy) {
        // Add HIERARCHY object
        batchTable.HIERARCHY = hierarchy;
    } else {
        Extensions.addExtension(
            batchTable,
            '3DTILES_batch_table_hierarchy',
            hierarchy
        );
    }

    return batchTable;
}

function createHierarchy(instances) {
    var i;
    var j;
    var classes = [];
    var classIds = [];
    var parentCounts = [];
    var parentIds = [];
    var instancesLength = instances.length;
    var classId;
    var classData;

    for (i = 0; i < instancesLength; ++i) {
        var instance = instances[i].instance;
        var className = instance.className;
        var properties = instance.properties;
        var parents = defaultValue(instance.parents, []);
        var parentsLength = parents.length;

        // Get class id
        classId = undefined;
        classData = undefined;
        var classesLength = classes.length;
        for (j = 0; j < classesLength; ++j) {
            if (classes[j].name === className) {
                classId = j;
                classData = classes[j];
                break;
            }
        }

        // Create class if it doesn't already exist
        if (!defined(classId)) {
            classData = {
                name: className,
                length: 0,
                instances: {}
            };
            classId = classes.length;
            classes.push(classData);
            var propertyNames = Object.keys(properties);
            var propertyNamesLength = propertyNames.length;
            for (j = 0; j < propertyNamesLength; ++j) {
                classData.instances[propertyNames[j]] = [];
            }
        }

        // Add properties to class
        for (var propertyName in properties) {
            if (properties.hasOwnProperty(propertyName)) {
                classData!.instances[propertyName].push(
                    properties[propertyName]
                );
            }
        }

        // Increment class instances length
        classData!.length++;

        // Add to classIds
        classIds.push(classId);

        // Add to parentCounts
        parentCounts.push(parentsLength);

        // Add to parent ids
        for (j = 0; j < parentsLength; ++j) {
            var parent = parents[j];
            var parentId = instances.indexOf(parent);
            parentIds.push(parentId);
        }
    }

    // Check if any of the instances have multiple parents, or if none of the instances have parents
    var singleParents = true;
    var noParents = true;
    for (i = 0; i < instancesLength; ++i) {
        if (parentCounts[i] > 0) {
            noParents = false;
        }
        if (parentCounts[i] > 1) {
            singleParents = false;
        }
    }

    if (noParents) {
        // Unlink parentCounts and parentIds
        parentCounts = undefined;
        parentIds = undefined;
    } else if (singleParents) {
        // Unlink parentCounts and add missing parentIds that point to themselves
        for (i = 0; i < instancesLength; ++i) {
            if (parentCounts[i] === 0) {
                parentIds.splice(i, 0, i);
            }
        }
        parentCounts = undefined;
    }

    return {
        instancesLength: instancesLength,
        classes: classes,
        classIds: classIds,
        parentIds: parentIds,
        parentCounts: parentCounts
    };
}

function addHierarchyToGltf(hierarchy: any, gltf: Gltf, binary: Buffer) {
    const classes = hierarchy.classes.map(
        (item) =>
            new FeatureHierarchyClass(item.name, item.length, item.instances)
    );
    const classIds = hierarchy.classIds;
    const parentCounts = hierarchy.parentCounts;
    const parentIds = hierarchy.parentIds;
    const instancesLength = hierarchy.instancesLength;
    return createFeatureHierarchySubExtension(
        gltf,
        classes,
        classIds,
        instancesLength,
        parentIds,
        parentCounts,
        binary
    );
}

function createStoreyMap(xmlJson) {
    const storeyMap = new Map();
    const result = JSONPath({path: '$..IfcBuildingStorey', json:xmlJson.ifc.decomposition.IfcProject});
    const buildStoreyArr = result[0];
    for (let i = 0; i < buildStoreyArr.length; i++) {
        let storeyName = '';
        if(buildStoreyArr[i].attr.Name){
            storeyName = buildStoreyArr[i].attr.Name;
        }
        const key = 'IfcBuildingStorey--' + buildStoreyArr[i].attr.id + '--' + storeyName;
        const ids = JSONPath({path: "$..attr[?(@property === 'id')]",
            json:buildStoreyArr[i]});
        /*const storeyChilds = JSONPath({path: '$..*',
            json:result[i]})*/
        storeyMap.set(key,ids);
    }
    return storeyMap;
}

function findStoreyByGuid(guid,xmlJson) {
    // const guid = '2djUpNQFD2dRiVUyFA_bce';
    const result = JSONPath({path: '$..IfcBuildingStorey', json:xmlJson.ifc.decomposition.IfcProject});
    const buildStoreyArr = result[0];
    // const arr2 = JSONPath({path: '$.*~', json:xmlJson.ifc.decomposition.IfcProject});
    // const arr3 = JSONPath({path:'$..IfcBuildingStorey',json:xmlJson.ifc.decomposition.IfcProject});
    // const arr4 = JSONPath({path:'$..*',json:xmlJson.ifc.decomposition.IfcProject});
    // const arr1 = JSONPath({path: '$..*[?(@property === \'@_id\' && @ === \'2djUpNQFD2dRiVUyFA_bce\')]^', json:xmlJson.ifc.decomposition.IfcProject});

    for (let i = 0; i < buildStoreyArr.length; i++) {
        /* const storeyChilds = JSONPath({path: '$..*',
             json:result[i]})
         const storeyChilds1 = JSONPath({path: '$..attr',
             json:result[i]})*/
        const storeyChilds2 = JSONPath({
            path: "$..*[?(@.id === '"+guid+"')]",
            json:buildStoreyArr[i]
        })
        if(storeyChilds2.length > 0){
            return buildStoreyArr[i];
        }
    }
    return null;
}

function createInstances(noParents, multipleParents,count,urls,xmlJson) {
    var propertyArray = [];
    // console.log(urls);
    urls.forEach(function (value,index,array) {
        var separator = value.lastIndexOf("/");
        var extension = value.indexOf(".glb");
        value = value.substring(separator + 1,extension);    //0H1nVTTAv6LhM6_nm3wfNy--IfcDoor
        value = value.split("--");
        propertyArray.push(value);
    })
    var instanceArray = [];

    let className = '';
    for (var i = 0; i < count; i++) {
        if(propertyArray[i][1] === 'IfcSite'){
            className = 'IfcSite--' +  propertyArray[i][0];
        }else {
            for (var [key, value] of buildStoreyMap) {
                const index = value.indexOf(propertyArray[i][0]);
                if(index >= 0){
                    className = key;
                    value.splice(index,1);
                    break;
                }
            }
            /*const buildStorey = findStoreyByGuid(propertyArray[i][0],xmlJson); //耗时很长，sample转换7.5h
            if(!buildStorey || !buildStorey.attr){
                console.log(propertyArray[i][0]);
                className = 'undefind';
            }else {
                const storeyName = buildStorey.attr.Name ? buildStorey.attr.Name : "";
                className = 'IfcBuildingStorey--' + buildStorey.attr.id + '--' + storeyName;
            }*/
        }
        var instance = {
            instance : {
                className : className,//propertyArray[i].join("--"),
                properties : {
                    guid : propertyArray[i][0],
                    ifc_type : propertyArray[i][1]
                }
            },
            /*properties : {    //为单个部件的属性
                guid : propertyArray[i][0],
                ifc_type : propertyArray[i][1]
            }*/
        };
        instanceArray.push(instance);
    }

    if (noParents) {
        return instanceArray;
    }

    if (multipleParents) {

        return instanceArray;
    }
    return instanceArray;
}

function createInstances11(noParents, multipleParents,count,urls) {
    var propertyArray = [];
    // console.log(urls);
    urls.forEach(function (value,index,array) {
        var separator = value.lastIndexOf("/");
        var extension = value.indexOf(".glb");
        value = value.substring(separator + 1,extension);    //0H1nVTTAv6LhM6_nm3wfNy--IfcDoor
        value = value.split("--");
        propertyArray.push(value);
    })
    var instanceArray = [];
    for (var i = 0; i < count; i++) {
        var instance = {
            instance : {
                className : propertyArray[i].join("--"),
                properties : {
                    guid : propertyArray[i][0],
                    ifc_type : propertyArray[i][1]
                }
            },
            /*properties : {   //在extension外层生成属性
                guid : propertyArray[i][0],
                ifc_type : propertyArray[i][1]
            }*/
        };
        instanceArray.push(instance);
    }

    if (noParents) {
        return instanceArray;
    }

    if (multipleParents) {

        return instanceArray;
    }
    return instanceArray;
}

