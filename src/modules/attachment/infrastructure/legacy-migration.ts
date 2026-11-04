import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import type { FileStorage } from '../application/storage.js';

interface LegacyAttachment {
  storageKey: string;
  sizeBytes: number;
  checksum: string;
}
export function isMissingOciObject(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    error.statusCode === 404 &&
    'serviceCode' in error &&
    error.serviceCode === 'ObjectNotFound'
  );
}
async function verifiedBytes(
  stream: Readable,
  file: LegacyAttachment,
  collect: boolean,
): Promise<Buffer> {
  const hash = createHash('sha256');
  let size = 0;
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of stream) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > file.sizeBytes) throw new Error('Attachment size mismatch.');
      hash.update(bytes);
      if (collect) chunks.push(bytes);
    }
    if (size !== file.sizeBytes || hash.digest('hex') !== file.checksum)
      throw new Error('Attachment integrity mismatch.');
    return Buffer.concat(chunks);
  } finally {
    stream.destroy();
  }
}

// Explicit maintenance operation: never invoked by an upload or application startup.
export async function migrateLegacyAttachment(
  source: FileStorage,
  target: FileStorage,
  file: LegacyAttachment,
  apply: boolean,
): Promise<'existing' | 'copied' | 'pending'> {
  if (
    !Number.isSafeInteger(file.sizeBytes) ||
    file.sizeBytes <= 0 ||
    file.sizeBytes > 52428800 ||
    !/^[a-f0-9]{64}$/.test(file.checksum)
  )
    throw new Error('Invalid legacy attachment metadata.');
  let existing: Readable | undefined;
  try {
    existing = await target.open(file.storageKey);
  } catch (error) {
    if (!isMissingOciObject(error)) throw error;
  }
  if (existing) {
    await verifiedBytes(existing, file, false);
    return 'existing';
  }
  const bytes = await verifiedBytes(
    await source.open(file.storageKey),
    file,
    apply,
  );
  if (!apply) return 'pending';
  try {
    await target.put(file.storageKey, bytes);
  } catch (error) {
    // A concurrent migration may have created this key; verify it without overwriting.
    if (!(
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 412
    ))
      throw error;
  }
  await verifiedBytes(await target.open(file.storageKey), file, false);
  return 'copied';
}
