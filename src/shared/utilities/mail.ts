import env from '@/shared/configs/env.js';
import nodemailer from 'nodemailer';
import ejs from 'ejs';
import path from 'path';

export async function renderEmailTemplates(templateName: string, data: Record<string, unknown>) {
    const templatePath = path.join(process.cwd(), 'email-templates', `${templateName}.ejs`);
    return ejs.renderFile(templatePath, data);
}

export async function sendMail({
    to,
    subject,
    html,
}: {
    to: string;
    subject: string;
    html: string;
}) {
    const transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: true,
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASSWORD,
        },
    });
    const result = await transport.sendMail({
        from: env.SMTP_USER,
        to,
        subject,
        html,
    });
    return result;
}
