import { GoalActionProgressResponse } from '../../governance/api/dtos.js';
import {
  ProgressSummaryResponse,
  ProgressAssessmentResponse,
} from '../../governance/api/progress-dtos.js';
import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsUUID, ValidateIf } from 'class-validator';
import type { DashboardDays, DashboardModule } from '../domain/models.js';
export class DashboardOverviewQuery {
  // The controller declares this mixed query schema explicitly to avoid an Object reference.
  @ApiHideProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^(7|30|90)$/.test(value)
      ? Number(value)
      : value,
  )
  @IsIn([7, 30, 90, 'ALL'], { message: 'Informe 7, 30, 90 ou ALL.' })
  days: DashboardDays = 30;
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'UUID v4 de um Workspace acessível; ausente consolida os acessíveis.',
  })
  @ValidateIf((_o: unknown, value: unknown) => value !== undefined)
  @IsUUID('4', { message: 'Informe UUID v4 válido.' })
  workspaceId?: string;
}
export class DashboardMetricResponse {
  @ApiProperty({ type: Number, minimum: 0, nullable: true }) value!:
    number | null;
  @ApiProperty({ type: Number, minimum: 0, nullable: true }) previousValue!:
    number | null;
}
export class DashboardAutomationMetricResponse {
  @ApiProperty({
    type: Number,
    minimum: 0,
    maximum: 100,
    nullable: true,
    description:
      '100 × casos ACTIVE AUTOMATED / todos os casos ACTIVE não arquivados autorizados; catálogo atual, independente de days. Sem base: null.',
  })
  value!: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    enum: [null],
    description: 'Sempre null: sem histórico confiável do catálogo.',
  })
  previousValue!: null;
}
export class DashboardActiveCasesMetricResponse {
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    nullable: true,
    description:
      'Total global de casos ACTIVE não arquivados com testcase.read, antes do limite de projetos. Catálogo atual independente de days; sem fonte null, inventário autorizado vazio 0.',
  })
  value!: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    enum: [null],
    description: 'Sempre null: sem histórico confiável de status do catálogo.',
  })
  previousValue!: null;
}
export class DashboardMetricsResponse {
  @ApiProperty({ type: DashboardMetricResponse })
  testCases!: DashboardMetricResponse;
  @ApiProperty({ type: DashboardActiveCasesMetricResponse })
  activeTestCases!: DashboardActiveCasesMetricResponse;
  @ApiProperty({ type: DashboardMetricResponse })
  executions!: DashboardMetricResponse;
  @ApiProperty({ type: DashboardMetricResponse })
  defects!: DashboardMetricResponse;
  @ApiProperty({ type: DashboardMetricResponse })
  coverage!: DashboardMetricResponse;
  @ApiProperty({ type: DashboardAutomationMetricResponse })
  automationCoverage!: DashboardAutomationMetricResponse;
}
export class DashboardPeriodResponse {
  @ApiProperty({
    oneOf: [
      { type: 'integer', enum: [7, 30, 90] },
      { type: 'string', enum: ['ALL'] },
    ],
  })
  days!: DashboardDays;
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { type: 'integer', enum: [7, 30, 90] },
        { type: 'string', enum: ['ALL'] },
      ],
    },
    minItems: 4,
    maxItems: 4,
    example: [7, 30, 90, 'ALL'],
  })
  supportedDays!: DashboardDays[];
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'ALL: primeiro instante autorizado de execução, defeito, resultado exercitado ou atividade; null sem histórico.',
  })
  from!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) to!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  previousFrom!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  previousTo!: string | null;
}
export class DashboardResultsResponse {
  @ApiProperty({ type: 'integer', minimum: 0 }) NOT_TESTED!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) PASSED!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) FAILED!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) BLOCKED!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) SKIPPED!: number;
}
export class DashboardDefectsResponse {
  @ApiProperty({ type: 'integer', minimum: 0 }) OPEN!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) IN_PROGRESS!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) RESOLVED!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) CLOSED!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) REJECTED!: number;
}
export class DashboardProjectResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty() workspaceName!: string;
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['ACTIVE', 'ARCHIVED'] }) status!: string;
  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 100 })
  progress!: number | null;
  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 100 })
  coverage!: number | null;
  @ApiProperty({
    type: 'integer',
    nullable: true,
    minimum: 0,
    description:
      'Casos ACTIVE não arquivados atuais. Sem testcase.read: null; base vazia: 0.',
  })
  activeTestCases!: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 100,
    description:
      'Percentual AUTOMATED entre todos os casos ACTIVE não arquivados, incluindo NOT_APPLICABLE no denominador. Sem acesso/base: null.',
  })
  automationCoverage!: number | null;
}
export class DashboardTargetResponse {
  @ApiProperty({
    enum: [
      'TEST_CASES',
      'EXECUTION',
      'DEFECTS',
      'GOVERNANCE',
      'PROJECT',
      'WORKSPACE',
    ],
  })
  module!: DashboardModule;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) projectId!:
    string | null;
}
export class DashboardActivityResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ maxLength: 250 }) title!: string;
  @ApiProperty({ maxLength: 250 }) context!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ type: DashboardTargetResponse })
  target!: DashboardTargetResponse;
}
export class DashboardGoalResponse {
  @ApiProperty({ type: GoalActionProgressResponse })
  actionProgress!: GoalActionProgressResponse;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) frameworkId!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) sectionId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) sectionName!: string | null;
  @ApiProperty({ type: String, nullable: true }) ownerDisplayName!:
    string | null;
  @ApiProperty({ type: Number, nullable: true }) currentValue!: number | null;
  @ApiProperty({ type: Number }) targetValue!: number;
  @ApiProperty({ type: String, format: 'date', nullable: true }) deadline!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  calculatedAt!: string | null;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) frameworkName!: string | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 100,
    description:
      'Conclusão das ações válidas: mesmo valor de actionProgress.percent; independente de targetValue/operator/lastResult.',
  })
  progress!: number | null;
  @ApiProperty({ maxLength: 250 }) detail!: string;
  @ApiProperty({ enum: ['ACTIVE', 'ACHIEVED', 'MISSED', 'CANCELLED'] })
  status!: string;
}
export class DashboardDocumentResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) versionLabel!: string | null;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class DashboardFrameworkSectionResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: ProgressSummaryResponse })
  summary!: ProgressSummaryResponse;
}
export class DashboardFrameworkResponse {
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty() workspaceName!: string;
  @ApiProperty({ format: 'uuid' }) frameworkId!: string;
  @ApiProperty() frameworkName!: string;
  @ApiProperty({ enum: ['NO_ASSESSMENT', 'DRAFT', 'IN_PROGRESS', 'CLOSED'] })
  state!: string;
  @ApiProperty({ type: ProgressAssessmentResponse, nullable: true })
  assessment!: ProgressAssessmentResponse | null;
  @ApiProperty({ type: Boolean }) definitionVersionDiffers!: boolean;
  @ApiProperty({ type: ProgressSummaryResponse, nullable: true })
  summary!: ProgressSummaryResponse | null;
  @ApiProperty({ type: [DashboardFrameworkSectionResponse], maxItems: 500 })
  sections!: DashboardFrameworkSectionResponse[];
}
export class FrameworkAttentionResponse {
  @ApiProperty({ type: 'integer', minimum: 0 }) notAssessedControls!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) notMetControls!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) partiallyMetControls!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) expiredEvidence!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) upcomingGoals!: number;
}
export class DashboardFrameworkGovernanceResponse {
  @ApiProperty({ enum: ['INTERNAL'] }) indicatorType!: string;
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) frameworkCount!: number;
  @ApiProperty({ type: 'integer', minimum: 0 })
  frameworksWithAssessment!: number;
  @ApiProperty({ type: ProgressSummaryResponse, nullable: true })
  overall!: ProgressSummaryResponse | null;
  @ApiProperty({ type: [DashboardFrameworkResponse] })
  frameworks!: DashboardFrameworkResponse[];
  @ApiProperty({ type: FrameworkAttentionResponse })
  attention!: FrameworkAttentionResponse;
}
export class DashboardOverviewResponse {
  @ApiProperty({ type: DashboardFrameworkGovernanceResponse, nullable: true })
  frameworkGovernance!: DashboardFrameworkGovernanceResponse | null;
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty({ type: DashboardPeriodResponse })
  period!: DashboardPeriodResponse;
  @ApiProperty({ type: DashboardMetricsResponse })
  metrics!: DashboardMetricsResponse;
  @ApiProperty({ type: DashboardResultsResponse, nullable: true })
  results!: DashboardResultsResponse | null;
  @ApiProperty({ type: DashboardDefectsResponse, nullable: true })
  defectsByStatus!: DashboardDefectsResponse | null;
  @ApiProperty({
    type: [DashboardProjectResponse],
    nullable: true,
    maxItems: 10,
  })
  projects!: DashboardProjectResponse[] | null;
  @ApiProperty({
    type: [DashboardActivityResponse],
    nullable: true,
    maxItems: 10,
  })
  activity!: DashboardActivityResponse[] | null;
  @ApiProperty({ type: [DashboardGoalResponse], nullable: true, maxItems: 6 })
  governance!: DashboardGoalResponse[] | null;
  @ApiProperty({
    type: [DashboardDocumentResponse],
    nullable: true,
    maxItems: 6,
  })
  documents!: DashboardDocumentResponse[] | null;
}
