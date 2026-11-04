import 'dotenv/config';
import mariadb from 'mariadb';
import { databaseSettings } from './database-env.mjs';
let connection;
try {
  const { url: _url, ...settings } = databaseSettings();
  connection = await mariadb.createConnection({ ...settings, charset: 'utf8mb4', timezone: 'Z', connectTimeout: 5000 });
  const version = await connection.query('SELECT VERSION() AS version');
  const tables = await connection.query('SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name');
  console.log(JSON.stringify({ connected: true, version: version[0].version, tables: tables.map((table) => table.name) }));
} catch (error) {
  console.error(JSON.stringify({ connected: false, code: error.code || 'CONFIGURATION_OR_CONNECTION_ERROR' }));
  process.exitCode = 1;
} finally {
  await connection?.end();
}
