import {Cartesian3, defaultValue, defined, Math as CesiumMath, Matrix3, Matrix4, Quaternion} from "cesium";
import {createTilesetJsonSingle} from "./createTilesetJsonSingle";
import {Extensions} from "./Extensions";
import {getGltfFromGlbUri} from "./gltfFromUri";
import {Mesh} from "./Mesh";
import {Promise as Bluebird} from "bluebird";
import {FLOAT32_SIZE_BYTES, UINT16_SIZE_BYTES, UINT32_SIZE_BYTES, UINT8_SIZE_BYTES} from "./typeSize";

import createGltf = require('./createGltf');
const createI3dm = require('./createI3dm');
import {ElementInfo} from "./readXml";

class CreateI3DMTile {
    constructor() {
    }

    static createI3DMTile(options,directoryPath,i3dmMap,gltfMap){
        try {
            return createI3dmTile(options,directoryPath,i3dmMap,gltfMap);
        }catch (e) {
            console.error(e);
        }

    }
}

async function createI3dmTile(options,directoryPath,i3dmMap,gltfMap) {
    var useBatchTableBinary = defaultValue(options.batchTableBinary, false);
    var noParents = defaultValue(options.noParents, false);
    var multipleParents = defaultValue(options.multipleParents, false);
    var transform = defaultValue(options.transform, Matrix4.IDENTITY);
    var compressDracoMeshes = defaultValue(options.compressDracoMeshes, false);

    const i3dmTileMap = new Map();
    for(const [key,value] of i3dmMap){
        const instancesplacementArray = [
            /*[-0.798636 ,-0.601815 ,0 ,0 ,0.601815 ,-0.798636 ,0 ,0 ,0 ,0 ,1 ,0 ,-20.2451 ,-21.2052 ,0 ,1],
            [0.798636 ,0.601815 ,0 ,0 ,-0.601815 ,0.798636 ,0 ,0 ,0 ,0 ,1 ,0 ,-21.9509 ,-21.4638 ,0 ,1]*/
        ];
        const instancesBoundsObj = [
            /*{
                minXYZ: [-20.7728 ,-21.4226 ,-0.000609347],
                maxXYZ: [-20.2461 ,-20.8932 ,0.775503]
            },
            {
                minXYZ: [-22.1876 ,-21.462 ,-0.000609347],
                maxXYZ: [-21.6609 ,-20.9325 ,0.775503]
            }*/
        ];
        const xArr = [];
        const yArr = [];
        const zArr = [];
        value.forEach(function (glbName) {
            const gltfInfo = gltfMap.get(glbName);
            instancesplacementArray.push(gltfInfo.objectPlacement);
            const boundObj = {minXYZ: gltfInfo.minXYZ,maxXYZ: gltfInfo.maxXYZ};
            instancesBoundsObj.push(boundObj);
            xArr.push(gltfInfo.minXYZ[0],gltfInfo.maxXYZ[0]);
            yArr.push(gltfInfo.minXYZ[1],gltfInfo.maxXYZ[1]);
            zArr.push(gltfInfo.minXYZ[2],gltfInfo.maxXYZ[2]);
        })

        var instances = createInstances11(noParents, multipleParents,value.length,value);
        var batchTableJson = createBatchTableJson(instances, options);

        const batchTableBinary = undefined;

        const templateGlbName = value[0];
        /*if(templateGlbName.indexOf("0ELdlxJuP1AwzgUXpRT7jq--IfcMember--70.glb") >= 0){
            debugger
        }*/
        const templateInfo = gltfMap.get(templateGlbName);
        const templateUrl = directoryPath + templateGlbName;
        //对应下方的模板信息进行更改
        let gltf = await getGltfFromGlbUri(templateUrl,   // 0 -1 0 0 1 0 0 0 0 0 1 0 -595.3 17895.5 6350 1
            {
                resourceDirectory : templateUrl
            });

        const placementArray = templateInfo.objectPlacement;//[1 ,0 ,0 ,0 ,0 ,1 ,0 ,0 ,0 ,0 ,1 ,0 ,-0.0328 ,-0.6461 ,6.350 ,1]//07hc1aZW98debjzrL5Ho8h 拐角第一个
        const boundsobj = {
            minXYZ: templateInfo.minXYZ,
            maxXYZ: templateInfo.maxXYZ
        }

        let mat4 = Matrix4.fromColumnMajorArray(placementArray);

        const needScale = false;
        let scaleMatrix = Matrix4.IDENTITY;
        if(needScale){
            const mat3 = Matrix4.getMatrix3(mat4,new Matrix3());
            const rotation_template = Matrix3.getRotation(mat3,mat3);
            const rotation_template_inverse = Matrix3.inverse(rotation_template,new Matrix3());

            const x_length = boundsobj.maxXYZ[0] - boundsobj.minXYZ[0];  //1,0,2
            const y_length = boundsobj.maxXYZ[1] - boundsobj.minXYZ[1];
            const z_length = boundsobj.maxXYZ[2] - boundsobj.minXYZ[2];

            let scale_template = new Cartesian3(
                1 / x_length,
                1 / y_length,
                1 / z_length);
            scale_template = Matrix3.multiplyByVector(rotation_template_inverse,scale_template,scale_template);
            // {
            //   "x": 0.512820512820513,
            //   "y": 16.666666666666654,
            //   "z": 0.8230452674897114
            // }
            scale_template = Cartesian3.abs(scale_template,scale_template);
            scaleMatrix = Matrix4.fromScale(scale_template);
        }

        let inverse_mat4 = Matrix4.inverse(mat4,new Matrix4());
        inverse_mat4 = Matrix4.multiply(scaleMatrix,inverse_mat4,inverse_mat4);
        // const scale1 = Matrix4.getScale(inverse_mat4,new Cartesian3());
        // inverse_mat4 = Matrix4.multiplyByScale(inverse_mat4,scale_template,inverse_mat4);
        const mesh = Mesh.fromGltf(gltf,true);
        const transformMesh = Mesh.clone(mesh);
        transformMesh.transform(inverse_mat4);
        const batchedMesh = Mesh.batch([transformMesh]);
        if(needScale){
            const center = batchedMesh.center;
            const center_negate = Cartesian3.negate(center, new Cartesian3());
            const center_transform = Matrix4.fromTranslation(center_negate);
            batchedMesh.transform(center_transform);
        }
        const template = await createGltf({
            mesh : batchedMesh,
            compressDracoMeshes : true,
            useBatchIds : false
        });
        /*const template_glb = await createGlb({
            mesh : batchedMesh,
            compressDracoMeshes : false,
            //useBatchIds : false
        });*/
        // return saveBinary(tilePath, template, options.gzip);


        const instancesLength = instancesplacementArray.length;
        const featureTableJson: any = {};
        featureTableJson.INSTANCES_LENGTH = instancesLength;

        let attributes = [];
        attributes.push(
            getPositions(instancesplacementArray)
        );

        const orientations = true;
        const eastNorthUp = defaultValue(options.eastNorthUp, false);
        if (orientations) {
            attributes = attributes.concat(getOrientations(instancesplacementArray));
        } else if (eastNorthUp) {
            featureTableJson.EAST_NORTH_UP = true;
        }

        //缩放只适合于单一材质模型，两种及以上材质模型缩放需要按primitive来
        if (needScale) {
            const scaleArray = [];
            for (let i = 0; i < instancesBoundsObj.length; i++) {
                const instanceBounds = instancesBoundsObj[i];
                let scale = new Cartesian3(
                    instanceBounds.maxXYZ[0] - instanceBounds.minXYZ[0],
                    instanceBounds.maxXYZ[1] - instanceBounds.minXYZ[1],
                    instanceBounds.maxXYZ[2] - instanceBounds.minXYZ[2]);
                const matrix4 = Matrix4.fromColumnMajorArray(instancesplacementArray[i]);
                const matrix3 = Matrix4.getMatrix3(matrix4,new Matrix3());
                let rotation_mat3 = Matrix3.getRotation(matrix3,new Matrix3());
                // rotation_mat3 = Matrix3.multiply(rotation_template_inverse,rotation_mat3,rotation_mat3);

                let rotateScale = Matrix3.multiplyByVector(rotation_mat3,scale,new Cartesian3());
                rotateScale = Cartesian3.abs(rotateScale,rotateScale);
                scaleArray.push(rotateScale);
            }

            attributes.push(getNonUniformScales(scaleArray));
        }

        const batchIds = true;
        if (batchIds) {
            attributes.push(getBatchIds(instancesLength));
        }

        let i;
        let attribute;
        let byteOffset = 0;
        let attributesLength = attributes.length;
        for (i = 0; i < attributesLength; ++i) {
            attribute = attributes[i];
            const byteAlignment = attribute.byteAlignment;
            byteOffset = Math.ceil(byteOffset / byteAlignment) * byteAlignment; // Round up to the required alignment
            attribute.byteOffset = byteOffset;
            byteOffset += attribute.buffer.length;
        }

        const featureTableBinary = Buffer.alloc(byteOffset);

        for (i = 0; i < attributesLength; ++i) {
            attribute = attributes[i];
            featureTableJson[attribute.propertyName] = {
                byteOffset: attribute.byteOffset,
                componentType: attribute.componentType // Only defined for batchIds
            };
            attribute.buffer.copy(featureTableBinary, attribute.byteOffset);
        }

        const i3dm = createI3dm({
            featureTableJson: featureTableJson,
            featureTableBinary: featureTableBinary,
            batchTableJson: batchTableJson,
            batchTableBinary: batchTableBinary,
            glb: template,
            // uri: ""   未指定glb，时读glb文件
        });

        //update bounds center
        const boundsInfo = new ElementInfo();
        const minXYZ = [Math.min.apply(null,xArr),Math.min.apply(null,yArr),Math.min.apply(null,zArr)];
        const maxXYZ = [Math.max.apply(null,xArr),Math.max.apply(null,yArr),Math.max.apply(null,zArr)];
        let center:Cartesian3 = new Cartesian3();

        center.x = (minXYZ[0] + maxXYZ[0]) / 2;
        center.y = (minXYZ[1] + maxXYZ[1]) / 2;
        center.z = (minXYZ[2] + maxXYZ[2]) / 2;

        let dimensions:Cartesian3 = new Cartesian3();

        dimensions.x = maxXYZ[0] - minXYZ[0];
        dimensions.y = maxXYZ[1] - minXYZ[1];
        dimensions.z = maxXYZ[2] - minXYZ[2];

        boundsInfo.center = center;
        boundsInfo.dimensions = dimensions;

        boundsInfo.minXYZ = [center.x - dimensions.x / 2 ,center.y - dimensions.y / 2, center.z - dimensions.z/2];
        boundsInfo.maxXYZ = [center.x + dimensions.x / 2 ,center.y + dimensions.y/2, center.z + dimensions.z/2];
        i3dmTileMap.set(i3dm,boundsInfo);
    }
    return i3dmTileMap;
}

function getBatchIds(instancesLength: number) {
    let i: number;
    let buffer: Buffer;
    let componentType: string;
    let byteAlignment: number;

    if (instancesLength < 256) {
        buffer = Buffer.alloc(instancesLength * UINT8_SIZE_BYTES);
        for (i = 0; i < instancesLength; ++i) {
            buffer.writeUInt8(i, i * UINT8_SIZE_BYTES);
        }
        componentType = 'UNSIGNED_BYTE';
        byteAlignment = UINT8_SIZE_BYTES;
    } else if (instancesLength < 65536) {
        buffer = Buffer.alloc(instancesLength * UINT16_SIZE_BYTES);
        for (i = 0; i < instancesLength; ++i) {
            buffer.writeUInt16LE(i, i * UINT16_SIZE_BYTES);
        }
        componentType = 'UNSIGNED_SHORT';
        byteAlignment = UINT16_SIZE_BYTES;
    } else {
        buffer = Buffer.alloc(instancesLength * UINT32_SIZE_BYTES);
        for (i = 0; i < instancesLength; ++i) {
            buffer.writeUInt32LE(i, i * UINT32_SIZE_BYTES);
        }
        componentType = 'UNSIGNED_INT';
        byteAlignment = UINT32_SIZE_BYTES;
    }

    return {
        buffer: buffer,
        componentType: componentType,
        propertyName: 'BATCH_ID',
        byteAlignment: byteAlignment
    };
}

function getNonUniformScales(scaleArray) {
    const instancesLength = scaleArray.length;
    const buffer = Buffer.alloc(instancesLength * 3 * FLOAT32_SIZE_BYTES);
    for (let i = 0; i < instancesLength; ++i) {
        const scale = scaleArray[i];
        buffer.writeFloatLE(scale.x, i * 3 * FLOAT32_SIZE_BYTES);
        buffer.writeFloatLE(scale.y, (i * 3 + 1) * FLOAT32_SIZE_BYTES);
        buffer.writeFloatLE(scale.z, (i * 3 + 2) * FLOAT32_SIZE_BYTES);
    }
    return {
        buffer: buffer,
        propertyName: 'SCALE_NON_UNIFORM',
        byteAlignment: FLOAT32_SIZE_BYTES
    };
}

function getNormal(instancesplacement) {
    const matrix4 = Matrix4.fromColumnMajorArray(instancesplacement);
    const matrix3 = Matrix4.getMatrix3(matrix4,new Matrix3());
    const rotation_mat3 = Matrix3.getRotation(matrix3,new Matrix3());
    const quaternion = Quaternion.fromRotationMatrix(rotation_mat3);
    const axis = Quaternion.computeAxis(quaternion,new Cartesian3());
    const angle = Quaternion.computeAngle(quaternion);
    const angle_degree = CesiumMath.toDegrees(angle);

    const up = Matrix3.multiplyByVector(rotation_mat3,new Cartesian3(0,1,0),new Cartesian3());
    const right = Matrix3.multiplyByVector(rotation_mat3,new Cartesian3(1,0,0),new Cartesian3());

    const normal = up;//new Cartesian3(0,-1,0);
    Cartesian3.normalize(normal, normal);
    return {
        up:Cartesian3.normalize(up, up),
        right:Cartesian3.normalize(right,right)
    };
}

function generateRandomNormal() {
    const x = CesiumMath.nextRandomNumber();
    const y = CesiumMath.nextRandomNumber();
    const z = CesiumMath.nextRandomNumber();

    const normal = new Cartesian3(x, y, z);
    Cartesian3.normalize(normal, normal);
    return normal;
}

function getOrthogonalNormal(normal) {
    const randomNormal = generateRandomNormal();
    const orthogonal = Cartesian3.cross(normal, randomNormal, randomNormal);
    return Cartesian3.normalize(orthogonal, orthogonal);
    /*const orthogonal = right;//new Cartesian3(-1,0,0);
    return Cartesian3.normalize(orthogonal, orthogonal);*/
}

function getOrientations(instancesplacementArray) {
    const instancesLength = instancesplacementArray.length
    const normalsUpBuffer = Buffer.alloc(
        instancesLength * 3 * FLOAT32_SIZE_BYTES
    );
    const normalsRightBuffer = Buffer.alloc(
        instancesLength * 3 * FLOAT32_SIZE_BYTES
    );
    for (let i = 0; i < instancesLength; ++i) {
        const normalObj = getNormal(instancesplacementArray[i]);
        const normalUp = normalObj.up;
        normalsUpBuffer.writeFloatLE(normalUp.x, i * 3 * FLOAT32_SIZE_BYTES);
        normalsUpBuffer.writeFloatLE(normalUp.y, (i * 3 + 1) * FLOAT32_SIZE_BYTES);
        normalsUpBuffer.writeFloatLE(normalUp.z, (i * 3 + 2) * FLOAT32_SIZE_BYTES);

        const normalRight = normalObj.right;
        normalsRightBuffer.writeFloatLE(normalRight.x, i * 3 * FLOAT32_SIZE_BYTES);
        normalsRightBuffer.writeFloatLE(normalRight.y, (i * 3 + 1) * FLOAT32_SIZE_BYTES);
        normalsRightBuffer.writeFloatLE(normalRight.z, (i * 3 + 2) * FLOAT32_SIZE_BYTES);
    }

    return [
        {
            buffer: normalsUpBuffer,
            propertyName: 'NORMAL_UP',
            byteAlignment: FLOAT32_SIZE_BYTES
        },
        {
            buffer: normalsRightBuffer,
            propertyName: 'NORMAL_RIGHT',
            byteAlignment: FLOAT32_SIZE_BYTES
        }
    ];
}

function getPosition(transform) {
    const matrix4 = Matrix4.fromColumnMajorArray(transform);
    //const scale = Matrix4.getScale(matrix4,new Cartesian3());
    let position = new Cartesian3(0, 0, 0);
    Matrix4.multiplyByPoint(matrix4, position, position);

    return position;
}

function getPositions(transformArray) {
    const instancesLength = transformArray.length;
    const buffer = Buffer.alloc(instancesLength * 3 * FLOAT32_SIZE_BYTES);
    for (let i = 0; i < instancesLength; ++i) {
        const position = getPosition(
            transformArray[i]
        );
        buffer.writeFloatLE(position.x, i * 3 * FLOAT32_SIZE_BYTES);
        buffer.writeFloatLE(position.y, (i * 3 + 1) * FLOAT32_SIZE_BYTES);
        buffer.writeFloatLE(position.z, (i * 3 + 2) * FLOAT32_SIZE_BYTES);
    }
    return {
        buffer: buffer,
        propertyName: 'POSITION',
        byteAlignment: FLOAT32_SIZE_BYTES
    };
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

export default CreateI3DMTile;
