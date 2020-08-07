
import { Promise as Bluebird } from 'bluebird';
var fsExtra = require('fs-extra');
var fastXmlParser = require('fast-xml-parser');

export function readXml(options) {
    const derrered = Bluebird.defer();
    var directoryPath = options.directoryPath;
    try {
        fsExtra.readFile(directoryPath +'property.xml','utf-8',function(err,result){
            if(err){
                console.error(err);
            }else {
                var options = {
                    attributeNamePrefix : "@_",
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
                    var myMap = traverseJson(jsonObj.ifc.decomposition,undefined);
                    derrered.resolve(myMap);
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

            if(obj[key].hasOwnProperty("attr") && obj[key]['attr'].hasOwnProperty("@_minXYZ")){
                var minXYZStr = obj[key]['attr']['@_minXYZ'];
                var maxSYXStr = obj[key]['attr']['@_maxXYZ'];

                map.set(obj[key]['attr']['@_id'] + "--" + key +".glb",computeAABB(minXYZStr,maxSYXStr));
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

class Cartesian3 {
    x:number = 0;
    y:number = 0;
    z:number = 0;
};

export class Bounds {
    center: Cartesian3 = new Cartesian3();
    dimensions: Cartesian3 = new Cartesian3();
    minXYZ: number[] = [];
    maxXYZ: number[] = [];
}

function computeAABB(minXYZStr,maxXYZStr) {
    let bounds:Bounds = new Bounds();
    var minXYZ = minXYZStr.split(' ');
    var maxXYZ = maxXYZStr.split(' ');
    for (let i = 0; i < 3; i++) {
        minXYZ[i] = Number(minXYZ[i]);
        maxXYZ[i] = Number(maxXYZ[i]);
    }
    let center:Cartesian3 = new Cartesian3();
    center.x = (minXYZ[0] + maxXYZ[0]) / 2;    //Ifc中轴向与gltf有差异
    center.y = (minXYZ[2] + maxXYZ[2]) / 2;
    center.z = 0 - (minXYZ[1] + maxXYZ[1]) / 2;
    // center.z = (minXYZ[1] + maxXYZ[1]) / 2;

    let dimensions:Cartesian3 = new Cartesian3();
    dimensions.x = maxXYZ[0] - minXYZ[0];
    dimensions.y = maxXYZ[2] - minXYZ[2];
    dimensions.z = maxXYZ[1] - minXYZ[1];

    bounds.center = center;
    bounds.dimensions = dimensions;
    /*bounds.minXYZ = minXYZ;
    bounds.maxXYZ = maxXYZ;*/
    bounds.minXYZ = [center.x - dimensions.x / 2 ,center.y - dimensions.y / 2, center.z - dimensions.z/2];
    bounds.maxXYZ = [center.x + dimensions.x / 2 ,center.y + dimensions.y/2, center.z + dimensions.z/2];
    return bounds;
}
