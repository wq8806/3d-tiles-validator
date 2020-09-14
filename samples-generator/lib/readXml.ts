
import { Promise as Bluebird } from 'bluebird';
var fsExtra = require('fs-extra');
var fastXmlParser = require('fast-xml-parser');
import {JSONPath} from 'jsonpath-plus';
import {
    Cartesian3,
    defaultValue,
    defined,
    Math as CesiumMath,
    Matrix4,
    Matrix3,
    Quaternion,
} from 'cesium';

let xmlJson;
let lengthUnit = 0;

export function readXml(options) {
    const derrered = Bluebird.defer();
    var directoryPath = options.directoryPath;
    try {
        fsExtra.readFile(directoryPath +'property.xml','utf-8',function(err,result){
            if(err){
                console.error(err);
            }else {
                var options = {
                    attributeNamePrefix : "", //去掉前缀@_
                    attrNodeName: "attr", //default is 'false'
                    textNodeName : "#text",
                    ignoreNonTextNodeAttr : false,
                    ignoreTextNodeAttr : false,
                    ignoreNameSpace : false,
                    textNodeConversion : true,
                    ignoreAttributes : false,
                    //ignoreNameSpace : false,
                    allowBooleanAttributes : true,
                    parseNodeValue : true,
                    parseAttributeValue : true,
                    trimValues: true,
                    cdataTagName: "__cdata", //default is 'false'
                    cdataPositionChar: "\\c",
                    localeRange: "", //To support non english character in tag/attribute values.
                    parseTrueNumberOnly: false,
                    /*attrValueProcessor: a => he.decode(a, {isAttributeValue: true}),//default is a=>a
                    tagValueProcessor : a => he.decode(a) //default is a=>a*/
                };
                if(fastXmlParser.validate(result) === true){//optional

                    var jsonObj = fastXmlParser.parse(result,options);
                    xmlJson = jsonObj;

                    const lengthObj = JSONPath({
                        path: "$..*[?(@.UnitType === 'LENGTHUNIT')]",
                        json:jsonObj.ifc.units
                    })[0];
                    lengthUnit = lengthObj.SI_equivalent;

                    var myMap = traverseJson(jsonObj.ifc.decomposition,undefined);
                    derrered.resolve({
                        xmlJson:jsonObj,
                        elementInfoMap:myMap,
                    });
                    //console.log(myMap);
                    // console.log("ssssssssss"+ myMap.size);
                    // console.log('xml解析成json:'+JSON.stringify(jsonObj));
                }
            }
        });
    }catch (e) {
        console.error(e);
    }
    return derrered.promise;


}

function traverseJson(obj,map) {
    map = !map ? new Map() : map;
    for( var key in obj){
        if(key.indexOf('Ifc') >= 0 && obj[key] !== undefined){

            if(obj[key].hasOwnProperty("attr") && obj[key]['attr'].hasOwnProperty("minXYZ")){
                var minXYZStr = obj[key]['attr']['minXYZ'];
                var maxSYXStr = obj[key]['attr']['maxXYZ'];

                let placementStr = "";
                if(obj[key]['attr'].hasOwnProperty("ObjectPlacement")){
                    placementStr = obj[key]['attr']['ObjectPlacement'];
                }

                map.set(obj[key]['attr']['id'] + "--" + key +".glb",computeAABB(minXYZStr,maxSYXStr,placementStr));
                var objA = obj[key];
                traverseJson(objA,map);
            }else if(obj[key] instanceof Array){

                var objArr = obj[key];
                for (let i = 0; i < objArr.length; i++) {
                    var objB = {};
                    objB[key] = objArr[i];
                    traverseJson(objB,map);
                }
            }
        }
    }
    return map;
}

/*class Cartesian3 {
    x:number = 0;
    y:number = 0;
    z:number = 0;
};*/

export class ElementInfo {
    center: Cartesian3 = new Cartesian3();
    dimensions: Cartesian3 = new Cartesian3();
    minXYZ: number[] = [];
    maxXYZ: number[] = [];
    objectPlacement: number[] = [];
}

function computeAABB(minXYZStr,maxXYZStr,placementStr) {
    let elementInfo:ElementInfo = new ElementInfo();

    //objectPlacement
    const placement = getMatrix4FromPlacement(placementStr);
    elementInfo.objectPlacement = placement;

    const matrix4 = Matrix4.fromColumnMajorArray(placement);
    const matrix3 = Matrix4.getMatrix3(matrix4,new Matrix3());
    const rotation_mat3 = Matrix3.getRotation(matrix3,new Matrix3());
    const quaternion = Quaternion.fromRotationMatrix(rotation_mat3);
    const axis = Quaternion.computeAxis(quaternion,new Cartesian3());
    const angle = Quaternion.computeAngle(quaternion);
    const angle_degree = CesiumMath.toDegrees(angle);

    var minXYZ = minXYZStr.split(' ');
    var maxXYZ = maxXYZStr.split(' ');
    for (let i = 0; i < 3; i++) {
        minXYZ[i] = Number(minXYZ[i]);
        maxXYZ[i] = Number(maxXYZ[i]);
    }
    //Ifc中轴向与gltf有差异，但IfcOpenShell中minxyz，maxxyz已经是经过变换的世界坐标，3dtilesZ轴向上，加载该坐标是正确的轴向对齐的minxyz，maxxyz
    //xml中记录的minXYZ maxXYZ是包含子部件的边界框
    let center:Cartesian3 = new Cartesian3();
    /*center.x = (minXYZ[0] + maxXYZ[0]) / 2;
    center.y = (minXYZ[2] + maxXYZ[2]) / 2;
    center.z = 0 - (minXYZ[1] + maxXYZ[1]) / 2;
    // center.z = (minXYZ[1] + maxXYZ[1]) / 2;*/
    center.x = (minXYZ[0] + maxXYZ[0]) / 2;
    center.y = (minXYZ[1] + maxXYZ[1]) / 2;
    center.z = (minXYZ[2] + maxXYZ[2]) / 2;

    let dimensions:Cartesian3 = new Cartesian3();
    /*dimensions.x = maxXYZ[0] - minXYZ[0];
    dimensions.y = maxXYZ[2] - minXYZ[2];
    dimensions.z = maxXYZ[1] - minXYZ[1];*/
    dimensions.x = maxXYZ[0] - minXYZ[0];
    dimensions.y = maxXYZ[1] - minXYZ[1];
    dimensions.z = maxXYZ[2] - minXYZ[2];

    elementInfo.center = center;
    elementInfo.dimensions = dimensions;
    /*bounds.minXYZ = minXYZ;
    bounds.maxXYZ = maxXYZ;*/
    elementInfo.minXYZ = [center.x - dimensions.x / 2 ,center.y - dimensions.y / 2, center.z - dimensions.z/2];
    elementInfo.maxXYZ = [center.x + dimensions.x / 2 ,center.y + dimensions.y/2, center.z + dimensions.z/2];

    return elementInfo;
}

function getMatrix4FromPlacement(placementStr) {
    let placement;
    if(placementStr !== "" && typeof lengthUnit === 'number'){
        placement = placementStr.split(' ');

        placement[12] *= lengthUnit;
        placement[13] *= lengthUnit;
        placement[14] *= lengthUnit;

        placement[0] *= 1;
        placement[1] *= 1;
        placement[2] *= 1;
        placement[3] *= 1;
        placement[4] *= 1;
        placement[5] *= 1;
        placement[6] *= 1;
        placement[7] *= 1;
        placement[8] *= 1;
        placement[9] *= 1;
        placement[10] *= 1;
        placement[11] *= 1;

        placement[15] *= 1;
    }else {
        const identity:Matrix4 = Matrix4.IDENTITY;
        placement = Matrix4.toArray(identity);
    }
    return placement;
}
function getTranslation(sitePlacementStr) {
    const sitePlacement = getMatrix4FromPlacement(sitePlacementStr);
    const mat4 = Matrix4.fromColumnMajorArray(sitePlacement);
    const translation = Matrix4.getTranslation(mat4,new Cartesian3());
    return translation;
}
