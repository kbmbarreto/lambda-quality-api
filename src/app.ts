import {
  DefectSummaryService,
  DEFECT_SUMMARY,
} from './modules/defect/application/summary.js';
import {
  ResultImportController,
  ResultImportGuard,
} from './modules/execution/api/import-controller.js';
import {
  ResultImports,
  RESULT_IMPORTS,
} from './modules/execution/application/result-imports.js';
import { parseJUnit } from './modules/execution/infrastructure/junit-parser.js';
import { RunInventoryController } from './modules/execution/api/inventory-controller.js';
import {
  RunInventory,
  RUN_INVENTORY,
} from './modules/execution/application/inventory.js';
import { DashboardProjectsController } from './modules/dashboard/api/projects-controller.js';
import {
  DashboardProjects,
  DASHBOARD_PROJECTS,
} from './modules/dashboard/application/projects.js';
import { VaultController } from './modules/vault/api/controller.js';
import { TEST_VAULT, TestVault } from './modules/vault/application/vault.js';
import { AesVaultCipher } from './modules/vault/infrastructure/aes-vault-cipher.js';
import {
  CaseImportController,
  CaseImportGuard,
} from './modules/testmanagement/api/import-controller.js';
import {
  TEST_CASE_IMPORT,
  TestCaseImport,
} from './modules/testmanagement/application/import-cases.js';
import { DefectInventoryController } from './modules/defect/api/inventory-controller.js';
import {
  DefectInventory,
  DEFECT_INVENTORY,
} from './modules/defect/application/inventory.js';
import { DefectAnalyticsController } from './modules/defect/api/analytics-controller.js';
import {
  DEFECT_ANALYTICS,
  DefectAnalyticsService,
} from './modules/defect/application/analytics.js';
import {
  GOVERNANCE_PROGRESS,
  GovernanceProgress,
} from './modules/governance/application/progress.js';
import { DashboardController } from './modules/dashboard/api/controller.js';
import {
  DASHBOARD_OVERVIEW,
  DashboardOverviewService,
} from './modules/dashboard/application/overview.js';
import { GovernanceController } from './modules/governance/api/controller.js';
import { GovernanceFrameworks } from './modules/governance/application/frameworks.js';
import { GovernanceAssessments } from './modules/governance/application/assessments.js';
import { GovernanceGoalsActions } from './modules/governance/application/goals-actions.js';
import {
  GOVERNANCE_FRAMEWORKS,
  GOVERNANCE_ASSESSMENTS,
  GOVERNANCE_GOALS,
} from './modules/governance/application/tokens.js';
import { EvidenceAttachments } from './modules/attachment/application/evidence.js';
import { DefectController } from './modules/defect/api/controller.js';
import { Defects, DEFECTS } from './modules/defect/application/defects.js';
import {
  ExecutionFailures,
  EXECUTION_FAILURES,
} from './modules/execution/application/failures.js';
import {
  TestPlanController,
  TestRunController,
} from './modules/execution/api/controllers.js';
import {
  TEST_PLANS,
  TestPlans,
} from './modules/execution/application/plans.js';
import { TEST_RUNS, TestRuns } from './modules/execution/application/runs.js';
import {
  TEST_DEFINITIONS,
  TestDefinitions,
} from './modules/testmanagement/application/definitions.js';
import {
  TestSuiteController,
  TestCaseController,
} from './modules/testmanagement/api/test-controllers.js';
import {
  TEST_SUITES,
  TestSuites,
} from './modules/testmanagement/application/suites.js';
import {
  TEST_CASES,
  TestCases,
} from './modules/testmanagement/application/cases.js';
import 'reflect-metadata';
import { BadRequestException, Module, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import type { ValidationError } from 'class-validator';
import { CONFIG, loadConfig } from './shared/config/config.js';
import type { AppConfig } from './shared/config/config.js';
import { requestMiddleware } from './shared/http/request-middleware.js';
import { ProblemFilter } from './shared/http/problem-filter.js';
import { SuccessInterceptor } from './shared/http/success-interceptor.js';
import {
  AuthQueryGuard,
  RateLimitGuard,
} from './shared/http/rate-limit-guard.js';
import { HealthController } from './shared/http/health-controller.js';
import { AuthController } from './modules/identity/api/auth-controller.js';
import { BearerGuard } from './modules/identity/api/bearer-guard.js';
import {
  IDENTITY_SERVICE,
  IdentityService,
} from './modules/identity/application/identity-service.js';
import {
  IDENTITY_STORE,
  PASSWORDS,
  ACCESS_TOKENS,
  CODE_EMAIL,
} from './modules/identity/application/ports.js';
import type {
  IdentityStore,
  Passwords,
  AccessTokens,
  CodeEmail,
} from './modules/identity/application/ports.js';
import { PrismaIdentityStore } from './modules/identity/infrastructure/prisma-identity-store.js';
import { ArgonPasswords } from './modules/identity/infrastructure/argon-passwords.js';
import { JwtAccessTokens } from './modules/identity/infrastructure/jwt-access-tokens.js';
import { SendgridCodeEmail } from './modules/identity/infrastructure/sendgrid-code-email.js';
import { MulterModule } from '@nestjs/platform-express';
import { IDENTITY_DIRECTORY } from './modules/identity/application/directory.js';
import type { IdentityDirectory } from './modules/identity/application/directory.js';
import { PrismaDirectory } from './modules/identity/infrastructure/prisma-directory.js';
import { StoreDirectory } from './modules/identity/infrastructure/store-directory.js';
import {
  WORKSPACE_STORE,
  INVITATION_MAIL,
} from './modules/workspace/application/ports.js';
import type {
  WorkspaceStore,
  InvitationMail,
} from './modules/workspace/application/ports.js';
import { PrismaWorkspaceStore } from './modules/workspace/infrastructure/prisma-workspace-store.js';
import { SendgridInvitations } from './modules/workspace/infrastructure/sendgrid-invitations.js';
import {
  WORKSPACE_ACCESS,
  WorkspaceAccess,
} from './modules/workspace/application/access.js';
import {
  WORKSPACES,
  Workspaces,
} from './modules/workspace/application/workspaces.js';
import {
  WORKSPACE_ROLES,
  RolesGroups,
} from './modules/workspace/application/roles-groups.js';
import {
  INVITATIONS,
  Invitations,
} from './modules/workspace/application/invitations.js';
import {
  CATALOGS,
  Catalogs,
} from './modules/testmanagement/application/catalogs.js';
import {
  ATTACHMENTS,
  Attachments,
} from './modules/attachment/application/attachments.js';
import { FILE_STORAGE } from './modules/attachment/application/storage.js';
import type { FileStorage } from './modules/attachment/application/storage.js';
import { OciStorage } from './modules/attachment/infrastructure/oci-storage.js';
import {
  WorkspaceController,
  InvitationController,
} from './modules/workspace/api/workspace-controller.js';
import { AccessController } from './modules/workspace/api/access-controller.js';
import { CatalogController } from './modules/testmanagement/api/catalog-controller.js';
import { AttachmentController } from './modules/attachment/api/attachment-controller.js';
import {
  ProjectController,
  MilestoneController,
  EnvironmentController,
} from './modules/project/api/project-controllers.js';
import { PROJECTS, Projects } from './modules/project/application/projects.js';
import {
  PROJECT_SETTINGS,
  ProjectSettings,
} from './modules/project/application/settings.js';
import {
  WorkspaceRequestGuard,
  UploadAccessGuard,
} from './modules/workspace/api/guards.js';

@Module({})
class AppModule {}
export interface AppOverrides {
  dashboardClock?: () => Date;
  config?: AppConfig;
  store?: IdentityStore;
  mail?: CodeEmail;
  passwords?: Passwords;
  tokens?: AccessTokens;
  workspaceStore?: WorkspaceStore;
  directory?: IdentityDirectory;
  invitationMail?: InvitationMail;
  fileStorage?: FileStorage;
}
function validationFields(
  errors: ValidationError[],
  prefix = '',
): { field: string; code: string; message: string }[] {
  return errors.flatMap((error) => {
    const field = prefix ? `${prefix}.${error.property}` : error.property;
    const codes: Record<string, string> = {
      isEmail: 'INVALID_EMAIL',
      isUuid: 'INVALID_UUID',
      whitelistValidation: 'UNEXPECTED_FIELD',
      matches: 'INVALID_FORMAT',
      minLength: 'TOO_SHORT',
      maxLength: 'TOO_LONG',
      isLength: 'INVALID_LENGTH',
      isString: 'INVALID_TYPE',
    };
    return [
      ...Object.entries(error.constraints || {}).map(
        ([constraint, message]) => ({
          field,
          code: codes[constraint] || 'INVALID_VALUE',
          message:
            constraint === 'whitelistValidation'
              ? 'Este campo não é permitido.'
              : message,
        }),
      ),
      ...validationFields(error.children || [], field),
    ];
  });
}
export async function createApp(overrides: AppOverrides = {}) {
  const config = overrides.config || loadConfig();
  const module = {
    module: AppModule,
    imports: [
      MulterModule.register({
        limits: {
          fileSize: config.workspace.maxFileBytes,
          files: 1,
          fields: 0,
          parts: 1,
        },
      }),
    ],
    controllers: [
      DashboardController,
      GovernanceController,
      AuthController,
      HealthController,
      WorkspaceController,
      InvitationController,
      AccessController,
      CatalogController,
      AttachmentController,
      DefectController,
      DefectAnalyticsController,
      TestPlanController,
      TestRunController,
      ResultImportController,
      RunInventoryController,
      DashboardProjectsController,
      TestSuiteController,
      TestCaseController,
      ProjectController,
      MilestoneController,
      EnvironmentController,
      VaultController,
      DefectInventoryController,
      CaseImportController,
    ],
    providers: [
      {
        provide: DEFECT_SUMMARY,
        inject: [PROJECTS],
        useFactory: (projects: Projects) => new DefectSummaryService(projects),
      },
      {
        provide: RESULT_IMPORTS,
        inject: [PROJECTS, TEST_RUNS],
        useFactory: (projects: Projects, runs: TestRuns) =>
          new ResultImports(projects, runs, parseJUnit),
      },
      {
        provide: RUN_INVENTORY,
        inject: [PROJECTS],
        useFactory: (projects: Projects) => new RunInventory(projects),
      },
      {
        provide: DASHBOARD_PROJECTS,
        inject: [PROJECTS],
        useFactory: (projects: Projects) => new DashboardProjects(projects),
      },
      ResultImportGuard,

      {
        provide: TEST_VAULT,
        inject: [PROJECTS],
        useFactory: (projects: Projects) =>
          new TestVault(
            projects,
            new AesVaultCipher(config.testVault ?? { activeKeyId: 'v1' }),
          ),
      },
      CaseImportGuard,
      {
        provide: TEST_CASE_IMPORT,
        inject: [PROJECTS, TEST_CASES],
        useFactory: (projects: Projects, cases: TestCases) =>
          new TestCaseImport(projects, cases),
      },
      {
        provide: DEFECT_INVENTORY,
        inject: [PROJECTS],
        useFactory: (projects: Projects) => new DefectInventory(projects),
      },
      {
        provide: DEFECT_ANALYTICS,
        inject: [PROJECTS],
        useFactory: (projects: Projects) =>
          new DefectAnalyticsService(projects),
      },
      {
        provide: GOVERNANCE_PROGRESS,
        inject: [GOVERNANCE_FRAMEWORKS],
        useFactory: (frameworks: GovernanceFrameworks) =>
          new GovernanceProgress(frameworks, overrides.dashboardClock),
      },
      {
        provide: DASHBOARD_OVERVIEW,
        inject: [PROJECTS, GOVERNANCE_PROGRESS],
        useFactory: (projects: Projects, progress: GovernanceProgress) =>
          new DashboardOverviewService(
            projects,
            overrides.dashboardClock,
            progress,
          ),
      },
      {
        provide: GOVERNANCE_FRAMEWORKS,
        inject: [WORKSPACE_ACCESS],
        useFactory: (access: WorkspaceAccess) =>
          new GovernanceFrameworks(access),
      },
      {
        provide: GOVERNANCE_ASSESSMENTS,
        inject: [GOVERNANCE_FRAMEWORKS],
        useFactory: (frameworks: GovernanceFrameworks) =>
          new GovernanceAssessments(frameworks, new EvidenceAttachments()),
      },
      {
        provide: GOVERNANCE_GOALS,
        inject: [GOVERNANCE_ASSESSMENTS, PROJECTS],
        useFactory: (assessments: GovernanceAssessments, projects: Projects) =>
          new GovernanceGoalsActions(assessments, projects),
      },

      {
        provide: EXECUTION_FAILURES,
        useFactory: () => new ExecutionFailures(),
      },
      {
        provide: DEFECTS,
        inject: [PROJECTS, EXECUTION_FAILURES],
        useFactory: (projects: Projects, failures: ExecutionFailures) =>
          new Defects(projects, failures),
      },
      { provide: TEST_DEFINITIONS, useFactory: () => new TestDefinitions() },
      {
        provide: TEST_PLANS,
        inject: [PROJECTS, TEST_DEFINITIONS],
        useFactory: (projects: Projects, definitions: TestDefinitions) =>
          new TestPlans(projects, definitions),
      },
      {
        provide: TEST_RUNS,
        inject: [PROJECTS, TEST_DEFINITIONS],
        useFactory: (projects: Projects, definitions: TestDefinitions) =>
          new TestRuns(projects, definitions),
      },
      {
        provide: TEST_SUITES,
        inject: [PROJECTS],
        useFactory: (projects: Projects) => new TestSuites(projects),
      },
      {
        provide: TEST_CASES,
        inject: [PROJECTS],
        useFactory: (projects: Projects) => new TestCases(projects),
      },
      { provide: CONFIG, useValue: config },
      {
        provide: PROJECTS,
        inject: [WORKSPACE_ACCESS],
        useFactory: (access: WorkspaceAccess) => new Projects(access),
      },
      {
        provide: PROJECT_SETTINGS,
        inject: [PROJECTS],
        useFactory: (projects: Projects) => new ProjectSettings(projects),
      },
      {
        provide: IDENTITY_STORE,
        useFactory: () => overrides.store || new PrismaIdentityStore(config),
      },
      {
        provide: PASSWORDS,
        useFactory: () => overrides.passwords || new ArgonPasswords(),
      },
      {
        provide: ACCESS_TOKENS,
        useFactory: () => overrides.tokens || new JwtAccessTokens(config.jwt),
      },
      {
        provide: CODE_EMAIL,
        useFactory: () => overrides.mail || new SendgridCodeEmail(config.mail),
      },
      {
        provide: WORKSPACE_STORE,
        useFactory: () =>
          overrides.workspaceStore || new PrismaWorkspaceStore(config),
      },
      {
        provide: IDENTITY_DIRECTORY,
        inject: [IDENTITY_STORE],
        useFactory: (store: IdentityStore) =>
          overrides.directory ||
          (store instanceof PrismaIdentityStore
            ? new PrismaDirectory(store.client)
            : new StoreDirectory(store)),
      },
      {
        provide: INVITATION_MAIL,
        useFactory: () =>
          overrides.invitationMail ||
          new SendgridInvitations(config.mail, config.workspace.acceptUrl),
      },
      {
        provide: FILE_STORAGE,
        useFactory: () =>
          overrides.fileStorage || new OciStorage(config.objectStorage),
      },
      {
        provide: WORKSPACE_ACCESS,
        inject: [WORKSPACE_STORE, IDENTITY_DIRECTORY],
        useFactory: (store: WorkspaceStore, directory: IdentityDirectory) =>
          new WorkspaceAccess(store, directory),
      },
      {
        provide: WORKSPACES,
        inject: [WORKSPACE_ACCESS],
        useFactory: (access: WorkspaceAccess) => new Workspaces(access),
      },
      {
        provide: WORKSPACE_ROLES,
        inject: [WORKSPACE_ACCESS],
        useFactory: (access: WorkspaceAccess) => new RolesGroups(access),
      },
      {
        provide: INVITATIONS,
        inject: [WORKSPACE_ACCESS, INVITATION_MAIL],
        useFactory: (access: WorkspaceAccess, mail: InvitationMail) =>
          new Invitations(access, mail, {
            secret: config.workspace.secret,
            ttl: config.workspace.invitationTtl,
            cooldown: config.workspace.invitationCooldown,
          }),
      },
      {
        provide: CATALOGS,
        inject: [WORKSPACE_ACCESS],
        useFactory: (access: WorkspaceAccess) => new Catalogs(access),
      },
      {
        provide: ATTACHMENTS,
        inject: [WORKSPACE_ACCESS, FILE_STORAGE],
        useFactory: (access: WorkspaceAccess, storage: FileStorage) =>
          new Attachments(access, storage, config.workspace.maxFileBytes),
      },
      {
        provide: IDENTITY_SERVICE,
        inject: [IDENTITY_STORE, PASSWORDS, ACCESS_TOKENS, CODE_EMAIL],
        useFactory: (
          store: IdentityStore,
          passwords: Passwords,
          tokens: AccessTokens,
          mail: CodeEmail,
        ) =>
          new IdentityService(store, passwords, tokens, mail, {
            accessTtl: config.jwt.accessTtl,
            sessionTtl: config.jwt.sessionTtl,
            refreshIdleTtl: config.jwt.refreshIdleTtl,
            codeSecret: config.codes.secret,
            codeTtl: config.codes.ttl,
            codeMaxAttempts: config.codes.maxAttempts,
            codeCooldown: config.codes.cooldown,
          }),
      },
      BearerGuard,
      AuthQueryGuard,
      RateLimitGuard,
      WorkspaceRequestGuard,
      UploadAccessGuard,
    ],
  };
  const app = await NestFactory.create(module, {
    logger: false,
    bodyParser: false,
  });
  app.use(requestMiddleware);
  app.use(helmet());
  // Large mapping lists have a narrow limit exception; all other JSON stays at 32 KiB.
  const standardJson = express.json({ limit: '32kb' });
  const resultImportJson = express.json({ limit: '128kb' });
  app.use(
    (
      req: import('express').Request,
      res: import('express').Response,
      next: import('express').NextFunction,
    ) => {
      const applyImport =
        req.method === 'POST' &&
        /^\/api\/v1\/workspaces\/[^/]+\/projects\/[^/]+\/test-runs\/[^/]+\/result-imports\/[^/]+\/apply\/?$/i.test(
          req.path,
        );
      return (applyImport ? resultImportJson : standardJson)(req, res, next);
    },
  );
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: config.cors,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: [
      'X-Request-Id',
      'Retry-After',
      'Location',
      'Content-Disposition',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: false,
      validationError: { target: false, value: false },
      exceptionFactory: (errors) =>
        new BadRequestException({ errors: validationFields(errors) }),
    }),
  );
  app.useGlobalFilters(new ProblemFilter());
  app.useGlobalInterceptors(new SuccessInterceptor(app.get(Reflector)));
  if (config.swagger) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Lambda Quality API')
        .setLicense('MIT', 'https://opensource.org/license/mit')
        .setDescription(
          'Identidade, Workspaces, Projetos, Casos de Teste, Planos, Execuções, Defeitos e Governança: membros, convites, roles/grupos, campos, tags, anexos privados, marcos, ambientes, suítes, casos e passos. Tokens reais não devem ser compartilhados.',
        )
        .setVersion('1.0')
        .addBearerAuth(
          { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          'access-token',
        )
        .build(),
    );
    for (const path of Object.values(document.paths))
      for (const operation of Object.values(path)) {
        if (
          !operation ||
          typeof operation !== 'object' ||
          !('responses' in operation)
        )
          continue;
        const body = operation.requestBody;
        if (body && !('$ref' in body)) {
          const schema = body.content['application/json']?.schema;
          if (schema && '$ref' in schema && schema.$ref.endsWith('/EmptyBody'))
            body.required = false;
        }
        for (const parameter of operation.parameters || [])
          if (!('$ref' in parameter) && parameter.in === 'path')
            parameter.schema = {
              type: 'string',
              format: 'uuid',
              description: 'UUID v4.',
            };
      }
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: '/docs-json',
      swaggerOptions: { persistAuthorization: false },
    });
  }
  app.enableShutdownHooks();
  await app.init();
  return app;
}
