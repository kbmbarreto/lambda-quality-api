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
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
} from 'class-validator';
import { ListQuery } from '../../workspace/api/dtos.js';
import { VersionDto } from '../../testmanagement/api/dtos.js';
import { SEVERITIES } from '../../testmanagement/domain/models.js';
import { DEFECT_STATUSES } from '../domain/models.js';
import type { Defect } from '../domain/models.js';
import { validExternalUrl } from '../domain/rules.js';
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
const uuid = (opt = false, nullable = false) =>
  applyDecorators(
    ApiProperty({ type: String, format: 'uuid', required: !opt, nullable }),
    ...(nullable ? [IsOptional()] : opt ? [optional()] : []),
    IsUUID('4', { message: 'Informe UUID v4 válido.' }),
  );
const severity = () =>
  applyDecorators(
    ApiPropertyOptional({ type: String, enum: SEVERITIES }),
    optional(),
    IsIn(SEVERITIES, { message: 'Informe uma severidade válida.' }),
  );
class DefectDetailsDto {
  @uuid(true, true) environmentId?: string | null;
  @text(10000, true, true) description?: string | null;
  @severity() severity?: Defect['severity'];
  @ApiPropertyOptional({
    type: [String],
    maxItems: 100,
    description: 'UUID v4 de arquivos privados, distintos; padrão [].',
  })
  @optional()
  @IsArray({ message: 'Informe uma lista de anexos.' })
  @ArrayMaxSize(100, { message: 'Informe até 100 anexos.' })
  @ArrayUnique({ message: 'Não repita anexos.' })
  @IsUUID('4', { each: true, message: 'Informe UUIDs v4 válidos.' })
  attachmentIds?: string[];
}
export class CreateDefectDto extends DefectDetailsDto {
  @text(250) title!: string;
  @uuid(true, true) testRunCaseId?: string | null;
}
export class CreateFailureDefectDto extends DefectDetailsDto {
  @text(250, true) title?: string;
  @uuid() testRunCaseId!: string;
}
export class UpdateDefectDto extends VersionDto {
  @text(10000, true) comment?: string;
  @uuid(true, true) environmentId?: string | null;
  @text(250, true) title?: string;
  @text(10000, true, true) description?: string | null;
  @severity() severity?: Defect['severity'];
  @ApiPropertyOptional({ type: String, enum: DEFECT_STATUSES })
  @optional()
  @IsIn(DEFECT_STATUSES, { message: 'Informe um estado válido.' })
  status?: Defect['status'];
}
export class ExternalLinkDto extends VersionDto {
  @text(50) externalSystem!: string;
  @text(250) externalIssueId!: string;
  @ApiProperty({
    type: String,
    maxLength: 2048,
    format: 'uri',
    description:
      'URL HTTP/HTTPS absoluta sem credenciais; somente referência, sem consulta remota.',
  })
  @ValidateBy(
    { name: 'externalUrl', validator: { validate: validExternalUrl } },
    { message: 'Informe URL HTTP/HTTPS absoluta, sem credenciais.' },
  )
  externalUrl!: string;
}
export class AddDefectAttachmentDto extends VersionDto {
  @uuid() attachmentId!: string;
}
export class DefectQuery extends ListQuery {
  @uuid(true) environmentId?: string;
  @ApiPropertyOptional({ type: String, enum: [...DEFECT_STATUSES, 'ALL'] })
  @optional()
  @IsIn([...DEFECT_STATUSES, 'ALL'], { message: 'Informe um estado válido.' })
  status?: string;
  @severity() severity?: Defect['severity'];
  @uuid(true) testRunCaseId?: string;
}
export class DefectEnvironmentResponse {
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['PRODUCTION', 'HOMOLOGATION', 'OTHER'] })
  category!: string;
}
export class DefectResponse {
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Marco de conclusão do ciclo atual: resolução ou fechamento sem resolução anterior. null para legados sem fonte confiável, reabertura ou rejeição; fechar preserva resolução existente.',
  })
  resolvedAt!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  environmentId!: string | null;
  @ApiProperty({ type: DefectEnvironmentResponse, nullable: true })
  environmentSnapshot!: DefectEnvironmentResponse | null;
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) projectId!: string;
  @ApiProperty({ type: Number }) sequence!: number;
  @ApiProperty({ type: String }) humanId!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, enum: SEVERITIES }) severity!: string;
  @ApiProperty({ type: String, enum: DEFECT_STATUSES }) status!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  testRunCaseId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) testRunId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) externalSystem!: string | null;
  @ApiProperty({ type: String, nullable: true }) externalIssueId!:
    string | null;
  @ApiProperty({ type: String, format: 'uri', nullable: true }) externalUrl!:
    string | null;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, format: 'uuid' }) createdBy!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty({
    type: [String],
    description: 'IDs de anexos disponíveis; download exige attachment.read.',
  })
  attachmentIds!: string[];
}
