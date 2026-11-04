import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsBoolean,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { VersionDto } from '../../testmanagement/api/dtos.js';
import { RunResponse } from './dtos.js';

export class ResultMappingDto {
  @ApiProperty({ minimum: 1, maximum: 500 })
  @IsInt()
  @Min(1)
  @Max(500)
  itemId!: number;
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') runCaseId!: string;
}
export class ApplyResultImportDto extends VersionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') requestKey!: string;
  @ApiPropertyOptional({ default: false })
  @ValidateIf((_o: unknown, v: unknown) => v !== undefined)
  @IsBoolean()
  overwrite = false;
  @ApiProperty({ type: [ResultMappingDto], minItems: 1, maxItems: 500 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ResultMappingDto)
  mappings!: ResultMappingDto[];
}
export class ImportItemResponse {
  @ApiProperty() itemId!: number;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) className!: string | null;
  @ApiProperty({ enum: ['PASSED', 'FAILED', 'SKIPPED'] }) result!: string;
  @ApiProperty({ type: [String] }) caseIds!: string[];
  @ApiProperty({ type: [String] }) humanIds!: string[];
  @ApiProperty({ type: String, nullable: true }) details!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  proposedRunCaseId!: string | null;
  @ApiProperty({
    type: [String],
    description:
      'Avisos da associação automática; exigem revisão e mapeamento explícito.',
  })
  blockers!: string[];
}
export class ResultImportResponse {
  @ApiProperty({ format: 'uuid' }) previewId!: string;
  @ApiProperty({ format: 'uuid' }) runId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() fileName!: string;
  @ApiProperty() fileHash!: string;
  @ApiProperty({ enum: ['JUNIT'] }) tool!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ enum: ['PREVIEW', 'EXPIRED', 'APPLIED'] }) status!: string;
  @ApiProperty({ type: [ImportItemResponse] }) items!: ImportItemResponse[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  appliedAt!: string | null;
  @ApiProperty({ type: Number, nullable: true }) appliedVersion!: number | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) requestKey!:
    string | null;
  @ApiProperty({ type: [ResultMappingDto], nullable: true }) mappings!:
    ResultMappingDto[] | null;
  @ApiProperty() importedCount!: number;
}
export class ApplyResultImportResponse {
  @ApiProperty({ type: RunResponse }) run!: RunResponse;
  @ApiProperty({ type: ResultImportResponse }) import!: ResultImportResponse;
  @ApiProperty() alreadyApplied!: boolean;
}
