import nodemailer from "nodemailer";
import { logger } from "../utils/logger";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT ?? "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM ?? `"Togeno" <noreply@togeno.com>`;

class EmailService {
  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn("SMTP not configured — skipping email", { to, subject });
      return;
    }
    try {
      await transporter.sendMail({ from: FROM, to, subject, html });
      logger.info("Email sent", { to, subject });
    } catch (err) {
      logger.error("Failed to send email", { to, subject, err });
    }
  }

  async sendOrderConfirmation(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    orderTotal: number;
    items: Array<{ productName: string; quantity: number; subtotal: number }>;
  }): Promise<void> {
    const { to, customerName, orderNumber, orderTotal, items } = params;

    const itemRows = items
      .map(
        (i) =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #1a1a1a;color:#d4d4d4">${i.productName}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #1a1a1a;color:#d4d4d4;text-align:center">${i.quantity}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #1a1a1a;color:#d4d4d4;text-align:right">₹${i.subtotal.toFixed(2)}</td>
          </tr>`
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Order Confirmed</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#0b0b0b;border:1px solid #1a1a1a;border-radius:12px;overflow:hidden">
    <tr>
      <td style="background:#10b981;padding:24px 32px">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Order Confirmed ✓</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px">
        <p style="color:#a1a1aa;margin:0 0 8px">Hi <strong style="color:#fff">${customerName}</strong>,</p>
        <p style="color:#a1a1aa;margin:0 0 24px">Your order has been placed successfully and will arrive within <strong style="color:#fff">4–5 business days</strong>.</p>

        <div style="background:#111;border:1px solid #1a1a1a;border-radius:8px;padding:16px 20px;margin-bottom:24px">
          <p style="margin:0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Order Number</p>
          <p style="margin:4px 0 0;color:#10b981;font-size:18px;font-weight:700">#${orderNumber}</p>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;margin-bottom:24px">
          <thead>
            <tr style="background:#111">
              <th style="padding:10px 12px;color:#71717a;font-size:12px;text-align:left;font-weight:600">Product</th>
              <th style="padding:10px 12px;color:#71717a;font-size:12px;text-align:center;font-weight:600">Qty</th>
              <th style="padding:10px 12px;color:#71717a;font-size:12px;text-align:right;font-weight:600">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding:12px;color:#a1a1aa;font-weight:600">Total</td>
              <td style="padding:12px;color:#10b981;font-weight:700;text-align:right">₹${orderTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <p style="color:#52525b;font-size:13px;margin:0">Questions? Reply to this email or contact us at <a href="mailto:officialtrodec@gmail.com" style="color:#10b981">officialtrodec@gmail.com</a></p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px;border-top:1px solid #1a1a1a;text-align:center">
        <p style="margin:0;color:#3f3f46;font-size:12px">© ${new Date().getFullYear()} Togeno. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await this.send(to, `Your Togeno order #${orderNumber} is confirmed!`, html);
  }

  async sendOrderShipped(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    awbCode: string | null;
    courierName: string | null;
    trackingUrl: string | null;
    estimatedDelivery: string | null;
  }): Promise<void> {
    const { to, customerName, orderNumber, awbCode, courierName, trackingUrl, estimatedDelivery } = params;

    const etaLine = estimatedDelivery
      ? `<p style="color:#a1a1aa;margin:0 0 24px">Estimated delivery: <strong style="color:#fff">${new Date(estimatedDelivery).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong></p>`
      : `<p style="color:#a1a1aa;margin:0 0 24px">Expected within <strong style="color:#fff">4–5 business days</strong>.</p>`;

    const trackBtn = trackingUrl
      ? `<a href="${trackingUrl}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Track Your Package →</a>`
      : "";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Order Shipped</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#0b0b0b;border:1px solid #1a1a1a;border-radius:12px;overflow:hidden">
    <tr>
      <td style="background:#3b82f6;padding:24px 32px">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Your order is on its way 🚚</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px">
        <p style="color:#a1a1aa;margin:0 0 8px">Hi <strong style="color:#fff">${customerName}</strong>,</p>
        ${etaLine}

        <div style="background:#111;border:1px solid #1a1a1a;border-radius:8px;padding:16px 20px;margin-bottom:16px">
          <p style="margin:0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Order Number</p>
          <p style="margin:4px 0 0;color:#3b82f6;font-size:18px;font-weight:700">#${orderNumber}</p>
        </div>

        ${awbCode ? `
        <div style="background:#111;border:1px solid #1a1a1a;border-radius:8px;padding:16px 20px;margin-bottom:16px">
          <p style="margin:0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Tracking Number (AWB)</p>
          <p style="margin:4px 0 0;color:#fff;font-size:16px;font-weight:700;font-family:monospace">${awbCode}</p>
          ${courierName ? `<p style="margin:4px 0 0;color:#71717a;font-size:13px">via ${courierName}</p>` : ""}
        </div>` : ""}

        ${trackBtn}

        <p style="color:#52525b;font-size:13px;margin:24px 0 0">You can also track your order anytime in the <strong style="color:#a1a1aa">My Orders</strong> section of the app.</p>
        <p style="color:#52525b;font-size:13px;margin:8px 0 0">Questions? Contact us at <a href="mailto:officialtrodec@gmail.com" style="color:#3b82f6">officialtrodec@gmail.com</a></p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px;border-top:1px solid #1a1a1a;text-align:center">
        <p style="margin:0;color:#3f3f46;font-size:12px">© ${new Date().getFullYear()} Togeno. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await this.send(to, `Your Togeno order #${orderNumber} has been shipped!`, html);
  }
}

export const emailService = new EmailService();
