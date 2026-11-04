import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiProblems, ApiSuccess } from '../../../shared/http/responses.js';
import { AuthQueryGuard, RateLimitGuard } from '../../../shared/http/rate-limit-guard.js';
import type { ApiRequest } from '../../../shared/http/types.js';
import { IDENTITY_SERVICE, IdentityService } from '../application/identity-service.js';
import { CodeRequestedResponse, EmailDto, EmptyDto, LoginDto, RefreshDto, RegistrationDto, ResetPasswordDto, TokenResponse, UserResponse } from './dtos.js';
import { BearerGuard } from './bearer-guard.js';

@ApiTags('Autenticação e usuários')
@ApiProblems([400, 500, 503])
@UseGuards(AuthQueryGuard)
@Controller('auth')
export class AuthController {
  constructor(@Inject(IDENTITY_SERVICE) private readonly identity: IdentityService) {}
  @UseGuards(RateLimitGuard) @ApiProblems([429])
  @Post('registration/code') @HttpCode(202)
  @ApiOperation({ operationId: 'requestRegistrationCode', summary: 'Solicitar código de cadastro por e-mail' })
  @ApiSuccess(CodeRequestedResponse, 202, 'Código de confirmação enviado. Consulte seu e-mail.')
  requestRegistrationCode(@Body() body: EmailDto, @Req() req: ApiRequest) { return this.identity.requestCode(body.email, 'REGISTRATION', req.requestId); }

  @UseGuards(RateLimitGuard) @ApiProblems([429])
  @Post('register') @HttpCode(201)
  @ApiOperation({ operationId: 'registerUser', summary: 'Criar usuário confirmando o código recebido' })
  @ApiProblems([409])
  @ApiSuccess(UserResponse, 201, 'Usuário criado com sucesso. Faça login para continuar.')
  register(@Body() body: RegistrationDto, @Req() req: ApiRequest, @Res({ passthrough: true }) res: Response) { res.setHeader('Location', '/api/v1/auth/me'); return this.identity.register(body, req.requestId); }

  @UseGuards(RateLimitGuard) @ApiProblems([429])
  @Post('password-reset/code') @HttpCode(202)
  @ApiOperation({ operationId: 'requestPasswordResetCode', summary: 'Solicitar código de redefinição de senha' })
  @ApiSuccess(CodeRequestedResponse, 202, 'Código enviado. A redefinição depende de uma conta elegível.')
  requestResetCode(@Body() body: EmailDto, @Req() req: ApiRequest) { return this.identity.requestCode(body.email, 'PASSWORD_RESET', req.requestId); }

  @UseGuards(RateLimitGuard) @ApiProblems([429])
  @Post('password-reset') @HttpCode(204)
  @ApiOperation({ operationId: 'resetPassword', summary: 'Redefinir senha e revogar todas as sessões' })
  @ApiResponse({ status: 204, description: 'Senha alterada. Faça login novamente; resposta sem corpo.' })
  resetPassword(@Body() body: ResetPasswordDto, @Req() req: ApiRequest) { return this.identity.resetPassword(body, req.requestId); }

  @UseGuards(RateLimitGuard) @ApiProblems([429])
  @Post('login') @HttpCode(200)
  @ApiOperation({ operationId: 'login', summary: 'Autenticar e receber access e refresh tokens' })
  @ApiProblems([401])
  @ApiSuccess(TokenResponse, 200, 'Autenticação realizada com sucesso.')
  login(@Body() body: LoginDto, @Req() req: ApiRequest, @Res({ passthrough: true }) res: Response) { this.noStore(res); return this.identity.login(body.email, body.password, req.requestId); }

  @UseGuards(RateLimitGuard) @ApiProblems([429])
  @Post('refresh') @HttpCode(200)
  @ApiOperation({ operationId: 'refreshSession', summary: 'Renovar tokens; token anterior passa a ser de uso único' })
  @ApiProblems([401])
  @ApiSuccess(TokenResponse, 200, 'Sessão renovada com sucesso.')
  refresh(@Body() body: RefreshDto, @Req() req: ApiRequest, @Res({ passthrough: true }) res: Response) { this.noStore(res); return this.identity.refresh(body.refreshToken, req.requestId); }

  @Get('me') @UseGuards(BearerGuard) @ApiBearerAuth('access-token')
  @ApiOperation({ operationId: 'getCurrentUser', summary: 'Consultar o usuário autenticado' })
  @ApiProblems([401])
  @ApiSuccess(UserResponse, 200, 'Usuário consultado com sucesso.')
  me(@Req() req: ApiRequest, @Res({ passthrough: true }) res: Response) { this.noStore(res); return this.identity.me(req.identity!); }

  @Post('logout') @HttpCode(204) @UseGuards(BearerGuard) @ApiBearerAuth('access-token')
  @ApiOperation({ operationId: 'logout', summary: 'Revogar a sessão atual' })
  @ApiProblems([401]) @ApiResponse({ status: 204, description: 'Sessão revogada; sem corpo.' })
  logout(@Body() _body: EmptyDto, @Req() req: ApiRequest) { return this.identity.logout(req.identity!, false, req.requestId); }

  @Post('logout-all') @HttpCode(204) @UseGuards(BearerGuard) @ApiBearerAuth('access-token')
  @ApiOperation({ operationId: 'logoutAll', summary: 'Revogar todas as sessões do usuário' })
  @ApiProblems([401]) @ApiResponse({ status: 204, description: 'Todas as sessões revogadas; sem corpo.' })
  logoutAll(@Body() _body: EmptyDto, @Req() req: ApiRequest) { return this.identity.logout(req.identity!, true, req.requestId); }
  private noStore(res: Response): void { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Pragma', 'no-cache'); }
}
