import { writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../dist/app.js';
import {
  FakeEmail,
  MemoryFileStorage,
  testConfig,
  harness,
  register,
} from './helpers.js';
import { MemoryStore } from './memory-store.js';
const apps: INestApplication[] = [];
async function setup(rate = 1000) {
  const store = new MemoryStore();
  const mail = new FakeEmail();
  const app = await createApp({
    config: { ...testConfig, rate: { limit: rate, window: 60 } },
    store,
    mail,
    fileStorage: new MemoryFileStorage(),
  });
  apps.push(app);
  return { app, store, mail, http: request(app.getHttpServer()) };
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('HTTP contracts and Swagger', () => {
  it('returns readable field errors and rejects unrecognized fields without exposing secrets', async () => {
    const { http } = await setup();
    const res = await http
      .post('/api/v1/auth/login')
      .send({ email: 'bad-email', password: 'secret-password', admin: true })
      .expect(400);
    expect(res.type).toBe('application/problem+json');
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.type).toBe('urn:lambdaquality:problem:validation-error');
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email', code: 'INVALID_EMAIL' }),
        expect.objectContaining({ field: 'admin', code: 'UNEXPECTED_FIELD' }),
      ]),
    );
    expect(JSON.stringify(res.body)).not.toContain('secret-password');
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });
  it('rejects malformed JSON and returns uniform 404 for unknown routes', async () => {
    const { http } = await setup();
    const malformed = await http
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(malformed.body.code).toBe('VALIDATION_ERROR');
    const missing = await http.get('/api/v1/unknown').expect(404);
    expect(missing.body.code).toBe('RESOURCE_NOT_FOUND');
  });
  it('supports signup, login, me, token rotation and logout via bearer', async () => {
    const { http, mail } = await setup();
    const c = await http
      .post('/api/v1/auth/registration/code')
      .send({ email: 'user@example.com' })
      .expect(202);
    expect(c.body.data).not.toHaveProperty('code');
    const user = await http
      .post('/api/v1/auth/register')
      .send({
        challengeId: c.body.data.challengeId,
        code: mail.lastCode(),
        displayName: 'Test User',
        password: 'VerySecurePassword123!',
      })
      .expect(201);
    expect(user.body.data).not.toHaveProperty('passwordHash');
    const login = await http
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'VerySecurePassword123!' })
      .expect(200);
    expect(login.headers['cache-control']).toBe('no-store');
    expect(login.headers.pragma).toBe('no-cache');
    await http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(200);
    const next = await http
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.data.refreshToken })
      .expect(200);
    const logout = await http
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${next.body.data.accessToken}`)
      .send({})
      .expect(204);
    expect(logout.text).toBe('');
    const revoked = await http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${next.body.data.accessToken}`)
      .expect(401);
    expect(revoked.body.code).toBe('AUTH_SESSION_REVOKED');
  });
  it('returns bearer challenge for protected endpoints and rejects fake tokens', async () => {
    const { http } = await setup();
    const missing = await http.get('/api/v1/auth/me').expect(401);
    expect(missing.headers['www-authenticate']).toBe('Bearer');
    const fake = await http
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer fake-token')
      .expect(401);
    expect(fake.body.code).toBe('AUTH_INVALID_ACCESS_TOKEN');
  });
  it('rate limits requests and sends Retry-After', async () => {
    const { http } = await setup(1);
    await http
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.com', password: 'wrong' })
      .expect(401);
    const blocked = await http
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.com', password: 'wrong' })
      .expect(429);
    expect(blocked.body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
  it('allows authenticated session operations after the public authentication quota is exhausted', async () => {
    const { http, store } = await setup(1);
    const h = harness(store);
    await register(h);
    const pair = await h.service.login(
      'user@example.com',
      'VerySecurePassword123!',
      h.requestId,
    );
    await http
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.com', password: 'wrong' })
      .expect(401);
    await http
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.com', password: 'wrong' })
      .expect(429);
    for (let i = 0; i < 25; i++)
      await http
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${pair.accessToken}`)
        .expect(200);
    await http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${pair.accessToken}`)
      .query({ unexpected: 1 })
      .expect(400);
    await http
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${pair.accessToken}`)
      .send({})
      .expect(204);
    await http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${pair.accessToken}`)
      .expect(401);
  });
  it('exposes Swagger UI and complete operations with bearer only on protected routes', async () => {
    const { http } = await setup();
    const ui = await http.get('/docs').expect(200);
    expect(ui.text).toContain('Swagger UI');
    const res = await http.get('/docs-json').expect(200);
    if (process.env.UPDATE_OPENAPI === 'true')
      await writeFile(
        'front-specs/openapi.json',
        JSON.stringify(res.body, null, 2) + '\n',
      );
    const doc = res.body;
    expect(doc.info.title).toBe('Lambda Quality API');
    expect(doc.info.license).toEqual({
      name: 'MIT',
      url: 'https://opensource.org/license/mit',
    });
    expect(doc.components.securitySchemes['access-token'].scheme).toBe(
      'bearer',
    );
    expect(doc.paths['/api/v1/auth/me'].get.security).toEqual([
      { 'access-token': [] },
    ]);
    expect(doc.paths['/api/v1/auth/login'].post.security || []).toEqual([]);
    expect(
      doc.paths['/api/v1/auth/register'].post.requestBody.content[
        'application/json'
      ].schema.$ref,
    ).toContain('RegistrationDto');
    expect(
      doc.paths['/api/v1/auth/registration/code'].post.responses['202'],
    ).toBeDefined();
    expect(
      doc.paths['/api/v1/auth/login'].post.responses['400'].content[
        'application/problem+json'
      ],
    ).toBeDefined();
    const runBase =
      '/api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/result-imports';
    for (const [path, method, id] of [
      [runBase + '/preview', 'post', 'previewTestRunResultImport'],
      [runBase + '/{previewId}/apply', 'post', 'applyTestRunResultImport'],
      [runBase + '/{previewId}', 'get', 'getTestRunResultImport'],
      [
        '/api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans/{planId}/cases/bulk',
        'post',
        'addTestPlanCasesBulk',
      ],
      ['/api/v1/test-runs', 'get', 'listTestRunInventory'],
      ['/api/v1/dashboard/projects', 'get', 'listDashboardProjects'],
    ]) {
      const operation = doc.paths[path][method];
      expect(operation.operationId).toBe(id);
      expect(operation.security).toEqual([{ 'access-token': [] }]);
      expect(operation.responses['200']).toBeDefined();
      expect(operation.responses['429']).toBeUndefined();
    }
    expect(
      doc.paths[runBase + '/preview'].post.requestBody.content[
        'multipart/form-data'
      ],
    ).toBeDefined();
    expect(
      doc.paths[runBase + '/{previewId}/apply'].post.requestBody.content[
        'application/json'
      ].schema.$ref,
    ).toContain('ApplyResultImportDto');
    expect(
      doc.components.schemas.RunCaseResponse.properties.resultOrigin.enum,
    ).toEqual(['MANUAL', 'JUNIT']);
    expect(
      doc.components.schemas.RunCaseResponse.properties.externalResult.nullable,
    ).toBe(true);
    const overview = doc.paths['/api/v1/dashboard/overview'].get;
    expect(overview.operationId).toBe('getDashboardOverview');
    expect(overview.security).toEqual([{ 'access-token': [] }]);
    expect(overview.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'days',
          required: false,
          schema: {
            oneOf: [
              { type: 'integer', enum: [7, 30, 90] },
              { type: 'string', enum: ['ALL'] },
            ],
            default: 30,
          },
        }),
        expect.objectContaining({
          name: 'workspaceId',
          required: false,
          schema: expect.objectContaining({ type: 'string', format: 'uuid' }),
        }),
      ]),
    );
    for (const methods of Object.values(doc.paths) as Record<
      string,
      { operationId?: string; responses: Record<string, unknown> }
    >[]) {
      for (const operation of Object.values(methods)) {
        if (!operation.operationId) continue;
        const limited = [
          'requestRegistrationCode',
          'registerUser',
          'requestPasswordResetCode',
          'resetPassword',
          'login',
          'refreshSession',
          'resendWorkspaceInvitation',
        ].includes(operation.operationId);
        expect('429' in operation.responses).toBe(limited);
      }
    }
    expect(overview.parameters).toHaveLength(2);
    expect(
      overview.responses['200'].content['application/json'].schema.properties
        .data.$ref,
    ).toContain('DashboardOverviewResponse');
    const overviewSchema = doc.components.schemas.DashboardOverviewResponse;
    expect(overviewSchema.required).toEqual([
      'frameworkGovernance',
      'generatedAt',
      'period',
      'metrics',
      'results',
      'defectsByStatus',
      'projects',
      'activity',
      'governance',
      'documents',
    ]);
    for (const field of [
      'results',
      'defectsByStatus',
      'projects',
      'activity',
      'governance',
      'documents',
    ])
      expect(overviewSchema.properties[field].nullable).toBe(true);
    expect(overviewSchema.properties.projects.maxItems).toBe(10);
    expect(overviewSchema.properties.governance.maxItems).toBe(6);
    const progress =
      doc.paths[
        '/api/v1/workspaces/{workspaceId}/governance/frameworks/{frameworkId}/progress'
      ].get;
    expect(progress.operationId).toBe('getGovernanceFrameworkProgress');
    expect(
      progress.parameters
        .filter((p: { in: string }) => p.in === 'query')
        .map((p: { name: string }) => p.name),
    ).toEqual(['assessmentId']);
    expect(
      doc.components.schemas.FrameworkProgressResponse.properties.assessment
        .nullable,
    ).toBe(true);
    expect(
      doc.components.schemas.ProgressSummaryResponse.properties.completed.type,
    ).toBe('boolean');
    expect(
      doc.components.schemas.CreateGoalDto.properties.sectionId.nullable,
    ).toBe(true);
    expect(
      doc.components.schemas.GoalResultResponse.properties.reason.enum,
    ).toContain('SECTION_NOT_IN_SNAPSHOT');
    expect(
      doc.paths['/api/v1/workspaces/{workspaceId}/defects/analytics'].get
        .operationId,
    ).toBe('getDefectAnalytics');
    expect(
      doc.components.schemas.EnvironmentResponse.properties.category.enum,
    ).toEqual(['PRODUCTION', 'HOMOLOGATION', 'OTHER']);
    expect(
      doc.components.schemas.DefectResponse.properties.environmentSnapshot
        .nullable,
    ).toBe(true);
    const defectSummary = doc.paths['/api/v1/defects/summary'].get;
    const defectHistory =
      doc.paths[
        '/api/v1/workspaces/{workspaceId}/projects/{projectId}/defects/{defectId}/history'
      ].get;
    expect(defectHistory.operationId).toBe('listDefectHistory');
    expect(defectHistory.security).toEqual([{ 'access-token': [] }]);
    expect(
      defectHistory.parameters
        .filter((p: { in: string }) => p.in === 'query')
        .map((p: { name: string }) => p.name)
        .sort(),
    ).toEqual(['page', 'size', 'sort']);
    expect(
      defectHistory.responses['200'].content['application/json'].schema
        .properties.data.items.$ref,
    ).toContain('DefectHistoryResponse');
    expect(
      doc.components.schemas.UpdateDefectDto.properties.comment,
    ).toMatchObject({
      type: 'string',
      minLength: 1,
      maxLength: 10000,
      nullable: false,
    });
    expect(doc.components.schemas.UpdateDefectDto.required).not.toContain(
      'comment',
    );
    expect(doc.components.schemas.DefectHistoryResponse.required).toEqual([
      'id',
      'type',
      'actor',
      'createdAt',
      'fromStatus',
      'toStatus',
      'comment',
    ]);
    expect(
      doc.components.schemas.DefectHistoryResponse.properties.type.enum,
    ).toEqual(['CREATED', 'UPDATED']);
    expect(
      doc.components.schemas.DefectHistoryResponse.properties.comment,
    ).toMatchObject({ type: 'string', nullable: true, maxLength: 10000 });
    expect(
      doc.components.schemas.DefectHistoryActorResponse.properties.displayName,
    ).toMatchObject({ type: 'string', nullable: true });
    expect(defectSummary.operationId).toBe('getDefectInventorySummary');
    expect(defectSummary.security).toEqual([{ 'access-token': [] }]);
    expect(
      defectSummary.parameters.map((p: { name: string }) => p.name).sort(),
    ).toEqual(['projectId', 'q', 'severity', 'status', 'workspaceId']);
    expect(
      defectSummary.responses['200'].content['application/json'].schema
        .properties.data.$ref,
    ).toContain('DefectSummaryResponse');
    expect(
      doc.components.schemas.DefectSummaryResponse.properties.totalBugs,
    ).toMatchObject({ type: 'integer', minimum: 0 });
    expect(
      doc.components.schemas.DefectSummaryResponse.properties.resolutionTime
        .nullable,
    ).toBe(true);
    expect(
      doc.components.schemas.DefectResolutionTimeResponse.properties
        .averageHours,
    ).toMatchObject({ type: 'number', nullable: true, minimum: 0 });
    expect(
      doc.components.schemas.DefectSummaryStatusCountsResponse.required,
    ).toEqual(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED']);
    expect(
      doc.components.schemas.DefectSummaryCategoryCountsResponse.required,
    ).toEqual(['HOMOLOGATION', 'PRODUCTION', 'OTHER', 'UNSPECIFIED']);
    for (const schema of ['DefectResponse', 'DefectInventoryResponse'])
      expect(
        doc.components.schemas[schema].properties.resolvedAt,
      ).toMatchObject({ type: 'string', format: 'date-time', nullable: true });
    const summary =
      doc.paths[
        '/api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/summary'
      ].get;
    expect(summary.operationId).toBe('getTestCaseSummary');
    expect(summary.security).toEqual([{ 'access-token': [] }]);
    expect(
      summary.parameters.filter(
        (parameter: { in: string }) => parameter.in === 'query',
      ),
    ).toEqual([
      expect.objectContaining({
        name: 'status',
        required: false,
        schema: {
          type: 'string',
          enum: ['DRAFT', 'ACTIVE', 'DEPRECATED', 'ARCHIVED', 'ALL'],
        },
      }),
    ]);
    expect(
      summary.responses['200'].content['application/json'].schema.properties
        .data.$ref,
    ).toContain('CaseSummaryResponse');
    expect(
      doc.components.schemas.CaseSummaryResponse.properties.totalCases,
    ).toMatchObject({ type: 'integer', minimum: 0 });
    expect(
      doc.components.schemas.CaseSuiteCountResponse.properties,
    ).toMatchObject({
      suiteId: { type: 'string', format: 'uuid', nullable: true },
      totalCases: { type: 'integer', minimum: 0 },
    });
    expect(doc.components.schemas.DashboardMetricsResponse.required).toContain(
      'activeTestCases',
    );
    expect(
      doc.components.schemas.DashboardActiveCasesMetricResponse.properties,
    ).toMatchObject({
      value: { type: 'integer', minimum: 0, nullable: true },
      previousValue: { nullable: true, enum: [null] },
    });
    const periodSchema = doc.components.schemas.DashboardPeriodResponse;
    expect(periodSchema.required).toContain('supportedDays');
    expect(periodSchema.properties.days.oneOf).toEqual([
      { type: 'integer', enum: [7, 30, 90] },
      { type: 'string', enum: ['ALL'] },
    ]);
    expect(periodSchema.properties.supportedDays).toMatchObject({
      type: 'array',
      minItems: 4,
      maxItems: 4,
      example: [7, 30, 90, 'ALL'],
    });
    for (const field of ['from', 'previousFrom', 'previousTo'])
      expect(periodSchema.properties[field]).toMatchObject({
        type: 'string',
        format: 'date-time',
        nullable: true,
      });
    expect(doc.components.schemas.DashboardMetricsResponse.required).toContain(
      'automationCoverage',
    );
    expect(
      doc.components.schemas.DashboardAutomationMetricResponse.properties.value,
    ).toMatchObject({
      type: 'number',
      minimum: 0,
      maximum: 100,
      nullable: true,
    });
    expect(
      doc.components.schemas.DashboardAutomationMetricResponse.properties
        .previousValue,
    ).toMatchObject({ nullable: true, enum: [null] });
    expect(
      doc.components.schemas.DashboardProjectResponse.properties
        .activeTestCases,
    ).toMatchObject({ type: 'integer', minimum: 0, nullable: true });
    expect(
      doc.components.schemas.DashboardProjectResponse.properties
        .automationCoverage,
    ).toMatchObject({
      type: 'number',
      minimum: 0,
      maximum: 100,
      nullable: true,
    });
    expect(
      doc.components.schemas.UpdateActionDto.properties.goalId,
    ).toMatchObject({ type: 'string', format: 'uuid', nullable: true });
    expect(doc.components.schemas.UpdateActionDto.required).not.toContain(
      'goalId',
    );
    expect(
      doc.components.schemas.UpdateActionDto.properties,
    ).not.toHaveProperty('controlAssessmentId');
    expect(doc.components.schemas.GovernanceGoalResponse.required).toContain(
      'actionProgress',
    );
    expect(doc.components.schemas.DashboardGoalResponse.required).toContain(
      'actionProgress',
    );
    expect(
      doc.components.schemas.GoalActionProgressResponse.properties.percent,
    ).toMatchObject({ nullable: true, minimum: 0, maximum: 100 });
    expect(doc.components.schemas.UserResponse.properties).not.toHaveProperty(
      'passwordHash',
    );
    expect(doc.paths['/api/v1/workspaces'].post.security).toEqual([
      { 'access-token': [] },
    ]);
    expect(
      doc.paths['/api/v1/workspaces/{workspaceId}/attachments'].post.requestBody
        .content['multipart/form-data'],
    ).toBeDefined();
    expect(
      doc.paths['/api/v1/workspaces/{workspaceId}/tags'].get.responses['200']
        .content['application/json'].schema.properties.data.type,
    ).toBe('array');
    expect(
      doc.paths['/api/v1/workspaces/{workspaceId}/projects'],
    ).toBeDefined();
    expect(doc.components.schemas.CreateFieldDto.properties.required.type).toBe(
      'boolean',
    );
    expect(
      doc.paths['/api/v1/workspaces'].get.parameters.find(
        (p: { name: string }) => p.name === 'page',
      ).schema.type,
    ).toBe('number');
  });
  it('separates liveness from readiness and hides infrastructure failures', async () => {
    const { http, store } = await setup();
    await http.get('/api/v1/health/live').expect(200);
    await http.get('/api/v1/health/ready').expect(200);
    store.health = async () => {
      throw new Error('database secret');
    };
    const down = await http.get('/api/v1/health/ready').expect(503);
    expect(down.body.code).toBe('SERVICE_UNAVAILABLE');
    expect(down.text).not.toContain('database secret');
    await http.get('/api/v1/health/live').expect(200);
  });
  it('rejects query parameters and weak registration passwords', async () => {
    const { http } = await setup();
    await http
      .post('/api/v1/auth/login?unknown=true')
      .send({ email: 'user@example.com', password: 'secret' })
      .expect(400);
    const res = await http
      .post('/api/v1/auth/register')
      .send({
        challengeId: 'bad',
        code: '123',
        displayName: 'A',
        password: 'short',
      })
      .expect(400);
    expect(
      res.body.errors.some(
        (error: { field: string }) => error.field === 'password',
      ),
    ).toBe(true);
  });
});
