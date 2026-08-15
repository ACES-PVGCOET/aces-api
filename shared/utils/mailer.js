import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

let transporter = null;

/**
 * Lazy initialization helper to return a singleton Nodemailer transporter.
 * Uses configured SMTP credentials if provided, otherwise falls back to Ethereal test transport or JSON transport.
 */
const getTransporter = async () => {
  if (transporter) {
    return transporter;
  }

  if (config.smtp.host && config.smtp.user) {
    const isGmail = config.smtp.host.includes('gmail');

    transporter = nodemailer.createTransport({
      host: isGmail ? 'smtp.gmail.com' : config.smtp.host,
      port: isGmail ? 465 : (config.smtp.port || 465),
      secure: isGmail ? true : (config.smtp.secure || config.smtp.port === 465),
      family: 4, // Force IPv4 to prevent ENETUNREACH on cloud environments (like Render) without IPv6 support
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    console.info(`[Mailer] Initialized IPv4 SMTP transporter for host: ${isGmail ? 'smtp.gmail.com:465' : `${config.smtp.host}:${config.smtp.port}`}`);
  } else if (config.env === 'test') {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  } else {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      });
      console.info(`[Mailer] SMTP credentials not set. Initialized Ethereal test account: ${testAccount.user}`);
    } catch (_err) {
      transporter = nodemailer.createTransport({ jsonTransport: true });
      console.info('[Mailer] Falling back to JSON Transport for local mail operations.');
    }
  }

  return transporter;
};

/**
 * Generic email sending function using Nodemailer.
 */
export const sendMail = async ({ to, subject, html, text, from }) => {
  try {
    const mailTransporter = await getTransporter();

    const mailOptions = {
      from: from || config.smtp.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, ''),
    };

    const info = await mailTransporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.info(`[Mailer] Email dispatched to ${to} (MessageID: ${info.messageId})`);
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
    return {
      success: false,
      error: error.message,
    };
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
