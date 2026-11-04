import { ExternalResultResponse } from './external-result-dto.js';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsString,
  IsUUID,
  IsIn,
  IsInt,
  Min,
  Max,
  Length,
  MaxLength,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { ListQuery, PageQuery } from '../../workspace/api/dtos.js';
import { VersionDto } from '../../testmanagement/api/dtos.js';
import { PLAN_STATUSES, RUN_STATUSES, TEST_RESULTS } from '../domain/models.js';
import type { TestResult } from '../domain/models.js';
export { EmptyBody } from '../../workspace/api/dtos.js';
export { VersionDto } from '../../testmanagement/api/dtos.js';
const optional = () => ValidateIf((_o: unknown, v: unknown) => v !== undefined);
const text = (opt = false, nullable = false, limit = 100) =>
  applyDecorators(
    ApiProperty({
      type: String,
      required: !opt,
      nullable,
      maxLength: limit,
      minLength: nullable ? 0 : 1,
    }),
    ...(nullable ? [IsOptional()] : opt ? [optional()] : []),
    ...(nullable
      ? []
      : [
          Transform(({ value }: { value: unknown }) =>
            typeof value === 'string' ? value.trim() : value,
          ),
        ]),
    IsString({ message: 'Informe um texto válido.' }),
    ...(nullable
      ? [MaxLength(limit, { message: `Informe até ${limit} caracteres.` })]
      : [
          Length(1, limit, {
            message: `Informe entre 1 e ${limit} caracteres.`,
          }),
        ]),
  );
const uuid = (nullable = false) =>
  applyDecorators(
    ApiPropertyOptional({ type: String, format: 'uuid', nullable }),
    ...(nullable ? [IsOptional()] : [optional()]),
    IsUUID('4', { message: 'Informe UUID v4 válido.' }),
  );
const choice = (values: readonly string[], opt = false) =>
  applyDecorators(
    ApiProperty({ type: String, enum: [...values], required: !opt }),
    ...(opt ? [optional()] : []),
    IsIn(values, { message: 'Informe um estado permitido.' }),
  );
const caseIds = (opt = false, allowEmpty = false) =>
  applyDecorators(
    ApiProperty({
      type: [String],
      required: !opt,
      maxItems: 500,
      minItems: allowEmpty ? 0 : 1,
    }),
    ...(opt ? [optional()] : []),
    IsArray({ message: 'Informe uma lista de casos.' }),
    ArrayMinSize(allowEmpty ? 0 : 1, {
      message: 'Selecione ao menos um caso.',
    }),
    ArrayMaxSize(500, { message: 'Selecione até 500 casos.' }),
    ArrayUnique({ message: 'Não repita casos.' }),
    IsUUID('4', { each: true, message: 'Informe UUIDs v4 válidos.' }),
  );
export class CreatePlanDto {
  @text() name!: string;
  @text(true, true, 10000) description?: string | null;
  @uuid(true) milestoneId?: string | null;
  @uuid(true) environmentId?: string | null;
  @caseIds(true, true) caseIds?: string[];
}
export class UpdatePlanDto extends VersionDto {
  @text(true) name?: string;
  @text(true, true, 10000) description?: string | null;
  @uuid(true) milestoneId?: string | null;
  @uuid(true) environmentId?: string | null;
}
export class PlanQuery extends ListQuery {
  @choice([...PLAN_STATUSES, 'ALL'], true) status?: string;
}
export class PlanCasesQuery extends PageQuery {}
export class AddPlanCaseDto extends VersionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Informe UUID v4 válido.' })
  testCaseId!: string;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 500 })
  @optional()
  @IsInt({ message: 'Informe um inteiro.' })
  @Min(1, { message: 'Informe posição >=1.' })
  @Max(500, { message: 'Informe até 500.' })
  position?: number;
}
export class AddPlanCasesDto extends VersionDto {
  @caseIds() caseIds!: string[];
}
export class ReorderPlanCasesDto extends VersionDto {
  @caseIds(false, true) caseIds!: string[];
}
export class CreateRunDto {
  @text() name!: string;
  @caseIds() caseIds!: string[];
  @uuid(true) milestoneId?: string | null;
  @uuid(true) environmentId?: string | null;
}
export class CreatePlanRunDto extends VersionDto {
  @text() name!: string;
}
export class RunQuery extends ListQuery {
  @choice([...RUN_STATUSES, 'ALL'], true) status?: string;
  @uuid() testPlanId?: string;
}
export class RunCasesQuery extends ListQuery {
  @choice([...TEST_RESULTS, 'ALL'], true) result?: string;
}
export class ResultDto extends VersionDto {
  @choice(TEST_RESULTS) result!: TestResult;
  @text(true, true, 10000) comment?: string | null;
}
export class StepResultDto extends ResultDto {
  @text(true, true, 10000) actualResult?: string | null;
}
export class CommentDto extends VersionDto {
  @text(false, false, 10000) text!: string;
  @uuid(true) runCaseId?: string | null;
  @uuid(true) runStepId?: string | null;
}
export class CommentQuery extends ListQuery {}
export class PlanCaseResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) projectId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) testPlanId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) testCaseId!: string;
  @ApiProperty({ type: Number }) position!: number;
}
export class PlanResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) projectId!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) milestoneId!:
    string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  environmentId!: string | null;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, enum: PLAN_STATUSES }) status!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, format: 'uuid' }) createdBy!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  activatedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  completedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  archivedAt!: string | null;
  @ApiProperty({ type: [PlanCaseResponse] }) cases!: PlanCaseResponse[];
}
export class ContextSnapshotResponse {
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
}
export class RunSummaryResponse {
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) notTested!: number;
  @ApiProperty({ type: Number }) passed!: number;
  @ApiProperty({ type: Number }) failed!: number;
  @ApiProperty({ type: Number }) blocked!: number;
  @ApiProperty({ type: Number }) skipped!: number;
}
export class RunResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) projectId!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) testPlanId!:
    string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) milestoneId!:
    string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  environmentId!: string | null;
  @ApiProperty({ type: String, nullable: true }) planNameSnapshot!:
    string | null;
  @ApiProperty({ type: ContextSnapshotResponse, nullable: true })
  milestoneSnapshot!: ContextSnapshotResponse | null;
  @ApiProperty({ type: ContextSnapshotResponse, nullable: true })
  environmentSnapshot!: ContextSnapshotResponse | null;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, enum: ['MANUAL'] }) source!: 'MANUAL';
  @ApiProperty({ type: String, nullable: true }) externalRunRef!: string | null;
  @ApiProperty({ type: String, enum: RUN_STATUSES }) status!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, format: 'uuid' }) createdBy!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  startedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  finishedAt!: string | null;
  @ApiProperty({ type: RunSummaryResponse }) summary!: RunSummaryResponse;
}
export class DefinitionSnapshotResponse {
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, nullable: true }) preconditions!: string | null;
  @ApiProperty({ type: String, nullable: true }) postconditions!: string | null;
  @ApiProperty({ type: String }) type!: string;
  @ApiProperty({ type: String }) layer!: string;
  @ApiProperty({ type: String, nullable: true }) behavior!: string | null;
  @ApiProperty({ type: String }) automationStatus!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) suiteId!:
    string | null;
  @ApiProperty({ type: String }) status!: string;
  @ApiProperty({ type: Number }) version!: number;
}
export class FieldOptionSnapshotResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) label!: string;
}
export class FieldSnapshotResponse {
  @ApiProperty({ type: String, format: 'uuid' }) fieldId!: string;
  @ApiProperty({ type: String }) key!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) type!: string;
  @ApiProperty({ type: Boolean }) required!: boolean;
  @ApiProperty({ type: [FieldOptionSnapshotResponse] })
  options!: FieldOptionSnapshotResponse[];
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  archivedAt!: string | null;
  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
  })
  value!: string | number | boolean;
}
export class TagSnapshotResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) name!: string;
}
export class RunStepResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) projectId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) testRunId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) testRunCaseId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) sourceStepId!: string;
  @ApiProperty({ type: Number }) position!: number;
  @ApiProperty({ type: String }) actionSnapshot!: string;
  @ApiProperty({ type: String, nullable: true }) testDataSnapshot!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) expectedResultSnapshot!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) actualResult!: string | null;
  @ApiProperty({ type: String, enum: TEST_RESULTS }) result!: string;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) executedBy!:
    string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  executedAt!: string | null;
}
export class RunCaseResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) projectId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) testRunId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) testCaseId!: string;
  @ApiProperty({ type: Number }) position!: number;
  @ApiProperty({ type: Number }) caseSequenceSnapshot!: number;
  @ApiProperty({ type: String }) humanIdSnapshot!: string;
  @ApiProperty({ type: String }) titleSnapshot!: string;
  @ApiProperty({ type: String }) severitySnapshot!: string;
  @ApiProperty({ type: String }) prioritySnapshot!: string;
  @ApiProperty({ type: DefinitionSnapshotResponse })
  definitionSnapshot!: DefinitionSnapshotResponse;
  @ApiProperty({ type: [FieldSnapshotResponse] })
  customFieldsSnapshot!: FieldSnapshotResponse[];
  @ApiProperty({ type: [TagSnapshotResponse] })
  tagsSnapshot!: TagSnapshotResponse[];
  @ApiProperty({ type: String, enum: TEST_RESULTS }) result!: string;
  @ApiProperty({ enum: ['MANUAL', 'JUNIT'] }) resultOrigin!: string;
  @ApiProperty({ type: ExternalResultResponse, nullable: true })
  externalResult!: ExternalResultResponse | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) executedBy!:
    string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  executedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: [RunStepResponse] }) steps!: RunStepResponse[];
}
export class ExecutionCommentResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) projectId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) testRunId!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) runCaseId!:
    string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) runStepId!:
    string | null;
  @ApiProperty({ type: String }) text!: string;
  @ApiProperty({ type: String, format: 'uuid' }) createdBy!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}
