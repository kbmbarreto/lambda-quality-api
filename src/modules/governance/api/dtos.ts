import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ValidateBy,
  ValidateIf,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  IsUUID,
  IsIn,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsNumber,
  Matches,
} from 'class-validator';
import { ListQuery, PageQuery } from '../../workspace/api/dtos.js';
import { VersionDto } from '../../testmanagement/api/dtos.js';
import { validDate } from '../domain/rules.js';
import type {
  FrameworkStatus,
  ComplianceStatus,
  EvidenceType,
  GoalType,
  GoalOperator,
} from '../domain/models.js';
export { EmptyBody } from '../../workspace/api/dtos.js';
export { VersionDto } from '../../testmanagement/api/dtos.js';
const optional = () => ValidateIf((_o: unknown, v: unknown) => v !== undefined);
const text = (limit: number, opt = false, nullable = false) =>
  applyDecorators(
    ApiProperty({
      type: String,
      maxLength: limit,
      minLength: nullable ? 0 : 1,
      required: !opt,
      nullable,
    }),
    ...(nullable ? [IsOptional()] : opt ? [optional()] : []),
    ...(!nullable
      ? [
          Transform(({ value }: { value: unknown }) =>
            typeof value === 'string' ? value.trim() : value,
          ),
        ]
      : []),
    IsString({ message: 'Informe um texto válido.' }),
    ...(nullable
      ? [MaxLength(limit, { message: `Informe até ${limit} caracteres.` })]
      : [
          Length(1, limit, {
            message: `Informe entre 1 e ${limit} caracteres.`,
          }),
        ]),
  );
const uuid = (opt = false, nullable = false) =>
  applyDecorators(
    ApiProperty({ type: String, format: 'uuid', required: !opt, nullable }),
    ...(nullable ? [IsOptional()] : opt ? [optional()] : []),
    IsUUID('4', { message: 'Informe UUID v4 válido.' }),
  );
const choice = (values: readonly string[], opt = false) =>
  applyDecorators(
    ApiProperty({ type: String, enum: [...values], required: !opt }),
    ...(opt ? [optional()] : []),
    IsIn(values, { message: 'Informe um valor válido.' }),
  );
const code = (opt = false) =>
  applyDecorators(
    text(50, opt),
    Matches(/^[A-Z0-9_.-]{1,50}$/, {
      message:
        'Use código maiúsculo com letras ASCII, números, ponto, traço ou sublinhado.',
    }),
  );
const number = (max: number, opt = false, integer = true) =>
  applyDecorators(
    ApiProperty({
      type: Number,
      minimum: integer ? 1 : 0,
      maximum: max,
      required: !opt,
    }),
    ...(opt ? [optional()] : []),
    ...(integer
      ? [IsInt({ message: 'Informe um número inteiro.' })]
      : [
          IsNumber(
            { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
            { message: 'Informe número finito com até duas casas decimais.' },
          ),
        ]),
    Min(integer ? 1 : 0, {
      message: 'Informe valor dentro do intervalo permitido.',
    }),
    Max(max, { message: 'Informe valor dentro do intervalo permitido.' }),
  );
const boolean = (opt = true) =>
  applyDecorators(
    ApiPropertyOptional({ type: Boolean }),
    ...(opt ? [optional()] : []),
    IsBoolean({ message: 'Informe um booleano.' }),
  );
const date = (opt = false, nullable = false) =>
  applyDecorators(
    ApiProperty({ type: String, format: 'date', required: !opt, nullable }),
    ...(nullable ? [IsOptional()] : opt ? [optional()] : []),
    ValidateBy(
      { name: 'calendarDate', validator: { validate: validDate } },
      {
        message: 'Informe data real no formato YYYY-MM-DD, entre 1000 e 9999.',
      },
    ),
  );
export class CreateFrameworkDto {
  @code() code!: string;
  @text(100) name!: string;
  @text(50) versionLabel!: string;
  @text(10000, true, true) description?: string | null;
}
export class UpdateFrameworkDto extends VersionDto {
  @code(true) code?: string;
  @text(100, true) name?: string;
  @text(50, true) versionLabel?: string;
  @text(10000, true, true) description?: string | null;
  @choice(['DRAFT', 'ACTIVE', 'ARCHIVED'], true) status?: FrameworkStatus;
}
export class CreateSectionDto extends VersionDto {
  @code() code!: string;
  @text(100) name!: string;
  @text(10000, true, true) description?: string | null;
  @uuid(true, true) parentSectionId?: string | null;
  @number(1000000) position!: number;
}
export class UpdateSectionDto extends VersionDto {
  @code(true) code?: string;
  @text(100, true) name?: string;
  @text(10000, true, true) description?: string | null;
  @uuid(true, true) parentSectionId?: string | null;
  @number(1000000, true) position?: number;
}
export class CreateControlDto extends VersionDto {
  @uuid() sectionId!: string;
  @code() code!: string;
  @text(250) title!: string;
  @text(10000, true, true) description?: string | null;
  @number(1000, true) weight?: number;
  @boolean() active?: boolean;
}
export class UpdateControlDto extends VersionDto {
  @uuid(true) sectionId?: string;
  @code(true) code?: string;
  @text(250, true) title?: string;
  @text(10000, true, true) description?: string | null;
  @number(1000, true) weight?: number;
  @boolean() active?: boolean;
}
export class CreateGoalDto {
  @uuid(true, true) projectId?: string | null;
  @uuid(true, true) frameworkId?: string | null;
  @uuid(true, true) sectionId?: string | null;
  @uuid(true, true) ownerMemberId?: string | null;
  @text(100) name!: string;
  @text(10000, true, true) description?: string | null;
  @choice(['AUTOMATION_COVERAGE', 'CRITICAL_DEFECTS', 'GOVERNANCE_SCORE'])
  goalType!: GoalType;
  @choice(['GT', 'GTE', 'EQ', 'LTE', 'LT']) operator!: GoalOperator;
  @number(1000000000, false, false) targetValue!: number;
  @date(true, true) deadline?: string | null;
}
export class UpdateGoalDto extends VersionDto {
  @uuid(true, true) projectId?: string | null;
  @uuid(true, true) frameworkId?: string | null;
  @uuid(true, true) sectionId?: string | null;
  @uuid(true, true) ownerMemberId?: string | null;
  @text(100, true) name?: string;
  @text(10000, true, true) description?: string | null;
  @choice(['AUTOMATION_COVERAGE', 'CRITICAL_DEFECTS', 'GOVERNANCE_SCORE'], true)
  goalType?: GoalType;
  @choice(['GT', 'GTE', 'EQ', 'LTE', 'LT'], true) operator?: GoalOperator;
  @number(1000000000, true, false) targetValue?: number;
  @date(true, true) deadline?: string | null;
  @choice(['ACTIVE', 'CANCELLED'], true) status?: 'ACTIVE' | 'CANCELLED';
}
export class CreateActionDto {
  @uuid(true, true) controlAssessmentId?: string | null;
  @uuid(true, true) goalId?: string | null;
  @text(250) title!: string;
  @text(10000, true, true) description?: string | null;
  @uuid(true, true) ownerMemberId?: string | null;
  @date(true, true) dueDate?: string | null;
}
export class UpdateActionDto extends VersionDto {
  @uuid(true, true) goalId?: string | null;
  @text(250, true) title?: string;
  @text(10000, true, true) description?: string | null;
  @uuid(true, true) ownerMemberId?: string | null;
  @date(true, true) dueDate?: string | null;
  @choice(['OPEN', 'IN_PROGRESS', 'CANCELLED'], true) status?:
    'OPEN' | 'IN_PROGRESS' | 'CANCELLED';
}
export class CreateAssessmentDto {
  @uuid() frameworkId!: string;
  @text(100) name!: string;
  @date() assessmentDate!: string;
}
export class AssessControlDto extends VersionDto {
  @choice(['NOT_ASSESSED', 'NOT_MET', 'PARTIALLY_MET', 'MET', 'NOT_APPLICABLE'])
  status!: ComplianceStatus;
  @text(10000, true, true) justification?: string | null;
}
export class AddEvidenceDto extends VersionDto {
  @choice(['ATTACHMENT', 'URL']) evidenceType!: EvidenceType;
  @uuid(true, true) referenceId?: string | null;
  @text(2048, true, true) url?: string | null;
  @text(250) title!: string;
  @date(true, true) validUntil?: string | null;
}
export class FrameworkQuery extends ListQuery {
  @choice(['DRAFT', 'ACTIVE', 'ARCHIVED', 'ALL'], true) status?: string;
}
export class ControlQuery extends ListQuery {
  @ApiPropertyOptional({
    type: Boolean,
    description: 'Query literal true ou false.',
  })
  @optional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'Informe true ou false.' })
  active?: boolean;

  @uuid(true) sectionId?: string;
}
export class AssessmentQuery extends ListQuery {
  @uuid(true) frameworkId?: string;
  @choice(['DRAFT', 'IN_PROGRESS', 'CLOSED', 'ALL'], true) status?: string;
}
export class AssessmentControlQuery extends PageQuery {
  @choice(
    [
      'NOT_ASSESSED',
      'NOT_MET',
      'PARTIALLY_MET',
      'MET',
      'NOT_APPLICABLE',
      'ALL',
    ],
    true,
  )
  status?: string;
}
export class GoalQuery extends ListQuery {
  @uuid(true) projectId?: string;
  @choice(['ACTIVE', 'ACHIEVED', 'MISSED', 'CANCELLED', 'ALL'], true)
  status?: string;
}
export class ActionQuery extends ListQuery {
  @uuid(true) goalId?: string;
  @uuid(true) controlAssessmentId?: string;
  @choice(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'ALL'], true)
  status?: string;
}
export class SectionPathResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String }) name!: string;
}
export class FrameworkSnapshotResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) versionLabel!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: () => [FrameworkSectionResponse] })
  sections!: FrameworkSectionResponse[];
}
export class ControlSnapshotResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) sectionId!: string;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: Number }) weight!: number;
  @ApiProperty({ type: () => [SectionPathResponse] })
  sectionPath!: SectionPathResponse[];
}
export class AttachmentSnapshotResponse {
  @ApiProperty({ type: String }) originalName!: string;
  @ApiProperty({ type: String }) contentType!: string;
  @ApiProperty({ type: Number }) sizeBytes!: number;
  @ApiProperty({ type: String }) checksum!: string;
}
export class GoalSectionSnapshotResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: [SectionPathResponse] }) path!: SectionPathResponse[];
}
export class GoalResultResponse {
  @ApiPropertyOptional({
    enum: [
      'SECTION_NOT_IN_SNAPSHOT',
      'EMPTY_SECTION',
      'NO_APPLICABLE_CONTROLS',
      'NO_CLOSED_ASSESSMENT',
    ],
  })
  reason?: string;
  @ApiPropertyOptional({ type: GoalSectionSnapshotResponse, nullable: true })
  section?: GoalSectionSnapshotResponse | null;
  @ApiProperty({ type: Number, nullable: true }) value!: number | null;
  @ApiProperty({ type: Number, nullable: true }) numerator!: number | null;
  @ApiProperty({ type: Number, nullable: true }) denominator!: number | null;
  @ApiProperty({ type: String, format: 'date-time' }) calculatedAt!: string;
  @ApiProperty({ type: [String] }) sourceIds!: string[];
}
export class AssessmentIndexResponse {
  @ApiProperty({ type: Number, nullable: true }) value!: number | null;
  @ApiProperty({ type: Number }) numerator!: number;
  @ApiProperty({ type: Number }) denominator!: number;
  @ApiProperty({ type: Number }) assessedControls!: number;
  @ApiProperty({ type: Number }) totalControls!: number;
}
export class GovernanceFrameworkResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) versionLabel!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] })
  status!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}
export class FrameworkSectionResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) frameworkId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parentSectionId!: string | null;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: Number }) position!: number;
}
export class GovernanceControlResponse {
  @ApiProperty({
    type: Number,
    minimum: 1,
    readOnly: true,
    description: 'Sequência técnica de criação; ordenação padrão crescente.',
  })
  creationOrder!: number;
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) frameworkId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) sectionId!: string;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: Number }) weight!: number;
  @ApiProperty({ type: Boolean }) active!: boolean;
}
export class AssessmentResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) frameworkId!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, enum: ['DRAFT', 'IN_PROGRESS', 'CLOSED'] })
  status!: string;
  @ApiProperty({ type: String, format: 'date' }) assessmentDate!: string;
  @ApiProperty({ type: () => FrameworkSnapshotResponse })
  frameworkSnapshot!: FrameworkSnapshotResponse;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  closedAt!: string | null;
  @ApiProperty({ type: String, format: 'uuid' }) createdBy!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: () => AssessmentIndexResponse })
  index!: AssessmentIndexResponse;
  @ApiProperty({ type: String, enum: ['INTERNAL'] }) indicatorType!: string;
}
export class ControlAssessmentResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) frameworkId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) assessmentId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) controlId!: string;
  @ApiProperty({ type: () => ControlSnapshotResponse })
  controlSnapshot!: ControlSnapshotResponse;
  @ApiProperty({
    type: String,
    enum: ['NOT_ASSESSED', 'NOT_MET', 'PARTIALLY_MET', 'MET', 'NOT_APPLICABLE'],
  })
  status!: string;
  @ApiProperty({ type: Number, nullable: true }) score!: number | null;
  @ApiProperty({ type: String, nullable: true }) justification!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) assessedBy!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  assessedAt!: string | null;
}
export class EvidenceLinkResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) controlAssessmentId!: string;
  @ApiProperty({ type: String, enum: ['ATTACHMENT', 'URL'] })
  evidenceType!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) referenceId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) url!: string | null;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) validUntil!:
    string | null;
  @ApiProperty({ type: () => AttachmentSnapshotResponse, nullable: true })
  attachmentSnapshot!: AttachmentSnapshotResponse | null;
  @ApiProperty({ type: String, format: 'uuid' }) createdBy!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: Boolean, nullable: true }) attachmentAvailable!:
    boolean | null;
}
export class GoalActionProgressResponse {
  @ApiProperty({ enum: ['ACTIONS'] }) basis!: 'ACTIONS';
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Ações vinculadas, excluindo CANCELLED.',
  })
  totalActions!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) completedActions!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) cancelledActions!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 100,
    description:
      'Percentual de ações DONE entre as válidas; sem base null. 100 somente quando todas estão DONE.',
  })
  percent!: number | null;
}
export class GovernanceGoalResponse {
  @ApiProperty({ type: GoalActionProgressResponse })
  actionProgress!: GoalActionProgressResponse;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) sectionId!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  ownerMemberId!: string | null;
  @ApiProperty({ type: String, nullable: true }) ownerDisplayName!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) sectionName!: string | null;
  @ApiProperty({ type: [SectionPathResponse] })
  sectionPath!: SectionPathResponse[];
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) projectId!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) frameworkId!:
    string | null;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({
    type: String,
    enum: ['AUTOMATION_COVERAGE', 'CRITICAL_DEFECTS', 'GOVERNANCE_SCORE'],
  })
  goalType!: string;
  @ApiProperty({ type: String, enum: ['GT', 'GTE', 'EQ', 'LTE', 'LT'] })
  operator!: string;
  @ApiProperty({ type: Number }) targetValue!: number;
  @ApiProperty({ type: String, format: 'date', nullable: true }) deadline!:
    string | null;
  @ApiProperty({
    type: String,
    enum: ['ACTIVE', 'ACHIEVED', 'MISSED', 'CANCELLED'],
  })
  status!: string;
  @ApiProperty({ type: () => GoalResultResponse, nullable: true })
  lastResult!: GoalResultResponse | null;
  @ApiProperty({ type: String, format: 'uuid' }) createdBy!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}
export class ActionPlanResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  controlAssessmentId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) goalId!:
    string | null;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  ownerMemberId!: string | null;
  @ApiProperty({
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'],
  })
  status!: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) dueDate!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: string | null;
  @ApiProperty({ type: String, format: 'uuid' }) createdBy!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}
export class SectionMutationResponse {
  @ApiProperty({ type: () => FrameworkSectionResponse })
  section!: FrameworkSectionResponse;
  @ApiProperty({ type: Number }) frameworkVersion!: number;
}
export class ControlMutationResponse {
  @ApiProperty({ type: () => GovernanceControlResponse })
  control!: GovernanceControlResponse;
  @ApiProperty({ type: Number }) frameworkVersion!: number;
}
export class MetricsResponse {
  @ApiProperty({ type: [String] }) goalTypes!: string[];
  @ApiProperty({ type: String }) indicatorType!: string;
}
export class AssessmentCountsResponse {
  @ApiProperty({ type: Number }) draft!: number;
  @ApiProperty({ type: Number }) inProgress!: number;
  @ApiProperty({ type: Number }) closed!: number;
}
export class GoalCountsResponse {
  @ApiProperty({ type: Number }) active!: number;
  @ApiProperty({ type: Number }) achieved!: number;
  @ApiProperty({ type: Number }) missed!: number;
  @ApiProperty({ type: Number }) cancelled!: number;
}
export class ActionCountsResponse {
  @ApiProperty({ type: Number }) open!: number;
  @ApiProperty({ type: Number }) inProgress!: number;
  @ApiProperty({ type: Number }) done!: number;
  @ApiProperty({ type: Number }) cancelled!: number;
}
export class AttentionResponse {
  @ApiProperty({ type: Number }) notMetControls!: number;
  @ApiProperty({ type: Number }) partiallyMetControls!: number;
  @ApiProperty({ type: Number }) expiredEvidence!: number;
}
export class LatestAssessmentResponse {
  @ApiProperty({ type: String, format: 'uuid' }) frameworkId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) assessmentId!: string;
  @ApiProperty({ type: String }) frameworkName!: string;
  @ApiProperty({ type: String, format: 'date-time' }) closedAt!: string;
  @ApiProperty({ type: Number, nullable: true }) index!: number | null;
}
export class DashboardResponse {
  @ApiProperty({ type: String }) indicatorType!: string;
  @ApiProperty({ type: Number }) frameworks!: number;
  @ApiProperty({ type: () => AssessmentCountsResponse })
  assessments!: AssessmentCountsResponse;
  @ApiProperty({ type: () => [LatestAssessmentResponse] })
  latestAssessments!: LatestAssessmentResponse[];
  @ApiProperty({ type: () => GoalCountsResponse }) goals!: GoalCountsResponse;
  @ApiProperty({ type: () => ActionCountsResponse })
  actions!: ActionCountsResponse;
  @ApiProperty({ type: () => AttentionResponse }) attention!: AttentionResponse;
}
