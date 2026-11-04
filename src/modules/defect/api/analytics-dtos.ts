import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsUUID, ValidateBy, ValidateIf } from 'class-validator';
import { validDate } from '../../../shared/domain/calendar-date.js';
import { DEFECT_ENVIRONMENT_CATEGORIES } from '../domain/analytics.js';
import type { DefectEnvironmentCategory } from '../domain/analytics.js';
export class DefectAnalyticsQuery {
  @ApiProperty({ format: 'date' })
  @ValidateBy(
    { name: 'calendarDate', validator: { validate: validDate } },
    { message: 'Informe uma data real YYYY-MM-DD.' },
  )
  from!: string;
  @ApiProperty({ format: 'date' })
  @ValidateBy(
    { name: 'calendarDate', validator: { validate: validDate } },
    { message: 'Informe uma data real YYYY-MM-DD.' },
  )
  to!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o: unknown, v: unknown) => v !== undefined)
  @IsUUID('4', { message: 'Informe UUID v4 válido.' })
  projectId?: string;
  @ApiPropertyOptional({ enum: DEFECT_ENVIRONMENT_CATEGORIES })
  @ValidateIf((_o: unknown, v: unknown) => v !== undefined)
  @IsIn(DEFECT_ENVIRONMENT_CATEGORIES, {
    message: 'Informe uma categoria válida.',
  })
  category?: DefectEnvironmentCategory;
}
export class DefectCategoryCountsResponse {
  @ApiProperty({ type: 'integer', minimum: 0 }) PRODUCTION!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) HOMOLOGATION!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) OTHER!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) UNSPECIFIED!: number;
}
export class DefectStatusCountsResponse {
  @ApiProperty({ type: 'integer', minimum: 0 }) OPEN!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) IN_PROGRESS!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) RESOLVED!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) CLOSED!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) REJECTED!: number;
}
export class DefectAnalyticsPeriodResponse {
  @ApiProperty({ format: 'date' }) from!: string;
  @ApiProperty({ format: 'date' }) to!: string;
  @ApiProperty({ enum: ['createdAt'] }) dateField!: string;
  @ApiProperty({ enum: ['UTC'] }) timezone!: string;
}
export class DefectMonthlyResponse {
  @ApiProperty({ pattern: '^\\d{4}-\\d{2}$' }) month!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) totalBugs!: number;
  @ApiProperty({ type: DefectCategoryCountsResponse })
  byCategory!: DefectCategoryCountsResponse;
}
export class DefectProjectCountsResponse {
  @ApiProperty({ format: 'uuid' }) projectId!: string;
  @ApiProperty() projectKey!: string;
  @ApiProperty() projectName!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) totalBugs!: number;
  @ApiProperty({ type: DefectCategoryCountsResponse })
  byCategory!: DefectCategoryCountsResponse;
}
export class DefectEnvironmentCountsResponse {
  @ApiProperty({ format: 'uuid' }) projectId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  environmentId!: string | null;
  @ApiProperty({ type: String, nullable: true }) name!: string | null;
  @ApiProperty({ enum: DEFECT_ENVIRONMENT_CATEGORIES }) category!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) totalBugs!: number;
}
export class DefectAnalyticsResponse {
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty({ type: DefectAnalyticsPeriodResponse })
  period!: DefectAnalyticsPeriodResponse;
  @ApiProperty({ type: 'integer', minimum: 0 }) totalBugs!: number;
  @ApiProperty({ type: DefectStatusCountsResponse })
  byStatus!: DefectStatusCountsResponse;
  @ApiProperty({ type: DefectCategoryCountsResponse })
  byCategory!: DefectCategoryCountsResponse;
  @ApiProperty({ type: [DefectMonthlyResponse], maxItems: 36 })
  monthly!: DefectMonthlyResponse[];
  @ApiProperty({ type: [DefectProjectCountsResponse] })
  byProject!: DefectProjectCountsResponse[];
  @ApiProperty({ type: [DefectEnvironmentCountsResponse] })
  byEnvironment!: DefectEnvironmentCountsResponse[];
}
