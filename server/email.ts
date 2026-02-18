import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const BASE_DOMAIN = "connectagrapher.com";
const FROM_BOOKINGS = `ConnectAGrapher Bookings <bookings@${BASE_DOMAIN}>`;
const FROM_SUPPORT = `ConnectAGrapher Support <support@${BASE_DOMAIN}>`;
const FROM_TEAM = `ConnectAGrapher Team <team@${BASE_DOMAIN}>`;
const APP_URL = process.env.APP_URL || `https://${BASE_DOMAIN}`;

async function sendEmail(to: string, subject: string, html: string, from: string) {
  if (!resend) {
    console.log(`[Email not configured] To: ${to}, Subject: ${subject}`);
    return null;
  }

  try {
    const result = await resend.emails.send({ from, to, subject, html });
    console.log(`Email sent to ${to}: ${subject}`);
    return result;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    return null;
  }
}

// -- Email Templates --

export async function sendBookingConfirmation(booking: {
  clientName: string;
  email: string;
  serviceType: string;
  shootDate: string;
  shootTime?: string;
  location?: string;
  totalPrice: number;
  depositAmount: number;
  balanceDue: number;
  id: string;
}, accessCode: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h1 style="color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 12px;">Booking Confirmed!</h1>
      <p>Hi ${booking.clientName},</p>
      <p>Your photography session has been booked successfully. Here are your details:</p>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Service:</strong> ${booking.serviceType}</p>
        <p><strong>Date:</strong> ${booking.shootDate}</p>
        ${booking.shootTime ? `<p><strong>Time:</strong> ${booking.shootTime}</p>` : ""}
        ${booking.location ? `<p><strong>Location:</strong> ${booking.location}</p>` : ""}
        <p><strong>Total Price:</strong> $${(booking.totalPrice / 100).toFixed(2)}</p>
        <p><strong>Deposit (50%):</strong> $${(booking.depositAmount / 100).toFixed(2)}</p>
        <p><strong>Balance Due:</strong> $${(booking.balanceDue / 100).toFixed(2)}</p>
      </div>

      <div style="background: #f0f7ff; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Your Gallery Access Code:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 4px; font-size: 18px; letter-spacing: 2px;">${accessCode}</code></p>
        <p style="margin: 8px 0 0; font-size: 13px; color: #666;">Save this code — you'll need it to view your photos after the shoot.</p>
      </div>

      <a href="${APP_URL}/payment?booking=${booking.id}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 12px 0;">Pay Deposit Now</a>

      <p style="color: #666; font-size: 13px; margin-top: 30px;">If you have any questions, reply to this email or visit <a href="${APP_URL}">${APP_URL}</a>.</p>
    </div>
  `;

  return sendEmail(booking.email, "Your Photography Session is Confirmed!", html, FROM_BOOKINGS);
}

export async function sendPaymentConfirmation(booking: {
  clientName: string;
  email: string;
  serviceType: string;
  id: string;
}, paymentType: "deposit" | "balance", amount: number) {
  const isDeposit = paymentType === "deposit";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h1 style="color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 12px;">Payment Received!</h1>
      <p>Hi ${booking.clientName},</p>
      <p>We've received your ${isDeposit ? "deposit" : "final balance"} payment.</p>

      <div style="background: #f0fff4; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Amount Paid:</strong> $${(amount / 100).toFixed(2)}</p>
        <p><strong>Payment Type:</strong> ${isDeposit ? "Deposit (50%)" : "Balance Payment"}</p>
        <p><strong>Service:</strong> ${booking.serviceType}</p>
        <p><strong>Booking ID:</strong> ${booking.id}</p>
      </div>

      ${isDeposit ? `<p>Your remaining balance will be due before or on the day of your shoot.</p>` : `<p>Your booking is now fully paid. We look forward to your session!</p>`}

      <p style="color: #666; font-size: 13px; margin-top: 30px;">If you have any questions, reply to this email or visit <a href="${APP_URL}">${APP_URL}</a>.</p>
    </div>
  `;

  return sendEmail(booking.email, `Payment Received — ${isDeposit ? "Deposit" : "Balance"} for Your Session`, html, FROM_BOOKINGS);
}

export async function sendPasswordReset(email: string, resetToken: string) {
  const resetLink = `${APP_URL}/auth?reset=${resetToken}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h1 style="color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 12px;">Reset Your Password</h1>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>

      <a href="${resetLink}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0;">Reset Password</a>

      <p style="color: #666; font-size: 13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      <p style="color: #999; font-size: 12px; margin-top: 20px;">Link: ${resetLink}</p>
    </div>
  `;

  return sendEmail(email, "Reset Your Password — ConnectAGrapher", html, FROM_SUPPORT);
}

export async function sendPhotographerApproved(email: string, firstName: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h1 style="color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 12px;">You're Approved!</h1>
      <p>Hi ${firstName},</p>
      <p>Great news — your photographer application has been approved! You can now receive bookings on ConnectAGrapher.</p>

      <a href="${APP_URL}/auth" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0;">Log In to Your Dashboard</a>

      <p>Make sure your profile and pricing are up to date so clients can find you.</p>
      <p style="color: #666; font-size: 13px; margin-top: 30px;">Welcome to the team!</p>
    </div>
  `;

  return sendEmail(email, "Your Photographer Application is Approved!", html, FROM_TEAM);
}

export async function sendPhotographerRejected(email: string, firstName: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h1 style="color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 12px;">Application Update</h1>
      <p>Hi ${firstName},</p>
      <p>Thank you for your interest in joining ConnectAGrapher. After reviewing your application, we're unable to approve it at this time.</p>
      <p>You're welcome to reapply in the future with an updated portfolio. If you have questions, feel free to reach out.</p>
      <p style="color: #666; font-size: 13px; margin-top: 30px;">— The ConnectAGrapher Team</p>
    </div>
  `;

  return sendEmail(email, "Photographer Application Update — ConnectAGrapher", html, FROM_TEAM);
}

export async function sendAdminEmail(to: string, clientName: string, subject: string, message: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <p>Hi ${clientName},</p>
      <div style="white-space: pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      <p style="color: #666; font-size: 13px; margin-top: 30px; border-top: 1px solid #e5e5e5; padding-top: 12px;">— ConnectAGrapher</p>
    </div>
  `;

  return sendEmail(to, subject, html, FROM_SUPPORT);
}
