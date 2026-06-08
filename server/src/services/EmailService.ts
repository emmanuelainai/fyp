import nodemailer from "nodemailer";
import { env } from "../config/env";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type EmailSendResult = {
  sent: boolean;
  reason?: string;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
};

export class EmailService {
  private static transport = env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
      })
    : null;

  static isConfigured() {
    return Boolean(this.transport);
  }

  static async send(payload: EmailPayload): Promise<EmailSendResult> {
    if (!this.transport) {
      console.log(`[Email disabled] To: ${payload.to}`);
      console.log(`[Email disabled] Subject: ${payload.subject}`);
      console.log(payload.text);
      return { sent: false, reason: "SMTP is not configured" };
    }

    try {
      const info = await this.transport.sendMail({
        from: env.SMTP_FROM,
        ...payload
      });
      const accepted = info.accepted.map(String);
      const rejected = info.rejected.map(String);
      console.log(`[Email sent] To: ${payload.to}`);
      console.log(`[Email sent] Message ID: ${info.messageId}`);
      console.log(`[Email sent] Accepted: ${accepted.join(", ") || "(none)"}`);
      if (rejected.length) console.warn(`[Email sent] Rejected: ${rejected.join(", ")}`);
      return { sent: accepted.length > 0, messageId: info.messageId, accepted, rejected };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Email provider rejected the message";
      console.error(`[Email failed] To: ${payload.to}`);
      console.error(`[Email failed] Subject: ${payload.subject}`);
      console.error(reason);
      return { sent: false, reason };
    }
  }

  static async sendAccountCreated(to: string, name: string) {
    return this.send({
      to,
      subject: "Your ExamSentinel account was created",
      text: `Hello ${name},\n\nYour ExamSentinel account has been created. If you did not request this account, contact your exam administrator immediately.\n\nExamSentinel`,
      html: `<p>Hello ${name},</p><p>Your ExamSentinel account has been created. If you did not request this account, contact your exam administrator immediately.</p><p>ExamSentinel</p>`
    });
  }

  static async sendAccountVerificationCode(to: string, name: string, code: string) {
    return this.send({
      to,
      subject: "Verify your ExamSentinel account",
      text: `Hello ${name},\n\nYour ExamSentinel account verification code is ${code}. It expires in 10 minutes.\n\nExamSentinel`,
      html: `<p>Hello ${name},</p><p>Your ExamSentinel account verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p><p>ExamSentinel</p>`
    });
  }

  static async sendPasswordChanged(to: string, name: string) {
    return this.send({
      to,
      subject: "Your ExamSentinel password was changed",
      text: `Hello ${name},\n\nYour ExamSentinel password was changed. If this was not you, contact your exam administrator immediately.\n\nExamSentinel`,
      html: `<p>Hello ${name},</p><p>Your ExamSentinel password was changed. If this was not you, contact your exam administrator immediately.</p><p>ExamSentinel</p>`
    });
  }

  static async sendPasswordResetCode(to: string, name: string, code: string) {
    return this.send({
      to,
      subject: "Reset your ExamSentinel password",
      text: `Hello ${name},\n\nYour ExamSentinel password reset code is ${code}. It expires in 10 minutes.\n\nExamSentinel`,
      html: `<p>Hello ${name},</p><p>Your ExamSentinel password reset code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p><p>ExamSentinel</p>`
    });
  }
}
