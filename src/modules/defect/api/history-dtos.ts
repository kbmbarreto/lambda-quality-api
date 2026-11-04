import { ApiProperty } from '@nestjs/swagger';
import { PageQuery } from '../../workspace/api/dtos.js';
import { DEFECT_STATUSES } from '../domain/models.js';
export class DefectHistoryQuery extends PageQuery {}
export class DefectHistoryActorResponse {
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'ID histórico do usuário; null somente quando não disponível na auditoria legada.',
  })
  id!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Snapshot do nome; nunca email. null quando desconhecido.',
  })
  displayName!: string | null;
}
export class DefectHistoryResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['CREATED', 'UPDATED'] }) type!: 'CREATED' | 'UPDATED';
  @ApiProperty({ type: DefectHistoryActorResponse })
  actor!: DefectHistoryActorResponse;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, enum: DEFECT_STATUSES, nullable: true })
  fromStatus!: string | null;
  @ApiProperty({ type: String, enum: DEFECT_STATUSES, nullable: true })
  toStatus!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: 10000,
    description: 'Texto simples; null sem comentário.',
  })
  comment!: string | null;
}
