/*
 * Created on Sun Jan 17 2021
 *
 * Copyright (c) storycraft. Licensed under the MIT Licence.
 */

import { CryptoStore } from "../crypto/crypto-store";
import { ChunkedArrayBufferList } from "./chunk/chunked-arraybuffer-list";
import { Stream } from "./stream";

/**
 * Loco secure layer that encrypt outgoing packets
 */
export class LocoSecureLayer implements Stream {

    private _stream: Stream;
    private _crypto: CryptoStore;

    private _handshaked: boolean;

    constructor(socket: Stream, crypto: CryptoStore) {
        this._stream = socket;
        this._crypto = crypto;

        this._handshaked = false;
    }

    iterate() {
        const instance = this;
        const iterator = instance._stream.iterate();
        
        const headerBufferList = new ChunkedArrayBufferList();
        const packetBufferList = new ChunkedArrayBufferList();

        return {
            [Symbol.asyncIterator](): AsyncIterator<ArrayBuffer> {
                return this;
            },

            async next(): Promise<IteratorResult<ArrayBuffer>> {
                if (instance._stream.ended) {
                    return { done: true, value: null };
                }
                
                if (headerBufferList.byteLength < 20) {
                    for await (const data of iterator) {
                        headerBufferList.append(data);
    
                        if (headerBufferList.byteLength >= 20) break;
                    }
                }

                const headerBuffer = headerBufferList.toBuffer();

                const dataSize = new DataView(headerBuffer).getUint32(0, true) - 16;
                const iv = headerBuffer.slice(4, 20);

                if (headerBuffer.byteLength > 20) {
                    packetBufferList.append(headerBuffer.slice(20));
                }
                headerBufferList.clear();

                if (packetBufferList.byteLength < dataSize) {
                    for await (const data of iterator) {
                        packetBufferList.append(data);
    
                        if (packetBufferList.byteLength >= dataSize) break;
                    }
                }
                
                const dataBuffer = packetBufferList.toBuffer();
                if (dataBuffer.byteLength > dataSize) {
                    headerBufferList.append(dataBuffer.slice(dataSize));
                }
                packetBufferList.clear();

                return { done: false, value: instance._crypto.toAESDecrypted(dataBuffer.slice(0, dataSize), iv) };
            }
        };
    }
    
    get ended() {
        return this._stream.ended;
    }

    get crypto() {
        return this._crypto;
    }

    /**
     * Returns original stream
     */
    get stream() {
        return this._stream;
    }

    /**
     * Returns true if handshake sent.
     */
    get handshaked() {
        return this._handshaked;
    }

    write(data: ArrayBuffer): void {
        if (!this._handshaked) {
            this.sendHandshake();
        }

        const iv = this._crypto.randomCipherIV();
        const encrypted = this._crypto.toAESEncrypted(data, iv);

        const packet = new ArrayBuffer(encrypted.byteLength + 20);
        
        new DataView(packet).setUint32(0, encrypted.byteLength + 16, true);
        
        const packetArr = new Uint8Array(packet);
        packetArr.set(new Uint8Array(iv), 4);
        packetArr.set(new Uint8Array(encrypted), 20);
        
        this._stream.write(packet);
    }
    
    protected sendHandshake() {
        const encryptedKey = this._crypto.getRSAEncryptedKey();
        const handshakePacket = new ArrayBuffer(12 + encryptedKey.byteLength);

        const view = new DataView(handshakePacket);

        view.setUint32(0, encryptedKey.byteLength, true);
        view.setUint32(4, 12, true); // RSA OAEP SHA1 MGF1 SHA1
        view.setUint32(8, 2, true); // AES_CFB128 NOPADDING
        new Uint8Array(handshakePacket).set(new Uint8Array(encryptedKey), 12);

        this._stream.write(handshakePacket);
    }

    close(): void {
        this._stream.close();
    }

}