export class ApplicationError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly retryAfter?: number) {
    super(message);
    this.name = 'ApplicationError';
  }
}
export function invalidCode(): ApplicationError {
  return new ApplicationError(400, 'AUTH_INVALID_EMAIL_CODE', 'Código inválido, expirado ou já utilizado. Solicite um novo código se necessário.');
}
