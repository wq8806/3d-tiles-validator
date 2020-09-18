#!/usr/bin/env node
'use strict';

import { Promise as Bluebird } from 'bluebird';
import { createBatchTableHierarchy } from '../lib/createBatchTableHierarchy';
import { GeneratorArgs } from '../lib/arguments';

import {
    buildingsTransform,
    gzip,
    instancesGeometricError,
    prettyJson,
} from '../lib/constants';
import { createTilesetJsonSingle } from '../lib/createTilesetJsonSingle';
import { metersToLongitude, toCamelCase, wgs84Transform } from '../lib/utility';

const fsExtra = require('fs-extra');
var gltfPipeline = require('gltf-pipeline');
var path = require('path');
var DataUriParser = require('datauri/parser');
var dataUriParser = new DataUriParser();
var gltfToGlb = gltfPipeline.gltfToGlb;
var gltfConversionOptions = { resourceDirectory: path.join(__dirname, '../') };

const getProperties = require('../lib/getProperties');
const saveBinary = require('../lib/saveBinary');
const saveJson = require('../lib/saveJson');

const argv = require('yargs')
    .help()
    .strict()
    .option('3d-tiles-next', {
        type: 'boolean',
        describe:
            'Export samples as 3D Tiles Next (.gltf). This flag is experimental and should not be used in production.'
    })
    .option('glb', {
        type: 'boolean',
        describe:
            'Export 3D Tiles Next in (.glb) form. Can only be used with --3d-tiles-next. This flag is experimental and should not be used in production.'
    })
    .option('input',{
        type: 'string',
        describe:'Input glb path.'
    })
    .option('output',{
        type: 'string',
        describe:'output tiles path.'
    })
    .check(function (argv) {
        if (argv.glb && !argv['3d-tiles-next']) {
            throw new Error(
                '--glb can only be used if --3d-tiles-next is also provided.'
            );
        }
        return true;
    }).argv;

const args: GeneratorArgs = {
    use3dTilesNext: argv['3d-tiles-next'],
    useGlb: argv['glb'],
    gltfConversionOptions: gltfConversionOptions,
    gzip: gzip,
    prettyJson: prettyJson,
    geometricError: instancesGeometricError,
    versionNumber: '1.1'
};

var promises = [
    createBIMTiles(),
];

async function main() {
    // legacy code path
    return Bluebird.all(promises).catch(function (error) {
        console.log(error.message);
        console.log(error.stack);
    });
}

main();

function createBIMTiles() {

    return createBatchTableHierarchy({
        /*directory: path.join(
            outputDirectory,
            'Hierarchy',
            'BatchTableHierarchy'
        ),*/
        input:argv['input'],
        output:argv['output'],
        transform: buildingsTransform, //buildingsTransform1,
        gzip: false, //gzip,
        prettyJson: true,
        use3dTilesNext: argv['3d-tiles-next'],
        useGlb: argv.glb,
        batchTableBinary:false, //二进制batchtable,针对属性中较长的数字数组，使用
        useVertexColors:true, //是否写入顶点颜色
        compressDracoMeshes: true  //是否使用draco压缩
    });
}



