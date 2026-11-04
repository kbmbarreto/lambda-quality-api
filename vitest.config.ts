import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { projects: [
  { test: { name: 'unit', include: ['test/**/*.test.ts'], exclude: ['test/**/*.integration.test.ts'], env: { NODE_ENV: 'test' }, testTimeout: 15000 } },
  { test: { name: 'integration', include: ['test/**/*.integration.test.ts'], env: { NODE_ENV: 'test' }, testTimeout: 30000, hookTimeout: 300000, fileParallelism: false } },
] } });
