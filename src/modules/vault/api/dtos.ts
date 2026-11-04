import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsString,
  Length,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ListQuery } from '../../workspace/api/dtos.js';
const text = (max: number, min = 0, optional = false, trim = false) =>
  applyDecorators(
    ApiProperty({
      type: String,
      maxLength: max,
      minLength: min,
      required: !optional,
    }),
    ...(optional
      ? [ValidateIf((_o: unknown, v: unknown) => v !== undefined)]
      : []),
    ...(trim
      ? [
          Transform(({ value }: { value: unknown }) =>
            typeof value === 'string' ? value.trim() : value,
          ),
        ]
      : []),
    IsString({ message: 'Informe um texto válido.' }),
    Length(min, max, { message: `Informe entre ${min} e ${max} caracteres.` }),
  );
export class VaultSecretDto {
  @text(1000) username!: string;
  @text(2000) password!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: 2048,
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Informe um texto válido.' })
  @Length(0, 2048, { message: 'Informe até 2048 caracteres.' })
  url: string | null = null;
  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: 10000,
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Informe um texto válido.' })
  @Length(0, 10000, { message: 'Informe até 10000 caracteres.' })
  notes: string | null = null;
}
export class CreateVaultDto extends VaultSecretDto {
  @text(100, 1, false, true) name!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'Informe UUID v4 válido.' })
  environmentId?: string | null;
}
export class VaultVersionDto {
  @ApiProperty({ minimum: 1, maximum: 2147483647 })
  @Type(() => Number)
  @IsInt({ message: 'Informe uma versão inteira.' })
  @Min(1, { message: 'A versão deve ser positiva.' })
  @Max(2147483647, { message: 'Versão acima do limite permitido.' })
  version!: number;
}
export class UpdateVaultDto extends VaultVersionDto {
  @text(100, 1, true, true) name?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'Informe UUID v4 válido.' })
  environmentId?: string | null;
  @ApiPropertyOptional({
    type: VaultSecretDto,
    description: 'Substituição completa dos dados sensíveis; ausente preserva.',
  })
  @ValidateIf((_o: unknown, v: unknown) => v !== undefined)
  @IsObject({ message: 'Informe um objeto com os dados sensíveis.' })
  @ValidateNested({ message: 'Informe dados sensíveis válidos.' })
  @Type(() => VaultSecretDto)
  secret?: VaultSecretDto;
}
export class VaultQuery extends ListQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe UUID v4 válido.' })
  environmentId?: string;
}
export class VaultEntryResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ format: 'uuid' }) projectId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) environmentId!:
    string | null;
  @ApiProperty() name!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'uuid' }) createdBy!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true }) deletedAt!:
    string | null;
}
export class VaultRevealResponse extends VaultSecretDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() version!: number;
}
export class VaultEmptyDto {}
