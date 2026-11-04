import { MailService } from '@sendgrid/mail';
import type { AppConfig } from '../../../shared/config/config.js';
import type { CodeEmail } from '../application/ports.js';
import type { CodePurpose } from '../domain/models.js';
export class SendgridCodeEmail implements CodeEmail {
  private readonly client = new MailService();
  constructor(private readonly config: AppConfig['mail']) { this.client.setApiKey(config.apiKey); this.client.setTimeout(10000); }
  async send(email: string, code: string, purpose: CodePurpose, expiresInSeconds: number): Promise<void> {
    const action = purpose === 'REGISTRATION' ? 'confirmar seu cadastro' : 'redefinir sua senha';
    const minutes = Math.ceil(expiresInSeconds / 60);
    await this.client.send({
      to: email,
      from: { email: this.config.fromEmail, name: this.config.fromName },
      subject: `Lambda Quality — Código para ${action}`,
      text: `Recebemos uma solicitação para ${action}.\n\nSeu código é: ${code}\n\nValidade: ${minutes} minutos. O código somente conclui operações elegíveis para este e-mail.\n\nSe você não solicitou esta operação, ignore esta mensagem. Não compartilhe o código.`,
      html: `<p>Recebemos uma solicitação para ${action}.</p><p>Seu código é: <strong>${code}</strong></p><p>Validade: ${minutes} minutos. O código somente conclui operações elegíveis para este e-mail.</p><p>Se você não solicitou esta operação, ignore esta mensagem. Não compartilhe o código.</p>`,
      trackingSettings: { clickTracking: { enable: false, enableText: false }, openTracking: { enable: false } },
    });
  }
}
