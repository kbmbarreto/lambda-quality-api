import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ObjectStorageConfig {
  region: string;
  namespace: string;
  bucket: string;
  prefix: string;
  tenancyOcid: string;
  userOcid: string;
  fingerprint: string;
  privateKey: string;
}

export type ObjectStorageSource = ObjectStorageConfig | (() => ObjectStorageConfig);

// Captura somente as configurações de storage; leitura do PEM fica para a operação.
export function deferredObjectStorageConfig(env: NodeJS.ProcessEnv) {
  const settings = Object.fromEntries(
    Object.entries(env).filter(([key]) => key.startsWith('LAMBDAQUALITY_STORAGE_')),
  );
  return () => loadObjectStorageConfig(settings);
}

export function loadObjectStorageConfig(
  env: NodeJS.ProcessEnv,
): ObjectStorageConfig {
  const required = (key: string) => {
    const value = env[key]?.trim();
    if (!value) throw new Error(`Configure ${key}.`);
    return value;
  };
  const field = (suffix: string) =>
    required(`LAMBDAQUALITY_STORAGE_ORACLE_${suffix}`);
  const region = field('REGION');
  const namespace = field('NAMESPACE');
  const bucket = field('BUCKET');
  const tenancyOcid = field('TENANCY_OCID');
  const userOcid = field('USER_OCID');
  const fingerprint = field('FINGERPRINT').toLowerCase();
  const prefix = required('LAMBDAQUALITY_STORAGE_PREFIX').replace(
    /^\/+|\/+$/g,
    '',
  );
  if (!/^[a-z]+(?:-[a-z0-9]+)+-\d+$/.test(region))
    throw new Error('LAMBDAQUALITY_STORAGE_ORACLE_REGION inválida.');
  if (
    !/^[a-zA-Z0-9_-]+$/.test(namespace) ||
    !/^[a-zA-Z0-9_.-]{1,256}$/.test(bucket)
  )
    throw new Error('Namespace ou bucket OCI inválido.');
  if (
    !/^ocid1\.tenancy\.[a-z0-9.-]+$/.test(tenancyOcid) ||
    !/^ocid1\.user\.[a-z0-9.-]+$/.test(userOcid)
  )
    throw new Error('OCID de tenancy ou usuário OCI inválido.');
  if (!/^([a-f0-9]{2}:){15}[a-f0-9]{2}$/.test(fingerprint))
    throw new Error('LAMBDAQUALITY_STORAGE_ORACLE_FINGERPRINT inválido.');
  if (
    !prefix ||
    prefix.length > 512 ||
    prefix
      .split('/')
      .some(
        (segment) =>
          !/^[a-zA-Z0-9_.-]+$/.test(segment) || ['.', '..'].includes(segment),
      )
  )
    throw new Error(
      'LAMBDAQUALITY_STORAGE_PREFIX deve identificar uma pasta exclusiva da aplicação.',
    );
  const keyPath = field('PRIVATE_KEY_PATH');
  let privateKey: string;
  try {
    const key = createPrivateKey({
      key: readFileSync(resolve(keyPath), 'utf8'),
      passphrase: env.LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PASSPHRASE,
    });
    const publicDer = createPublicKey(key).export({
      type: 'spki',
      format: 'der',
    });
    const actualFingerprint = createHash('md5')
      .update(publicDer)
      .digest('hex')
      .match(/.{2}/g)!
      .join(':');
    if (
      key.asymmetricKeyType !== 'rsa' ||
      (key.asymmetricKeyDetails?.modulusLength || 0) < 2048 ||
      actualFingerprint !== fingerprint
    )
      throw new Error('Invalid key');
    privateKey = key.export({ type: 'pkcs8', format: 'pem' }).toString();
  } catch {
    throw new Error(
      'Verifique LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PATH, passphrase e fingerprint: chave RSA incompatível ou arquivo inacessível.',
    );
  }
  return {
    region,
    namespace,
    bucket,
    prefix,
    tenancyOcid,
    userOcid,
    fingerprint,
    privateKey,
  };
}
