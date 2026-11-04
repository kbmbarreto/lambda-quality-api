import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PERMISSIONS } from '../domain/models.js';
import { FIELD_TYPES } from '../../testmanagement/domain/catalogs.js';
const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
const optional = () =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);
export class EmptyBody {}
function name(opt = false) {
  return applyDecorators(
    ApiProperty({ minLength: 1, maxLength: 100, required: !opt }),
    trim(),
    ...(opt ? [optional()] : []),
    IsString({ message: 'Informe um texto válido.' }),
    Length(1, 100, { message: 'Informe entre 1 e 100 caracteres.' }),
  );
}
function description() {
  return applyDecorators(
    ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 }),
    IsOptional(),
    IsString(),
    MaxLength(500),
  );
}
export class PageQuery {
  @ApiPropertyOptional({
    type: Number,
    default: 1,
    minimum: 1,
    maximum: 100000,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;
  @ApiPropertyOptional({ type: Number, default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size: number = 20;
  @ApiPropertyOptional({
    example: 'createdAt,desc',
    description: 'Campo permitido por operação, seguido de asc ou desc.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z]+,(asc|desc)$/)
  sort?: string;
}
export class ListQuery extends PageQuery {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @trim()
  @IsString()
  @Length(1, 100)
  q?: string;
}
export class MemberQuery extends ListQuery {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED', 'REMOVED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'REMOVED'])
  status?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  roleId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  groupId?: string;
}
export class InvitationQuery extends ListQuery {
  @ApiPropertyOptional({ enum: ['PENDING', 'ACCEPTED', 'CANCELED', 'EXPIRED'] })
  @IsOptional()
  @IsIn(['PENDING', 'ACCEPTED', 'CANCELED', 'EXPIRED'])
  status?: string;
}
export class FieldQuery extends ListQuery {
  @ApiPropertyOptional({
    enum: ['ACTIVE', 'ARCHIVED', 'ALL'],
    default: 'ACTIVE',
  })
  @IsIn(['ACTIVE', 'ARCHIVED', 'ALL'])
  status: string = 'ACTIVE';
}
export class CreateWorkspaceDto {
  @name() name!: string;
  @ApiProperty({ minLength: 3, maxLength: 80, example: 'minha-equipe' })
  @trim()
  @IsString()
  @Length(3, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Use letras minúsculas, números e hífens no slug.',
  })
  slug!: string;
}
export class UpdateWorkspaceDto {
  @name(true) name?: string;
  @ApiPropertyOptional({ minLength: 3, maxLength: 80 })
  @optional()
  @IsString()
  @Length(3, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;
}
export class TransferDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') memberId!: string;
}
export class MemberStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] })
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'SUSPENDED';
}
export class InviteDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  @trim()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(254)
  email!: string;
}
export class AcceptInviteDto {
  @ApiProperty({
    minLength: 43,
    maxLength: 43,
    description: 'Token recebido por e-mail; nunca armazenar em URL da API.',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}
export class CreateRoleDto {
  @name() name!: string;
  @description() description?: string | null;
  @ApiProperty({ enum: [...PERMISSIONS], isArray: true })
  @IsArray()
  @ArrayMaxSize(12)
  @ArrayUnique()
  @IsIn(PERMISSIONS, { each: true })
  permissionCodes!: string[];
}
export class UpdateRoleDto {
  @name(true) name?: string;
  @description() description?: string | null;
  @ApiPropertyOptional({ enum: [...PERMISSIONS], isArray: true })
  @optional()
  @IsArray()
  @ArrayMaxSize(12)
  @ArrayUnique()
  @IsIn(PERMISSIONS, { each: true })
  permissionCodes?: string[];
}
export class CreateGroupDto {
  @name() name!: string;
  @description() description?: string | null;
}
export class UpdateGroupDto {
  @name(true) name?: string;
  @description() description?: string | null;
}
export class CreateFieldDto {
  @ApiProperty({ maxLength: 80, example: 'business_impact' })
  @IsString()
  @Length(1, 80)
  @Matches(/^[a-z][a-z0-9_]*$/)
  key!: string;
  @name() name!: string;
  @description() description?: string | null;
  @ApiProperty({ enum: [...FIELD_TYPES] })
  @IsIn(FIELD_TYPES)
  type!: (typeof FIELD_TYPES)[number];
  @ApiProperty({ enum: ['TEST_CASE'] })
  @IsIn(['TEST_CASE'])
  target!: 'TEST_CASE';
  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsBoolean()
  required: boolean = false;
  @ApiPropertyOptional({
    type: Number,
    default: 0,
    minimum: 0,
    maximum: 100000,
  })
  @IsInt()
  @Min(0)
  @Max(100000)
  position: number = 0;
  @ApiPropertyOptional({
    type: [String],
    default: [],
    maxItems: 50,
    description:
      'Labels distintas; somente para SINGLE_SELECT. IDs gerados na resposta.',
  })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((v: unknown) => (typeof v === 'string' ? v.trim() : v))
      : value,
  )
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  options: string[] = [];
}
export class UpdateFieldDto {
  @name(true) name?: string;
  @description() description?: string | null;
  @ApiPropertyOptional() @optional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional({ minimum: 0, maximum: 100000 })
  @optional()
  @IsInt()
  @Min(0)
  @Max(100000)
  position?: number;
}
export class TagDto {
  @name() name!: string;
}

export class WorkspaceResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] }) status!: string;
  @ApiProperty({ format: 'uuid' }) ownerMemberId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiPropertyOptional({ format: 'uuid' }) memberId?: string;
  @ApiPropertyOptional() isOwner?: boolean;
  @ApiPropertyOptional({ enum: [...PERMISSIONS], isArray: true })
  permissions?: string[];
}
export class DirectoryUserResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) emailVerifiedAt!: string;
}
export class RoleOriginResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['DIRECT', 'GROUP'] }) source!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) groupId!:
    string | null;
}
export class GroupReferenceResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}
export class MembershipResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'REMOVED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) joinedAt!: string;
}
export class MemberResponse extends MembershipResponse {
  @ApiProperty({ type: DirectoryUserResponse }) user!: DirectoryUserResponse;
  @ApiProperty() isOwner!: boolean;
  @ApiProperty({ type: [RoleOriginResponse] }) roles!: RoleOriginResponse[];
  @ApiProperty({ type: [GroupReferenceResponse] })
  groups!: GroupReferenceResponse[];
}
export class InvitationResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty({ enum: ['PENDING', 'ACCEPTED', 'CANCELED', 'EXPIRED'] })
  status!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ format: 'uuid' }) invitedBy!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  acceptedAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) lastSentAt!: string;
  @ApiProperty({ enum: ['PENDING', 'SENT', 'FAILED'] }) deliveryStatus!: string;
}
export class PermissionResponse {
  @ApiProperty({ enum: [...PERMISSIONS] }) code!: string;
  @ApiProperty() description!: string;
}
export class PermissionCatalogResponse {
  @ApiProperty({ type: [PermissionResponse] })
  permissions!: PermissionResponse[];
}
export class RoleResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() systemRole!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ enum: [...PERMISSIONS], isArray: true })
  permissionCodes!: string[];
}
export class GroupResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: [String] }) roleIds!: string[];
  @ApiProperty() memberCount!: number;
}
export class GroupParticipantResponse {
  @ApiProperty({ format: 'uuid' }) memberId!: string;
}
export class FieldOptionResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() label!: string;
}
export class FieldResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: [...FIELD_TYPES] }) type!: string;
  @ApiProperty({ enum: ['TEST_CASE'] }) target!: string;
  @ApiProperty() required!: boolean;
  @ApiProperty() position!: number;
  @ApiProperty({ type: [FieldOptionResponse] }) options!: FieldOptionResponse[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class TagResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class AttachmentResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty() originalName!: string;
  @ApiProperty({
    enum: [
      'image/png',
      'image/jpeg',
      'application/pdf',
      'text/plain',
      'text/csv',
    ],
  })
  contentType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty({ description: 'SHA-256 hexadecimal.' }) checksum!: string;
  @ApiProperty({ format: 'uuid' }) uploadedBy!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
