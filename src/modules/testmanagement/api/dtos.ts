import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ValidateBy,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
  Length,
  IsUUID,
  IsIn,
  IsBoolean,
  IsOptional,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ListQuery } from '../../workspace/api/dtos.js';
import {
  SEVERITIES,
  PRIORITIES,
  CASE_STATUSES,
  TEST_TYPES,
  TEST_LAYERS,
  AUTOMATION_STATUSES,
} from '../domain/models.js';
import type { CustomValue } from '../domain/models.js';
export { EmptyBody } from '../../workspace/api/dtos.js';
const optional = () => ValidateIf((_o: unknown, v: unknown) => v !== undefined);
const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
const text = (limit: number, opt = false, nullable = false) =>
  applyDecorators(
    ApiProperty({
      type: String,
      required: !opt,
      nullable,
      maxLength: limit,
      minLength: nullable ? 0 : 1,
    }),
    ...(nullable ? [IsOptional()] : opt ? [optional()] : []),
    ...(nullable ? [] : [trim()]),
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
    ...(nullable
      ? [
          ValidateIf(
            (_o: unknown, v: unknown) =>
              v !== null && (!opt || v !== undefined),
          ),
        ]
      : opt
        ? [optional()]
        : []),
    IsUUID('4', { message: 'Informe UUID v4 válido.' }),
  );
const choice = (
  values: readonly string[],
  opt = false,
  defaultValue?: string,
) =>
  applyDecorators(
    ApiProperty({
      type: String,
      enum: [...values],
      required: !opt,
      ...(defaultValue ? { default: defaultValue } : {}),
    }),
    ...(opt ? [optional()] : []),
    IsIn(values, { message: 'Informe um valor permitido.' }),
  );
const position = (opt = false, max = 2147483647) =>
  applyDecorators(
    ApiProperty({ type: Number, minimum: 1, maximum: max, required: !opt }),
    ...(opt ? [optional()] : []),
    IsInt({ message: 'Informe um inteiro.' }),
    Min(1, { message: 'Informe no mínimo 1.' }),
    Max(max, { message: `Informe até ${max}.` }),
  );
const ids = (opt = false, max = 1000) =>
  applyDecorators(
    ApiProperty({ type: [String], required: !opt, maxItems: max }),
    ...(opt ? [optional()] : []),
    IsArray({ message: 'Informe uma lista.' }),
    ArrayMaxSize(max, { message: `Informe até ${max} itens.` }),
    ArrayUnique({ message: 'Não repita identificadores.' }),
    IsUUID('4', { each: true, message: 'Informe UUIDs v4 válidos.' }),
  );
export class VersionDto {
  @position() version!: number;
}
export class FieldValueDto {
  @uuid() fieldId!: string;
  @ApiProperty({
    nullable: true,
    oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
    description: 'Escalar conforme definição; null remove.',
  })
  @ValidateBy({
    name: 'isCustomValue',
    validator: {
      validate: (value: unknown) =>
        value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value)),
      defaultMessage: () => 'Informe um valor escalar ou null.',
    },
  })
  value!: CustomValue | null;
}
const fields = (opt = true) =>
  applyDecorators(
    ApiProperty({ type: [FieldValueDto], required: !opt, maxItems: 1000 }),
    ...(opt ? [optional()] : []),
    IsArray({ message: 'Informe uma lista de valores.' }),
    ArrayMaxSize(1000, { message: 'Informe até 1000 valores.' }),
    ValidateNested({ each: true, message: 'Informe objetos válidos.' }),
    Type(() => FieldValueDto),
  );
export class StepDto {
  @text(10000) action!: string;
  @text(10000, true, true) testData?: string | null;
  @text(10000, true, true) expectedResult?: string | null;
}
export class CreateStepDto extends StepDto {
  @position() version!: number;
  @position(true, 1001) position?: number;
}
export class UpdateStepDto extends VersionDto {
  @text(10000, true) action?: string;
  @text(10000, true, true) testData?: string | null;
  @text(10000, true, true) expectedResult?: string | null;
}
export class ReorderStepsDto extends VersionDto {
  @ids() ids!: string[];
}
export class ValuesDto extends VersionDto {
  @fields(false) customFields!: FieldValueDto[];
}
export class CreateSuiteDto {
  @text(100) name!: string;
  @text(10000, true, true) description?: string | null;
  @uuid(true, true) parentSuiteId?: string | null;
}
export class UpdateSuiteDto {
  @text(100, true) name?: string;
  @text(10000, true, true) description?: string | null;
}
export class MoveSuiteDto {
  @uuid(false, true) parentSuiteId!: string | null;
  @position(true) position?: number;
}
export class ReorderSuitesDto {
  @uuid(false, true) parentSuiteId!: string | null;
  @ids(false, 10000) ids!: string[];
}
const boolQuery = () =>
  applyDecorators(
    ApiPropertyOptional({ type: Boolean }),
    optional(),
    Transform(({ value }: { value: unknown }) =>
      value === 'true' ? true : value === 'false' ? false : value,
    ),
    IsBoolean({ message: 'Informe true ou false.' }),
  );
export class SuiteQuery extends ListQuery {
  @choice(['ACTIVE', 'ARCHIVED', 'ALL'], true, 'ACTIVE') status?: string;
  @uuid(true) parentSuiteId?: string;
  @boolQuery() root?: boolean;
}
export class CaseSummaryQuery {
  @choice([...CASE_STATUSES, 'ALL'], true)
  status?: (typeof CASE_STATUSES)[number] | 'ALL';
}
export class CaseSuiteCountResponse {
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  suiteId!: string | null;
  @ApiProperty({ type: 'integer', minimum: 0 }) totalCases!: number;
}
export class CaseSummaryResponse {
  @ApiProperty({ type: 'integer', minimum: 0 }) totalCases!: number;
  @ApiProperty({ type: [CaseSuiteCountResponse] })
  suites!: CaseSuiteCountResponse[];
}
export class CaseQuery extends ListQuery {
  @choice([...CASE_STATUSES, 'ALL'], true) status?: string;
  @uuid(true) suiteId?: string;
  @uuid(true) tagId?: string;
  @boolQuery() root?: boolean;
  @choice(PRIORITIES, true) priority?: (typeof PRIORITIES)[number];
  @choice(AUTOMATION_STATUSES, true)
  automationStatus?: (typeof AUTOMATION_STATUSES)[number];
}
export class CreateCaseDto {
  @text(250) title!: string;
  @text(10000, true, true) description: string | null = null;
  @text(10000, true, true) preconditions: string | null = null;
  @text(10000, true, true) postconditions: string | null = null;
  @choice(SEVERITIES, true, 'NORMAL') severity: (typeof SEVERITIES)[number] =
    'NORMAL';
  @choice(PRIORITIES, true, 'MEDIUM') priority: (typeof PRIORITIES)[number] =
    'MEDIUM';
  @choice(['DRAFT', 'ACTIVE', 'DEPRECATED'], true, 'DRAFT') status:
    'DRAFT' | 'ACTIVE' | 'DEPRECATED' = 'DRAFT';
  @choice(TEST_TYPES, true, 'FUNCTIONAL') type: (typeof TEST_TYPES)[number] =
    'FUNCTIONAL';
  @choice(TEST_LAYERS, true, 'E2E') layer: (typeof TEST_LAYERS)[number] = 'E2E';
  @text(100, true, true) behavior: string | null = null;
  @choice(AUTOMATION_STATUSES, true, 'MANUAL')
  automationStatus: (typeof AUTOMATION_STATUSES)[number] = 'MANUAL';
  @uuid(true, true) suiteId?: string | null;
  @ApiPropertyOptional({ type: [StepDto], maxItems: 1000 })
  @optional()
  @IsArray({ message: 'Informe uma lista.' })
  @ArrayMaxSize(1000, { message: 'Informe até 1000 passos.' })
  @ValidateNested({ each: true, message: 'Informe objetos válidos.' })
  @Type(() => StepDto)
  steps?: StepDto[];
  @ids(true) tagIds?: string[];
  @ids(true) attachmentIds?: string[];
  @fields() customFields?: FieldValueDto[];
}
export class UpdateCaseDto extends VersionDto {
  @text(250, true) title?: string;
  @text(10000, true, true) description?: string | null;
  @text(10000, true, true) preconditions?: string | null;
  @text(10000, true, true) postconditions?: string | null;
  @choice(SEVERITIES, true) severity?: (typeof SEVERITIES)[number];
  @choice(PRIORITIES, true) priority?: (typeof PRIORITIES)[number];
  @choice(['DRAFT', 'ACTIVE', 'DEPRECATED'], true) status?:
    'DRAFT' | 'ACTIVE' | 'DEPRECATED';
  @choice(TEST_TYPES, true) type?: (typeof TEST_TYPES)[number];
  @choice(TEST_LAYERS, true) layer?: (typeof TEST_LAYERS)[number];
  @text(100, true, true) behavior?: string | null;
  @choice(AUTOMATION_STATUSES, true)
  automationStatus?: (typeof AUTOMATION_STATUSES)[number];
  @fields() customFields?: FieldValueDto[];
}
export class MoveCaseDto extends VersionDto {
  @uuid(false, true) suiteId!: string | null;
}
export class CloneCaseDto {
  @text(250, true) title?: string;
  @uuid(true, true) suiteId?: string | null;
}
export class RestoreCaseDto extends VersionDto {
  @choice(['DRAFT', 'ACTIVE', 'DEPRECATED']) status!:
    'DRAFT' | 'ACTIVE' | 'DEPRECATED';
  @uuid(true, true) suiteId?: string | null;
  @fields() customFields?: FieldValueDto[];
}
export class SuiteResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ format: 'uuid' }) projectId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parentSuiteId!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() position!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt!: string | null;
}
export class StepResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ format: 'uuid' }) projectId!: string;
  @ApiProperty({ format: 'uuid' }) testCaseId!: string;
  @ApiProperty() position!: number;
  @ApiProperty() action!: string;
  @ApiProperty({ type: String, nullable: true }) testData!: string | null;
  @ApiProperty({ type: String, nullable: true }) expectedResult!: string | null;
}
export class CaseResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ format: 'uuid' }) projectId!: string;
  @ApiProperty({ format: 'uuid' }) createdBy!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) suiteId!:
    string | null;
  @ApiProperty() sequence!: number;
  @ApiProperty() humanId!: string;
  @ApiProperty() version!: number;
  @text(250) title!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, nullable: true }) preconditions!: string | null;
  @ApiProperty({ type: String, nullable: true }) postconditions!: string | null;
  @choice(SEVERITIES) severity!: (typeof SEVERITIES)[number];
  @choice(PRIORITIES) priority!: (typeof PRIORITIES)[number];
  @choice(CASE_STATUSES) status!: (typeof CASE_STATUSES)[number];
  @choice(TEST_TYPES) type!: (typeof TEST_TYPES)[number];
  @choice(TEST_LAYERS) layer!: (typeof TEST_LAYERS)[number];
  @ApiProperty({ type: String, nullable: true }) behavior!: string | null;
  @choice(AUTOMATION_STATUSES)
  automationStatus!: (typeof AUTOMATION_STATUSES)[number];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt!: string | null;
  @ApiProperty({ type: [StepResponse] }) steps!: StepResponse[];
  @ApiProperty({ type: [String] }) tagIds!: string[];
  @ApiProperty({ type: [String] }) attachmentIds!: string[];
  @ApiProperty({ type: [FieldValueDto] }) customFields!: FieldValueDto[];
}
