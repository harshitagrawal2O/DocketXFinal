// y-leveldb ships types at dist/src/y-leveldb.d.ts but its package "exports"
// map hides them from NodeNext resolution. Minimal shim for what we use.
declare module "y-leveldb" {
  import * as Y from "yjs";
  export class LeveldbPersistence {
    constructor(location: string, opts?: unknown);
    getYDoc(docName: string): Promise<Y.Doc>;
    storeUpdate(docName: string, update: Uint8Array): Promise<unknown>;
    flushDocument(docName: string): Promise<unknown>;
    clearDocument(docName: string): Promise<void>;
    getStateVector(docName: string): Promise<Uint8Array>;
    destroy(): Promise<void>;
  }
}
