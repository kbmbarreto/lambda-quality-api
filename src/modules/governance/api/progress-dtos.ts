import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';
export class FrameworkProgressQuery {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @ValidateIf((_o: unknown, v: unknown) => v !== undefined)
  @IsUUID('4', { message: 'Informe UUID v4 válido.' })
  assessmentId?: string;
}
export class ProgressCountsResponse {
  @ApiProperty({ type: 'integer', minimum: 0 }) NOT_ASSESSED!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) NOT_MET!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) PARTIALLY_MET!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) MET!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) NOT_APPLICABLE!: number;
}
export class ProgressIndexResponse {
  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 100 })
  value!: number | null;
  @ApiProperty({ type: Number, minimum: 0 }) numerator!: number;
  @ApiProperty({ type: Number, minimum: 0 }) denominator!: number;
}
export class ProgressSummaryResponse {
  @ApiProperty({ enum: ['EMPTY', 'NOT_APPLICABLE', 'AVAILABLE'] })
  state!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) totalControls!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) applicableControls!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) assessedControls!: number;
  @ApiProperty({ type: ProgressCountsResponse })
  counts!: ProgressCountsResponse;
  @ApiProperty({ type: ProgressIndexResponse }) index!: ProgressIndexResponse;
  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 100 })
  completionPercent!: number | null;
  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 100 })
  assessmentPercent!: number | null;
  @ApiProperty({ type: Boolean }) completed!: boolean;
}
export class ProgressFrameworkResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) version!: number;
}
export class ProgressAssessmentResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['DRAFT', 'IN_PROGRESS', 'CLOSED'] }) status!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) version!: number;
  @ApiProperty({ type: 'integer', minimum: 1 }) definitionVersion!: number;
  @ApiProperty({ format: 'date' }) assessmentDate!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  closedAt!: string | null;
}
export class ProgressSectionResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parentSectionId!: string | null;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) position!: number;
  @ApiProperty({ type: ProgressSummaryResponse })
  direct!: ProgressSummaryResponse;
  @ApiProperty({ type: ProgressSummaryResponse })
  subtree!: ProgressSummaryResponse;
}
export class FrameworkProgressResponse {
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty({ enum: ['INTERNAL'] }) indicatorType!: string;
  @ApiProperty({ enum: ['NO_ASSESSMENT', 'DRAFT', 'IN_PROGRESS', 'CLOSED'] })
  state!: string;
  @ApiProperty({ type: ProgressFrameworkResponse })
  framework!: ProgressFrameworkResponse;
  @ApiProperty({ type: ProgressAssessmentResponse, nullable: true })
  assessment!: ProgressAssessmentResponse | null;
  @ApiProperty({ type: Boolean }) definitionVersionDiffers!: boolean;
  @ApiProperty({ type: ProgressSummaryResponse, nullable: true })
  summary!: ProgressSummaryResponse | null;
  @ApiProperty({ type: [ProgressSectionResponse], maxItems: 500 })
  sections!: ProgressSectionResponse[];
}
