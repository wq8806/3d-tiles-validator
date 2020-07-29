import { Promise } from 'bluebird';
import { calculateFilenameExt } from './calculateFilenameExt';
import { createFeatureHierarchySubExtension } from './createFeatureHierarchySubExtension';
import { Gltf, GltfType, GLenumName } from './gltfType';
import { FeatureHierarchyClass } from './featureHierarchyClass';
import { Material } from './Material';
import { Mesh } from './Mesh';
import {
    Cartesian3,
    defaultValue,
    defined,
    Math as CesiumMath,
    Matrix4,
    Quaternion,
} from 'cesium';
var Cesium = require('cesium');

const gltfPipeline = require('gltf-pipeline');
var gltfToGlb = gltfPipeline.gltfToGlb;
var fsExtra = require('fs-extra');
var path = require('path');
var gltfConversionOptions = { resourceDirectory: path.join(__dirname, '../') };
import createGltf = require('./createGltf');
import { createTilesetJsonSingle } from './createTilesetJsonSingle';
import { createFeatureMetadataExtension } from './createFeatureMetadataExtension';
import { Extensions } from './Extensions';

var typeConversion = require('./typeConversion');
var getMinMax = require('./getMinMax');

var createB3dm = require('./createB3dm');
var createGlb = require('./createGlb');
var getBufferPadded = require('./getBufferPadded');
var saveBinary = require('./saveBinary');
var saveJson = require('./saveJson');
// add own dependency
var readXml = require('./readXml');
var readGltfNames = require('./readGltfNames');
var math_ds = require('math-ds');
var PointOctree = require('sparse-octree');

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

export function createBatchTableHierarchy(options) {
    var use3dTilesNext = defaultValue(options.use3dTilesNext, false);
    var useGlb = defaultValue(options.useGlb, false);
    var gzip = defaultValue(options.gzip, false);
    var useBatchTableBinary = defaultValue(options.batchTableBinary, false);
    var noParents = defaultValue(options.noParents, false);
    var multipleParents = defaultValue(options.multipleParents, false);
    var transform = defaultValue(options.transform, Matrix4.IDENTITY);

    var compressDracoMeshes = defaultValue(options.compressDracoMeshes, false);

    var directoryPath = "../data/bim/sample_all/";
    options.gltfDirectory = directoryPath;
    readXml({directoryPath:directoryPath}).then(function (xmlMap) {
        debugger
        console.log(xmlMap);
        var rootbounds;
        for (let k of xmlMap.keys()) {
            if(k.indexOf('IfcProject') >= 0){
                rootbounds = xmlMap.get(k);
                break;
            }
        }
        var buildingbounds;
        for (let k of xmlMap.keys()) {
            if(k.indexOf('IfcBuilding') >= 0){
                buildingbounds = xmlMap.get(k);
                break;
            }
        }
        var buildingboundsStr = "{\"center\":{\"x\":23.912799999999997,\"y\":5.6331,\"z\":-11.093300000000001},\"dimensions\":{\"x\":83.9766,\"y\":13.704600000000001,\"z\":84.7206},\"minXYZ\":[-18.075500000000005,-1.2192000000000007,-53.4536],\"maxXYZ\":[65.9011,12.4854,31.267000000000003]}";
        buildingbounds = JSON.parse(buildingboundsStr);
        console.log(buildingbounds);

        readGltfNames({directoryPath:directoryPath}).then(function (gltfMap) {
            // console.log(xmlMap.get('3YRUDfcyHErvr_vn5cgjsR--IfcMember.gltf'));
            /*for(let [key, value] of gltfMap){
                gltfMap.set(key,xmlMap.get(key));
            }*/
            try {
                /*for(const [key, value] of  Object.entries(gltfMap)){
                    gltfMap.set(key,xmlMap.get(key));
                }*/
                gltfMap.forEach(function(value,key){
                    gltfMap.set(key,xmlMap.get(key));
                });
            }catch (e) {
                console.error(e);
            }
            /*for (let key of gltfMap.keys()) {
                gltfMap.set(key,xmlMap.get(key));
            }*/
            //console.log(gltfMap);
            var contentUri = 'tile.b3dm';
            var directory = options.directory;
            // var tilePath = path.join(directory, contentUri);
            var tilesetJsonPath = path.join(directory, 'tileset.json');
            var rootboundsStr = "{\"center\":{\"x\":52.0585,\"y\":5.3283000000000005,\"z\":-22.48245},\"dimensions\":{\"x\":319.065,\"y\":14.3142,\"z\":151.7627},\"minXYZ\":[-107.47399999999999,-1.8287999999999993,-98.3638],\"maxXYZ\":[211.591,12.4854,53.3989]}";
            rootbounds = JSON.parse(rootboundsStr);
            console.log(rootbounds);
            var box = [
                rootbounds.center.z , rootbounds.center.x , rootbounds.center.y,
                rootbounds.dimensions.z / 2, 0 , 0,
                0 , rootbounds.dimensions.x / 2,0,
                0 , 0 , rootbounds.dimensions.y / 2
            ];
            var geometricError = computeSSE(rootbounds);

            var opts:any = {
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

            try {
                /*var box1 = new math_ds.Box3(
                    new math_ds.Vector3( rootbounds.center.z - rootbounds.dimensions.z / 2,
                        rootbounds.center.x - rootbounds.dimensions.x / 2, rootbounds.center.y - rootbounds.dimensions.y / 2),
                    new math_ds.Vector3( rootbounds.center.z + rootbounds.dimensions.z / 2,
                        rootbounds.center.x + rootbounds.dimensions.x / 2, rootbounds.center.y + rootbounds.dimensions.y / 2),
                );
                console.log(box1);*/
                var rootbox = new math_ds.Box3(
                    new math_ds.Vector3(rootbounds.minXYZ[2],rootbounds.minXYZ[0],rootbounds.minXYZ[1]),
                    new math_ds.Vector3(rootbounds.maxXYZ[2],rootbounds.maxXYZ[0],rootbounds.maxXYZ[1])
                );
                //console.log(box);
                const octree = new PointOctree.PointOctree(rootbox.min, rootbox.max, 0.0, 200);
                gltfMap.forEach(function(value,key){
                    octree.put(new math_ds.Vector3(value.center.z, value.center.x, value.center.y), {name:key,value:value});
                });
                /*for(var [key, value] of gltfMap){
                    octree.put(new math_ds.Vector3(value.center.z, value.center.x, value.center.y), {name:key,value:value});
                }*/
                /*var countExist = 0;
                var countLose = 0;

                for(var [key,value] of gltfMap){
                    var point = new math_ds.Vector3(value.center.z, value.center.x, value.center.y);
                    if(!octree.root.contains(point, octree.bias)){
                        console.log(key);
                        console.log(point);
                        ++countLose;
                    }else {
                        ++countExist;
                    }
                }
                console.log(countExist);
                console.log(countLose);*/
                console.log(octree.pointCount);
                console.log(octree.getDepth());
                if(octree.getDepth() > 0){
                    octree.root.tile = null;
                }
                const iterator = octree.leaves();

                let i = 0;
                // var children = [];
                while(!iterator.next().done) {
                    console.log(iterator.indices);
                    var indicesArr = iterator.indices;
                    var currentOctant = iterator.result.value;
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
                console.log(i);
                console.log(JSON.stringify(octree));
                try {
                    var depth = octree.getDepth();
                    var ocs = octree.findOctantsByLevel(0);  //1
                    var ocs1 = octree.findOctantsByLevel(1);
                    var ocsss = octree.findOctantsByLevel(depth-1);  //40
                    var ocss = octree.findOctantsByLevel(depth);   //64
                    var ocs3 = octree.findOctantsByLevel(depth+1);   //0
                    for (let j = 1; j < depth; j++) {
                        var octants = octree.findOctantsByLevel(j);
                        for (let k = 0; k < octants.length; k++) {
                            var currentOctant = octants[k];
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
                    octree.root.children.forEach(function (value,index,arr) {
                        // modifyOctantMinAndMax(value);
                    })
                    var testss = getRootJSONFromOctree(octree.root);
                    deleteNull(testss);

                    console.log(JSON.stringify(testss));
                    var children = JSON.parse(JSON.stringify(testss.children));
                    tilesetJson.root.children = children;
                    console.log(JSON.stringify(tilesetJson));
                }catch (e) {
                    console.error(e);
                }

            }catch (e) {
                console.error(e);
            }

            //createB3dmTile11(options);
            try {
                var promiseArr = createB3DMTask(options,tilesetJson.root.children,undefined);
                saveJson(tilesetJsonPath, tilesetJson, options.prettyJson);
                return Promise.all(promiseArr).then(function (results) {
                    var b3dmNameArr = getChildrenName(tilesetJson.root.children,undefined);
                    for (let i = 0; i < results.length; i++) {
                        var tilePath = path.join(options.directory , results[i]["name"]);
                        saveBinary(tilePath, results[i]["b3dm"], options.gzip)
                    }
                    console.log("done");
                })
            }catch (e) {
                console.error(e)
            }


            /*return Promise.all([
                saveTilesetJson(tilesetJsonPath, tilesetJson, options.prettyJson),
                //saveTile(tilePath, b3dm, options.gzip)
            ]).then(function (data) {
                console.log(data);
            });*/

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
        debugger
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
        var child = children[i];
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
        var child = children[i];
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
    var deferred = Cesium.when.defer();
    var useBatchTableBinary = defaultValue(options.batchTableBinary, false);
    var noParents = defaultValue(options.noParents, false);
    var multipleParents = defaultValue(options.multipleParents, false);
    var transform = defaultValue(options.transform, Matrix4.IDENTITY);
    var compressDracoMeshes = defaultValue(options.compressDracoMeshes, false);


    // Mesh urls listed in the same order as features in the classIds arrays
    var urls = options.nameArray;
    /*urls.forEach(function (value) {
        value = options.gltfDirectory + value;
    })*/
    for (let i = 0; i < urls.length; i++) {
        urls[i] = options.gltfDirectory + urls[i];
    }
    console.log("ssssssssssssss" + urls.length);



    var instances = createInstances(noParents, multipleParents,urls.length,urls);
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
        Matrix4.fromTranslationQuaternionRotationScale(buildingPositions[0], zUpRotation90, scale)
    ];
    /* var buildingTransforms = [
         Matrix4.fromTranslation(buildingPositions[0])
     ];*/


    var contentUri = options.b3dmName;
    var directory = options.directory;
    var tilePath = path.join(directory, contentUri);

    var buildingsLength = 1;
    var meshesLength = urls.length;
    var batchLength = buildingsLength * meshesLength;

    var featureTableJson = {
        BATCH_LENGTH : batchLength
    };

    return Promise.map(urls, function(url) {
        //console.log(url);
        return fsExtra.readJson(url)
            .then(function(gltf) {
                try {
                    return Mesh.fromGltf(gltf);               //丢失了gltf中mesh0的matrix信息，在ifcopenshell中指定use-world-coords，最后将顶点信息写入gltf_buffer
                }catch (e) {
                    console.error(e);
                    console.log(url);
                }
            }).catch(function (reason) {
                console.error(reason);
            });
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
                compressDracoMeshes : compressDracoMeshes,
                //useBatchIds : false
            });
        }catch (e) {
            console.error(e);
        }

    }).then(function(glb) {
        console.log(glb);
        var b3dm = createB3dm({
            glb : glb,
            featureTableJson : featureTableJson,
            batchTableJson : batchTableJson,
            batchTableBinary : batchTableBinary
        });
        deferred.resolve({
            b3dm : b3dm,
            name : contentUri
        });
        return deferred.promise;
        /*return Promise.all([
            //saveTilesetJson(tilesetJsonPath, tilesetJson, options.prettyJson),
            saveTile(tilePath, b3dm, options.gzip)
        ]).then(function () {
            deferred.resolve();
            return deferred.promise;
        });*/
    });
}

function createB3dmTile11(options) {
    var useBatchTableBinary = defaultValue(options.batchTableBinary, false);
    var noParents = defaultValue(options.noParents, false);
    var multipleParents = defaultValue(options.multipleParents, false);
    var transform = defaultValue(options.transform, Matrix4.IDENTITY);
    var compressDracoMeshes = defaultValue(options.compressDracoMeshes, false);


    // Mesh urls listed in the same order as features in the classIds arrays
    var urls = [];
    return fsExtra.readFile("data/sample_wall/name.txt", 'utf-8', function (err,data) {
        if(err){
            console.error(err);
        }
        else{
            //console.log(data);
            var str_array = data.split(",");
            str_array.forEach(function (value) {
                urls.push('data/sample_wall/'+value);
            })
            console.log("ssssssssssssss" + urls.length);



            var instances = createInstances(noParents, multipleParents,urls.length,urls);
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
                return fsExtra.readJson(url)
                    .then(function(gltf) {
                        try {
                            return Mesh.fromGltf(gltf);               //丢失了gltf中mesh0的matrix信息，在ifcopenshell中指定use-world-coords，最后将顶点信息写入gltf_buffer
                        }catch (e) {
                            console.error(e);
                            console.log(url);
                        }
                    }).catch(function (reason) {
                        console.error(reason);
                    });
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
                        compressDracoMeshes : compressDracoMeshes,
                        //useBatchIds : false
                    });
                }catch (e) {
                    console.error(e);
                }

            }).then(function(glb) {
                console.log(glb);
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
        center["z"] , center["x"] , center["y"],
        dimensions["z"] / 2, 0 , 0,
        0 , dimensions["x"] / 2,0,
        0 , 0 , dimensions["y"] / 2
    ];
    boundingBox.box = box;
    return boundingBox;
}
function computeOctantBoundingbox22(minObj,maxobj) {
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
        center["z"] , center["x"] , center["y"],
        dimensions["z"] / 2, 0 , 0,
        0 , dimensions["x"] / 2,0,
        0 , 0 , dimensions["y"] / 2
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

function createInstances(noParents, multipleParents,count,urls) {
    var propertyArray = [];
    console.log(urls);
    urls.forEach(function (value,index,array) {
        var separator = value.lastIndexOf("/");
        var extension = value.indexOf(".gltf");
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
                    guid : propertyArray[i][0]
                }
            },
            properties : {
                guid : propertyArray[i][0],
                ifc_type : propertyArray[i][1]
            }
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
    console.log(urls);
    urls.forEach(function (value,index,array) {
        var separator = value.lastIndexOf("/");
        var extension = value.indexOf(".gltf");
        value = value.substring(separator + 1,extension);    //0H1nVTTAv6LhM6_nm3wfNy--IfcDoor
    })
    var instanceArray = [];
    for (var i = 0; i < count; i++) {
        var instance = {
            instance : {
                className : 'wall',
                properties : {
                    wall_name : 'wall0',
                    wall_paint : 'pink',
                    wall_windows : 1
                }
            },
            properties : {
                guid : 10.0,
                ifc_type : 20.0
            }
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

function createInstances22(noParents, multipleParents) {
    var door0: any = {
        instance: {
            className: 'door',
            properties: {
                door_name: 'door0',
                door_width: 1.2,
                door_mass: 10
            }
        },
        properties: {
            height: 5.0,
            area: 10.0
        }
    };
    var door1: any = {
        instance: {
            className: 'door',
            properties: {
                door_name: 'door1',
                door_width: 1.3,
                door_mass: 11
            }
        },
        properties: {
            height: 5.0,
            area: 10.0
        }
    };
    var door2: any = {
        instance: {
            className: 'door',
            properties: {
                door_name: 'door2',
                door_width: 1.21,
                door_mass: 14
            }
        },
        properties: {
            height: 5.0,
            area: 10.0
        }
    };
    var door3: any = {
        instance: {
            className: 'door',
            properties: {
                door_name: 'door3',
                door_width: 1.5,
                door_mass: 7
            }
        },
        properties: {
            height: 5.0,
            area: 10.0
        }
    };
    var door4: any = {
        instance: {
            className: 'door',
            properties: {
                door_name: 'door4',
                door_width: 1.1,
                door_mass: 8
            }
        },
        properties: {
            height: 5.0,
            area: 10.0
        }
    };
    var door5: any = {
        instance: {
            className: 'door',
            properties: {
                door_name: 'door5',
                door_width: 1.15,
                door_mass: 12
            }
        },
        properties: {
            height: 5.0,
            area: 10.0
        }
    };
    var door6: any = {
        instance: {
            className: 'door',
            properties: {
                door_name: 'door6',
                door_width: 1.32,
                door_mass: 3
            }
        },
        properties: {
            height: 5.0,
            area: 10.0
        }
    };
    var door7: any = {
        instance: {
            className: 'door',
            properties: {
                door_name: 'door7',
                door_width: 1.54,
                door_mass: 6
            }
        },
        properties: {
            height: 5.0,
            area: 10.0
        }
    };
    var door8: any = {
        instance: {
            className: 'door',
            properties: {
                door_name: 'door8',
                door_width: 1.8,
                door_mass: 3
            }
        },
        properties: {
            height: 5.0,
            area: 10.0
        }
    };
    var door9: any = {
        instance: {
            className: 'door',
            properties: {
                door_name: 'door9',
                door_width: 2.0,
                door_mass: 5
            }
        },
        properties: {
            height: 5.0,
            area: 10.0
        }
    };
    var door10: any = {
        instance: {
            className: 'door',
            properties: {
                door_name: 'door10',
                door_width: 2.1,
                door_mass: 9
            }
        },
        properties: {
            height: 5.0,
            area: 10.0
        }
    };
    var door11: any = {
        instance: {
            className: 'door',
            properties: {
                door_name: 'door11',
                door_width: 1.3,
                door_mass: 10
            }
        },
        properties: {
            height: 5.0,
            area: 10.0
        }
    };
    var doorknob0: any = {
        instance: {
            className: 'doorknob',
            properties: {
                doorknob_name: 'doorknob0',
                doorknob_size: 0.3
            }
        },
        properties: {
            height: 0.1,
            area: 0.2
        }
    };
    var doorknob1: any = {
        instance: {
            className: 'doorknob',
            properties: {
                doorknob_name: 'doorknob1',
                doorknob_size: 0.43
            }
        },
        properties: {
            height: 0.1,
            area: 0.2
        }
    };
    var doorknob2: any = {
        instance: {
            className: 'doorknob',
            properties: {
                doorknob_name: 'doorknob2',
                doorknob_size: 0.32
            }
        },
        properties: {
            height: 0.1,
            area: 0.2
        }
    };
    var doorknob3: any = {
        instance: {
            className: 'doorknob',
            properties: {
                doorknob_name: 'doorknob3',
                doorknob_size: 0.2
            }
        },
        properties: {
            height: 0.1,
            area: 0.2
        }
    };
    var doorknob4: any = {
        instance: {
            className: 'doorknob',
            properties: {
                doorknob_name: 'doorknob4',
                doorknob_size: 0.21
            }
        },
        properties: {
            height: 0.1,
            area: 0.2
        }
    };
    var doorknob5: any = {
        instance: {
            className: 'doorknob',
            properties: {
                doorknob_name: 'doorknob5',
                doorknob_size: 0.35
            }
        },
        properties: {
            height: 0.1,
            area: 0.2
        }
    };
    var doorknob6: any = {
        instance: {
            className: 'doorknob',
            properties: {
                doorknob_name: 'doorknob6',
                doorknob_size: 0.3
            }
        },
        properties: {
            height: 0.1,
            area: 0.2
        }
    };
    var doorknob7: any = {
        instance: {
            className: 'doorknob',
            properties: {
                doorknob_name: 'doorknob7',
                doorknob_size: 0.23
            }
        },
        properties: {
            height: 0.1,
            area: 0.2
        }
    };
    var doorknob8: any = {
        instance: {
            className: 'doorknob',
            properties: {
                doorknob_name: 'doorknob8',
                doorknob_size: 0.43
            }
        },
        properties: {
            height: 0.1,
            area: 0.2
        }
    };
    var doorknob9: any = {
        instance: {
            className: 'doorknob',
            properties: {
                doorknob_name: 'doorknob9',
                doorknob_size: 0.32
            }
        },
        properties: {
            height: 0.1,
            area: 0.2
        }
    };
    var doorknob10: any = {
        instance: {
            className: 'doorknob',
            properties: {
                doorknob_name: 'doorknob10',
                doorknob_size: 0.41
            }
        },
        properties: {
            height: 0.1,
            area: 0.2
        }
    };
    var doorknob11: any = {
        instance: {
            className: 'doorknob',
            properties: {
                doorknob_name: 'doorknob11',
                doorknob_size: 0.33
            }
        },
        properties: {
            height: 0.1,
            area: 0.2
        }
    };
    var roof0: any = {
        instance: {
            className: 'roof',
            properties: {
                roof_name: 'roof0',
                roof_paint: 'red'
            }
        },
        properties: {
            height: 6.0,
            area: 12.0
        }
    };
    var roof1: any = {
        instance: {
            className: 'roof',
            properties: {
                roof_name: 'roof1',
                roof_paint: 'blue'
            }
        },
        properties: {
            height: 6.0,
            area: 12.0
        }
    };
    var roof2: any = {
        instance: {
            className: 'roof',
            properties: {
                roof_name: 'roof2',
                roof_paint: 'yellow'
            }
        },
        properties: {
            height: 6.0,
            area: 12.0
        }
    };
    var wall0: any = {
        instance: {
            className: 'wall',
            properties: {
                wall_name: 'wall0',
                wall_paint: 'pink',
                wall_windows: 1
            }
        },
        properties: {
            height: 10.0,
            area: 20.0
        }
    };
    var wall1: any = {
        instance: {
            className: 'wall',
            properties: {
                wall_name: 'wall1',
                wall_paint: 'orange',
                wall_windows: 2
            }
        },
        properties: {
            height: 10.0,
            area: 20.0
        }
    };
    var wall2: any = {
        instance: {
            className: 'wall',
            properties: {
                wall_name: 'wall2',
                wall_paint: 'blue',
                wall_windows: 4
            }
        },
        properties: {
            height: 10.0,
            area: 20.0
        }
    };
    var building0: any = {
        instance: {
            className: 'building',
            properties: {
                building_name: 'building0',
                building_area: 20.0
            }
        }
    };
    var building1: any = {
        instance: {
            className: 'building',
            properties: {
                building_name: 'building1',
                building_area: 21.98
            }
        }
    };
    var building2: any = {
        instance: {
            className: 'building',
            properties: {
                building_name: 'building2',
                building_area: 39.3
            }
        }
    };
    var zone0: any = {
        instance: {
            className: 'zone',
            properties: {
                zone_name: 'zone0',
                zone_buildings: 3
            }
        }
    };
    var classifierNew: any = {
        instance: {
            className: 'classifier_new',
            properties: {
                year: 2000,
                color: 'red',
                name: 'project',
                architect: 'architect'
            }
        }
    };
    var classifierOld: any = {
        instance: {
            className: 'classifier_old',
            properties: {
                description: 'built in 1980',
                inspection: 2009
            }
        }
    };

    if (noParents) {
        return [
            doorknob0,
            doorknob1,
            doorknob2,
            doorknob3,
            door0,
            door1,
            door2,
            door3,
            roof0,
            wall0,
            doorknob4,
            doorknob5,
            doorknob6,
            doorknob7,
            door4,
            door5,
            door6,
            door7,
            roof1,
            wall1,
            doorknob8,
            doorknob9,
            doorknob10,
            doorknob11,
            door8,
            door9,
            door10,
            door11,
            roof2,
            wall2
        ];
    }
    door0.instance.parents = [building0];
    door1.instance.parents = [building0];
    door2.instance.parents = [building0];
    door3.instance.parents = [building0];
    door4.instance.parents = [building1];
    door5.instance.parents = [building1];
    door6.instance.parents = [building1];
    door7.instance.parents = [building1];
    door8.instance.parents = [building2];
    door9.instance.parents = [building2];
    door10.instance.parents = [building2];
    door11.instance.parents = [building2];
    doorknob0.instance.parents = [door0];
    doorknob1.instance.parents = [door1];
    doorknob2.instance.parents = [door2];
    doorknob3.instance.parents = [door3];
    doorknob4.instance.parents = [door4];
    doorknob5.instance.parents = [door5];
    doorknob6.instance.parents = [door6];
    doorknob7.instance.parents = [door7];
    doorknob8.instance.parents = [door8];
    doorknob9.instance.parents = [door9];
    doorknob10.instance.parents = [door10];
    doorknob11.instance.parents = [door11];
    roof0.instance.parents = [building0];
    roof1.instance.parents = [building1];
    roof2.instance.parents = [building2];
    wall0.instance.parents = [building0];
    wall1.instance.parents = [building1];
    wall2.instance.parents = [building2];
    building0.instance.parents = [zone0];
    building1.instance.parents = [zone0];
    building2.instance.parents = [zone0];

    if (multipleParents) {
        door0.instance.parents.push(classifierOld);
        building0.instance.parents.push(classifierNew);
        building1.instance.parents.push(classifierOld);
        building2.instance.parents.push(classifierNew, classifierOld);
        return [
            doorknob0,
            doorknob1,
            doorknob2,
            doorknob3,
            door0,
            door1,
            door2,
            door3,
            roof0,
            wall0,
            doorknob4,
            doorknob5,
            doorknob6,
            doorknob7,
            door4,
            door5,
            door6,
            door7,
            roof1,
            wall1,
            doorknob8,
            doorknob9,
            doorknob10,
            doorknob11,
            door8,
            door9,
            door10,
            door11,
            roof2,
            wall2,
            building0,
            building1,
            building2,
            zone0,
            classifierNew,
            classifierOld
        ];
    }
    return [
        doorknob0,
        doorknob1,
        doorknob2,
        doorknob3,
        door0,
        door1,
        door2,
        door3,
        roof0,
        wall0,
        doorknob4,
        doorknob5,
        doorknob6,
        doorknob7,
        door4,
        door5,
        door6,
        door7,
        roof1,
        wall1,
        doorknob8,
        doorknob9,
        doorknob10,
        doorknob11,
        door8,
        door9,
        door10,
        door11,
        roof2,
        wall2,
        building0,
        building1,
        building2,
        zone0
    ];
}
