'use strict';
var Cesium = require('cesium');
var getBufferPadded = require('./getBufferPadded');
var path = require('path');
var defaultValue = Cesium.defaultValue;
var defined = Cesium.defined;
var getMinMax = require('./getMinMax');

var gltfPipeline = require('gltf-pipeline');
var gltfToGlb = gltfPipeline.gltfToGlb;

module.exports = createGltf;

var rootDirectory = path.join(__dirname, '../');

var sizeOfUint8 = 1;
var sizeOfUint16 = 2;
var sizeOfUint32 = 4;
var sizeOfFloat32 = 4;

/**
 * Create a glTF from a Mesh.
 *
 * @param {Object} options An object with the following properties:
 * @param {Mesh} options.mesh The mesh.
 * @param {Boolean} [options.useBatchIds=true] Modify the glTF to include the batchId vertex attribute.
 * @param {Boolean} [options.relativeToCenter=false] Set mesh positions relative to center.
 * @param {Boolean} [options.deprecated=false] Save the glTF with the old BATCHID semantic.
 * @param {Boolean} [options.use3dTilesNext=false] Modify the GLTF to name batch ids with a numerical suffix
 * @param {Boolean} [options.animated=false] Whether to include glTF animations.
 * @param {Boolean} [options.compressDracoMeshes] use compressDraco or not
 * @param {string} [options.resourcePath] resourcePath.
 * @todo options.use3dTilesNext will be deprecated soon, all 3dtilesnext logic
 *       will go into a dedicated class.
 *
 * @returns {Object} A glTF object
 */

function createGltf(options) {
    var use3dTilesNext = defaultValue(options.use3dTilesNext, false);
    var useBatchIds = defaultValue(options.useBatchIds, true);
    var relativeToCenter = defaultValue(options.relativeToCenter, false);
    var deprecated = defaultValue(options.deprecated, false);
    var compressDracoMeshes = defaultValue(options.compressDracoMeshes,false);
    var animated = defaultValue(options.animated, false);
    const resourcePath = defaultValue(options.resourcePath,'');

    var mesh = options.mesh;
    var positions = mesh.positions;
    var normals = mesh.normals;
    var uvs = mesh.uvs;
    var vertexColors = mesh.vertexColors;
    var batchIds = mesh.batchIds;
    var indices = mesh.indices;
    var views = mesh.views;
    var hasUint32indeces = mesh.hasUint32indeces;

    // If all the vertex colors are 0 then the mesh does not have vertex colors
    var useVertexColors = !vertexColors.every(function(element) {return element === 0;});

    if (relativeToCenter) {
        mesh.setPositionsRelativeToCenter();
    }

    // Models are z-up, so add a z-up to y-up transform.
    // The glTF spec defines the y-axis as up, so this is the default behavior.
    // In CesiumJS a y-up to z-up transform is applied later so that the glTF and 3D Tiles coordinate systems are consistent
    var rootMatrix = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];

    var i;
    var j;
    var view;
    var material;
    var viewsLength = views.length;
    var useUvs = false;
    for (i = 0; i < viewsLength; ++i) {
        view = views[i];
        material = view.material;
        if (typeof material.baseColor === 'string') {
            useUvs = true;
            break;
        }
    }

    var positionsMinMax = getMinMax(positions, 3);
    var positionsLength = positions.length;
    var positionsBuffer = Buffer.alloc(positionsLength * sizeOfFloat32);
    for (i = 0; i < positionsLength; ++i) {
        positionsBuffer.writeFloatLE(positions[i], i * sizeOfFloat32);
    }

    var normalsMinMax = getMinMax(normals, 3);
    var normalsLength = normals.length;
    var normalsBuffer = Buffer.alloc(normalsLength * sizeOfFloat32);
    for (i = 0; i < normalsLength; ++i) {
        normalsBuffer.writeFloatLE(normals[i], i * sizeOfFloat32);
    }

    var uvsMinMax;
    var uvsBuffer = Buffer.alloc(0);
    if (useUvs) {
        uvsMinMax = getMinMax(uvs, 2);
        var uvsLength = uvs.length;
        uvsBuffer = Buffer.alloc(uvsLength * sizeOfFloat32);
        for (i = 0; i < uvsLength; ++i) {
            uvsBuffer.writeFloatLE(uvs[i], i * sizeOfFloat32);
        }
    }

    var vertexColorsMinMax;
    var vertexColorsBuffer = Buffer.alloc(0);
    if (useVertexColors) {
        vertexColorsMinMax = getMinMax(vertexColors, 4);
        var vertexColorsLength = vertexColors.length;
        vertexColorsBuffer = Buffer.alloc(vertexColorsLength * sizeOfFloat32);
        for (i = 0; i < vertexColorsLength; ++i) {
            vertexColorsBuffer.writeFloatLE(vertexColors[i], i * sizeOfFloat32);
        }
    }

    var batchIdsMinMax;
    var batchIdsBuffer = Buffer.alloc(0);
    var batchIdSemantic;
    batchIdSemantic = deprecated ? 'BATCHID' : '_BATCHID';
    batchIdSemantic = use3dTilesNext ? '_FEATURE_ID_0' : batchIdSemantic;

    var batchIdsLength;
    if (useBatchIds) {
        batchIdsMinMax = getMinMax(batchIds, 1);
        batchIdsLength = batchIds.length;
        batchIdsBuffer = Buffer.alloc(batchIdsLength * sizeOfFloat32);
        for (i = 0; i < batchIdsLength; ++i) {
            batchIdsBuffer.writeFloatLE(batchIds[i], i * sizeOfFloat32);
        }
    }

    var indicesLength = indices.length;
    var indexBuffer;
    if(!hasUint32indeces){
        indexBuffer = Buffer.alloc(indicesLength * sizeOfUint16);
        for (i = 0; i < indicesLength; ++i) {
            //try {
            indexBuffer.writeUInt16LE(indices[i], i * sizeOfUint16);   // writeUInt16LE 最大值为65535，很容易超限
            //}catch (e) {
            //console.error(e);
            //console.log(indices[i]);
            //}
        }
    }else{
        indexBuffer = Buffer.alloc(indicesLength * sizeOfUint32);
        for (i = 0; i < indicesLength; ++i) {
            indexBuffer.writeUInt32LE(indices[i], i * sizeOfUint32);
        }
    }
    /*var indexBuffer = Buffer.alloc(indicesLength * sizeOfUint16);
    for (i = 0; i < indicesLength; ++i) {
        indexBuffer.writeUInt16LE(indices[i], i * sizeOfUint16);
    }
    indexBuffer = getBufferPadded(indexBuffer);*/

    var translations = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 0.0, 0.0]
    ];
    var times = [0.0, 0.5, 1.0];
    var keyframesLength = translations.length;

    var animationBuffer = Buffer.alloc(0);
    var translationsBuffer = Buffer.alloc(0);
    var timesBuffer = Buffer.alloc(0);

    if (animated) {
        translationsBuffer = Buffer.alloc(keyframesLength * 3 * sizeOfFloat32);
        timesBuffer = Buffer.alloc(keyframesLength * sizeOfFloat32);

        for (i = 0; i < keyframesLength; ++i) {
            for (j = 0; j < 3; ++j) {
                var index = i * keyframesLength + j;
                translationsBuffer.writeFloatLE(translations[i][j], index * sizeOfFloat32);
            }
        }
        for (i = 0; i < keyframesLength; ++i) {
            timesBuffer.writeFloatLE(times[i], i * sizeOfFloat32);
        }

        animationBuffer = getBufferPadded(Buffer.concat([translationsBuffer, timesBuffer]));
    }

    var vertexCount = mesh.vertexCount;

    var vertexBuffer = getBufferPadded(Buffer.concat([positionsBuffer, normalsBuffer, uvsBuffer, vertexColorsBuffer, batchIdsBuffer]));
    var buffer = getBufferPadded(Buffer.concat([vertexBuffer, indexBuffer, animationBuffer]));
    var bufferUri = 'data:application/octet-stream;base64,' + buffer.toString('base64');
    var byteLength = buffer.byteLength;

    var indexAccessors = [];
    var materials = [];
    var primitives = [];

    var images;
    var samplers;
    var textures;

    var bufferViewIndex = 0;
    var positionsBufferViewIndex = bufferViewIndex++;
    var normalsBufferViewIndex = bufferViewIndex++;
    var uvsBufferViewIndex = (useUvs) ? bufferViewIndex++ : 0;
    var vertexColorsBufferViewIndex = (useVertexColors) ? bufferViewIndex++ : 0;
    var batchIdsBufferViewIndex = (useBatchIds) ? bufferViewIndex++ : 0;
    var indexBufferViewIndex = bufferViewIndex++;
    var translationsBufferViewIndex = (animated) ? bufferViewIndex++ : 0;
    var timesBufferViewIndex = (animated) ? bufferViewIndex++ : 0;

    var byteOffset = 0;
    var positionsBufferByteOffset = byteOffset;
    byteOffset += positionsBuffer.length;
    var normalsBufferByteOffset = byteOffset;
    byteOffset += normalsBuffer.length;
    var uvsBufferByteOffset = byteOffset;
    byteOffset += (useUvs) ? uvsBuffer.length : 0;
    var vertexColorsBufferByteOffset = byteOffset;
    byteOffset += (useVertexColors) ? vertexColorsBuffer.length : 0;
    var batchIdsBufferByteOffset = byteOffset;
    byteOffset += (useBatchIds) ? batchIdsBuffer.length : 0;

    // Start index buffer at the padded byte offset
    byteOffset = vertexBuffer.length;
    var indexBufferByteOffset = byteOffset;
    byteOffset += indexBuffer.length;

    // Start animation buffer at the padded byte offset
    var translationsByteOffset = vertexBuffer.length + indexBuffer.length;
    byteOffset += translationsBuffer.length;
    var timesByteOffset = byteOffset;
    byteOffset += timesByteOffset;

    for (i = 0; i < viewsLength; ++i) {
        view = views[i];
        material = view.material;
        var indicesMinMax = getMinMax(indices, 1, view.indexOffset, view.indexCount);
        //判断顶点索引是否用unit32来记录，只用unit16会造成索引丢失，模型几何形状错乱
        indexAccessors.push({
            bufferView : indexBufferViewIndex,
            byteOffset : hasUint32indeces ? sizeOfUint32 * view.indexOffset :  sizeOfUint16 * view.indexOffset,
            componentType : hasUint32indeces ? 5125 : 5123, // UNSIGNED_SHORT 5123 or UNSIGNED_INT 5125
            count : view.indexCount,
            type : 'SCALAR',
            min : indicesMinMax.min,
            max : indicesMinMax.max
        });

        var baseColor = material.baseColor;
        var baseColorFactor = baseColor;
        var baseColorTexture;
        var transparent = false;

        if (typeof baseColor === 'string') {
            if (!defined(images)) {
                images = [];
                textures = [];
                samplers = [{
                    magFilter : 9729, // LINEAR
                    minFilter : 9729, // LINEAR
                    wrapS : 10497, // REPEAT
                    wrapT : 10497 // REPEAT
                }];
            }
            baseColorFactor = [1.0, 1.0, 1.0, 1.0];
            baseColorTexture = baseColor;
            images.push({
                uri : baseColor
            });
            textures.push({
                sampler : 0,
                source : images.length - 1
            });
        } else {
            transparent = baseColor[3] < 1.0;
            //不要修改PromiseList返回的resolve的value，否则会使value属性混乱
            /*if(baseColor[3] < 1.0){
                baseColorFactor[3] = 1.0;
            }*/
        }

        var doubleSided = false;//(material.alphaMode === 'BLEND') ? true : false;//transparent;
        // var alphaMode = (transparent) ? 'BLEND' : 'OPAQUE';
        var alphaMode = material.alphaMode;

        material = {
            pbrMetallicRoughness : {
                baseColorFactor : baseColorFactor,
                roughnessFactor : 1.0,
                metallicFactor : 0.0
            },
            alphaMode : alphaMode,
            doubleSided : doubleSided
        };

        if (defined(baseColorTexture)) {
            material.pbrMetallicRoughness.baseColorTexture = {
                index : i//0
            };
        }

        materials.push(material);

        var attributes = {
            POSITION : positionsBufferViewIndex,
            NORMAL : normalsBufferViewIndex
        };

        if (useUvs) {
            attributes.TEXCOORD_0 = uvsBufferViewIndex;
        }

        if (useVertexColors) {
            attributes.COLOR_0 = vertexColorsBufferViewIndex;
        }

        if (useBatchIds) {
            attributes[batchIdSemantic] = batchIdsBufferViewIndex;
        }

        primitives.push({
            attributes : attributes,
            indices : indexBufferViewIndex + i,
            material : i,
            mode : 4 // TRIANGLES
        });
    }

    var vertexAccessors = [
        {
            bufferView : positionsBufferViewIndex,
            byteOffset : 0,
            componentType : 5126, // FLOAT
            count : vertexCount,
            type : 'VEC3',
            min : positionsMinMax.min,
            max : positionsMinMax.max
        },
        {
            bufferView : normalsBufferViewIndex,
            byteOffset : 0,
            componentType : 5126, // FLOAT
            count : vertexCount,
            type : 'VEC3',
            min : normalsMinMax.min,
            max : normalsMinMax.max
        }
    ];

    if (useUvs) {
        vertexAccessors.push({
            bufferView : uvsBufferViewIndex,
            byteOffset : 0,
            componentType : 5126, // FLOAT
            count : vertexCount,
            type : 'VEC2',
            min : uvsMinMax.min,
            max : uvsMinMax.max
        });
    }

    if (useVertexColors) {
        vertexAccessors.push({
            bufferView : vertexColorsBufferViewIndex,
            byteOffset : 0,
            componentType : 5126, // FLOAT   UNSIGNED_BYTE 在draco时会有问题
            count : vertexCount,
            type : 'VEC4',
            /*min : vertexColorsMinMax.min,
            max : vertexColorsMinMax.max,
            normalized : true*/
        });
    }

    if (useBatchIds) {
        vertexAccessors.push({
            bufferView : batchIdsBufferViewIndex,
            byteOffset : 0,
            componentType : 5126, // FLOAT
            count : batchIdsLength,
            type : 'SCALAR',
            min : batchIdsMinMax.min,
            max : batchIdsMinMax.max
        });
    }

    var animationAccessors = [];

    if (animated) {
        animationAccessors.push({
            bufferView : translationsBufferViewIndex,
            byteOffset : 0,
            componentType: 5126, // FLOAT,
            count : keyframesLength,
            type : 'VEC3',
        });
        animationAccessors.push({
            bufferView : timesBufferViewIndex,
            byteOffset : 0,
            componentType: 5126, // FLOAT,
            count : keyframesLength,
            type : 'SCALAR',
            min: [times[0]],
            max: [times[keyframesLength - 1]]
        });
    }

    var accessors = vertexAccessors.concat(indexAccessors, animationAccessors);

    var bufferViews = [
        {
            buffer : 0,
            byteLength : positionsBuffer.length,
            byteOffset : positionsBufferByteOffset,
            target : 34962 // ARRAY_BUFFER
        },
        {
            buffer : 0,
            byteLength : normalsBuffer.length,
            byteOffset : normalsBufferByteOffset,
            target : 34962 // ARRAY_BUFFER
        }
    ];

    if (useUvs) {
        bufferViews.push({
            buffer : 0,
            byteLength : uvsBuffer.length,
            byteOffset : uvsBufferByteOffset,
            target : 34962 // ARRAY_BUFFER
        });
    }

    if (useVertexColors) {
        bufferViews.push({
            buffer : 0,
            byteLength : vertexColorsBuffer.length,
            byteOffset : vertexColorsBufferByteOffset,
            target : 34962 // ARRAY_BUFFER
        });
    }

    if (useBatchIds) {
        bufferViews.push({
            buffer : 0,
            byteLength : batchIdsBuffer.length,
            byteOffset : batchIdsBufferByteOffset,
            target : 34962 // ARRAY_BUFFER
        });
    }

    bufferViews.push({
        buffer : 0,
        byteLength : indexBuffer.length,
        byteOffset : indexBufferByteOffset,
        target : 34963 // ELEMENT_ARRAY_BUFFER
    });

    if (animated) {
        bufferViews.push({
            buffer: 0,
            byteLength : translationsBuffer.length,
            byteOffset : translationsByteOffset
        });
        bufferViews.push({
            buffer: 0,
            byteLength : timesBuffer.length,
            byteOffset : timesByteOffset
        });
    }

    var hasRTC = use3dTilesNext && defined(options.featureTableJson) && defined(options.featureTableJson.RTC_CENTER);
    var nodes;
    var animationNode;

    if (animated && hasRTC) {
        nodes = [
            {
                matrix : rootMatrix,
                children : [1]
            },
            {
                name : 'RTC_CENTER',
                translation : options.featureTableJson.RTC_CENTER,
                children : [2]
            },
            {
                mesh : 0
            }
        ];
        animationNode = 2;
    } else if (animated) {
        nodes = [
            {
                matrix : rootMatrix,
                children : [1]
            },
            {
                mesh : 0
            }
        ];
        animationNode = 1;
    } else if (hasRTC) {
        nodes = [
            {
                matrix : rootMatrix,
                children : [1]
            },
            {
                name : 'RTC_CENTER',
                translation : options.featureTableJson.RTC_CENTER,
                mesh : 0
            }
        ];
    } else {
        nodes = [
            {
                // matrix : rootMatrix,
                mesh : 0
            }
        ];
    }

    var animations;
    if (animated) {
        animations = [
            {
                channels : [
                    {
                        sampler : 0,
                        target : {
                            node : animationNode,
                            path : 'translation'
                        }
                    }
                ],
                samplers : [
                    {
                        input : timesBufferViewIndex,
                        interpolation : 'LINEAR',
                        output : translationsBufferViewIndex
                    }
                ]
            }
        ];
    }

    var gltf = {
        accessors : accessors,
        animations : animations,
        asset : {
            generator : 'ts-gis',
            version : '2.0'
        },
        buffers : [{
            byteLength : byteLength,
            uri : bufferUri
        }],
        bufferViews : bufferViews,
        images : images,
        materials : materials,
        meshes : [
            {
                primitives : primitives
            }
        ],
        nodes : nodes,
        samplers : samplers,
        scene : 0,
        scenes : [{
            nodes : [0]
        }],
        textures : textures
    };

    // return gltf;
    var compressDracoMeshesdefaults = {
        compressionLevel: 7,
        quantizePositionBits: 11,
        quantizeNormalBits: 8,
        quantizeTexcoordBits: 10,
        quantizeColorBits: 8,
        quantizeSkinBits: 8,
        quantizeGenericBits: 8,
        uncompressedFallback: false,
        unifiedQuantization: false
    };
    compressDracoMeshesdefaults.compressMeshes = true;

    /*compressDracoMeshesdefaults['compression-level'] = 7;
    compressDracoMeshesdefaults['quantize-position-bits'] = 14;
    compressDracoMeshesdefaults['quantize-normal-bits'] = 10;
    compressDracoMeshesdefaults['quantize-texcoord-bits'] = 12;
    compressDracoMeshesdefaults['quantizeColorBits'] = 8;
    compressDracoMeshesdefaults['quantize-generic-bits'] = 12;*/

    var gltfOptions = {
        resourceDirectory : rootDirectory + resourcePath,
        separateTextures : true
    };
    if(compressDracoMeshes){
        gltfOptions.dracoOptions = compressDracoMeshesdefaults;
    }
    return gltfToGlb(gltf, gltfOptions)
        .then(function(results) {
            return results.glb;
        });
}
