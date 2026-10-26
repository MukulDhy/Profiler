/**
 * Single place that loads `.env`.
 *
 * Every module used to call `dotenv.config()` itself, which meant a `.env`
 * sitting next to the backend was loaded even in portable builds. Centralising
 * it keeps the precedence rules in one spot:
 *
 *   1. real environment variables / config.json  (always win)
 *   2. backend/.env                              (development only)
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { IS_PORTABLE } from "./runtimeConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!IS_PORTABLE && process.env.PROFILEGPT_NO_DOTENV !== "1") {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

export default true;
