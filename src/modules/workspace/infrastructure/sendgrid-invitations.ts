import { MailService } from '@sendgrid/mail';
import type { AppConfig } from '../../../shared/config/config.js';
import type { InvitationMail } from '../application/ports.js';
export class SendgridInvitations implements InvitationMail {
  private readonly client = new MailService();
  constructor(
    private readonly mail: AppConfig['mail'],
    private readonly acceptUrl?: string,
  ) {
    this.client.setApiKey(mail.apiKey);
    this.client.setTimeout(10000);
  }
  async send(input: Parameters<InvitationMail['send']>[0]): Promise<void> {
    const action = this.acceptUrl
      ? `Acesse: ${this.acceptUrl}#token=${encodeURIComponent(input.token)}`
      : `Token do convite: ${input.token}`;
    await this.client.send({
      to: input.email,
      from: { email: this.mail.fromEmail, name: this.mail.fromName },
      subject: 'Lambda Quality — Convite para Workspace',
      text: `Você foi convidado para ${input.workspaceName}.\n\n${action}\n\nValidade: ${input.expiresAt.toISOString()}. Cadastre-se e entre usando este endereço de e-mail para aceitar o convite.\n\nNão compartilhe o convite. Se não esperava esta mensagem, ignore-a.`,
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
      },
    });
  }
}
