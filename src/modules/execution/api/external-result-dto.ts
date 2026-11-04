import { ApiProperty } from '@nestjs/swagger';
export class ExternalResultResponse {
  @ApiProperty({ enum: ['JUNIT'] }) origin!: string;
  @ApiProperty({ format: 'uuid' }) importId!: string;
  @ApiProperty() itemId!: number;
  @ApiProperty() fileName!: string;
  @ApiProperty() fileHash!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) className!: string | null;
  @ApiProperty({ type: String, nullable: true }) details!: string | null;
}
