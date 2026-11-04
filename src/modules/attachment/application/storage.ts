import type { Readable } from 'node:stream';
export const FILE_STORAGE = Symbol('FileStorage');
export interface FileStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  open(key: string): Promise<Readable>;
  remove(key: string): Promise<void>;
  list(): Promise<{ key: string; modifiedAt: Date }[]>;
}
