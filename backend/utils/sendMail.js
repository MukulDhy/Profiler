// utils/sendMail.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import ejs from "ejs";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create transporter (singleton pattern)
let transporter;

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
  try {
    const mailTransporter = createTransporter();

    const { email, subject, data, template } = options;

    if (!email || !subject || !template) {
      throw new Error("Missing required fields: email, subject, template");
    }

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
