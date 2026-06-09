import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: false,
  requireTLS: true,
  auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
});

export const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
  if (!env.smtp.user) {
    console.log(`[Email Dev] To: ${to} | Subject: ${subject}`);
    console.log(html);
    return;
  }

  await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    html,
  });
};

export const sendOtpEmail = async (email: string, code: string): Promise<void> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: #0a1120; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h2 style="color: #f5b800; margin: 0;">DataBundle</h2>
      </div>
      <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
        <h3 style="color: #0a1120; margin-top: 0;">Your Login Verification Code</h3>
        <p style="color: #4b5563;">Enter this 6-digit code to complete your login:</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #0a1120; padding: 20px; background: #fff; border: 2px solid #f5b800; border-radius: 12px; text-align: center; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">This code expires in 10 minutes. Do not share it with anyone.</p>
      </div>
    </div>
  `;
  await sendEmail(email, 'Your Login OTP - DataBundle', html);
};

export const sendPasswordResetEmail = async (email: string, resetLink: string): Promise<void> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Password Reset</h2>
      <p>Click the link below to reset your password. This link expires in 15 minutes.</p>
      <a href="${resetLink}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
        Reset Password
      </a>
      <p style="color: #6b7280;">If you didn't request this, ignore this email.</p>
    </div>
  `;
  await sendEmail(email, 'Reset Your Password - DataBundle', html);
};

export const sendOrderHistoryOtpEmail = async (
  email: string,
  code: string,
  storeName: string
): Promise<void> => {
  const digits = code.split('');
  const digitBoxes = digits
    .map(
      (d) =>
        `<td style="width:44px;height:52px;text-align:center;font-size:24px;font-weight:700;color:#0a1120;background:#fff;border:2px solid #f5b800;border-radius:10px;">${d}</td>`
    )
    .join('<td style="width:8px;"></td>');

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; background:#f3f4f6; padding:24px;">
      <div style="background: linear-gradient(135deg, #0a1120 0%, #162035 100%); padding: 28px 24px; border-radius: 16px 16px 0 0; text-align: center;">
        <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Order History</p>
        <h1 style="margin:0;color:#f5b800;font-size:24px;">${storeName}</h1>
      </div>
      <div style="background:#ffffff;padding:32px 24px;border-radius:0 0 16px 16px;border:1px solid #e5e7eb;border-top:none;">
        <h2 style="margin:0 0 8px;color:#0a1120;font-size:20px;">Verify to view your orders</h2>
        <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
          Use this 6-digit code to securely check your lifetime order history — including delivered, pending, and processing orders.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;"><tr>${digitBoxes}</tr></table>
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
          <p style="margin:0;color:#047857;font-size:13px;"><strong>Tip:</strong> Enter all 6 digits on the store page — verification happens automatically.</p>
        </div>
        <p style="margin:0;color:#9ca3af;font-size:13px;">This code expires in <strong>10 minutes</strong>. Never share it with anyone.</p>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">&copy; DataBundle Ghana</p>
    </div>
  `;
  await sendEmail(email, `Your order history code — ${storeName}`, html);
};

export const sendNotificationEmail = async (
  email: string,
  title: string,
  message: string
): Promise<void> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1e40af;">${title}</h2>
      <p>${message}</p>
    </div>
  `;
  await sendEmail(email, `${title} - DataBundle`, html);
};
