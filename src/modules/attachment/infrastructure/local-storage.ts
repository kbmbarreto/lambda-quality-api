import { mkdir, lstat, unlink, readdir, open } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { FileStorage } from '../application/storage.js';
export class LocalStorage implements FileStorage {
  private readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }
  private path(key: string): string {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.blob$/.test(
        key,
      )
    )
      throw new Error('Invalid storage key.');
    return join(this.root, key);
  }
  async put(key: string, bytes: Uint8Array): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const handle = await open(this.path(key), 'wx', 0o600);
    try {
      await handle.writeFile(bytes);
    } catch (error) {
      await handle.close();
      await this.remove(key).catch(() => undefined);
      throw error;
    }
    await handle.close();
  }
  async open(key: string) {
    const path = this.path(key);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error('Invalid stored file.');
    const handle = await open(path, 'r');
    return handle.createReadStream({ autoClose: true });
  }
  async remove(key: string): Promise<void> {
    try {
      await unlink(this.path(key));
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ))
        throw error;
    }
  }
  async list() {
    await mkdir(this.root, { recursive: true });
    const entries = await readdir(this.root, { withFileTypes: true });
    const rows = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.blob')) continue;
      const stat = await lstat(this.path(entry.name));
      rows.push({ key: entry.name, modifiedAt: stat.mtime });
    }
    return rows;
  }
}
