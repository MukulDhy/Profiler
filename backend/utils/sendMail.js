// utils/sendMail.js
import nodemailer from "nodemailer";
import path from "path";
import ejs from "ejs";
import { fileURLToPath } from "url";
import "../config/env.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create transporter (singleton pattern)
let transporter;

/** Outbound email can be switched off entirely for offline/desktop installs. */
const mailDisabled = () => {
  const mode = (process.env.MAIL_MODE || "").toLowerCase();
  if (mode === "disabled") return true;
  if (mode === "smtp") return false;
  // Default: use SMTP only when credentials are present.
  return !(process.env.SMTP_MAIL && process.env.SMTP_PASSWORD);
};

const createTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    service: process.env.SMTP_SERVICE,
    auth: {
      user: process.env.SMTP_MAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  return transporter;
};

const sendMail = async (options) => {
  const { email, subject, data, template } = options;

  if (!email || !subject || !template) {
    throw new Error("Missing required fields: email, subject, template");
  }

  // Desktop installs have no SMTP credentials: log the intent and move on.
  // Verification codes are printed to the app log by the caller.
  if (mailDisabled()) {
    console.log(
      `[mail disabled] ${subject} → ${email} (template: ${template})`
    );
    return { accepted: [], disabled: true };
  }

  try {
    const mailTransporter = createTransporter();

    // Get the path to the email template file
    const templatePath = path.join(__dirname, "../templates", template);

    // Render the email template with EJS
    const html = await ejs.renderFile(templatePath, data);

    const mailOptions = {
      from: process.env.SMTP_MAIL,
      to: email,
      subject,
      html,
    };

    const result = await mailTransporter.sendMail(mailOptions);
    return result;
  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error(`Can't send mail: ${error.message}`);
  }
};

export default sendMail;
