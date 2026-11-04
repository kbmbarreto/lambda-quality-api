import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const directory = join(process.cwd(), '.local', 'keys');
mkdirSync(directory, { recursive: true });
const privatePath = join(directory, 'private.pem');
const publicPath = join(directory, 'public.pem');
if (existsSync(privatePath) || existsSync(publicPath)) {
  console.log('Chaves locais existentes preservadas.');
} else {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 3072,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  writeFileSync(privatePath, keys.privateKey, { mode: 0o600, flag: 'wx' });
  writeFileSync(publicPath, keys.publicKey, { mode: 0o600, flag: 'wx' });
  console.log('Chaves RS256 locais criadas em .local/keys; não versionar.');
}
