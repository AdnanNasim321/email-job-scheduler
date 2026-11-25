
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

export async function getMailer() {
  if (!transporter) {
    const account = await nodemailer.createTestAccount();

    transporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: {
        user: account.user,
        pass: account.pass
      }
    });

    console.log("Ethereal SMTP configured:", account.user);
  }

  return transporter;
}

export async function sendTestEmail(
  to: string,
  subject: string,
  html: string
) {
  const mailer = await getMailer();

  const info = await mailer.sendMail({
    from: '"Email Scheduler" <scheduler@example.com>',
    to,
    subject,
    html
  });

  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info)
  };
}
