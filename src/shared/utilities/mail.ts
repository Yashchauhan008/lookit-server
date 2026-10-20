import env from '@/shared/configs/env.js';
import nodemailer from 'nodemailer';
import ejs from 'ejs';
import path from 'path';

export async function renderEmailTemplates(templateName: string, data: Record<string, unknown>) {
    const templatePath = path.join(process.cwd(), 'email-templates', `${templateName}.ejs`);
    return ejs.renderFile(templatePath, data);
}

function htmlToText(html: string): string {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

export async function sendMail({
    to,
    subject,
    html,
    text,
}: {
    to: string;
    subject: string;
    html: string;
    text?: string;
}) {
    const transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: true,
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASSWORD,
        },
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 45_000,
    });
    const result = await transport.sendMail({
        from: env.MAIL_FROM || env.SMTP_USER,
        to,
        subject,
        html,
        text: text || htmlToText(html),
    });
    return result;
}
