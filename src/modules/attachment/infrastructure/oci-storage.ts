import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import * as common from 'oci-common';
import { ObjectStorageClient, models } from 'oci-objectstorage';
import type { requests, responses } from 'oci-objectstorage';
import type {
  ObjectStorageConfig,
  ObjectStorageSource,
} from '../../../shared/config/object-storage.js';
import type { FileStorage } from '../application/storage.js';
import { isMissingOciObject } from './legacy-migration.js';

export interface OciObjectClient {
  getBucket(
    input: requests.GetBucketRequest,
  ): Promise<{ bucket: Pick<models.Bucket, 'publicAccessType'> }>;
  putObject(input: requests.PutObjectRequest): Promise<unknown>;
  getObject(
    input: requests.GetObjectRequest,
  ): Promise<Pick<responses.GetObjectResponse, 'value'>>;
  deleteObject(input: requests.DeleteObjectRequest): Promise<unknown>;
  listObjects(
    input: requests.ListObjectsRequest,
  ): Promise<Pick<responses.ListObjectsResponse, 'listObjects'>>;
  close?(): void;
}

const validKey =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.blob$/i;

export function createOciClient(
  config: ObjectStorageConfig,
  timeout = 15000,
): ObjectStorageClient {
  const authenticationDetailsProvider =
    new common.SimpleAuthenticationDetailsProvider(
      config.tenancyOcid,
      config.userOcid,
      config.fingerprint,
      config.privateKey,
      null,
      common.Region.fromRegionId(config.region),
    );
  return new ObjectStorageClient(
    { authenticationDetailsProvider },
    {
      retryConfiguration: common.NoRetryConfigurationDetails,
      httpOptions: {
        // The SDK reads this getter for each fetch, including streamed downloads.
        get signal() {
          return AbortSignal.timeout(timeout);
        },
      },
    },
  );
}

export class OciStorage implements FileStorage {
  private client?: OciObjectClient;
  private bucketClient?: OciObjectClient;
  private config?: ObjectStorageConfig;
  private prefix = '';
  private ready = false;
  private initialization?: Promise<void>;
  constructor(
    private readonly source: ObjectStorageSource,
    private readonly injectedClient?: OciObjectClient,
  ) {
    if (typeof source !== 'function') this.validatePrefix(source.prefix);
  }
  private validatePrefix(value: string) {
    const prefix = `${value.replace(/^\/+|\/+$/g, '')}/`;
    if (
      prefix === '/' ||
      prefix
        .split('/')
        .slice(0, -1)
        .some(
          (segment) =>
            !/^[a-zA-Z0-9_.-]+$/.test(segment) || ['.', '..'].includes(segment),
        )
    )
      throw new Error('Invalid storage prefix.');
    return prefix;
  }
  private initialize() {
    if (this.client) return;
    const config =
      typeof this.source === 'function' ? this.source() : this.source;
    const prefix = this.validatePrefix(config.prefix);
    const client = this.injectedClient ?? createOciClient(config);
    // Metadata + operação cabem na transação de upload (20s): 3s + 15s.
    const bucketClient = this.injectedClient ?? createOciClient(config, 3000);
    this.client = client;
    this.bucketClient = bucketClient;
    this.config = config;
    this.prefix = prefix;
  }
  private object(key: string) {
    if (!validKey.test(key)) throw new Error('Invalid storage key.');
    this.initialize();
    return {
      namespaceName: this.config!.namespace,
      bucketName: this.config!.bucket,
      objectName: `${this.prefix}${key}`,
      retryConfiguration: common.NoRetryConfigurationDetails,
    };
  }
  // Explicitamente chamado pelas ferramentas; Nest não depende do OCI no bootstrap.
  async verifyPrivateBucket(): Promise<void> {
    this.initialize();
    this.ready = false;
    const { bucket } = await this.bucketClient!.getBucket({
      namespaceName: this.config!.namespace,
      bucketName: this.config!.bucket,
      retryConfiguration: common.NoRetryConfigurationDetails,
    });
    if (bucket.publicAccessType !== 'NoPublicAccess')
      throw new Error(
        'Configure o bucket Oracle OCI como privado (NoPublicAccess).',
      );
    this.ready = true;
  }
  private async ensureReady() {
    if (this.ready) return;
    this.initialization ??= this.verifyPrivateBucket().finally(() => {
      this.initialization = undefined;
    });
    await this.initialization;
  }
  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    await this.ensureReady();
    try {
      return await operation();
    } catch (error) {
      this.ready = false;
      throw error;
    }
  }
  async put(key: string, bytes: Uint8Array): Promise<void> {
    const object = this.object(key);
    await this.execute(() =>
      this.client!.putObject({
        ...object,
        putObjectBody: bytes,
        contentLength: bytes.byteLength,
        contentType: 'application/octet-stream',
        ifNoneMatch: '*',
        contentMD5: createHash('md5').update(bytes).digest('base64'),
        opcChecksumAlgorithm: models.ChecksumAlgorithm.Sha256,
        opcContentSha256: createHash('sha256').update(bytes).digest('base64'),
      }),
    );
  }
  async open(key: string): Promise<Readable> {
    const object = this.object(key);
    const { value } = await this.execute(() => this.client!.getObject(object));
    if (value instanceof Readable) return value;
    if (!value) throw new Error('Object body unavailable.');
    return Readable.fromWeb(value as ReadableStream<Uint8Array>);
  }
  async remove(key: string): Promise<void> {
    const object = this.object(key);
    try {
      await this.execute(() => this.client!.deleteObject(object));
    } catch (error) {
      if (isMissingOciObject(error)) return;
      throw error;
    }
  }
  async list(): Promise<{ key: string; modifiedAt: Date }[]> {
    this.initialize();
    const files: { key: string; modifiedAt: Date }[] = [];
    let start: string | undefined;
    const cursors = new Set<string>();
    do {
      const { listObjects } = await this.execute(() =>
        this.client!.listObjects({
          namespaceName: this.config!.namespace,
          bucketName: this.config!.bucket,
          prefix: this.prefix,
          fields: 'name,timeModified',
          limit: 1000,
          start,
          retryConfiguration: common.NoRetryConfigurationDetails,
        }),
      );
      for (const object of listObjects.objects) {
        if (!object.name.startsWith(this.prefix)) continue;
        const key = object.name.slice(this.prefix.length);
        if (!validKey.test(key) || !object.timeModified) continue;
        const modifiedAt = new Date(object.timeModified);
        if (Number.isFinite(modifiedAt.getTime()))
          files.push({ key, modifiedAt });
      }
      start = listObjects.nextStartWith || undefined;
      if (start) {
        if (!start.startsWith(this.prefix) || cursors.has(start))
          throw new Error('Invalid object listing cursor.');
        cursors.add(start);
      }
    } while (start);
    return files;
  }
  onModuleDestroy() {
    this.client?.close?.();
    if (this.bucketClient !== this.client) this.bucketClient?.close?.();
  }
}
