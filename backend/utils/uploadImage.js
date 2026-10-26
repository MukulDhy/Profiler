import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import logger from "./logger.js";
import { DATA_DIR, ensureDirs } from "../config/runtimeConfig.js";
import { isLocalStorage, saveLocalFile } from "../helpers/storage.js";
import "../config/env.js";


export const configCloudinary = () => {
  if (isLocalStorage()) return;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  logger.info("✅ Cloudinary configured successfully");
};

// ✅ Multer setup — staging folder inside the app's data directory.
const uploadDir = path.join(DATA_DIR, "tmp");
ensureDirs();
fs.mkdirSync(uploadDir, { recursive: true });

export const upload = multer({ dest: uploadDir });

// ✅ Upload helper
export const uploadImage = async (imagePath) => {
  if (isLocalStorage()) {
    const stored = await saveLocalFile(imagePath, {
      folder: "avatars",
      baseName: `avatar_${Date.now()}`,
      ext: path.extname(imagePath) || ".png",
    });
    return { url: stored.url, public_id: stored.public_id, storage: "local" };
  }

  try {
    const result = await cloudinary.uploader.upload(imagePath, {
      folder: "screenshots",
      resource_type: "image",
    });

    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

    return {
      url: result.secure_url,
      public_id: result.public_id,
      storage: "cloudinary",
    };
  } catch (error) {
    console.error("❌ Error uploading image to Cloudinary:", error);
    throw new Error("Failed to upload image to Cloudinary");
  }
};
