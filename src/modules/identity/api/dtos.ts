import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, IsUUID, Length, Matches, MaxLength, MinLength } from 'class-validator';
export class EmailDto {
  @ApiProperty({ example: 'usuario@example.com', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail({}, { message: 'Informe um endereço de e-mail válido.' })
  @MaxLength(254, { message: 'O e-mail deve ter no máximo 254 caracteres.' }) email!: string;
}
export class LoginDto extends EmailDto {
  @ApiProperty({ example: 'UmaSenhaSegura123!', minLength: 1, maxLength: 128, writeOnly: true })
  @IsString({ message: 'Informe a senha como texto.' })
  @Length(1, 128, { message: 'A senha deve ter de 1 a 128 caracteres.' }) password!: string;
}
export class CodeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Informe um challengeId UUID válido.' }) challengeId!: string;
  @ApiProperty({ example: '123456', pattern: '^[0-9]{6}$' })
  @Matches(/^[0-9]{6}$/, { message: 'Informe o código de seis dígitos como texto.' }) code!: string;
}
export class RegistrationDto extends CodeDto {
  @ApiProperty({ example: 'Usuário Exemplo', minLength: 2, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString({ message: 'Informe o nome como texto.' })
  @Length(2, 100, { message: 'O nome deve ter de 2 a 100 caracteres.' }) displayName!: string;
  @ApiProperty({ example: 'UmaSenhaSegura123!', minLength: 12, maxLength: 128, writeOnly: true })
  @IsString({ message: 'Informe a senha como texto.' })
  @MinLength(12, { message: 'A senha deve ter pelo menos 12 caracteres.' })
  @MaxLength(128, { message: 'A senha deve ter no máximo 128 caracteres.' }) password!: string;
}
export class ResetPasswordDto extends CodeDto {
  @ApiProperty({ example: 'OutraSenhaSegura123!', minLength: 12, maxLength: 128, writeOnly: true })
  @IsString({ message: 'Informe a nova senha como texto.' })
  @Length(12, 128, { message: 'A nova senha deve ter de 12 a 128 caracteres.' }) newPassword!: string;
}
export class RefreshDto {
  @ApiProperty({ description: 'Token opaco recebido no login/refresh', minLength: 43, maxLength: 43, writeOnly: true })
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'Informe um refresh token válido.' }) refreshToken!: string;
}
export class EmptyDto {}
export class CodeRequestedResponse {
  @ApiProperty({ format: 'uuid' }) challengeId!: string;
  @ApiProperty({ example: 600 }) expiresIn!: number;
  @ApiProperty({ example: 60 }) resendAfter!: number;
}
export class TokenResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ enum: ['Bearer'] }) tokenType!: string;
  @ApiProperty({ example: 900 }) expiresIn!: number;
  @ApiProperty({ example: 86400 }) refreshExpiresIn!: number;
}
export class UserResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'usuario@example.com' }) email!: string;
  @ApiProperty({ example: 'Usuário Exemplo' }) displayName!: string;
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) emailVerifiedAt!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
