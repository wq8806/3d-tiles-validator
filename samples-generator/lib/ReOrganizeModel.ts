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

const path = require('path');
const gltfConversionOptions = { resourceDirectory: path.join(__dirname, '../') };
import { getGltfFromGlbUri } from "./gltfFromUri";
import {Mesh} from "./Mesh";

export class  ReOrganizeModel {
    inputDirectory: string = "";
    gltfMap: Map<string,any>;

    constructor(inputDirectory:string,gltfMap:Map<string,any>) {
        this.inputDirectory = inputDirectory;
        this.gltfMap = gltfMap;
    }

    static async organizeI3dm(inputDirectory:string,gltfMap:Map<string,any>){
        const sameMesh_Map: Map<MeshKey,string[]> = new Map<MeshKey, string[]>();
        try {
            for (const [key,value] of gltfMap){
                const glbPath = inputDirectory + key;
                let gltf = await getGltfFromGlbUri(glbPath, gltfConversionOptions);
                const mesh = Mesh.fromGltf(gltf);
                const keyArr = key.split('--');
                const ifcType = keyArr[1];

                const obb = computeOBBSize(mesh,value.objectPlacement);
                // const aabb = computeAABBSize(value.objectPlacement,value.minXYZ,value.maxXYZ);
                const meshKey = new MeshKey(mesh,ifcType,obb);
                const existKey = contains(sameMesh_Map,meshKey);
                if(existKey !== null){
                    sameMesh_Map.get(existKey).push(key);
                }else {
                    sameMesh_Map.set(meshKey,[key]);
                }
            }
        }catch (e) {
            console.error(e);
        }

        debugger
        const b3dmMap = new Map();
        let test = [];
        for(const [key,value] of sameMesh_Map){
            if(value.length === 1){
                b3dmMap.set(value[0],gltfMap.get(value[0]));
                sameMesh_Map.delete(key);
            }
        }
        for (const [key,value] of sameMesh_Map){
            test = test.concat(value);
        }
        debugger
        return {
            i3dm:sameMesh_Map,
            b3dm:b3dmMap
        };
    }

}

class MeshKey {
    mesh:Mesh;
    ifcType: string;
    obbSize: number[];

    constructor(mesh,ifcType,obbSize) {
        this.mesh = mesh;
        this.ifcType = ifcType;
        this.obbSize = obbSize;
    }

    static equals(key1:MeshKey,key2:MeshKey){
        if (Mesh.isSameI3dm(key1.mesh, key2.mesh) &&
            key1.ifcType === key2.ifcType &&
            key1.obbSize.indexOf(key2.obbSize[0]) >= 0 &&
            key1.obbSize.indexOf(key2.obbSize[1]) >= 0 &&
            key1.obbSize.indexOf(key2.obbSize[2]) >= 0) {
            return true;
        }
        return false;
    }
}

function contains(map,meshKey:MeshKey) {
    const keyArr = [...map.keys()];
    for (let i = 0; i < keyArr.length; i++) {
        const temp = keyArr[i];
        if(MeshKey.equals(temp,meshKey)){
            return temp;
        }
    }
    return null;
}

function computeOBBSize(mesh,placementArray) {
    try {
        const mat4 = Matrix4.fromColumnMajorArray(placementArray);
        const mat4_inverse = Matrix4.inverseTransformation(mat4,new Matrix4());
        mesh.transform(mat4_inverse);
        const positions = mesh.positions;
        const xArr = [];
        const yArr = [];
        const zArr = [];
        for (let i = 0; i < positions.length; i+=3) {
            xArr.push(positions[i]);
            yArr.push(positions[i+1]);
            zArr.push(positions[i+2]);
        }
        //Math.min.apply 采用递归的形式计算，遇到大数组的时候例如172226长度的数组，报Maximum call stack size exceeded错误
        const minXYZ = [getMinMax(xArr).min,getMinMax(yArr).min,getMinMax(zArr).min];
        const maxXYZ = [getMinMax(xArr).max,getMinMax(yArr).max,getMinMax(zArr).max];
        //该minXYZ、 maxXYZ是物体朝向中的最小，最大，经过placement Matrix4变换后 在cesium中加载验证是正确的  Matrix4.multiplyByPoint(matrix4,maxXYZ,new Cartesian3());
        //3dtile中 obb可以使用 Cesium.OrientedBoundingBox.fromPoints([transMinXYZ,transMaxXYZ])
        let xSize = maxXYZ[0] - minXYZ[0];
        let ySize = maxXYZ[1] - minXYZ[1];
        let zSize = maxXYZ[2] - minXYZ[2];
        xSize = Math.round(xSize * 100) / 100;
        ySize = Math.round(ySize * 100) / 100;
        zSize = Math.round(zSize * 100) / 100;
        return [xSize,ySize,zSize];
    }catch (e) {
        console.error(e);
    }
}

function getMinMax(arr) {
    //性能更好，效率更快
    let len = arr.length;
    let max = -Number.MAX_VALUE;
    let min = Number.MAX_VALUE;

    while (len--) {
        max = arr[len] > max ? arr[len] : max;
        min = arr[len] < min ? arr[len] : min;
    }
    return {max: max, min: min};
}

function minMax2DArray(arr) {
    let max = -Number.MAX_VALUE;
    let min = Number.MAX_VALUE;
    arr.forEach(function(e) {
        if (max < e) {
            max = e;
        }
        if (min > e) {
            min = e;
        }
    });
    return {max: max, min: min};
}

function computeAABBSize(placementArray,minXYZ,maxXYZ) {
    /*const mat4 = Matrix4.fromColumnMajorArray(placementArray);
    const mat3 = Matrix4.getMatrix3(mat4,new Matrix3());
    const rotation = Matrix3.getRotation(mat3,mat3);
    const rotation_inverse = Matrix3.inverse(rotation,new Matrix3());*/

    let min_XYZ = new Cartesian3(minXYZ[0],minXYZ[1],minXYZ[2]);
    let max_XYZ = new Cartesian3(maxXYZ[0],maxXYZ[1],maxXYZ[2]);

    let size = Cartesian3.subtract(max_XYZ,min_XYZ,new Cartesian3());
    size = Cartesian3.abs(size,size);

    const xSize = Math.round(size.x * 100) / 100;
    const ySize = Math.round(size.y * 100) / 100;
    const zSize = Math.round(size.z * 100) / 100;
    console.log(xSize + "--" + ySize + "--" + zSize);
    return [xSize,ySize,zSize];
}

/*export function onganizeByI3DM(gltfMap,xmlJson) {
    const IfcTypeMap:Map<string,Array<string>> = new Map();
    try{
        //按材质组织不合理，ifc中链接的材质相同，链接Id不同，按gltf的材质来组织
        //判断是否为相同模型，以模型材质，材质对应的顶点数,模型OBB，IfcType
        for (const [key, value] of gltfMap) {
            const keyArr = key.split('--');
            //const typeMapKeys = [...IfcTypeMap.keys()];  // 获取Map中keys数组
            const type_materialKey = keyArr[1] + value.material;
            if(IfcTypeMap.has(type_materialKey)){
                const typeArr = IfcTypeMap.get(type_materialKey);
                typeArr.push(key);
            }else {
                IfcTypeMap.set(type_materialKey,[key]);
            }
        }
        debugger
    }catch (e) {
        console.error(e);
    }
}*/
