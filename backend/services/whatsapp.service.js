import dotenv from "dotenv";
import twilio from "twilio";
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
// console.log(accountSid);
const client = twilio(accountSid, authToken);

const sendWhatsAppMessage = async (to, message) => {
  try {
    // Ensure the number is in the correct format
    const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

    const result = await client.messages.create({
      body: message,
      from: whatsappNumber,
      to: formattedTo,
    });

    return {
      success: true,
      messageId: result.sid,
      status: result.status,
    };
  } catch (error) {
    console.error("Twilio API error:", error);
    throw error;
  }
};

export { sendWhatsAppMessage };
