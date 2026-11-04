import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { loadObjectStorageConfig } from '../dist/shared/config/object-storage.js';
import {
  OciStorage,
  createOciClient,
} from '../dist/modules/attachment/infrastructure/oci-storage.js';

let storage;
let key;
let uploaded = false;
try {
  const config = loadObjectStorageConfig(process.env);
  const client = createOciClient(config);
  storage = new OciStorage(config, client);
  await storage.verifyPrivateBucket();
  key = `${randomUUID()}.blob`;
  const content = Buffer.from('Lambda Quality OCI storage check');
  await storage.put(key, content);
  uploaded = true;
  const chunks = [];
  for await (const chunk of await storage.open(key))
    chunks.push(Buffer.from(chunk));
  if (!Buffer.concat(chunks).equals(content))
    throw new Error('Falha na verificação dos bytes OCI.');
  await storage.remove(key);
  uploaded = false;
  console.log(
    'Oracle OCI validado: bucket privado, upload, download e remoção do arquivo de teste concluídos.',
  );
} catch {
  console.error(
    'Não foi possível validar o Oracle OCI. Verifique variáveis LAMBDAQUALITY_STORAGE_*, arquivo/chave/fingerprint, bucket privado e permissões IAM de leitura do bucket e leitura/criação/exclusão/listagem de objetos.',
  );
  process.exitCode = 1;
} finally {
  if (uploaded) {
    try {
      await storage.remove(key);
    } catch {
      console.error(
        'Não foi possível remover o arquivo de verificação; a rotina de limpeza poderá remover o órfão após 24 horas.',
      );
    }
  }
  storage?.onModuleDestroy();
}
