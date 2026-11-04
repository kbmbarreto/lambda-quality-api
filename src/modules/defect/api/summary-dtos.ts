import { ApiProperty } from '@nestjs/swagger';

export class DefectSummaryStatusCountsResponse {
  @ApiProperty({ type: 'integer', minimum: 0 }) OPEN!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) IN_PROGRESS!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) RESOLVED!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) CLOSED!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) REJECTED!: number;
}
export class DefectSummaryCategoryCountsResponse {
  @ApiProperty({ type: 'integer', minimum: 0 }) HOMOLOGATION!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) PRODUCTION!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) OTHER!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) UNSPECIFIED!: number;
}
export class DefectResolutionTimeResponse {
  @ApiProperty({
    type: Number,
    nullable: true,
    minimum: 0,
    description:
      'Média global em horas corridas UTC, até duas casas; null sem amostra confiável.',
  })
  averageHours!: number | null;
  @ApiProperty({ type: 'integer', minimum: 0 }) sampleSize!: number;
  @ApiProperty({ enum: ['CREATED_TO_RESOLVED'] }) basis!: 'CREATED_TO_RESOLVED';
}
export class DefectSummaryResponse {
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) totalBugs!: number;
  @ApiProperty({ type: DefectSummaryStatusCountsResponse })
  byStatus!: DefectSummaryStatusCountsResponse;
  @ApiProperty({ type: DefectSummaryCategoryCountsResponse })
  byCategory!: DefectSummaryCategoryCountsResponse;
  @ApiProperty({
    type: DefectResolutionTimeResponse,
    nullable: true,
    description:
      'Fonte disponível nesta versão; sem amostra retorna objeto com média null. null reservado para fonte indisponível, sem substituir falhas HTTP.',
  })
  resolutionTime!: DefectResolutionTimeResponse | null;
}
