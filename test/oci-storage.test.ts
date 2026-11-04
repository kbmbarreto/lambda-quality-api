import { createHash, createPublicKey, randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { models } from 'oci-objectstorage';
import { createApp } from '../dist/app.js';
import { FILE_STORAGE } from '../dist/modules/attachment/application/storage.js';
import {
  OciStorage,
  createOciClient,
} from '../dist/modules/attachment/infrastructure/oci-storage.js';
import type { OciObjectClient } from '../dist/modules/attachment/infrastructure/oci-storage.js';
import { migrateLegacyAttachment } from '../dist/modules/attachment/infrastructure/legacy-migration.js';
import { loadObjectStorageConfig } from '../dist/shared/config/object-storage.js';
import { loadConfig } from '../dist/shared/config/config.js';
import {
  FakeEmail,
  MemoryFileStorage,
  testConfig,
  harness,
  register,
} from './helpers.js';
import { MemoryStore } from './memory-store.js';

const config = testConfig.objectStorage;
const key = `${randomUUID()}.blob`;
const missing = { statusCode: 404, serviceCode: 'ObjectNotFound' };
const temporaryDirectories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
function client() {
  return {
    getBucket: vi.fn<OciObjectClient['getBucket']>().mockResolvedValue({
      bucket: {
        publicAccessType: models.Bucket.PublicAccessType.NoPublicAccess,
      },
    }),
    putObject: vi.fn<OciObjectClient['putObject']>().mockResolvedValue({}),
    getObject: vi
      .fn<OciObjectClient['getObject']>()
      .mockResolvedValue({ value: Readable.from(['evidence']) }),
    deleteObject: vi
      .fn<OciObjectClient['deleteObject']>()
      .mockResolvedValue({}),
    listObjects: vi
      .fn<OciObjectClient['listObjects']>()
      .mockResolvedValue({ listObjects: { objects: [] } }),
    close: vi.fn(),
  };
}
async function bytes(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
describe('OCI private attachment storage', () => {
  it('rejects public or unavailable buckets before accessing files and can recover after access is restored', async () => {
    const api = client();
    const storage = new OciStorage(config, api);
    await expect(storage.verifyPrivateBucket()).resolves.toBeUndefined();
    for (const publicAccessType of [
      models.Bucket.PublicAccessType.ObjectRead,
      models.Bucket.PublicAccessType.ObjectReadWithoutList,
    ]) {
      api.getBucket.mockResolvedValueOnce({ bucket: { publicAccessType } });
      await expect(storage.verifyPrivateBucket()).rejects.toThrow(
        'bucket Oracle OCI como privado',
      );
    }
    api.getBucket.mockRejectedValueOnce({ statusCode: 403 });
    await expect(storage.verifyPrivateBucket()).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(api.putObject).not.toHaveBeenCalled();
    await storage.put(key, Buffer.from('restored'));
    expect(api.putObject).toHaveBeenCalledOnce();
  });
  it('wires OCI without making network calls during bootstrap', async () => {
    const http = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ publicAccessType: 'NoPublicAccess' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const app = await createApp({
      config: testConfig,
      store: new MemoryStore(),
      mail: new FakeEmail(),
    });
    try {
      expect(app.get(FILE_STORAGE)).toBeInstanceOf(OciStorage);
      expect(http).not.toHaveBeenCalled();
      await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);
      expect(http).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('blocks file operations on a public bucket without stopping the API', async () => {
    const api = client();
    api.getBucket.mockResolvedValue({
      bucket: { publicAccessType: models.Bucket.PublicAccessType.ObjectRead },
    });
    const storage = new OciStorage(config, api);
    await expect(storage.put(key, Buffer.from('evidence'))).rejects.toThrow(
      'bucket Oracle OCI como privado',
    );
    await expect(storage.open(key)).rejects.toThrow(
      'bucket Oracle OCI como privado',
    );
    await expect(storage.remove(key)).rejects.toThrow(
      'bucket Oracle OCI como privado',
    );
    await expect(storage.list()).rejects.toThrow(
      'bucket Oracle OCI como privado',
    );
    expect(api.putObject).not.toHaveBeenCalled();
    expect(api.getObject).not.toHaveBeenCalled();
    expect(api.deleteObject).not.toHaveBeenCalled();
    expect(api.listObjects).not.toHaveBeenCalled();
  });
  it('shares bucket validation for concurrent operations and rechecks after an OCI operation fails', async () => {
    const api = client();
    const storage = new OciStorage(config, api);
    await Promise.all([
      storage.put(key, Buffer.from('one')),
      storage.put(`${randomUUID()}.blob`, Buffer.from('two')),
    ]);
    expect(api.getBucket).toHaveBeenCalledOnce();
    api.putObject.mockRejectedValueOnce({ statusCode: 403 });
    await expect(
      storage.put(`${randomUUID()}.blob`, Buffer.from('denied')),
    ).rejects.toMatchObject({ statusCode: 403 });
    await storage.put(`${randomUUID()}.blob`, Buffer.from('restored'));
    expect(api.getBucket).toHaveBeenCalledTimes(2);
  });
  it('uploads binary bytes in the configured prefix with integrity checks and exclusive creation', async () => {
    const api = client();
    const storage = new OciStorage(config, api);
    const payload = Buffer.from([0, 255, 10, 80]);
    await storage.put(key, payload);
    expect(api.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        namespaceName: config.namespace,
        bucketName: config.bucket,
        objectName: `${config.prefix}/${key}`,
        putObjectBody: payload,
        contentLength: 4,
        ifNoneMatch: '*',
        contentType: 'application/octet-stream',
        contentMD5: createHash('md5').update(payload).digest('base64'),
        opcChecksumAlgorithm: 'SHA256',
        opcContentSha256: createHash('sha256').update(payload).digest('base64'),
      }),
    );
    api.putObject.mockRejectedValueOnce({ statusCode: 412 });
    await expect(storage.put(key, payload)).rejects.toMatchObject({
      statusCode: 412,
    });
    expect(api.deleteObject).not.toHaveBeenCalled();
  });
  it('rejects traversal, foreign paths and invalid prefixes before accessing OCI', async () => {
    const api = client();
    const storage = new OciStorage(config, api);
    for (const bad of [
      '../.env',
      `other/${key}`,
      '/secret',
      'not-a-uuid.blob',
    ]) {
      await expect(storage.open(bad)).rejects.toThrow('Invalid storage key');
      await expect(storage.put(bad, Buffer.from('x'))).rejects.toThrow(
        'Invalid storage key',
      );
      await expect(storage.remove(bad)).rejects.toThrow('Invalid storage key');
    }
    for (const prefix of ['', '/', '..', 'app/../other', 'app//other'])
      expect(() => new OciStorage({ ...config, prefix }, api)).toThrow(
        'Invalid storage prefix',
      );
    expect(api.putObject).not.toHaveBeenCalled();
    expect(api.getObject).not.toHaveBeenCalled();
    expect(api.deleteObject).not.toHaveBeenCalled();
  });
  it('streams both Node and native fetch bodies and propagates cancellation', async () => {
    const api = client();
    const storage = new OciStorage(config, api);
    expect((await bytes(await storage.open(key))).toString()).toBe('evidence');
    api.getObject.mockResolvedValueOnce({
      value: new Response('OCI evidence').body!,
    });
    expect((await bytes(await storage.open(key))).toString()).toBe(
      'OCI evidence',
    );
    const cancel = vi.fn();
    api.getObject.mockResolvedValueOnce({
      value: new ReadableStream({ cancel }),
    });
    const stream = await storage.open(key);
    stream.destroy();
    await new Promise<void>((resolve) => stream.once('close', resolve));
    expect(cancel).toHaveBeenCalled();
    storage.onModuleDestroy();
    expect(api.close).toHaveBeenCalledOnce();
  });
  it('treats only a missing object as idempotent deletion, preserving access and service errors', async () => {
    const api = client();
    const storage = new OciStorage(config, api);
    api.deleteObject.mockRejectedValueOnce(missing);
    await expect(storage.remove(key)).resolves.toBeUndefined();
    for (const error of [
      { statusCode: 403 },
      { statusCode: 503 },
      { statusCode: 404, serviceCode: 'BucketNotFound' },
    ]) {
      api.deleteObject.mockRejectedValueOnce(error);
      await expect(storage.remove(key)).rejects.toEqual(error);
    }
  });
  it('paginates cleanup inventory and ignores foreign objects, nested paths and missing timestamps', async () => {
    const api = client();
    const other = `${randomUUID()}.blob`;
    const modifiedAt = new Date('2026-09-01T00:00:00Z');
    api.listObjects
      .mockResolvedValueOnce({
        listObjects: {
          objects: [
            { name: `${config.prefix}/${key}`, timeModified: modifiedAt },
            { name: `another/${other}`, timeModified: modifiedAt },
            {
              name: `${config.prefix}/nested/${other}`,
              timeModified: modifiedAt,
            },
            { name: `${config.prefix}/business.pdf`, timeModified: modifiedAt },
            { name: `${config.prefix}/${other}` },
          ],
          nextStartWith: `${config.prefix}/${other}`,
        },
      })
      .mockResolvedValueOnce({
        listObjects: {
          objects: [
            { name: `${config.prefix}/${other}`, timeModified: modifiedAt },
          ],
        },
      });
    const storage = new OciStorage(config, api);
    expect(await storage.list()).toEqual([
      { key, modifiedAt },
      { key: other, modifiedAt },
    ]);
    expect(api.listObjects).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        prefix: `${config.prefix}/`,
        start: `${config.prefix}/${other}`,
        limit: 1000,
        fields: 'name,timeModified',
      }),
    );
    expect(api.deleteObject).not.toHaveBeenCalled();
  });
  it('rejects repeated or foreign listing cursors instead of looping or broadening cleanup scope', async () => {
    const api = client();
    const storage = new OciStorage(config, api);
    api.listObjects.mockResolvedValue({
      listObjects: { objects: [], nextStartWith: `${config.prefix}/${key}` },
    });
    await expect(storage.list()).rejects.toThrow(
      'Invalid object listing cursor',
    );
    expect(api.listObjects).toHaveBeenCalledTimes(2);
    api.listObjects.mockResolvedValue({
      listObjects: { objects: [], nextStartWith: 'foreign/' },
    });
    await expect(storage.list()).rejects.toThrow(
      'Invalid object listing cursor',
    );
  });
  it('uses the official SDK to sign real request shapes, with fresh bounded abort signals and no retries', async () => {
    const http = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ publicAccessType: 'NoPublicAccess' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValue(
        new Response(null, { status: 200, headers: { etag: 'test' } }),
      );
    const sdk = createOciClient(config);
    const storage = new OciStorage(config, sdk);
    try {
      await storage.put(key, Buffer.from('first'));
      await storage.put(`${randomUUID()}.blob`, Buffer.from('second'));
      const [url, options] = http.mock.calls[1];
      expect(String(url)).toContain(
        'objectstorage.sa-saopaulo-1.oraclecloud.com',
      );
      expect(decodeURIComponent(String(url))).toContain(
        `/n/test/b/test/o/${config.prefix}/${key}`,
      );
      expect(new Headers(options?.headers).get('authorization')).toContain(
        'Signature version="1"',
      );
      expect(options?.body).toEqual(Buffer.from('first'));
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      expect(options?.signal).not.toBe(http.mock.calls[2][1]?.signal);
      http.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 'NotAuthorized', message: 'Denied' }),
          { status: 403 },
        ),
      );
      await expect(storage.open(key)).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(http).toHaveBeenCalledTimes(4);
    } finally {
      storage.onModuleDestroy();
    }
  });
});

describe('OCI configuration', () => {
  async function environment() {
    const root = await mkdtemp(join(tmpdir(), 'lambdaquality-oci-config-'));
    temporaryDirectories.push(root);
    const path = join(root, 'api-key.pem');
    await writeFile(path, config.privateKey, { mode: 0o600 });
    const fingerprint = createHash('md5')
      .update(
        createPublicKey(config.privateKey).export({
          type: 'spki',
          format: 'der',
        }),
      )
      .digest('hex')
      .match(/.{2}/g)!
      .join(':');
    return {
      LAMBDAQUALITY_STORAGE_ORACLE_REGION: config.region,
      LAMBDAQUALITY_STORAGE_ORACLE_NAMESPACE: config.namespace,
      LAMBDAQUALITY_STORAGE_ORACLE_BUCKET: config.bucket,
      LAMBDAQUALITY_STORAGE_PREFIX: '/app/attachments/',
      LAMBDAQUALITY_STORAGE_ORACLE_TENANCY_OCID: config.tenancyOcid,
      LAMBDAQUALITY_STORAGE_ORACLE_USER_OCID: config.userOcid,
      LAMBDAQUALITY_STORAGE_ORACLE_FINGERPRINT: fingerprint,
      LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PATH: path,
    };
  }
  it('validates API signing key against its fingerprint and normalizes the application prefix', async () => {
    const env = await environment();
    expect(loadObjectStorageConfig(env)).toMatchObject({
      prefix: 'app/attachments',
      privateKey: config.privateKey,
    });
    expect(() =>
      loadObjectStorageConfig({
        ...env,
        LAMBDAQUALITY_STORAGE_ORACLE_FINGERPRINT: config.fingerprint,
      }),
    ).toThrow('chave RSA incompatível');
  });
  it.each([
    'missing configuration',
    'missing PEM',
    'invalid PEM',
    'wrong fingerprint',
  ])(
    'starts core HTTP endpoints with %s and defers the storage failure to file access',
    async (failure) => {
      const env = await environment();
      const root = join(env.LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PATH, '..');
      const jwtPrivate = join(root, 'jwt-private.pem');
      const jwtPublic = join(root, 'jwt-public.pem');
      await writeFile(jwtPrivate, config.privateKey);
      await writeFile(
        jwtPublic,
        createPublicKey(config.privateKey).export({
          type: 'spki',
          format: 'pem',
        }),
      );
      let storageEnv: NodeJS.ProcessEnv = { ...env };
      if (failure === 'missing configuration') storageEnv = {};
      if (failure === 'missing PEM')
        storageEnv.LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PATH = join(
          root,
          'missing.pem',
        );
      if (failure === 'invalid PEM')
        await writeFile(
          env.LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PATH,
          'invalid-private-key-secret',
        );
      if (failure === 'wrong fingerprint')
        storageEnv.LAMBDAQUALITY_STORAGE_ORACLE_FINGERPRINT = config.fingerprint;
      const appConfig = loadConfig({
        ...storageEnv,
        NODE_ENV: 'test',
        DATABASE_URL: testConfig.database.url,
        OTP_HMAC_SECRET: testConfig.codes.secret,
        SENDGRID_API_KEY: testConfig.mail.apiKey,
        SENDGRID_FROM_EMAIL: testConfig.mail.fromEmail,
        JWT_PRIVATE_KEY_PATH: jwtPrivate,
        JWT_PUBLIC_KEY_PATH: jwtPublic,
        JWT_KEY_ID: testConfig.jwt.keyId,
      });
      const network = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new Error('Should not contact OCI'));
      const store = new MemoryStore();
      const h = harness(store);
      await register(h);
      const tokens = await h.service.login(
        'user@example.com',
        'VerySecurePassword123!',
        h.requestId,
      );
      const app = await createApp({
        config: appConfig,
        store,
        mail: new FakeEmail(),
      });
      try {
        const http = request(app.getHttpServer());
        await http.get('/api/v1/health/ready').expect(200);
        await http
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${tokens.accessToken}`)
          .expect(200);
        await expect(
          app.get<OciStorage>(FILE_STORAGE).put(key, Buffer.from('evidence')),
        ).rejects.toThrow();
        expect(network).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    },
  );
  it('can retry a failed first upload after the missing PEM is provisioned', async () => {
    const env = await environment();
    await rm(env.LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PATH);
    const api = client();
    const storage = new OciStorage(() => loadObjectStorageConfig(env), api);
    await expect(storage.put(key, Buffer.from('evidence'))).rejects.toThrow(
      'arquivo inacessível',
    );
    expect(api.getBucket).not.toHaveBeenCalled();
    await writeFile(
      env.LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PATH,
      config.privateKey,
    );
    await storage.put(key, Buffer.from('evidence'));
    expect(api.putObject).toHaveBeenCalledOnce();
    storage.onModuleDestroy();
  });
  it('fails closed for missing settings, unsafe prefixes and inaccessible keys without exposing secret values', async () => {
    const env = await environment();
    expect(() => loadObjectStorageConfig({})).toThrow(
      'LAMBDAQUALITY_STORAGE_ORACLE_REGION',
    );
    for (const prefix of ['', '/', 'app/../files', 'app//files'])
      expect(() =>
        loadObjectStorageConfig({
          ...env,
          LAMBDAQUALITY_STORAGE_PREFIX: prefix,
        }),
      ).toThrow('LAMBDAQUALITY_STORAGE_PREFIX');
    expect(() =>
      loadObjectStorageConfig({
        ...env,
        LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PATH:
          '/missing/secret-private-key.pem',
      }),
    ).toThrow('arquivo inacessível');
    await writeFile(
      env.LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PATH,
      'private-secret-invalid-content',
    );
    try {
      loadObjectStorageConfig(env);
      throw new Error('Should reject invalid key');
    } catch (error) {
      expect((error as Error).message).toContain('arquivo inacessível');
      expect((error as Error).message).not.toContain(
        'private-secret-invalid-content',
      );
    }
  });
});

describe('Legacy attachment migration', () => {
  const content = Buffer.from('legacy evidence');
  const file = {
    storageKey: key,
    sizeBytes: content.length,
    checksum: createHash('sha256').update(content).digest('hex'),
  };
  function destination() {
    const storage = new MemoryFileStorage();
    const open = storage.open.bind(storage);
    vi.spyOn(storage, 'open').mockImplementation(async (key) => {
      try {
        return await open(key);
      } catch {
        throw missing;
      }
    });
    return storage;
  }
  it('verifies dry-run without writes, copies unchanged bytes and resumes without overwriting', async () => {
    const source = new MemoryFileStorage();
    const target = destination();
    await source.put(key, content);
    expect(await migrateLegacyAttachment(source, target, file, false)).toBe(
      'pending',
    );
    expect(await target.list()).toEqual([]);
    expect(await migrateLegacyAttachment(source, target, file, true)).toBe(
      'copied',
    );
    expect(await migrateLegacyAttachment(source, target, file, true)).toBe(
      'existing',
    );
    expect(await bytes(await source.open(key))).toEqual(content);
    expect(await bytes(await target.open(key))).toEqual(content);
  });
  it('refuses corrupt source or destination and never deletes or overwrites evidence', async () => {
    const source = new MemoryFileStorage();
    const target = destination();
    await source.put(key, content);
    await expect(
      migrateLegacyAttachment(
        source,
        target,
        { ...file, checksum: '0'.repeat(64) },
        true,
      ),
    ).rejects.toThrow('integrity');
    expect(await target.list()).toEqual([]);
    await target.put(key, Buffer.from('wrong'));
    await expect(
      migrateLegacyAttachment(source, target, file, true),
    ).rejects.toThrow('integrity');
    expect((await bytes(await target.open(key))).toString()).toBe('wrong');
  });
  it('does not mistake authorization failure for an absent destination', async () => {
    const source = new MemoryFileStorage();
    const target = destination();
    const denied = { statusCode: 403, serviceCode: 'NotAuthorized' };
    vi.spyOn(target, 'open').mockRejectedValueOnce(denied);
    await expect(
      migrateLegacyAttachment(source, target, file, true),
    ).rejects.toEqual(denied);
    expect(await target.list()).toEqual([]);
  });
});
