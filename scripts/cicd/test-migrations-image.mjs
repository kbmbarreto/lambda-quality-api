import { execFileSync } from 'node:child_process';
import { MySqlContainer } from '@testcontainers/mysql';
import { Network } from 'testcontainers';

const image = process.argv[2];
if (!image || image.startsWith('-'))
  throw new Error('Informe a imagem de migrations construída neste run.');

const network = await new Network().start();
try {
  for (const [dialect, databaseImage] of [
    ['mysql', 'mysql:8.4.11'],
    ['mariadb', 'mariadb:10.11.14'],
  ]) {
    const database = await new MySqlContainer(databaseImage)
      .withDatabase('lambdaquality_image_test')
      .withNetwork(network)
      .withNetworkAliases('migration-db')
      .start();
    try {
      const url = new URL(database.getConnectionUri());
      url.hostname = 'migration-db';
      url.port = '3306';
      const args = [
        'run',
        '--rm',
        '--network',
        network.getName(),
        '--read-only',
        '--tmpfs',
        '/tmp:size=64m',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '-e',
        `DATABASE_URL=${url}`,
        '-e',
        `DATABASE_DIALECT=${dialect}`,
        image,
      ];
      execFileSync('docker', args, { timeout: 120000, stdio: 'pipe' });
      const repeated = execFileSync('docker', args, {
        timeout: 60000,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      if (!repeated.includes('No pending migrations to apply.'))
        throw new Error(
          'A segunda execução deveria preservar o banco migrado.',
        );
      console.log(
        `Imagem de migrations: ${dialect} aplicado e retry sem pendências.`,
      );
    } finally {
      await database.stop();
    }
  }
} finally {
  await network.stop();
}
