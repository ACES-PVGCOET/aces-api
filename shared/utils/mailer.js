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
export const sendMail = async ({ to, subject, html, text, from, attachments }) => {
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

    const emailPayload = {
      from: from || config.resend.from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, ''),
    };

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const { data, error } = await resend.emails.send(emailPayload);

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
 * Utility to send welcome and digital ID card email to verified members.
 */
export const sendMembershipVerificationEmail = async ({
  email,
  name,
  membershipNo,
  validUpto,
  idCardBuffer,
}) => {
  const safeName = name ? name.trim() : 'Member';
  const safeMembershipNo = membershipNo || 'ACES-MEMBER';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; background-color: #ffffff; border-radius: 8px; border: 1px solid #eaeaea;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #6b21a8; margin: 0; font-size: 26px;">Welcome to ACES!</h1>
        <p style="color: #666666; font-size: 14px; margin-top: 6px;">Association of Computer Engineering Students</p>
      </div>

      <p style="font-size: 16px; line-height: 1.5;">Dear <strong>${safeName}</strong>,</p>

      <p style="font-size: 15px; line-height: 1.6; color: #333333;">
        We are thrilled to inform you that your ACES membership has been successfully verified! Welcome to our vibrant community of innovators, builders, and learners.
      </p>

      <div style="background-color: #f8f5ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <h3 style="color: #581c87; margin-top: 0; margin-bottom: 12px; font-size: 16px;">Membership Details</h3>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Member Name:</strong> ${safeName}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Membership Number:</strong> ${safeMembershipNo}</p>
        ${validUpto ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Valid Upto:</strong> ${validUpto}</p>` : ''}
      </div>

      <p style="font-size: 15px; line-height: 1.6; color: #333333;">
        Your official <strong>Digital Membership ID Card</strong> has been generated and attached to this email. You can save it on your device and present it at association events, workshops, and student perks.
      </p>

      <p style="font-size: 14px; line-height: 1.6; color: #555555; margin-top: 24px;">
        Connect &middot; Innovate &middot; Inspire<br>
        <strong>Team ACES</strong>
      </p>
    </div>
  `;

  const attachments = idCardBuffer
    ? [
        {
          filename: `ACES-ID-${safeMembershipNo}.png`,
          content: idCardBuffer,
        },
      ]
    : [];

  return await sendMail({
    to: email,
    subject: 'Welcome to ACES! Your Digital Membership ID Card',
    html,
    attachments,
  });
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
