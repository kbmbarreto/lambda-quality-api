import { TEST_RUNS, TestRuns } from '../dist/modules/execution/application/runs.js';
import { readFileSync } from 'node:fs';
import { brazilTimestamp } from '../dist/shared/http/dates.js';
import { Prisma } from '../dist/generated/prisma/client.js';
import { ApplicationError } from '../dist/shared/domain/errors.js';
import 'dotenv/config';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { MySqlContainer } from '@testcontainers/mysql';
import type { StartedMySqlContainer } from '@testcontainers/mysql';
import type { INestApplication } from '@nestjs/common';
import mariadb from 'mariadb';
import type { Connection } from 'mariadb';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import request from 'supertest';
import {
  databaseSettings,
  databaseDialect,
  migrationDirectory,
} from '../scripts/database-env.mjs';
import { PrismaIdentityStore } from '../dist/modules/identity/infrastructure/prisma-identity-store.js';
import { PrismaWorkspaceStore } from '../dist/modules/workspace/infrastructure/prisma-workspace-store.js';
import { INVITATIONS } from '../dist/modules/workspace/application/invitations.js';
import type { Invitations } from '../dist/modules/workspace/application/invitations.js';
import { ATTACHMENTS } from '../dist/modules/attachment/application/attachments.js';
import type { Attachments } from '../dist/modules/attachment/application/attachments.js';
import type { InvitationMail } from '../dist/modules/workspace/application/ports.js';
import type { FileStorage } from '../dist/modules/attachment/application/storage.js';
import { PERMISSIONS } from '../dist/modules/workspace/domain/models.js';
import { createApp } from '../dist/app.js';
import { GOVERNANCE_GOALS } from '../dist/modules/governance/application/tokens.js';
import type { GovernanceGoalsActions } from '../dist/modules/governance/application/goals-actions.js';
import { CONFIG } from '../dist/shared/config/config.js';
import type { AppConfig } from '../dist/shared/config/config.js';
import { loadObjectStorageConfig } from '../dist/shared/config/object-storage.js';
import { FakeEmail, harness, register, testConfig } from './helpers.js';

class FakeInvitationMail implements InvitationMail {
  fail = false;
  messages: Parameters<InvitationMail['send']>[0][] = [];
  async send(input: Parameters<InvitationMail['send']>[0]) {
    this.messages.push(input);
    if (this.fail) throw new Error('provider secret failure');
  }
  token() {
    return this.messages.at(-1)!.token;
  }
}
class FakeStorage implements FileStorage {
  files = new Map<string, { bytes: Uint8Array; modifiedAt: Date }>();
  fail = false;
  async put(key: string, bytes: Uint8Array) {
    if (this.fail) throw new Error('storage secret failure');
    this.files.set(key, { bytes, modifiedAt: new Date() });
  }
  async open(key: string) {
    const file = this.files.get(key);
    if (!file) throw new Error('missing file');
    return Readable.from([Buffer.from(file.bytes)]);
  }
  async remove(key: string) {
    this.files.delete(key);
  }
  async list() {
    return [...this.files].map(([key, value]) => ({
      key,
      modifiedAt: value.modifiedAt,
    }));
  }
}
const dialect = databaseDialect({
  DATABASE_DIALECT:
    process.env.TEST_DATABASE_DIALECT || process.env.DATABASE_DIALECT,
});
const migrationRoot = migrationDirectory({ DATABASE_DIALECT: dialect });
const serverUrl =
  process.env.TEST_DATABASE_SERVER_URL || process.env.TEST_MYSQL_SERVER_URL;
const collation =
  dialect === 'mariadb' ? 'utf8mb4_unicode_nopad_ci' : 'utf8mb4_0900_ai_ci';
let identity: PrismaIdentityStore;
let store: PrismaWorkspaceStore;
let app: INestApplication;
let overviewTime: Date | undefined;
let container: StartedMySqlContainer | undefined;
let admin: Connection | undefined;
let created = false;
const databaseName = `lambdaquality_test_${randomBytes(6).toString('hex')}`;
const upgradeDirectory = resolve('.local', `project-upgrade-${randomUUID()}`);
const upgradeWorkspace = randomUUID();
const upgradeProject = randomUUID();
const upgradeTestCase = randomUUID();
const upgradeTestStep = randomUUID();
const upgradePlan = randomUUID();
const upgradeRun = randomUUID();
const upgradeRunCase = randomUUID();
const upgradeRunStep = randomUUID();
const upgradeComment = randomUUID();
const upgradeDefect = randomUUID();
const upgradeDefectAuditIds = Array.from({length:4},()=>randomUUID());
const upgradeGoal = randomUUID();
const upgradeAttachment = randomUUID();
const upgradeAdminRole = randomUUID();
const upgradeMemberRole = randomUUID();
const upgradeCustomRole = randomUUID();
const mail = new FakeInvitationMail();
const storage = new FakeStorage();
interface Account {
  id: string;
  email: string;
  token: string;
}
let owner: Account;
let otherOwner: Account;
let member: Account;
let peer: Account;
const auth = (account: Account) => `Bearer ${account.token}`;
const http = () => request(app.getHttpServer());
beforeAll(async () => {
  let url: string;
  if (
    process.env.TEST_USE_CONFIGURED_DATABASE === 'true' ||
    process.env.TEST_USE_CONFIGURED_MYSQL === 'true' ||
    serverUrl
  ) {
    const settings = serverUrl
      ? databaseSettings({ DATABASE_URL: serverUrl })
      : databaseSettings();
    const { url: _url, database: _database, ...server } = settings;
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(server.host) &&
      !serverUrl
    )
      throw new Error(
        'Configure TEST_DATABASE_SERVER_URL para o servidor dedicado fora do loopback.',
      );
    admin = await mariadb.createConnection({
      ...server,
      timezone: 'Z',
      connectTimeout: 5000,
    });
    expect(
      (await admin.query('SELECT VERSION() AS version'))[0].version,
    ).toMatch(dialect === 'mariadb' ? /^10\.11\..*MariaDB/i : /^8\./);
    if (!/^lambdaquality_test_[a-f0-9]{12}$/.test(databaseName))
      throw new Error('Unsafe test schema.');
    await admin.query(
      `CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE ${collation}`,
    );
    created = true;
    const target = new URL(settings.url);
    target.pathname = `/${databaseName}`;
    url = target.toString();
  } else {
    container = await new MySqlContainer(
      dialect === 'mariadb' ? 'mariadb:10.11.14' : 'mysql:8.4.11',
    )
      .withDatabase(databaseName)
      .start();
    url = container.getConnectionUri();
  }
  // Upgrade real da Fase 01, com grants existentes; identity.integration cobre banco vazio.
  const migrations = resolve(upgradeDirectory, 'migrations');
  await mkdir(migrations, { recursive: true });
  await copyFile(
    resolve(migrationRoot, 'migration_lock.toml'),
    resolve(migrations, 'migration_lock.toml'),
  );
  for (const name of ['202609300001_identity', '202610020001_workspaces']) {
    await mkdir(resolve(migrations, name));
    await copyFile(
      resolve(migrationRoot, name, 'migration.sql'),
      resolve(migrations, name, 'migration.sql'),
    );
  }
  const upgradeConfig = resolve(upgradeDirectory, 'prisma.config.mjs');
  await writeFile(
    upgradeConfig,
    `import {defineConfig} from 'prisma/config';\nexport default defineConfig({schema:${JSON.stringify(resolve('prisma/schema.prisma'))},migrations:{path:${JSON.stringify(migrations)}},datasource:{url:process.env.DATABASE_URL}});\n`,
  );
  execFileSync(
    process.execPath,
    [
      resolve('node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--config',
      upgradeConfig,
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: url,
        DB_USERNAME: '',
        DB_PASSWORD: '',
        NODE_ENV: 'test',
        DATABASE_DIALECT: dialect,
      },
      timeout: 120000,
      stdio: 'pipe',
    },
  );
  const { url: _seedUrl, ...seedSettings } = databaseSettings({
    DATABASE_URL: url,
  });
  const seed = await mariadb.createConnection({
    ...seedSettings,
    timezone: 'Z',
  });
  try {
    const userId = randomUUID(),
      memberId = randomUUID(),
      now = new Date();
    await seed.query(
      'INSERT INTO users (id,email,display_name,password_hash,status,email_verified_at,password_changed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        userId,
        `${userId}@example.com`,
        'Upgrade fixture',
        'not-used-for-login',
        'ACTIVE',
        now,
        now,
        now,
        now,
      ],
    );
    await seed.query(
      'INSERT INTO workspaces (id,name,slug,status,owner_member_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
      [
        upgradeWorkspace,
        'Workspace anterior',
        `upgrade-${upgradeWorkspace}`,
        'ACTIVE',
        null,
        now,
        now,
      ],
    );
    await seed.query(
      'INSERT INTO workspace_members (id,workspace_id,user_id,status,joined_at) VALUES (?,?,?,?,?)',
      [memberId, upgradeWorkspace, userId, 'ACTIVE', now],
    );
    await seed.query('UPDATE workspaces SET owner_member_id=? WHERE id=?', [
      memberId,
      upgradeWorkspace,
    ]);
    for (const [id, name, systemRole, codes] of [
      [upgradeAdminRole, 'Administrator', true, PERMISSIONS.slice(0, 12)],
      [
        upgradeMemberRole,
        'Member',
        true,
        ['workspace.read', 'field.read', 'tag.read', 'attachment.read'],
      ],
      [upgradeCustomRole, 'Custom', false, ['workspace.read']],
    ] as const) {
      await seed.query(
        'INSERT INTO roles (id,workspace_id,name,normalized_name,description,system_role,created_at) VALUES (?,?,?,?,?,?,?)',
        [id, upgradeWorkspace, name, name.toLowerCase(), null, systemRole, now],
      );
      for (const code of codes)
        await seed.query(
          'INSERT INTO role_permissions (id,workspace_id,role_id,permission_code) VALUES (?,?,?,?)',
          [randomUUID(), upgradeWorkspace, id, code],
        );
    }
  } finally {
    await seed.end();
  }
  // Complete Phase 02 first, then preserve a project across Phase 03 upgrade.
  await mkdir(resolve(migrations, '202610020002_projects'));
  await copyFile(
    resolve(migrationRoot, '202610020002_projects', 'migration.sql'),
    resolve(migrations, '202610020002_projects/migration.sql'),
  );
  execFileSync(
    process.execPath,
    [
      resolve('node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--config',
      upgradeConfig,
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: url,
        DB_USERNAME: '',
        DB_PASSWORD: '',
        NODE_ENV: 'test',
        DATABASE_DIALECT: dialect,
      },
      timeout: 120000,
      stdio: 'pipe',
    },
  );
  const phase2 = await mariadb.createConnection({
    ...seedSettings,
    timezone: 'Z',
  });
  try {
    await phase2.query(
      'INSERT INTO projects (id,workspace_id,`key`,name,description,status,created_at,updated_at,archived_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        upgradeProject,
        upgradeWorkspace,
        'UPGRADE',
        'Projeto anterior',
        null,
        'ACTIVE',
        new Date(),
        new Date(),
        null,
      ],
    );
  } finally {
    await phase2.end();
  }
  // Upgrade Phase 03 with real cases/steps/counter before deploying Phase 04.
  await mkdir(resolve(migrations, '202610020003_test_management'));
  await copyFile(
    resolve(migrationRoot, '202610020003_test_management', 'migration.sql'),
    resolve(migrations, '202610020003_test_management/migration.sql'),
  );
  execFileSync(
    process.execPath,
    [
      resolve('node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--config',
      upgradeConfig,
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: url,
        DB_USERNAME: '',
        DB_PASSWORD: '',
        NODE_ENV: 'test',
        DATABASE_DIALECT: dialect,
      },
      timeout: 120000,
      stdio: 'pipe',
    },
  );
  const phase3Store = new PrismaWorkspaceStore({
    ...testConfig,
    testVault: {keys: JSON.stringify({v1: randomBytes(32).toString("base64")}), activeKeyId:"v1"},
    database: databaseSettings({
      DATABASE_URL: url,
      NODE_ENV: 'test',
      DATABASE_DIALECT: dialect,
    }),
  });
  try {
    const ownerMember =
      await phase3Store.client.workspaceMember.findFirstOrThrow({
        where: { workspaceId: upgradeWorkspace },
      });
    await phase3Store.client.testCase.create({
      data: {
        id: upgradeTestCase,
        workspaceId: upgradeWorkspace,
        projectId: upgradeProject,
        suiteId: null,
        sequence: 1,
        title: 'Caso anterior',
        description: 'Preservado',
        preconditions: null,
        postconditions: null,
        severity: 'NORMAL',
        priority: 'MEDIUM',
        status: 'ACTIVE',
        type: 'FUNCTIONAL',
        layer: 'E2E',
        behavior: null,
        automationStatus: 'MANUAL',
        createdBy: ownerMember.userId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      },
    });
    await phase3Store.client.testStep.create({
      data: {
        id: upgradeTestStep,
        workspaceId: upgradeWorkspace,
        projectId: upgradeProject,
        testCaseId: upgradeTestCase,
        position: 1,
        action: 'Passo anterior',
        testData: null,
        expectedResult: 'Preservado',
      },
    });
    await phase3Store.client.sequenceCounter.create({
      data: {
        id: randomUUID(),
        workspaceId: upgradeWorkspace,
        projectId: upgradeProject,
        entityType: 'TEST_CASE',
        nextValue: 2,
      },
    });
  } finally {
    await phase3Store.onModuleDestroy();
  }
  // Preserve Phase 04 snapshots/results/comments across the Phase 05 migration.
  await mkdir(resolve(migrations, '202610020004_execution'));
  await copyFile(
    resolve(migrationRoot, '202610020004_execution', 'migration.sql'),
    resolve(migrations, '202610020004_execution/migration.sql'),
  );
  execFileSync(
    process.execPath,
    [
      resolve('node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--config',
      upgradeConfig,
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: url,
        DB_USERNAME: '',
        DB_PASSWORD: '',
        NODE_ENV: 'test',
        DATABASE_DIALECT: dialect,
      },
      timeout: 120000,
      stdio: 'pipe',
    },
  );
  const phase4Store = new PrismaWorkspaceStore({
    ...testConfig,
    testVault: {keys: JSON.stringify({v1: randomBytes(32).toString("base64")}), activeKeyId:"v1"},
    database: databaseSettings({
      DATABASE_URL: url,
      NODE_ENV: 'test',
      DATABASE_DIALECT: dialect,
    }),
  });
  try {
    const m = await phase4Store.client.workspaceMember.findFirstOrThrow({
      where: { workspaceId: upgradeWorkspace },
    });
    const now = new Date();
    await phase4Store.client.testPlan.create({
      data: {
        id: upgradePlan,
        workspaceId: upgradeWorkspace,
        projectId: upgradeProject,
        name: 'Plano anterior',
        description: null,
        status: 'ACTIVE',
        version: 2,
        createdBy: m.userId,
        createdAt: now,
        updatedAt: now,
        activatedAt: now,
      },
    });
    await phase4Store.client.testPlanCase.create({
      data: {
        id: randomUUID(),
        workspaceId: upgradeWorkspace,
        projectId: upgradeProject,
        testPlanId: upgradePlan,
        testCaseId: upgradeTestCase,
        position: 1,
      },
    });
    await phase4Store.client.testRun.create({
      data: {
        id: upgradeRun,
        workspaceId: upgradeWorkspace,
        projectId: upgradeProject,
        testPlanId: upgradePlan,
        planNameSnapshot: 'Plano anterior',
        name: 'Run anterior',
        source: 'MANUAL',
        status: 'IN_PROGRESS',
        version: 3,
        createdBy: m.userId,
        createdAt: now,
        updatedAt: now,
        startedAt: now,
      },
    });
    // Seed the historical schema without selecting/inserting columns introduced later.
    const oldRunCase = {
      id: upgradeRunCase,
      workspaceId: upgradeWorkspace,
      projectId: upgradeProject,
      testRunId: upgradeRun,
      testCaseId: upgradeTestCase,
      position: 1,
      caseSequenceSnapshot: 1,
      humanIdSnapshot: "UPGRADE-1",
      titleSnapshot: "Snapshot anterior",
      severitySnapshot: "MAJOR",
      prioritySnapshot: "HIGH",
      definitionSnapshot: {
        description: "Histórico",
        preconditions: null,
        postconditions: null,
        type: "FUNCTIONAL",
        layer: "API",
        behavior: null,
        automationStatus: "MANUAL",
        suiteId: null,
        status: "ACTIVE",
        version: 1,
      },
      customFieldsSnapshot: [],
      tagsSnapshot: [],
      result: "FAILED",
      executedBy: m.userId,
      executedAt: now,
      comment: "Falha anterior",
      createdAt: now,
      updatedAt: now,
    };
    await phase4Store.client.$executeRawUnsafe(
      `INSERT INTO test_run_cases (id,workspace_id,project_id,test_run_id,test_case_id,position,case_sequence_snapshot,human_id_snapshot,title_snapshot,severity_snapshot,priority_snapshot,definition_snapshot,custom_fields_snapshot,tags_snapshot,result,executed_by,executed_at,comment,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      oldRunCase.id,
      oldRunCase.workspaceId,
      oldRunCase.projectId,
      oldRunCase.testRunId,
      oldRunCase.testCaseId,
      oldRunCase.position,
      oldRunCase.caseSequenceSnapshot,
      oldRunCase.humanIdSnapshot,
      oldRunCase.titleSnapshot,
      oldRunCase.severitySnapshot,
      oldRunCase.prioritySnapshot,
      JSON.stringify(oldRunCase.definitionSnapshot),
      JSON.stringify(oldRunCase.customFieldsSnapshot),
      JSON.stringify(oldRunCase.tagsSnapshot),
      oldRunCase.result,
      oldRunCase.executedBy,
      oldRunCase.executedAt,
      oldRunCase.comment,
      oldRunCase.createdAt,
      oldRunCase.updatedAt,
    );
    await phase4Store.client.testRunStep.create({
      data: {
        id: upgradeRunStep,
        workspaceId: upgradeWorkspace,
        projectId: upgradeProject,
        testRunId: upgradeRun,
        testRunCaseId: upgradeRunCase,
        sourceStepId: upgradeTestStep,
        position: 1,
        actionSnapshot: 'Ação anterior',
        expectedResultSnapshot: 'Esperado',
        actualResult: 'Falhou',
        result: 'FAILED',
        executedBy: m.userId,
        executedAt: now,
      },
    });
    await phase4Store.client.executionComment.create({
      data: {
        id: upgradeComment,
        workspaceId: upgradeWorkspace,
        projectId: upgradeProject,
        testRunId: upgradeRun,
        runCaseId: upgradeRunCase,
        runStepId: upgradeRunStep,
        text: 'Comentário anterior',
        createdBy: m.userId,
        createdAt: now,
      },
    });
  } finally {
    await phase4Store.onModuleDestroy();
  }
  // Stage the previous defect migration and seed a linked private attachment.
  await mkdir(resolve(migrations, '202610020005_defects'));
  await copyFile(
    resolve(migrationRoot, '202610020005_defects', 'migration.sql'),
    resolve(migrations, '202610020005_defects/migration.sql'),
  );
  execFileSync(
    process.execPath,
    [
      resolve('node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--config',
      upgradeConfig,
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: url,
        DB_USERNAME: '',
        DB_PASSWORD: '',
        NODE_ENV: 'test',
        DATABASE_DIALECT: dialect,
      },
      timeout: 120000,
      stdio: 'pipe',
    },
  );
  const phase5Store = new PrismaWorkspaceStore({
    ...testConfig,
    testVault: {keys: JSON.stringify({v1: randomBytes(32).toString("base64")}), activeKeyId:"v1"},
    database: databaseSettings({
      DATABASE_URL: url,
      NODE_ENV: 'test',
      DATABASE_DIALECT: dialect,
    }),
  });
  try {
    const m = await phase5Store.client.workspaceMember.findFirstOrThrow({
      where: { workspaceId: upgradeWorkspace },
    });
    const now = new Date();
    await phase5Store.client.attachment.create({
      data: {
        id: upgradeAttachment,
        workspaceId: upgradeWorkspace,
        storageKey: randomUUID(),
        originalName: 'anterior.txt',
        contentType: 'text/plain',
        sizeBytes: 5,
        checksum: 'a'.repeat(64),
        uploadedBy: m.userId,
        createdAt: now,
      },
    });
    await phase5Store.client.defect.create({
      select: { id: true },
      data: {
        id: upgradeDefect,
        workspaceId: upgradeWorkspace,
        projectId: upgradeProject,
        sequence: 1,
        title: 'Defeito anterior',
        description: 'Preservado',
        severity: 'CRITICAL',
        status: 'OPEN',
        testRunCaseId: upgradeRunCase,
        externalSystem: 'tracker',
        externalIssueId: 'QA-1',
        externalUrl: 'https://example.com/QA-1',
        version: 2,
        createdBy: m.userId,
        createdAt: now,
        updatedAt: now,
      },
    });
    await phase5Store.client.defectAttachment.create({
      data: {
        id: randomUUID(),
        workspaceId: upgradeWorkspace,
        projectId: upgradeProject,
        defectId: upgradeDefect,
        attachmentId: upgradeAttachment,
      },
    });
    await phase5Store.client.auditEvent.createMany({data:upgradeDefectAuditIds.map((id,i)=>({
      id, workspaceId:i===3?randomUUID():upgradeWorkspace, actorUserId:m.userId,
      action:['defect.created_from_failure','defect.status_changed','defect.external_linked','defect.status_changed'][i],
      entityType:'Defect',entityId:upgradeDefect, occurredAt:new Date(now.getTime()+i),correlationId:randomUUID(),
    }))});
  } finally {
    await phase5Store.onModuleDestroy();
  }
  // Seed an existing goal using the pre-section schema, then apply additive migrations.
  for (const name of [
    '202610030006_governance',
    '202610040007_dashboard_indexes',
  ]) {
    await mkdir(resolve(migrations, name));
    await copyFile(
      resolve(migrationRoot, name, 'migration.sql'),
      resolve(migrations, name, 'migration.sql'),
    );
  }
  execFileSync(
    process.execPath,
    [
      resolve('node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--config',
      upgradeConfig,
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: url,
        DB_USERNAME: '',
        DB_PASSWORD: '',
        NODE_ENV: 'test',
        DATABASE_DIALECT: dialect,
      },
      timeout: 120000,
      stdio: 'pipe',
    },
  );
  const phase7Store = new PrismaWorkspaceStore({
    ...testConfig,
    testVault: {keys: JSON.stringify({v1: randomBytes(32).toString("base64")}), activeKeyId:"v1"},
    database: databaseSettings({
      DATABASE_URL: url,
      NODE_ENV: 'test',
      DATABASE_DIALECT: dialect,
    }),
  });
  try {
    const m = await phase7Store.client.workspaceMember.findFirstOrThrow({
      where: { workspaceId: upgradeWorkspace },
    });
    await phase7Store.client.governanceGoal.create({
      select: { id: true },
      data: {
        id: upgradeGoal,
        workspaceId: upgradeWorkspace,
        projectId: upgradeProject,
        name: 'Meta anterior',
        goalType: 'AUTOMATION_COVERAGE',
        operator: 'GTE',
        targetValue: 80,
        status: 'ACTIVE',
        version: 2,
        createdBy: m.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } finally {
    await phase7Store.onModuleDestroy();
  }
  execFileSync(
    process.execPath,
    [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    {
      env: {
        ...process.env,
        DATABASE_URL: url,
        DB_USERNAME: '',
        DB_PASSWORD: '',
        NODE_ENV: 'test',
        DATABASE_DIALECT: dialect,
      },
      timeout: 120000,
      stdio: 'pipe',
    },
  );
  const config = {
    ...testConfig,
    testVault: {keys: JSON.stringify({v1: randomBytes(32).toString("base64")}), activeKeyId:"v1"},
    database: databaseSettings({
      DATABASE_URL: url,
      NODE_ENV: 'test',
      DATABASE_DIALECT: dialect,
    }),
    workspace: {
      ...testConfig.workspace,
      maxFileBytes: 1024,
    },
  };
  identity = new PrismaIdentityStore(config);
  store = new PrismaWorkspaceStore(config);
  const h = harness(identity);
  async function account(): Promise<Account> {
    const email = `${randomUUID()}@example.com`;
    const user = await register(h, email);
    const pair = await h.service.login(
      email,
      'VerySecurePassword123!',
      h.requestId,
    );
    return { id: user.id, email, token: pair.accessToken };
  }
  owner = await account();
  otherOwner = await account();
  member = await account();
  peer = await account();
  app = await createApp({
    dashboardClock: () => overviewTime ?? new Date(),
    config,
    store: identity,
    workspaceStore: store,
    mail: new FakeEmail(),
    invitationMail: mail,
    fileStorage: storage,
  });
  // Keep one loopback listener for the suite instead of closing an ephemeral
  // Supertest listener after every request (Node HTTP keep-alive may reuse it).
  await app.listen(0, '127.0.0.1');
});
afterAll(async () => {
  await app?.close();
  await identity?.onModuleDestroy();
  await store?.onModuleDestroy();
  if (admin) {
    try {
      if (created && /^lambdaquality_test_[a-f0-9]{12}$/.test(databaseName))
        await admin.query(`DROP DATABASE \`${databaseName}\``);
    } finally {
      await admin.end();
    }
  }
  await container?.stop();
  if (upgradeDirectory.startsWith(resolve('.local') + sep))
    await rm(upgradeDirectory, { recursive: true, force: true });
});
async function workspace(account = owner) {
  const res = await http()
    .post('/api/v1/workspaces')
    .set('Authorization', auth(account))
    .send({ name: 'Equipe de testes', slug: `team-${randomUUID()}` })
    .expect(201);
  return res.body.data as { id: string; ownerMemberId: string };
}
async function join(ws: string, account = member) {
  await http()
    .post(`/api/v1/workspaces/${ws}/invitations`)
    .set('Authorization', auth(owner))
    .send({ email: account.email })
    .expect(202);
  const token = mail.token();
  const accepted = await http()
    .post('/api/v1/invitations/accept')
    .set('Authorization', auth(account))
    .send({ token })
    .expect(200);
  return accepted.body.data as { id: string; workspaceId: string };
}
describe('Workspace phase with MySQL/MariaDB, real migrations and HTTP', () => {
  it('creates ownership atomically, preserves identity and isolates workspace discovery', async () => {
    const count = await identity.client.user.count();
    const a = await workspace();
    const b = await workspace(otherOwner);
    expect(await identity.client.user.count()).toBe(count);
    const record = await store.client.workspace.findUniqueOrThrow({
      where: { id: a.id },
    });
    expect(record.ownerMemberId).toBe(a.ownerMemberId);
    expect(
      (await store.client.permission.findMany()).map((p) => p.code).sort(),
    ).toEqual([...PERMISSIONS].sort());
    const list = await http()
      .get('/api/v1/workspaces')
      .set('Authorization', auth(owner))
      .expect(200);
    expect(list.body.data.some((w: { id: string }) => w.id === a.id)).toBe(
      true,
    );
    expect(list.body.data.some((w: { id: string }) => w.id === b.id)).toBe(
      false,
    );
    const hidden = await http()
      .get(`/api/v1/workspaces/${b.id}`)
      .set('Authorization', auth(owner))
      .expect(404);
    expect(hidden.body.code).toBe('RESOURCE_NOT_FOUND');
    const duplicate = await http()
      .post('/api/v1/workspaces')
      .set('Authorization', auth(owner))
      .send({ name: 'Duplicado', slug: record.slug })
      .expect(409);
    expect(duplicate.body.code).toBe('RESOURCE_CONFLICT');
    await http()
      .patch(`/api/v1/workspaces/${a.id}`)
      .set('Authorization', auth(owner))
      .send({ name: 'Renomeado' })
      .expect(200);
    await http()
      .get(`/api/v1/workspaces/${a.id}?unexpected=1`)
      .set('Authorization', auth(owner))
      .expect(400);
    await http()
      .patch(`/api/v1/workspaces/${a.id}`)
      .set('Authorization', auth(owner))
      .send({ name: null })
      .expect(400);
  });
  it('accepts once under concurrency, checks email and never exposes invitation secrets', async () => {
    const ws = await workspace();
    const createdInvite = await http()
      .post(`/api/v1/workspaces/${ws.id}/invitations`)
      .set('Authorization', auth(owner))
      .send({ email: member.email })
      .expect(202);
    const token = mail.token();
    expect(createdInvite.body.data.deliveryStatus).toBe('SENT');
    expect(createdInvite.text).not.toContain(token);
    expect(createdInvite.body.data).not.toHaveProperty('tokenHash');
    await http()
      .post('/api/v1/invitations/accept')
      .set('Authorization', auth(peer))
      .send({ token })
      .expect(400);
    const results = await Promise.all([
      http()
        .post('/api/v1/invitations/accept')
        .set('Authorization', auth(member))
        .send({ token }),
      http()
        .post('/api/v1/invitations/accept')
        .set('Authorization', auth(member))
        .send({ token }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results[0].body.data.id).toBe(results[1].body.data.id);
    expect(
      await store.client.workspaceMember.count({
        where: { workspaceId: ws.id, userId: member.id },
      }),
    ).toBe(1);
    expect(
      await identity.client.auditEvent.count({
        where: {
          entityId: createdInvite.body.data.id,
          action: 'workspace.invitation_accepted',
        },
      }),
    ).toBe(1);
    const lookup = await store.client.invitation.findUniqueOrThrow({
      where: { id: createdInvite.body.data.id },
    });
    expect(lookup.tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(lookup.deliveryPayload).toBeNull();
    await http()
      .post(`/api/v1/workspaces/${ws.id}/invitations`)
      .set('Authorization', auth(owner))
      .send({ email: member.email })
      .expect(409);
  });
  it('recovers failed delivery, enforces cooldown and invalidates tokens on resend/cancel/expiry', async () => {
    const ws = await workspace();
    mail.fail = true;
    const invite = await http()
      .post(`/api/v1/workspaces/${ws.id}/invitations`)
      .set('Authorization', auth(owner))
      .send({ email: peer.email })
      .expect(202);
    mail.fail = false;
    const old = mail.token();
    expect(invite.body.data.deliveryStatus).toBe('FAILED');
    const encrypted = await store.client.invitation.findUniqueOrThrow({
      where: { id: invite.body.data.id },
    });
    expect(encrypted.deliveryPayload).not.toContain(old);
    await store.client.invitation.update({
      where: { id: invite.body.data.id },
      data: { lastSentAt: new Date(Date.now() - 61000) },
    });
    await app.get<Invitations>(INVITATIONS).processPending();
    expect(
      (
        await http()
          .get(`/api/v1/workspaces/${ws.id}/invitations/${invite.body.data.id}`)
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.data.deliveryStatus,
    ).toBe('SENT');
    const cooldown = await http()
      .post(
        `/api/v1/workspaces/${ws.id}/invitations/${invite.body.data.id}/resend`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(429);
    expect(Number(cooldown.headers['retry-after'])).toBeGreaterThan(0);
    await store.client.invitation.update({
      where: { id: invite.body.data.id },
      data: { lastSentAt: new Date(Date.now() - 61000) },
    });
    await http()
      .post(
        `/api/v1/workspaces/${ws.id}/invitations/${invite.body.data.id}/resend`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(202);
    const fresh = mail.token();
    expect(fresh).not.toBe(old);
    await http()
      .post('/api/v1/invitations/accept')
      .set('Authorization', auth(peer))
      .send({ token: old })
      .expect(400);
    await store.client.invitation.update({
      where: { id: invite.body.data.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (
        await http()
          .get(`/api/v1/workspaces/${ws.id}/invitations?status=EXPIRED`)
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(1);
    await http()
      .post('/api/v1/invitations/accept')
      .set('Authorization', auth(peer))
      .send({ token: fresh })
      .expect(400);
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/invitations/${invite.body.data.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
  });
  it('revokes only the removed workspace and reentry does not restore privileged roles', async () => {
    const a = await workspace();
    const b = await workspace();
    const membership = await join(a.id);
    await join(b.id);
    const adminRole = await store.client.role.findFirstOrThrow({
      where: { workspaceId: a.id, normalizedName: 'administrator' },
    });
    await http()
      .put(
        `/api/v1/workspaces/${a.id}/members/${membership.id}/roles/${adminRole.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .patch(`/api/v1/workspaces/${a.id}/members/${membership.id}`)
      .set('Authorization', auth(owner))
      .send({ status: 'SUSPENDED' })
      .expect(200);
    await http()
      .get(`/api/v1/workspaces/${a.id}`)
      .set('Authorization', auth(member))
      .expect(404);
    await http()
      .get(`/api/v1/workspaces/${b.id}`)
      .set('Authorization', auth(member))
      .expect(200);
    await http()
      .post(`/api/v1/workspaces/${a.id}/invitations`)
      .set('Authorization', auth(owner))
      .send({ email: member.email })
      .expect(409);
    await http()
      .patch(`/api/v1/workspaces/${a.id}/members/${membership.id}`)
      .set('Authorization', auth(owner))
      .send({ status: 'ACTIVE' })
      .expect(200);
    await http()
      .delete(`/api/v1/workspaces/${a.id}/members/${membership.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', auth(member))
      .expect(200);
    expect((await join(a.id)).id).toBe(membership.id);
    await http()
      .post(`/api/v1/workspaces/${a.id}/groups`)
      .set('Authorization', auth(member))
      .send({ name: 'Não autorizado' })
      .expect(403);
    expect(
      await store.client.memberRole.count({
        where: {
          workspaceId: a.id,
          memberId: membership.id,
          roleId: adminRole.id,
        },
      }),
    ).toBe(0);
  });
  it('resolves direct and group grants, revokes immediately and does not duplicate filtered members', async () => {
    const ws = await workspace();
    const membership = await join(ws.id);
    const role = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/roles`)
        .set('Authorization', auth(owner))
        .send({ name: 'Upload', permissionCodes: ['attachment.upload'] })
        .expect(201)
    ).body.data;
    const group = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/groups`)
        .set('Authorization', auth(owner))
        .send({ name: 'QA' })
        .expect(201)
    ).body.data;
    await http()
      .put(
        `/api/v1/workspaces/${ws.id}/members/${membership.id}/roles/${role.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .put(`/api/v1/workspaces/${ws.id}/groups/${group.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .put(
        `/api/v1/workspaces/${ws.id}/groups/${group.id}/members/${membership.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    const list = await http()
      .get(
        `/api/v1/workspaces/${ws.id}/members?roleId=${role.id}&groupId=${group.id}&size=1`,
      )
      .set('Authorization', auth(owner))
      .expect(200);
    expect(list.body.meta.pagination.totalItems).toBe(1);
    expect(
      list.body.data[0].roles.filter((r: { id: string }) => r.id === role.id),
    ).toHaveLength(2);
    expect(
      (
        await http()
          .get(`/api/v1/workspaces/${ws.id}/members`)
          .query({ q: member.email })
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(1);
    expect(
      (
        await http()
          .get(`/api/v1/workspaces/${ws.id}/members`)
          .query({ q: otherOwner.email })
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(0);
    await http()
      .delete(
        `/api/v1/workspaces/${ws.id}/members/${membership.id}/roles/${role.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .post(`/api/v1/workspaces/${ws.id}/attachments`)
      .set('Authorization', auth(member))
      .attach('file', Buffer.from('evidence'), 'test.txt')
      .expect(201);
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/groups/${group.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .post(`/api/v1/workspaces/${ws.id}/attachments`)
      .set('Authorization', auth(member))
      .attach('file', Buffer.from('blocked'), 'test.txt')
      .expect(403);
    await http()
      .patch(`/api/v1/workspaces/${ws.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({ name: 'Upload revisado' })
      .expect(200);
    await http()
      .get(`/api/v1/workspaces/${ws.id}/groups/${group.id}/members`)
      .set('Authorization', auth(owner))
      .expect(200);
    await http()
      .patch(`/api/v1/workspaces/${ws.id}/groups/${group.id}`)
      .set('Authorization', auth(owner))
      .send({ description: 'Equipe QA' })
      .expect(200);
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/groups/${group.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
  });
  it('prevents role and group privilege escalation and protects system roles', async () => {
    const ws = await workspace();
    const membership = await join(ws.id);
    const role = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/roles`)
        .set('Authorization', auth(owner))
        .send({
          name: 'Delegado',
          permissionCodes: [
            'workspace.manage_roles',
            'workspace.manage_groups',
          ],
        })
        .expect(201)
    ).body.data;
    await http()
      .put(
        `/api/v1/workspaces/${ws.id}/members/${membership.id}/roles/${role.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .post(`/api/v1/workspaces/${ws.id}/roles`)
      .set('Authorization', auth(member))
      .send({ name: 'Escalada', permissionCodes: ['attachment.delete'] })
      .expect(403);
    await http()
      .patch(`/api/v1/workspaces/${ws.id}/roles/${role.id}`)
      .set('Authorization', auth(member))
      .send({ permissionCodes: ['attachment.delete'] })
      .expect(403);
    const adminRole = await store.client.role.findFirstOrThrow({
      where: { workspaceId: ws.id, normalizedName: 'administrator' },
    });
    await http()
      .patch(`/api/v1/workspaces/${ws.id}/roles/${adminRole.id}`)
      .set('Authorization', auth(owner))
      .send({ name: 'Admin' })
      .expect(409);
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(409);
    const group = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/groups`)
        .set('Authorization', auth(owner))
        .send({ name: 'Administradores' })
        .expect(201)
    ).body.data;
    await http()
      .put(
        `/api/v1/workspaces/${ws.id}/groups/${group.id}/roles/${adminRole.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .put(
        `/api/v1/workspaces/${ws.id}/groups/${group.id}/members/${membership.id}`,
      )
      .set('Authorization', auth(member))
      .send({})
      .expect(403);
  });
  it('guards ownership under concurrent transfers and enforces composite tenant FKs', async () => {
    const ws = await workspace();
    const first = await join(ws.id);
    const second = await join(ws.id, peer);
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/members/${ws.ownerMemberId}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(409);
    const replies = await Promise.all(
      [first, second].map((target) =>
        http()
          .post(`/api/v1/workspaces/${ws.id}/ownership/transfer`)
          .set('Authorization', auth(owner))
          .send({ memberId: target.id }),
      ),
    );
    expect(replies.map((r) => r.status).sort()).toEqual([200, 403]);
    const record = await store.client.workspace.findUniqueOrThrow({
      where: { id: ws.id },
    });
    expect([first.id, second.id]).toContain(record.ownerMemberId);
    const foreign = await workspace(otherOwner);
    const foreignRole = await store.client.role.findFirstOrThrow({
      where: { workspaceId: foreign.id },
    });
    await http()
      .put(
        `/api/v1/workspaces/${ws.id}/members/${first.id}/roles/${foreignRole.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(404);
    await expect(
      store.client.memberRole.create({
        data: {
          id: randomUUID(),
          workspaceId: ws.id,
          memberId: first.id,
          roleId: foreignRole.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      store.client.workspace.update({
        where: { id: foreign.id },
        data: { ownerMemberId: first.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it('keeps custom-field definitions immutable, validates options and archives without deleting history', async () => {
    const ws = await workspace();
    await join(ws.id);
    const base = {
      key: 'impact',
      name: 'Impacto',
      type: 'SINGLE_SELECT',
      target: 'TEST_CASE',
      options: ['Alta', 'Baixa'],
    };
    const field = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/custom-fields`)
        .set('Authorization', auth(owner))
        .send(base)
        .expect(201)
    ).body.data;
    expect(field.options[0].id).toMatch(/^[0-9a-f-]{36}$/);
    await http()
      .post(`/api/v1/workspaces/${ws.id}/custom-fields`)
      .set('Authorization', auth(owner))
      .send({ ...base, key: 'bad', options: ['Alta', 'alta'] })
      .expect(400);
    await http()
      .patch(`/api/v1/workspaces/${ws.id}/custom-fields/${field.id}`)
      .set('Authorization', auth(owner))
      .send({ type: 'TEXT' })
      .expect(400);
    await http()
      .patch(`/api/v1/workspaces/${ws.id}/custom-fields/${field.id}`)
      .set('Authorization', auth(owner))
      .send({ required: null })
      .expect(400);
    await http()
      .patch(`/api/v1/workspaces/${ws.id}/custom-fields/${field.id}`)
      .set('Authorization', auth(owner))
      .send({ name: 'Impacto revisado', required: true })
      .expect(200);
    await http()
      .post(`/api/v1/workspaces/${ws.id}/custom-fields`)
      .set('Authorization', auth(member))
      .send({ ...base, key: 'blocked' })
      .expect(403);
    await http()
      .post(`/api/v1/workspaces/${ws.id}/custom-fields/${field.id}/archive`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(200);
    expect(
      (
        await http()
          .get(`/api/v1/workspaces/${ws.id}/custom-fields`)
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(0);
    expect(
      (
        await http()
          .get(`/api/v1/workspaces/${ws.id}/custom-fields?status=ARCHIVED`)
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(1);
    expect(
      (
        await http()
          .get(`/api/v1/workspaces/${ws.id}/custom-fields/${field.id}`)
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.data.options,
    ).toEqual(field.options);
  });
  it('isolates catalog queries, rejects duplicate names and binds search values safely', async () => {
    const a = await workspace();
    const b = await workspace(otherOwner);
    const tag = (
      await http()
        .post(`/api/v1/workspaces/${a.id}/tags`)
        .set('Authorization', auth(owner))
        .send({ name: 'Smoke' })
        .expect(201)
    ).body.data;
    await http()
      .post(`/api/v1/workspaces/${a.id}/tags`)
      .set('Authorization', auth(owner))
      .send({ name: ' smoke ' })
      .expect(409);
    await http()
      .get(`/api/v1/workspaces/${b.id}/tags/${tag.id}`)
      .set('Authorization', auth(otherOwner))
      .expect(404);
    expect(
      (
        await http()
          .get(`/api/v1/workspaces/${b.id}/tags?q=Smoke`)
          .set('Authorization', auth(otherOwner))
          .expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(0);
    const search = await http()
      .get(`/api/v1/workspaces/${a.id}/tags`)
      .query({ q: "%' OR 1=1 --" })
      .set('Authorization', auth(owner))
      .expect(200);
    expect(search.body.meta.pagination.totalItems).toBe(0);
    await http()
      .get(`/api/v1/workspaces/${a.id}/tags?sort=passwordHash,asc`)
      .set('Authorization', auth(owner))
      .expect(400);
    await http()
      .get(`/api/v1/workspaces/${a.id}/tags?size=101`)
      .set('Authorization', auth(owner))
      .expect(400);
    await http()
      .patch(`/api/v1/workspaces/${a.id}/tags/${tag.id}`)
      .set('Authorization', auth(owner))
      .send({ name: 'Regression' })
      .expect(200);
    await http()
      .delete(`/api/v1/workspaces/${a.id}/tags/${tag.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
  });
  it.each(['missing configuration', 'OCI access denied', 'public bucket'])(
    'keeps the application available with %s and returns private storage errors without creating metadata',
    async (failure) => {
      const ws = await workspace();
      const existing = await http()
        .post(`/api/v1/workspaces/${ws.id}/attachments`)
        .set('Authorization', auth(owner))
        .attach('file', Buffer.from('prior evidence'), 'previous.txt')
        .expect(201);
      const source = vi.fn(() => {
        if (failure === 'missing configuration')
          return loadObjectStorageConfig({});
        return testConfig.objectStorage;
      });
      const network = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async () =>
          failure === 'public bucket'
            ? new Response(JSON.stringify({ publicAccessType: 'ObjectRead' }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              })
            : new Response(
                JSON.stringify({
                  code: 'NotAuthorized',
                  message: 'Access denied',
                }),
                {
                  status: 403,
                  headers: { 'content-type': 'application/json' },
                },
              ),
        );
      let degraded: INestApplication | undefined;
      try {
        degraded = await createApp({
          config: { ...app.get<AppConfig>(CONFIG), objectStorage: source },
          mail: new FakeEmail(),
          invitationMail: new FakeInvitationMail(),
        });
        await degraded.listen(0, '127.0.0.1');
        const api = request(degraded.getHttpServer());
        await api.get('/api/v1/health/ready').expect(200);
        await api
          .get('/api/v1/auth/me')
          .set('Authorization', auth(owner))
          .expect(200);
        await api
          .get(`/api/v1/workspaces/${ws.id}/attachments`)
          .set('Authorization', auth(owner))
          .expect(200);
        await api
          .post(`/api/v1/workspaces/${ws.id}/attachments`)
          .set('Authorization', auth(otherOwner))
          .attach('file', Buffer.from('evidence'), 'denied.txt')
          .expect(404);
        expect(source).not.toHaveBeenCalled();
        expect(network).not.toHaveBeenCalled();
        const failed = await api
          .post(`/api/v1/workspaces/${ws.id}/attachments`)
          .set('Authorization', auth(owner))
          .attach('file', Buffer.from('evidence'), 'failed.txt')
          .expect(503);
        expect(failed.type).toBe('application/problem+json');
        expect(failed.body.code).toBe('ATTACHMENT_STORAGE_UNAVAILABLE');
        expect(failed.body.detail).toBe(
          'Não foi possível anexar o arquivo. O serviço de armazenamento está temporariamente indisponível. Tente novamente mais tarde.',
        );
        expect(failed.body.requestId).toBe(failed.headers['x-request-id']);
        expect(JSON.stringify(failed.body)).not.toMatch(
          /PEM|fingerprint|NotAuthorized|ocid1|Access denied/,
        );
        await api
          .get(
            `/api/v1/workspaces/${ws.id}/attachments/${existing.body.data.id}`,
          )
          .set('Authorization', auth(owner))
          .expect(200);
        const download = await api
          .get(
            `/api/v1/workspaces/${ws.id}/attachments/${existing.body.data.id}/download`,
          )
          .set('Authorization', auth(owner))
          .expect(503);
        expect(download.body.code).toBe('ATTACHMENT_STORAGE_UNAVAILABLE');
        expect(
          await store.client.attachment.count({
            where: { workspaceId: ws.id },
          }),
        ).toBe(1);
        expect(
          await store.client.auditEvent.count({
            where: { workspaceId: ws.id, action: 'attachment.uploaded' },
          }),
        ).toBe(1);
        await api.get('/api/v1/health/ready').expect(200);
      } finally {
        await degraded?.close();
        network.mockRestore();
      }
    },
  );
  it('serves authorized private bytes, rejects spoofed/large files and cleans deleted files and old orphans', async () => {
    const ws = await workspace();
    await join(ws.id);
    const upload = await http()
      .post(`/api/v1/workspaces/${ws.id}/attachments`)
      .set('Authorization', auth(owner))
      .attach('file', Buffer.from('evidence'), 'relatório.txt')
      .expect(201);
    const file = upload.body.data;
    expect(file.originalName).toBe('relatório.txt');
    expect(file).not.toHaveProperty('storageKey');
    expect(file.checksum).toBe(
      createHash('sha256').update('evidence').digest('hex'),
    );
    const download = await http()
      .get(`/api/v1/workspaces/${ws.id}/attachments/${file.id}/download`)
      .set('Authorization', auth(member))
      .expect(200);
    expect(download.text).toBe('evidence');
    expect(download.headers['content-disposition']).toContain('attachment;');
    expect(download.headers['content-disposition']).toContain(
      'relat%C3%B3rio.txt',
    );
    expect(download.headers['cache-control']).toBe('no-store');
    await http()
      .get(`/api/v1/workspaces/${ws.id}/attachments/${file.id}/download`)
      .set('Authorization', auth(otherOwner))
      .expect(404);
    await http()
      .post(`/api/v1/workspaces/${ws.id}/attachments`)
      .set('Authorization', auth(owner))
      .attach('file', Buffer.from('not a PDF'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    await http()
      .post(`/api/v1/workspaces/${ws.id}/attachments`)
      .set('Authorization', auth(owner))
      .attach('file', Buffer.alloc(2048, 65), 'large.txt')
      .expect(413);
    storage.fail = true;
    const failedUpload = await http()
      .post(`/api/v1/workspaces/${ws.id}/attachments`)
      .set('Authorization', auth(owner))
      .attach('file', Buffer.from('fail'), 'failure.txt')
      .expect(503);
    expect(failedUpload.body.code).toBe('ATTACHMENT_STORAGE_UNAVAILABLE');
    expect(failedUpload.body.detail).toBe(
      'Não foi possível anexar o arquivo. O serviço de armazenamento está temporariamente indisponível. Tente novamente mais tarde.',
    );
    expect(JSON.stringify(failedUpload.body)).not.toContain(
      'storage secret failure',
    );
    storage.fail = false;
    expect(
      await store.client.attachment.count({ where: { workspaceId: ws.id } }),
    ).toBe(1);
    const beforeFiles = storage.files.size;
    await store.client.$executeRawUnsafe(
      'ALTER TABLE attachments ADD CONSTRAINT injected_storage_rollback_check CHECK (size_bytes <> 17)',
    );
    try {
      await http()
        .post(`/api/v1/workspaces/${ws.id}/attachments`)
        .set('Authorization', auth(owner))
        .attach('file', Buffer.from('rollback evidence'), 'rollback.txt')
        .expect(500);
      expect(storage.files.size).toBe(beforeFiles);
      expect(
        await store.client.attachment.count({ where: { workspaceId: ws.id } }),
      ).toBe(1);
    } finally {
      await store.client.$executeRawUnsafe(
        `ALTER TABLE attachments DROP ${dialect === 'mariadb' ? 'CONSTRAINT' : 'CHECK'} injected_storage_rollback_check`,
      );
    }
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/attachments/${file.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .get(`/api/v1/workspaces/${ws.id}/attachments/${file.id}/download`)
      .set('Authorization', auth(member))
      .expect(404);
    await store.client.attachment.update({
      where: { id: file.id },
      data: { deletedAt: new Date(Date.now() - 31 * 86400000) },
    });
    const record = await store.client.attachment.findUniqueOrThrow({
      where: { id: file.id },
    });
    const orphan = `${randomUUID()}.blob`;
    storage.files.set(orphan, {
      bytes: Buffer.from('orphan'),
      modifiedAt: new Date(Date.now() - 2 * 86400000),
    });
    await app.get<Attachments>(ATTACHMENTS).cleanup(30);
    expect(storage.files.has(record.storageKey)).toBe(false);
    expect(storage.files.has(orphan)).toBe(false);
    expect(
      await identity.client.auditEvent.count({
        where: { entityId: file.id, workspaceId: ws.id },
      }),
    ).toBeGreaterThanOrEqual(3);
  });
});

async function project(ws: string, key = 'PORTAL') {
  return (
    await http()
      .post(`/api/v1/workspaces/${ws}/projects`)
      .set('Authorization', auth(owner))
      .send({ key, name: 'Portal Cliente' })
      .expect(201)
  ).body.data as { id: string; workspaceId: string; key: string };
}
const projectPath = (ws: string, id: string) =>
  `/api/v1/workspaces/${ws}/projects/${id}`;
describe('Project phase with MySQL/MariaDB and current authorization', () => {
  it('upgrades system roles while preserving existing grants and custom roles', async () => {
    expect(
      await store.client.workspace.count({ where: { id: upgradeWorkspace } }),
    ).toBe(1);
    const codes = async (roleId: string) =>
      (
        await store.client.rolePermission.findMany({
          where: { workspaceId: upgradeWorkspace, roleId },
        })
      )
        .map((r) => r.permissionCode)
        .sort();
    expect(await codes(upgradeAdminRole)).toEqual([...PERMISSIONS].sort());
    expect(await codes(upgradeMemberRole)).toEqual(
      [
        'workspace.read',
        'field.read',
        'tag.read',
        'attachment.read',
        'project.read',
        'testcase.read',
        'testrun.read',
        'defect.read',
        'governance.read',
      ].sort(),
    );
    expect(await codes(upgradeCustomRole)).toEqual(['workspace.read']);
    expect(
      (
        await store.client.project.findUniqueOrThrow({
          where: { id: upgradeProject },
        })
      ).key,
    ).toBe('UPGRADE');
  });
  it('creates project/manager/audit atomically, normalizes keys and enforces composite FKs', async () => {
    const a = await workspace();
    const b = await workspace();
    const result = await http()
      .post(`/api/v1/workspaces/${a.id}/projects`)
      .set('Authorization', auth(owner))
      .send({
        key: ' portal ',
        name: 'Portal Cliente',
        description: 'Aplicação',
      })
      .expect(201);
    const p = result.body.data;
    expect(p.key).toBe('PORTAL');
    expect(p.projectRole).toBe('MANAGER');
    expect(result.headers.location).toBe(projectPath(a.id, p.id));
    expect(
      await store.client.projectMember.count({
        where: {
          workspaceId: a.id,
          projectId: p.id,
          workspaceMemberId: a.ownerMemberId,
        },
      }),
    ).toBe(1);
    expect(
      await store.client.auditEvent.count({
        where: { entityId: p.id, action: 'project.created' },
      }),
    ).toBe(1);
    await http()
      .post(`/api/v1/workspaces/${a.id}/projects`)
      .set('Authorization', auth(owner))
      .send({ key: 'portal', name: 'Duplicado' })
      .expect(409);
    const other = await project(b.id);
    await expect(
      store.client.projectMember.create({
        data: {
          id: randomUUID(),
          workspaceId: a.id,
          projectId: p.id,
          workspaceMemberId: b.ownerMemberId,
          projectRole: 'VIEWER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await http()
      .get(projectPath(a.id, other.id))
      .set('Authorization', auth(owner))
      .expect(404);
    await http()
      .patch(projectPath(a.id, p.id))
      .set('Authorization', auth(owner))
      .send({ key: 'OTHER' })
      .expect(400);
    await http()
      .patch(projectPath(a.id, p.id))
      .set('Authorization', auth(owner))
      .send({ name: null })
      .expect(400);
    const updated = await http()
      .patch(projectPath(a.id, p.id))
      .set('Authorization', auth(owner))
      .send({ name: 'Portal revisado', description: null })
      .expect(200);
    expect(updated.body.data.description).toBeNull();
    const both = await Promise.all(
      [1, 2].map(() =>
        http()
          .post(`/api/v1/workspaces/${a.id}/projects`)
          .set('Authorization', auth(owner))
          .send({ key: 'CONCURRENT', name: 'Concorrente' }),
      ),
    );
    expect(both.map((x) => x.status).sort()).toEqual([201, 409]);
  });
  it('filters discovery/search/counts and intersects local roles with current Workspace permissions', async () => {
    const ws = await workspace();
    const membership = await join(ws.id);
    const p = await project(ws.id);
    const hidden = await project(ws.id, 'PRIVATE');
    const base = projectPath(ws.id, p.id);
    const list = () =>
      http()
        .get(`/api/v1/workspaces/${ws.id}/projects`)
        .set('Authorization', auth(member));
    expect((await list().expect(200)).body.meta.pagination.totalItems).toBe(0);
    await http().get(base).set('Authorization', auth(member)).expect(404);
    await http()
      .put(`${base}/members/${membership.id}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'EDITOR' })
      .expect(200);
    const visible = await list().expect(200);
    expect(visible.body.data.map((x: { id: string }) => x.id)).toEqual([p.id]);
    expect(visible.body.meta.pagination.totalItems).toBe(1);
    expect(
      (await list().query({ q: 'PRIVATE' }).expect(200)).body.meta.pagination
        .totalItems,
    ).toBe(0);
    await http()
      .get(projectPath(ws.id, hidden.id))
      .set('Authorization', auth(member))
      .expect(404);
    await http()
      .patch(base)
      .set('Authorization', auth(member))
      .send({ name: 'Sem permission' })
      .expect(403);
    const role = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/roles`)
        .set('Authorization', auth(owner))
        .send({
          name: 'Editor de projetos',
          permissionCodes: [
            'project.update',
            'milestone.manage',
            'environment.manage',
          ],
        })
        .expect(201)
    ).body.data;
    await http()
      .put(
        `/api/v1/workspaces/${ws.id}/members/${membership.id}/roles/${role.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .patch(base)
      .set('Authorization', auth(member))
      .send({ name: 'Editado' })
      .expect(200);
    const people = await http()
      .get(`${base}/members`)
      .set('Authorization', auth(member))
      .expect(200);
    expect(
      people.body.data.find(
        (m: { workspaceMemberId: string }) =>
          m.workspaceMemberId === membership.id,
      ).user,
    ).not.toHaveProperty('passwordHash');
    await http()
      .delete(
        `/api/v1/workspaces/${ws.id}/members/${membership.id}/roles/${role.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .patch(base)
      .set('Authorization', auth(member))
      .send({ name: 'Revogado' })
      .expect(403);
    await http()
      .delete(`${base}/members/${membership.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .delete(`${base}/members/${membership.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http().get(base).set('Authorization', auth(member)).expect(404);
  });
  it('prevents grants above actor capabilities and administrative visibility does not grant writes', async () => {
    const ws = await workspace();
    const m = await join(ws.id);
    const p = await project(ws.id);
    const p2 = await project(ws.id, 'PRIVATE');
    const base = projectPath(ws.id, p.id);
    await http()
      .put(`${base}/members/${m.id}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'MANAGER' })
      .expect(200);
    const role = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/roles`)
        .set('Authorization', auth(owner))
        .send({
          name: 'Gestor limitado',
          permissionCodes: ['project.manage_members'],
        })
        .expect(201)
    ).body.data;
    await http()
      .put(`/api/v1/workspaces/${ws.id}/members/${m.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .put(`${base}/members/${ws.ownerMemberId}`)
      .set('Authorization', auth(member))
      .send({ projectRole: 'EDITOR' })
      .expect(403);
    await http()
      .put(`${base}/members/${ws.ownerMemberId}`)
      .set('Authorization', auth(member))
      .send({ projectRole: 'VIEWER' })
      .expect(200);
    const visibility = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/roles`)
        .set('Authorization', auth(owner))
        .send({
          name: 'Visibilidade administrativa',
          permissionCodes: ['project.manage_all'],
        })
        .expect(201)
    ).body.data;
    await http()
      .put(`/api/v1/workspaces/${ws.id}/members/${m.id}/roles/${visibility.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .get(projectPath(ws.id, p2.id))
      .set('Authorization', auth(member))
      .expect(200);
    await http()
      .patch(projectPath(ws.id, p2.id))
      .set('Authorization', auth(member))
      .send({ name: 'Proibido' })
      .expect(403);
    const other = await workspace(otherOwner);
    await http()
      .put(`${base}/members/${other.ownerMemberId}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'VIEWER' })
      .expect(404);
  });
  it('revokes membership on suspension/removal and reentry does not recover prior project grants', async () => {
    const ws = await workspace();
    const m = await join(ws.id);
    const p = await project(ws.id);
    const base = projectPath(ws.id, p.id);
    await http()
      .put(`${base}/members/${m.id}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'VIEWER' })
      .expect(200);
    await http()
      .patch(`/api/v1/workspaces/${ws.id}/members/${m.id}`)
      .set('Authorization', auth(owner))
      .send({ status: 'SUSPENDED' })
      .expect(200);
    await http().get(base).set('Authorization', auth(member)).expect(404);
    await http()
      .put(`${base}/members/${m.id}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'VIEWER' })
      .expect(404);
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/members/${m.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    expect(
      await store.client.projectMember.count({
        where: { workspaceId: ws.id, workspaceMemberId: m.id },
      }),
    ).toBe(0);
    const returned = await join(ws.id);
    expect(returned.id).toBe(m.id);
    await http().get(base).set('Authorization', auth(member)).expect(404);
  });
  it('validates calendar dates, scopes milestones by project, and completes once under concurrency', async () => {
    const ws = await workspace();
    const p = await project(ws.id);
    const other = await project(ws.id, 'OTHER');
    const base = `${projectPath(ws.id, p.id)}/milestones`;
    await http()
      .post(base)
      .set('Authorization', auth(owner))
      .send({ name: 'Inválido', startDate: '2026-02-30' })
      .expect(400);
    await http()
      .post(base)
      .set('Authorization', auth(owner))
      .send({
        name: 'Invertido',
        startDate: '2026-10-03',
        dueDate: '2026-10-02',
      })
      .expect(400);
    const row = (
      await http()
        .post(base)
        .set('Authorization', auth(owner))
        .send({
          name: 'Release 1',
          startDate: '2026-10-02',
          dueDate: '2026-10-10',
        })
        .expect(201)
    ).body.data;
    expect(row.startDate).toBe('2026-10-02');
    expect(row.status).toBe('PLANNED');
    expect(
      (
        await http()
          .get(`${base}/${row.id}`)
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.data.dueDate,
    ).toBe('2026-10-10');
    await http()
      .get(`${projectPath(ws.id, other.id)}/milestones/${row.id}`)
      .set('Authorization', auth(owner))
      .expect(404);
    await http()
      .patch(`${base}/${row.id}`)
      .set('Authorization', auth(owner))
      .send({ status: 'IN_PROGRESS', description: 'Preparação' })
      .expect(200);
    const results = await Promise.all(
      [1, 2].map(() =>
        http()
          .post(`${base}/${row.id}/complete`)
          .set('Authorization', auth(owner))
          .send({}),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results[0].body.data.completedAt).toBe(
      results[1].body.data.completedAt,
    );
    expect(
      await store.client.auditEvent.count({
        where: { entityId: row.id, action: 'project.milestone_completed' },
      }),
    ).toBe(1);
    await http()
      .patch(`${base}/${row.id}`)
      .set('Authorization', auth(owner))
      .send({ name: 'Reescrever' })
      .expect(409);
    expect(
      (
        await http()
          .get(base)
          .query({ status: 'COMPLETED', q: 'Release', sort: 'dueDate,desc' })
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(1);
    await http()
      .delete(`${base}/${row.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .delete(`${base}/${row.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .get(`${base}/${row.id}`)
      .set('Authorization', auth(owner))
      .expect(404);
    expect(
      (
        await store.client.milestone.findUniqueOrThrow({
          where: { id: row.id },
        })
      ).completedAt,
    ).not.toBeNull();
    const cancel = (
      await http()
        .post(base)
        .set('Authorization', auth(owner))
        .send({ name: 'Cancelável' })
        .expect(201)
    ).body.data;
    await http()
      .patch(`${base}/${cancel.id}`)
      .set('Authorization', auth(owner))
      .send({ status: 'CANCELLED', startDate: null })
      .expect(200);
    await http()
      .post(`${base}/${cancel.id}/complete`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(409);
  });
  it('administers environments without exposing normalized names, reserves deleted names and binds queries', async () => {
    const ws = await workspace();
    const p = await project(ws.id);
    const other = await project(ws.id, 'OTHER');
    const base = `${projectPath(ws.id, p.id)}/environments`;
    const row = (
      await http()
        .post(base)
        .set('Authorization', auth(owner))
        .send({ name: 'HML' })
        .expect(201)
    ).body.data;
    expect(row.active).toBe(true);
    expect(row).not.toHaveProperty('normalizedName');
    await http()
      .post(base)
      .set('Authorization', auth(owner))
      .send({ name: ' hml ' })
      .expect(409);
    await http()
      .post(`${projectPath(ws.id, other.id)}/environments`)
      .set('Authorization', auth(owner))
      .send({ name: 'HML' })
      .expect(201);
    await http()
      .get(`${projectPath(ws.id, other.id)}/environments/${row.id}`)
      .set('Authorization', auth(owner))
      .expect(404);
    await http()
      .patch(`${base}/${row.id}`)
      .set('Authorization', auth(owner))
      .send({ active: null })
      .expect(400);
    await http()
      .patch(`${base}/${row.id}`)
      .set('Authorization', auth(owner))
      .send({ active: false, name: 'Homologação', description: null })
      .expect(200);
    expect(
      (
        await http()
          .get(base)
          .query({ active: 'false', q: 'Homologação' })
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(1);
    expect(
      (
        await http()
          .get(base)
          .query({ q: "%' OR 1=1 --" })
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.data,
    ).toEqual([]);
    await http()
      .get(base)
      .query({ active: '1' })
      .set('Authorization', auth(owner))
      .expect(400);
    await http()
      .get(base)
      .query({ sort: 'passwordHash,asc' })
      .set('Authorization', auth(owner))
      .expect(400);
    await http()
      .get(base)
      .query({ size: 101 })
      .set('Authorization', auth(owner))
      .expect(400);
    await http()
      .delete(`${base}/${row.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .delete(`${base}/${row.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await http()
      .get(`${base}/${row.id}`)
      .set('Authorization', auth(owner))
      .expect(404);
    await http()
      .post(base)
      .set('Authorization', auth(owner))
      .send({ name: 'Homologação' })
      .expect(409);
    expect(
      (
        await store.client.environment.findUniqueOrThrow({
          where: { id: row.id },
        })
      ).deletedAt,
    ).not.toBeNull();
  });
  it('serializes archival with writes, preserves all records and rejects archived mutations', async () => {
    const ws = await workspace();
    const p = await project(ws.id);
    const base = projectPath(ws.id, p.id);
    const ms = (
      await http()
        .post(`${base}/milestones`)
        .set('Authorization', auth(owner))
        .send({ name: 'Marco' })
        .expect(201)
    ).body.data;
    const env = (
      await http()
        .post(`${base}/environments`)
        .set('Authorization', auth(owner))
        .send({ name: 'Ambiente' })
        .expect(201)
    ).body.data;
    const both = await Promise.all([
      http().post(`${base}/archive`).set('Authorization', auth(owner)).send({}),
      http()
        .patch(base)
        .set('Authorization', auth(owner))
        .send({ name: 'Concorrência' }),
    ]);
    expect(both[0].status).toBe(200);
    expect([200, 409]).toContain(both[1].status);
    const repeat = await http()
      .post(`${base}/archive`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(200);
    expect(repeat.body.data.archivedAt).toBe(both[0].body.data.archivedAt);
    await http().get(base).set('Authorization', auth(owner)).expect(200);
    await http()
      .get(`${base}/milestones/${ms.id}`)
      .set('Authorization', auth(owner))
      .expect(200);
    await http()
      .get(`${base}/environments/${env.id}`)
      .set('Authorization', auth(owner))
      .expect(200);
    for (const path of ['milestones', 'environments'])
      await http()
        .post(`${base}/${path}`)
        .set('Authorization', auth(owner))
        .send({ name: 'Bloqueado' })
        .expect(409);
    await http()
      .put(`${base}/members/${ws.ownerMemberId}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'VIEWER' })
      .expect(409);
    await http()
      .delete(`${base}/milestones/${ms.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(409);
    await http()
      .delete(`${base}/environments/${env.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(409);
    expect(
      (
        await http()
          .get(`/api/v1/workspaces/${ws.id}/projects`)
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.data,
    ).toEqual([]);
    expect(
      (
        await http()
          .get(`/api/v1/workspaces/${ws.id}/projects?status=ARCHIVED`)
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(1);
    expect(
      await store.client.projectMember.count({
        where: { workspaceId: ws.id, projectId: p.id },
      }),
    ).toBe(1);
  });
});

describe('Phase 03 test management with MySQL/MariaDB and HTTP', () => {
  async function setupCases() {
    const ws = await workspace();
    const project = await http()
      .post(`/api/v1/workspaces/${ws.id}/projects`)
      .set('Authorization', auth(owner))
      .send({ key: 'CASES', name: 'Casos' })
      .expect(201);
    const base = `/api/v1/workspaces/${ws.id}/projects/${project.body.data.id}`;
    const call = (
      method: 'get' | 'post' | 'put' | 'patch' | 'delete',
      path: string,
      account = owner,
    ) => http()[method](`${base}${path}`).set('Authorization', auth(account));
    const create = async (body: Record<string, unknown> = {}) =>
      (
        await call('post', '/test-cases')
          .send({ title: 'Validar login', ...body })
          .expect(201)
      ).body.data;
    const suite = async (body: Record<string, unknown> = {}) =>
      (
        await call('post', '/test-suites')
          .send({ name: 'Suíte', ...body })
          .expect(201)
      ).body.data;
    return { ws, project: project.body.data, base, call, create, suite };
  }
  it('summarizes direct suite inventory, empty projects and every case status without descendant duplication', async () => {
    const { call, create, suite } = await setupCases();
    expect(
      (await call('get', '/test-cases/summary').expect(200)).body.data,
    ).toEqual({ totalCases: 0, suites: [] });
    const parent = await suite({ name: 'Pai' });
    const child = await suite({ name: 'Filho', parentSuiteId: parent.id });
    const empty = await suite({ name: 'Vazia', parentSuiteId: parent.id });
    const inventory = [
      { suiteId: null, status: 'DRAFT' },
      { suiteId: parent.id, status: 'DRAFT' },
      { suiteId: parent.id, status: 'ACTIVE' },
      { suiteId: child.id, status: 'ACTIVE' },
      { suiteId: child.id, status: 'DEPRECATED' },
      { suiteId: null, status: 'ARCHIVED' },
      { suiteId: child.id, status: 'ARCHIVED' },
    ];
    for (const item of inventory) {
      const row = await create({
        ...item,
        status: item.status === 'ARCHIVED' ? 'DRAFT' : item.status,
        steps: [{ action: 'Passo não necessário à contagem' }],
      });
      if (item.status === 'ARCHIVED')
        await call('post', `/test-cases/${row.id}/archive`)
          .send({ version: row.version })
          .expect(200);
    }
    for (const status of [
      undefined,
      'DRAFT',
      'ACTIVE',
      'DEPRECATED',
      'ARCHIVED',
      'ALL',
    ]) {
      const query = status ? { status } : {};
      const selected = inventory.filter(
        (item) =>
          status === 'ALL' ||
          (status ? item.status === status : item.status !== 'ARCHIVED'),
      );
      const expectedGroups = new Map<string | null, number>();
      for (const item of selected)
        expectedGroups.set(
          item.suiteId,
          (expectedGroups.get(item.suiteId) || 0) + 1,
        );
      const response = await call('get', '/test-cases/summary')
        .query(query)
        .expect(200);
      expect(response.body.data.totalCases).toBe(selected.length);
      expect(response.body.data.suites).toHaveLength(expectedGroups.size);
      expect(response.body.data.suites).toEqual(
        expect.arrayContaining(
          [...expectedGroups].map(([suiteId, totalCases]) => ({
            suiteId,
            totalCases,
          })),
        ),
      );
      expect(response.body.data.suites).not.toContainEqual(
        expect.objectContaining({ suiteId: empty.id }),
      );
      expect(response.body.message).toBe(
        'Contagens de casos consultadas com sucesso.',
      );
      expect(response.body.meta.requestId).toBe(
        response.headers['x-request-id'],
      );
      expect(response.body.meta.timestamp).toEqual(expect.any(String));
      expect(response.body.meta).not.toHaveProperty('pagination');
      expect(response.headers['cache-control']).toBe('no-store');
      const list = await call('get', '/test-cases')
        .query({ ...query, size: 1 })
        .expect(200);
      expect(response.body.data.totalCases).toBe(
        list.body.meta.pagination.totalItems,
      );
    }
  });
  it('isolates case summaries by workspace and project and permits archived project reads', async () => {
    const a = await setupCases();
    const b = await setupCases();
    await a.create();
    await b.create();
    await b.create();
    const otherProject = (
      await http()
        .post(`/api/v1/workspaces/${a.ws.id}/projects`)
        .set('Authorization', auth(owner))
        .send({ key: 'OTHER', name: 'Outro' })
        .expect(201)
    ).body.data;
    const otherBase = `/api/v1/workspaces/${a.ws.id}/projects/${otherProject.id}`;
    await http()
      .post(`${otherBase}/test-cases`)
      .set('Authorization', auth(owner))
      .send({ title: 'Outro projeto' })
      .expect(201);
    await http()
      .post(`${otherBase}/test-cases`)
      .set('Authorization', auth(owner))
      .send({ title: 'Outro projeto 2' })
      .expect(201);
    expect(
      (await a.call('get', '/test-cases/summary').expect(200)).body.data,
    ).toEqual({ totalCases: 1, suites: [{ suiteId: null, totalCases: 1 }] });
    expect(
      (await b.call('get', '/test-cases/summary').expect(200)).body.data
        .totalCases,
    ).toBe(2);
    expect(
      (
        await http()
          .get(`${otherBase}/test-cases/summary`)
          .set('Authorization', auth(owner))
          .expect(200)
      ).body.data.totalCases,
    ).toBe(2);
    await http()
      .get(
        `/api/v1/workspaces/${a.ws.id}/projects/${b.project.id}/test-cases/summary`,
      )
      .set('Authorization', auth(owner))
      .expect(404);
    await a.call('get', '/test-cases/summary', otherOwner).expect(404);
    await http()
      .post(`${a.base}/archive`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(200);
    expect(
      (await a.call('get', '/test-cases/summary').expect(200)).body.data
        .totalCases,
    ).toBe(1);
    await a.call('get', '/test-cases/summary', otherOwner).expect(404);
  });
  it('enforces current effective testcase.read grants and project membership for summaries', async () => {
    const { call, create, ws, base } = await setupCases();
    await create();
    const wm = await join(ws.id);
    await http().get(`${base}/test-cases/summary`).expect(401);
    await http()
      .get(`${base}/test-cases/summary`)
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    await call('get', '/test-cases/summary', member).expect(404);
    await http()
      .put(`${base}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'VIEWER' })
      .expect(200);
    expect(
      (await call('get', '/test-cases/summary', member).expect(200)).body.data
        .totalCases,
    ).toBe(1);
    const memberRole = await store.client.role.findFirstOrThrow({
      where: { workspaceId: ws.id, normalizedName: 'member', systemRole: true },
    });
    await http()
      .delete(
        `/api/v1/workspaces/${ws.id}/members/${wm.id}/roles/${memberRole.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    expect(
      (await call('get', '/test-cases/summary', member).expect(403)).body.code,
    ).toBe('AUTH_FORBIDDEN');
    await http()
      .put(
        `/api/v1/workspaces/${ws.id}/members/${wm.id}/roles/${memberRole.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await call('get', '/test-cases/summary', member).expect(200);
    await http()
      .delete(`${base}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await call('get', '/test-cases/summary', member).expect(404);
  });
  it('validates summary UUIDs and status and rejects list filters on the static route', async () => {
    const { call, ws, project } = await setupCases();
    for (const status of ['', 'active', 'UNKNOWN', 'null', "ACTIVE' OR 1=1"]) {
      const response = await call('get', '/test-cases/summary')
        .query({ status })
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ field: 'status' }),
      );
    }
    await call('get', '/test-cases/summary?status=ACTIVE&status=DRAFT').expect(
      400,
    );
    for (const field of [
      'page',
      'size',
      'q',
      'sort',
      'suiteId',
      'root',
      'tagId',
      'priority',
      'automationStatus',
    ]) {
      const response = await call('get', '/test-cases/summary')
        .query({ [field]: '1' })
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ field, code: 'UNEXPECTED_FIELD' }),
      );
    }
    for (const [workspaceId, projectId] of [
      ['invalid', project.id],
      [ws.id, 'invalid'],
      ['11111111-1111-1111-8111-111111111111', project.id],
      [ws.id, '22222222-2222-1222-8222-222222222222'],
    ]) {
      const response = await http()
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/test-cases/summary`,
        )
        .set('Authorization', auth(owner))
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    }
    await call('get', '/test-cases/summary').expect(200);
    await call('get', `/test-cases/${randomUUID()}`).expect(404);
  });
  it('creates atomic case aggregates, unique sequences under concurrency and immutable human IDs', async () => {
    const { call, create, ws, project } = await setupCases();
    const rows = await Promise.all(
      Array.from({ length: 6 }, () =>
        create({
          steps: [
            { action: 'Abrir login', expectedResult: 'Formulário exibido' },
          ],
        }),
      ),
    );
    expect(rows.map((r) => r.sequence).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(rows[0]).toMatchObject({
      humanId: `CASES-${rows[0].sequence}`,
      status: 'DRAFT',
      severity: 'NORMAL',
      automationStatus: 'MANUAL',
      version: 1,
    });
    const updated = await call('patch', `/test-cases/${rows[0].id}`)
      .send({ title: 'Atualizado', version: 1, automationStatus: 'AUTOMATED' })
      .expect(200);
    expect(updated.body.data.sequence).toBe(rows[0].sequence);
    expect(updated.body.data.createdBy).toBe(owner.id);
    for (const field of ['sequence', 'workspaceId', 'createdBy', 'projectId'])
      await call('patch', `/test-cases/${rows[0].id}`)
        .send({ version: 2, [field]: field === 'sequence' ? 99 : randomUUID() })
        .expect(400);
    const audit = await store.client.auditEvent.findFirstOrThrow({
      where: {
        workspaceId: ws.id,
        entityId: rows[0].id,
        action: 'test.case_updated',
      },
    });
    expect(audit.correlationId).toBe(updated.headers['x-request-id']);
    const count = await store.client.testCase.count({
      where: { projectId: project.id },
    });
    await call('post', '/test-cases')
      .send({ title: 'Rollback', tagIds: [randomUUID()] })
      .expect(404);
    expect(
      await store.client.testCase.count({ where: { projectId: project.id } }),
    ).toBe(count);
    expect((await create()).sequence).toBe(7);
  });
  it('orders recursive suites, prevents cycles and rejects archiving nonempty parents', async () => {
    const { call, suite, create } = await setupCases();
    const a = await suite({ name: 'A' }),
      b = await suite({ name: 'B', parentSuiteId: a.id }),
      c = await suite({ name: 'C', parentSuiteId: b.id }),
      d = await suite({ name: 'D' });
    expect(
      (
        await call('post', `/test-suites/${a.id}/move`)
          .send({ parentSuiteId: c.id })
          .expect(409)
      ).body.code,
    ).toBe('TEST_SUITE_CYCLE');
    await call('post', `/test-suites/${a.id}/move`)
      .send({ parentSuiteId: a.id })
      .expect(409);
    await call('post', `/test-suites/${a.id}/archive`).send({}).expect(409);
    const order = await call('put', '/test-suites/order')
      .send({ parentSuiteId: null, ids: [d.id, a.id] })
      .expect(200);
    expect(order.body.data.map((s: { id: string }) => s.id)).toEqual([
      d.id,
      a.id,
    ]);
    expect(order.body.meta.pagination).toBeUndefined();
    await call('put', '/test-suites/order')
      .send({ parentSuiteId: null, ids: [a.id] })
      .expect(400);
    const roots = await call('get', '/test-suites')
      .query({ root: true, size: 1 })
      .expect(200);
    expect(roots.body.meta.pagination.totalItems).toBe(2);
    expect(roots.body.data[0].id).toBe(d.id);
    await call('get', '/test-suites')
      .query({ parentSuiteId: a.id })
      .expect(200);
    const moved = await call('post', `/test-suites/${c.id}/move`)
      .send({ parentSuiteId: null, position: 1 })
      .expect(200);
    expect(moved.body.data.position).toBe(1);
    await call('patch', `/test-suites/${c.id}`)
      .send({ name: 'Renomeado', description: null })
      .expect(200);
    const row = await create({ suiteId: c.id });
    await call('post', `/test-suites/${c.id}/archive`).send({}).expect(409);
    await call('post', `/test-cases/${row.id}/move`)
      .send({ version: 1, suiteId: null })
      .expect(200);
    const archived = await call('post', `/test-suites/${c.id}/archive`)
      .send({})
      .expect(200);
    const again = await call('post', `/test-suites/${c.id}/archive`)
      .send({})
      .expect(200);
    expect(again.body.data.archivedAt).toBe(archived.body.data.archivedAt);
    await call('get', `/test-suites/${c.id}`).expect(200);
    await call('patch', `/test-suites/${c.id}`)
      .send({ name: 'Bloqueado' })
      .expect(409);
    await call('post', '/test-suites')
      .send({ name: 'Filho', parentSuiteId: c.id })
      .expect(409);
    await call('post', '/test-cases')
      .send({ title: 'Inválido', suiteId: c.id })
      .expect(404);
  });
  it('serializes version checks so concurrent writes have one winner', async () => {
    const { call, create } = await setupCases();
    const row = await create();
    const results = await Promise.all(
      ['A', 'B'].map((title) =>
        call('patch', `/test-cases/${row.id}`).send({ version: 1, title }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body.code).toBe(
      'TEST_CASE_VERSION_CONFLICT',
    );
    const latest = (await call('get', `/test-cases/${row.id}`).expect(200)).body
      .data;
    expect(latest.version).toBe(2);
    const before = await store.client.auditEvent.count({
      where: { entityId: row.id, action: 'test.case_updated' },
    });
    await call('patch', `/test-cases/${row.id}`)
      .send({ version: 1, title: 'Stale' })
      .expect(409);
    expect(
      await store.client.auditEvent.count({
        where: { entityId: row.id, action: 'test.case_updated' },
      }),
    ).toBe(before);
  });
  it('adds, updates, deletes and reorders steps without unique collisions or changing IDs', async () => {
    const { call, create } = await setupCases();
    let row = await create({
      steps: [{ action: 'A' }, { action: 'B' }, { action: 'C' }],
    });
    const ids = row.steps.map((s: { id: string }) => s.id);
    row = (
      await call('put', `/test-cases/${row.id}/steps/order`)
        .send({ version: row.version, ids: [ids[2], ids[0], ids[1]] })
        .expect(200)
    ).body.data;
    expect(row.steps.map((s: { id: string }) => s.id)).toEqual([
      ids[2],
      ids[0],
      ids[1],
    ]);
    expect(row.steps.map((s: { position: number }) => s.position)).toEqual([
      1, 2, 3,
    ]);
    row = (
      await call('post', `/test-cases/${row.id}/steps`)
        .send({ version: row.version, action: 'D', position: 2 })
        .expect(200)
    ).body.data;
    row = (
      await call('patch', `/test-cases/${row.id}/steps/${ids[0]}`)
        .send({ version: row.version, action: 'A novo', testData: null })
        .expect(200)
    ).body.data;
    expect(row.steps.find((s: { id: string }) => s.id === ids[0]).action).toBe(
      'A novo',
    );
    row = (
      await call('delete', `/test-cases/${row.id}/steps/${ids[1]}`)
        .send({ version: row.version })
        .expect(200)
    ).body.data;
    expect(row.steps.map((s: { position: number }) => s.position)).toEqual([
      1, 2, 3,
    ]);
    await call('put', `/test-cases/${row.id}/steps/order`)
      .send({ version: row.version, ids: [ids[0]] })
      .expect(400);
    await call('post', `/test-cases/${row.id}/steps`)
      .send({ version: row.version, action: 'X', position: 99 })
      .expect(400);
    expect(
      (await call('get', `/test-cases/${row.id}/steps`).expect(200)).body.data,
    ).toHaveLength(3);
    const other = await create({ steps: [{ action: 'Outro caso' }] });
    await call('patch', `/test-cases/${row.id}/steps/${other.steps[0].id}`)
      .send({ version: row.version, action: 'Inválido' })
      .expect(404);
  });
  it('validates typed and required fields, preserves archived values and handles new mandatory fields', async () => {
    const { call, ws, create } = await setupCases();
    const field = async (type: string, required = false) =>
      (
        await http()
          .post(`/api/v1/workspaces/${ws.id}/custom-fields`)
          .set('Authorization', auth(owner))
          .send({
            key: type.toLowerCase(),
            name: type,
            type,
            target: 'TEST_CASE',
            required,
            position: 1,
            options: type === 'SINGLE_SELECT' ? ['Opção'] : [],
          })
          .expect(201)
      ).body.data;
    const text = await field('TEXT', true),
      num = await field('NUMBER', true),
      boolean = await field('BOOLEAN', true),
      date = await field('DATE'),
      select = await field('SINGLE_SELECT');
    await call('post', '/test-cases').send({ title: 'Sem campos' }).expect(400);
    const customFields = [
      { fieldId: text.id, value: 'Texto' },
      { fieldId: num.id, value: 0 },
      { fieldId: boolean.id, value: false },
      { fieldId: date.id, value: '2028-02-29' },
      { fieldId: select.id, value: select.options[0].id },
    ];
    let row = await create({ customFields });
    expect(row.customFields).toEqual(expect.arrayContaining(customFields));
    for (const value of ['wrong', {}, [], null])
      await call('patch', `/test-cases/${row.id}`)
        .send({
          version: row.version,
          customFields: [{ fieldId: num.id, value }],
        })
        .expect(400);
    await call('put', `/test-cases/${row.id}/custom-fields`)
      .send({ version: row.version, customFields: [] })
      .expect(400);
    row = (
      await call('patch', `/test-cases/${row.id}`)
        .send({
          version: row.version,
          customFields: [{ fieldId: text.id, value: 'Novo' }],
        })
        .expect(200)
    ).body.data;
    await http()
      .post(`/api/v1/workspaces/${ws.id}/custom-fields/${text.id}/archive`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(200);
    row = (
      await call('put', `/test-cases/${row.id}/custom-fields`)
        .send({
          version: row.version,
          customFields: [
            { fieldId: num.id, value: 12 },
            { fieldId: boolean.id, value: true },
          ],
        })
        .expect(200)
    ).body.data;
    expect(row.customFields).toEqual(
      expect.arrayContaining([{ fieldId: text.id, value: 'Novo' }]),
    );
    await call('patch', `/test-cases/${row.id}`)
      .send({
        version: row.version,
        customFields: [{ fieldId: text.id, value: 'Arquivado' }],
      })
      .expect(404);
    const mandatory = await http()
      .post(`/api/v1/workspaces/${ws.id}/custom-fields`)
      .set('Authorization', auth(owner))
      .send({
        key: 'new_required',
        name: 'Obrigatório novo',
        type: 'TEXT',
        target: 'TEST_CASE',
        required: true,
        position: 2,
        options: [],
      })
      .expect(201);
    await call('patch', `/test-cases/${row.id}`)
      .send({ version: row.version, title: 'Obrigatório ausente' })
      .expect(400);
    await call('patch', `/test-cases/${row.id}`)
      .send({
        version: row.version,
        title: 'Preenchido',
        customFields: [{ fieldId: mandatory.body.data.id, value: 'ok' }],
      })
      .expect(200);
  });
  it('clones definitions and links, gives new step IDs, and preserves source under archive/restore', async () => {
    const { call, create, suite, ws } = await setupCases();
    const s = await suite();
    const tag = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/tags`)
        .set('Authorization', auth(owner))
        .send({ name: 'Smoke' })
        .expect(201)
    ).body.data;
    const attachment = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/attachments`)
        .set('Authorization', auth(owner))
        .attach('file', Buffer.from('evidência'), 'proof.txt')
        .expect(201)
    ).body.data;
    let source = await create({
      suiteId: s.id,
      tagIds: [tag.id],
      attachmentIds: [attachment.id],
      steps: [{ action: 'Original' }],
      status: 'ACTIVE',
    });
    const copy = (
      await call('post', `/test-cases/${source.id}/clone`)
        .send({ title: 'Cópia' })
        .expect(201)
    ).body.data;
    expect(copy).toMatchObject({
      title: 'Cópia',
      status: 'DRAFT',
      suiteId: s.id,
      tagIds: [tag.id],
      attachmentIds: [attachment.id],
      version: 1,
      sequence: 2,
    });
    expect(copy.steps[0].id).not.toBe(source.steps[0].id);
    await call('patch', `/test-cases/${copy.id}/steps/${copy.steps[0].id}`)
      .send({ version: 1, action: 'Mudado' })
      .expect(200);
    expect(
      (await call('get', `/test-cases/${source.id}`).expect(200)).body.data
        .steps[0].action,
    ).toBe('Original');
    source = (
      await call('post', `/test-cases/${source.id}/archive`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    const repeated = (
      await call('post', `/test-cases/${source.id}/archive`)
        .send({ version: source.version })
        .expect(200)
    ).body.data;
    expect(repeated.archivedAt).toBe(source.archivedAt);
    expect(repeated.version).toBe(source.version);
    await call('patch', `/test-cases/${source.id}`)
      .send({ version: source.version, title: 'Bloqueado' })
      .expect(409);
    source = (
      await call('post', `/test-cases/${source.id}/restore`)
        .send({ version: source.version, status: 'ACTIVE' })
        .expect(200)
    ).body.data;
    expect(source).toMatchObject({
      sequence: 1,
      status: 'ACTIVE',
      archivedAt: null,
      tagIds: [tag.id],
    });
    await call('post', `/test-cases/${source.id}/restore`)
      .send({ version: source.version, status: 'ACTIVE' })
      .expect(409);
    expect(
      (
        await http()
          .delete(`/api/v1/workspaces/${ws.id}/tags/${tag.id}`)
          .set('Authorization', auth(owner))
          .send({})
          .expect(409)
      ).body.code,
    ).toBe('TAG_IN_USE');
  });
  it('links/unlinks tags and private attachments idempotently and filters before pagination', async () => {
    const { call, create, ws } = await setupCases();
    let row = await create();
    await create({ title: 'Outro' });
    const tag = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/tags`)
        .set('Authorization', auth(owner))
        .send({ name: 'Tag' })
        .expect(201)
    ).body.data;
    const attachment = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/attachments`)
        .set('Authorization', auth(owner))
        .attach('file', Buffer.from('private'), 'private.txt')
        .expect(201)
    ).body.data;
    row = (
      await call('put', `/test-cases/${row.id}/tags/${tag.id}`)
        .send({ version: row.version })
        .expect(200)
    ).body.data;
    const again = (
      await call('put', `/test-cases/${row.id}/tags/${tag.id}`)
        .send({ version: row.version })
        .expect(200)
    ).body.data;
    expect(again.version).toBe(row.version);
    row = (
      await call('put', `/test-cases/${row.id}/attachments/${attachment.id}`)
        .send({ version: row.version })
        .expect(200)
    ).body.data;
    expect(JSON.stringify(row)).not.toContain('storageKey');
    const list = await call('get', '/test-cases')
      .query({ tagId: tag.id, size: 1, q: 'login' })
      .expect(200);
    expect(list.body.meta.pagination.totalItems).toBe(1);
    expect(list.body.data[0].id).toBe(row.id);
    row = (
      await call('delete', `/test-cases/${row.id}/tags/${tag.id}`)
        .send({ version: row.version })
        .expect(200)
    ).body.data;
    row = (
      await call('delete', `/test-cases/${row.id}/attachments/${attachment.id}`)
        .send({ version: row.version })
        .expect(200)
    ).body.data;
    expect(row.tagIds).toEqual([]);
    expect(row.attachmentIds).toEqual([]);
    await call('put', `/test-cases/${row.id}/attachments/${attachment.id}`)
      .send({ version: row.version })
      .expect(200);
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/attachments/${attachment.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    expect(
      (await call('get', `/test-cases/${row.id}`).expect(200)).body.data
        .attachmentIds,
    ).toEqual([]);
    await call('post', '/test-cases')
      .send({ title: 'Deleted attachment', attachmentIds: [attachment.id] })
      .expect(404);
  });
  it('isolates reads, counts and foreign references across projects and tenants, including composite SQL FKs', async () => {
    const a = await setupCases(),
      b = await setupCases();
    const sa = await a.suite(),
      sb = await b.suite();
    const ca = await a.create({ suiteId: sa.id, steps: [{ action: 'A' }] }),
      cb = await b.create({ steps: [{ action: 'B' }] });
    await b.call('get', `/test-cases/${ca.id}`).expect(404);
    await b.call('get', `/test-suites/${sa.id}`).expect(404);
    await b
      .call('post', '/test-cases')
      .send({ title: 'Foreign suite', suiteId: sa.id })
      .expect(404);
    await b
      .call('post', `/test-suites/${sb.id}/move`)
      .send({ parentSuiteId: sa.id })
      .expect(404);
    await b
      .call('patch', `/test-cases/${cb.id}/steps/${ca.steps[0].id}`)
      .send({ version: 1, action: 'Foreign' })
      .expect(404);
    expect(
      (await b.call('get', '/test-cases').query({ q: 'login' }).expect(200))
        .body.meta.pagination.totalItems,
    ).toBe(1);
    await a.call('get', `/test-cases/${ca.id}`, otherOwner).expect(404);
    await expect(
      store.client.testCase.update({
        where: { id: cb.id },
        data: { suiteId: sa.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      store.client.testStep.update({
        where: { id: cb.steps[0].id },
        data: { testCaseId: ca.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    const p = (
      await http()
        .post(`/api/v1/workspaces/${a.ws.id}/projects`)
        .set('Authorization', auth(owner))
        .send({ key: 'OTHER', name: 'Mesmo tenant' })
        .expect(201)
    ).body.data;
    const sameTenant = `/api/v1/workspaces/${a.ws.id}/projects/${p.id}`;
    await http()
      .get(`${sameTenant}/test-cases/${ca.id}`)
      .set('Authorization', auth(owner))
      .expect(404);
    await http()
      .post(`${sameTenant}/test-cases`)
      .set('Authorization', auth(owner))
      .send({ title: 'Outro projeto', suiteId: sa.id })
      .expect(404);
    const tag = (
      await http()
        .post(`/api/v1/workspaces/${a.ws.id}/tags`)
        .set('Authorization', auth(owner))
        .send({ name: 'Isolada' })
        .expect(201)
    ).body.data;
    await b
      .call('put', `/test-cases/${cb.id}/tags/${tag.id}`)
      .send({ version: 1 })
      .expect(404);
    await expect(
      store.client.testCaseTag.create({
        data: {
          id: randomUUID(),
          workspaceId: b.ws.id,
          projectId: b.project.id,
          testCaseId: cb.id,
          tagId: tag.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    const field = (
      await http()
        .post(`/api/v1/workspaces/${a.ws.id}/custom-fields`)
        .set('Authorization', auth(owner))
        .send({
          key: 'isolated',
          name: 'Isolado',
          type: 'TEXT',
          target: 'TEST_CASE',
          required: false,
          position: 1,
          options: [],
        })
        .expect(201)
    ).body.data;
    await b
      .call('patch', `/test-cases/${cb.id}`)
      .send({
        version: 1,
        customFields: [{ fieldId: field.id, value: 'foreign' }],
      })
      .expect(404);
    await expect(
      store.client.testCaseFieldValue.create({
        data: {
          id: randomUUID(),
          workspaceId: b.ws.id,
          projectId: b.project.id,
          testCaseId: cb.id,
          fieldId: field.id,
          value: 'foreign',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it('intersects local access with current grants, revokes immediately and blocks archived projects', async () => {
    const { call, create, ws, project, base } = await setupCases();
    const wm = await join(ws.id);
    const row = await create();
    await call('get', '/test-cases', member).expect(404);
    await http()
      .put(`${base}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'VIEWER' })
      .expect(200);
    await call('get', '/test-cases', member).expect(200);
    await call('post', '/test-cases', member)
      .send({ title: 'Denied' })
      .expect(403);
    const role = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/roles`)
        .set('Authorization', auth(owner))
        .send({
          name: 'Editor de casos',
          permissionCodes: [
            'testcase.create',
            'testcase.update',
            'testcase.archive',
          ],
        })
        .expect(201)
    ).body.data;
    await http()
      .put(`/api/v1/workspaces/${ws.id}/members/${wm.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await call('patch', `/test-cases/${row.id}`, member)
      .send({ version: 1, title: 'Viewer limitado' })
      .expect(403);
    await http()
      .put(`${base}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'EDITOR' })
      .expect(200);
    await call('patch', `/test-cases/${row.id}`, member)
      .send({ version: 1, title: 'Editor permitido' })
      .expect(200);
    await call('post', `/test-cases/${row.id}/archive`, member)
      .send({ version: 2 })
      .expect(403);
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/members/${wm.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await call('patch', `/test-cases/${row.id}`, member)
      .send({ version: 2, title: 'Revogado' })
      .expect(403);
    await http()
      .delete(`${base}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await call('get', '/test-cases', member).expect(404);
    await http()
      .post(`${base}/archive`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(200);
    await call('get', `/test-cases/${row.id}`).expect(200);
    expect(
      (
        await call('post', '/test-cases')
          .send({ title: 'Arquivado' })
          .expect(409)
      ).body.code,
    ).toBe('PROJECT_ARCHIVED');
    expect(
      await store.client.testCase.count({
        where: { workspaceId: ws.id, projectId: project.id },
      }),
    ).toBe(1);
  });
  it('rejects malformed nested DTOs, missing versions and unexpected fields with pt-BR Problem Details', async () => {
    const { call, create } = await setupCases();
    const row = await create();
    const invalid = await call('post', '/test-cases')
      .send({
        title: 'Validação',
        steps: [{ action: 'x', sourceStepId: randomUUID() }],
      })
      .expect(400);
    expect(invalid.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'steps.0.sourceStepId',
          code: 'UNEXPECTED_FIELD',
        }),
      ]),
    );
    await call('patch', `/test-cases/${row.id}`)
      .send({ title: 'Sem versão' })
      .expect(400);
    for (const body of [
      { title: null },
      { title: '   ' },
      { title: 'A', steps: null },
      { title: 'A', status: 'ARCHIVED' },
      { title: 'A', severity: null },
      {
        title: 'A',
        customFields: [{ fieldId: randomUUID(), value: { secret: 'object' } }],
      },
    ])
      await call('post', '/test-cases').send(body).expect(400);
    await call('post', `/test-cases/${row.id}/move`)
      .send({ version: 1 })
      .expect(400);
    await call('post', `/test-cases/${row.id}/move`)
      .send({ version: 1, suiteId: null })
      .expect(200);
    await call('get', '/test-cases')
      .query({ sort: 'createdBy,asc' })
      .expect(400);
    await call('get', '/test-cases').query({ status: 'bad' }).expect(400);
    await call('get', '/test-cases')
      .query({ root: true, suiteId: randomUUID() })
      .expect(400);
    await call('get', '/test-cases').query({ unknown: 'true' }).expect(400);
    await http()
      .get(
        `/api/v1/workspaces/${randomUUID()}/projects/${randomUUID()}/test-cases`,
      )
      .expect(401);
  });
  it('restores archived cases into a valid destination and requires newly mandatory fields', async () => {
    const { call, create, suite, ws } = await setupCases();
    const parent = await suite();
    let row = await create({ suiteId: parent.id });
    row = (
      await call('post', `/test-cases/${row.id}/archive`)
        .send({ version: row.version })
        .expect(200)
    ).body.data;
    await call('post', `/test-suites/${parent.id}/archive`)
      .send({})
      .expect(200);
    await call('post', `/test-cases/${row.id}/restore`)
      .send({ version: row.version, status: 'ACTIVE' })
      .expect(404);
    const field = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/custom-fields`)
        .set('Authorization', auth(owner))
        .send({
          key: 'mandatory',
          name: 'Obrigatório',
          type: 'TEXT',
          target: 'TEST_CASE',
          required: true,
          position: 1,
          options: [],
        })
        .expect(201)
    ).body.data;
    await call('post', `/test-cases/${row.id}/restore`)
      .send({ version: row.version, status: 'ACTIVE', suiteId: null })
      .expect(400);
    await call('post', `/test-cases/${row.id}/clone`)
      .send({ suiteId: null })
      .expect(400);
    row = (
      await call('post', `/test-cases/${row.id}/restore`)
        .send({
          version: row.version,
          status: 'ACTIVE',
          suiteId: null,
          customFields: [{ fieldId: field.id, value: 'Original' }],
        })
        .expect(200)
    ).body.data;
    const copy = (
      await call('post', `/test-cases/${row.id}/clone`)
        .send({ title: 'Cópia com valores' })
        .expect(201)
    ).body.data;
    expect(copy.customFields).toEqual([
      { fieldId: field.id, value: 'Original' },
    ]);
    await call('put', `/test-cases/${row.id}/custom-fields`)
      .send({
        version: row.version,
        customFields: [{ fieldId: field.id, value: 'Alterado' }],
      })
      .expect(200);
    expect(
      (await call('get', `/test-cases/${copy.id}`).expect(200)).body.data
        .customFields,
    ).toEqual([{ fieldId: field.id, value: 'Original' }]);
    await http()
      .post(`/api/v1/workspaces/${ws.id}/custom-fields/${field.id}/archive`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(200);
    const archivedCopy = (
      await call('post', `/test-cases/${copy.id}/archive`)
        .send({ version: copy.version })
        .expect(200)
    ).body.data;
    const clone = (
      await call('post', `/test-cases/${copy.id}/clone`)
        .send({ suiteId: null })
        .expect(201)
    ).body.data;
    expect(clone.status).toBe('DRAFT');
    expect(clone.customFields).toEqual([]);
    expect(
      (await call('get', `/test-cases/${archivedCopy.id}`).expect(200)).body
        .data.customFields,
    ).toEqual(copy.customFields);
  });
});

describe('Phase 04 plans and manual execution with MySQL/MariaDB', () => {
  async function setupExecution() {
    const ws = await workspace();
    const project = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/projects`)
        .set('Authorization', auth(owner))
        .send({ key: 'RUN', name: 'Execução' })
        .expect(201)
    ).body.data;
    const base = `/api/v1/workspaces/${ws.id}/projects/${project.id}`;
    const call = (
      method: 'get' | 'post' | 'put' | 'patch' | 'delete',
      path: string,
      account = owner,
    ) => http()[method](`${base}${path}`).set('Authorization', auth(account));
    const testCase = async (body: Record<string, unknown> = {}) =>
      (
        await call('post', '/test-cases')
          .send({ title: 'Caso de execução', status: 'ACTIVE', ...body })
          .expect(201)
      ).body.data;
    const plan = async (body: Record<string, unknown> = {}) =>
      (
        await call('post', '/test-plans')
          .send({ name: 'Plano', ...body })
          .expect(201)
      ).body.data;
    const run = async (caseIds: string[], body: Record<string, unknown> = {}) =>
      (
        await call('post', '/test-runs')
          .send({ name: 'Execução', caseIds, ...body })
          .expect(201)
      ).body.data;
    const copies = async (id: string) =>
      (await call('get', `/test-runs/${id}/cases`).expect(200)).body.data;
    return { ws, project, base, call, testCase, plan, run, copies };
  }
  async function importSetup(count = 3) {
    const s = await setupExecution();
    const cases = [];
    for (let i = 0; i < count; i++)
      cases.push(
        await s.testCase({
          title: `Caso ${i}`,
          steps: [{ action: 'Executar passo' }],
        }),
      );
    let plan = await s.plan({ caseIds: cases.map((c) => c.id) });
    plan = (
      await s
        .call('post', `/test-plans/${plan.id}/activate`)
        .send({ version: plan.version })
        .expect(200)
    ).body.data;
    let run = (
      await s
        .call('post', `/test-plans/${plan.id}/runs`)
        .send({ version: plan.version, name: 'Execução importável' })
        .expect(201)
    ).body.data;
    run = (
      await s
        .call('post', `/test-runs/${run.id}/start`)
        .send({ version: run.version })
        .expect(200)
    ).body.data;
    const copies = await s.copies(run.id);
    const base = `/test-runs/${run.id}/result-imports`;
    const xml = `<testsuites><testsuite>${cases.map((c, i) => `<testcase name="${c.id}"><properties><property name="lambdaquality.humanId" value="${copies[i].humanIdSnapshot}"/></properties>${i === 1 ? '<failure message="Falha do CI">detalhe</failure>' : i === 2 ? '<skipped/>' : ''}</testcase>`).join('')}</testsuite></testsuites>`;
    const preview = async (content = xml, account = owner) =>
      (
        await s
          .call('post', base + '/preview', account)
          .attach('file', Buffer.from(content), 'junit.xml')
          .expect(200)
      ).body.data;
    return { ...s, cases, run, rc: copies, base, xml, preview };
  }
  it('adds ordered cases atomically in bulk and rejects unavailable, duplicated, foreign and stale selections', async () => {
    const s = await setupExecution(),
      other = await setupExecution();
    const a = await s.testCase(),
      b = await s.testCase(),
      foreign = await other.testCase();
    let plan = await s.plan();
    const path = `/test-plans/${plan.id}/cases/bulk`;
    for (const ids of [
      [a.id, foreign.id],
      [a.id, randomUUID()],
    ])
      await s.call('post', path).send({ version: 1, caseIds: ids }).expect(404);
    await s
      .call('post', path)
      .send({ version: 1, caseIds: [a.id, a.id] })
      .expect(400);
    expect(
      (await s.call('get', `/test-plans/${plan.id}`).expect(200)).body.data,
    ).toMatchObject({ version: 1, cases: [] });
    plan = (
      await s
        .call('post', path)
        .send({ version: 1, caseIds: [b.id, a.id] })
        .expect(200)
    ).body.data;
    expect(plan.version).toBe(2);
    expect(plan.cases.map((c: { testCaseId: string }) => c.testCaseId)).toEqual([
      b.id,
      a.id,
    ]);
    expect(
      (
        await s
          .call('post', path)
          .send({ version: 2, caseIds: [a.id] })
          .expect(409)
      ).body.code,
    ).toBe('TEST_PLAN_CASE_EXISTS');
    expect(
      (
        await s
          .call('post', path)
          .send({ version: 1, caseIds: [a.id] })
          .expect(409)
      ).body.code,
    ).toBe('TEST_PLAN_VERSION_CONFLICT');
    plan = (
      await s
        .call('post', `/test-plans/${plan.id}/activate`)
        .send({ version: 2 })
        .expect(200)
    ).body.data;
    await s
      .call('post', path)
      .send({ version: plan.version, caseIds: [randomUUID()] })
      .expect(409);
    await s
      .call('post', path, otherOwner)
      .send({ version: plan.version, caseIds: [a.id] })
      .expect(404);
  });
  it('imports PASSED with pending steps, preserves snapshots/comments and finishes without fabricating step results', async () => {
    const s = await importSetup();
    const manual = await s
      .call('put', `/test-runs/${s.run.id}/cases/${s.rc[0].id}/result`)
      .send({ version: s.run.version, result: 'PASSED' })
      .expect(409);
    expect(manual.body.code).toBe('TEST_RUN_STEPS_INCOMPLETE');
    await store.client.testRunCase.update({
      where: { id: s.rc[0].id },
      data: { comment: 'Comentário preservado' },
    });
    const preview = await s.preview();
    expect(preview).toMatchObject({
      status: 'PREVIEW',
      version: s.run.version,
      fileHash: createHash('sha256').update(s.xml).digest('hex'),
      tool: 'JUNIT',
    });
    expect(
      preview.items.map(
        (i: { proposedRunCaseId: string }) => i.proposedRunCaseId,
      ),
    ).toEqual(s.rc.map((c: { id: string }) => c.id));
    expect(
      (await s.copies(s.run.id)).map((c: { result: string }) => c.result),
    ).toEqual(['NOT_TESTED', 'NOT_TESTED', 'NOT_TESTED']);
    const body = {
      version: preview.version,
      requestKey: randomUUID(),
      mappings: preview.items.map(
        (i: { itemId: number; proposedRunCaseId: string }) => ({
          itemId: i.itemId,
          runCaseId: i.proposedRunCaseId,
        }),
      ),
    };
    const applied = (
      await s
        .call('post', `${s.base}/${preview.previewId}/apply`)
        .send(body)
        .expect(200)
    ).body.data;
    expect(applied).toMatchObject({
      alreadyApplied: false,
      run: {
        version: s.run.version + 1,
        status: 'IN_PROGRESS',
        summary: { passed: 1, failed: 1, skipped: 1, notTested: 0 },
      },
      import: {
        status: 'APPLIED',
        importedCount: 3,
        requestKey: body.requestKey,
      },
    });
    const copies = await s.copies(s.run.id);
    for (const [i, c] of copies.entries()) {
      expect(c).toMatchObject({
        resultOrigin: 'JUNIT',
        externalResult: {
          importId: preview.previewId,
          itemId: i + 1,
          fileHash: preview.fileHash,
        },
        definitionSnapshot: s.rc[i].definitionSnapshot,
        steps: s.rc[i].steps,
      });
    }
    expect(copies[0].comment).toBe('Comentário preservado');
    expect(
      await store.client.auditEvent.count({
        where: {
          workspaceId: s.ws.id,
          action: 'test.run_results_imported',
          entityId: s.run.id,
        },
      }),
    ).toBe(1);
    const replay = (
      await s
        .call('post', `${s.base}/${preview.previewId}/apply`)
        .send(body)
        .expect(200)
    ).body.data;
    expect(replay).toMatchObject({
      alreadyApplied: true,
      run: { version: applied.run.version },
    });
    const complete = (
      await s
        .call('post', `/test-runs/${s.run.id}/complete`)
        .send({ version: applied.run.version })
        .expect(200)
    ).body.data;
    expect(complete.status).toBe('COMPLETED');
    await s
      .call('post', `${s.base}/preview`)
      .attach('file', Buffer.from(s.xml), 'junit.xml')
      .expect(409);
    expect(
      (
        await s
          .call('post', `${s.base}/${preview.previewId}/apply`)
          .send(body)
          .expect(200)
      ).body.data.alreadyApplied,
    ).toBe(true);
    expect(
      (await s.call('get', `${s.base}/${preview.previewId}`).expect(200)).body
        .data.status,
    ).toBe('APPLIED');
    await s
      .call('post', `${s.base}/${preview.previewId}/apply`)
      .send({ ...body, requestKey: randomUUID() })
      .expect(409);
  });
  it('invalidates external approval on step editing and retains the manual pass restriction', async () => {
    const s = await importSetup(1),
      p = await s.preview();
    const applied = (
      await s
        .call('post', `${s.base}/${p.previewId}/apply`)
        .send({
          version: p.version,
          requestKey: randomUUID(),
          mappings: [{ itemId: 1, runCaseId: s.rc[0].id }],
        })
        .expect(200)
    ).body.data;
    const changed = (
      await s
        .call(
          'put',
          `/test-runs/${s.run.id}/cases/${s.rc[0].id}/steps/${s.rc[0].steps[0].id}/result`,
        )
        .send({ version: applied.run.version, result: 'FAILED' })
        .expect(200)
    ).body.data;
    expect((await s.copies(s.run.id))[0]).toMatchObject({
      result: 'NOT_TESTED',
      resultOrigin: 'MANUAL',
      externalResult: null,
    });
    await s
      .call('put', `/test-runs/${s.run.id}/cases/${s.rc[0].id}/result`)
      .send({ version: changed.version, result: 'PASSED' })
      .expect(409);
    await s
      .call('post', `/test-runs/${s.run.id}/complete`)
      .send({ version: changed.version })
      .expect(409);
    expect(
      (await s.call('get', `${s.base}/${p.previewId}`).expect(200)).body.data
        .status,
    ).toBe('APPLIED');
  });
  it('rolls back all imported results and receipt on validation, overwrite or audit failure', async () => {
    const s = await importSetup(2),
      p = await s.preview();
    const path = `${s.base}/${p.previewId}/apply`;
    const body = {
      version: p.version,
      requestKey: randomUUID(),
      mappings: [
        { itemId: 1, runCaseId: s.rc[0].id },
        { itemId: 2, runCaseId: s.rc[1].id },
      ],
    };
    await s
      .call('post', path)
      .send({
        ...body,
        mappings: [body.mappings[0], { itemId: 2, runCaseId: randomUUID() }],
      })
      .expect(404);
    await s
      .call('post', path)
      .send({ ...body, mappings: [body.mappings[0], body.mappings[0]] })
      .expect(400);
    await s
      .call('post', path)
      .send({ ...body, mappings: [{ itemId: 3, runCaseId: s.rc[0].id }] })
      .expect(400);
    await store.client.testRunCase.update({
      where: { id: s.rc[1].id },
      data: { result: 'FAILED', executedBy: owner.id, executedAt: new Date() },
    });
    expect((await s.call('post', path).send(body).expect(409)).body.code).toBe(
      'TEST_RESULT_IMPORT_OVERWRITE_REQUIRED',
    );
    expect((await s.copies(s.run.id))[0].result).toBe('NOT_TESTED');
    const spy = vi
      .spyOn(app.get<TestRuns>(TEST_RUNS), 'changed')
      .mockRejectedValueOnce(new Error('Simulated audit failure'));
    try {
      await s
        .call('post', path)
        .send({ ...body, overwrite: true })
        .expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(
      (await s.copies(s.run.id)).map((c: { result: string }) => c.result),
    ).toEqual(['NOT_TESTED', 'FAILED']);
    expect(
      (await s.call('get', `${s.base}/${p.previewId}`).expect(200)).body.data,
    ).toMatchObject({ status: 'PREVIEW', requestKey: null });
    const results = await Promise.all([
      s.call('post', path).send({ ...body, overwrite: true }),
      s.call('post', path).send({ ...body, overwrite: true }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results.map((r) => r.body.data.alreadyApplied).sort()).toEqual([
      false,
      true,
    ]);
    expect(
      (
        await s
          .call('post', path)
          .send({ ...body, overwrite: false })
          .expect(409)
      ).body.code,
    ).toBe('TEST_RESULT_IMPORT_KEY_CONFLICT');
  });
  it('requires fresh previews, explicit mappings and rejects malformed uploads before changing execution', async () => {
    const s = await importSetup(1),
      p = await s.preview();
    const body = {
      version: p.version,
      requestKey: randomUUID(),
      mappings: [{ itemId: 1, runCaseId: s.rc[0].id }],
    };
    for (const xml of [
      '',
      '<!DOCTYPE testsuite><testsuite><testcase name="x"/></testsuite>',
      '<bad/>',
    ])
      await s
        .call('post', s.base + '/preview')
        .attach('file', Buffer.from(xml), 'junit.xml')
        .expect(400);
    await s
      .call('post', s.base + '/preview')
      .attach('file', Buffer.alloc(2 * 1024 * 1024 + 1), 'junit.xml')
      .expect(413);
    await s
      .call('post', s.base + '/preview')
      .attach('file', Buffer.from(s.xml), 'junit.csv')
      .expect(400);
    await s
      .call('post', s.base + '/preview')
      .field('unexpected', 'value')
      .attach('file', Buffer.from(s.xml), 'junit.xml')
      .expect(400);
    const title = await s.preview(
      `<testsuite><testcase name="${s.rc[0].titleSnapshot}"/></testsuite>`,
    );
    expect(title.items[0]).toMatchObject({
      proposedRunCaseId: null,
      blockers: ['IDENTIFIER_MISSING'],
    });
    const duplicate = await s.preview(
      `<testsuite><testcase name="${s.cases[0].id}"/><testcase name="${s.cases[0].id}"/></testsuite>`,
    );
    expect(
      duplicate.items.map((i: { blockers: string[] }) => i.blockers),
    ).toEqual([['DUPLICATE_RESULT'], ['DUPLICATE_RESULT']]);
    await s
      .call('post', `${s.base}/${p.previewId}/apply`)
      .send({ ...body, overwrite: 'true' })
      .expect(400);
    await s
      .call('post', `${s.base}/${p.previewId}/apply`)
      .send({
        ...body,
        mappings: [{ itemId: 1, runCaseId: s.rc[0].id, unexpected: 1 }],
      })
      .expect(400);
    await store.client.testResultImport.update({
      where: { id: p.previewId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (await s.call('get', `${s.base}/${p.previewId}`).expect(200)).body.data
        .status,
    ).toBe('EXPIRED');
    expect(
      (
        await s
          .call('post', `${s.base}/${p.previewId}/apply`)
          .send(body)
          .expect(409)
      ).body.code,
    ).toBe('TEST_RESULT_IMPORT_EXPIRED');
    const fresh = await s.preview();
    const changed = (
      await s
        .call('put', `/test-runs/${s.run.id}/cases/${s.rc[0].id}/result`)
        .send({ version: s.run.version, result: 'FAILED' })
        .expect(200)
    ).body.data;
    for (const version of [fresh.version, changed.version])
      expect(
        (
          await s
            .call('post', `${s.base}/${fresh.previewId}/apply`)
            .send({ ...body, version, overwrite: true })
            .expect(409)
        ).body.code,
      ).toBe('TEST_RUN_VERSION_CONFLICT');
    const manual = (
      await s
        .call('post', '/test-runs')
        .send({ name: 'Avulsa', caseIds: [s.cases[0].id] })
        .expect(201)
    ).body.data;
    const started = (
      await s
        .call('post', `/test-runs/${manual.id}/start`)
        .send({ version: manual.version })
        .expect(200)
    ).body.data;
    expect(
      (
        await s
          .call('post', `/test-runs/${started.id}/result-imports/preview`)
          .attach('file', Buffer.from(s.xml), 'junit.xml')
          .expect(409)
      ).body.code,
    ).toBe('TEST_RESULT_IMPORT_PLAN_REQUIRED');
  });
  it('isolates imports by Workspace/project/run/author and checks current grants and archival', async () => {
    const s = await importSetup(1),
      p = await s.preview(),
      other = await importSetup(1);
    const body = {
      version: p.version,
      requestKey: randomUUID(),
      mappings: [{ itemId: 1, runCaseId: s.rc[0].id }],
    };
    await s.call('get', `${s.base}/${p.previewId}`, otherOwner).expect(404);
    await other.call('get', `${other.base}/${p.previewId}`).expect(404);
    await s
      .call('post', `${s.base}/${p.previewId}/apply`)
      .send({ ...body, mappings: [{ itemId: 1, runCaseId: other.rc[0].id }] })
      .expect(404);
    const wm = await join(s.ws.id);
    await s
      .call('put', `/members/${wm.id}`)
      .send({ projectRole: 'VIEWER' })
      .expect(200);
    await s
      .call('post', s.base + '/preview', member)
      .attach('file', Buffer.from(s.xml), 'junit.xml')
      .expect(403);
    await s.call('get', `${s.base}/${p.previewId}`, member).expect(404);
    await s.call('post', '/archive').send({}).expect(200);
    await s.call('get', `${s.base}/${p.previewId}`).expect(200);
    expect(
      (
        await s
          .call('post', `${s.base}/${p.previewId}/apply`)
          .send(body)
          .expect(409)
      ).body.code,
    ).toBe('PROJECT_ARCHIVED');
    await s
      .call('post', s.base + '/preview')
      .attach('file', Buffer.from(s.xml), 'junit.xml')
      .expect(409);
    await s.call('get', `${s.base}/not-a-uuid`).expect(400);
    await s
      .call('get', `${s.base}/${p.previewId}`)
      .query({ unexpected: 1 })
      .expect(400);
  });
  it('accepts 500-case bulk selections and 500-result apply JSON above 32 KiB, preserving total limits', async () => {
    const s = await setupExecution(),
      seed = await s.testCase();
    const template = await store.client.testCase.findUniqueOrThrow({
      where: { id: seed.id },
    });
    const ids = [seed.id, ...Array.from({ length: 499 }, () => randomUUID())];
    await store.client.testCase.createMany({
      data: ids.slice(1).map((id, i) => ({ ...template, id, sequence: i + 2 })),
    });
    let plan = await s.plan();
    plan = (
      await s
        .call('post', `/test-plans/${plan.id}/cases/bulk`)
        .send({ version: plan.version, caseIds: ids })
        .expect(200)
    ).body.data;
    expect(plan).toMatchObject({ version: 2 });
    expect(plan.cases).toHaveLength(500);
    await store.client.sequenceCounter.updateMany({
      where: { projectId: s.project.id, entityType: 'TEST_CASE' },
      data: { nextValue: 501 },
    });
    const extra = await s.testCase();
    await s
      .call('post', `/test-plans/${plan.id}/cases/bulk`)
      .send({ version: plan.version, caseIds: [extra.id] })
      .expect(400);
    plan = (
      await s
        .call('post', `/test-plans/${plan.id}/activate`)
        .send({ version: plan.version })
        .expect(200)
    ).body.data;
    let run = (
      await s
        .call('post', `/test-plans/${plan.id}/runs`)
        .send({ version: plan.version, name: '500 resultados' })
        .expect(201)
    ).body.data;
    run = (
      await s
        .call('post', `/test-runs/${run.id}/start`)
        .send({ version: run.version })
        .expect(200)
    ).body.data;
    const copies = await store.client.testRunCase.findMany({
      where: { testRunId: run.id },
      orderBy: { position: 'asc' },
    });
    const base = `/test-runs/${run.id}/result-imports`;
    const xml =
      '<testsuite>' +
      ids.map((id) => `<testcase name="${id}"/>`).join('') +
      '</testsuite>';
    const p = (
      await s
        .call('post', base + '/preview')
        .attach('file', Buffer.from(xml), '500.xml')
        .expect(200)
    ).body.data;
    const body = {
      version: p.version,
      requestKey: randomUUID(),
      mappings: copies.map((c, i) => ({ itemId: i + 1, runCaseId: c.id })),
    };
    const json = JSON.stringify(body, null, 2);
    expect(Buffer.byteLength(json)).toBeGreaterThan(32 * 1024);
    const applied = (
      await s
        .call('post', `${base}/${p.previewId}/apply`)
        .set('Content-Type', 'application/json')
        .send(json)
        .expect(200)
    ).body.data;
    expect(applied).toMatchObject({
      run: { version: run.version + 1, summary: { passed: 500, notTested: 0 } },
      import: { importedCount: 500 },
    });
    await s
      .call('post', `${base}/${p.previewId}/apply`)
      .set('Content-Type', 'application/json')
      .send(json + ' '.repeat(128 * 1024))
      .expect(413);
    await s
      .call('post', '/test-plans')
      .set('Content-Type', 'application/json')
      .send('{"name":"x"}' + ' '.repeat(32 * 1024))
      .expect(413);
  });
  it('paginates the authorized run/project inventories before returning summaries and independent automation grants', async () => {
    const s = await setupExecution(),
      foreign = await setupExecution();
    const automated = await s.testCase({ automationStatus: 'AUTOMATED' });
    await s.testCase();
    await s.testCase({ status: 'DRAFT', automationStatus: 'AUTOMATED' });
    const a = await s.run([automated.id], { name: 'Alfa' }),
      b = await s.run([automated.id], { name: 'Beta' });
    await s
      .call('post', `/test-runs/${b.id}/start`)
      .send({ version: b.version })
      .expect(200);
    const hiddenProject = (
      await http()
        .post(`/api/v1/workspaces/${s.ws.id}/projects`)
        .set('Authorization', auth(owner))
        .send({ key: 'PRIVATE', name: 'Projeto oculto' })
        .expect(201)
    ).body.data;
    const c = await foreign.testCase();
    await foreign.run([c.id], { name: 'Run estrangeira' });
    const wm = await join(s.ws.id);
    await s
      .call('put', `/members/${wm.id}`)
      .send({ projectRole: 'VIEWER' })
      .expect(200);
    const wsBase = `/api/v1/workspaces/${s.ws.id}`;
    const memberRole = await store.client.role.findFirstOrThrow({
      where: {
        workspaceId: s.ws.id,
        normalizedName: 'member',
        systemRole: true,
      },
    });
    await http()
      .delete(`${wsBase}/members/${wm.id}/roles/${memberRole.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    const role = (
      await http()
        .post(`${wsBase}/roles`)
        .set('Authorization', auth(owner))
        .send({
          name: 'Inventário parcial',
          permissionCodes: ['testrun.read', 'project.read'],
        })
        .expect(201)
    ).body.data;
    await http()
      .put(`${wsBase}/members/${wm.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    const get = (
      path: string,
      query: Record<string, unknown> = {},
      who = member,
    ) =>
      http().get(`/api/v1/${path}`).set('Authorization', auth(who)).query(query);
    const page = await get('test-runs', {
      workspaceId: s.ws.id,
      page: 1,
      size: 1,
      sort: 'name,asc',
    }).expect(200);
    expect(page.body.meta.pagination).toMatchObject({
      totalItems: 2,
      totalPages: 2,
      hasNext: true,
    });
    expect(page.body.data[0]).toMatchObject({
      id: a.id,
      projectId: s.project.id,
      projectName: s.project.name,
      workspaceName: 'Equipe de testes',
      summary: { total: 1, notTested: 1 },
    });
    expect(
      (
        await get('test-runs', {
          workspaceId: s.ws.id,
          page: 2,
          size: 1,
          sort: 'name,asc',
        }).expect(200)
      ).body.data[0].id,
    ).toBe(b.id);
    expect(
      (
        await get('test-runs', {
          workspaceId: s.ws.id,
          status: 'IN_PROGRESS',
          q: 'Beta',
        }).expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(1);
    for (const status of [
      'CREATED',
      'IN_PROGRESS',
      'COMPLETED',
      'ABORTED',
      'ALL',
    ])
      await get('test-runs', { workspaceId: s.ws.id, status }).expect(200);
    expect(
      (await get('dashboard/projects', { workspaceId: s.ws.id }).expect(200)).body
        .data,
    ).toEqual([
      expect.objectContaining({
        id: s.project.id,
        activeTestCases: null,
        automatedTestCases: null,
        automationCoverage: null,
      }),
    ]);
    await http()
      .patch(`${wsBase}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({
        permissionCodes: ['testrun.read', 'project.read', 'testcase.read'],
      })
      .expect(200);
    expect(
      (await get('dashboard/projects', { workspaceId: s.ws.id }).expect(200)).body
        .data[0],
    ).toMatchObject({
      activeTestCases: 2,
      automatedTestCases: 1,
      automationCoverage: 50,
    });
    await get('test-runs', {
      workspaceId: s.ws.id,
      projectId: hiddenProject.id,
    }).expect(404);
    await get('test-runs', { workspaceId: foreign.ws.id }).expect(404);
    await get('test-runs', { projectId: foreign.project.id }).expect(404);
    expect(
      (await get('test-runs').expect(200)).body.data.every(
        (r: { workspaceId: string }) => r.workspaceId !== foreign.ws.id,
      ),
    ).toBe(true);
    await s.call('post', '/archive').send({}).expect(200);
    expect(
      (
        await get('test-runs', { workspaceId: s.ws.id }).expect(200)
      ).body.data.every(
        (r: { projectStatus: string }) => r.projectStatus === 'ARCHIVED',
      ),
    ).toBe(true);
    expect(
      (await get('dashboard/projects', { workspaceId: s.ws.id }).expect(200)).body
        .meta.pagination.totalItems,
    ).toBe(0);
    expect(
      (
        await get('dashboard/projects', {
          workspaceId: s.ws.id,
          status: 'ALL',
        }).expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(1);
    expect(
      (
        await get('dashboard/projects', {
          workspaceId: s.ws.id,
          status: 'ARCHIVED',
        }).expect(200)
      ).body.data[0].activeTestCases,
    ).toBe(2);
    for (const path of ['test-runs', 'dashboard/projects']) {
      await http().get(`/api/v1/${path}`).expect(401);
      for (const query of [
        { workspaceId: 'bad' },
        { status: 'wrong' },
        { page: 0 },
        { size: 101 },
        { sort: 'bad,asc' },
        { extra: 1 },
      ])
        await get(path, query).expect(400);
    }
    await http()
      .patch(`${wsBase}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({ permissionCodes: ['project.read'] })
      .expect(200);
    expect(
      (await get('test-runs', { workspaceId: s.ws.id }).expect(200)).body.meta
        .pagination.totalItems,
    ).toBe(0);
    expect(
      (
        await get('dashboard/projects', {
          workspaceId: s.ws.id,
          status: 'ALL',
        }).expect(200)
      ).body.data[0].activeTestCases,
    ).toBeNull();
  });
  it('adds more than 120 cases to a plan and reads other modules without a shared request quota', async () => {
    const s = await setupExecution();
    const seed = await s.testCase();
    const template = await store.client.testCase.findUniqueOrThrow({
      where: { id: seed.id },
    });
    const ids = [seed.id, ...Array.from({ length: 129 }, () => randomUUID())];
    await store.client.testCase.createMany({
      data: ids.slice(1).map((id, i) => ({ ...template, id, sequence: i + 2 })),
    });
    let plan = await s.plan();
    for (const id of ids) {
      const res = await s
        .call('post', `/test-plans/${plan.id}/cases`)
        .send({ version: plan.version, testCaseId: id })
        .expect(200);
      expect(res.headers['retry-after']).toBeUndefined();
      expect(res.headers['cache-control']).toBe('no-store');
      plan = res.body.data;
    }
    expect(
      (await s.call('get', `/test-plans/${plan.id}/cases`).expect(200)).body
        .meta.pagination.totalItems,
    ).toBe(130);
    await s.call('get', '/test-cases/summary').expect(200);
    await s.call('get', '/test-vault').expect(200);
    await http()
      .get('/api/v1/dashboard/overview')
      .set('Authorization', auth(owner))
      .expect(200);
    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', auth(owner))
      .expect(200);
    await s.call('get', `/test-plans/${plan.id}`, otherOwner).expect(404);
    await http()
      .get(`/api/v1/workspaces/${s.ws.id}/projects/not-a-uuid/test-plans`)
      .set('Authorization', auth(owner))
      .expect(400);
    await s
      .call('post', `/test-plans/${plan.id}/cases`)
      .query({ unexpected: 1 })
      .send({ version: plan.version, testCaseId: seed.id })
      .expect(400);
  });
  it('preserves Phase 03 data and grants while upgrading to the new schema', async () => {
    expect(
      (
        await store.client.testCase.findUniqueOrThrow({
          where: { id: upgradeTestCase },
        })
      ).title,
    ).toBe('Caso anterior');
    expect(
      (
        await store.client.testStep.findUniqueOrThrow({
          where: { id: upgradeTestStep },
        })
      ).action,
    ).toBe('Passo anterior');
    expect(
      (
        await store.client.sequenceCounter.findFirstOrThrow({
          where: { workspaceId: upgradeWorkspace, projectId: upgradeProject },
        })
      ).nextValue,
    ).toBe(2);
    expect(await store.client.permission.count()).toBe(PERMISSIONS.length);
  });
  it('edits draft plans, orders dense selection, validates activation and freezes active plans', async () => {
    const { call, testCase, plan } = await setupExecution();
    const a = await testCase(),
      b = await testCase(),
      draft = await testCase({ status: 'DRAFT' });
    let p = await plan();
    expect(
      (
        await call('post', `/test-plans/${p.id}/activate`)
          .send({ version: p.version })
          .expect(400)
      ).body.code,
    ).toBe('TEST_SELECTION_INVALID');
    p = (
      await call('patch', `/test-plans/${p.id}`)
        .send({ version: p.version, name: 'Editado', description: 'Descrição' })
        .expect(200)
    ).body.data;
    p = (
      await call('post', `/test-plans/${p.id}/cases`)
        .send({ version: p.version, testCaseId: a.id })
        .expect(200)
    ).body.data;
    p = (
      await call('post', `/test-plans/${p.id}/cases`)
        .send({ version: p.version, testCaseId: b.id, position: 1 })
        .expect(200)
    ).body.data;
    expect(p.cases.map((c: { testCaseId: string }) => c.testCaseId)).toEqual([
      b.id,
      a.id,
    ]);
    await call('post', `/test-plans/${p.id}/cases`)
      .send({ version: p.version, testCaseId: a.id })
      .expect(409);
    p = (
      await call('put', `/test-plans/${p.id}/cases/order`)
        .send({ version: p.version, caseIds: [a.id, b.id] })
        .expect(200)
    ).body.data;
    expect(p.cases.map((c: { position: number }) => c.position)).toEqual([
      1, 2,
    ]);
    await call('put', `/test-plans/${p.id}/cases/order`)
      .send({ version: p.version, caseIds: [a.id] })
      .expect(400);
    p = (
      await call('post', `/test-plans/${p.id}/cases`)
        .send({ version: p.version, testCaseId: draft.id })
        .expect(200)
    ).body.data;
    await call('post', `/test-plans/${p.id}/activate`)
      .send({ version: p.version })
      .expect(409);
    p = (
      await call('delete', `/test-plans/${p.id}/cases/${draft.id}`)
        .send({ version: p.version })
        .expect(200)
    ).body.data;
    const selected = await call('get', `/test-plans/${p.id}/cases`)
      .query({ size: 1 })
      .expect(200);
    expect(selected.body.meta.pagination.totalItems).toBe(2);
    p = (
      await call('post', `/test-plans/${p.id}/activate`)
        .send({ version: p.version })
        .expect(200)
    ).body.data;
    const repeated = (
      await call('post', `/test-plans/${p.id}/activate`)
        .send({ version: p.version })
        .expect(200)
    ).body.data;
    expect(repeated.activatedAt).toBe(p.activatedAt);
    expect(repeated.version).toBe(p.version);
    await call('patch', `/test-plans/${p.id}`)
      .send({ version: p.version, name: 'Bloqueado' })
      .expect(409);
    expect(
      (await call('get', `/test-plans/${p.id}`).expect(200)).body.data.status,
    ).toBe('ACTIVE');
    expect(
      (
        await call('get', '/test-plans')
          .query({ q: 'Editado', status: 'ACTIVE' })
          .expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(1);
  });
  it('creates plan runs with inherited context and preserves snapshots after editing and archiving sources', async () => {
    const { ws, call, testCase, plan, copies } = await setupExecution();
    const field = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/custom-fields`)
        .set('Authorization', auth(owner))
        .send({
          key: 'ticket',
          name: 'Chamado',
          type: 'SINGLE_SELECT',
          target: 'TEST_CASE',
          required: true,
          position: 1,
          options: ['Original', 'Outro'],
        })
        .expect(201)
    ).body.data;
    const tag = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/tags`)
        .set('Authorization', auth(owner))
        .send({ name: 'Original' })
        .expect(201)
    ).body.data;
    const milestone = (
      await call('post', '/milestones')
        .send({ name: 'Marco original' })
        .expect(201)
    ).body.data;
    const environment = (
      await call('post', '/environments')
        .send({ name: 'Ambiente original' })
        .expect(201)
    ).body.data;
    let c = await testCase({
      title: 'Original',
      description: 'Descrição original',
      preconditions: 'Pré',
      postconditions: 'Pós',
      priority: 'HIGH',
      steps: [
        { action: 'Original', testData: 'Dado', expectedResult: 'Esperado' },
      ],
      tagIds: [tag.id],
      customFields: [{ fieldId: field.id, value: field.options[0].id }],
    });
    let p = await plan({
      caseIds: [c.id],
      milestoneId: milestone.id,
      environmentId: environment.id,
    });
    p = (
      await call('post', `/test-plans/${p.id}/activate`)
        .send({ version: p.version })
        .expect(200)
    ).body.data;
    const created = await call('post', `/test-plans/${p.id}/runs`)
      .send({ name: 'Do plano', version: p.version })
      .expect(201);
    const r = created.body.data;
    expect(created.headers.location).toContain(`/test-runs/${r.id}`);
    expect(r).toMatchObject({
      testPlanId: p.id,
      planNameSnapshot: 'Plano',
      milestoneSnapshot: { name: 'Marco original' },
      environmentSnapshot: { name: 'Ambiente original' },
      summary: { total: 1, notTested: 1 },
    });
    const before = await copies(r.id);
    expect(before[0].steps[0].id).not.toBe(c.steps[0].id);
    expect(before[0].customFieldsSnapshot[0]).toMatchObject({
      fieldId: field.id,
      name: 'Chamado',
      options: field.options,
      value: field.options[0].id,
    });
    c = (
      await call('patch', `/test-cases/${c.id}`)
        .send({
          version: c.version,
          title: 'Atual',
          description: 'Mudou',
          preconditions: null,
          postconditions: null,
          priority: 'LOW',
          customFields: [{ fieldId: field.id, value: field.options[1].id }],
        })
        .expect(200)
    ).body.data;
    c = (
      await call('patch', `/test-cases/${c.id}/steps/${c.steps[0].id}`)
        .send({
          version: c.version,
          action: 'Mudou',
          testData: null,
          expectedResult: 'Novo',
        })
        .expect(200)
    ).body.data;
    c = (
      await call('delete', `/test-cases/${c.id}/steps/${c.steps[0].id}`)
        .send({ version: c.version })
        .expect(200)
    ).body.data;
    await http()
      .patch(`/api/v1/workspaces/${ws.id}/custom-fields/${field.id}`)
      .set('Authorization', auth(owner))
      .send({ name: 'Nome atual', required: false })
      .expect(200);
    await http()
      .post(`/api/v1/workspaces/${ws.id}/custom-fields/${field.id}/archive`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(200);
    await http()
      .patch(`/api/v1/workspaces/${ws.id}/tags/${tag.id}`)
      .set('Authorization', auth(owner))
      .send({ name: 'Tag atual' })
      .expect(200);
    await call('patch', `/environments/${environment.id}`)
      .send({ name: 'Ambiente atual' })
      .expect(200);
    await call('delete', `/environments/${environment.id}`)
      .send({})
      .expect(204);
    await call('patch', `/milestones/${milestone.id}`)
      .send({ name: 'Marco atual' })
      .expect(200);
    await call('post', `/test-cases/${c.id}/archive`)
      .send({ version: c.version })
      .expect(200);
    expect(await copies(r.id)).toEqual(before);
    expect(
      (await call('get', `/test-runs/${r.id}`).expect(200)).body.data,
    ).toEqual(r);
    await call('post', `/test-plans/${p.id}/runs`)
      .send({ name: 'Novo', version: p.version })
      .expect(404);
    const started = (
      await call('post', `/test-runs/${r.id}/start`)
        .send({ version: r.version })
        .expect(200)
    ).body.data;
    await call('put', `/test-runs/${r.id}/cases/${before[0].id}/result`)
      .send({ version: started.version, result: 'SKIPPED' })
      .expect(200);
    expect(
      (
        await call('get', `/test-runs/${r.id}/cases/${before[0].id}`).expect(
          200,
        )
      ).body.data.titleSnapshot,
    ).toBe('Original');
  });
  it('records manual step/case results, invalidates stale overall results and closes immutable runs', async () => {
    const { call, testCase, run, copies, ws } = await setupExecution();
    const c = await testCase({ steps: [{ action: 'A' }, { action: 'B' }] });
    let r = await run([c.id]);
    const [copy] = await copies(r.id);
    await call('put', `/test-runs/${r.id}/cases/${copy.id}/result`)
      .send({ version: r.version, result: 'PASSED' })
      .expect(409);
    await call('post', `/test-runs/${r.id}/complete`)
      .send({ version: r.version })
      .expect(409);
    r = (
      await call('post', `/test-runs/${r.id}/start`)
        .send({ version: r.version })
        .expect(200)
    ).body.data;
    const again = (
      await call('post', `/test-runs/${r.id}/start`)
        .send({ version: r.version })
        .expect(200)
    ).body.data;
    expect(again.startedAt).toBe(r.startedAt);
    expect(again.version).toBe(r.version);
    await call('put', `/test-runs/${r.id}/cases/${copy.id}/result`)
      .send({ version: r.version, result: 'PASSED' })
      .expect(409);
    for (const step of copy.steps)
      r = (
        await call(
          'put',
          `/test-runs/${r.id}/cases/${copy.id}/steps/${step.id}/result`,
        )
          .send({
            version: r.version,
            result: 'PASSED',
            actualResult: 'Observado',
            comment: 'Conferido',
          })
          .expect(200)
      ).body.data;
    const passed = await call(
      'put',
      `/test-runs/${r.id}/cases/${copy.id}/result`,
    )
      .send({ version: r.version, result: 'PASSED', comment: 'Aprovado' })
      .expect(200);
    r = passed.body.data;
    expect(r.summary.passed).toBe(1);
    expect(
      (
        await store.client.auditEvent.findFirstOrThrow({
          where: {
            workspaceId: ws.id,
            action: 'test.run_case_result_recorded',
          },
        })
      ).correlationId,
    ).toBe(passed.headers['x-request-id']);
    r = (
      await call(
        'put',
        `/test-runs/${r.id}/cases/${copy.id}/steps/${copy.steps[0].id}/result`,
      )
        .send({
          version: r.version,
          result: 'NOT_TESTED',
          actualResult: null,
          comment: null,
        })
        .expect(200)
    ).body.data;
    expect(r.summary.notTested).toBe(1);
    const current = (
      await call('get', `/test-runs/${r.id}/cases/${copy.id}`).expect(200)
    ).body.data;
    expect(current.executedBy).toBeNull();
    expect(current.steps[0].executedAt).toBeNull();
    await call('post', `/test-runs/${r.id}/complete`)
      .send({ version: r.version })
      .expect(409);
    r = (
      await call('put', `/test-runs/${r.id}/cases/${copy.id}/result`)
        .send({ version: r.version, result: 'FAILED' })
        .expect(200)
    ).body.data;
    r = (
      await call('post', `/test-runs/${r.id}/complete`)
        .send({ version: r.version })
        .expect(200)
    ).body.data;
    expect(r.summary.failed).toBe(1);
    expect(r.status).toBe('COMPLETED');
    const complete = (
      await call('post', `/test-runs/${r.id}/complete`)
        .send({ version: r.version })
        .expect(200)
    ).body.data;
    expect(complete.finishedAt).toBe(r.finishedAt);
    await call('put', `/test-runs/${r.id}/cases/${copy.id}/result`)
      .send({ version: r.version, result: 'PASSED' })
      .expect(409);
    await call('post', `/test-runs/${r.id}/start`)
      .send({ version: r.version })
      .expect(409);
    await call('post', `/test-runs/${r.id}/abort`)
      .send({ version: r.version })
      .expect(409);
    await call('post', `/test-runs/${r.id}/comments`)
      .send({ version: r.version, text: 'Terminal' })
      .expect(409);
  });
  it('adds immutable comments at run/case/step scope and validates their references', async () => {
    const { call, testCase, run, copies } = await setupExecution();
    const c = await testCase({ steps: [{ action: 'A' }] });
    let r = await run([c.id]);
    const [copy] = await copies(r.id);
    r = (
      await call('post', `/test-runs/${r.id}/start`)
        .send({ version: r.version })
        .expect(200)
    ).body.data;
    for (const context of [
      {},
      { runCaseId: copy.id },
      { runCaseId: copy.id, runStepId: copy.steps[0].id },
    ])
      r = (
        await call('post', `/test-runs/${r.id}/comments`)
          .send({ version: r.version, text: 'Comentário', ...context })
          .expect(200)
      ).body.data;
    const comments = await call('get', `/test-runs/${r.id}/comments`)
      .query({ size: 1, q: 'Comentário', sort: 'createdAt,desc' })
      .expect(200);
    expect(comments.body.meta.pagination.totalItems).toBe(3);
    expect(comments.body.data[0].createdBy).toBe(owner.id);
    await call('post', `/test-runs/${r.id}/comments`)
      .send({
        version: r.version,
        text: 'Inválido',
        runStepId: copy.steps[0].id,
      })
      .expect(400);
    const other = await run([c.id]);
    const [foreign] = await copies(other.id);
    await call('post', `/test-runs/${r.id}/comments`)
      .send({ version: r.version, text: 'Fora', runCaseId: foreign.id })
      .expect(404);
    await call('post', `/test-runs/${r.id}/comments`)
      .send({
        version: r.version,
        text: 'Fora',
        runCaseId: copy.id,
        runStepId: foreign.steps[0].id,
      })
      .expect(404);
    expect(
      (await call('get', `/test-runs/${r.id}`).expect(200)).body.data.version,
    ).toBe(r.version);
  });
  it('aborts open runs preserving partial results and blocks completing/archiving plans with open runs', async () => {
    const { call, testCase, plan, run, copies } = await setupExecution();
    const c = await testCase();
    let p = await plan({ caseIds: [c.id] });
    p = (
      await call('post', `/test-plans/${p.id}/activate`)
        .send({ version: p.version })
        .expect(200)
    ).body.data;
    let r = (
      await call('post', `/test-plans/${p.id}/runs`)
        .send({ version: p.version, name: 'Do plano' })
        .expect(201)
    ).body.data;
    for (const action of ['complete', 'archive'])
      expect(
        (
          await call('post', `/test-plans/${p.id}/${action}`)
            .send({ version: p.version })
            .expect(409)
        ).body.code,
      ).toBe('TEST_PLAN_RUNS_OPEN');
    const [copy] = await copies(r.id);
    r = (
      await call('post', `/test-runs/${r.id}/start`)
        .send({ version: r.version })
        .expect(200)
    ).body.data;
    r = (
      await call('put', `/test-runs/${r.id}/cases/${copy.id}/result`)
        .send({ version: r.version, result: 'BLOCKED' })
        .expect(200)
    ).body.data;
    r = (
      await call('post', `/test-runs/${r.id}/abort`)
        .send({ version: r.version })
        .expect(200)
    ).body.data;
    expect(r.summary.blocked).toBe(1);
    const twice = (
      await call('post', `/test-runs/${r.id}/abort`)
        .send({ version: r.version })
        .expect(200)
    ).body.data;
    expect(twice.finishedAt).toBe(r.finishedAt);
    p = (
      await call('post', `/test-plans/${p.id}/complete`)
        .send({ version: p.version })
        .expect(200)
    ).body.data;
    await call('post', `/test-plans/${p.id}/runs`)
      .send({ version: p.version, name: 'Concluído' })
      .expect(409);
    p = (
      await call('post', `/test-plans/${p.id}/archive`)
        .send({ version: p.version })
        .expect(200)
    ).body.data;
    expect(
      (await call('get', '/test-plans').expect(200)).body.meta.pagination
        .totalItems,
    ).toBe(0);
    expect(
      (
        await call('get', '/test-plans')
          .query({ status: 'ARCHIVED' })
          .expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(1);
    expect(
      (
        await call('post', `/test-plans/${p.id}/archive`)
          .send({ version: p.version })
          .expect(200)
      ).body.data.archivedAt,
    ).toBe(p.archivedAt);
    const adhoc = await run([c.id]);
    const aborted = (
      await call('post', `/test-runs/${adhoc.id}/abort`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    expect(aborted.startedAt).toBeNull();
    expect(aborted.summary.notTested).toBe(1);
  });
  it('serializes optimistic updates and audits exactly one winner', async () => {
    const { call, testCase, run, copies, plan } = await setupExecution();
    const c = await testCase();
    let r = await run([c.id]);
    const [copy] = await copies(r.id);
    r = (
      await call('post', `/test-runs/${r.id}/start`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    const results = await Promise.all(
      ['PASSED', 'FAILED'].map((result) =>
        call('put', `/test-runs/${r.id}/cases/${copy.id}/result`).send({
          version: r.version,
          result,
        }),
      ),
    );
    expect(results.map((v) => v.status).sort()).toEqual([200, 409]);
    expect(results.find((v) => v.status === 409)!.body.code).toBe(
      'TEST_RUN_VERSION_CONFLICT',
    );
    expect(
      await store.client.auditEvent.count({
        where: { entityId: r.id, action: 'test.run_case_result_recorded' },
      }),
    ).toBe(1);
    const p = await plan();
    const edits = await Promise.all(
      ['A', 'B'].map((name) =>
        call('patch', `/test-plans/${p.id}`).send({ version: 1, name }),
      ),
    );
    expect(edits.map((v) => v.status).sort()).toEqual([200, 409]);
    expect(edits.find((v) => v.status === 409)!.body.code).toBe(
      'TEST_PLAN_VERSION_CONFLICT',
    );
  });
  it('rejects unavailable context, inactive selections and newly required fields atomically', async () => {
    const { call, ws, testCase, run } = await setupExecution();
    const active = await testCase(),
      draft = await testCase({ status: 'DRAFT' }),
      deprecated = await testCase({ status: 'DEPRECATED' });
    for (const c of [draft, deprecated])
      await call('post', '/test-runs')
        .send({ name: 'Inválido', caseIds: [c.id] })
        .expect(409);
    const env = (
      await call('post', '/environments')
        .send({ name: 'Inativo', active: false })
        .expect(201)
    ).body.data;
    await call('post', '/test-plans')
      .send({ name: 'Inválido', environmentId: env.id })
      .expect(409);
    const milestone = (
      await call('post', '/milestones').send({ name: 'Cancelado' }).expect(201)
    ).body.data;
    await call('patch', `/milestones/${milestone.id}`)
      .send({ status: 'CANCELLED' })
      .expect(200);
    await call('post', '/test-runs')
      .send({
        name: 'Inválido',
        caseIds: [active.id],
        milestoneId: milestone.id,
      })
      .expect(409);
    const field = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/custom-fields`)
        .set('Authorization', auth(owner))
        .send({
          key: 'new_field',
          name: 'Obrigatório',
          type: 'BOOLEAN',
          target: 'TEST_CASE',
          required: true,
          position: 1,
          options: [],
        })
        .expect(201)
    ).body.data;
    const before = await store.client.testRun.count({
      where: { workspaceId: ws.id },
    });
    await call('post', '/test-runs')
      .send({ name: 'Inválido', caseIds: [active.id] })
      .expect(400);
    expect(
      await store.client.testRun.count({ where: { workspaceId: ws.id } }),
    ).toBe(before);
    await call('patch', `/test-cases/${active.id}`)
      .send({ version: 1, customFields: [{ fieldId: field.id, value: false }] })
      .expect(200);
    const r = await run([active.id]);
    expect(r.summary.total).toBe(1);
  });
  it('isolates discovery, context, source selections and result targets across projects and tenants with composite FKs', async () => {
    const a = await setupExecution(),
      b = await setupExecution();
    const ca = await a.testCase({ steps: [{ action: 'A' }] }),
      cb = await b.testCase({ steps: [{ action: 'B' }] });
    const pa = await a.plan({ caseIds: [ca.id] });
    let ra = await a.run([ca.id]);
    const rb = await b.run([cb.id]);
    const [rca] = await a.copies(ra.id),
      [rcb] = await b.copies(rb.id);
    for (const path of [
      `/test-runs/${ra.id}`,
      `/test-plans/${pa.id}`,
      `/test-runs/${ra.id}/cases`,
      `/test-runs/${ra.id}/comments`,
    ])
      await b.call('get', path).expect(404);
    await a.call('get', `/test-runs/${ra.id}`, otherOwner).expect(404);
    await b
      .call('post', '/test-runs')
      .send({ name: 'Fora', caseIds: [ca.id] })
      .expect(404);
    await b
      .call('post', '/test-plans')
      .send({ name: 'Fora', caseIds: [ca.id] })
      .expect(404);
    expect(
      (await b.call('get', '/test-runs').query({ q: 'Execução' }).expect(200))
        .body.meta.pagination.totalItems,
    ).toBe(1);
    await b.call('get', '/test-runs').query({ testPlanId: pa.id }).expect(404);
    ra = (
      await a
        .call('post', `/test-runs/${ra.id}/start`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    await a
      .call('put', `/test-runs/${ra.id}/cases/${rcb.id}/result`)
      .send({ version: ra.version, result: 'FAILED' })
      .expect(404);
    await a
      .call(
        'put',
        `/test-runs/${ra.id}/cases/${rca.id}/steps/${rcb.steps[0].id}/result`,
      )
      .send({ version: ra.version, result: 'FAILED' })
      .expect(404);
    await expect(
      store.client.testRunCase.update({
        where: { id: rcb.id },
        data: { testCaseId: ca.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      store.client.testRunStep.update({
        where: { id: rcb.steps[0].id },
        data: { testRunCaseId: rca.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      store.client.executionComment.create({
        data: {
          id: randomUUID(),
          workspaceId: a.ws.id,
          projectId: a.project.id,
          testRunId: ra.id,
          runCaseId: rcb.id,
          runStepId: null,
          text: 'Fora',
          createdBy: owner.id,
          createdAt: new Date(),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    const same = (
      await http()
        .post(`/api/v1/workspaces/${a.ws.id}/projects`)
        .set('Authorization', auth(owner))
        .send({ key: 'OTHER', name: 'Outro' })
        .expect(201)
    ).body.data;
    await http()
      .post(`/api/v1/workspaces/${a.ws.id}/projects/${same.id}/test-runs`)
      .set('Authorization', auth(owner))
      .send({ name: 'Outro projeto', caseIds: [ca.id] })
      .expect(404);
    const milestone = (
      await a.call('post', '/milestones').send({ name: 'Marco' }).expect(201)
    ).body.data;
    await b
      .call('post', '/test-plans')
      .send({ name: 'Fora', milestoneId: milestone.id })
      .expect(404);
  });
  it('intersects execution grants with local roles, revokes immediately and blocks archived projects', async () => {
    const { call, base, ws, testCase, run } = await setupExecution();
    const c = await testCase();
    let r = await run([c.id]);
    const wm = await join(ws.id);
    await call('get', '/test-runs', member).expect(404);
    await http()
      .put(`${base}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'VIEWER' })
      .expect(200);
    await call('get', '/test-runs', member).expect(200);
    await call('post', `/test-runs/${r.id}/start`, member)
      .send({ version: 1 })
      .expect(403);
    const role = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/roles`)
        .set('Authorization', auth(owner))
        .send({
          name: 'Execução',
          permissionCodes: ['testrun.execute', 'testrun.manage'],
        })
        .expect(201)
    ).body.data;
    await http()
      .put(`/api/v1/workspaces/${ws.id}/members/${wm.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await call('post', `/test-runs/${r.id}/start`, member)
      .send({ version: 1 })
      .expect(403);
    await http()
      .put(`${base}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'EDITOR' })
      .expect(200);
    r = (
      await call('post', `/test-runs/${r.id}/start`, member)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    await call('post', '/test-runs', member)
      .send({ name: 'Manage limitado', caseIds: [c.id] })
      .expect(403);
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/members/${wm.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await call('post', `/test-runs/${r.id}/comments`, member)
      .send({ version: r.version, text: 'Revogado' })
      .expect(403);
    await http()
      .delete(`${base}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await call('get', `/test-runs/${r.id}`, member).expect(404);
    await call('post', '/archive').send({}).expect(200);
    await call('get', `/test-runs/${r.id}`).expect(200);
    expect(
      (
        await call('post', `/test-runs/${r.id}/abort`)
          .send({ version: r.version })
          .expect(409)
      ).body.code,
    ).toBe('PROJECT_ARCHIVED');
  });
  it('validates DTOs and rejects client snapshots, sources, duplicate selection and stale plan versions', async () => {
    const { call, testCase, plan } = await setupExecution();
    const c = await testCase();
    const p = await plan({ caseIds: [c.id] });
    for (const body of [
      { name: 'A', caseIds: [] },
      { name: 'A', caseIds: [c.id, c.id] },
      { name: 'A', caseIds: [c.id], source: 'API' },
      { name: 'A', caseIds: [c.id], snapshots: [] },
      { name: 'A', caseIds: null },
      { name: null, caseIds: [c.id] },
    ])
      await call('post', '/test-runs').send(body).expect(400);
    await call('post', `/test-plans/${p.id}/runs`)
      .send({ name: 'A', version: p.version })
      .expect(409);
    const active = (
      await call('post', `/test-plans/${p.id}/activate`)
        .send({ version: p.version })
        .expect(200)
    ).body.data;
    expect(
      (
        await call('post', `/test-plans/${p.id}/runs`)
          .send({ name: 'A', version: p.version })
          .expect(409)
      ).body.code,
    ).toBe('TEST_PLAN_VERSION_CONFLICT');
    const r = (
      await call('post', `/test-plans/${p.id}/runs`)
        .send({ name: 'A', version: active.version })
        .expect(201)
    ).body.data;
    await call('post', `/test-runs/${r.id}/start`).send({}).expect(400);
    await call('get', '/test-runs')
      .query({ sort: 'createdBy,asc' })
      .expect(400);
    await call('get', `/test-runs/${r.id}/cases`)
      .query({ result: 'UNKNOWN' })
      .expect(400);
    await call('get', `/test-runs/${r.id}`).query({ unknown: 'x' }).expect(400);
    await http().get(`${basePath()}/test-runs`).expect(401);
    function basePath() {
      return `/api/v1/workspaces/${randomUUID()}/projects/${randomUUID()}`;
    }
  });
});

describe('Defects with MySQL/MariaDB, scoped failure references and private attachments', () => {
  async function setupDefects() {
    const ws = await workspace();
    const project = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/projects`)
        .set('Authorization', auth(owner))
        .send({ key: 'BUG', name: 'Defeitos' })
        .expect(201)
    ).body.data;
    const base = `/api/v1/workspaces/${ws.id}/projects/${project.id}`;
    const call = (
      method: 'get' | 'post' | 'patch' | 'put' | 'delete',
      path: string,
      account = owner,
    ) => http()[method](`${base}${path}`).set('Authorization', auth(account));
    const create = async (body: Record<string, unknown> = {}) =>
      (
        await call('post', '/defects')
          .send({ title: 'Login falhou', ...body })
          .expect(201)
      ).body.data;
    const upload = async () =>
      (
        await http()
          .post(`/api/v1/workspaces/${ws.id}/attachments`)
          .set('Authorization', auth(owner))
          .attach('file', Buffer.from('Evidência privada'), 'proof.txt')
          .expect(201)
      ).body.data;
    const failure = async (result = 'FAILED') => {
      const c = (
        await call('post', '/test-cases')
          .send({
            title: 'Caso com falha',
            status: 'ACTIVE',
            severity: 'MAJOR',
            steps: [{ action: 'Entrar', expectedResult: 'Painel' }],
          })
          .expect(201)
      ).body.data;
      let r = (
        await call('post', '/test-runs')
          .send({ name: 'Run com falha', caseIds: [c.id] })
          .expect(201)
      ).body.data;
      const copy = (await call('get', `/test-runs/${r.id}/cases`).expect(200))
        .body.data[0];
      r = (
        await call('post', `/test-runs/${r.id}/start`)
          .send({ version: r.version })
          .expect(200)
      ).body.data;
      if (result === 'PASSED') {
        r = (
          await call(
            'put',
            `/test-runs/${r.id}/cases/${copy.id}/steps/${copy.steps[0].id}/result`,
          )
            .send({ version: r.version, result: 'PASSED' })
            .expect(200)
        ).body.data;
      }
      r = (
        await call('put', `/test-runs/${r.id}/cases/${copy.id}/result`)
          .send({
            version: r.version,
            result,
            comment: 'Tela apresentou erro.',
          })
          .expect(200)
      ).body.data;
      return { c, r, copy };
    };
    return { ws, project, base, call, create, upload, failure };
  }
  it('recovers legacy audit dates and actors without inventing transitions, comments or names', async () => {
    const rows = await store.client.defectHistoryEvent.findMany({
      where: { defectId: upgradeDefect },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(rows.map((r) => r.id)).toEqual(upgradeDefectAuditIds.slice(0, 3));
    expect(rows.map((r) => r.type)).toEqual(['CREATED', 'UPDATED', 'UPDATED']);
    for (const row of rows) {
      const audit = await store.client.auditEvent.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(row).toMatchObject({
        workspaceId: upgradeWorkspace,
        projectId: upgradeProject,
        defectId: upgradeDefect,
        actorUserId: audit.actorUserId,
        createdAt: audit.occurredAt,
        actorDisplayName: null,
        fromStatus: null,
        toStatus: null,
        comment: null,
      });
    }
    expect(
      await store.client.defectHistoryEvent.count({
        where: { id: upgradeDefectAuditIds[3] },
      }),
    ).toBe(0);
  });
  it('persists comments, creation and full-edit status transitions together without rewriting description', async () => {
    const { call, create, ws, project } = await setupDefects();
    let d = await create({ description: 'Descrição original' });
    const change = async (fields: Record<string, unknown>) =>
      (d = (
        await call('patch', `/defects/${d.id}`)
          .send({ version: d.version, ...fields })
          .expect(200)
      ).body.data);
    const read = () => call('get', `/defects/${d.id}/history`);
    const initial = await read().expect(200);
    expect(initial.headers['cache-control']).toBe('no-store');
    expect(initial.body.meta.requestId).toBe(initial.headers['x-request-id']);
    expect(initial.body.data).toHaveLength(1);
    expect(initial.body.data[0]).toMatchObject({
      type: 'CREATED',
      actor: { id: owner.id },
      createdAt: d.createdAt,
      fromStatus: null,
      toStatus: 'OPEN',
      comment: null,
    });
    const user = await store.client.user.findUniqueOrThrow({
      where: { id: owner.id },
    });
    expect(initial.body.data[0].actor.displayName).toBe(user.displayName);
    expect(JSON.stringify(initial.body)).not.toContain(user.email);
    const comment =
      'Primeira linha\n<script>alert("texto simples")</script> & **sem formatação**';
    await change({ comment: `  ${comment}  ` });
    expect(d.version).toBe(2);
    expect(d.description).toBe('Descrição original');
    expect(d.resolvedAt).toBeNull();
    await change({ status: 'IN_PROGRESS', comment: ' Investigação iniciada ' });
    const version = d.version;
    await change({ status: 'IN_PROGRESS' });
    expect(d.version).toBe(version);
    await change({
      status: 'IN_PROGRESS',
      comment: 'Mantém situação; novo comentário',
    });
    await change({
      title: 'Edição completa',
      severity: 'MAJOR',
      status: 'RESOLVED',
    });
    const resolved = d.resolvedAt;
    await change({ status: 'CLOSED', comment: 'Encerrado' });
    expect(d.resolvedAt).toBe(resolved);
    await change({ status: 'OPEN', comment: 'Reaberto após nova evidência' });
    expect(d.resolvedAt).toBeNull();
    const history = (await read().query({ size: 100 }).expect(200)).body;
    expect(history.meta.pagination.totalItems).toBe(7);
    expect(
      history.data.map((e: { comment: string | null }) => e.comment),
    ).toEqual([
      null,
      comment,
      'Investigação iniciada',
      'Mantém situação; novo comentário',
      null,
      'Encerrado',
      'Reaberto após nova evidência',
    ]);
    expect(
      history.data
        .slice(1)
        .map((e: { fromStatus: string | null; toStatus: string | null }) => [
          e.fromStatus,
          e.toStatus,
        ]),
    ).toEqual([
      [null, null],
      ['OPEN', 'IN_PROGRESS'],
      [null, null],
      ['IN_PROGRESS', 'RESOLVED'],
      ['RESOLVED', 'CLOSED'],
      ['CLOSED', 'OPEN'],
    ]);
    expect(history.data.at(-1).createdAt).toBe(d.updatedAt);
    const persisted = await store.client.defectHistoryEvent.findMany({
      where: { workspaceId: ws.id, projectId: project.id, defectId: d.id },
    });
    expect(persisted).toHaveLength(7);
    expect(persisted.find((e) => e.comment === comment)?.actorDisplayName).toBe(
      user.displayName,
    );
    // Reuse of the same version cannot persist an uncertain request twice.
    await call('patch', `/defects/${d.id}`)
      .send({ version: d.version - 1, comment: 'Reaberto após nova evidência' })
      .expect(409);
    expect((await read().expect(200)).body.meta.pagination.totalItems).toBe(7);
  });
  it('records creation through failure and other defect mutations using the unified append-only history', async () => {
    const { call, failure, upload, ws } = await setupDefects();
    const { copy } = await failure();
    let d = (
      await call('post', '/defects/from-failure')
        .send({ testRunCaseId: copy.id })
        .expect(201)
    ).body.data;
    const attachment = await upload();
    d = (
      await call('post', `/defects/${d.id}/attachments`)
        .send({ version: d.version, attachmentId: attachment.id })
        .expect(200)
    ).body.data;
    d = (
      await call('post', `/defects/${d.id}/external-link`)
        .send({
          version: d.version,
          externalSystem: 'Manual',
          externalIssueId: '1',
          externalUrl: 'https://example.com/1',
        })
        .expect(200)
    ).body.data;
    const events = (await call('get', `/defects/${d.id}/history`).expect(200))
      .body.data;
    expect(events.map((e: { type: string }) => e.type)).toEqual([
      'CREATED',
      'UPDATED',
      'UPDATED',
    ]);
    expect(events[0]).toMatchObject({
      fromStatus: null,
      toStatus: 'OPEN',
      comment: null,
    });
    expect(events[1]).toMatchObject({
      fromStatus: null,
      toStatus: null,
      comment: null,
    });
    await store.transaction(ws.id, async (tx) => {
      expect('update' in tx.defectHistory).toBe(false);
      expect('remove' in tx.defectHistory).toBe(false);
    });
  });
  it('paginates more than 100 history events deterministically and rejects unknown queries or malformed comments', async () => {
    const { ws, project, call, create } = await setupDefects();
    let d = await create();
    for (let i = 0; i < 102; i++)
      d = (
        await call('patch', `/defects/${d.id}`)
          .send({ version: d.version, comment: `Comentário ${i}` })
          .expect(200)
      ).body.data;
    expect(d.version).toBe(103);
    const events = await store.client.defectHistoryEvent.findMany({
      where: { defectId: d.id },
    });
    // Equal timestamps must be ordered by ID, not by insertion order or page.
    const sameTime = new Date('2026-10-01T12:00:00.000Z');
    await store.client.defectHistoryEvent.updateMany({
      where: { defectId: d.id },
      data: { createdAt: sameTime },
    });
    const read = () => call('get', `/defects/${d.id}/history`);
    const first = (
      await read().query({ size: 100, sort: 'createdAt,asc' }).expect(200)
    ).body;
    const second = (
      await read()
        .query({ page: 2, size: 100, sort: 'createdAt,asc' })
        .expect(200)
    ).body;
    expect(first.meta.pagination).toMatchObject({
      totalItems: 103,
      totalPages: 2,
      hasNext: true,
      hasPrevious: false,
    });
    expect(second.data).toHaveLength(3);
    expect(second.meta.pagination.hasPrevious).toBe(true);
    expect(
      [...first.data, ...second.data].map((e: { id: string }) => e.id),
    ).toEqual(events.map((e) => e.id).sort());
    expect(
      (await read().query({ page: 3, size: 100 }).expect(200)).body.data,
    ).toEqual([]);
    for (const query of [
      { size: 101 },
      { page: 0 },
      { sort: 'type,asc' },
      { q: 'Comentário' },
      { status: 'OPEN' },
    ])
      await read().query(query).expect(400);
    await call('get', `/defects/bad/history`).expect(400);
    for (const comment of [null, '', '  \n\t ', 42, {}, [], 'x'.repeat(10001)])
      await call('patch', `/defects/${d.id}`)
        .send({ version: d.version, comment })
        .expect(400);
    await call('patch', `/defects/${d.id}`)
      .send({ version: d.version })
      .expect(400);
    // 10000 plain-text characters are supported under the JSON body limit.
    d = (
      await call('patch', `/defects/${d.id}`)
        .send({ version: d.version, comment: 'x'.repeat(10000) })
        .expect(200)
    ).body.data;
    expect((await read().expect(200)).body.meta.pagination.totalItems).toBe(104);
    expect(
      await store.client.defectHistoryEvent.count({
        where: { workspaceId: ws.id, projectId: project.id, defectId: d.id },
      }),
    ).toBe(104);
  });
  it('isolates history and writes by Workspace/project permissions, preserving removed authors and archived reads', async () => {
    const one = await setupDefects(),
      two = await setupDefects();
    const d = await one.create();
    await one.call('get', `/defects/${d.id}/history`, otherOwner).expect(404);
    await two.call('get', `/defects/${d.id}/history`).expect(404);
    const another = (
      await http()
        .post(`/api/v1/workspaces/${one.ws.id}/projects`)
        .set('Authorization', auth(owner))
        .send({ key: 'HIST2', name: 'Outro projeto' })
        .expect(201)
    ).body.data;
    await http()
      .get(
        `/api/v1/workspaces/${one.ws.id}/projects/${another.id}/defects/${d.id}/history`,
      )
      .set('Authorization', auth(owner))
      .expect(404);
    await http().get(`${one.base}/defects/${d.id}/history`).expect(401);
    const wm = await join(one.ws.id);
    await one.call('get', `/defects/${d.id}/history`, member).expect(404);
    await one
      .call('put', `/members/${wm.id}`)
      .send({ projectRole: 'VIEWER' })
      .expect(200);
    expect(
      (await one.call('get', `/defects/${d.id}/history`, member).expect(200)).body
        .data,
    ).toHaveLength(1);
    await one
      .call('patch', `/defects/${d.id}`, member)
      .send({ version: d.version, comment: 'Sem permissão' })
      .expect(403);
    const role = (
      await http()
        .post(`/api/v1/workspaces/${one.ws.id}/roles`)
        .set('Authorization', auth(owner))
        .send({
          name: 'Histórico de defeitos',
          permissionCodes: ['defect.read', 'defect.manage'],
        })
        .expect(201)
    ).body.data;
    await http()
      .put(`/api/v1/workspaces/${one.ws.id}/members/${wm.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await one
      .call('put', `/members/${wm.id}`)
      .send({ projectRole: 'EDITOR' })
      .expect(200);
    const written = (
      await one
        .call('patch', `/defects/${d.id}`, member)
        .send({ version: d.version, comment: 'Comentário do membro' })
        .expect(200)
    ).body.data;
    const events = (await one.call('get', `/defects/${d.id}/history`).expect(200))
      .body.data;
    const historicActor = events.at(-1).actor;
    expect(historicActor.id).toBe(member.id);
    await http()
      .delete(`/api/v1/workspaces/${one.ws.id}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    expect(
      (
        await one.call('get', `/defects/${d.id}/history`).expect(200)
      ).body.data.at(-1).actor,
    ).toEqual(historicActor);
    await one.call('get', `/defects/${d.id}/history`, member).expect(404);
    await one.call('post', '/archive').send({}).expect(200);
    expect(
      (await one.call('get', `/defects/${d.id}/history`).expect(200)).body.data,
    ).toHaveLength(2);
    await one
      .call('patch', `/defects/${d.id}`)
      .send({ version: written.version, comment: 'Arquivado' })
      .expect(409);
    expect(
      (await one.call('get', `/defects/${d.id}/history`).expect(200)).body.data,
    ).toHaveLength(2);
  });
  it('rolls back version, status, resolution and audit if history persistence fails and serializes competing comments', async () => {
    const { ws, project, call, create } = await setupDefects();
    const d = await create();
    const original = store.transaction.bind(store);
    const spy = vi.spyOn(store, 'transaction').mockImplementation((scope, work) =>
      original(scope, async (tx) => {
        const failing = Object.create(tx) as typeof tx;
        failing.defectHistory = {
          ...tx.defectHistory,
          create: async () => {
            throw new Error('Falha de persistência');
          },
        };
        return work(failing);
      }),
    );
    try {
      await call('patch', `/defects/${d.id}`)
        .send({
          version: d.version,
          status: 'RESOLVED',
          comment: 'Não deve gravar',
        })
        .expect(500);
      await call('post', '/defects')
        .send({ title: 'Criação não deve gravar' })
        .expect(500);
    } finally {
      spy.mockRestore();
    }
    expect((await call('get', `/defects/${d.id}`).expect(200)).body.data).toEqual(
      d,
    );
    expect(
      await store.client.defect.count({ where: { projectId: project.id } }),
    ).toBe(1);
    expect(
      await store.client.defectHistoryEvent.count({ where: { defectId: d.id } }),
    ).toBe(1);
    expect(
      await store.client.auditEvent.count({ where: { entityId: d.id } }),
    ).toBe(1);
    const attempts = await Promise.all(
      ['Um', 'Dois'].map((comment) =>
        call('patch', `/defects/${d.id}`).send({
          version: d.version,
          status: 'IN_PROGRESS',
          comment,
        }),
      ),
    );
    expect(attempts.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await store.client.defectHistoryEvent.count({
        where: { workspaceId: ws.id, projectId: project.id, defectId: d.id },
      }),
    ).toBe(2);
    expect(
      (await call('get', `/defects/${d.id}`).expect(200)).body.data.version,
    ).toBe(2);
    // Audit failure after the history insert must roll back that insert too.
    const failedAudit = vi
      .spyOn(store, 'transaction')
      .mockImplementation((scope, work) =>
        original(scope, async (tx) => {
          const failing = Object.create(tx) as typeof tx;
          failing.audit = async () => {
            throw new Error('Auditoria indisponível');
          };
          return work(failing);
        }),
      );
    try {
      await call('patch', `/defects/${d.id}`)
        .send({ version: 2, status: 'CLOSED', comment: 'Não deve gravar' })
        .expect(500);
    } finally {
      failedAudit.mockRestore();
    }
    expect(
      await store.client.defectHistoryEvent.count({ where: { defectId: d.id } }),
    ).toBe(2);
    expect(
      (await call('get', `/defects/${d.id}`).expect(200)).body.data,
    ).toMatchObject({ version: 2, status: 'IN_PROGRESS', resolvedAt: null });
  });
  it('counts older OPEN inventory without a creation window and excludes other current states', async () => {
    const { ws, create } = await setupDefects();
    const title = `old-stock-${randomUUID()}`;
    for (const status of [
      'OPEN',
      'IN_PROGRESS',
      'RESOLVED',
      'CLOSED',
      'REJECTED',
    ]) {
      const d = await create({ title });
      await store.client.defect.update({
        where: { id: d.id },
        data: { status, createdAt: new Date('2020-01-01T12:00:00.000Z') },
      });
    }
    const res = await http()
      .get('/api/v1/defects')
      .set('Authorization', auth(owner))
      .query({ workspaceId: ws.id, q: title, page: 1, size: 1, status: 'OPEN' })
      .expect(200);
    expect(res.body.meta.pagination.totalItems).toBe(1);
    expect(res.body.data[0].status).toBe('OPEN');
    expect(res.body.data[0].createdAt).toContain('2020-');
  });
  it('persists direct closing dates and includes closed defects in the resolution average', async () => {
    const { ws, project, call, create } = await setupDefects();
    const createdAt = new Date('2026-10-01T12:00:00.000Z');
    for (const status of ['OPEN', 'IN_PROGRESS']) {
      let d = await create();
      if (status === 'IN_PROGRESS')
        d = (
          await call('patch', `/defects/${d.id}`)
            .send({ version: d.version, status })
            .expect(200)
        ).body.data;
      await store.client.defect.update({
        where: { id: d.id },
        data: { createdAt },
      });
      const before = Date.now();
      d = (
        await call('patch', `/defects/${d.id}`)
          .send({ version: d.version, status: 'CLOSED' })
          .expect(200)
      ).body.data;
      expect(Date.parse(d.resolvedAt)).toBeGreaterThanOrEqual(before);
      const stored = await store.client.defect.findUniqueOrThrow({
        where: { id: d.id },
      });
      expect(stored.resolvedAt?.getTime()).toBe(Date.parse(d.resolvedAt));
      const again = (
        await call('patch', `/defects/${d.id}`)
          .send({ version: d.version, status: 'CLOSED' })
          .expect(200)
      ).body.data;
      expect(again.version).toBe(d.version);
      expect(again.resolvedAt).toBe(d.resolvedAt);
      await call('patch', `/defects/${d.id}`)
        .send({ version: d.version - 1, status: 'OPEN' })
        .expect(409);
      expect(
        (await call('get', `/defects/${d.id}`).expect(200)).body.data.resolvedAt,
      ).toBe(d.resolvedAt);
    }
    const read = () =>
      http()
        .get('/api/v1/defects/summary')
        .set('Authorization', auth(owner))
        .query({ workspaceId: ws.id, projectId: project.id });
    const summary = (await read().expect(200)).body.data;
    const rows = await store.client.defect.findMany({
      where: { projectId: project.id },
    });
    const expected =
      Math.round(
        (rows.reduce(
          (sum, d) =>
            sum + (d.resolvedAt!.getTime() - d.createdAt.getTime()) / 3600000,
          0,
        ) /
          rows.length) *
          100,
      ) / 100;
    expect(summary).toMatchObject({
      totalBugs: 2,
      byStatus: { CLOSED: 2 },
      resolutionTime: {
        sampleSize: 2,
        averageHours: expected,
        basis: 'CREATED_TO_RESOLVED',
      },
    });
    const d = (await call('get', `/defects/${rows[0].id}`).expect(200)).body.data;
    await call('patch', `/defects/${d.id}`)
      .send({ version: d.version, status: 'OPEN' })
      .expect(200);
    expect((await read().expect(200)).body.data.resolutionTime.sampleSize).toBe(
      1,
    );
    // Repeating a legacy CLOSED value is still a no-op, not a historical backfill.
    await store.client.defect.update({
      where: { id: rows[1].id },
      data: { resolvedAt: null },
    });
    const legacy = (await call('get', `/defects/${rows[1].id}`).expect(200)).body
      .data;
    expect(
      (
        await call('patch', `/defects/${legacy.id}`)
          .send({ version: legacy.version, status: 'CLOSED' })
          .expect(200)
      ).body.data.resolvedAt,
    ).toBeNull();
  });
  it('records resolution atomically and preserves it through edits, links, attachments and closing', async () => {
    const { ws, project, call, create, upload } = await setupDefects();
    let d = await create();
    expect(d.resolvedAt).toBeNull();
    const change = async (fields: Record<string, unknown>) => {
      d = (
        await call('patch', `/defects/${d.id}`)
          .send({ version: d.version, ...fields })
          .expect(200)
      ).body.data;
      return d;
    };
    await change({ status: 'IN_PROGRESS' });
    expect(d.resolvedAt).toBeNull();
    const before = Date.now();
    await change({ status: 'RESOLVED' });
    expect(Date.parse(d.resolvedAt)).toBeGreaterThanOrEqual(before);
    expect(d.resolvedAt).toMatch(/-03:00$/);
    const recorded = d.resolvedAt;
    await change({ title: 'Título editado', status: 'RESOLVED' });
    expect(d.resolvedAt).toBe(recorded);
    const same = await change({ status: 'RESOLVED' });
    expect(same.resolvedAt).toBe(recorded);
    d = (
      await call('post', `/defects/${d.id}/external-link`)
        .send({
          version: d.version,
          externalSystem: 'Azure',
          externalIssueId: '123',
          externalUrl: 'https://example.com/123',
        })
        .expect(200)
    ).body.data;
    expect(d.resolvedAt).toBe(recorded);
    const attachment = await upload();
    d = (
      await call('post', `/defects/${d.id}/attachments`)
        .send({ version: d.version, attachmentId: attachment.id })
        .expect(200)
    ).body.data;
    expect(d.resolvedAt).toBe(recorded);
    await change({ status: 'CLOSED' });
    expect(d.resolvedAt).toBe(recorded);
    const version = d.version;
    await change({ status: 'CLOSED' });
    expect(d.version).toBe(version);
    await call('patch', `/defects/${d.id}`)
      .send({ version: version - 1, status: 'OPEN' })
      .expect(409);
    expect(
      (await call('get', `/defects/${d.id}`).expect(200)).body.data.resolvedAt,
    ).toBe(recorded);
    const summary = () =>
      http()
        .get('/api/v1/defects/summary')
        .set('Authorization', auth(owner))
        .query({ projectId: project.id });
    expect(
      (await summary().expect(200)).body.data.resolutionTime.sampleSize,
    ).toBe(1);
    expect(
      (
        await http()
          .get('/api/v1/defects')
          .set('Authorization', auth(owner))
          .query({ projectId: project.id })
          .expect(200)
      ).body.data[0].resolvedAt,
    ).toBe(recorded);
    await change({ status: 'OPEN' });
    expect(d.resolvedAt).toBeNull();
    expect((await summary().expect(200)).body.data.resolutionTime).toEqual({
      averageHours: null,
      sampleSize: 0,
      basis: 'CREATED_TO_RESOLVED',
    });
    await change({ status: 'RESOLVED' });
    expect(Date.parse(d.resolvedAt)).toBeGreaterThan(Date.parse(recorded));
    await change({ status: 'REJECTED' });
    expect(d.resolvedAt).toBeNull();
    const beforeClose = Date.now();
    await change({ status: 'CLOSED' });
    expect(Date.parse(d.resolvedAt)).toBeGreaterThanOrEqual(beforeClose);
    await store.client.defect.update({
      where: { id: d.id },
      data: { status: 'RESOLVED', resolvedAt: null },
    });
    d = (await call('get', `/defects/${d.id}`).expect(200)).body.data;
    await change({ status: 'RESOLVED' });
    expect(d.resolvedAt).toBeNull();
    const beforeLegacyClose = Date.now();
    await change({ status: 'CLOSED' });
    expect(Date.parse(d.resolvedAt)).toBeGreaterThanOrEqual(beforeLegacyClose);
    const closedResolution = d.resolvedAt;
    await expect(
      store.transaction(ws.id, async (tx) => {
        await tx.defects.update(
          { id: d.id, projectId: project.id },
          { status: 'RESOLVED', resolvedAt: new Date() },
        );
        throw new Error('Rollback');
      }),
    ).rejects.toThrow('Rollback');
    expect(
      (await call('get', `/defects/${d.id}`).expect(200)).body.data,
    ).toMatchObject({ status: 'CLOSED', resolvedAt: closedResolution });
    await call('patch', `/defects/${d.id}`)
      .send({ version: d.version, resolvedAt: new Date().toISOString() })
      .expect(400);
  });
  it('aggregates complete authorized history with weighted durations, snapshots, archived projects and identical filters', async () => {
    const one = await setupDefects(),
      two = await setupDefects();
    const title = `summary-${randomUUID()} 100%_ falha`;
    const createdAt = new Date('2020-01-01T00:00:00.000Z');
    const rows = [
      {
        scope: one,
        status: 'OPEN',
        hours: 100,
        category: 'HOMOLOGATION',
        severity: 'CRITICAL',
      },
      {
        scope: one,
        status: 'IN_PROGRESS',
        hours: 100,
        category: 'PRODUCTION',
        severity: 'NORMAL',
      },
      {
        scope: one,
        status: 'RESOLVED',
        hours: 0,
        category: 'HOMOLOGATION',
        severity: 'CRITICAL',
      },
      {
        scope: one,
        status: 'CLOSED',
        hours: 2,
        category: 'PRODUCTION',
        severity: 'NORMAL',
      },
      {
        scope: one,
        status: 'RESOLVED',
        hours: null,
        category: 'OTHER',
        severity: 'NORMAL',
      },
      {
        scope: one,
        status: 'REJECTED',
        hours: 100,
        category: null,
        severity: 'NORMAL',
      },
      {
        scope: one,
        status: 'CLOSED',
        hours: -1,
        category: null,
        severity: 'NORMAL',
      },
      {
        scope: two,
        status: 'CLOSED',
        hours: 10,
        category: 'OTHER',
        severity: 'NORMAL',
      },
    ] as const;
    for (const [i, r] of rows.entries()) {
      const env = r.category
        ? (
            await r.scope
              .call('post', '/environments')
              .send({ name: `Env ${i}`, category: r.category })
              .expect(201)
          ).body.data
        : null;
      const d = await r.scope.create({
        title,
        severity: r.severity,
        environmentId: env?.id ?? null,
      });
      await store.client.defect.update({
        where: { id: d.id },
        data: {
          status: r.status,
          createdAt,
          resolvedAt:
            r.hours === null
              ? null
              : new Date(createdAt.getTime() + r.hours * 3600000),
        },
      });
      if (env)
        await r.scope
          .call('patch', `/environments/${env.id}`)
          .send({
            name: `Renomeado ${i}`,
            category: r.category === 'OTHER' ? 'PRODUCTION' : 'OTHER',
            active: false,
          })
          .expect(200);
    }
    // Similar text must not match a literal percent/underscore search.
    await one.create({ title: title.replace('100%_', '100XX') });
    // The same title from a foreign Workspace must never affect any dimension.
    const foreign = await workspace(otherOwner);
    const p = (
      await http()
        .post(`/api/v1/workspaces/${foreign.id}/projects`)
        .set('Authorization', auth(otherOwner))
        .send({ key: 'FOREIGN', name: 'Oculto' })
        .expect(201)
    ).body.data;
    await http()
      .post(`/api/v1/workspaces/${foreign.id}/projects/${p.id}/defects`)
      .set('Authorization', auth(otherOwner))
      .send({ title })
      .expect(201);
    await two.call('post', '/archive').send({}).expect(200);
    const result = await http()
      .get('/api/v1/defects/summary')
      .set('Authorization', auth(owner))
      .query({ q: title })
      .expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body.meta.requestId).toBe(result.headers['x-request-id']);
    expect(result.body.message).toBe('Indicadores consultados com sucesso.');
    expect(result.body.data.generatedAt).toMatch(/-03:00$/);
    expect(result.body.meta.pagination).toBeUndefined();
    expect(result.body.data).toMatchObject({
      totalBugs: 8,
      byStatus: { OPEN: 1, IN_PROGRESS: 1, RESOLVED: 2, CLOSED: 3, REJECTED: 1 },
      byCategory: { HOMOLOGATION: 2, PRODUCTION: 2, OTHER: 2, UNSPECIFIED: 2 },
      resolutionTime: {
        averageHours: 4,
        sampleSize: 3,
        basis: 'CREATED_TO_RESOLVED',
      },
    });
    for (const status of [
      'ALL',
      'OPEN',
      'IN_PROGRESS',
      'RESOLVED',
      'CLOSED',
      'REJECTED',
    ]) {
      for (const severity of [undefined, 'CRITICAL', 'NORMAL']) {
        const query = {
          q: `  ${title}  `,
          status,
          ...(severity ? { severity } : {}),
        };
        const summary = (
          await http()
            .get('/api/v1/defects/summary')
            .set('Authorization', auth(owner))
            .query(query)
            .expect(200)
        ).body.data;
        const list = (
          await http()
            .get('/api/v1/defects')
            .set('Authorization', auth(owner))
            .query({ ...query, size: 1, page: 1, sort: 'title,asc' })
            .expect(200)
        ).body;
        expect(summary.totalBugs).toBe(list.meta.pagination.totalItems);
        expect(
          Object.values(summary.byStatus).reduce(
            (a: number, b) => a + Number(b),
            0,
          ),
        ).toBe(summary.totalBugs);
        expect(
          Object.values(summary.byCategory).reduce(
            (a: number, b) => a + Number(b),
            0,
          ),
        ).toBe(summary.totalBugs);
      }
    }
    const second = (
      await http()
        .get('/api/v1/defects/summary')
        .set('Authorization', auth(owner))
        .query({ workspaceId: two.ws.id, projectId: two.project.id })
        .expect(200)
    ).body.data;
    expect(second.totalBugs).toBe(1);
    expect(second.resolutionTime).toMatchObject({
      averageHours: 10,
      sampleSize: 1,
    });
    const zero = (
      await http()
        .get('/api/v1/defects/summary')
        .set('Authorization', auth(owner))
        .query({ q: title, status: 'RESOLVED', severity: 'CRITICAL' })
        .expect(200)
    ).body.data;
    expect(zero.resolutionTime).toMatchObject({ averageHours: 0, sampleSize: 1 });
    await http()
      .get('/api/v1/defects/summary')
      .set('Authorization', auth(owner))
      .query({ workspaceId: one.ws.id, projectId: two.project.id })
      .expect(404);
  });
  it('returns confirmed empty counts and excludes legacy, negative and untrusted durations', async () => {
    const { ws, project, create } = await setupDefects();
    const read = (query = {}) =>
      http()
        .get('/api/v1/defects/summary')
        .set('Authorization', auth(owner))
        .query({ workspaceId: ws.id, projectId: project.id, ...query });
    const empty = (await read().expect(200)).body.data;
    expect(empty).toMatchObject({
      totalBugs: 0,
      byStatus: { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0, REJECTED: 0 },
      byCategory: { HOMOLOGATION: 0, PRODUCTION: 0, OTHER: 0, UNSPECIFIED: 0 },
      resolutionTime: {
        averageHours: null,
        sampleSize: 0,
        basis: 'CREATED_TO_RESOLVED',
      },
    });
    expect(
      (
        await store.client.defect.findUniqueOrThrow({
          where: { id: upgradeDefect },
        })
      ).resolvedAt,
    ).toBeNull();
    const first = await create();
    const createdAt = new Date('2026-10-01T12:00:00.000Z');
    await store.client.defect.update({
      where: { id: first.id },
      data: {
        createdAt,
        status: 'RESOLVED',
        resolvedAt: new Date(createdAt.getTime() + 4500000),
      },
    });
    expect((await read().expect(200)).body.data.resolutionTime).toMatchObject({
      averageHours: 1.25,
      sampleSize: 1,
    });
    await store.client.defect.update({
      where: { id: first.id },
      data: { resolvedAt: new Date(createdAt.getTime() - 1) },
    });
    expect((await read().expect(200)).body.data.resolutionTime).toMatchObject({
      averageHours: null,
      sampleSize: 0,
    });
    await store.client.defect.update({
      where: { id: first.id },
      data: { resolvedAt: null },
    });
    expect((await read().expect(200)).body.data.resolutionTime).toMatchObject({
      averageHours: null,
      sampleSize: 0,
    });
  });
  it('rechecks membership, project visibility and effective defect.read before every aggregate', async () => {
    const one = await setupDefects(),
      two = await setupDefects();
    const title = `permission-summary-${randomUUID()}`;
    await one.create({ title });
    await two.create({ title });
    const wm = await join(one.ws.id);
    const read = (query = {}, account = member) =>
      http()
        .get('/api/v1/defects/summary')
        .set('Authorization', auth(account))
        .query({ q: title, ...query });
    expect((await read().expect(200)).body.data.totalBugs).toBe(0);
    await read({ projectId: one.project.id }).expect(404);
    await one
      .call('put', `/members/${wm.id}`)
      .send({ projectRole: 'VIEWER' })
      .expect(200);
    expect((await read().expect(200)).body.data.totalBugs).toBe(1);
    await read({ workspaceId: two.ws.id }).expect(404);
    const defaultRole = await store.client.role.findFirstOrThrow({
      where: {
        workspaceId: one.ws.id,
        normalizedName: 'member',
        systemRole: true,
      },
    });
    await http()
      .delete(
        `/api/v1/workspaces/${one.ws.id}/members/${wm.id}/roles/${defaultRole.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    const role = (
      await http()
        .post(`/api/v1/workspaces/${one.ws.id}/roles`)
        .set('Authorization', auth(owner))
        .send({ name: 'Leitura de bugs', permissionCodes: ['defect.read'] })
        .expect(201)
    ).body.data;
    await http()
      .put(`/api/v1/workspaces/${one.ws.id}/members/${wm.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    expect(
      (await read({ workspaceId: one.ws.id }).expect(200)).body.data.totalBugs,
    ).toBe(1);
    await http()
      .patch(`/api/v1/workspaces/${one.ws.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({ permissionCodes: [] })
      .expect(200);
    expect((await read().expect(200)).body.data.totalBugs).toBe(0);
    await read({ workspaceId: one.ws.id }).expect(404);
    await http()
      .get('/api/v1/defects')
      .set('Authorization', auth(member))
      .query({ workspaceId: one.ws.id })
      .expect(404);
    await read({ projectId: one.project.id }).expect(404);
    await one.call('delete', `/members/${wm.id}`).send({}).expect(204);
    await http()
      .patch(`/api/v1/workspaces/${one.ws.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({ permissionCodes: ['defect.read'] })
      .expect(200);
    await read({ projectId: one.project.id }).expect(404);
    await http()
      .delete(`/api/v1/workspaces/${one.ws.id}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await read({ workspaceId: one.ws.id }).expect(404);
    expect((await read().expect(200)).body.data.totalBugs).toBe(0);
  });
  it('does not return partial indicators when the aggregate source fails', async () => {
    const { ws, create } = await setupDefects();
    await create();
    const { PrismaDefectSummaryQueries } =
      await import('../dist/modules/defect/infrastructure/prisma-summary-queries.js');
    const spy = vi
      .spyOn(PrismaDefectSummaryQueries.prototype, 'aggregate')
      .mockRejectedValue({ code: 'P1001' });
    const read = () =>
      http()
        .get('/api/v1/defects/summary')
        .set('Authorization', auth(owner))
        .query({ workspaceId: ws.id });
    try {
      const res = await read().expect(503);
      expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
      expect(res.body.data).toBeUndefined();
      expect(res.headers['cache-control']).toBe('no-store');
    } finally {
      spy.mockRestore();
    }
    expect((await read().expect(200)).body.data.totalBugs).toBe(1);
    await store.client.workspace.update({
      where: { id: ws.id },
      data: { status: 'ARCHIVED' },
    });
    await read().expect(404);
    await http()
      .get('/api/v1/defects/summary')
      .set('Authorization', auth(owner))
      .query({
        projectId: (
          await store.client.project.findFirstOrThrow({
            where: { workspaceId: ws.id },
          })
        ).id,
      })
      .expect(404);
  });
  it('validates the summary query without accepting pagination, ordering or analytics date filters', async () => {
    await http().get('/api/v1/defects/summary').expect(401);
    for (const query of [
      { workspaceId: 'bad' },
      { projectId: 'bad' },
      { status: 'BAD' },
      { severity: 'BAD' },
      { q: '' },
      { q: '  ' },
      { q: 'x'.repeat(101) },
      { status: ['OPEN', 'CLOSED'] },
      { page: 1 },
      { size: 1 },
      { sort: 'title,asc' },
      { from: '2020-01-01' },
      { to: '2026-10-08' },
      { category: 'OTHER' },
      { environmentId: randomUUID() },
    ]) {
      const error = await http()
        .get('/api/v1/defects/summary')
        .set('Authorization', auth(owner))
        .query(query)
        .expect(400);
      expect(error.body.code).toBe('VALIDATION_ERROR');
    }
    await http()
      .get('/api/v1/defects/summary')
      .set('Authorization', auth(owner))
      .query({ workspaceId: randomUUID() })
      .expect(404);
    await http()
      .get('/api/v1/defects/summary')
      .set('Authorization', auth(owner))
      .query({ projectId: randomUUID() })
      .expect(404);
  });
  it('preserves Phase 04 data, snapshots, results and comments across migration', async () => {
    expect(PERMISSIONS).toHaveLength(35);
    expect(
      (
        await store.client.testPlan.findUniqueOrThrow({
          where: { id: upgradePlan },
        })
      ).status,
    ).toBe('ACTIVE');
    expect(
      (
        await store.client.testRun.findUniqueOrThrow({
          where: { id: upgradeRun },
        })
      ).version,
    ).toBe(3);
    const c = await store.client.testRunCase.findUniqueOrThrow({
      where: { id: upgradeRunCase },
    });
    expect(c).toMatchObject({
      result: 'FAILED',
      titleSnapshot: 'Snapshot anterior',
      comment: 'Falha anterior',
    });
    expect(c.definitionSnapshot).toMatchObject({
      description: 'Histórico',
      version: 1,
    });
    expect(
      (
        await store.client.testRunStep.findUniqueOrThrow({
          where: { id: upgradeRunStep },
        })
      ).actualResult,
    ).toBe('Falhou');
    expect(
      (
        await store.client.executionComment.findUniqueOrThrow({
          where: { id: upgradeComment },
        })
      ).text,
    ).toBe('Comentário anterior');
    expect(
      await store.client.defect.count({ where: { id: upgradeDefect } }),
    ).toBe(1);
  });
  it('creates defaults and filters all states before pagination and counting', async () => {
    const { call, create, base } = await setupDefects();
    const res = await call('post', '/defects')
      .send({
        title: '  Login falhou  ',
        description: null,
        attachmentIds: [],
        testRunCaseId: null,
      })
      .expect(201);
    const a = res.body.data;
    expect(res.headers.location).toBe(`${base}/defects/${a.id}`);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(a).toMatchObject({
      title: 'Login falhou',
      description: null,
      status: 'OPEN',
      severity: 'NORMAL',
      version: 1,
      sequence: 1,
      humanId: 'BUG-DEF-1',
      testRunCaseId: null,
      testRunId: null,
      externalSystem: null,
      externalIssueId: null,
      externalUrl: null,
      attachmentIds: [],
      createdBy: owner.id,
    });
    const b = await create({ title: 'Login secundário', severity: 'CRITICAL' });
    await call('patch', `/defects/${b.id}`)
      .send({ version: 1, status: 'CLOSED' })
      .expect(200);
    await create({ title: 'Pagamento', severity: 'MINOR' });
    const page = await call('get', '/defects')
      .query({ q: 'Login', size: 1, sort: 'sequence,desc' })
      .expect(200);
    expect(page.body.data[0].id).toBe(b.id);
    expect(page.body.meta.pagination).toMatchObject({
      totalItems: 2,
      totalPages: 2,
      hasNext: true,
    });
    expect(
      (
        await call('get', '/defects')
          .query({ status: 'CLOSED', severity: 'CRITICAL', q: 'Login' })
          .expect(200)
      ).body.data.map((d: { id: string }) => d.id),
    ).toEqual([b.id]);
    const empty = await call('get', '/defects')
      .query({ status: 'RESOLVED' })
      .expect(200);
    expect(empty.body.data).toEqual([]);
    expect(empty.body.meta.pagination.totalItems).toBe(0);
    expect(JSON.stringify(a)).not.toContain('storageKey');
  });
  it('allocates independent sequences concurrently, rolls back reservations and rejects exhaustion', async () => {
    const { call, create, project, ws } = await setupDefects();
    const values = await Promise.all(
      Array.from({ length: 6 }, (_, i) => create({ title: `Defeito ${i}` })),
    );
    expect(values.map((v) => v.sequence).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    await expect(
      store.transaction(ws.id, async (tx) => {
        await tx.reserveDefectSequence(project.id);
        throw new Error('Rollback');
      }),
    ).rejects.toThrow('Rollback');
    expect((await create()).sequence).toBe(7);
    const c = (
      await call('post', '/test-cases')
        .send({ title: 'Contador separado' })
        .expect(201)
    ).body.data;
    expect(c.sequence).toBe(1);
    const another = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/projects`)
        .set('Authorization', auth(owner))
        .send({ key: 'BUG2', name: 'Outro' })
        .expect(201)
    ).body.data;
    expect(
      (
        await http()
          .post(`/api/v1/workspaces/${ws.id}/projects/${another.id}/defects`)
          .set('Authorization', auth(owner))
          .send({ title: 'Primeiro' })
          .expect(201)
      ).body.data.sequence,
    ).toBe(1);
    await store.client.sequenceCounter.updateMany({
      where: {
        workspaceId: ws.id,
        projectId: project.id,
        entityType: 'DEFECT',
      },
      data: { nextValue: 2147483647 },
    });
    expect(
      (await call('post', '/defects').send({ title: 'Limite' }).expect(409))
        .body.code,
    ).toBe('DEFECT_SEQUENCE_EXHAUSTED');
    expect(
      await store.client.defect.count({
        where: { workspaceId: ws.id, projectId: project.id },
      }),
    ).toBe(7);
    await expect(
      store.client.sequenceCounter.create({
        data: {
          id: randomUUID(),
          workspaceId: ws.id,
          projectId: project.id,
          entityType: 'UNKNOWN',
          nextValue: 1,
        },
      }),
    ).rejects.toThrow();
  });
  it('creates from failed copies and preserves executions, even after result changes or source archival', async () => {
    const { call, failure } = await setupDefects();
    const { c, r, copy } = await failure();
    const beforeRun = (await call('get', `/test-runs/${r.id}`).expect(200)).body
      .data;
    const beforeCopy = (
      await call('get', `/test-runs/${r.id}/cases/${copy.id}`).expect(200)
    ).body.data;
    const d = (
      await call('post', '/defects/from-failure')
        .send({ testRunCaseId: copy.id })
        .expect(201)
    ).body.data;
    expect(d).toMatchObject({
      title: copy.titleSnapshot,
      description: 'Tela apresentou erro.',
      severity: 'MAJOR',
      status: 'OPEN',
      testRunId: r.id,
      testRunCaseId: copy.id,
    });
    const custom = (
      await call('post', '/defects/from-failure')
        .send({
          testRunCaseId: copy.id,
          title: 'Defeito específico',
          description: null,
          severity: 'CRITICAL',
        })
        .expect(201)
    ).body.data;
    expect(custom).toMatchObject({
      title: 'Defeito específico',
      description: null,
      severity: 'CRITICAL',
    });
    await call('post', '/defects')
      .send({ title: 'Vínculo manual', testRunCaseId: copy.id })
      .expect(201);
    expect(
      (await call('get', `/test-runs/${r.id}`).expect(200)).body.data,
    ).toEqual(beforeRun);
    expect(
      (await call('get', `/test-runs/${r.id}/cases/${copy.id}`).expect(200))
        .body.data,
    ).toEqual(beforeCopy);
    await call('post', `/test-cases/${c.id}/archive`)
      .send({ version: c.version })
      .expect(200);
    await call('put', `/test-runs/${r.id}/cases/${copy.id}/result`)
      .send({ version: r.version, result: 'NOT_TESTED' })
      .expect(200);
    expect(
      (await call('get', `/defects/${d.id}`).expect(200)).body.data
        .testRunCaseId,
    ).toBe(copy.id);
    expect(
      (
        await call('post', '/defects/from-failure')
          .send({ testRunCaseId: copy.id })
          .expect(409)
      ).body.code,
    ).toBe('DEFECT_FAILURE_REQUIRED');
    expect(
      (
        await call('get', '/defects')
          .query({ testRunCaseId: copy.id })
          .expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(3);
    for (const result of ['BLOCKED', 'SKIPPED', 'PASSED']) {
      const data = await failure(result);
      await call('post', '/defects/from-failure')
        .send({ testRunCaseId: data.copy.id })
        .expect(409);
    }
    const aborted = await failure();
    await call('post', `/test-runs/${aborted.r.id}/abort`)
      .send({ version: aborted.r.version })
      .expect(200);
    await call('post', '/defects/from-failure')
      .send({ testRunCaseId: aborted.copy.id })
      .expect(201);
  });
  it('audits metadata and state changes, allows reopening and makes repeated status a versioned no-op', async () => {
    const { call, create, ws } = await setupDefects();
    let d = await create();
    const requestId = randomUUID();
    d = (
      await call('patch', `/defects/${d.id}`)
        .set('X-Request-Id', requestId)
        .send({
          version: d.version,
          title: ' Novo título ',
          description: 'Diagnóstico',
          severity: 'BLOCKER',
          status: 'IN_PROGRESS',
        })
        .expect(200)
    ).body.data;
    expect(d).toMatchObject({ title: 'Novo título', version: 2, sequence: 1 });
    const event = await store.client.auditEvent.findFirstOrThrow({
      where: {
        workspaceId: ws.id,
        entityId: d.id,
        action: 'defect.status_changed',
      },
    });
    expect(event).toMatchObject({
      actorUserId: owner.id,
      correlationId: requestId,
    });
    const count = await store.client.auditEvent.count({
      where: { entityId: d.id },
    });
    const same = (
      await call('patch', `/defects/${d.id}`)
        .send({ version: 2, status: 'IN_PROGRESS' })
        .expect(200)
    ).body.data;
    expect(same).toEqual(d);
    expect(
      await store.client.auditEvent.count({ where: { entityId: d.id } }),
    ).toBe(count);
    expect(
      (
        await call('patch', `/defects/${d.id}`)
          .send({ version: 1, status: 'IN_PROGRESS' })
          .expect(409)
      ).body.code,
    ).toBe('DEFECT_VERSION_CONFLICT');
    for (const status of ['RESOLVED', 'CLOSED', 'OPEN', 'REJECTED', 'OPEN'])
      d = (
        await call('patch', `/defects/${d.id}`)
          .send({ version: d.version, status })
          .expect(200)
      ).body.data;
    d = (
      await call('patch', `/defects/${d.id}`)
        .send({ version: d.version, description: null })
        .expect(200)
    ).body.data;
    expect(d.description).toBeNull();
    await call('patch', `/defects/${d.id}`)
      .send({ version: d.version })
      .expect(400);
  });
  it('serializes competing updates with one winning version and one audit event', async () => {
    const { call, create } = await setupDefects();
    const d = await create();
    const res = await Promise.all(
      ['RESOLVED', 'REJECTED'].map((status) =>
        call('patch', `/defects/${d.id}`).send({ version: 1, status }),
      ),
    );
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(res.find((r) => r.status === 409)!.body.code).toBe(
      'DEFECT_VERSION_CONFLICT',
    );
    expect(
      (await call('get', `/defects/${d.id}`).expect(200)).body.data.version,
    ).toBe(2);
    expect(
      await store.client.auditEvent.count({
        where: { entityId: d.id, action: 'defect.status_changed' },
      }),
    ).toBe(1);
  });
  it('stores and unlinks external references with URL validation and SQL atomicity constraints', async () => {
    const { call, create } = await setupDefects();
    let d = await create();
    const body = {
      version: 1,
      externalSystem: ' Azure DevOps ',
      externalIssueId: ' 123 ',
      externalUrl: 'https://dev.azure.com/example/QA/_workitems/edit/123',
    };
    for (const externalUrl of [
      'javascript:alert(1)',
      'https://user:secret@example.com',
      '//example.com',
      'https://example.com\\evil',
      'https://example.com\n',
    ])
      await call('post', `/defects/${d.id}/external-link`)
        .send({ ...body, externalUrl })
        .expect(400);
    await call('post', `/defects/${d.id}/external-link`)
      .send({ version: 1, externalSystem: 'Jira' })
      .expect(400);
    d = (
      await call('post', `/defects/${d.id}/external-link`)
        .send(body)
        .expect(200)
    ).body.data;
    expect(d).toMatchObject({
      externalSystem: 'Azure DevOps',
      externalIssueId: '123',
      externalUrl: body.externalUrl,
      version: 2,
    });
    await call('post', `/defects/${d.id}/external-link`).send(body).expect(409);
    d = (
      await call('post', `/defects/${d.id}/external-link`)
        .send({
          version: 2,
          externalSystem: 'Jira',
          externalIssueId: 'QA-12',
          externalUrl: 'https://jira.example.com/browse/QA-12',
        })
        .expect(200)
    ).body.data;
    await expect(
      store.client.defect.update({
        where: { id: d.id },
        data: { externalIssueId: null },
      }),
    ).rejects.toThrow();
    d = (
      await call('delete', `/defects/${d.id}/external-link`)
        .send({ version: d.version })
        .expect(200)
    ).body.data;
    expect(d).toMatchObject({
      externalSystem: null,
      externalIssueId: null,
      externalUrl: null,
      version: 4,
    });
    expect(
      (
        await call('delete', `/defects/${d.id}/external-link`)
          .send({ version: 4 })
          .expect(200)
      ).body.data,
    ).toEqual(d);
  });
  it('reuses private attachments, scopes links and preserves soft-deleted history', async () => {
    const { call, create, upload, ws, project } = await setupDefects();
    const file = await upload();
    let d = await create({ attachmentIds: [file.id] });
    expect(d.attachmentIds).toEqual([file.id]);
    expect(
      (
        await call('post', `/defects/${d.id}/attachments`)
          .send({ version: 1, attachmentId: file.id })
          .expect(200)
      ).body.data.version,
    ).toBe(1);
    d = (
      await call('delete', `/defects/${d.id}/attachments/${file.id}`)
        .send({ version: d.version })
        .expect(200)
    ).body.data;
    expect(d.attachmentIds).toEqual([]);
    expect(
      (
        await call('delete', `/defects/${d.id}/attachments/${file.id}`)
          .send({ version: 2 })
          .expect(200)
      ).body.data.version,
    ).toBe(2);
    await http()
      .get(`/api/v1/workspaces/${ws.id}/attachments/${file.id}/download`)
      .set('Authorization', auth(owner))
      .expect(200);
    d = (
      await call('post', `/defects/${d.id}/attachments`)
        .send({ version: 2, attachmentId: file.id })
        .expect(200)
    ).body.data;
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/attachments/${file.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    expect(
      (await call('get', `/defects/${d.id}`).expect(200)).body.data
        .attachmentIds,
    ).toEqual([]);
    expect(
      await store.client.defectAttachment.count({
        where: { projectId: project.id, defectId: d.id },
      }),
    ).toBe(1);
    await call('post', `/defects/${d.id}/attachments`)
      .send({ version: d.version, attachmentId: file.id })
      .expect(404);
    await call('post', '/defects')
      .send({ title: 'Excluído', attachmentIds: [file.id] })
      .expect(404);
    await http()
      .get(`/api/v1/workspaces/${ws.id}/attachments/${file.id}/download`)
      .set('Authorization', auth(owner))
      .expect(404);
  });
  it('isolates defect reads, writes, searches, origins and attachment FKs across projects and tenants', async () => {
    const a = await setupDefects(),
      b = await setupDefects();
    const f = await a.failure(),
      da = await a.create(),
      db = await b.create(),
      file = await a.upload();
    await b.call('get', `/defects/${da.id}`).expect(404);
    await b
      .call('patch', `/defects/${da.id}`)
      .send({ version: 1, status: 'CLOSED' })
      .expect(404);
    await b
      .call('post', `/defects/${da.id}/external-link`)
      .send({
        version: 1,
        externalSystem: 'Jira',
        externalIssueId: '1',
        externalUrl: 'https://example.com/1',
      })
      .expect(404);
    await b
      .call('post', '/defects/from-failure')
      .send({ testRunCaseId: f.copy.id })
      .expect(404);
    await b
      .call('get', '/defects')
      .query({ testRunCaseId: f.copy.id })
      .expect(404);
    await b
      .call('post', '/defects')
      .send({ title: 'Foreign', attachmentIds: [file.id] })
      .expect(404);
    await b
      .call('post', `/defects/${db.id}/attachments`)
      .send({ version: 1, attachmentId: file.id })
      .expect(404);
    expect(
      (await b.call('get', '/defects').query({ q: 'Login' }).expect(200)).body
        .meta.pagination.totalItems,
    ).toBe(1);
    await a.call('get', `/defects/${da.id}`, otherOwner).expect(404);
    const otherProject = (
      await http()
        .post(`/api/v1/workspaces/${a.ws.id}/projects`)
        .set('Authorization', auth(owner))
        .send({ key: 'OTHER', name: 'Outro' })
        .expect(201)
    ).body.data;
    const url = `/api/v1/workspaces/${a.ws.id}/projects/${otherProject.id}/defects`;
    await http()
      .post(`${url}/from-failure`)
      .set('Authorization', auth(owner))
      .send({ testRunCaseId: f.copy.id })
      .expect(404);
    await http()
      .get(`${url}/${da.id}`)
      .set('Authorization', auth(owner))
      .expect(404);
    await expect(
      store.client.defect.update({
        where: { id: db.id },
        data: { testRunCaseId: f.copy.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      store.client.defectAttachment.create({
        data: {
          id: randomUUID(),
          workspaceId: b.ws.id,
          projectId: b.project.id,
          defectId: db.id,
          attachmentId: file.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      store.client.defectAttachment.create({
        data: {
          id: randomUUID(),
          workspaceId: a.ws.id,
          projectId: otherProject.id,
          defectId: da.id,
          attachmentId: file.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(
      (await b.call('get', `/defects/${db.id}`).expect(200)).body.data.version,
    ).toBe(1);
  });
  it('intersects current grants with local roles and preserves attachment and execution permissions', async () => {
    const { call, ws, base, create, failure, upload } = await setupDefects();
    const d = await create(),
      file = await upload(),
      f = await failure();
    const wm = await join(ws.id);
    await call('get', '/defects', member).expect(404);
    await http()
      .put(`${base}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'VIEWER' })
      .expect(200);
    await call('get', '/defects', member).expect(200);
    await call('post', '/defects', member)
      .send({ title: 'Denied' })
      .expect(403);
    const role = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/roles`)
        .set('Authorization', auth(owner))
        .send({
          name: 'Defeitos',
          permissionCodes: ['defect.read', 'defect.manage', 'project.read'],
        })
        .expect(201)
    ).body.data;
    await http()
      .put(`/api/v1/workspaces/${ws.id}/members/${wm.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await call('post', '/defects', member)
      .send({ title: 'Viewer denied' })
      .expect(403);
    await http()
      .put(`${base}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'EDITOR' })
      .expect(200);
    await call('post', '/defects', member)
      .send({ title: 'Editor allowed' })
      .expect(201);
    const memberRole = await store.client.role.findFirstOrThrow({
      where: { workspaceId: ws.id, normalizedName: 'member', systemRole: true },
    });
    await http()
      .delete(
        `/api/v1/workspaces/${ws.id}/members/${wm.id}/roles/${memberRole.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await call('post', '/defects/from-failure', member)
      .send({ testRunCaseId: f.copy.id })
      .expect(403);
    await call('get', '/defects', member)
      .query({ testRunCaseId: f.copy.id })
      .expect(403);
    await call('post', `/defects/${d.id}/attachments`, member)
      .send({ version: 1, attachmentId: file.id })
      .expect(403);
    await call('post', '/defects', member)
      .send({ title: 'No file grant', attachmentIds: [file.id] })
      .expect(403);
    await http()
      .get(`/api/v1/workspaces/${ws.id}/attachments/${file.id}/download`)
      .set('Authorization', auth(member))
      .expect(403);
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/members/${wm.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await call('patch', `/defects/${d.id}`, member)
      .send({ version: 1, status: 'CLOSED' })
      .expect(403);
    await call('get', '/defects', member).expect(403);
    await http()
      .delete(`${base}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await call('get', '/defects', member).expect(404);
    await call('post', '/archive').send({}).expect(200);
    await call('get', `/defects/${d.id}`).expect(200);
    expect(
      (
        await call('patch', `/defects/${d.id}`)
          .send({ version: 1, status: 'CLOSED' })
          .expect(409)
      ).body.code,
    ).toBe('PROJECT_ARCHIVED');
  });
  it('rejects unexpected fields, invalid nullable values, invalid queries and unauthenticated access', async () => {
    const { call, create, base } = await setupDefects();
    for (const body of [
      {},
      { title: ' ' },
      { title: null },
      { title: 'A', severity: null },
      { title: 'A', status: 'CLOSED' },
      { title: 'A', sequence: 1 },
      { title: 'A', externalUrl: 'https://example.com' },
      { title: 'A', attachmentIds: null },
      {
        title: 'A',
        attachmentIds: [
          randomUUID(),
          randomUUID(),
          ...Array.from({ length: 99 }, () => randomUUID()),
        ],
      },
      { title: 'A', testRunCaseId: 'bad' },
    ])
      await call('post', '/defects').send(body).expect(400);
    const d = await create();
    for (const body of [
      { version: null, status: 'CLOSED' },
      { version: 1, status: 'ARCHIVED' },
      { version: 1, title: null },
      { version: 1, testRunCaseId: randomUUID() },
      { version: 1, attachmentIds: [] },
    ])
      await call('patch', `/defects/${d.id}`).send(body).expect(400);
    await call('post', '/defects/from-failure')
      .send({ testRunCaseId: null })
      .expect(400);
    await call('get', '/defects')
      .query({ sort: 'testRunCaseId,asc' })
      .expect(400);
    await call('get', '/defects').query({ status: 'ARCHIVED' }).expect(400);
    await call('get', `/defects/${d.id}`).query({ unknown: true }).expect(400);
    await call('patch', `/defects/${d.id}?unknown=true`)
      .send({ version: 1, status: 'CLOSED' })
      .expect(400);
    await call('post', '/defects')
      .send({ title: 'A', description: 'x'.repeat(33000) })
      .expect(413);
    await http().get(`${base}/defects`).expect(401);
    await http()
      .get(`${base}/defects`)
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });
});

describe('Governance with real MySQL/MariaDB, immutable assessments and authorized goal calculations', () => {
  afterEach(() => {
    overviewTime = undefined;
  });
  async function setupGovernance() {
    const ws = await workspace();
    const base = `/api/v1/workspaces/${ws.id}/governance`;
    const call = (
      method: 'get' | 'post' | 'patch' | 'put' | 'delete',
      path: string,
      account = owner,
    ) => http()[method](`${base}${path}`).set('Authorization', auth(account));
    let framework = (
      await call('post', '/frameworks')
        .send({ code: 'QA', name: 'Política interna', versionLabel: '1.0' })
        .expect(201)
    ).body.data;
    const section = (
      await call('post', `/frameworks/${framework.id}/sections`)
        .send({
          version: framework.version,
          code: 'POL',
          name: 'Política',
          position: 1,
        })
        .expect(201)
    ).body.data;
    framework.version = section.frameworkVersion;
    const c = (
      await call('post', `/frameworks/${framework.id}/controls`)
        .send({
          version: framework.version,
          sectionId: section.section.id,
          code: 'POL-1',
          title: 'Política aprovada',
          weight: 3,
        })
        .expect(201)
    ).body.data;
    framework.version = c.frameworkVersion;
    framework = (
      await call('patch', `/frameworks/${framework.id}`)
        .send({ version: framework.version, status: 'ACTIVE' })
        .expect(200)
    ).body.data;
    const createAssessment = async () =>
      (
        await call('post', '/assessments')
          .send({
            frameworkId: framework.id,
            name: 'Avaliação interna',
            assessmentDate: '2026-10-03',
          })
          .expect(201)
      ).body.data;
    return {
      ws,
      base,
      call,
      framework,
      section: section.section,
      control: c.control,
      createAssessment,
    };
  }

  it('preserves Phase 05 rows and upgrades only system role governance grants', async () => {
    expect(
      await store.client.defect.findUniqueOrThrow({
        where: { id: upgradeDefect },
      }),
    ).toMatchObject({
      version: 2,
      title: 'Defeito anterior',
      severity: 'CRITICAL',
      testRunCaseId: upgradeRunCase,
      externalIssueId: 'QA-1',
    });
    expect(
      await store.client.defectAttachment.findMany({
        where: { defectId: upgradeDefect },
      }),
    ).toHaveLength(1);
    expect(
      await store.client.attachment.findUniqueOrThrow({
        where: { id: upgradeAttachment },
      }),
    ).toMatchObject({ originalName: 'anterior.txt' });
    expect(await store.client.governanceFramework.count()).toBe(0);
    expect(
      await store.client.governanceGoal.findUniqueOrThrow({
        where: { id: upgradeGoal },
      }),
    ).toMatchObject({
      sectionId: null,
      ownerMemberId: null,
      version: 2,
      targetValue: 80,
    });
  });
  it('rejects cycles, stale aggregate versions, cross-framework parents and invalid transitions atomically', async () => {
    const { call, framework, section, control } = await setupGovernance();
    const child = (
      await call('post', `/frameworks/${framework.id}/sections`)
        .send({
          version: framework.version,
          code: 'CHILD',
          name: 'Filha',
          position: 2,
          parentSectionId: section.id,
        })
        .expect(201)
    ).body.data;
    const root = child.frameworkVersion;
    const cycle = await call(
      'patch',
      `/frameworks/${framework.id}/sections/${section.id}`,
    )
      .send({ version: root, parentSectionId: child.section.id })
      .expect(409);
    expect(cycle.body.code).toBe('GOVERNANCE_SECTION_CYCLE');
    await call('patch', `/frameworks/${framework.id}/sections/${section.id}`)
      .send({ version: root - 1, name: 'Alteração obsoleta' })
      .expect(409);
    await call('patch', `/frameworks/${framework.id}/sections/${section.id}`)
      .send({ version: root, parentSectionId: randomUUID() })
      .expect(404);
    expect(
      (await call('get', `/frameworks/${framework.id}`).expect(200)).body.data
        .version,
    ).toBe(root);
    await call('patch', `/frameworks/${framework.id}/controls/${control.id}`)
      .send({ version: root, active: false })
      .expect(409);
    await call('patch', `/frameworks/${framework.id}`)
      .send({ version: root, status: 'DRAFT' })
      .expect(409);
    const outcomes = await Promise.all(
      ['A', 'B'].map((name) =>
        call('patch', `/frameworks/${framework.id}`).send({
          version: root,
          name,
        }),
      ),
    );
    expect(outcomes.map((r) => r.status).sort()).toEqual([200, 409]);
    const updated = (
      await call('get', `/frameworks/${framework.id}`).expect(200)
    ).body.data;
    await call('patch', `/frameworks/${framework.id}`)
      .send({ version: updated.version, status: 'ARCHIVED' })
      .expect(200);
    await call('post', `/frameworks/${framework.id}/sections`)
      .send({
        version: updated.version + 1,
        code: 'OTHER',
        name: 'Outro',
        position: 1,
      })
      .expect(409);
  });
  it('copies definitions before evaluation and preserves independent closed historical assessments', async () => {
    const { call, ws, framework, section, control, createAssessment } =
      await setupGovernance();
    let assessment = await createAssessment();
    await call('put', `/assessments/${assessment.id}/controls/${control.id}`)
      .send({ version: 1, status: 'MET' })
      .expect(409);
    const next = (
      await call('patch', `/frameworks/${framework.id}/sections/${section.id}`)
        .send({ version: framework.version, name: 'Renomeada' })
        .expect(200)
    ).body.data;
    await call('patch', `/frameworks/${framework.id}/controls/${control.id}`)
      .send({ version: next.frameworkVersion, title: 'Título novo', weight: 1 })
      .expect(200);
    const copy = (
      await call('get', `/assessments/${assessment.id}/controls`).expect(200)
    ).body.data[0];
    expect(copy.controlSnapshot).toMatchObject({
      title: 'Política aprovada',
      weight: 3,
      sectionPath: [{ name: 'Política' }],
    });
    assessment = (
      await call('post', `/assessments/${assessment.id}/start`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    await call('post', `/assessments/${assessment.id}/close`)
      .send({ version: assessment.version })
      .expect(409);
    await call('put', `/assessments/${assessment.id}/controls/${control.id}`)
      .send({
        version: assessment.version,
        status: 'NOT_APPLICABLE',
        justification: '  ',
      })
      .expect(400);
    assessment = (
      await call('put', `/assessments/${assessment.id}/controls/${control.id}`)
        .send({
          version: assessment.version,
          status: 'PARTIALLY_MET',
          justification: 'Em andamento',
        })
        .expect(200)
    ).body.data;
    expect(assessment.index.value).toBe(50);
    const closed = (
      await call('post', `/assessments/${assessment.id}/close`)
        .send({ version: assessment.version })
        .expect(200)
    ).body.data;
    await call('put', `/assessments/${assessment.id}/controls/${control.id}`)
      .send({ version: closed.version, status: 'MET' })
      .expect(409);
    await call(
      'post',
      `/assessments/${assessment.id}/controls/${control.id}/evidence`,
    )
      .send({
        version: closed.version,
        evidenceType: 'URL',
        url: 'https://example.com',
        title: 'Doc',
      })
      .expect(409);
    await call('post', `/assessments/${assessment.id}/close`)
      .send({ version: closed.version })
      .expect(409);
    const scoreGoal = (
      await call('post', '/goals')
        .send({
          name: 'Índice fechado',
          goalType: 'GOVERNANCE_SCORE',
          frameworkId: framework.id,
          operator: 'GTE',
          targetValue: 50,
        })
        .expect(201)
    ).body.data;
    const score = (
      await call('post', `/goals/${scoreGoal.id}/calculate`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    expect(score.lastResult).toMatchObject({
      value: 50,
      numerator: 150,
      denominator: 3,
      sourceIds: [closed.id],
    });
    expect(score.status).toBe('ACTIVE');
    let other = await createAssessment();
    other = (
      await call('post', `/assessments/${other.id}/start`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    other = (
      await call('put', `/assessments/${other.id}/controls/${control.id}`)
        .send({
          version: other.version,
          status: 'NOT_APPLICABLE',
          justification: 'Fora do escopo',
        })
        .expect(200)
    ).body.data;
    other = (
      await call('post', `/assessments/${other.id}/close`)
        .send({ version: other.version })
        .expect(200)
    ).body.data;
    expect(other.index.value).toBeNull();
    const assessmentsPage = await call('get', '/assessments')
      .query({
        frameworkId: framework.id,
        status: 'CLOSED',
        size: 1,
        sort: 'closedAt,desc',
      })
      .expect(200);
    expect(assessmentsPage.body.data).toHaveLength(1);
    expect(assessmentsPage.body.meta.pagination.totalItems).toBe(2);
    expect(assessmentsPage.body.data[0].id).toBe(other.id);

    expect(
      (await call('get', `/assessments/${closed.id}`).expect(200)).body.data,
    ).toEqual(closed);
    const goal = (
      await call('post', '/goals')
        .send({
          name: 'Índice interno',
          goalType: 'GOVERNANCE_SCORE',
          frameworkId: framework.id,
          operator: 'GTE',
          targetValue: 80,
        })
        .expect(201)
    ).body.data;
    const calculated = (
      await call('post', `/goals/${goal.id}/calculate`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    expect(calculated.lastResult).toMatchObject({
      value: null,
      sourceIds: [other.id],
    });
    expect(
      await store.client.auditEvent.count({
        where: {
          workspaceId: ws.id,
          entityId: closed.id,
          action: 'governance.assessment.closed',
        },
      }),
    ).toBe(1);
  });
  it('uses private attachments, keeps evidence snapshots after deletion and enforces access and tenant scoping', async () => {
    const { call, ws, control, createAssessment } = await setupGovernance();
    let assessment = await createAssessment();
    assessment = (
      await call('post', `/assessments/${assessment.id}/start`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    const attachment = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/attachments`)
        .set('Authorization', auth(owner))
        .attach('file', Buffer.from('Prova'), 'proof.txt')
        .expect(201)
    ).body.data;
    const evidencePath = `/assessments/${assessment.id}/controls/${control.id}/evidence`;
    await call('post', evidencePath)
      .send({
        version: assessment.version,
        evidenceType: 'URL',
        url: 'https://user:secret@example.com',
        title: 'Credenciais',
      })
      .expect(400);
    await call('post', evidencePath)
      .send({
        version: assessment.version,
        evidenceType: 'ATTACHMENT',
        referenceId: attachment.id,
        url: 'https://example.com',
        title: 'Inválida',
      })
      .expect(400);
    assessment = (
      await call('post', evidencePath)
        .send({
          version: assessment.version,
          evidenceType: 'ATTACHMENT',
          referenceId: attachment.id,
          title: 'Aprovação',
          validUntil: '2026-01-01',
        })
        .expect(200)
    ).body.data;
    let evidence = (await call('get', evidencePath).expect(200)).body.data[0];
    expect(evidence).toMatchObject({
      attachmentAvailable: true,
      attachmentSnapshot: { originalName: 'proof.txt', sizeBytes: 5 },
    });
    expect(JSON.stringify(evidence)).not.toContain('storageKey');
    await http()
      .delete(`/api/v1/workspaces/${ws.id}/attachments/${attachment.id}`)
      .set('Authorization', auth(owner))
      .expect(204);
    evidence = (await call('get', evidencePath).expect(200)).body.data[0];
    expect(evidence.attachmentAvailable).toBe(false);
    expect(evidence.attachmentSnapshot.originalName).toBe('proof.txt');
    await call('post', evidencePath)
      .send({
        version: assessment.version,
        evidenceType: 'ATTACHMENT',
        referenceId: attachment.id,
        title: 'Removida',
      })
      .expect(404);
    assessment = (
      await call('put', `/assessments/${assessment.id}/controls/${control.id}`)
        .send({ version: assessment.version, status: 'MET' })
        .expect(200)
    ).body.data;
    assessment = (
      await call('post', `/assessments/${assessment.id}/close`)
        .send({ version: assessment.version })
        .expect(200)
    ).body.data;
    expect(
      (await call('get', '/dashboard').expect(200)).body.data.attention
        .expiredEvidence,
    ).toBe(1);
    await call('delete', `${evidencePath}/${evidence.id}`)
      .send({ version: assessment.version })
      .expect(409);
    const otherWs = await workspace(otherOwner);
    await http()
      .get(
        `/api/v1/workspaces/${otherWs.id}/governance/assessments/${assessment.id}`,
      )
      .set('Authorization', auth(otherOwner))
      .expect(404);
    await join(ws.id);
    await call('get', `/assessments/${assessment.id}`, member).expect(200);
    await call('post', '/frameworks', member)
      .send({ code: 'NO', name: 'Negado', versionLabel: '1' })
      .expect(403);
    const memberRole = await store.client.role.findFirstOrThrow({
      where: { workspaceId: ws.id, normalizedName: 'member' },
    });
    await store.client.rolePermission.deleteMany({
      where: {
        workspaceId: ws.id,
        roleId: memberRole.id,
        permissionCode: 'attachment.read',
      },
    });
    await call('get', evidencePath, member).expect(403);
    await store.client.rolePermission.deleteMany({
      where: {
        workspaceId: ws.id,
        roleId: memberRole.id,
        permissionCode: 'governance.read',
      },
    });
    await call('get', '/frameworks', member).expect(403);
  });
  it('removes editable evidence with a scoped ID and rolls back invalid links', async () => {
    const { call, control, createAssessment } = await setupGovernance();
    let a = await createAssessment();
    a = (
      await call('post', `/assessments/${a.id}/start`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    const path = `/assessments/${a.id}/controls/${control.id}/evidence`;
    a = (
      await call('post', path)
        .send({
          version: a.version,
          evidenceType: 'URL',
          url: 'https://example.com/policy',
          title: 'Wiki',
        })
        .expect(200)
    ).body.data;
    const evidence = (await call('get', path).expect(200)).body.data[0];
    await call('delete', `${path}/${randomUUID()}`)
      .send({ version: a.version })
      .expect(404);
    a = (
      await call('delete', `${path}/${evidence.id}`)
        .send({ version: a.version })
        .expect(200)
    ).body.data;
    expect(
      (await call('get', path).expect(200)).body.meta.pagination.totalItems,
    ).toBe(0);
    expect(a.version).toBe(4);
  });
  it('calculates supported metrics from actual source modules and handles empty and expired goals', async () => {
    const { ws, call } = await setupGovernance();
    const project = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/projects`)
        .set('Authorization', auth(owner))
        .send({ key: 'GOV', name: 'Métricas' })
        .expect(201)
    ).body.data;
    const base = `/api/v1/workspaces/${ws.id}/projects/${project.id}`;
    const source = (method: 'post' | 'patch', path: string) =>
      http()[method](`${base}${path}`).set('Authorization', auth(owner));
    const goal = (
      await call('post', '/goals')
        .send({
          projectId: project.id,
          name: 'Automação',
          goalType: 'AUTOMATION_COVERAGE',
          operator: 'GTE',
          targetValue: 80,
          deadline: '2020-01-01',
        })
        .expect(201)
    ).body.data;
    let calc = (
      await call('post', `/goals/${goal.id}/calculate`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    expect(calc.lastResult.value).toBeNull();
    expect(calc.status).toBe('MISSED');
    await source('post', '/test-cases')
      .send({
        title: 'Automatizado',
        status: 'ACTIVE',
        automationStatus: 'AUTOMATED',
      })
      .expect(201);
    await source('post', '/test-cases')
      .send({ title: 'Manual', status: 'ACTIVE' })
      .expect(201);
    await source('post', '/test-cases')
      .send({
        title: 'Rascunho automatizado',
        status: 'DRAFT',
        automationStatus: 'AUTOMATED',
      })
      .expect(201);
    calc = (
      await call('post', `/goals/${goal.id}/calculate`)
        .send({ version: calc.version })
        .expect(200)
    ).body.data;
    expect(calc.lastResult).toMatchObject({
      value: 50,
      numerator: 1,
      denominator: 2,
      sourceIds: [project.id],
    });
    const adjusted = (
      await call('patch', `/goals/${goal.id}`)
        .send({ version: calc.version, targetValue: 50, deadline: null })
        .expect(200)
    ).body.data;
    expect(adjusted.lastResult).toBeNull();
    expect(adjusted.status).toBe('ACTIVE');
    const met = (
      await call('post', `/goals/${goal.id}/calculate`)
        .send({ version: adjusted.version })
        .expect(200)
    ).body.data;
    expect(met.status).toBe('ACTIVE');
    const defect = (
      await source('post', '/defects')
        .send({ title: 'Crítico', severity: 'CRITICAL' })
        .expect(201)
    ).body.data;
    await source('post', '/defects')
      .send({ title: 'Bloqueador fechado', severity: 'BLOCKER' })
      .expect(201)
      .then(async (r) =>
        source('patch', `/defects/${r.body.data.id}`)
          .send({ version: 1, status: 'CLOSED' })
          .expect(200),
      );
    const critical = (
      await call('post', '/goals')
        .send({
          projectId: project.id,
          name: 'Sem críticos',
          goalType: 'CRITICAL_DEFECTS',
          operator: 'EQ',
          targetValue: 0,
        })
        .expect(201)
    ).body.data;
    let c = (
      await call('post', `/goals/${critical.id}/calculate`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    expect(c.lastResult.value).toBe(1);
    await source('patch', `/defects/${defect.id}`)
      .send({ version: 1, status: 'RESOLVED' })
      .expect(200);
    c = (
      await call('post', `/goals/${critical.id}/calculate`)
        .send({ version: c.version })
        .expect(200)
    ).body.data;
    expect(c.lastResult.value).toBe(0);
    expect(c.status).toBe('ACTIVE');
    await call('patch', `/goals/${critical.id}`)
      .send({ version: c.version, status: 'CANCELLED' })
      .expect(200);
    await call('post', `/goals/${critical.id}/calculate`)
      .send({ version: c.version + 1 })
      .expect(409);
    expect(
      (await call('get', '/metrics').expect(200)).body.data.goalTypes,
    ).toEqual(['AUTOMATION_COVERAGE', 'CRITICAL_DEFECTS', 'GOVERNANCE_SCORE']);
  });
  it('filters project goals/actions before counts and requires all projects for workspace metrics', async () => {
    const { ws, call } = await setupGovernance();
    const joined = await join(ws.id);
    const project = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/projects`)
        .set('Authorization', auth(owner))
        .send({ key: 'PRIVATE', name: 'Restrito' })
        .expect(201)
    ).body.data;
    const projectGoal = (
      await call('post', '/goals')
        .send({
          name: 'Meta privada',
          projectId: project.id,
          goalType: 'CRITICAL_DEFECTS',
          operator: 'EQ',
          targetValue: 0,
        })
        .expect(201)
    ).body.data;
    const action = (
      await call('post', '/actions')
        .send({ title: 'Ação privada', goalId: projectGoal.id })
        .expect(201)
    ).body.data;
    await call('get', `/goals/${projectGoal.id}`, member).expect(404);
    await call('get', `/actions/${action.id}`, member).expect(404);
    expect(
      (await call('get', '/goals', member).expect(200)).body.meta.pagination
        .totalItems,
    ).toBe(0);
    expect(
      (await call('get', '/actions', member).expect(200)).body.meta.pagination
        .totalItems,
    ).toBe(0);
    expect(
      (await call('get', '/dashboard', member).expect(200)).body.data.goals
        .active,
    ).toBe(0);
    const role = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/roles`)
        .set('Authorization', auth(owner))
        .send({
          name: 'Gestor governança',
          permissionCodes: ['governance.read', 'governance.manage'],
        })
        .expect(201)
    ).body.data;
    await http()
      .put(`/api/v1/workspaces/${ws.id}/members/${joined.id}/roles/${role.id}`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    const aggregate = (
      await call('post', '/goals')
        .send({
          name: 'Todos projetos',
          goalType: 'CRITICAL_DEFECTS',
          operator: 'EQ',
          targetValue: 0,
        })
        .expect(201)
    ).body.data;
    await call('post', `/goals/${aggregate.id}/calculate`, member)
      .send({ version: 1 })
      .expect(403);
    await http()
      .put(
        `/api/v1/workspaces/${ws.id}/projects/${project.id}/members/${joined.id}`,
      )
      .set('Authorization', auth(owner))
      .send({ projectRole: 'VIEWER' })
      .expect(200);
    await call('post', `/goals/${aggregate.id}/calculate`, member)
      .send({ version: 1 })
      .expect(200);
    const second = (
      await http()
        .post(`/api/v1/workspaces/${ws.id}/projects`)
        .set('Authorization', auth(owner))
        .send({ key: 'OTHER', name: 'Outro restrito' })
        .expect(201)
    ).body.data;
    await call('post', `/goals/${aggregate.id}/calculate`, member)
      .send({ version: 2 })
      .expect(403);
    expect(
      (await call('get', '/goals', member).expect(200)).body.data.map(
        (g: { id: string }) => g.id,
      ),
    ).not.toContain(aggregate.id);
    const total = (
      await call('post', `/goals/${aggregate.id}/calculate`)
        .send({ version: 2 })
        .expect(200)
    ).body.data;
    expect(total.lastResult.sourceIds.sort()).toEqual(
      [project.id, second.id].sort(),
    );
    const memberRole = await store.client.role.findFirstOrThrow({
      where: { workspaceId: ws.id, normalizedName: 'member' },
    });
    await store.client.rolePermission.deleteMany({
      where: { roleId: memberRole.id, permissionCode: 'defect.read' },
    });
    await call('post', `/goals/${projectGoal.id}/calculate`, member)
      .send({ version: 2 })
      .expect(403);
    await http()
      .post(`/api/v1/workspaces/${ws.id}/projects/${project.id}/archive`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(200);
    await call('get', `/goals/${projectGoal.id}`).expect(200);
    await call('post', `/goals/${projectGoal.id}/calculate`)
      .send({ version: 1 })
      .expect(409);
    await call('patch', `/actions/${action.id}`)
      .send({ version: 1, status: 'IN_PROGRESS' })
      .expect(409);
  });
  it('tracks independent action lifecycle on closed assessments and checks tenant member/link IDs', async () => {
    const { call, ws, control, createAssessment } = await setupGovernance();
    let a = await createAssessment();
    a = (
      await call('post', `/assessments/${a.id}/start`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    a = (
      await call('put', `/assessments/${a.id}/controls/${control.id}`)
        .send({ version: a.version, status: 'NOT_MET' })
        .expect(200)
    ).body.data;
    a = (
      await call('post', `/assessments/${a.id}/close`)
        .send({ version: a.version })
        .expect(200)
    ).body.data;
    const ca = (await call('get', `/assessments/${a.id}/controls`).expect(200))
      .body.data[0];
    const action = (
      await call('post', '/actions')
        .send({
          title: 'Formalizar política',
          controlAssessmentId: ca.id,
          ownerMemberId: ws.ownerMemberId,
          dueDate: '2026-12-31',
        })
        .expect(201)
    ).body.data;
    await call('post', '/actions')
      .send({ title: 'Referência inválida', goalId: randomUUID() })
      .expect(404);
    await call('patch', `/actions/${action.id}`)
      .send({ version: 1, goalId: randomUUID() })
      .expect(404);
    await call('patch', `/actions/${action.id}`)
      .send({ version: 1, ownerMemberId: randomUUID() })
      .expect(404);
    await call('patch', `/actions/${action.id}`)
      .send({ version: 1, status: 'IN_PROGRESS' })
      .expect(200);
    const completed = (
      await call('post', `/actions/${action.id}/complete`)
        .send({ version: 2 })
        .expect(200)
    ).body.data;
    expect(completed.status).toBe('DONE');
    expect(completed.completedAt).toBeTruthy();
    await call('patch', `/actions/${action.id}`)
      .send({ version: completed.version, title: 'Editar concluída' })
      .expect(409);
    expect(
      (await call('get', `/assessments/${a.id}`).expect(200)).body.data,
    ).toEqual(a);
    const cancelled = (
      await call('post', '/actions').send({ title: 'Cancelável' }).expect(201)
    ).body.data;
    await call('patch', `/actions/${cancelled.id}`)
      .send({ version: 1, status: 'CANCELLED' })
      .expect(200);
    await call('post', `/actions/${cancelled.id}/complete`)
      .send({ version: 2 })
      .expect(409);
  });
  it('links, replaces and removes goals on existing actions without changing assessments or goal results', async () => {
    const g = await setupGovernance();
    let assessment = await g.createAssessment();
    assessment = (
      await g
        .call('post', `/assessments/${assessment.id}/start`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    assessment = (
      await g
        .call('put', `/assessments/${assessment.id}/controls/${g.control.id}`)
        .send({ version: assessment.version, status: 'NOT_MET' })
        .expect(200)
    ).body.data;
    assessment = (
      await g
        .call('post', `/assessments/${assessment.id}/close`)
        .send({ version: assessment.version })
        .expect(200)
    ).body.data;
    const control = (
      await g.call('get', `/assessments/${assessment.id}/controls`).expect(200)
    ).body.data[0];
    const goal = async (name: string) =>
      (
        await g
          .call('post', '/goals')
          .send({
            name,
            frameworkId: g.framework.id,
            goalType: 'GOVERNANCE_SCORE',
            operator: 'GTE',
            targetValue: 80,
          })
          .expect(201)
      ).body.data;
    const first = await goal('Meta inicial');
    const calculated = (
      await g
        .call('post', `/goals/${first.id}/calculate`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    const second = await goal('Outra meta');
    let action = (
      await g
        .call('post', '/actions')
        .send({ title: 'Ação existente', controlAssessmentId: control.id })
        .expect(201)
    ).body.data;
    action = (
      await g
        .call('patch', `/actions/${action.id}`)
        .send({ version: action.version, goalId: first.id })
        .expect(200)
    ).body.data;
    expect(action).toMatchObject({
      goalId: first.id,
      controlAssessmentId: control.id,
      status: 'OPEN',
      version: 2,
    });
    expect(
      (
        await g.call('get', '/actions').query({ goalId: first.id }).expect(200)
      ).body.data.map((a: { id: string }) => a.id),
    ).toEqual([action.id]);
    await g
      .call('patch', `/actions/${action.id}`)
      .send({ version: 1, goalId: second.id })
      .expect(409);
    expect(
      (await g.call('get', `/actions/${action.id}`).expect(200)).body.data,
    ).toEqual(action);
    action = (
      await g
        .call('patch', `/actions/${action.id}`)
        .send({ version: action.version, status: 'IN_PROGRESS' })
        .expect(200)
    ).body.data;
    expect(action.goalId).toBe(first.id); // Omitted goalId preserves the link.
    action = (
      await g
        .call('patch', `/actions/${action.id}`)
        .send({ version: action.version, goalId: second.id })
        .expect(200)
    ).body.data;
    expect(action).toMatchObject({
      goalId: second.id,
      status: 'IN_PROGRESS',
      version: 4,
      controlAssessmentId: control.id,
    });
    expect(
      (await g.call('get', '/actions').query({ goalId: first.id }).expect(200))
        .body.meta.pagination.totalItems,
    ).toBe(0);
    expect(
      (await g.call('get', '/actions').query({ goalId: second.id }).expect(200))
        .body.meta.pagination.totalItems,
    ).toBe(1);
    action = (
      await g
        .call('patch', `/actions/${action.id}`)
        .send({ version: action.version, goalId: null })
        .expect(200)
    ).body.data;
    expect(action).toMatchObject({
      goalId: null,
      version: 5,
      controlAssessmentId: control.id,
    });
    expect(
      (await g.call('get', `/goals/${first.id}`).expect(200)).body.data,
    ).toMatchObject({ lastResult: calculated.lastResult, version: 5 });
    expect(
      (await g.call('get', `/goals/${second.id}`).expect(200)).body.data,
    ).toMatchObject({ lastResult: second.lastResult, version: 3 });
    expect(
      (await g.call('get', `/assessments/${assessment.id}`).expect(200)).body
        .data,
    ).toEqual(assessment);
    const audits = await store.client.auditEvent.count({
      where: {
        workspaceId: g.ws.id,
        entityId: action.id,
        action: 'governance.action.updated',
      },
    });
    expect(audits).toBe(4);
    const completed = (
      await g
        .call('post', `/actions/${action.id}/complete`)
        .send({ version: action.version })
        .expect(200)
    ).body.data;
    expect(
      (
        await g
          .call('patch', `/actions/${action.id}`)
          .send({ version: completed.version, goalId: first.id })
          .expect(409)
      ).body.code,
    ).toBe('GOVERNANCE_ACTION_TERMINAL');
    const cancelled = (
      await g.call('post', '/actions').send({ title: 'Cancelada' }).expect(201)
    ).body.data;
    await g
      .call('patch', `/actions/${cancelled.id}`)
      .send({ version: 1, status: 'CANCELLED' })
      .expect(200);
    expect(
      (
        await g
          .call('patch', `/actions/${cancelled.id}`)
          .send({ version: 2, goalId: first.id })
          .expect(409)
      ).body.code,
    ).toBe('GOVERNANCE_ACTION_TERMINAL');
  });
  it('validates existing action goal links against permissions, tenancy, visibility and target state atomically', async () => {
    const g = await setupGovernance();
    const other = await setupGovernance();
    const goal = async (group: typeof g, input: Record<string, unknown> = {}) =>
      (
        await group
          .call('post', '/goals')
          .send({
            name: 'Meta',
            frameworkId: group.framework.id,
            goalType: 'GOVERNANCE_SCORE',
            operator: 'GTE',
            targetValue: 80,
            ...input,
          })
          .expect(201)
      ).body.data;
    const valid = await goal(g),
      foreign = await goal(other),
      cancelled = await goal(g);
    await g
      .call('patch', `/goals/${cancelled.id}`)
      .send({ version: 1, status: 'CANCELLED' })
      .expect(200);
    const action = (
      await g
        .call('post', '/actions')
        .send({ title: 'Ação aberta' })
        .expect(201)
    ).body.data;
    const joined = await join(g.ws.id);
    await g
      .call('patch', `/actions/${action.id}`, member)
      .send({ version: 1, goalId: valid.id })
      .expect(403);
    for (const goalId of [
      '',
      'invalid',
      '11111111-1111-1111-8111-111111111111',
      1,
    ])
      await g
        .call('patch', `/actions/${action.id}`)
        .send({ version: 1, goalId })
        .expect(400);
    for (const goalId of [randomUUID(), foreign.id])
      await g
        .call('patch', `/actions/${action.id}`)
        .send({ version: 1, goalId })
        .expect(404);
    expect(
      (
        await g
          .call('patch', `/actions/${action.id}`)
          .send({ version: 1, goalId: cancelled.id, title: 'Não gravar' })
          .expect(409)
      ).body.code,
    ).toBe('GOVERNANCE_GOAL_CANCELLED');
    const p = await project(g.ws.id, 'PRIVATE');
    const privateGoal = await goal(g, {
      frameworkId: null,
      goalType: 'AUTOMATION_COVERAGE',
      projectId: p.id,
    });
    const privateAction = (
      await g
        .call('post', '/actions')
        .send({ title: 'Ação restrita', goalId: privateGoal.id })
        .expect(201)
    ).body.data;
    const foreignAction = (
      await other
        .call('post', '/actions')
        .send({ title: 'Outro tenant' })
        .expect(201)
    ).body.data;
    await g
      .call('patch', `/actions/${foreignAction.id}`)
      .send({ version: 1, goalId: valid.id })
      .expect(404);
    const role = (
      await http()
        .post(`/api/v1/workspaces/${g.ws.id}/roles`)
        .set('Authorization', auth(owner))
        .send({
          name: 'Gerenciar governança',
          permissionCodes: ['governance.read', 'governance.manage'],
        })
        .expect(201)
    ).body.data;
    await http()
      .put(
        `/api/v1/workspaces/${g.ws.id}/members/${joined.id}/roles/${role.id}`,
      )
      .set('Authorization', auth(owner))
      .send({})
      .expect(204);
    await g
      .call('patch', `/actions/${action.id}`, member)
      .send({ version: 1, goalId: privateGoal.id })
      .expect(404);
    await g
      .call('patch', `/actions/${privateAction.id}`, member)
      .send({ version: 1, goalId: null })
      .expect(404);
    await g
      .call('patch', `/actions/${action.id}`)
      .send({ version: 1, goalId: valid.id, controlAssessmentId: randomUUID() })
      .expect(400);
    await http()
      .post(`${projectPath(g.ws.id, p.id)}/archive`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(200);
    expect(
      (
        await g
          .call('patch', `/actions/${action.id}`)
          .send({ version: 1, goalId: privateGoal.id })
          .expect(409)
      ).body.code,
    ).toBe('PROJECT_ARCHIVED');
    expect(
      (
        await g
          .call('patch', `/actions/${privateAction.id}`)
          .send({ version: 1, goalId: null })
          .expect(409)
      ).body.code,
    ).toBe('PROJECT_ARCHIVED');
    expect(
      (await g.call('get', `/actions/${action.id}`).expect(200)).body.data,
    ).toEqual(action);
    expect(
      await store.client.auditEvent.count({
        where: {
          workspaceId: g.ws.id,
          entityId: action.id,
          action: 'governance.action.updated',
        },
      }),
    ).toBe(0);
    const linked = (
      await g
        .call('patch', `/actions/${action.id}`)
        .send({ version: 1, goalId: valid.id })
        .expect(200)
    ).body.data;
    await g
      .call('patch', `/goals/${valid.id}`)
      .send({ version: 2, status: 'CANCELLED' })
      .expect(200);
    const detached = (
      await g
        .call('patch', `/actions/${action.id}`)
        .send({ version: linked.version, goalId: null })
        .expect(200)
    ).body.data;
    expect(detached.goalId).toBeNull(); // Existing cancelled goals do not freeze action lifecycle.
  });
  it('automatically derives goal progress and achievement from linked actions without altering frameworks', async () => {
    const g = await setupGovernance();
    let goal = (
      await g
        .call('post', '/goals')
        .send({
          name: 'Entrega',
          frameworkId: g.framework.id,
          goalType: 'GOVERNANCE_SCORE',
          operator: 'GT',
          targetValue: 100,
          deadline: '2030-01-01',
        })
        .expect(201)
    ).body.data;
    goal = (
      await g
        .call('post', `/goals/${goal.id}/calculate`)
        .send({ version: goal.version })
        .expect(200)
    ).body.data;
    const metric = goal.lastResult;
    expect(metric.reason).toBe('NO_CLOSED_ASSESSMENT');
    const frameworkBefore = (
      await g.call('get', `/frameworks/${g.framework.id}/progress`).expect(200)
    ).body.data;
    const actions = [];
    for (let i = 0; i < 3; i++)
      actions.push(
        (
          await g
            .call('post', '/actions')
            .send({ title: `Ação ${i}`, goalId: goal.id })
            .expect(201)
        ).body.data,
      );
    await g
      .call('patch', `/goals/${goal.id}`)
      .send({ version: goal.version, name: 'Versão antiga' })
      .expect(409);
    await g
      .call('post', `/actions/${actions[0].id}/complete`)
      .send({ version: 1 })
      .expect(200);
    const current = async () =>
      (await g.call('get', `/goals/${goal.id}`).expect(200)).body.data;
    let view = await current();
    expect(view).toMatchObject({
      status: 'ACTIVE',
      lastResult: metric,
      actionProgress: {
        basis: 'ACTIONS',
        totalActions: 3,
        completedActions: 1,
        cancelledActions: 0,
        percent: 33.33,
      },
    });
    const home = async () =>
      (
        await http()
          .get('/api/v1/dashboard/overview')
          .set('Authorization', auth(owner))
          .query({ workspaceId: g.ws.id })
          .expect(200)
      ).body.data;
    expect((await home()).governance[0]).toMatchObject({
      id: goal.id,
      status: 'ACTIVE',
      progress: 33.33,
    });
    await g
      .call('patch', `/actions/${actions[2].id}`)
      .send({ version: 1, status: 'CANCELLED' })
      .expect(200);
    expect((await current()).actionProgress.percent).toBe(50);
    await g
      .call('post', `/actions/${actions[1].id}/complete`)
      .send({ version: 1 })
      .expect(200);
    view = await current();
    expect(view).toMatchObject({
      status: 'ACHIEVED',
      lastResult: metric,
      actionProgress: {
        totalActions: 2,
        completedActions: 2,
        cancelledActions: 1,
        percent: 100,
      },
    });
    expect((await home()).governance[0]).toMatchObject({
      status: 'ACHIEVED',
      progress: 100,
    });
    expect(
      (
        await g
          .call('get', '/goals')
          .query({ status: 'ACHIEVED', size: 1 })
          .expect(200)
      ).body.meta.pagination.totalItems,
    ).toBe(1);
    expect(
      (await g.call('get', '/dashboard').expect(200)).body.data.goals.achieved,
    ).toBe(1);
    const more = (
      await g
        .call('post', '/actions')
        .send({ title: 'Nova pendência', goalId: goal.id })
        .expect(201)
    ).body.data;
    expect((await current()).status).toBe('ACTIVE');
    const other = (
      await g
        .call('post', '/goals')
        .send({
          name: 'Destino',
          frameworkId: g.framework.id,
          goalType: 'GOVERNANCE_SCORE',
          operator: 'GTE',
          targetValue: 100,
        })
        .expect(201)
    ).body.data;
    const moved = (
      await g
        .call('patch', `/actions/${more.id}`)
        .send({ version: 1, goalId: other.id })
        .expect(200)
    ).body.data;
    expect((await current()).status).toBe('ACHIEVED');
    expect(
      (await g.call('get', `/goals/${other.id}`).expect(200)).body.data
        .actionProgress,
    ).toMatchObject({ totalActions: 1, percent: 0 });
    const detached = (
      await g
        .call('patch', `/actions/${moved.id}`)
        .send({ version: moved.version, goalId: null })
        .expect(200)
    ).body.data;
    expect(detached.goalId).toBeNull();
    expect(
      (await g.call('get', `/goals/${other.id}`).expect(200)).body.data
        .actionProgress,
    ).toMatchObject({ totalActions: 0, percent: null });
    expect(
      (
        await g
          .call('get', `/frameworks/${g.framework.id}/progress`)
          .expect(200)
      ).body.data,
    ).toMatchObject({
      state: frameworkBefore.state,
      summary: frameworkBefore.summary,
      assessment: frameworkBefore.assessment,
    });
    expect(
      await store.client.assessment.count({ where: { workspaceId: g.ws.id } }),
    ).toBe(0);
    const before = await store.client.governanceGoal.findMany({
      where: { workspaceId: g.ws.id },
    });
    const audits = await store.client.auditEvent.count({
      where: { workspaceId: g.ws.id },
    });
    await current();
    await home();
    await g.call('get', '/goals').expect(200);
    await g.call('get', '/dashboard').expect(200);
    expect(
      await store.client.governanceGoal.findMany({
        where: { workspaceId: g.ws.id },
      }),
    ).toEqual(before);
    expect(
      await store.client.auditEvent.count({ where: { workspaceId: g.ws.id } }),
    ).toBe(audits);
  });
  it('projects legacy action counts and deadlines without mutating history, including cancelled goals and complete inventories', async () => {
    const g = await setupGovernance();
    const makeGoal = async (name: string, deadline: string | null = null) =>
      (
        await g
          .call('post', '/goals')
          .send({
            name,
            deadline,
            frameworkId: g.framework.id,
            goalType: 'GOVERNANCE_SCORE',
            operator: 'LTE',
            targetValue: 0,
          })
          .expect(201)
      ).body.data;
    const goal = await makeGoal('Legada');
    const seed = (
      await g
        .call('post', '/actions')
        .send({ title: 'Base', goalId: goal.id })
        .expect(201)
    ).body.data;
    const template = await store.client.actionPlan.findUniqueOrThrow({
      where: { id: seed.id },
    });
    await store.client.actionPlan.update({
      where: { id: seed.id },
      data: { status: 'DONE', completedAt: new Date() },
    });
    await store.client.actionPlan.createMany({
      data: Array.from({ length: 150 }, (_, i) => ({
        ...template,
        id: randomUUID(),
        title: `Ação ${i}`,
        status: 'DONE',
        completedAt: new Date(),
      })),
    });
    const before = await store.client.governanceGoal.findUniqueOrThrow({
      where: { id: goal.id },
    });
    const view = (await g.call('get', `/goals/${goal.id}`).expect(200)).body
      .data;
    expect(view).toMatchObject({
      status: 'ACHIEVED',
      actionProgress: {
        completedActions: 151,
        totalActions: 151,
        percent: 100,
      },
    });
    expect(
      await store.client.governanceGoal.findUniqueOrThrow({
        where: { id: goal.id },
      }),
    ).toEqual(before);
    const expired = await makeGoal('Vencida', '2000-01-01');
    expect(expired).toMatchObject({
      status: 'MISSED',
      actionProgress: { totalActions: 0, percent: null },
    });
    const cancelled = (
      await g
        .call('patch', `/goals/${goal.id}`)
        .send({ version: view.version, status: 'CANCELLED' })
        .expect(200)
    ).body.data;
    expect(cancelled.status).toBe('CANCELLED');
    const allCancelled = await makeGoal('Só canceladas');
    const a = (
      await g
        .call('post', '/actions')
        .send({ title: 'Não executar', goalId: allCancelled.id })
        .expect(201)
    ).body.data;
    await g
      .call('patch', `/actions/${a.id}`)
      .send({ version: 1, status: 'CANCELLED' })
      .expect(200);
    expect(
      (await g.call('get', `/goals/${allCancelled.id}`).expect(200)).body.data,
    ).toMatchObject({
      status: 'ACTIVE',
      actionProgress: { totalActions: 0, cancelledActions: 1, percent: null },
    });
    const other = await setupGovernance();
    await other.call('get', `/goals/${goal.id}`).expect(404);
    await g.call('get', `/goals/${goal.id}`, member).expect(404);
  });
  it('rolls back action completion, goal state and audits together when goal synchronization fails', async () => {
    const g = await setupGovernance();
    const goal = (
      await g
        .call('post', '/goals')
        .send({
          name: 'Atômica',
          frameworkId: g.framework.id,
          goalType: 'GOVERNANCE_SCORE',
          operator: 'GTE',
          targetValue: 100,
        })
        .expect(201)
    ).body.data;
    const action = (
      await g
        .call('post', '/actions')
        .send({ title: 'Concluir', goalId: goal.id })
        .expect(201)
    ).body.data;
    const beforeGoal = await store.client.governanceGoal.findUniqueOrThrow({
      where: { id: goal.id },
    });
    const beforeAction = await store.client.actionPlan.findUniqueOrThrow({
      where: { id: action.id },
    });
    const audits = await store.client.auditEvent.count({
      where: { workspaceId: g.ws.id },
    });
    const service = app.get<GovernanceGoalsActions>(GOVERNANCE_GOALS);
    const original = service.access.audit.bind(service.access);
    const spy = vi
      .spyOn(service.access, 'audit')
      .mockImplementation(async (...args) => {
        if (args[3] === 'governance.goal.actions_updated')
          throw new ApplicationError(
            503,
            'SERVICE_UNAVAILABLE',
            'Falha simulada.',
          );
        return original(...args);
      });
    try {
      await g
        .call('post', `/actions/${action.id}/complete`)
        .send({ version: 1 })
        .expect(503);
    } finally {
      spy.mockRestore();
    }
    expect(
      await store.client.governanceGoal.findUniqueOrThrow({
        where: { id: goal.id },
      }),
    ).toEqual(beforeGoal);
    expect(
      await store.client.actionPlan.findUniqueOrThrow({
        where: { id: action.id },
      }),
    ).toEqual(beforeAction);
    expect(
      await store.client.auditEvent.count({ where: { workspaceId: g.ws.id } }),
    ).toBe(audits);
    await g
      .call('post', `/actions/${action.id}/complete`)
      .send({ version: 1 })
      .expect(200);
    expect(
      (await g.call('get', `/goals/${goal.id}`).expect(200)).body.data.status,
    ).toBe('ACHIEVED');
  });
  it('enforces composite database foreign keys for framework trees, control assessments, evidence and goals', async () => {
    const a = await setupGovernance(),
      b = await setupGovernance();
    await expect(
      store.client.frameworkSection.create({
        data: {
          id: randomUUID(),
          workspaceId: a.ws.id,
          frameworkId: a.framework.id,
          parentSectionId: b.section.id,
          code: 'BAD',
          name: 'Inválida',
          position: 1,
        },
      }),
    ).rejects.toThrow();
    await expect(
      store.client.governanceControl.create({
        data: {
          id: randomUUID(),
          workspaceId: a.ws.id,
          frameworkId: a.framework.id,
          sectionId: b.section.id,
          code: 'BAD',
          title: 'Inválido',
          weight: 1,
          active: true,
        },
      }),
    ).rejects.toThrow();
    const assessment = await a.createAssessment();
    await expect(
      store.client.controlAssessment.create({
        data: {
          id: randomUUID(),
          workspaceId: a.ws.id,
          frameworkId: a.framework.id,
          assessmentId: assessment.id,
          controlId: b.control.id,
          controlSnapshot: {},
          status: 'NOT_ASSESSED',
        },
      }),
    ).rejects.toThrow();
    const ca = (
      await a.call('get', `/assessments/${assessment.id}/controls`).expect(200)
    ).body.data[0];
    await expect(
      store.client.evidenceLink.create({
        data: {
          id: randomUUID(),
          workspaceId: b.ws.id,
          controlAssessmentId: ca.id,
          evidenceType: 'URL',
          url: 'https://example.com',
          title: 'Inválida',
          createdBy: owner.id,
          createdAt: new Date(),
        },
      }),
    ).rejects.toThrow();
    await b
      .call('post', '/actions')
      .send({ title: 'Avaliação de outro tenant', controlAssessmentId: ca.id })
      .expect(404);
    await a
      .call('post', '/actions')
      .send({
        title: 'Responsável de outro tenant',
        ownerMemberId: b.ws.ownerMemberId,
      })
      .expect(404);
    await b
      .call('post', '/goals')
      .send({
        name: 'Framework de outro tenant',
        goalType: 'GOVERNANCE_SCORE',
        frameworkId: a.framework.id,
        operator: 'GTE',
        targetValue: 80,
      })
      .expect(404);
    await expect(
      store.client.governanceGoal.create({
        data: {
          id: randomUUID(),
          workspaceId: b.ws.id,
          frameworkId: a.framework.id,
          name: 'Inválida',
          goalType: 'GOVERNANCE_SCORE',
          operator: 'GTE',
          targetValue: 80,
          status: 'ACTIVE',
          version: 1,
          createdBy: owner.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });
  it('validates DTOs, real dates, query fields, unsupported goal types and pagination envelopes', async () => {
    const { call, framework } = await setupGovernance();
    for (const date of ['2026-02-30', '2027-02-29'])
      await call('post', '/assessments')
        .send({
          frameworkId: framework.id,
          name: 'Inválida',
          assessmentDate: date,
        })
        .expect(400);
    await call('post', '/goals')
      .send({
        name: 'Indisponível',
        goalType: 'FLAKY_TEST_RATE',
        operator: 'LTE',
        targetValue: 2,
      })
      .expect(400);
    await call('post', '/goals')
      .send({
        name: 'Inválida',
        goalType: 'GOVERNANCE_SCORE',
        operator: 'GTE',
        targetValue: 80,
      })
      .expect(400);
    await call('post', '/goals')
      .send({
        name: 'Inválida',
        goalType: 'AUTOMATION_COVERAGE',
        operator: 'GTE',
        targetValue: 101,
      })
      .expect(400);
    await call('post', '/goals')
      .send({
        name: 'Inválida',
        goalType: 'CRITICAL_DEFECTS',
        operator: 'EQ',
        targetValue: 0.5,
      })
      .expect(400);
    await call('patch', `/frameworks/${framework.id}`)
      .send({ version: framework.version, unknown: true })
      .expect(400);
    await call('get', `/frameworks/${framework.id}`)
      .query({ q: 'x' })
      .expect(400);
    await call('get', `/frameworks/${framework.id}/controls`)
      .query({ active: 'unknown' })
      .expect(400);
    await call('get', '/goals').query({ sort: 'targetValue,desc' }).expect(400);
    const page = await call('get', '/frameworks')
      .query({ size: 1, q: 'Política', sort: 'name,desc' })
      .expect(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta.pagination.totalItems).toBe(1);
    expect(
      (await call('get', '/frameworks').query({ q: '%' }).expect(200)).body
        .data,
    ).toEqual([]);
    await http()
      .get(`/api/v1/workspaces/${randomUUID()}/governance/dashboard`)
      .expect(401);
  });
  it('shares snapshot progress with overview, selects current sources, and reads without writes', async () => {
    const g = await setupGovernance();
    overviewTime = new Date('2026-10-04T12:00:00.000Z');
    const progress = () =>
      g.call('get', `/frameworks/${g.framework.id}/progress`);
    expect((await progress().expect(200)).body.data).toMatchObject({
      state: 'NO_ASSESSMENT',
      assessment: null,
      summary: null,
      sections: [],
    });
    const a = await g.createAssessment();
    expect((await progress().expect(200)).body.data.state).toBe(
      'NO_ASSESSMENT',
    );
    expect(
      (await progress().query({ assessmentId: a.id }).expect(200)).body.data,
    ).toMatchObject({
      state: 'DRAFT',
      summary: { counts: { NOT_ASSESSED: 1 } },
    });
    let started = (
      await g
        .call('post', `/assessments/${a.id}/start`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    started = (
      await g
        .call('put', `/assessments/${a.id}/controls/${g.control.id}`)
        .send({ version: started.version, status: 'MET' })
        .expect(200)
    ).body.data;
    const closed = (
      await g
        .call('post', `/assessments/${a.id}/close`)
        .send({ version: started.version })
        .expect(200)
    ).body.data;
    expect((await progress().expect(200)).body.data.assessment.id).toBe(
      closed.id,
    );
    const newerDraft = await g.createAssessment();
    expect((await progress().expect(200)).body.data.assessment.id).toBe(
      closed.id,
    );
    await g
      .call('post', `/assessments/${newerDraft.id}/start`)
      .send({ version: 1 })
      .expect(200);
    await store.client.assessment.update({
      where: { id: newerDraft.id },
      data: { createdAt: new Date('2026-01-01T00:00:00Z') },
    });
    await g
      .call(
        'post',
        `/assessments/${newerDraft.id}/controls/${g.control.id}/evidence`,
      )
      .send({
        version: 2,
        evidenceType: 'URL',
        title: 'Expirada',
        url: 'https://example.com',
        validUntil: '2026-10-03',
      })
      .expect(200);
    for (let i = 0; i < 8; i++)
      await g
        .call('post', '/goals')
        .send({
          name: `Prazo ${i}`,
          goalType: 'GOVERNANCE_SCORE',
          frameworkId: g.framework.id,
          operator: 'GTE',
          targetValue: 100,
          deadline:
            i === 7 ? '2026-11-04' : i === 6 ? '2026-11-03' : '2026-10-04',
        })
        .expect(201);
    const auditBefore = await store.client.auditEvent.count({
      where: { workspaceId: g.ws.id },
    });
    const read = await progress().expect(200);
    expect(read.headers['cache-control']).toBe('no-store');
    const detail = read.body.data;
    expect(detail).toMatchObject({
      state: 'IN_PROGRESS',
      assessment: { id: newerDraft.id },
      summary: { index: { value: 0 }, completed: false },
    });
    const overview = (
      await http()
        .get('/api/v1/dashboard/overview')
        .set('Authorization', auth(owner))
        .query({ workspaceId: g.ws.id, days: 7 })
        .expect(200)
    ).body.data;
    expect(overview.frameworkGovernance.frameworks[0].summary).toEqual(
      detail.summary,
    );
    expect(overview.frameworkGovernance.overall).toEqual(detail.summary);
    expect(
      overview.frameworkGovernance.frameworks[0].sections[0].summary,
    ).toEqual(detail.sections[0].subtree);
    expect(overview.frameworkGovernance.attention).toMatchObject({
      notAssessedControls: 1,
      expiredEvidence: 1,
      upcomingGoals: 7,
    });
    expect(overview.governance).toHaveLength(6);
    expect(
      await store.client.auditEvent.count({ where: { workspaceId: g.ws.id } }),
    ).toBe(auditBefore);
    expect(
      (await g.call('get', `/assessments/${newerDraft.id}`).expect(200)).body
        .data.version,
    ).toBe(3);
    const second = await g.createAssessment();
    await g
      .call('post', `/assessments/${second.id}/start`)
      .send({ version: 1 })
      .expect(200);
    await store.client.assessment.update({
      where: { id: second.id },
      data: { createdAt: new Date('2026-01-01T00:00:00Z') },
    });
    expect((await progress().expect(200)).body.data.assessment.id).toBe(
      [second.id, newerDraft.id].sort()[0],
    );
    const renamed = (
      await g
        .call('patch', `/frameworks/${g.framework.id}/sections/${g.section.id}`)
        .send({ version: g.framework.version, name: 'Nome atual' })
        .expect(200)
    ).body.data;
    const historical = (
      await progress().query({ assessmentId: closed.id }).expect(200)
    ).body.data;
    expect(historical.definitionVersionDiffers).toBe(true);
    expect(historical.sections[0].name).toBe('Política');
    expect(historical.framework.version).toBe(renamed.frameworkVersion);
    await g
      .call('put', `/assessments/${closed.id}/controls/${g.control.id}`)
      .send({ version: closed.version, status: 'NOT_MET' })
      .expect(409);
    overviewTime = undefined;
  });
  it('validates progress tenant, framework, grants and strict queries', async () => {
    const a = await setupGovernance(),
      b = await setupGovernance(),
      foreign = await b.createAssessment();
    const route = `/frameworks/${a.framework.id}/progress`;
    await a.call('get', route).query({ assessmentId: foreign.id }).expect(404);
    const other = (
      await a
        .call('post', '/frameworks')
        .send({ code: 'OTHER', name: 'Outro', versionLabel: '1' })
        .expect(201)
    ).body.data;
    const draft = await a.createAssessment();
    await a
      .call('get', `/frameworks/${other.id}/progress`)
      .query({ assessmentId: draft.id })
      .expect(404);
    await a.call('get', route, otherOwner).expect(404);
    await a.call('get', route).query({ assessmentId: 'invalid' }).expect(400);
    await a.call('get', route).query({ page: 1 }).expect(400);
    await a
      .call('get', `${route}?assessmentId=${draft.id}&assessmentId=${draft.id}`)
      .expect(400);
    await a.call('get', '/frameworks/invalid/progress').expect(400);
    await http().get(`${a.base}${route}`).expect(401);
    const joined = await join(a.ws.id, member);
    await store.client.memberRole.deleteMany({
      where: { workspaceId: a.ws.id, memberId: joined.id },
    });
    await a.call('get', route, member).expect(403);
    const dashboard = (
      await http()
        .get('/api/v1/dashboard/overview')
        .set('Authorization', auth(member))
        .query({ workspaceId: a.ws.id })
        .expect(200)
    ).body.data;
    expect(dashboard.frameworkGovernance).toBeNull();
  });
  it('calculates section goals from the latest closed subtree and preserves historical scope and ownership', async () => {
    const g = await setupGovernance();
    const child = (
      await g
        .call('post', `/frameworks/${g.framework.id}/sections`)
        .send({
          version: g.framework.version,
          code: 'CHILD',
          name: 'Filha',
          position: 1,
          parentSectionId: g.section.id,
        })
        .expect(201)
    ).body.data;
    const c = (
      await g
        .call('post', `/frameworks/${g.framework.id}/controls`)
        .send({
          version: child.frameworkVersion,
          code: 'CHILD-1',
          title: 'Filho',
          sectionId: child.section.id,
          weight: 1,
        })
        .expect(201)
    ).body.data;
    let a = await g.createAssessment();
    a = (
      await g
        .call('post', `/assessments/${a.id}/start`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    a = (
      await g
        .call('put', `/assessments/${a.id}/controls/${g.control.id}`)
        .send({ version: a.version, status: 'MET' })
        .expect(200)
    ).body.data;
    a = (
      await g
        .call('put', `/assessments/${a.id}/controls/${c.control.id}`)
        .send({ version: a.version, status: 'PARTIALLY_MET' })
        .expect(200)
    ).body.data;
    a = (
      await g
        .call('post', `/assessments/${a.id}/close`)
        .send({ version: a.version })
        .expect(200)
    ).body.data;
    let goal = (
      await g
        .call('post', '/goals')
        .send({
          name: 'Level 2',
          goalType: 'GOVERNANCE_SCORE',
          frameworkId: g.framework.id,
          sectionId: g.section.id,
          ownerMemberId: g.ws.ownerMemberId,
          operator: 'GTE',
          targetValue: 100,
        })
        .expect(201)
    ).body.data;
    expect(goal.ownerDisplayName).toBeTruthy();
    expect(goal.sectionPath[0].id).toBe(g.section.id);
    goal = (
      await g
        .call('post', `/goals/${goal.id}/calculate`)
        .send({ version: goal.version })
        .expect(200)
    ).body.data;
    expect(goal.lastResult).toMatchObject({
      value: 87.5,
      numerator: 350,
      denominator: 4,
      sourceIds: [a.id],
      section: { name: 'Política' },
    });
    const added = (
      await g
        .call('post', `/frameworks/${g.framework.id}/sections`)
        .send({
          version: c.frameworkVersion,
          code: 'NEW',
          name: 'Sem snapshot',
          position: 2,
        })
        .expect(201)
    ).body.data;
    await g
      .call('patch', `/frameworks/${g.framework.id}/sections/${g.section.id}`)
      .send({ version: added.frameworkVersion, name: 'Atual' })
      .expect(200);
    expect(
      (await g.call('get', `/goals/${goal.id}`).expect(200)).body.data
        .sectionName,
    ).toBe('Política');
    await g
      .call('patch', `/goals/${goal.id}`)
      .send({ version: goal.version - 1, sectionId: null })
      .expect(409);
    goal = (
      await g
        .call('patch', `/goals/${goal.id}`)
        .send({
          version: goal.version,
          sectionId: added.section.id,
          ownerMemberId: null,
        })
        .expect(200)
    ).body.data;
    expect(goal.lastResult).toBeNull();
    expect(goal.ownerDisplayName).toBeNull();
    goal = (
      await g
        .call('post', `/goals/${goal.id}/calculate`)
        .send({ version: goal.version })
        .expect(200)
    ).body.data;
    expect(goal.lastResult).toMatchObject({
      value: null,
      reason: 'SECTION_NOT_IN_SNAPSHOT',
      sourceIds: [a.id],
      section: null,
    });
    expect(goal.sectionName).toBeNull();
    const legacy = (
      await g
        .call('post', '/goals')
        .send({
          name: 'Todo',
          goalType: 'GOVERNANCE_SCORE',
          frameworkId: g.framework.id,
          operator: 'GTE',
          targetValue: 100,
        })
        .expect(201)
    ).body.data;
    expect(legacy).toMatchObject({
      sectionId: null,
      ownerMemberId: null,
      sectionName: null,
      sectionPath: [],
    });
    expect(
      (
        await g
          .call('post', `/goals/${legacy.id}/calculate`)
          .send({ version: 1 })
          .expect(200)
      ).body.data.lastResult.value,
    ).toBe(87.5);
    const foreign = await setupGovernance();
    for (const fields of [
      { sectionId: foreign.section.id },
      { ownerMemberId: foreign.ws.ownerMemberId },
    ])
      await g
        .call('patch', `/goals/${goal.id}`)
        .send({ version: goal.version, ...fields })
        .expect(404);
    await g
      .call('patch', `/goals/${goal.id}`)
      .send({
        version: goal.version,
        goalType: 'AUTOMATION_COVERAGE',
        frameworkId: null,
      })
      .expect(400);
    const inactive = await join(g.ws.id, member);
    await store.client.workspaceMember.update({
      where: { id: inactive.id },
      data: { status: 'REMOVED' },
    });
    await g
      .call('patch', `/goals/${goal.id}`)
      .send({ version: goal.version, ownerMemberId: inactive.id })
      .expect(404);
    await expect(
      store.client.governanceGoal.update({
        where: { id: goal.id },
        data: { sectionId: foreign.section.id },
      }),
    ).rejects.toThrow();
    await expect(
      store.client.governanceGoal.update({
        where: { id: goal.id },
        data: { ownerMemberId: foreign.ws.ownerMemberId },
      }),
    ).rejects.toThrow();
  });
  it('reads weighted direct/subtree summaries and returns explicit null reasons for empty or inapplicable section goals', async () => {
    const g = await setupGovernance();
    let version = g.framework.version;
    const section = async (
      code: string,
      parentSectionId: string | null = null,
    ) => {
      const data = (
        await g
          .call('post', `/frameworks/${g.framework.id}/sections`)
          .send({ version, code, name: code, position: 1, parentSectionId })
          .expect(201)
      ).body.data;
      version = data.frameworkVersion;
      return data.section;
    };
    const child = await section('CHILD', g.section.id),
      grand = await section('GRAND', child.id),
      empty = await section('EMPTY'),
      na = await section('NA');
    const control = async (sectionId: string, code: string, weight: number) => {
      const data = (
        await g
          .call('post', `/frameworks/${g.framework.id}/controls`)
          .send({ version, sectionId, code, title: code, weight })
          .expect(201)
      ).body.data;
      version = data.frameworkVersion;
      return data.control;
    };
    const c = await control(child.id, 'C', 2),
      n = await control(grand.id, 'G', 1),
      excluded = await control(na.id, 'NA-C', 999);
    const goal = async (sectionId: string) =>
      (
        await g
          .call('post', '/goals')
          .send({
            name: sectionId,
            sectionId,
            frameworkId: g.framework.id,
            goalType: 'GOVERNANCE_SCORE',
            operator: 'GTE',
            targetValue: 100,
          })
          .expect(201)
      ).body.data;
    let emptyGoal = await goal(empty.id);
    emptyGoal = (
      await g
        .call('post', `/goals/${emptyGoal.id}/calculate`)
        .send({ version: emptyGoal.version })
        .expect(200)
    ).body.data;
    expect(emptyGoal.lastResult).toMatchObject({
      value: null,
      reason: 'NO_CLOSED_ASSESSMENT',
      sourceIds: [],
    });
    let a = await g.createAssessment();
    a = (
      await g
        .call('post', `/assessments/${a.id}/start`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    for (const [id, status] of [
      [g.control.id, 'MET'],
      [c.id, 'PARTIALLY_MET'],
      [excluded.id, 'NOT_APPLICABLE'],
    ])
      a = (
        await g
          .call('put', `/assessments/${a.id}/controls/${id}`)
          .send({
            version: a.version,
            status,
            ...(status === 'NOT_APPLICABLE'
              ? { justification: 'Fora do escopo' }
              : {}),
          })
          .expect(200)
      ).body.data;
    const detail = (
      await g.call('get', `/frameworks/${g.framework.id}/progress`).expect(200)
    ).body.data;
    expect(detail.summary).toMatchObject({
      totalControls: 4,
      applicableControls: 3,
      assessedControls: 3,
      index: { value: 66.67, numerator: 400, denominator: 6 },
    });
    expect(
      detail.sections.find((s: { id: string }) => s.id === g.section.id),
    ).toMatchObject({
      direct: { totalControls: 1 },
      subtree: { totalControls: 3 },
    });
    expect(
      detail.sections.find((s: { id: string }) => s.id === child.id).subtree
        .totalControls,
    ).toBe(2);
    expect(
      detail.sections.find((s: { id: string }) => s.id === grand.id).direct
        .counts.NOT_ASSESSED,
    ).toBe(1);
    expect(
      detail.sections.find((s: { id: string }) => s.id === empty.id).subtree
        .state,
    ).toBe('EMPTY');
    expect(
      detail.sections.find((s: { id: string }) => s.id === na.id).subtree,
    ).toMatchObject({
      state: 'NOT_APPLICABLE',
      completed: false,
      completionPercent: null,
      assessmentPercent: 100,
    });
    await g
      .call('get', `/assessments/${a.id}/controls`)
      .query({ page: 1, size: 1, status: 'MET' })
      .expect(200);
    expect(
      (
        await g
          .call('get', `/frameworks/${g.framework.id}/progress`)
          .expect(200)
      ).body.data.summary,
    ).toEqual(detail.summary);
    a = (
      await g
        .call('put', `/assessments/${a.id}/controls/${n.id}`)
        .send({ version: a.version, status: 'NOT_MET' })
        .expect(200)
    ).body.data;
    a = (
      await g
        .call('post', `/assessments/${a.id}/close`)
        .send({ version: a.version })
        .expect(200)
    ).body.data;
    emptyGoal = (
      await g
        .call('post', `/goals/${emptyGoal.id}/calculate`)
        .send({ version: emptyGoal.version })
        .expect(200)
    ).body.data;
    expect(emptyGoal.lastResult).toMatchObject({
      value: null,
      reason: 'EMPTY_SECTION',
      sourceIds: [a.id],
      section: { name: 'EMPTY' },
    });
    const naGoal = await goal(na.id);
    expect(
      (
        await g
          .call('post', `/goals/${naGoal.id}/calculate`)
          .send({ version: 1 })
          .expect(200)
      ).body.data.lastResult,
    ).toMatchObject({
      value: null,
      reason: 'NO_APPLICABLE_CONTROLS',
      sourceIds: [a.id],
    });
  });
  it('returns every active framework and consolidates weights only from selected sources', async () => {
    const g = await setupGovernance();
    let a = await g.createAssessment();
    a = (
      await g
        .call('post', `/assessments/${a.id}/start`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    a = (
      await g
        .call('put', `/assessments/${a.id}/controls/${g.control.id}`)
        .send({ version: a.version, status: 'MET' })
        .expect(200)
    ).body.data;
    for (let i = 0; i < 11; i++) {
      let f = (
        await g
          .call('post', '/frameworks')
          .send({ code: `F${i}`, name: `Framework ${i}`, versionLabel: '1' })
          .expect(201)
      ).body.data;
      const section = (
        await g
          .call('post', `/frameworks/${f.id}/sections`)
          .send({ version: f.version, code: 'ROOT', name: 'Raiz', position: 1 })
          .expect(201)
      ).body.data;
      const c = (
        await g
          .call('post', `/frameworks/${f.id}/controls`)
          .send({
            version: section.frameworkVersion,
            sectionId: section.section.id,
            code: 'C',
            title: 'Controle',
            weight: 1,
          })
          .expect(201)
      ).body.data;
      f = (
        await g
          .call('patch', `/frameworks/${f.id}`)
          .send({ version: c.frameworkVersion, status: 'ACTIVE' })
          .expect(200)
      ).body.data;
      if (i === 0) {
        const copy = (
          await g
            .call('post', '/assessments')
            .send({
              frameworkId: f.id,
              name: 'Em avaliação',
              assessmentDate: '2026-10-04',
            })
            .expect(201)
        ).body.data;
        await g
          .call('post', `/assessments/${copy.id}/start`)
          .send({ version: 1 })
          .expect(200);
        await g
          .call('put', `/assessments/${copy.id}/controls/${c.control.id}`)
          .send({ version: 2, status: 'NOT_MET' })
          .expect(200);
      }
    }
    const block = (
      await http()
        .get('/api/v1/dashboard/overview')
        .set('Authorization', auth(owner))
        .query({ workspaceId: g.ws.id, days: 7 })
        .expect(200)
    ).body.data.frameworkGovernance;
    expect(block).toMatchObject({
      frameworkCount: 12,
      frameworksWithAssessment: 2,
      overall: {
        totalControls: 2,
        index: { value: 75, numerator: 300, denominator: 4 },
        completionPercent: 50,
      },
    });
    expect(block.frameworks).toHaveLength(12);
    expect(
      block.frameworks.filter(
        (f: { state: string }) => f.state === 'NO_ASSESSMENT',
      ),
    ).toHaveLength(10);
    const closed1 = (
      await g
        .call('post', `/assessments/${a.id}/close`)
        .send({ version: a.version })
        .expect(200)
    ).body.data;
    let b = await g.createAssessment();
    b = (
      await g
        .call('post', `/assessments/${b.id}/start`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    b = (
      await g
        .call('put', `/assessments/${b.id}/controls/${g.control.id}`)
        .send({ version: b.version, status: 'NOT_MET' })
        .expect(200)
    ).body.data;
    b = (
      await g
        .call('post', `/assessments/${b.id}/close`)
        .send({ version: b.version })
        .expect(200)
    ).body.data;
    await store.client.assessment.updateMany({
      where: { id: { in: [closed1.id, b.id] } },
      data: { closedAt: new Date('2026-10-04T12:00:00Z') },
    });
    const expectedId = [closed1.id, b.id].sort()[0];
    const selected = (
      await g.call('get', `/frameworks/${g.framework.id}/progress`).expect(200)
    ).body.data;
    expect(selected.assessment.id).toBe(expectedId);
    const goal = (
      await g
        .call('post', '/goals')
        .send({
          name: 'Última encerrada',
          frameworkId: g.framework.id,
          goalType: 'GOVERNANCE_SCORE',
          operator: 'GTE',
          targetValue: 100,
        })
        .expect(201)
    ).body.data;
    const calculated = (
      await g
        .call('post', `/goals/${goal.id}/calculate`)
        .send({ version: 1 })
        .expect(200)
    ).body.data;
    expect(calculated.lastResult.sourceIds).toEqual([expectedId]);
    expect(calculated.lastResult.value).toBe(selected.summary.index.value);
  });
});

describe('Product dashboard overview with MySQL/MariaDB and HTTP', () => {
  const reference = new Date('2026-10-04T12:00:00.000Z');
  const date = (days: number, ms = 0) =>
    new Date(reference.getTime() - days * 86400000 + ms);
  afterEach(() => {
    overviewTime = undefined;
  });
  async function account() {
    const h = harness(identity),
      email = `${randomUUID()}@example.com`;
    const user = await register(h, email);
    const pair = await h.service.login(
      email,
      'VerySecurePassword123!',
      h.requestId,
    );
    return { id: user.id, email, token: pair.accessToken };
  }
  async function setup(existing?: Account) {
    overviewTime = reference;
    const actor = existing ?? (await account());
    const ws = await workspace(actor);
    const requestTo = (
      method: 'get' | 'post' | 'patch' | 'put' | 'delete',
      path: string,
      who = actor,
    ) => http()[method](path).set('Authorization', auth(who));
    const createProject = async (key: string) =>
      (
        await requestTo('post', `/api/v1/workspaces/${ws.id}/projects`)
          .send({ key, name: key })
          .expect(201)
      ).body.data;
    const p = await createProject('DASH');
    const base = `/api/v1/workspaces/${ws.id}/projects/${p.id}`;
    const call = (
      method: 'get' | 'post' | 'patch' | 'put' | 'delete',
      path: string,
    ) => requestTo(method, `${base}${path}`);
    const testCase = async (status = 'ACTIVE') =>
      (
        await call('post', '/test-cases')
          .send({ title: 'Caso do painel', status })
          .expect(201)
      ).body.data;
    const run = async (
      caseIds: string[],
      createdAt: Date,
      results: string[],
      executedAt = date(1),
    ) => {
      const r = (
        await call('post', '/test-runs')
          .send({ name: 'Run do painel', caseIds })
          .expect(201)
      ).body.data;
      await store.client.testRun.update({
        where: { id: r.id },
        data: { createdAt },
      });
      const copies = await store.client.testRunCase.findMany({
        where: { workspaceId: ws.id, projectId: p.id, testRunId: r.id },
        orderBy: { position: 'asc' },
      });
      for (let i = 0; i < copies.length; i++) {
        const result = results[i] as
          'NOT_TESTED' | 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
        await store.client.testRunCase.update({
          where: { id: copies[i].id },
          data: {
            result,
            executedAt: result === 'NOT_TESTED' ? null : executedAt,
            executedBy: result === 'NOT_TESTED' ? null : actor.id,
          },
        });
      }
      return r;
    };
    const overview = async (days: number | 'ALL' = 30, who = actor) =>
      (
        await requestTo('get', '/api/v1/dashboard/overview', who)
          .query({ workspaceId: ws.id, days })
          .expect(200)
      ).body.data;
    return {
      actor,
      ws,
      p,
      base,
      requestTo,
      createProject,
      call,
      testCase,
      run,
      overview,
    };
  }
  async function grantParticipant(
    s: Awaited<ReturnType<typeof setup>>,
    who: Account,
    projectId = s.p.id,
  ) {
    await s
      .requestTo('post', `/api/v1/workspaces/${s.ws.id}/invitations`)
      .send({ email: who.email })
      .expect(202);
    const token = mail.token();
    const wm = (
      await s
        .requestTo('post', '/api/v1/invitations/accept', who)
        .send({ token })
        .expect(200)
    ).body.data;
    await s
      .requestTo(
        'put',
        `/api/v1/workspaces/${s.ws.id}/projects/${projectId}/members/${wm.id}`,
      )
      .send({ projectRole: 'VIEWER' })
      .expect(200);
    return wm;
  }
  it('distinguishes no source from an authorized empty inventory and validates bearer and query', async () => {
    overviewTime = reference;
    const actor = await account();
    await http().get('/api/v1/dashboard/overview').expect(401);
    await http()
      .get('/api/v1/dashboard/overview')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    const res = await http()
      .get('/api/v1/dashboard/overview')
      .set('Authorization', auth(actor))
      .expect(200);
    expect(res.body.data).toEqual({
      generatedAt: brazilTimestamp(reference),
      period: {
        days: 30,
        supportedDays: [7, 30, 90, 'ALL'],
        from: brazilTimestamp(date(30)),
        to: brazilTimestamp(reference),
        previousFrom: brazilTimestamp(date(60)),
        previousTo: brazilTimestamp(date(30)),
      },
      metrics: {
        testCases: { value: null, previousValue: null },
        activeTestCases: { value: null, previousValue: null },
        executions: { value: null, previousValue: null },
        defects: { value: null, previousValue: null },
        coverage: { value: null, previousValue: null },
        automationCoverage: { value: null, previousValue: null },
      },
      results: null,
      defectsByStatus: null,
      projects: null,
      activity: null,
      governance: null,
      frameworkGovernance: null,
      documents: null,
    });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.meta.requestId).toBe(res.headers['x-request-id']);
    expect(res.body.meta).not.toHaveProperty('pagination');
    for (const query of [
      { days: 0 },
      { days: 8 },
      { days: 7.5 },
      { days: '' },
      { days: '7e0' },
      { days: 'all' },
      { days: 'ALL ' },
      { days: '100' },
      { workspaceId: '' },
      { workspaceId: '11111111-1111-1111-8111-111111111111' },
      { page: 1 },
      { size: 10 },
      { status: 'ALL' },
    ])
      expect(
        (
          await http()
            .get('/api/v1/dashboard/overview')
            .set('Authorization', auth(actor))
            .query(query)
            .expect(400)
        ).body.code,
      ).toBe('VALIDATION_ERROR');
    await http()
      .get('/api/v1/dashboard/overview?days=ALL&days=30')
      .set('Authorization', auth(actor))
      .expect(400);
    await http()
      .get('/api/v1/dashboard/overview')
      .set('Authorization', auth(actor))
      .query({ workspaceId: randomUUID() })
      .expect(404);
    const noHistory = (
      await http()
        .get('/api/v1/dashboard/overview')
        .set('Authorization', auth(actor))
        .query({ days: 'ALL' })
        .expect(200)
    ).body.data;
    expect(noHistory.period).toEqual({
      days: 'ALL',
      supportedDays: [7, 30, 90, 'ALL'],
      from: null,
      to: brazilTimestamp(reference),
      previousFrom: null,
      previousTo: null,
    });
    expect(noHistory.metrics.activeTestCases.value).toBeNull();
    expect(
      Object.values(noHistory.metrics).every(
        (m) => (m as { previousValue: unknown }).previousValue === null,
      ),
    ).toBe(true);
    const s = await setup(actor);
    const empty = await s.overview();
    expect(empty.metrics).toEqual({
      testCases: { value: 0, previousValue: null },
      activeTestCases: { value: 0, previousValue: null },
      executions: { value: 0, previousValue: 0 },
      defects: { value: 0, previousValue: 0 },
      coverage: { value: null, previousValue: null },
      automationCoverage: { value: null, previousValue: null },
    });
    const emptyAll = await s.overview('ALL');
    expect(emptyAll.period.from).toBeNull(); // No temporal history before generatedAt.
    expect(emptyAll.metrics.activeTestCases.value).toBe(0);
    expect(emptyAll.metrics.executions).toEqual({
      value: 0,
      previousValue: null,
    });
    expect(emptyAll.metrics.defects).toEqual({ value: 0, previousValue: null });
    expect(empty.results).toEqual({
      NOT_TESTED: 0,
      PASSED: 0,
      FAILED: 0,
      BLOCKED: 0,
      SKIPPED: 0,
    });
    expect(empty.defectsByStatus).toEqual({
      OPEN: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0,
      REJECTED: 0,
    });
    expect(empty.governance).toEqual([]);
    expect(empty.documents).toEqual([]);
    expect(empty.projects).toHaveLength(1);
    expect(empty.projects[0]).toMatchObject({
      progress: null,
      coverage: null,
      activeTestCases: 0,
      automationCoverage: null,
    });
    for (const days of [7, 30, 90, 'ALL'] as const)
      expect((await s.overview(days)).period.days).toBe(days);
  });
  it('counts the complete current active automation base and all automation enums independently of days and executions', async () => {
    const s = await setup();
    const seed = await s.testCase();
    const template = await store.client.testCase.findUniqueOrThrow({
      where: { id: seed.id },
    });
    await store.client.testCase.delete({ where: { id: seed.id } });
    const automationStatuses = [
      'AUTOMATED',
      'MANUAL',
      'TO_BE_AUTOMATED',
      'IN_PROGRESS',
      'NOT_APPLICABLE',
    ];
    await store.client.testCase.createMany({
      data: [
        ...Array.from({ length: 151 }, (_, i) => ({
          ...template,
          id: randomUUID(),
          sequence: i + 1,
          automationStatus: automationStatuses[i] ?? 'MANUAL',
          createdAt: date(200),
        })),
        ...['DRAFT', 'DEPRECATED', 'ARCHIVED'].map((status, i) => ({
          ...template,
          id: randomUUID(),
          sequence: 200 + i,
          status,
          automationStatus: 'AUTOMATED',
          archivedAt: i >= 2 ? date(1) : null,
        })),
      ],
    });
    const empty = await s.createProject('EMPTY');
    for (const days of [7, 30, 90, 'ALL'] as const) {
      const result = await s.overview(days);
      expect(result.metrics.automationCoverage).toEqual({
        value: 0.66,
        previousValue: null,
      });
      expect(result.metrics.activeTestCases).toEqual({
        value: 151,
        previousValue: null,
      });
      expect(result.metrics.testCases.value).toBe(153); // Old catalog semantics include DRAFT/DEPRECATED.
      expect(result.metrics.executions.value).toBe(0);
      expect(
        result.projects.find((p: { id: string }) => p.id === s.p.id),
      ).toMatchObject({
        activeTestCases: 151,
        automationCoverage: 0.66,
        coverage: 0,
        progress: null,
      });
      expect(
        result.projects.find((p: { id: string }) => p.id === empty.id),
      ).toMatchObject({
        activeTestCases: 0,
        automationCoverage: null,
      });
    }
    await store.client.testCase.updateMany({
      where: { workspaceId: s.ws.id },
      data: { automationStatus: 'MANUAL' },
    });
    const manual = await s.overview();
    expect(manual.metrics.automationCoverage.value).toBe(0);
    expect(
      manual.projects.find((p: { id: string }) => p.id === s.p.id),
    ).toMatchObject({
      activeTestCases: 151,
      automationCoverage: 0,
    });
    await store.client.testCase.updateMany({
      where: { workspaceId: s.ws.id },
      data: { status: 'DEPRECATED', archivedAt: null },
    });
    const noActive = await s.overview();
    expect(noActive.metrics.activeTestCases.value).toBe(0);
    expect(noActive.metrics.automationCoverage.value).toBeNull();
    expect(
      noActive.projects.find((p: { id: string }) => p.id === s.p.id),
    ).toMatchObject({ activeTestCases: 0, automationCoverage: null });
  });
  it('consolidates automation by case counts across Workspaces and projects beyond the ten displayed rows', async () => {
    const s = await setup();
    const seed = await s.testCase();
    const template = await store.client.testCase.findUniqueOrThrow({
      where: { id: seed.id },
    });
    await store.client.testCase.createMany({
      data: Array.from({ length: 89 }, (_, i) => ({
        ...template,
        id: randomUUID(),
        sequence: i + 2,
      })),
    });
    for (let i = 0; i < 10; i++) {
      const p = await s.createProject(`AUTOMATED${i}`);
      await s
        .requestTo(
          'post',
          `/api/v1/workspaces/${s.ws.id}/projects/${p.id}/test-cases`,
        )
        .send({
          title: 'Automatizado',
          status: 'ACTIVE',
          automationStatus: 'AUTOMATED',
        })
        .expect(201);
    }
    // The 90-case project is deliberately omitted from the ten latest rows.
    await store.client.project.update({
      where: { id: s.p.id },
      data: { updatedAt: date(200) },
    });
    const scoped = await s.overview();
    expect(scoped.metrics.activeTestCases).toEqual({
      value: 100,
      previousValue: null,
    });
    expect(scoped.projects).toHaveLength(10);
    expect(scoped.projects.map((p: { id: string }) => p.id)).not.toContain(
      s.p.id,
    );
    expect(scoped.metrics.automationCoverage).toEqual({
      value: 10,
      previousValue: null,
    });
    const other = await setup(s.actor);
    const c = await other.testCase();
    await store.client.testCase.update({
      where: { id: c.id },
      data: { automationStatus: 'AUTOMATED' },
    });
    const privateTenant = await setup();
    const privateCase = await privateTenant.testCase();
    await store.client.testCase.update({
      where: { id: privateCase.id },
      data: { automationStatus: 'AUTOMATED' },
    });
    const consolidated = (
      await s.requestTo('get', '/api/v1/dashboard/overview').expect(200)
    ).body.data;
    expect(consolidated.metrics.activeTestCases.value).toBe(101);
    expect(consolidated.metrics.automationCoverage.value).toBe(10.89); // 11 / 101, not an average of percentages.
    expect(JSON.stringify(consolidated)).not.toContain(privateTenant.ws.id);
    await store.client.workspace.update({
      where: { id: other.ws.id },
      data: { status: 'ARCHIVED' },
    });
    expect(
      (await s.requestTo('get', '/api/v1/dashboard/overview').expect(200)).body
        .data.metrics.automationCoverage.value,
    ).toBe(10);
    await s
      .requestTo(
        'post',
        `/api/v1/workspaces/${s.ws.id}/projects/${s.p.id}/archive`,
      )
      .send({})
      .expect(200);
    expect((await s.overview()).metrics.automationCoverage.value).toBe(100);
    await s
      .requestTo('get', '/api/v1/dashboard/overview')
      .query({ workspaceId: privateTenant.ws.id })
      .expect(404);
  });
  it('includes history older than ninety days, preserves ALL upper bounds and consolidates the first authorized instant', async () => {
    const s = await setup();
    const c = await s.testCase();
    await s.run([c.id], date(200), ['FAILED'], date(300));
    await s.run([c.id], reference, ['NOT_TESTED']);
    await s.run([c.id], date(-1), ['NOT_TESTED']);
    for (const createdAt of [date(250), reference, date(-1)]) {
      const d = (
        await s
          .call('post', '/defects')
          .send({ title: 'Histórico' })
          .expect(201)
      ).body.data;
      await store.client.defect.update({
        where: { id: d.id },
        data: { createdAt, status: 'RESOLVED' },
      });
    }
    const event = randomUUID();
    await store.client.auditEvent.create({
      data: {
        id: event,
        workspaceId: s.ws.id,
        actorUserId: s.actor.id,
        action: 'test.historical',
        entityType: 'TestRun',
        entityId: (
          await store.client.testRun.findFirstOrThrow({
            where: { workspaceId: s.ws.id, createdAt: date(200) },
          })
        ).id,
        occurredAt: date(400),
        correlationId: randomUUID(),
      },
    });
    for (let i = 0; i < 11; i++) await s.createProject(`HISTORY${i}`);
    const ninety = await s.overview(90);
    expect(ninety.metrics.executions.value).toBe(0);
    expect(ninety.metrics.defects.value).toBe(0);
    expect(ninety.metrics.coverage.value).toBe(0);
    const all = await s.overview('ALL');
    expect(all.period).toEqual({
      days: 'ALL',
      supportedDays: [7, 30, 90, 'ALL'],
      from: brazilTimestamp(date(400)),
      to: brazilTimestamp(reference),
      previousFrom: null,
      previousTo: null,
    });
    expect(all.metrics.executions).toEqual({ value: 1, previousValue: null });
    expect(all.metrics.defects).toEqual({ value: 1, previousValue: null });
    expect(all.metrics.coverage.value).toBe(100);
    expect(all.metrics.activeTestCases.value).toBe(1);
    expect(
      Object.values(all.metrics).every(
        (m) => (m as { previousValue: unknown }).previousValue === null,
      ),
    ).toBe(true);
    expect(all.results).toEqual({
      NOT_TESTED: 0,
      PASSED: 0,
      FAILED: 1,
      BLOCKED: 0,
      SKIPPED: 0,
    });
    expect(all.defectsByStatus.RESOLVED).toBe(1);
    expect(all.activity.map((e: { id: string }) => e.id)).toContain(event);
    expect(all.projects).toHaveLength(10);
    const other = await setup(s.actor);
    const d = (
      await other
        .call('post', '/defects')
        .send({ title: 'Outro Workspace autorizado' })
        .expect(201)
    ).body.data;
    await store.client.defect.update({
      where: { id: d.id },
      data: { createdAt: date(500) },
    });
    const privateTenant = await setup();
    const pc = await privateTenant.testCase();
    await privateTenant.run([pc.id], date(900), ['PASSED'], date(900));
    const combined = (
      await s
        .requestTo('get', '/api/v1/dashboard/overview')
        .query({ days: 'ALL' })
        .expect(200)
    ).body.data;
    expect(combined.period.from).toBe(brazilTimestamp(date(500)));
    expect(combined.metrics.executions.value).toBe(1);
    expect(combined.metrics.defects.value).toBe(2);
    expect(JSON.stringify(combined)).not.toContain(privateTenant.ws.id);
    expect((await s.overview('ALL')).period.from).toBe(
      brazilTimestamp(date(400)),
    );
    await store.client.workspace.update({
      where: { id: other.ws.id },
      data: { status: 'ARCHIVED' },
    });
    expect(
      (
        await s
          .requestTo('get', '/api/v1/dashboard/overview')
          .query({ days: 'ALL' })
          .expect(200)
      ).body.data.period.from,
    ).toBe(brazilTimestamp(date(400)));
  });
  it('derives ALL boundaries only from currently readable sources before limits and removes them on revocation', async () => {
    const s = await setup();
    const c = await s.testCase();
    const r = await s.run([c.id], date(200), ['PASSED'], date(300));
    const hidden = await s.createProject('HIDHIST');
    const hiddenBase = `/api/v1/workspaces/${s.ws.id}/projects/${hidden.id}`;
    const hc = (
      await s
        .requestTo('post', `${hiddenBase}/test-cases`)
        .send({ title: 'Privado', status: 'ACTIVE' })
        .expect(201)
    ).body.data;
    const hr = (
      await s
        .requestTo('post', `${hiddenBase}/test-runs`)
        .send({ name: 'Privado', caseIds: [hc.id] })
        .expect(201)
    ).body.data;
    await store.client.testRun.update({
      where: { id: hr.id },
      data: { createdAt: date(900) },
    });
    const d = (
      await s
        .call('post', '/defects')
        .send({ title: 'Sem grant de defeitos' })
        .expect(201)
    ).body.data;
    await store.client.defect.update({
      where: { id: d.id },
      data: { createdAt: date(800) },
    });
    // Earliest allowed activity must be used even when omitted from the latest ten.
    for (let i = 0; i < 12; i++)
      await store.client.auditEvent.create({
        data: {
          id: randomUUID(),
          workspaceId: s.ws.id,
          actorUserId: s.actor.id,
          action: 'test.historical',
          entityType: 'TestRun',
          entityId: r.id,
          occurredAt: i === 0 ? date(400) : date(150),
          correlationId: randomUUID(),
        },
      });
    const who = await account();
    const wm = await grantParticipant(s, who);
    const memberRole = await store.client.role.findFirstOrThrow({
      where: {
        workspaceId: s.ws.id,
        normalizedName: 'member',
        systemRole: true,
      },
    });
    await s
      .requestTo(
        'delete',
        `/api/v1/workspaces/${s.ws.id}/members/${wm.id}/roles/${memberRole.id}`,
      )
      .send({})
      .expect(204);
    const role = (
      await s
        .requestTo('post', `/api/v1/workspaces/${s.ws.id}/roles`)
        .send({
          name: 'Somente histórico de execução',
          permissionCodes: ['testrun.read'],
        })
        .expect(201)
    ).body.data;
    await s
      .requestTo(
        'put',
        `/api/v1/workspaces/${s.ws.id}/members/${wm.id}/roles/${role.id}`,
      )
      .send({})
      .expect(204);
    const all = await s.overview('ALL', who);
    expect(all.period.from).toBe(brazilTimestamp(date(400)));
    expect(all.metrics.executions).toEqual({ value: 1, previousValue: null });
    expect(all.metrics.activeTestCases.value).toBeNull();
    expect(all.metrics.defects.value).toBeNull();
    expect(all.metrics.coverage.value).toBeNull();
    expect(all.projects).toBeNull();
    expect(all.activity).toHaveLength(10);
    expect(
      all.activity.every(
        (e: { occurredAt: string }) =>
          e.occurredAt === brazilTimestamp(date(150)),
      ),
    ).toBe(true);
    expect(JSON.stringify(all)).not.toContain(hidden.id);
    await s
      .requestTo('delete', `${s.base}/members/${wm.id}`)
      .send({})
      .expect(204);
    const revoked = await s.overview('ALL', who);
    expect(revoked.period.from).toBeNull();
    expect(revoked.metrics.executions).toEqual({
      value: 0,
      previousValue: null,
    });
    expect(revoked.activity).toEqual([]);
  });
  it('aggregates complete scopes and half-open UTC windows with distinct coverage and independent results', async () => {
    const s = await setup();
    const cases = [];
    for (let i = 0; i < 5; i++) cases.push(await s.testCase());
    await s.run([cases[0].id, cases[2].id, cases[3].id, cases[4].id], date(2), [
      'PASSED',
      'SKIPPED',
      'NOT_TESTED',
      'BLOCKED',
    ]);
    await s.run([cases[0].id], date(30), ['FAILED'], date(30));
    await s.run([cases[1].id], date(31), ['BLOCKED']);
    await s.run([cases[3].id], date(60), ['NOT_TESTED']);
    await s.run([cases[3].id], reference, ['NOT_TESTED']);
    await s.run([cases[3].id], date(60, -1), ['NOT_TESTED']);
    // Os snapshots nasceram de casos ACTIVE; o catálogo atual pode evoluir depois.
    await s
      .call('patch', `/test-cases/${cases[1].id}`)
      .send({ version: 1, status: 'DRAFT' })
      .expect(200);
    await s
      .call('patch', `/test-cases/${cases[2].id}`)
      .send({ version: 1, status: 'DEPRECATED' })
      .expect(200);
    await s
      .call('post', `/test-cases/${cases[4].id}/archive`)
      .send({ version: 1 })
      .expect(200);
    const q = await s.createProject('SECOND');
    const qBase = `/api/v1/workspaces/${s.ws.id}/projects/${q.id}`;
    const qc = (
      await s
        .requestTo('post', `${qBase}/test-cases`)
        .send({ title: 'Segundo catálogo', status: 'ACTIVE' })
        .expect(201)
    ).body.data;
    const qr = (
      await s
        .requestTo('post', `${qBase}/test-runs`)
        .send({ name: 'Segundo run', caseIds: [qc.id] })
        .expect(201)
    ).body.data;
    await store.client.testRun.update({
      where: { id: qr.id },
      data: { createdAt: date(3), status: 'ABORTED', finishedAt: date(1) },
    });
    await store.client.testRunCase.updateMany({
      where: { testRunId: qr.id },
      data: { result: 'PASSED', executedAt: date(30), executedBy: s.actor.id },
    });
    const statuses = [
      'OPEN',
      'IN_PROGRESS',
      'RESOLVED',
      'CLOSED',
      'REJECTED',
    ] as const;
    for (const [i, status] of statuses.entries()) {
      const d = (
        await s
          .call('post', '/defects')
          .send({ title: 'Defeito do período' })
          .expect(201)
      ).body.data;
      await store.client.defect.update({
        where: { id: d.id },
        data: { status, createdAt: i === 0 ? date(30) : date(2) },
      });
    }
    for (const createdAt of [date(60), date(30, -1), reference, date(60, -1)]) {
      const d = (
        await s
          .call('post', '/defects')
          .send({ title: 'Limite do período' })
          .expect(201)
      ).body.data;
      await store.client.defect.update({
        where: { id: d.id },
        data: { createdAt },
      });
    }
    for (let i = 0; i < 11; i++) await s.createProject(`EMPTY${i}`);
    const archived = await s.createProject('ARCHIVED');
    await s
      .requestTo(
        'post',
        `/api/v1/workspaces/${s.ws.id}/projects/${archived.id}/test-cases`,
      )
      .send({ title: 'Oculto operacional' })
      .expect(201);
    await s
      .requestTo(
        'post',
        `/api/v1/workspaces/${s.ws.id}/projects/${archived.id}/archive`,
      )
      .send({})
      .expect(200);
    await store.client.project.updateMany({
      where: { workspaceId: s.ws.id },
      data: { updatedAt: date(1) },
    });
    const result = await s.overview();
    expect(result.metrics).toEqual({
      testCases: { value: 5, previousValue: null },
      activeTestCases: { value: 3, previousValue: null },
      executions: { value: 3, previousValue: 2 },
      defects: { value: 5, previousValue: 2 },
      coverage: { value: 75, previousValue: null },
      automationCoverage: { value: 0, previousValue: null },
    });
    expect(result.results).toEqual({
      NOT_TESTED: 1,
      PASSED: 2,
      FAILED: 1,
      BLOCKED: 1,
      SKIPPED: 1,
    });
    expect(result.defectsByStatus).toEqual({
      OPEN: 1,
      IN_PROGRESS: 1,
      RESOLVED: 1,
      CLOSED: 1,
      REJECTED: 1,
    });
    expect(result.projects).toHaveLength(10);
    const expectedProjects = await store.client.project.findMany({
      where: { workspaceId: s.ws.id, status: 'ACTIVE' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 10,
    });
    expect(result.projects.map((p: { id: string }) => p.id)).toEqual(
      expectedProjects.map((p) => p.id),
    );
    await store.client.project.update({
      where: { id: s.p.id },
      data: { updatedAt: reference },
    });
    const p = (await s.overview()).projects.find(
      (p: { id: string }) => p.id === s.p.id,
    );
    expect(p).toMatchObject({ progress: 80, coverage: 50 });
    const secondWorkspace = await setup(s.actor);
    await secondWorkspace.testCase();
    const consolidated = (
      await http()
        .get('/api/v1/dashboard/overview')
        .set('Authorization', auth(s.actor))
        .expect(200)
    ).body.data;
    expect(consolidated.metrics.testCases.value).toBe(6);
    expect(consolidated.metrics.coverage.value).toBe(50); // (50 + 100 + 0) / 3; simple mean.
    await store.client.workspace.update({
      where: { id: secondWorkspace.ws.id },
      data: { status: 'ARCHIVED' },
    });
    expect(
      (
        await http()
          .get('/api/v1/dashboard/overview')
          .set('Authorization', auth(s.actor))
          .expect(200)
      ).body.data.metrics.testCases.value,
    ).toBe(5);
    await http()
      .get('/api/v1/dashboard/overview')
      .set('Authorization', auth(s.actor))
      .query({ workspaceId: secondWorkspace.ws.id })
      .expect(404);
    expect((await s.overview(7)).metrics.executions).toEqual({
      value: 2,
      previousValue: 0,
    });
    expect((await s.overview(90)).metrics.executions).toEqual({
      value: 6,
      previousValue: 0,
    });
  });
  it('filters hidden projects and mixed grants and applies revocations without leaking source results', async () => {
    const s = await setup();
    await s.testCase();
    const visible = await s.testCase();
    await store.client.testCase.update({
      where: { id: visible.id },
      data: { automationStatus: 'AUTOMATED' },
    });
    await s.run([visible.id], date(1), ['PASSED']);
    const hidden = await s.createProject('PRIVATE');
    const hiddenBase = `/api/v1/workspaces/${s.ws.id}/projects/${hidden.id}`;
    await s
      .requestTo('post', `${hiddenBase}/test-cases`)
      .send({
        title: 'Nome privado jamais exposto',
        status: 'ACTIVE',
        automationStatus: 'AUTOMATED',
      })
      .expect(201);
    const who = await account();
    const wm = await grantParticipant(s, who);
    const memberRole = await store.client.role.findFirstOrThrow({
      where: {
        workspaceId: s.ws.id,
        normalizedName: 'member',
        systemRole: true,
      },
    });
    await s
      .requestTo(
        'delete',
        `/api/v1/workspaces/${s.ws.id}/members/${wm.id}/roles/${memberRole.id}`,
      )
      .send({})
      .expect(204);
    const role = (
      await s
        .requestTo('post', `/api/v1/workspaces/${s.ws.id}/roles`)
        .send({
          name: 'Painel parcial',
          permissionCodes: [
            'project.read',
            'testcase.read',
            'governance.read',
            'attachment.read',
          ],
        })
        .expect(201)
    ).body.data;
    await s
      .requestTo(
        'put',
        `/api/v1/workspaces/${s.ws.id}/members/${wm.id}/roles/${role.id}`,
      )
      .send({})
      .expect(204);
    const gov = `/api/v1/workspaces/${s.ws.id}/governance`;
    const createGoal = async (body: Record<string, unknown>) =>
      (
        await s
          .requestTo('post', `${gov}/goals`)
          .send({
            name: 'Meta',
            goalType: 'AUTOMATION_COVERAGE',
            operator: 'GTE',
            targetValue: 80,
            ...body,
          })
          .expect(201)
      ).body.data;
    const allowedGoal = await createGoal({
      projectId: s.p.id,
      name: 'Visível',
      deadline: '2027-01-01',
    });
    const privateGoal = await createGoal({
      projectId: hidden.id,
      name: 'Privada',
    });
    for (let i = 0; i < 7; i++)
      await createGoal({
        projectId: hidden.id,
        name: `Privada anterior ${i}`,
        deadline: '2026-10-01',
      });
    const workspaceGoal = await createGoal({
      name: 'Total de fontes privadas',
    });
    await createGoal({
      projectId: s.p.id,
      name: 'Sem grant de defeitos',
      goalType: 'CRITICAL_DEFECTS',
      operator: 'LTE',
      targetValue: 0,
    });
    let result = await s.overview(30, who);
    expect(result.metrics.activeTestCases.value).toBe(2);
    expect(result.metrics.testCases.value).toBe(2);
    expect(result.metrics.automationCoverage).toEqual({
      value: 50,
      previousValue: null,
    });
    expect(result.metrics.executions).toEqual({
      value: null,
      previousValue: null,
    });
    expect(result.metrics.defects).toEqual({
      value: null,
      previousValue: null,
    });
    expect(result.results).toBeNull();
    expect(result.defectsByStatus).toBeNull();
    expect(result.projects).toEqual([
      expect.objectContaining({
        id: s.p.id,
        progress: null,
        coverage: null,
        activeTestCases: 2,
        automationCoverage: 50,
      }),
    ]);
    expect(result.governance.map((g: { id: string }) => g.id)).toEqual([
      allowedGoal.id,
    ]);
    expect(JSON.stringify(result)).not.toContain(hidden.id);
    expect(JSON.stringify(result)).not.toContain(privateGoal.id);
    expect(
      result.activity.every(
        (a: { target: { module: string } }) =>
          a.target.module !== 'EXECUTION' && a.target.module !== 'DEFECTS',
      ),
    ).toBe(true);
    await s
      .requestTo('patch', `/api/v1/workspaces/${s.ws.id}/roles/${role.id}`)
      .send({ permissionCodes: ['testcase.read'] })
      .expect(200);
    const casesOnly = await s.overview(30, who);
    expect(casesOnly.metrics.activeTestCases.value).toBe(2);
    expect(casesOnly.projects).toBeNull();
    expect(casesOnly.metrics.automationCoverage).toEqual({
      value: 50,
      previousValue: null,
    });
    expect(casesOnly.metrics.executions.value).toBeNull();
    await s
      .requestTo('patch', `/api/v1/workspaces/${s.ws.id}/roles/${role.id}`)
      .send({
        permissionCodes: [
          'project.read',
          'testcase.read',
          'governance.read',
          'attachment.read',
        ],
      })
      .expect(200);
    const runRole = (
      await s
        .requestTo('post', `/api/v1/workspaces/${s.ws.id}/roles`)
        .send({
          name: 'Leitura de execuções',
          permissionCodes: ['testrun.read'],
        })
        .expect(201)
    ).body.data;
    await s
      .requestTo(
        'put',
        `/api/v1/workspaces/${s.ws.id}/members/${wm.id}/roles/${runRole.id}`,
      )
      .send({})
      .expect(204);
    result = await s.overview(30, who);
    expect(result.metrics.executions.value).toBe(1);
    expect(result.metrics.coverage.value).toBe(50);
    expect(result.projects[0]).toMatchObject({ progress: 100, coverage: 50 });
    await s.requestTo('post', `${hiddenBase}/archive`).send({}).expect(200);
    await store.client.governanceGoal.update({
      where: { id: workspaceGoal.id },
      data: {
        lastResult: {
          value: 50,
          numerator: 1,
          denominator: 2,
          calculatedAt: date(2).toISOString(),
          sourceIds: [s.p.id, hidden.id],
        },
      },
    });
    expect(
      (await s.overview(30, who)).governance.map((g: { id: string }) => g.id),
    ).toEqual([allowedGoal.id]);
    await s
      .requestTo(
        'delete',
        `/api/v1/workspaces/${s.ws.id}/members/${wm.id}/roles/${role.id}`,
      )
      .send({})
      .expect(204);
    result = await s.overview(30, who);
    expect(result.metrics.testCases.value).toBeNull();
    expect(result.metrics.automationCoverage.value).toBeNull();
    const projectOnly = (
      await s
        .requestTo('post', `/api/v1/workspaces/${s.ws.id}/roles`)
        .send({ name: 'Apenas projetos', permissionCodes: ['project.read'] })
        .expect(201)
    ).body.data;
    await s
      .requestTo(
        'put',
        `/api/v1/workspaces/${s.ws.id}/members/${wm.id}/roles/${projectOnly.id}`,
      )
      .send({})
      .expect(204);
    const visibleWithoutCases = await s.overview(30, who);
    expect(visibleWithoutCases.projects[0]).toMatchObject({
      id: s.p.id,
      activeTestCases: null,
      automationCoverage: null,
    });
    expect(visibleWithoutCases.metrics.activeTestCases.value).toBeNull();
    expect(visibleWithoutCases.metrics.automationCoverage.value).toBeNull();
    await s
      .requestTo(
        'delete',
        `/api/v1/workspaces/${s.ws.id}/members/${wm.id}/roles/${projectOnly.id}`,
      )
      .send({})
      .expect(204);
    expect(result.metrics.executions.value).toBe(1);
    expect(result.metrics.coverage.value).toBeNull();
    expect(result.projects).toBeNull();
    expect(result.governance).toBeNull();
    expect(result.documents).toBeNull();
    await s
      .requestTo(
        'delete',
        `/api/v1/workspaces/${s.ws.id}/members/${wm.id}/roles/${runRole.id}`,
      )
      .send({})
      .expect(204);
    const withoutSources = await s.overview(30, who);
    expect(withoutSources.metrics).toEqual({
      testCases: { value: null, previousValue: null },
      activeTestCases: { value: null, previousValue: null },
      executions: { value: null, previousValue: null },
      defects: { value: null, previousValue: null },
      coverage: { value: null, previousValue: null },
      automationCoverage: { value: null, previousValue: null },
    });
    for (const block of [
      'results',
      'defectsByStatus',
      'projects',
      'governance',
      'activity',
      'documents',
    ])
      expect(withoutSources[block]).toBeNull();
    await s
      .requestTo(
        'put',
        `/api/v1/workspaces/${s.ws.id}/members/${wm.id}/roles/${runRole.id}`,
      )
      .send({})
      .expect(204);
    await s
      .requestTo('delete', `${s.base}/members/${wm.id}`)
      .send({})
      .expect(204);
    result = await s.overview(30, who);
    expect(result.metrics.executions.value).toBe(0);
    expect(result.results).toEqual({
      NOT_TESTED: 0,
      PASSED: 0,
      FAILED: 0,
      BLOCKED: 0,
      SKIPPED: 0,
    });
    expect(result.activity).toEqual([]);
    await s
      .requestTo('delete', `/api/v1/workspaces/${s.ws.id}/members/${wm.id}`)
      .send({})
      .expect(204);
    await s
      .requestTo('get', '/api/v1/dashboard/overview', who)
      .query({ workspaceId: s.ws.id })
      .expect(404);
    expect(
      (await s.requestTo('get', '/api/v1/dashboard/overview', who).expect(200))
        .body.data.metrics.executions.value,
    ).toBeNull();
    await s
      .requestTo('get', '/api/v1/dashboard/overview', otherOwner)
      .query({ workspaceId: s.ws.id })
      .expect(404);
  });
  it('reads persisted goals without recalculation and orders statuses and deadlines before the global limit', async () => {
    const s = await setup();
    const base = `/api/v1/workspaces/${s.ws.id}/governance`;
    const framework = (
      await s
        .requestTo('post', `${base}/frameworks`)
        .send({ code: 'REF', name: 'Política interna', versionLabel: '1' })
        .expect(201)
    ).body.data;
    const goals = [];
    for (let i = 0; i < 9; i++) {
      const goal = (
        await s
          .requestTo('post', `${base}/goals`)
          .send({
            name: `Meta ${i}`,
            goalType: 'GOVERNANCE_SCORE',
            frameworkId: framework.id,
            operator: i === 1 ? 'LTE' : 'GTE',
            targetValue: 80,
            deadline:
              i === 5 ? null : `2027-01-${String(i + 1).padStart(2, '0')}`,
          })
          .expect(201)
      ).body.data;
      const status =
        i < 6
          ? 'ACTIVE'
          : i === 6
            ? 'ACHIEVED'
            : i === 7
              ? 'MISSED'
              : 'CANCELLED';
      await store.client.governanceGoal.update({
        where: { id: goal.id },
        data: {
          status,
          lastResult:
            i === 2
              ? undefined
              : {
                  value: i === 0 ? 120 : 40,
                  numerator: 1,
                  denominator: 2,
                  calculatedAt: date(3).toISOString(),
                  sourceIds: [],
                },
        },
      });
      goals.push(goal);
    }
    const before = await store.client.governanceGoal.findMany({
      where: { workspaceId: s.ws.id },
      orderBy: { id: 'asc' },
    });
    const auditBefore = await store.client.auditEvent.count({
      where: { workspaceId: s.ws.id },
    });
    const result = await s.overview();
    expect(result.governance.map((g: { id: string }) => g.id)).toEqual(
      [...goals.slice(0, 5), goals[6]].map((g) => g.id),
    );
    expect(result.governance[0]).toMatchObject({
      progress: null,
      frameworkName: 'Política interna',
      status: 'ACTIVE',
    });
    expect(result.governance[1].progress).toBeNull();
    expect(result.governance[2]).toMatchObject({
      progress: null,
      detail: 'Nenhuma ação válida vinculada.',
    });
    expect(result.governance[3].progress).toBeNull();
    expect(result.governance[0].detail).toBe('Nenhuma ação válida vinculada.');
    expect(
      await store.client.governanceGoal.findMany({
        where: { workspaceId: s.ws.id },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(before);
    expect(
      await store.client.auditEvent.count({ where: { workspaceId: s.ws.id } }),
    ).toBe(auditBefore);
    const allPeriod = await s.overview('ALL');
    expect(allPeriod.governance).toEqual(result.governance);
    expect(allPeriod.frameworkGovernance).toEqual(result.frameworkGovernance);
    await store.client.governanceGoal.updateMany({
      where: { workspaceId: s.ws.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });
    const remaining = (await s.overview()).governance;
    expect(remaining.map((g: { id: string }) => g.id)).toEqual([
      goals[6].id,
      goals[7].id,
    ]);
    const crossWorkspace = await setup(s.actor);
    const more = await crossWorkspace.overview();
    expect(more.governance).toEqual([]);
    const all = (
      await s.requestTo('get', '/api/v1/dashboard/overview').expect(200)
    ).body.data;
    expect(all.governance).toHaveLength(2);
  });
  it('aggregates inventories beyond catalog pagination with every execution status and no per-case loading', async () => {
    const s = await setup();
    const seed = await s.testCase();
    const template = await store.client.testCase.findUniqueOrThrow({
      where: { id: seed.id },
    });
    const caseIds = [seed.id];
    const newCases = Array.from({ length: 150 }, (_, i) => {
      const id = randomUUID();
      caseIds.push(id);
      return { ...template, id, sequence: 100 + i };
    });
    await store.client.testCase.createMany({ data: newCases });
    const run = await s.run([seed.id], date(1), ['FAILED']);
    const copy = await store.client.testRunCase.findFirstOrThrow({
      where: { testRunId: run.id },
    });
    await store.client.testRunCase.createMany({
      data: caseIds.slice(1).map((testCaseId, i) => ({
        ...copy,
        definitionSnapshot: copy.definitionSnapshot as Prisma.InputJsonValue,
        customFieldsSnapshot:
          copy.customFieldsSnapshot as Prisma.InputJsonValue,
        tagsSnapshot: copy.tagsSnapshot as Prisma.InputJsonValue,
        externalResult: copy.externalResult === null ? Prisma.DbNull : copy.externalResult as Prisma.InputJsonValue,
        id: randomUUID(),
        testCaseId,
        position: i + 2,
        result: (i + 1) % 3 === 0 ? 'FAILED' : 'NOT_TESTED',
        executedAt: (i + 1) % 3 === 0 ? date(1) : null,
        executedBy: (i + 1) % 3 === 0 ? s.actor.id : null,
      })),
    });
    for (const status of ['IN_PROGRESS', 'COMPLETED', 'ABORTED']) {
      const r = await s.run([seed.id], date(1), ['FAILED']);
      await store.client.testRun.update({
        where: { id: r.id },
        data: {
          status,
          startedAt: date(1),
          finishedAt: status === 'IN_PROGRESS' ? null : date(1),
        },
      });
    }
    const defect = (
      await s
        .call('post', '/defects')
        .send({ title: 'Contagem completa' })
        .expect(201)
    ).body.data;
    await store.client.defect.update({
      where: { id: defect.id },
      data: { createdAt: date(1) },
    });
    const defectTemplate = await store.client.defect.findUniqueOrThrow({
      where: { id: defect.id },
    });
    await store.client.defect.createMany({
      data: Array.from({ length: 150 }, (_, i) => ({
        ...defectTemplate,
        environmentSnapshot: undefined,
        id: randomUUID(),
        sequence: 100 + i,
        createdAt: date(1),
      })),
    });
    const result = await s.overview();
    expect(result.metrics.testCases.value).toBe(151);
    expect(result.metrics.executions.value).toBe(4);
    expect(result.metrics.defects.value).toBe(151);
    expect(result.results).toEqual({
      NOT_TESTED: 100,
      PASSED: 0,
      FAILED: 54,
      BLOCKED: 0,
      SKIPPED: 0,
    });
    expect(result.defectsByStatus.OPEN).toBe(151);
    expect(result.metrics.coverage.value).toBe(33.77);
    expect(result.projects[0]).toMatchObject({
      coverage: 33.77,
      progress: 35.06,
    });
    const indices = await store.client.$queryRaw<
      { name: string }[]
    >`SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME IN ('test_runs_dashboard_period_idx','run_cases_dashboard_coverage_idx','defects_dashboard_period_idx')`;
    expect(indices).toHaveLength(3);
  });
  it('returns Problem Details when consolidation fails instead of successful partial zeros', async () => {
    const s = await setup();
    await s.testCase();
    await setup(s.actor);
    const original = store.transaction.bind(store);
    const spy = vi
      .spyOn(store, 'transaction')
      .mockImplementationOnce((ws, work) => original(ws, work))
      .mockRejectedValueOnce(
        new ApplicationError(503, 'SERVICE_UNAVAILABLE', 'Fonte indisponível.'),
      );
    try {
      const response = await s
        .requestTo('get', '/api/v1/dashboard/overview')
        .expect(503);
      expect(response.type).toBe('application/problem+json');
      expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
      expect(response.body).not.toHaveProperty('data');
    } finally {
      spy.mockRestore();
    }
  });
  it('returns only real authorized audit events and available documents with safe targets and bounded lists', async () => {
    const s = await setup();
    const c = await s.testCase();
    const docs = [];
    for (let i = 0; i < 8; i++) {
      const d = (
        await s
          .requestTo('post', `/api/v1/workspaces/${s.ws.id}/attachments`)
          .attach('file', Buffer.from('Documento'), `referencia-${i}.txt`)
          .expect(201)
      ).body.data;
      await store.client.attachment.update({
        where: { id: d.id },
        data: { createdAt: date(2), deletedAt: i === 7 ? date(1) : null },
      });
      docs.push(d);
    }
    await store.client.auditEvent.updateMany({
      where: { workspaceId: s.ws.id },
      data: { occurredAt: date(31) },
    });
    const events = [];
    for (let i = 0; i < 14; i++) {
      const id = randomUUID();
      await store.client.auditEvent.create({
        data: {
          id,
          workspaceId: s.ws.id,
          actorUserId: owner.id,
          action: 'test.case_updated',
          entityType: 'TestCase',
          entityId: c.id,
          occurredAt: date(1),
          correlationId: randomUUID(),
        },
      });
      events.push(id);
    }
    const excluded = [];
    for (const [entityType, entityId, occurredAt] of [
      ['TestCase', c.id, reference],
      ['TestCase', c.id, date(30, -1)],
      ['WorkspaceMember', s.ws.ownerMemberId, date(1)],
      ['Attachment', docs[7].id, date(1)],
      ['TestCase', randomUUID(), date(1)],
    ] as const) {
      const id = randomUUID();
      excluded.push(id);
      await store.client.auditEvent.create({
        data: {
          id,
          workspaceId: s.ws.id,
          actorUserId: owner.id,
          action: 'private.event',
          entityType,
          entityId,
          occurredAt,
          correlationId: randomUUID(),
        },
      });
    }
    const result = await s.overview();
    expect(result.activity.map((e: { id: string }) => e.id)).toEqual(
      events.sort().slice(0, 10),
    );
    expect(
      result.activity.every(
        (e: { target: unknown; title: string; context: string }) =>
          JSON.stringify(e.target) ===
            JSON.stringify({
              module: 'TEST_CASES',
              workspaceId: s.ws.id,
              projectId: s.p.id,
            }) &&
          e.title.length <= 250 &&
          e.context.length <= 250,
      ),
    ).toBe(true);
    const expectedDocs = docs
      .slice(0, 7)
      .map((d) => d.id)
      .sort()
      .slice(0, 6);
    expect(result.documents.map((d: { id: string }) => d.id)).toEqual(
      expectedDocs,
    );
    expect(
      result.documents.every(
        (d: { versionLabel: unknown; updatedAt: string }) =>
          d.versionLabel === null && d.updatedAt === brazilTimestamp(date(2)),
      ),
    ).toBe(true);
    const all = await s.overview('ALL');
    expect(all.activity).toEqual(result.activity);
    expect(all.documents).toEqual(result.documents);
    expect(all.period.from).toBe(brazilTimestamp(date(31)));
    const serialized = JSON.stringify(result);
    for (const id of excluded) expect(serialized).not.toContain(id);
    for (const value of [
      owner.email,
      s.actor.email,
      'storageKey',
      'checksum',
      'uploadedBy',
      'actorUserId',
      'externalUrl',
      'tokenHash',
    ])
      expect(serialized).not.toContain(value);
    await store.client.testCase.update({
      where: { id: c.id },
      data: { updatedAt: reference },
    });
    expect(
      (await s.overview()).activity.map((e: { id: string }) => e.id),
    ).toEqual(result.activity.map((e: { id: string }) => e.id));
    const who = await account();
    const wm = await grantParticipant(s, who);
    expect((await s.overview(30, who)).activity).toHaveLength(10);
    await s
      .requestTo('delete', `${s.base}/members/${wm.id}`)
      .send({})
      .expect(204);
    expect((await s.overview(30, who)).activity).toEqual([]);
  });
});

describe('Defect environments and monthly analytics with MySQL/MariaDB', () => {
  async function setup() {
    const ws = await workspace(),
      p = await project(ws.id);
    const base = `/api/v1/workspaces/${ws.id}/projects/${p.id}`;
    const call = (
      method: 'get' | 'post' | 'patch' | 'put' | 'delete',
      path: string,
      account = owner,
    ) => http()[method](`${base}${path}`).set('Authorization', auth(account));
    const analytics = (account = owner) =>
      http()
        .get(`/api/v1/workspaces/${ws.id}/defects/analytics`)
        .set('Authorization', auth(account));
    const env = async (name: string, category: string) =>
      (await call('post', '/environments').send({ name, category }).expect(201))
        .body.data;
    return { ws, p, base, call, analytics, env };
  }
  it('associates scoped active environments, preserves snapshots and supports explicit removal', async () => {
    const s = await setup(),
      other = await setup(),
      env = await s.env('Produção', 'PRODUCTION'),
      foreign = await other.env('Hml', 'HOMOLOGATION');
    let d = (
      await s
        .call('post', '/defects')
        .send({ title: 'Bug em produção', environmentId: env.id })
        .expect(201)
    ).body.data;
    expect(d.environmentSnapshot).toEqual({
      name: 'Produção',
      category: 'PRODUCTION',
    });
    await s
      .call('patch', `/environments/${env.id}`)
      .send({ name: 'Produção renomeada', category: 'OTHER', active: false })
      .expect(200);
    expect(
      (await s.call('get', `/defects/${d.id}`).expect(200)).body.data
        .environmentSnapshot,
    ).toEqual(d.environmentSnapshot);
    await s
      .call('post', '/defects')
      .send({ title: 'Inativo', environmentId: env.id })
      .expect(404);
    await s
      .call('post', '/defects')
      .send({ title: 'Estrangeiro', environmentId: foreign.id })
      .expect(404);
    await s
      .call('patch', `/defects/${d.id}`)
      .send({ version: d.version, environmentId: foreign.id })
      .expect(404);
    await s
      .call('patch', `/defects/${d.id}`)
      .send({ version: d.version + 1, environmentId: null })
      .expect(409);
    expect(
      (
        await s
          .call('get', '/defects')
          .query({ environmentId: env.id })
          .expect(200)
      ).body.data,
    ).toHaveLength(1);
    d = (
      await s
        .call('patch', `/defects/${d.id}`)
        .send({ version: d.version, environmentId: null })
        .expect(200)
    ).body.data;
    expect(d).toMatchObject({ environmentId: null, environmentSnapshot: null });
    await expect(
      store.client.defect.update({
        where: { id: d.id },
        data: { environmentId: foreign.id },
      }),
    ).rejects.toThrow();
    const legacy = await store.client.defect.findUniqueOrThrow({
      where: { id: upgradeDefect },
    });
    expect(legacy).toMatchObject({
      environmentId: null,
      environmentSnapshot: null,
    });
    await s
      .call('post', '/environments')
      .send({ name: 'Inválido', category: 'STAGING' })
      .expect(400);
    await s
      .call('post', '/defects')
      .send({ title: 'Inválido', environmentId: 'invalid' })
      .expect(400);
  });
  it('inherits the failed run environment when omitted and respects explicit null/override', async () => {
    const s = await setup(),
      env = await s.env('Homologação', 'HOMOLOGATION'),
      prod = await s.env('Produção', 'PRODUCTION');
    const c = (
      await s
        .call('post', '/test-cases')
        .send({ title: 'Falha', status: 'ACTIVE' })
        .expect(201)
    ).body.data;
    const r = (
      await s
        .call('post', '/test-runs')
        .send({ name: 'Execução', caseIds: [c.id], environmentId: env.id })
        .expect(201)
    ).body.data;
    const item = await store.client.testRunCase.findFirstOrThrow({
      where: { workspaceId: s.ws.id, testRunId: r.id },
    });
    await store.client.testRunCase.update({
      where: { id: item.id },
      data: { result: 'FAILED', executedAt: new Date(), executedBy: owner.id },
    });
    await s.call('delete', `/environments/${env.id}`).expect(204);
    const d = (
      await s
        .call('post', '/defects/from-failure')
        .send({ testRunCaseId: item.id })
        .expect(201)
    ).body.data;
    expect(d).toMatchObject({
      environmentId: env.id,
      environmentSnapshot: { name: 'Homologação', category: 'HOMOLOGATION' },
    });
    const none = (
      await s
        .call('post', '/defects/from-failure')
        .send({ testRunCaseId: item.id, environmentId: null })
        .expect(201)
    ).body.data;
    expect(none.environmentId).toBeNull();
    const override = (
      await s
        .call('post', '/defects')
        .send({
          title: 'Ambiente informado',
          testRunCaseId: item.id,
          environmentId: prod.id,
        })
        .expect(201)
    ).body.data;
    expect(override.environmentId).toBe(prod.id);
  });
  it('returns chart counts by UTC month, project and snapshot category without pagination or cross-tenant data', async () => {
    const s = await setup(),
      other = await setup();
    const prod = await s.env('Produção', 'PRODUCTION'),
      hml = await s.env('Homologação', 'HOMOLOGATION');
    const p2 = await project(s.ws.id, 'SECOND');
    const hml2 = (
      await http()
        .post(`/api/v1/workspaces/${s.ws.id}/projects/${p2.id}/environments`)
        .set('Authorization', auth(owner))
        .send({ name: 'HML segundo', category: 'HOMOLOGATION' })
        .expect(201)
    ).body.data;
    const fixtures = [
      [s.p.id, prod.id, '2026-09-01T00:00:00.000Z', 'OPEN'],
      [s.p.id, hml.id, '2026-09-30T23:59:59.999Z', 'IN_PROGRESS'],
      [s.p.id, null, '2026-09-15T00:00:00.000Z', 'RESOLVED'],
      [s.p.id, prod.id, '2026-08-31T23:59:59.999Z', 'CLOSED'],
      [p2.id, hml2.id, '2026-09-12T00:00:00.000Z', 'CLOSED'],
      [s.p.id, prod.id, '2026-10-01T00:00:00.000Z', 'REJECTED'],
    ];
    for (const [pid, environmentId, createdAt, status] of fixtures) {
      const d = (
        await http()
          .post(`/api/v1/workspaces/${s.ws.id}/projects/${pid}/defects`)
          .set('Authorization', auth(owner))
          .send({ title: 'Bug', environmentId })
          .expect(201)
      ).body.data;
      await store.client.defect.update({
        where: { id: d.id },
        data: { createdAt: new Date(createdAt!), status: status! },
      });
    }
    await other
      .call('post', '/defects')
      .send({ title: 'Outro tenant' })
      .expect(201);
    const auditBefore = await store.client.auditEvent.count({
      where: { workspaceId: s.ws.id },
    });
    const report = await s
      .analytics()
      .query({ from: '2026-09-01', to: '2026-09-30' })
      .expect(200);
    expect(report.headers['cache-control']).toBe('no-store');
    expect(report.body.data).toMatchObject({
      totalBugs: 4,
      byStatus: {
        OPEN: 1,
        IN_PROGRESS: 1,
        RESOLVED: 1,
        CLOSED: 1,
        REJECTED: 0,
      },
      byCategory: { PRODUCTION: 1, HOMOLOGATION: 2, OTHER: 0, UNSPECIFIED: 1 },
    });
    expect(report.body.data.byProject).toHaveLength(2);
    expect(
      report.body.data.byProject.find(
        (p: { projectId: string }) => p.projectId === p2.id,
      ),
    ).toMatchObject({ totalBugs: 1, byCategory: { HOMOLOGATION: 1 } });
    expect(report.body.data.byEnvironment).toHaveLength(4);
    const filtered = (
      await s
        .analytics()
        .query({
          from: '2026-09-01',
          to: '2026-09-30',
          category: 'HOMOLOGATION',
        })
        .expect(200)
    ).body.data;
    expect(filtered.totalBugs).toBe(2);
    await s
      .call('patch', `/environments/${prod.id}`)
      .send({ category: 'OTHER', name: 'Alterada' })
      .expect(200);
    const history = (
      await s
        .analytics()
        .query({ from: '2026-08-01', to: '2026-11-30' })
        .expect(200)
    ).body.data;
    expect(history.byCategory.PRODUCTION).toBe(3);
    expect(
      history.monthly.map((m: { totalBugs: number }) => m.totalBugs),
    ).toEqual([1, 4, 1, 0]);
    await http()
      .post(`/api/v1/workspaces/${s.ws.id}/projects/${p2.id}/archive`)
      .set('Authorization', auth(owner))
      .send({})
      .expect(200);
    expect(
      (
        await s
          .analytics()
          .query({ from: '2026-09-01', to: '2026-09-30' })
          .expect(200)
      ).body.data.totalBugs,
    ).toBe(4);
    expect(
      (
        await s
          .analytics()
          .query({ from: '2026-09-01', to: '2026-09-30', projectId: s.p.id })
          .expect(200)
      ).body.data.totalBugs,
    ).toBe(3);
    await s
      .analytics()
      .query({ from: '2026-09-01', to: '2026-09-30', projectId: other.p.id })
      .expect(404);
    await s
      .analytics(otherOwner)
      .query({ from: '2026-09-01', to: '2026-09-30' })
      .expect(404);
    await s
      .analytics()
      .query({ from: '2026-02-30', to: '2026-09-30' })
      .expect(400);
    await s
      .analytics()
      .query({ from: '2026-10-01', to: '2026-09-30' })
      .expect(400);
    await s
      .analytics()
      .query({ from: '2023-01-01', to: '2026-09-30' })
      .expect(400);
    await s
      .analytics()
      .query({ from: '2026-09-01', to: '2026-09-30', page: 1 })
      .expect(400);
    await s
      .analytics()
      .query({ from: '2026-09-01', to: '2026-09-30', projectId: 'invalid' })
      .expect(400);
    await http()
      .get(
        `/api/v1/workspaces/${s.ws.id}/defects/analytics?from=2026-09-01&from=2026-09-02&to=2026-09-30`,
      )
      .set('Authorization', auth(owner))
      .expect(400);
    await http()
      .get(`/api/v1/workspaces/${s.ws.id}/defects/analytics`)
      .query({ from: '2026-09-01', to: '2026-09-30' })
      .expect(401);
    // GET calls did not create audit entries; only explicit environment/archive mutations did.
    expect(
      await store.client.auditEvent.count({ where: { workspaceId: s.ws.id } }),
    ).toBe(auditBefore + 2);
  });
  it('filters report sources by current project participation and revoked workspace grants', async () => {
    const s = await setup(),
      p2 = await project(s.ws.id, 'HIDDEN');
    await s.call('post', '/defects').send({ title: 'Visível' }).expect(201);
    await http()
      .post(`/api/v1/workspaces/${s.ws.id}/projects/${p2.id}/defects`)
      .set('Authorization', auth(owner))
      .send({ title: 'Oculto' })
      .expect(201);
    const wm = await join(s.ws.id, member);
    await http()
      .put(`/api/v1/workspaces/${s.ws.id}/projects/${s.p.id}/members/${wm.id}`)
      .set('Authorization', auth(owner))
      .send({ projectRole: 'VIEWER' })
      .expect(200);
    const day = new Date().toISOString().slice(0, 10);
    const report = (
      await s.analytics(member).query({ from: day, to: day }).expect(200)
    ).body.data;
    expect(report.totalBugs).toBe(1);
    expect(report.byProject).toHaveLength(1);
    expect(JSON.stringify(report)).not.toContain(p2.id);
    await s
      .analytics(member)
      .query({ from: day, to: day, projectId: p2.id })
      .expect(404);
    await store.client.memberRole.deleteMany({
      where: { workspaceId: s.ws.id, memberId: wm.id },
    });
    await s.analytics(member).query({ from: day, to: day }).expect(403);
    await store.client.workspaceMember.update({
      where: { id: wm.id },
      data: { status: 'REMOVED' },
    });
    await s.analytics(member).query({ from: day, to: day }).expect(404);
  });
});

// Escopos próprios para não alterar fixtures das fases anteriores.
describe('Product improvements: Azure CSV, encrypted vault, global defects and control creation order',()=>{
  const sample=readFileSync('test/fixtures/azure-test-cases.csv');
  it('imports all sample cases without a suite, preserves BDD, retries idempotently and isolates projects',async()=>{
    const ws=await workspace(),p=await project(ws.id,'IMPORT');
    const base=projectPath(ws.id,p.id),url=`${base}/test-cases/import/azure-devops`;
    const first=(await http().post(url).set('Authorization',auth(owner)).attach('file',sample,'azure.csv').expect(200)).body;
    expect(first.data.importedCount).toBe(5);expect(first.data.alreadyImported).toBe(false);
    expect(first.data.cases.every((c:{suiteId:null})=>c.suiteId===null)).toBe(true);
    const rows=await store.client.testCase.findMany({where:{projectId:p.id},orderBy:{sequence:'asc'}});
    expect(rows).toHaveLength(5);expect(rows[0].description).toContain('Dado que');expect(rows.every(r=>r.suiteId===null && r.status==='DRAFT')).toBe(true);
    expect(await store.client.testStep.count({where:{projectId:p.id}})).toBe(18);
    const retries=await Promise.all([1,2].map(()=>http().post(url).set('Authorization',auth(owner)).attach('file',sample,'renamed.CSV').expect(200)));
    expect(retries.every(r=>r.body.data.alreadyImported)).toBe(true);
    expect(await store.client.testCase.count({where:{projectId:p.id}})).toBe(5);
    const second=await project(ws.id,'IMPORT2');
    await http().post(`${projectPath(ws.id,second.id)}/test-cases/import/azure-devops`).set('Authorization',auth(owner)).attach('file',sample,'azure.csv').expect(200);
    expect(await store.client.testCase.count({where:{projectId:second.id}})).toBe(5);
    await http().post(url).set('Authorization',auth(otherOwner)).attach('file',sample,'azure.csv').expect(404);
    await http().post(url).attach('file',sample,'azure.csv').expect(401);
    const wm=await join(ws.id);
    await http().put(`${base}/members/${wm.id}`).set('Authorization',auth(owner)).send({projectRole:'VIEWER'}).expect(200);
    await http().post(url).set('Authorization',auth(member)).attach('file',sample,'azure.csv').expect(403);
    const result=await http().get(`${base}/test-cases`).set('Authorization',auth(owner)).query({root:true}).expect(200);
    expect(result.body.meta.pagination.totalItems).toBe(5);
    expect(result.body.meta.timestamp).toMatch(/-03:00$/);expect(result.body.data[0].createdAt).toMatch(/-03:00$/);
    expect(new Date(result.body.data[0].createdAt).getTime()).toBe(rows[0].createdAt.getTime());
  });
  it('rejects invalid CSV, UTF-8, fields, extension and size without partially inserting cases',async()=>{
    const ws=await workspace(),p=await project(ws.id,'BADCSV'),base=projectPath(ws.id,p.id);
    const upload=(bytes:Buffer,name='bad.csv')=>http().post(`${base}/test-cases/import/azure-devops`).set('Authorization',auth(owner)).attach('file',bytes,name);
    await upload(sample,'azure.xlsx').expect(400);
    await upload(Buffer.from([0xff,0xfe])).expect(400);
    await upload(Buffer.from('ID,Work Item Type,Title,Test Step,Step Action,Step Expected\n1,Test Case,Valid,,,\n2,Bug,Wrong,,,')).expect(400);
    await http().post(`${base}/test-cases/import/azure-devops`).set('Authorization',auth(owner)).field('suiteId',randomUUID()).attach('file',sample,'azure.csv').expect(400);
    await upload(Buffer.alloc(5*1024*1024+1,65)).expect(413);
    expect(await store.client.testCase.count({where:{projectId:p.id}})).toBe(0);
    await http().post(`${base}/archive`).set('Authorization',auth(owner)).send({}).expect(200);
    await upload(sample).expect(409);
  });
  it('encrypts all credentials in the database and audits explicit authorized reveals without leaking metadata',async()=>{
    const ws=await workspace(),p=await project(ws.id,'VAULT'),base=projectPath(ws.id,p.id),url=`${base}/test-vault`;
    const secret={username:'private-test-user',password:'secret-password-123',url:'https://hml.example.com',notes:'secret test notes'};
    const created=(await http().post(url).set('Authorization',auth(owner)).send({name:'Conta de teste',...secret}).expect(201)).body.data;
    const db=await store.client.testVaultEntry.findUniqueOrThrow({where:{id:created.id}});
    for(const value of Object.values(secret)) {expect(db.encryptedPayload).not.toContain(value);expect(JSON.stringify(created)).not.toContain(value);}
    const revealed=await http().post(`${url}/${created.id}/reveal`).set('Authorization',auth(owner)).send({}).expect(200);
    expect(revealed.body.data).toMatchObject(secret);expect(revealed.headers['cache-control']).toBe('no-store');
    expect(await store.client.auditEvent.count({where:{entityId:created.id,action:'testvault.revealed'}})).toBe(1);
    await http().post(`${url}/${created.id}/reveal`).set('Authorization',auth(otherOwner)).send({}).expect(404);
    const wm=await join(ws.id);
    await http().put(`${base}/members/${wm.id}`).set('Authorization',auth(owner)).send({projectRole:'VIEWER'}).expect(200);
    await http().get(url).set('Authorization',auth(member)).expect(403);
    const role=(await http().post(`/api/v1/workspaces/${ws.id}/roles`).set('Authorization',auth(owner)).send({name:'Consultar cofre',permissionCodes:['testvault.read']}).expect(201)).body.data;
    await http().put(`/api/v1/workspaces/${ws.id}/members/${wm.id}/roles/${role.id}`).set('Authorization',auth(owner)).send({}).expect(204);
    const list=await http().get(url).set('Authorization',auth(member)).expect(200);
    expect(list.body.data).toHaveLength(1);expect(JSON.stringify(list.body)).not.toMatch(/encryptedPayload|password|username|keyId/);
    await http().post(`${url}/${created.id}/reveal`).set('Authorization',auth(member)).send({}).expect(403);
    const otherProject=await project(ws.id,'VAULT2');
    await http().post(`${projectPath(ws.id,otherProject.id)}/test-vault/${created.id}/reveal`).set('Authorization',auth(owner)).send({}).expect(404);
  });
  it('requires the actor to hold newly granted effective vault capabilities when assigning project participants',async()=>{
    const ws=await workspace(),p=await project(ws.id,'BOUNDARY'),base=projectPath(ws.id,p.id);
    const manager=await join(ws.id),target=await join(ws.id,peer);
    await http().put(`${base}/members/${manager.id}`).set('Authorization',auth(owner)).send({projectRole:'MANAGER'}).expect(200);
    const role=async(name:string,permissionCodes:string[]) => (await http().post(`/api/v1/workspaces/${ws.id}/roles`).set('Authorization',auth(owner)).send({name,permissionCodes}).expect(201)).body.data;
    const manage=await role('Gerenciar participantes',['project.manage_members']), reveal=await role('Revelar credenciais',['testvault.reveal']);
    const assign=async(memberId:string,roleId:string)=>http().put(`/api/v1/workspaces/${ws.id}/members/${memberId}/roles/${roleId}`).set('Authorization',auth(owner)).send({}).expect(204);
    await assign(manager.id,manage.id);await assign(target.id,reveal.id);
    await http().put(`${base}/members/${target.id}`).set('Authorization',auth(member)).send({projectRole:'VIEWER'}).expect(403);
    await assign(manager.id,reveal.id);
    await http().put(`${base}/members/${target.id}`).set('Authorization',auth(member)).send({projectRole:'VIEWER'}).expect(200);
  });
  it('validates environments, optimistic versions and deletion while keeping production credentials out of the vault',async()=>{
    const ws=await workspace(),p=await project(ws.id,'VAULTMOD'),base=projectPath(ws.id,p.id),url=`${base}/test-vault`;
    const production=(await http().post(`${base}/environments`).set('Authorization',auth(owner)).send({name:'Produção',category:'PRODUCTION'}).expect(201)).body.data;
    const hml=(await http().post(`${base}/environments`).set('Authorization',auth(owner)).send({name:'Homologação',category:'HOMOLOGATION'}).expect(201)).body.data;
    const body={name:'Credenciais',username:'tester',password:'pass'};
    await http().post(url).set('Authorization',auth(owner)).send({...body,environmentId:production.id}).expect(400);
    const entry=(await http().post(url).set('Authorization',auth(owner)).send({...body,environmentId:hml.id}).expect(201)).body.data;
    await http().patch(`${url}/${entry.id}`).set('Authorization',auth(owner)).send({version:1,name:'Atualizada'}).expect(200);
    await http().patch(`${url}/${entry.id}`).set('Authorization',auth(owner)).send({version:1,name:'Obsoleta'}).expect(409);
    await http().patch(`${url}/${entry.id}`).set('Authorization',auth(owner)).send({version:2,secret:null}).expect(400);
    await http().patch(`${url}/${entry.id}`).set('Authorization',auth(owner)).send({version:2,secret:[]}).expect(400);
    await http().patch(`${url}/${entry.id}`).set('Authorization',auth(owner)).send({version:2,encryptedPayload:'injected'}).expect(400);
    await http().patch(`${url}/${entry.id}`).set('Authorization',auth(owner)).send({version:2,secret:{username:'updated',password:'new-password'}}).expect(200);
    expect((await http().post(`${url}/${entry.id}/reveal`).set('Authorization',auth(owner)).send({}).expect(200)).body.data.password).toBe('new-password');
    await http().delete(`${url}/${entry.id}`).set('Authorization',auth(owner)).send({version:3}).expect(204);
    await http().post(`${url}/${entry.id}/reveal`).set('Authorization',auth(owner)).send({}).expect(404);
    expect((await http().get(url).set('Authorization',auth(owner)).expect(200)).body.meta.pagination.totalItems).toBe(0);
  });
  it('keeps readiness/authentication available when vault keys are absent and maps vault failures to 503',async()=>{
    const ws=await workspace(),p=await project(ws.id,'NOKEY'),base=projectPath(ws.id,p.id);
    const degraded=await createApp({config:{...app.get<AppConfig>(CONFIG),testVault:{activeKeyId:'v1'}},mail:new FakeEmail(),invitationMail:new FakeInvitationMail()});
    try {
      const api=request(degraded.getHttpServer());
      await api.get('/api/v1/health/ready').expect(200);
      const result=await api.post(`${base}/test-vault`).set('Authorization',auth(owner)).send({name:'Teste',username:'secret-user',password:'secret-pass'}).expect(503);
      expect(result.body.code).toBe('TEST_VAULT_UNAVAILABLE');expect(result.body.timestamp).toMatch(/-03:00$/);
      expect(JSON.stringify(result.body)).not.toContain('secret-pass');
      await api.get(`${base}/test-vault`).set('Authorization',auth(owner)).expect(200);
      expect(await store.client.testVaultEntry.count({where:{projectId:p.id}})).toBe(0);
    } finally {await degraded.close();}
  });
  it('lists authorized defects across Workspaces including archived projects with filters and pagination',async()=>{
    const ws1=await workspace(),ws2=await workspace(),p1=await project(ws1.id,'INV1'),p2=await project(ws2.id,'INV2');
    const title=`inventory-${randomUUID()}`;
    const create=async(ws:string,p:string)=>(await http().post(`${projectPath(ws,p)}/defects`).set('Authorization',auth(owner)).send({title,severity:'CRITICAL'}).expect(201)).body.data;
    const one=await create(ws1.id,p1.id),two=await create(ws2.id,p2.id);
    await http().post(`${projectPath(ws2.id,p2.id)}/archive`).set('Authorization',auth(owner)).send({}).expect(200);
    const list=(await http().get('/api/v1/defects').set('Authorization',auth(owner)).query({q:title,size:1}).expect(200)).body;
    expect(list.meta.pagination.totalItems).toBe(2);expect(list.data).toHaveLength(1);
    const page2=(await http().get('/api/v1/defects').set('Authorization',auth(owner)).query({q:title,size:1,page:2}).expect(200)).body;
    expect(new Set([...list.data,...page2.data].map((d:{id:string})=>d.id))).toEqual(new Set([one.id,two.id]));
    expect([...list.data,...page2.data].some(d=>d.projectStatus==='ARCHIVED')).toBe(true);
    expect((await http().get('/api/v1/defects').set('Authorization',auth(otherOwner)).query({q:title}).expect(200)).body.meta.pagination.totalItems).toBe(0);
    await http().get('/api/v1/defects').set('Authorization',auth(otherOwner)).query({workspaceId:ws1.id}).expect(404);
    await http().get('/api/v1/defects').set('Authorization',auth(owner)).query({workspaceId:'bad'}).expect(400);
    await http().get('/api/v1/defects').set('Authorization',auth(owner)).query({status:'BAD'}).expect(400);
    await http().get('/api/v1/defects').expect(401);
    expect((await http().get('/api/v1/defects').set('Authorization',auth(owner)).query({workspaceId:ws1.id,q:title,severity:'CRITICAL'}).expect(200)).body.meta.pagination.totalItems).toBe(1);
    const wm=await join(ws1.id);
    await http().put(`${projectPath(ws1.id,p1.id)}/members/${wm.id}`).set('Authorization',auth(owner)).send({projectRole:'VIEWER'}).expect(200);
    expect((await http().get('/api/v1/defects').set('Authorization',auth(member)).query({q:title}).expect(200)).body.data.map((d:{id:string})=>d.id)).toEqual([one.id]);
    await http().delete(`${projectPath(ws1.id,p1.id)}/members/${wm.id}`).set('Authorization',auth(owner)).send({}).expect(204);
    expect((await http().get('/api/v1/defects').set('Authorization',auth(member)).query({q:title}).expect(200)).body.meta.pagination.totalItems).toBe(0);
  });
  it('orders framework controls by immutable creationOrder instead of user-supplied code',async()=>{
    const ws=await workspace(),base=`/api/v1/workspaces/${ws.id}/governance/frameworks`;
    const root=(await http().post(base).set('Authorization',auth(owner)).send({code:'ORDER',name:'Ordem',versionLabel:'1'}).expect(201)).body.data;
    const section=(await http().post(`${base}/${root.id}/sections`).set('Authorization',auth(owner)).send({version:root.version,code:'SEC',name:'Seção',position:1}).expect(201)).body.data;
    const first=(await http().post(`${base}/${root.id}/controls`).set('Authorization',auth(owner)).send({version:section.frameworkVersion,sectionId:section.section.id,code:'Z-LAST',title:'Primeiro'}).expect(201)).body.data;
    const second=(await http().post(`${base}/${root.id}/controls`).set('Authorization',auth(owner)).send({version:first.frameworkVersion,sectionId:section.section.id,code:'A-FIRST',title:'Segundo'}).expect(201)).body.data;
    expect(first.control.creationOrder).toBeLessThan(second.control.creationOrder);
    const list=(await http().get(`${base}/${root.id}/controls`).set('Authorization',auth(owner)).expect(200)).body.data;
    expect(list.map((c:{code:string})=>c.code)).toEqual(['Z-LAST','A-FIRST']);
    await http().patch(`${base}/${root.id}/controls/${first.control.id}`).set('Authorization',auth(owner)).send({version:second.frameworkVersion,code:'0-NEW'}).expect(200);
    const updated=(await http().get(`${base}/${root.id}/controls`).set('Authorization',auth(owner)).query({sort:'creationOrder,asc'}).expect(200)).body.data;
    expect(updated[0].creationOrder).toBe(first.control.creationOrder);
    await http().patch(`${base}/${root.id}/controls/${first.control.id}`).set('Authorization',auth(owner)).send({version:second.frameworkVersion+1,creationOrder:9999}).expect(400);
  });
});
