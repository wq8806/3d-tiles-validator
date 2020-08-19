import { Material } from './Material';
import { MeshView } from './meshView';
import { bufferToUint16Array,bufferToUint32Array, bufferToFloat32Array } from './bufferUtil';
import { Gltf } from './gltfType';
const Cesium = require('cesium');
const util = require('./utility');

const Cartesian3 = Cesium.Cartesian3;
const ComponentDatatype = Cesium.ComponentDatatype;
const defined = Cesium.defined;
const Matrix4 = Cesium.Matrix4;

const typeToNumberOfComponents = util.typeToNumberOfComponents;

const sizeOfUint16 = 2;     //sizeOf datatype in bytes
const sizeOfUint32 = 4;
const sizeOfFloat32 = 4;

const whiteOpaqueMaterial = new Material([1.0, 1.0, 1.0, 1.0]);

export class Mesh {
    private readonly scratchCartesian = new Cartesian3();
    private readonly scratchMatrix = new Matrix4();

    indices: number[];
    positions: number[];
    normals: number[];
    uvs: number[];
    vertexColors: number[];
    batchIds?: number[];
    material?: Material;
    views?: MeshView[];
    hasUint32indeces?:boolean;

    /**
     * Stores the vertex attributes and indices describing a mesh.
     *
     * @param {Object} options Object with the following properties:
     * @param {Number[]} options.indices An array of integers representing the
     * mesh indices.
     * @param {Number[]} options.positions A packed array of floats representing
     * the mesh positions.
     * @param {Number[]} options.normals A packed array of floats representing
     * the mesh normals.
     * @param {Number[]} options.uvs A packed array of floats representing the
     * mesh UVs.
     * @param {Number[]} options.vertexColors A packed array of integers
     * representing the vertex colors.
     * @param {Number[]} [options.batchIds] An array of integers representing
     * the batch ids.
     * @param {Material} [options.material] A material to apply to the mesh.
     * @param {MeshView[]} [options.views] An array of MeshViews.
     *
     * @constructor
     */
    private constructor(
        indices: number[],
        positions: number[],
        normals: number[],
        uvs: number[],
        vertexColors: number[],
        batchIds?: number[],
        material?: Material,
        views?: MeshView[],
        hasUint32indeces?: boolean
    ) {
        this.indices = indices;
        this.positions = positions;
        this.normals = normals;
        this.uvs = uvs;
        this.vertexColors = vertexColors;
        this.batchIds = batchIds;
        this.material = material;
        this.views = views;
        this.hasUint32indeces = hasUint32indeces === undefined ? false : hasUint32indeces;
    }

    /**
     * Transform the mesh with the provided transform.
     *
     * @param {Matrix4} transform The transform.
     */
    transform(transform: object) {
        let i;
        const positions = this.positions;
        const normals = this.normals;
        const vertexCount = this.vertexCount;

        // Transform positions
        for (i = 0; i < vertexCount; ++i) {
            const position = Cartesian3.unpack(
                positions,
                i * 3,
                this.scratchCartesian
            );
            Matrix4.multiplyByPoint(transform, position, position);
            Cartesian3.pack(position, positions, i * 3);
        }

        const inverseTranspose = this.scratchMatrix;
        Matrix4.transpose(transform, inverseTranspose);
        Matrix4.inverse(inverseTranspose, inverseTranspose);

        // Transform normals
        for (i = 0; i < vertexCount; ++i) {
            const normal = Cartesian3.unpack(
                normals,
                i * 3,
                this.scratchCartesian
            );
            Matrix4.multiplyByPointAsVector(inverseTranspose, normal, normal);
            Cartesian3.normalize(normal, normal);
            Cartesian3.pack(normal, normals, i * 3);
        }
    }

    /**
     * Set the positions relative to center.
     */
    setPositionsRelativeToCenter() {
        const positions = this.positions;
        const center = this.center;
        const vertexCount = this.vertexCount;
        for (let i = 0; i < vertexCount; ++i) {
            const position = Cartesian3.unpack(
                positions,
                i * 3,
                this.scratchCartesian
            );
            Cartesian3.subtract(position, center, position);
            Cartesian3.pack(position, positions, i * 3);
        }
    }

    /**
     * Get the number of vertices in the mesh.
     *
     * @returns {Number} The number of vertices.
     */
    get vertexCount(): number {
        return this.positions.length / 3;
    }

    /**
     * Get the center of the mesh.
     *
     * @returns {Cartesian3} The center position
     */
    get center() {
        const center = new Cartesian3();
        const positions = this.positions;
        const vertexCount = this.vertexCount;
        for (let i = 0; i < vertexCount; ++i) {
            const position = Cartesian3.unpack(
                positions,
                i * 3,
                this.scratchCartesian
            );
            Cartesian3.add(position, center, center);
        }
        Cartesian3.divideByScalar(center, vertexCount, center);
        return center;
    }

    /**
     * Bake materials as vertex colors. Use the default white opaque material.
     */
    transferMaterialToVertexColors0() {
        const material = this.material;
        this.material = whiteOpaqueMaterial;
        const vertexCount = this.vertexCount;
        const vertexColors = new Array(vertexCount * 4);
        this.vertexColors = vertexColors;
        for (let i = 0; i < vertexCount; ++i) {
            vertexColors[i * 4 + 0] = Math.floor(material.baseColor[0] * 255);
            vertexColors[i * 4 + 1] = Math.floor(material.baseColor[1] * 255);
            vertexColors[i * 4 + 2] = Math.floor(material.baseColor[2] * 255);
            vertexColors[i * 4 + 3] = Math.floor(material.baseColor[3] * 255);
        }
    }

    transferMaterialToVertexColors() {
        const material = this.material;
        this.material = whiteOpaqueMaterial;
        const vertexCount = this.vertexCount;
        const vertexColors = new Array(vertexCount * 4);
        this.vertexColors = vertexColors;
        for (let i = 0; i < vertexCount; ++i) {
            vertexColors[i * 4 + 0] = Math.floor(material.baseColor[0] * 255);
            vertexColors[i * 4 + 1] = Math.floor(material.baseColor[1] * 255);
            vertexColors[i * 4 + 2] = Math.floor(material.baseColor[2] * 255);
            vertexColors[i * 4 + 3] = Math.floor(material.baseColor[3] * 255);
        }
    }

    /**
     * Batch multiple meshes into a single mesh. Assumes the input meshes do
     * not already have batch ids.
     *
     * @param {Mesh[]} meshes The meshes that will be batched together.
     * @returns {Mesh} The batched mesh.
     */
    static batch(meshes: Mesh[]) {
        let batchedPositions = [];
        let batchedNormals = [];
        let batchedUvs = [];
        let batchedVertexColors = [];
        let batchedBatchIds = [];
        let batchedIndices = [];

        let batchedHasUint32indeces = false;
        let startIndex = 0;
        let indexOffset = 0;
        const views = [];
        let batchedIndices11 = [];
        let currentView;
        const meshesLength = meshes.length;
        for (let i = 0; i < meshesLength; ++i) {
            const mesh = meshes[i];
            if(mesh.hasUint32indeces){
                batchedHasUint32indeces = true;
            }
            const positions = mesh.positions;
            const normals = mesh.normals;
            const uvs = mesh.uvs;
            const vertexColors = mesh.vertexColors;
            const vertexCount = mesh.vertexCount;

            // Generate batch ids for this mesh
            const batchIds = new Array(vertexCount).fill(i);

            batchedPositions = batchedPositions.concat(positions);
            batchedNormals = batchedNormals.concat(normals);
            batchedUvs = batchedUvs.concat(uvs);
            batchedVertexColors = batchedVertexColors.concat(vertexColors);
            batchedBatchIds = batchedBatchIds.concat(batchIds);

            // Generate indices and mesh views
            const indices = mesh.indices;
            const indicesLength = indices.length;

            /*if (
                !defined(currentView) ||
                currentView.material !== mesh.material
            ) {
                currentView = new MeshView(
                    mesh.material,
                    indexOffset,
                    indicesLength
                );
                views.push(currentView);
            } else {
                currentView.indexCount += indicesLength;
            }*/

            for (let j = 0; j < indicesLength; ++j) {
                const index = indices[j] + startIndex;
                if(index > 65535){
                    batchedHasUint32indeces = true;
                }
                batchedIndices.push(index);
            }

            for (let j = 0; j < mesh.views.length; ++j) {
                if(i === meshesLength - 1){
                    // debugger;
                }

                /*if(!defined(currentView) || !findSameMaterial(currentView,mesh.views)){
                    currentView = new MeshView({
                        material : mesh.views[j].material,
                        indexOffset : mesh.views[j].indexOffset + indexOffset,
                        indexCount : mesh.views[j].indexCount
                    })
                    views.push(currentView);
                }else {
                    currentView.indexCount += mesh.views[j].indexCount;
                }*/

                /*mesh.views[j].indexOffset += indexOffset;
                views.push(mesh.views[j]);*/
                try {
                    var sameInViews = getSameMaterial(views,mesh.views[j]);

                    if(sameInViews === null){
                        mesh.views[j].indexOffset += indexOffset;
                        var tempIndices = batchedIndices.slice(mesh.views[j].indexOffset,mesh.views[j].indexOffset + mesh.views[j].indexCount);
                        if(views.length > 0 && !!views[views.length -1]){
                            mesh.views[j].indexOffset = views[views.length - 1].indexOffset + views[views.length - 1].indexCount;
                        }
                        views.push(mesh.views[j]);
                        /*tempIndices.forEach(function (value, index, array) {
                            batchedIndices11.splice(mesh.views[j].indexOffset,0,tempIndices);
                        })*/
                        batchedIndices11 = batchedIndices11.concat(tempIndices);
                    }else {
                        mesh.views[j].indexOffset += indexOffset;
                        var tempIndices = batchedIndices.slice(mesh.views[j].indexOffset,mesh.views[j].indexOffset + mesh.views[j].indexCount);

                        var viewIndex = views.indexOf(sameInViews);
                        if(viewIndex > 0){
                            //sameInViews.indexOffset = views[viewIndex-1].indexOffset + views[viewIndex-1].indexCount;
                            tempIndices.forEach(function (value, index, array) {
                                batchedIndices11.splice(sameInViews.indexOffset + sameInViews.indexCount + index,0,value);
                            })
                            /*for (let k = 0; k < tempIndices.length; k++) {
                                batchedIndices11.splice(sameInViews.indexOffset + sameInViews.indexCount + k,0,tempIndices[k]);
                            }*/
                            sameInViews.indexCount = sameInViews.indexCount + mesh.views[j].indexCount;
                            /*if(!!views[viewIndex + 1]){
                                views[viewIndex + 1].indexOffset = sameInViews.indexOffset + sameInViews.indexCount;
                                // views[viewIndex + 1].indexOffset = views[viewIndex + 1].indexOffset + mesh.views[j].indexCount;
                            }*/
                            for (let k = 1; viewIndex + k < views.length; k++) {     //后续的viewoffset都需要改变
                                views[viewIndex + k].indexOffset = views[viewIndex + k -1].indexOffset + views[viewIndex + k -1].indexCount;
                            }
                        }else {
                            if(!!views[viewIndex -1]){
                                //sameInViews.indexOffset = views[viewIndex-1].indexOffset + views[viewIndex-1].indexCount;
                            }
                            tempIndices.forEach(function (value, index, array) {
                                batchedIndices11.splice(sameInViews.indexOffset + sameInViews.indexCount + index,0,value);
                            })
                            sameInViews.indexCount = sameInViews.indexCount + mesh.views[j].indexCount;
                            for (let k = 1; viewIndex + k < views.length; k++) {
                                views[viewIndex + k].indexOffset = views[viewIndex + k -1].indexOffset + views[viewIndex + k -1].indexCount;
                            }
                        }
                        // sameInViews.indexCount = sameInViews.indexCount + mesh.views[j].indexCount;

                    }
                }catch (e) {
                    console.error(e);
                    console.log(views);
                    console.log(i);
                }

            }
            startIndex += vertexCount;
            indexOffset += indicesLength;
        }

        return new Mesh(
            batchedIndices11,    //使用调整后的索引数组，否则材质会出现错乱
            batchedPositions,
            batchedNormals,
            batchedUvs,
            batchedVertexColors,
            batchedBatchIds,
            undefined,
            views,
            batchedHasUint32indeces
        );
    }

    /**
     * Clone the mesh geometry and create a new mesh.
     * Assumes the input mesh does not already have batch ids.
     *
     * @param {Mesh} mesh The mesh to clone.
     * @returns {Mesh} The cloned mesh.
     */
    static clone(mesh: Mesh) {
        return new Mesh(
            mesh.indices.slice(),
            mesh.positions.slice(),
            mesh.normals.slice(),
            mesh.uvs.slice(),
            mesh.vertexColors.slice(),
            mesh.batchIds.slice(),   //batchid的复制
            mesh.material,
            mesh.views.slice(),    //数组的复制
            mesh.hasUint32indeces
        );
    }

    /**
     * Creates a cube mesh.
     *
     * @returns {Mesh} A cube mesh.
     */

    static createCube(): Mesh {
        // prettier-ignore
        const indices = [0, 1, 2, 0, 2, 3, 6, 5, 4, 7, 6, 4, 8, 9, 10, 8, 10,
            11, 14, 13, 12, 15, 14, 12, 18, 17, 16, 19, 18, 16, 20, 21, 22, 20,
            22, 23];
        // prettier-ignore
        const positions = [-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
            0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
            0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5,
            -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
            -0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
            0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
             0.5];
        // prettier-ignore
        const normals = [0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
            1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
            1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, -1.0,
            0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, 0.0, 1.0,
            0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, -1.0, 0.0,
            0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0];
        // prettier-ignore
        const uvs = [0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
            1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0,
            1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0];
        // prettier-ignore
        const vertexColors = new Array(24 * 4).fill(0);
        return new Mesh(indices, positions, normals, uvs, vertexColors);
    }

    /**
     * Creates a mesh from a glTF. This utility is designed only for simple
     * glTFs like those in the data folder.
     *
     * @param {Object} gltf The glTF.
     * @returns {Mesh} The mesh.
     */
    static fromGltf(gltf: Gltf, useVertexColor:boolean = false): Mesh {
        /*const gltfPrimitive = gltf.meshes[0].primitives[0];
        const gltfMaterial = gltf.materials[gltfPrimitive.material];
        const material = Material.fromGltf(gltfMaterial);
        const indices = getAccessor(gltf, gltf.accessors[gltfPrimitive.indices]);
        const positions = getAccessor(
            gltf,
            gltf.accessors[gltfPrimitive.attributes.POSITION]
        );
        const normals = getAccessor(
            gltf,
            gltf.accessors[gltfPrimitive.attributes.NORMAL]
        );
        const uvs = new Array((positions.length / 3) * 2).fill(0);
        const vertexColors = new Array((positions.length / 3) * 4).fill(0);
        return new Mesh(
            indices,
            positions,
            normals,
            uvs,
            vertexColors,
            undefined,
            material
        );*/
        const gltfPrimitiveArray = gltf.meshes[0].primitives;
        let gltfPositions = [];
        let gltfNormals = [];
        let gltfUvs = [];
        let gltfVertexColors = [];
        let batchedBatchIds = [];
        let gltfIndices = [];
        let gltfHasUint32indeces = false;

        let startIndex = 0;
        let indexOffset = 0;
        let views:MeshView[] = [];
        let currentView;
        const primitivesLength = gltfPrimitiveArray.length;
        for (var i = 0; i < primitivesLength; ++i) {
            var primitive = gltfPrimitiveArray[i];        //部分缺失
            var primitiveMaterial = gltf.materials[primitive.material];
            var material = Material.fromGltf(primitiveMaterial);
            var indicesAccessor = gltf.accessors[primitive.indices];
            var indices = getAccessor(gltf, indicesAccessor);
            if (indicesAccessor.componentType === ComponentDatatype.UNSIGNED_INT){
                gltfHasUint32indeces = true;
            }
            var positions = getAccessor(gltf, gltf.accessors[primitive.attributes.POSITION]);
            var normals = getAccessor(gltf, gltf.accessors[primitive.attributes.NORMAL]);
            var uvs = new Array(positions.length / 3 * 2).fill(0);
            var vertexColors = new Array(positions.length / 3 * 4).fill(0);

            const vertexCount = positions.length / 3;
            if(useVertexColor){
                for (let i = 0; i < vertexCount; ++i) {
                    vertexColors[i * 4 + 0] = Math.floor(material.baseColor[0] * 255);
                    vertexColors[i * 4 + 1] = Math.floor(material.baseColor[1] * 255);
                    vertexColors[i * 4 + 2] = Math.floor(material.baseColor[2] * 255);
                    vertexColors[i * 4 + 3] = Math.floor(material.baseColor[3] * 255);
                }
            }

            // var vertexCount = positions.length / 3;
            var batchIds = new Array(vertexCount).fill(i);

            gltfPositions = gltfPositions.concat(positions);
            gltfNormals = gltfNormals.concat(normals);
            gltfUvs = gltfUvs.concat(uvs);
            gltfVertexColors = gltfVertexColors.concat(vertexColors);

            // Generate indices and mesh views
            //var indices = mesh.indices;
            var indicesLength = indices.length;

            if(!useVertexColor){
                if (!defined(currentView) || (currentView.material !== material)) {
                    currentView = new MeshView(
                        material,
                        indexOffset,
                        indicesLength
                    );
                    views.push(currentView);
                } else {
                    currentView.indexCount += indicesLength;
                }
            }

            for (var j = 0; j < indicesLength; ++j) {
                var index = indices[j] + startIndex;
                if(index > 65535){
                    gltfHasUint32indeces = true;
                }
                gltfIndices.push(index);
            }
            startIndex += vertexCount;
            indexOffset += indicesLength;
        }

        if(useVertexColor){
            const meshView = new MeshView(
                whiteOpaqueMaterial,
                0,
                gltfIndices.length
            );
            views.push(meshView);
        }
        return new Mesh(
            gltfIndices,
            gltfPositions,
            gltfNormals,
            gltfUvs,
            gltfVertexColors,
            batchedBatchIds,
            undefined,
            views,
            gltfHasUint32indeces
        );
    };
}

function getAccessor(gltf, accessor) {
    const bufferView = gltf.bufferViews[accessor.bufferView];
    const buffer = gltf.buffers[bufferView.buffer];
    const byteOffset = accessor.byteOffset + bufferView.byteOffset;
    const length = accessor.count * typeToNumberOfComponents(accessor.type);
    const uriHeader = 'data:application/octet-stream;base64,';
    const base64 = buffer.uri.substring(uriHeader.length);
    const data = Buffer.from(base64, 'base64');
    let typedArray;
    if (accessor.componentType === ComponentDatatype.UNSIGNED_SHORT) {
        typedArray = bufferToUint16Array(data, byteOffset, length);
    } else if (accessor.componentType === ComponentDatatype.FLOAT) {
        typedArray = bufferToFloat32Array(data, byteOffset, length);
    } else if (accessor.componentType === ComponentDatatype.UNSIGNED_INT){   //较少出现，顶点索引 > 65536时
        this
        typedArray = bufferToUint32Array(data, byteOffset, length);
    }
    return Array.prototype.slice.call(typedArray);
}

function findSameMaterial(view,views){
    for (let i = 0; i < views.length; i++) {
        if(views[i].material.baseColor[0] === view.material.baseColor[0] &&
            views[i].material.baseColor[1] === view.material.baseColor[1] &&
            views[i].material.baseColor[2] === view.material.baseColor[2] &&
            views[i].material.baseColor[3] === view.material.baseColor[3]){
            return true;
        }
    }
    return false;
}

function getSameMaterial(views,view) {
    for (let i = 0; i < views.length; i++) {
        if(views[i].material.baseColor[0] === view.material.baseColor[0] &&
            views[i].material.baseColor[1] === view.material.baseColor[1] &&
            views[i].material.baseColor[2] === view.material.baseColor[2] &&
            views[i].material.baseColor[3] === view.material.baseColor[3]){
            return views[i];
        }
    }
    return null;
}
function isSameMaterialView(view1,view2){

    if(view1.material.baseColor[0] === view2.material.baseColor[0] &&
        view1.material.baseColor[1] === view2.material.baseColor[1] &&
        view1.material.baseColor[2] === view2.material.baseColor[2] &&
        view1.material.baseColor[3] === view2.material.baseColor[3]){
        return true;
    }

    return false;
}
