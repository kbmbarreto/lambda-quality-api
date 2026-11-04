import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import type { Passwords } from '../application/ports.js';
export class ArgonPasswords implements Passwords {
  private readonly dummy = this.hash(randomBytes(32).toString('hex'));
  hash(password: string): Promise<string> { return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }); }
  async verify(hash: string, password: string): Promise<boolean> { try { return await argon2.verify(hash, password); } catch { return false; } }
  async verifyDummy(password: string): Promise<void> { await this.verify(await this.dummy, password); }
}
