import { Resend } from 'resend';
import { config } from '../config/index.js';

let resendClient = null;

/**
 * Returns a Resend HTTP client if RESEND_API_KEY is configured.
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
 * Primary email sending function using Resend API.
 */
export const sendMail = async ({ to, subject, html, text, from }) => {
  try {
    if (process.env.NODE_ENV === 'test' || config.env === 'test') {
      console.info(`[Mailer] [Test Mode] Email simulated for ${to}`);
      return { success: true, messageId: 'test-mock-id' };
    }

    const resend = getResendClient();

    if (!resend) {
      console.warn('[Mailer] RESEND_API_KEY is not configured. Email dispatch skipped.');
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

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
  } catch (error) {
    console.error(`[Mailer] Error dispatching email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Utility to send onboarding emails to newly registered members using Resend.
 */
export const sendOnboardingEmail = async ({ email, token, name }) => {
  const onboardingLink = `${config.clientOrigin}/onboard?token=${token}`;

  const html = `
    <h2>Welcome to ACES!</h2>
    <p>Hello${name ? ` ${name}` : ''},</p>
    <p>An administrator has registered you for membership. Please click the link below to set your password and activate your account:</p>
    <p><a href="${onboardingLink}">${onboardingLink}</a></p>
    <p>This link will expire in 24 hours.</p>
    <p>If you find any issues or bugs in onboarding, report it to Web Team or Technical Team.</p>
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
