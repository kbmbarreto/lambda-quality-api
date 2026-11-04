import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  Length,
  MaxLength,
  IsOptional,
  ValidateIf,
  Matches,
  IsIn,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import {
  ListQuery,
  PageQuery,
  DirectoryUserResponse,
} from '../../workspace/api/dtos.js';
import { ENVIRONMENT_CATEGORIES, PROJECT_ROLES } from '../domain/models.js';
export { EmptyBody } from '../../workspace/api/dtos.js';
const optional = () => ValidateIf((_o: unknown, v: unknown) => v !== undefined);
const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
const name = (opt = false) =>
  applyDecorators(
    ApiProperty({ type: String, minLength: 1, maxLength: 100, required: !opt }),
    ...(opt ? [optional()] : []),
    trim(),
    IsString({ message: 'Informe um texto válido.' }),
    Length(1, 100, { message: 'Informe entre 1 e 100 caracteres.' }),
  );
const description = () =>
  applyDecorators(
    ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 }),
    IsOptional(),
    IsString({ message: 'Informe um texto válido.' }),
    MaxLength(500, { message: 'Informe até 500 caracteres.' }),
  );
const date = () =>
  applyDecorators(
    ApiPropertyOptional({ type: String, format: 'date', nullable: true }),
    IsOptional(),
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use uma data YYYY-MM-DD.' }),
    IsDateString({ strict: true }, { message: 'Informe uma data válida.' }),
  );
export class CreateProjectDto {
  @ApiProperty({
    minLength: 2,
    maxLength: 12,
    pattern: '^[A-Z][A-Z0-9_]*$',
    example: 'PORTAL',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'Informe uma chave em texto.' })
  @Length(2, 12, { message: 'A chave deve ter entre 2 e 12 caracteres.' })
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'A chave deve iniciar com letra e conter letras, números ou underscore.',
  })
  key!: string;
  @name() name!: string;
  @description() description?: string | null;
}
export class UpdateProjectDto {
  @name(true) name?: string;
  @description() description?: string | null;
}
export class ProjectQuery extends ListQuery {
  @ApiPropertyOptional({
    enum: ['ACTIVE', 'ARCHIVED', 'ALL'],
    default: 'ACTIVE',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED', 'ALL'], {
    message: 'Informe ACTIVE, ARCHIVED ou ALL.',
  })
  status?: string;
}
export class ProjectMemberQuery extends PageQuery {}
export class AssignProjectMemberDto {
  @ApiProperty({ enum: PROJECT_ROLES })
  @IsIn(PROJECT_ROLES, { message: 'Informe VIEWER, EDITOR ou MANAGER.' })
  projectRole!: (typeof PROJECT_ROLES)[number];
}
export class CreateMilestoneDto {
  @name() name!: string;
  @description() description?: string | null;
  @date() startDate?: string | null;
  @date() dueDate?: string | null;
}
export class UpdateMilestoneDto {
  @name(true) name?: string;
  @description() description?: string | null;
  @date() startDate?: string | null;
  @date() dueDate?: string | null;
  @ApiPropertyOptional({ enum: ['PLANNED', 'IN_PROGRESS', 'CANCELLED'] })
  @optional()
  @IsIn(['PLANNED', 'IN_PROGRESS', 'CANCELLED'], {
    message: 'Informe PLANNED, IN_PROGRESS ou CANCELLED.',
  })
  status?: 'PLANNED' | 'IN_PROGRESS' | 'CANCELLED';
}
export class MilestoneQuery extends ListQuery {
  @ApiPropertyOptional({
    enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ALL'],
  })
  @IsOptional()
  @IsIn(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ALL'], {
    message: 'Informe um estado permitido para o marco.',
  })
  status?: string;
}
export class CreateEnvironmentDto {
  @ApiPropertyOptional({ enum: ENVIRONMENT_CATEGORIES, default: 'OTHER' })
  @optional()
  @IsIn(ENVIRONMENT_CATEGORIES, { message: 'Informe uma categoria válida.' })
  category?: (typeof ENVIRONMENT_CATEGORIES)[number];
  @name() name!: string;
  @description() description?: string | null;
  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsBoolean({ message: 'Informe true ou false.' })
  active: boolean = true;
}
export class UpdateEnvironmentDto {
  @ApiPropertyOptional({ enum: ENVIRONMENT_CATEGORIES })
  @optional()
  @IsIn(ENVIRONMENT_CATEGORIES, { message: 'Informe uma categoria válida.' })
  category?: (typeof ENVIRONMENT_CATEGORIES)[number];
  @name(true) name?: string;
  @description() description?: string | null;
  @ApiPropertyOptional({ type: Boolean })
  @optional()
  @IsBoolean({ message: 'Informe true ou false.' })
  active?: boolean;
}
export class EnvironmentQuery extends ListQuery {
  @ApiPropertyOptional({
    type: Boolean,
    description: 'true/false; ausente inclui ativos e inativos.',
  })
  @optional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'Informe true ou false.' })
  active?: boolean;
}
export class ProjectResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'ARCHIVED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt!: string | null;
  @ApiProperty({ type: String, enum: PROJECT_ROLES, nullable: true })
  projectRole!: string | null;
  @ApiProperty({
    type: [String],
    description: 'Permissions efetivas no projeto, para UI; backend revalida.',
  })
  permissions!: string[];
}
export class ProjectMemberResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ format: 'uuid' }) projectId!: string;
  @ApiProperty({ format: 'uuid' }) workspaceMemberId!: string;
  @ApiProperty({ enum: PROJECT_ROLES }) projectRole!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class ProjectMemberListResponse extends ProjectMemberResponse {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] })
  workspaceMemberStatus!: string;
  @ApiProperty({ type: DirectoryUserResponse }) user!: DirectoryUserResponse;
}
export class MilestoneResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ format: 'uuid' }) projectId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] })
  status!: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) startDate!:
    string | null;
  @ApiProperty({ type: String, format: 'date', nullable: true }) dueDate!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deletedAt!: string | null;
}
export class EnvironmentResponse {
  @ApiProperty({ enum: ENVIRONMENT_CATEGORIES }) category!: string;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ format: 'uuid' }) projectId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() active!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deletedAt!: string | null;
}
