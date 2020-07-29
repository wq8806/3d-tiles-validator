import { FLOAT32_SIZE_BYTES, UINT16_SIZE_BYTES, UINT32_SIZE_BYTES } from './typeSize';

export function bufferToUint16Array(
    buffer: Buffer,
    byteOffset: number,
    length: number
) {
    const uint16Array = new Uint16Array(length);
    for (let i = 0; i < length; ++i) {
        uint16Array[i] = buffer.readUInt16LE(
            byteOffset + i * UINT16_SIZE_BYTES
        );
    }
    return uint16Array;
}

export function bufferToUint32Array(
    buffer: Buffer,
    byteOffset: number,
    length: number
) {
    const uint32Array = new Uint32Array(length);
    for (let i = 0; i < length; ++i) {
        uint32Array[i] = buffer.readUInt32LE(
            byteOffset + i * UINT32_SIZE_BYTES
        );
    }
    return uint32Array;
}

export function bufferToFloat32Array(
    buffer: Buffer,
    byteOffset: number,
    length: number
) {
    const float32Array = new Float32Array(length);
    for (let i = 0; i < length; ++i) {
        float32Array[i] = buffer.readFloatLE(
            byteOffset + i * FLOAT32_SIZE_BYTES
        );
    }
    return float32Array;
}
