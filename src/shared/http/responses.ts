import { applyDecorators, SetMetadata } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Type } from '@nestjs/common';
export const RESPONSE_MESSAGE = 'responseMessage';
export class ResponseMeta {
  @ApiProperty({ format: 'uuid' }) requestId!: string;
  @ApiProperty({
    format: 'date-time',
    description:
      'ISO 8601 com offset -03:00; mesmo instante armazenado em UTC.',
  })
  timestamp!: string;
}
export class FieldError {
  @ApiProperty() field!: string;
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
}
export class ProblemDetails {
  @ApiProperty({ example: 'urn:lambdaquality:problem:validation-error' })
  type!: string;
  @ApiProperty({ example: 'Dados inválidos' }) title!: string;
  @ApiProperty({ example: 400 }) status!: number;
  @ApiProperty() detail!: string;
  @ApiProperty({ example: '/api/v1/auth/login' }) instance!: string;
  @ApiProperty({ example: 'VALIDATION_ERROR' }) code!: string;
  @ApiProperty({ format: 'uuid' }) requestId!: string;
  @ApiProperty({
    format: 'date-time',
    description:
      'ISO 8601 com offset -03:00; mesmo instante armazenado em UTC.',
  })
  timestamp!: string;
  @ApiProperty({ type: [FieldError], required: false }) errors?: FieldError[];
}
export function ApiSuccess(
  model: Type<unknown>,
  status: number,
  message: string,
) {
  return applyDecorators(
    SetMetadata(RESPONSE_MESSAGE, message),
    ApiExtraModels(model, ResponseMeta),
    ApiResponse({
      status,
      description: message,
      headers: {
        'X-Request-Id': { schema: { type: 'string', format: 'uuid' } },
      },
      schema: {
        type: 'object',
        required: ['data', 'message', 'meta'],
        properties: {
          data: { $ref: getSchemaPath(model) },
          message: { type: 'string', example: message },
          meta: { $ref: getSchemaPath(ResponseMeta) },
        },
      },
    }),
  );
}
export function ApiProblems(statuses: number[]) {
  return applyDecorators(
    ApiExtraModels(ProblemDetails, FieldError),
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: 'Erro em Problem Details; consulte code e requestId.',
        content: {
          'application/problem+json': {
            schema: { $ref: getSchemaPath(ProblemDetails) },
          },
        },
      }),
    ),
  );
}
export class PaginationResponse {
  @ApiProperty() page!: number;
  @ApiProperty() size!: number;
  @ApiProperty() totalItems!: number;
  @ApiProperty() totalPages!: number;
  @ApiProperty() hasNext!: boolean;
  @ApiProperty() hasPrevious!: boolean;
}
export function ApiListSuccess(model: Type<unknown>, message: string) {
  return applyDecorators(
    SetMetadata(RESPONSE_MESSAGE, message),
    ApiExtraModels(model, ResponseMeta, PaginationResponse),
    ApiResponse({
      status: 200,
      description: message,
      schema: {
        type: 'object',
        required: ['data', 'message', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          message: { type: 'string', example: message },
          meta: {
            allOf: [
              { $ref: getSchemaPath(ResponseMeta) },
              {
                type: 'object',
                required: ['pagination'],
                properties: {
                  pagination: { $ref: getSchemaPath(PaginationResponse) },
                },
              },
            ],
          },
        },
      },
    }),
  );
}
