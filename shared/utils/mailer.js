import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { config } from '../config/index.js';

let resendClient = null;
let fallbackTransporter = null;

/**
 * Returns a Resend HTTP client if RESEND_API_KEY is configured.
 * This is the recommended provider for cloud deployments (uses HTTPS port 443,
 * which is never blocked by cloud platforms like Render).
 */
const getResendClient = () => {
  if (!config.resend?.apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(config.resend.apiKey);
    console.info('[Mailer] Initialized Resend HTTP email client.');
  }
  return resendClient;
};

/**
 * Lazy initialization helper to return a Nodemailer transporter.
 * Used only as a fallback when RESEND_API_KEY is not configured (e.g. local dev).
 */
const getFallbackTransporter = async () => {
  if (fallbackTransporter) return fallbackTransporter;

  if (config.env === 'test') {
    fallbackTransporter = nodemailer.createTransport({ jsonTransport: true });
  } else {
    try {
      const testAccount = await nodemailer.createTestAccount();
      fallbackTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.info(`[Mailer] Fallback: Initialized Ethereal test account: ${testAccount.user}`);
    } catch (_err) {
      fallbackTransporter = nodemailer.createTransport({ jsonTransport: true });
      console.info('[Mailer] Fallback: Using JSON Transport for local mail operations.');
    }
  }

  return fallbackTransporter;
};

/**
 * Generic email sending function.
 * Uses Resend HTTP API when RESEND_API_KEY is configured (recommended for cloud/Render).
 * Falls back to Nodemailer/Ethereal for local development.
 */
export const sendMail = async ({ to, subject, html, text, from }) => {
  try {
    const resend = getResendClient();

    if (resend) {
      // --- Resend HTTP API path (cloud-safe, uses HTTPS port 443) ---
      const { data, error } = await resend.emails.send({
        from: from || config.resend.from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, ''),
      });

      if (error) {
        throw new Error(error.message || 'Resend API error');
      }

      console.info(`[Mailer] Email dispatched via Resend to ${to} (ID: ${data.id})`);
      return { success: true, messageId: data.id };
    }

    // --- Nodemailer fallback path (local dev / no Resend key) ---
    const mailTransporter = await getFallbackTransporter();

    const mailOptions = {
      from: from || config.smtp.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, ''),
    };

    const info = await mailTransporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.info(`[Mailer] Email dispatched via Nodemailer to ${to} (MessageID: ${info.messageId})`);
    if (previewUrl) {
      console.info(`[Mailer] Preview URL: ${previewUrl}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || null,
      info,
    };
  } catch (error) {
    console.error(`[Mailer] Error dispatching email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Utility to send onboarding emails to newly registered members using Nodemailer.
 */
export const sendOnboardingEmail = async ({ email, token, name }) => {
  const onboardingLink = `${config.clientOrigin}/onboard?token=${token}`;

  const html = `
    <h2>Welcome to ACES!</h2>
    <p>Hello${name ? ` ${name}` : ''},</p>
    <p>An administrator has registered you for membership. Please click the link below to set your password and activate your account:</p>
    <p><a href="${onboardingLink}">${onboardingLink}</a></p>
    <p>This link will expire in 24 hours.</p>
    <p>If you find any issues, bugs in onboarding report it to Web Team or Technical Team</p>
  `;

  console.info(`[Mailer] Onboarding email dispatch initiated for ${email}`);
  console.info(`[Mailer] Onboarding Link: ${onboardingLink}`);

  try {
    const result = await sendMail({
      to: email,
      subject: 'Welcome to ACES - Complete Your Membership Registration',
      html,
    });

    return {
      ...result,
      onboardingLink,
    };
  } catch (error) {
    console.error(`[Mailer] Failed to send onboarding email to ${email}:`, error.message);
    return {
      success: false,
      error: error.message,
      onboardingLink,
    };
  }
};
