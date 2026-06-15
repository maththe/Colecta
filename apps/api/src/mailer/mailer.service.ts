import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

interface MailJob {
  to: string[];
  subject: string;
  text: string;
}

interface TaskMailContext {
  tenantUuid: string;
  taskId: string;
  taskTitle: string;
  dueDate?: Date | null;
  assigneeName?: string | null;
}

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;
  private from = 'Colecta <no-reply@colecta.local>';

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.logger.warn(
        'SMTP_HOST não configurado — e-mails serão apenas logados (modo dev).',
      );
      return;
    }
    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (process.env.SMTP_FROM) this.from = process.env.SMTP_FROM;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    this.logger.log(`Mailer configurado: ${host}:${port}`);
  }

  /** Envia e-mail apenas para o funcionário responsável (assigneeName) por uma tarefa urgente. */
  async sendTaskUrgent(ctx: TaskMailContext): Promise<void> {
    if (!ctx.assigneeName) return;
    const matched = await this.prisma.user.findMany({
      where: {
        tenantUuid: ctx.tenantUuid,
        name: { equals: ctx.assigneeName, mode: 'insensitive' },
      },
      select: { email: true },
    });
    if (matched.length === 0) return;
    const dueLine = ctx.dueDate
      ? `Prazo: ${ctx.dueDate.toLocaleString('pt-BR')}\n`
      : '';
    await this.dispatch({
      to: matched.map((u) => u.email),
      subject: `[Colecta] Tarefa urgente: ${ctx.taskTitle}`,
      text:
        `Uma tarefa urgente foi aberta para você no Colecta.\n\n` +
        `Tarefa: ${ctx.taskTitle}\n` +
        dueLine,
    });
  }

  private async dispatch(job: MailJob): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `(mail-dev) para=${job.to.join(',')} assunto="${job.subject}"`,
      );
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: job.to.join(', '),
        subject: job.subject,
        text: job.text,
      });
    } catch (err) {
      this.logger.error(
        `Falha ao enviar e-mail "${job.subject}": ${(err as Error).message}`,
      );
    }
  }
}
