'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');

module.exports = readGltfNames;

/**
 * Create a Batched 3D Model (b3dm) tile from a binary glTF and per-feature metadata.
 *
 * @param {Object} options An object with the following properties:
 * @param {Buffer} options.glb The binary glTF buffer.
 * @param {Object} [options.featureTableJson] Feature table JSON.
 * @param {Buffer} [options.featureTableBinary] Feature table binary.
 * @param {Object} [options.batchTableJson] Batch table describing the per-feature metadata.
 * @param {Buffer} [options.batchTableBinary] The batch table binary.
 * @param {Boolean} [options.deprecated1=false] Save the b3dm with the deprecated 20-byte header.
 * @param {Boolean} [options.deprecated2=false] Save the b3dm with the deprecated 24-byte header.
 * @returns {Buffer} The generated b3dm tile buffer.
 */
function readGltfNames(options) {
    var derrered = Cesium.when.defer();
    var directoryPath = options.directoryPath;
    try {
        fsExtra.readFile(directoryPath + 'name.txt','utf-8',(err, result) => {
            if(err){
                console.error(err);
            }else {
                var str_array = result.split(',');
                var gltfMap = new Map();
                str_array.forEach(function (value) {
                    // urls.push('data/sample_member200/'+value);
                    gltfMap.set(value,'');
                });
                derrered.resolve(gltfMap);
            }
        });
    }catch (e) {
        console.error(e);
    }
    return derrered.promise;

}

/*function(err,result){
    if(err){
        console.error(err);
    }else {
        var str_array = result.split(',');
        var gltfMap = new Map();
        str_array.forEach(function (value) {
            // urls.push('data/sample_member200/'+value);
            gltfMap.set(value,'');
        });
        derrered.resolve(gltfMap);
    }
}*/

