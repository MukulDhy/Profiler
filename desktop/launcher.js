/* eslint-disable no-console */
/**
 * ProfileGPT portable launcher.
 *
 * Runs next to the ZIP contents and is started by ProfileGPT.exe (or
 * Start ProfileGPT.bat). It:
 *
 *   1. reads `config.json` and maps it onto environment variables,
 *   2. starts the bundled Express backend (`runtime/node.exe backend/app.js`),
 *   3. starts the Python analyser sidecar (`ai/profilegpt-analyser.exe`),
 *   4. waits for `/api/health`, then opens the browser,
 *   5. watches `config.json` and restarts the analyser when the AI provider
 *      changes (the setup wizard writes that file).
 *
 * Logs go to `logs/backend.log`, `logs/analyser.log` and `logs/launcher.log`.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn, spawnSync } = require("child_process");

const IS_WINDOWS = process.platform === "win32";

const ROOT = path.resolve(
  process.env.PROFILEGPT_LAUNCHER_ROOT || __dirname
);
const DATA_DIR = path.join(ROOT, "data");
const LOGS_DIR = path.join(ROOT, "logs");
const CONFIG_PATH = path.join(ROOT, "config.json");
const PID_PATH = path.join(DATA_DIR, "launcher.pid");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PROFILEGPT_PORT || 5001);
const ANALYSER_PORT = Number(process.env.PROFILEGPT_ANALYSER_PORT || 8000);
const BASE_URL = `http://${HOST}:${PORT}`;
const HEALTH_URL = `${BASE_URL}/api/health`;

const PROVIDER_KEY_ENV = {
  openrouter: "OPENROUTER_API_KEY",
  google: "GOOGLE_API_KEY",
  openai: "OPENAI_API_KEY",
};

const LOG_KEYS = [
  "MONGO_URI",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "OPENROUTER_API_KEY",
  "GOOGLE_API_KEY",
  "OPENAI_API_KEY",
  "AI_PROVIDER",
  "AI_MODEL",
  "AI_ANALYSER_URL",
  "CLIENT_URL",
  "STORAGE",
  "MAIL_MODE",
  "COOKIE_SECURE",
  "PROFILEGPT_HOME",
  "LOG_TO_CONSOLE",
  "PUBLIC_BASE_URL",
];

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(LOGS_DIR, { recursive: true });

const launcherLog = fs.createWriteStream(path.join(LOGS_DIR, "launcher.log"), {
  flags: "a",
});

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  launcherLog.write(`${line}\n`);
  try {
    console.log(line);
  } catch {
    // A hidden process may not have a usable stdout.
  }
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return null;
  }
}

function cleanBaseEnv() {
  const env = { ...process.env };
  for (const key of LOG_KEYS) delete env[key];
  return env;
}

function backendEnv(config) {
  const env = cleanBaseEnv();

  env.NODE_ENV = "production";
  env.PORT = String(PORT);
  env.HOST = HOST;
  env.CLIENT_URL = BASE_URL;
  env.PROFILEGPT_HOME = ROOT;
  env.PROFILEGPT_NO_DOTENV = "1";
  env.PROFILEGPT_WEB_DIR = path.join(ROOT, "web");
  env.STORAGE = "local";
  env.MAIL_MODE = "disabled";
  env.COOKIE_SECURE = "false";
  env.LOG_TO_CONSOLE = "1";
  env.AI_ANALYSER_URL = `http://${HOST}:${ANALYSER_PORT}`;
  env.AI_ANALYSER_TIMEOUT = "450000";

  if (config?.mongoUri) env.MONGO_URI = config.mongoUri;
  if (config?.jwtSecret) env.JWT_SECRET = config.jwtSecret;
  if (config?.jwtRefreshSecret) env.JWT_REFRESH_SECRET = config.jwtRefreshSecret;

  return env;
}

function analyserEnv(config) {
  const env = cleanBaseEnv();

  env.HOST = HOST;
  env.PORT = String(ANALYSER_PORT);
  env.EXTRACTION_MODE = "light";
  env.SERVICE_TOKEN = "";
  env.PYTHONUNBUFFERED = "1";
  env.PYTHONUTF8 = "1";

  const provider = (config?.llm?.provider || "").toLowerCase();
  const apiKey = config?.llm?.apiKey || "";
  if (provider) env.AI_PROVIDER = provider;
  if (config?.llm?.model) env.AI_MODEL = config.llm.model;

  const keyEnv = PROVIDER_KEY_ENV[provider];
  if (keyEnv && apiKey) env[keyEnv] = apiKey;

  return env;
}

function spawnLogged(label, command, args, options, logFile) {
  const stream = fs.createWriteStream(logFile, { flags: "a" });
  stream.write(
    `\n=== ${new Date().toISOString()} ${label}: ${command} ${args.join(" ")}\n`
  );

  const child = spawn(command, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout.pipe(stream);
  child.stderr.pipe(stream);
  child.on("error", (error) => {
    stream.write(`=== ${label} failed to start: ${error.message}\n`);
    log(`${label} failed to start: ${error.message}`);
  });
  child.on("exit", (code, signal) => {
    stream.write(`=== ${label} exited code=${code} signal=${signal}\n`);
    stream.end();
  });

  return child;
}

function nodeBinary() {
  const bundled = path.join(ROOT, "runtime", "node.exe");
  return fs.existsSync(bundled) ? bundled : process.execPath;
}

function analyserBinary() {
  const exe = path.join(ROOT, "ai", "profilegpt-analyser.exe");
  if (fs.existsSync(exe)) return exe;
  const unix = path.join(ROOT, "ai", "profilegpt-analyser");
  return fs.existsSync(unix) ? unix : null;
}

function pingHealth() {
  return new Promise((resolve) => {
    const request = http.get(
      HEALTH_URL,
      { timeout: 2000 },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed?.message === "Health check");
          } catch {
            resolve(false);
          }
        });
      }
    );
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

function openBrowser(url) {
  if (process.env.PROFILEGPT_NO_BROWSER === "1") {
    log(`PROFILEGPT_NO_BROWSER=1 — not opening ${url}`);
    return;
  }

  if (IS_WINDOWS) {
    spawn("cmd", ["/c", "start", "", url], {
      windowsHide: true,
      detached: true,
      stdio: "ignore",
    }).unref();
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

function killTree(child) {
  if (!child || child.exitCode !== null || !child.pid) return;
  if (IS_WINDOWS) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  } else {
    try {
      child.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
}

function signature(config) {
  return JSON.stringify([
    config?.mongoUri || "",
    config?.llm?.provider || "",
    config?.llm?.apiKey || "",
    config?.llm?.model || "",
  ]);
}

let backend = null;
let analyser = null;
let shuttingDown = false;
let currentSignature = "";

function startAnalyser(config) {
  const binary = analyserBinary();
  if (!binary) {
    log("AI analyser not bundled — skipping sidecar (chat/analysis unavailable).");
    return;
  }

  const env = analyserEnv(config);
  const hasKey = Object.values(PROVIDER_KEY_ENV).some((key) => env[key]);
  if (!hasKey) {
    log("No AI provider key configured yet — analyser will start after setup.");
    return;
  }

  log(`Starting AI analyser on ${HOST}:${ANALYSER_PORT}`);
  analyser = spawnLogged(
    "analyser",
    binary,
    [],
    { cwd: path.join(ROOT, "ai"), env },
    path.join(LOGS_DIR, "analyser.log")
  );
}

function stopAnalyser() {
  if (analyser) {
    killTree(analyser);
    analyser = null;
  }
}

function restartAnalyser(config) {
  stopAnalyser();
  // Give Windows a moment to release port 8000 before rebinding.
  setTimeout(() => {
    if (!shuttingDown) startAnalyser(config);
  }, 500);
}

async function waitForBackend(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await pingHealth()) return true;
    if (backend && backend.exitCode !== null) return false;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  return false;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  killTree(analyser);
  killTree(backend);

  try {
    if (
      fs.existsSync(PID_PATH) &&
      fs.readFileSync(PID_PATH, "utf8").trim() === String(process.pid)
    ) {
      fs.unlinkSync(PID_PATH);
    }
  } catch {
    // best effort
  }

  log(`Launcher stopped (code ${exitCode}).`);
  launcherLog.end(() => process.exit(exitCode));
}

async function main() {
  log(
    `ProfileGPT launcher starting (version ${
      process.env.PROFILEGPT_VERSION || "dev"
    }) from ${ROOT}`
  );

  // Already running (double-click while the app is open): just focus it.
  if (await pingHealth()) {
    log("ProfileGPT is already running — opening the browser.");
    openBrowser(BASE_URL);
    launcherLog.end(() => process.exit(0));
    return;
  }

  fs.writeFileSync(PID_PATH, String(process.pid), "utf8");

  let config = readConfig();
  if (!config) {
    log("config.json not found — starting in setup mode.");
  }
  currentSignature = signature(config);

  const backendEntry = path.join(ROOT, "backend", "app.js");
  if (!fs.existsSync(backendEntry)) {
    log(`Backend entry point missing: ${backendEntry}`);
    shutdown(1);
    return;
  }

  log(`Starting backend on ${BASE_URL}`);
  backend = spawnLogged(
    "backend",
    nodeBinary(),
    [backendEntry],
    { cwd: ROOT, env: backendEnv(config) },
    path.join(LOGS_DIR, "backend.log")
  );

  backend.on("exit", (code) => {
    if (shuttingDown) return;
    log(`Backend exited unexpectedly (code ${code}). See logs/backend.log.`);
    shutdown(code || 1);
  });

  const ready = await waitForBackend();
  if (ready) {
    log("Backend is ready — opening the browser.");
    openBrowser(BASE_URL);
  } else {
    log(
      "Backend did not become ready in time. Opening the browser anyway; check logs/backend.log."
    );
    openBrowser(BASE_URL);
  }

  startAnalyser(config);

  // The setup wizard (or a manual edit) rewrites config.json. Restart the
  // analyser whenever the database/provider settings change. `watchFile` also
  // fires when the file is created for the first time.
  fs.watchFile(CONFIG_PATH, { interval: 1500 }, (current) => {
    if (!current || current.mtimeMs === 0) return;
    const next = readConfig();
    if (!next) return;
    const nextSignature = signature(next);
    if (nextSignature === currentSignature) return;

    currentSignature = nextSignature;
    config = next;
    log("config.json changed — restarting the AI analyser.");
    restartAnalyser(config);
  });

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
  process.on("uncaughtException", (error) => {
    log(`Uncaught exception: ${error.stack || error.message}`);
    shutdown(1);
  });
}

main().catch((error) => {
  log(`Fatal launcher error: ${error.stack || error.message}`);
  shutdown(1);
});
