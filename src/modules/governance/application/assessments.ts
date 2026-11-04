import { randomUUID } from 'node:crypto';
import type { Actor } from '../../workspace/domain/models.js';
import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import { notFound, forbidden } from '../../workspace/application/access.js';
import { pageResult } from '../../../shared/application/records.js';
import type { ListInput } from '../../../shared/application/records.js';
import type {
  Assessment,
  ControlAssessment,
  EvidenceLink,
} from '../domain/models.js';
import {
  checkVersion,
  governanceConflict,
  invalid,
  complianceScore,
  assessmentIndex,
} from '../domain/rules.js';
import { GovernanceFrameworks } from './frameworks.js';
import { EvidenceAttachments } from '../../attachment/application/evidence.js';
import { validExternalUrl } from '../../defect/domain/rules.js';
export class GovernanceAssessments {
  constructor(
    readonly frameworks: GovernanceFrameworks,
    readonly attachments: EvidenceAttachments,
  ) {}
  get access() {
    return this.frameworks.access;
  }
  async find(
    tx: WorkspaceTransaction,
    id: string,
    version?: number,
    edit = false,
  ) {
    const row = await tx.assessments.find({ id });
    if (!row) throw notFound();
    if (version !== undefined) checkVersion(row.version, version);
    if (edit && row.status !== 'IN_PROGRESS')
      governanceConflict(
        'GOVERNANCE_ASSESSMENT_LOCKED',
        'A avaliação deve estar em andamento para receber alterações.',
      );
    return row;
  }
  async control(
    tx: WorkspaceTransaction,
    assessmentId: string,
    controlId: string,
  ) {
    const row = await tx.controlAssessments.find({ assessmentId, controlId });
    if (!row) throw notFound();
    return row;
  }
  async view(tx: WorkspaceTransaction, row: Assessment) {
    return {
      ...row,
      index: assessmentIndex(
        await tx.controlAssessments.list({ where: { assessmentId: row.id } }),
      ),
      indicatorType: 'INTERNAL' as const,
    };
  }
  async changed(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    row: Assessment,
    action: string,
  ) {
    await tx.assessments.update(
      { id: row.id },
      { version: row.version + 1, updatedAt: new Date() },
    );
    await this.access.audit(
      tx,
      actor,
      ws,
      `governance.assessment.${action}`,
      'Assessment',
      row.id,
    );
    return this.view(tx, await this.find(tx, row.id));
  }
  list(actor: Actor, ws: string, input: ListInput & { frameworkId?: string }) {
    return this.access.run(ws, actor, 'governance.read', async (tx) => {
      const where: Partial<Assessment> = {};
      if (input.status && input.status !== 'ALL')
        where.status = input.status as Assessment['status'];
      if (input.frameworkId) {
        await this.frameworks.find(tx, input.frameworkId);
        where.frameworkId = input.frameworkId;
      }
      const result = await this.frameworks.page(
        tx.assessments,
        input,
        ['name', 'assessmentDate', 'createdAt', 'closedAt'],
        'assessmentDate',
        where,
        ['name'],
      );
      return pageResult(
        await Promise.all(result.items.map((r) => this.view(tx, r))),
        input,
        result.pagination.totalItems,
      );
    });
  }
  get(actor: Actor, ws: string, id: string) {
    return this.access.run(ws, actor, 'governance.read', async (tx) =>
      this.view(tx, await this.find(tx, id)),
    );
  }
  create(
    actor: Actor,
    ws: string,
    input: { frameworkId: string; name: string; assessmentDate: string },
  ) {
    return this.access.run(ws, actor, 'governance.assess', async (tx) => {
      const framework = await this.frameworks.find(tx, input.frameworkId);
      if (framework.status !== 'ACTIVE')
        governanceConflict(
          'GOVERNANCE_FRAMEWORK_INACTIVE',
          'A avaliação exige framework ativo.',
        );
      const controls = await tx.governanceControls.list({
        where: { frameworkId: framework.id, active: true },
        order: { field: 'code', direction: 'asc' },
      });
      if (!controls.length)
        governanceConflict(
          'GOVERNANCE_FRAMEWORK_EMPTY',
          'O framework não tem controles ativos.',
        );
      const sections = await tx.frameworkSections.list({
        where: { frameworkId: framework.id },
        order: { field: 'position', direction: 'asc' },
      });
      const row = await tx.assessments.create({
        id: randomUUID(),
        workspaceId: ws,
        ...input,
        status: 'DRAFT',
        frameworkSnapshot: {
          id: framework.id,
          code: framework.code,
          name: framework.name,
          versionLabel: framework.versionLabel,
          version: framework.version,
          description: framework.description,
          sections,
        },
        closedAt: null,
        createdBy: actor.userId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      for (const control of controls) {
        const sectionPath = [];
        let parent: string | null = control.sectionId;
        while (parent) {
          const section = sections.find((s) => s.id === parent);
          if (!section) throw notFound();
          sectionPath.unshift({
            id: section.id,
            code: section.code,
            name: section.name,
          });
          parent = section.parentSectionId;
        }
        await tx.controlAssessments.create({
          id: randomUUID(),
          workspaceId: ws,
          frameworkId: framework.id,
          assessmentId: row.id,
          controlId: control.id,
          controlSnapshot: {
            id: control.id,
            sectionId: control.sectionId,
            code: control.code,
            title: control.title,
            description: control.description,
            weight: control.weight,
            sectionPath,
          },
          status: 'NOT_ASSESSED',
          score: null,
          justification: null,
          assessedBy: null,
          assessedAt: null,
        });
      }
      await this.access.audit(
        tx,
        actor,
        ws,
        'governance.assessment.created',
        'Assessment',
        row.id,
      );
      return this.view(tx, row);
    });
  }
  start(actor: Actor, ws: string, id: string, version: number) {
    return this.access.run(ws, actor, 'governance.assess', async (tx) => {
      const row = await this.find(tx, id, version);
      if (row.status !== 'DRAFT')
        governanceConflict(
          'GOVERNANCE_STATE_INVALID',
          'Somente avaliação em rascunho pode iniciar.',
        );
      await tx.assessments.update({ id }, { status: 'IN_PROGRESS' });
      return this.changed(tx, actor, ws, row, 'started');
    });
  }
  controls(actor: Actor, ws: string, id: string, input: ListInput) {
    return this.access.run(ws, actor, 'governance.read', async (tx) => {
      await this.find(tx, id);
      const where: Partial<ControlAssessment> = { assessmentId: id };
      if (input.status && input.status !== 'ALL')
        where.status = input.status as ControlAssessment['status'];
      return this.frameworks.page(
        tx.controlAssessments,
        input,
        ['controlId', 'assessedAt'],
        'controlId',
        where,
        [],
      );
    });
  }
  assess(
    actor: Actor,
    ws: string,
    id: string,
    controlId: string,
    input: {
      version: number;
      status: ControlAssessment['status'];
      justification?: string | null;
    },
  ) {
    return this.access.run(ws, actor, 'governance.assess', async (tx) => {
      const root = await this.find(tx, id, input.version, true),
        row = await this.control(tx, id, controlId);
      if (input.status === 'NOT_APPLICABLE' && !input.justification?.trim())
        invalid('Justifique a classificação não aplicável.');
      await tx.controlAssessments.update(
        { id: row.id, assessmentId: id },
        {
          status: input.status,
          score: complianceScore(input.status),
          justification: input.justification ?? null,
          assessedBy: input.status === 'NOT_ASSESSED' ? null : actor.userId,
          assessedAt: input.status === 'NOT_ASSESSED' ? null : new Date(),
        },
      );
      return this.changed(tx, actor, ws, root, 'control_assessed');
    });
  }
  evidence(
    actor: Actor,
    ws: string,
    id: string,
    controlId: string,
    input: ListInput,
  ) {
    return this.access.run(ws, actor, 'governance.read', async (tx, ctx) => {
      await this.find(tx, id);
      const control = await this.control(tx, id, controlId);
      if (
        !ctx.permissions.includes('attachment.read') &&
        (await tx.evidenceLinks.count({
          where: {
            controlAssessmentId: control.id,
            evidenceType: 'ATTACHMENT',
          },
        }))
      )
        throw forbidden();
      const result = await this.frameworks.page(
        tx.evidenceLinks,
        input,
        ['createdAt', 'title', 'validUntil'],
        'createdAt',
        { controlAssessmentId: control.id },
        ['title'],
      );
      // Preserve PageResult prototype: the success interceptor recognizes paginated results.
      result.items.splice(
        0,
        result.items.length,
        ...(await Promise.all(
          result.items.map(async (r) => ({
            ...r,
            attachmentAvailable: r.referenceId
              ? await this.attachments.available(tx, r.referenceId)
              : null,
          })),
        )),
      );
      return result;
    });
  }
  addEvidence(
    actor: Actor,
    ws: string,
    id: string,
    controlId: string,
    input: {
      version: number;
      evidenceType: EvidenceLink['evidenceType'];
      referenceId?: string | null;
      url?: string | null;
      title: string;
      validUntil?: string | null;
    },
  ) {
    return this.access.run(ws, actor, 'governance.assess', async (tx, ctx) => {
      const root = await this.find(tx, id, input.version, true),
        control = await this.control(tx, id, controlId);
      let attachmentSnapshot = null;
      if (input.evidenceType === 'ATTACHMENT') {
        if (
          !input.referenceId ||
          (input.url !== undefined && input.url !== null)
        )
          invalid('Evidência de arquivo exige referenceId e não admite URL.');
        if (!ctx.permissions.includes('attachment.read')) throw forbidden();
        attachmentSnapshot = await this.attachments.snapshot(
          tx,
          input.referenceId,
        );
      } else if (
        (input.referenceId !== undefined && input.referenceId !== null) ||
        !validExternalUrl(input.url)
      )
        invalid(
          'Evidência de URL exige HTTP/HTTPS sem credenciais e não admite referenceId.',
        );
      if (
        (await tx.evidenceLinks.count({
          where: { controlAssessmentId: control.id },
        })) >= 100
      )
        governanceConflict(
          'GOVERNANCE_LIMIT',
          'O controle admite até 100 evidências.',
        );
      await tx.evidenceLinks.create({
        id: randomUUID(),
        workspaceId: ws,
        controlAssessmentId: control.id,
        evidenceType: input.evidenceType,
        referenceId: input.referenceId ?? null,
        url: input.url ?? null,
        title: input.title,
        validUntil: input.validUntil ?? null,
        attachmentSnapshot,
        createdBy: actor.userId,
        createdAt: new Date(),
      });
      return this.changed(tx, actor, ws, root, 'evidence_added');
    });
  }
  removeEvidence(
    actor: Actor,
    ws: string,
    id: string,
    controlId: string,
    evidenceId: string,
    version: number,
  ) {
    return this.access.run(ws, actor, 'governance.assess', async (tx) => {
      const root = await this.find(tx, id, version, true),
        control = await this.control(tx, id, controlId);
      if (
        !(await tx.evidenceLinks.find({
          id: evidenceId,
          controlAssessmentId: control.id,
        }))
      )
        throw notFound();
      await tx.evidenceLinks.remove({
        id: evidenceId,
        controlAssessmentId: control.id,
      });
      return this.changed(tx, actor, ws, root, 'evidence_removed');
    });
  }
  close(actor: Actor, ws: string, id: string, version: number) {
    return this.access.run(ws, actor, 'governance.assess', async (tx) => {
      const root = await this.find(tx, id, version, true);
      const controls = await tx.controlAssessments.list({
        where: { assessmentId: id },
      });
      if (
        !controls.length ||
        controls.some(
          (c) =>
            c.status === 'NOT_ASSESSED' ||
            (c.status === 'NOT_APPLICABLE' && !c.justification?.trim()),
        )
      )
        governanceConflict(
          'GOVERNANCE_ASSESSMENT_INCOMPLETE',
          'Avalie todos os controles e justifique os não aplicáveis antes de fechar.',
        );
      await tx.assessments.update(
        { id },
        { status: 'CLOSED', closedAt: new Date() },
      );
      return this.changed(tx, actor, ws, root, 'closed');
    });
  }
}
