import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import {
  databaseSettings,
  migrationDirectory,
} from './scripts/database-env.mjs';
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: migrationDirectory() },
  datasource: { url: databaseSettings().url },
});
