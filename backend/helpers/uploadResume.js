import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

// ✅ Configure Cloudinary
export const configCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  logger.info("✅ Cloudinary configured successfully");
};


export const upload = multer({
  dest: "uploads/Resume/",
});


export const uploadResume = async (
  filePath,
  uploadLocal = false,
  options = {}
) => {
  try {
    // ✅ Upload file to Cloudinary
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "Resumes",
      resource_type: "raw", // better for pdf/doc/docx
      ...options,
    });

    // Uplaod to Local Storage if required

    return {
      url: result.secure_url,
      public_id: result.public_id,
      original_filename: result.original_filename,
    };
  } catch (error) {

    // if (deleteLocalFile && fs.existsSync(filePath)) {
    //   fs.unlinkSync(filePath);

    //   logger.info(`🗑️ Local file deleted after failed upload: ${filePath}`);
    // }

    logger.error("❌ Error uploading resume to Cloudinary:", error);

    throw new Error("Failed to upload resume to Cloudinary");
  }
};