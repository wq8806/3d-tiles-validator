import {JSONPath} from 'jsonpath-plus';

export function onganizeByI3DM(gltfMap,xmlJson) {
    const IfcTypeMap:Map<string,Array<string>> = new Map();
    for (const [key, value] of gltfMap) {
        const keyArr = key.split('--');
        //const typeMapKeys = [...IfcTypeMap.keys()];  // 获取Map中keys数组
        if(IfcTypeMap.has(keyArr[1])){
            const typeArr = IfcTypeMap.get(keyArr[1]);
            typeArr.push(keyArr[0]);
        }else {
            IfcTypeMap.set(keyArr[1],keyArr[0]);
        }
    }
    const IfcTypeJsonMaterial = new Map();
    for (const [key, value] of IfcTypeMap){

    }
}
