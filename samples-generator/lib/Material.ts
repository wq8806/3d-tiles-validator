/**
 * A material that is applied to a mesh.
 *
 * @param {Object} [options] An object with the following properties:
 * @param {Array|String} [options.baseColor] The base color or base color texture path.
 *
 * @constructor
 */

export class Material {
    baseColor: number[];
    alphaMode: string;

    // TODO: Original code combined rgbas with jpg uris, should refactor
    //       this too.
    constructor(baseColor: number[] = [0.5, 0.5, 0.5, 1.0],alphaMode: string='OPAQUE') {
        this.baseColor = baseColor;
        this.alphaMode = alphaMode;
    }

    /**
     * Creates a Material from a glTF material. This utility is designed only for simple glTFs like those in the data folder.
     *
     * @param {Object} material The glTF material.
     * @param {Object} gltf The glTF.
     * @returns {Material} The material.
     */

    static fromGltf(material: any, gltf: any): Material | TexturedMaterial {
        if(material.pbrMetallicRoughness.baseColorTexture){
            const texture = gltf.textures[material.pbrMetallicRoughness.baseColorTexture.index];
            const imageUri = gltf.images[texture.source].uri;
            return new TexturedMaterial(imageUri,material.alphaMode)
        }
        return new Material(material.pbrMetallicRoughness.baseColorFactor,material.alphaMode);
    }
}

export class TexturedMaterial {
    // TODO: This MUST be named baseColor for now. Original version of this
    //       code didn't discriminate between RGBA / TexturePath coordinates
    //       createGltf.js will inspect the type of `baseColor` to determine
    //       what to do with this object. Needs to be refactored later.
    baseColor: string;
    alphaMode: string;

    constructor(baseColor: string,alphaMode: string='OPAQUE') {
        this.baseColor = baseColor;
        this.alphaMode = alphaMode;
    }
}
