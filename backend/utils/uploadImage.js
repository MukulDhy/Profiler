import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";
import logger from "./logger.js";

dotenv.config();

export const configCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  logger.info("✅ Cloudinary configured successfully");
};

// ✅ Multer setup
export const upload = multer({ dest: "uploads/" });

// ✅ Upload helper
export const uploadImage = async (imagePath) => {
  try {
    const result = await cloudinary.uploader.upload(imagePath, {
      folder: "screenshots",
      resource_type: "image",
    });

    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error("❌ Error uploading image to Cloudinary:", error);
    throw new Error("Failed to upload image to Cloudinary");
  }
};
