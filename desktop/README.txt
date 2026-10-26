ProfileGPT — portable Windows build
===================================

Quick start
-----------

1. Extract the whole ZIP to a folder you can write to.
   Do not run it from inside the ZIP, and avoid Program Files.
2. Double-click  ProfileGPT.exe
   (or "Start ProfileGPT.vbs" if the .exe is blocked).
3. Your browser opens http://127.0.0.1:5001 with the setup wizard.
4. Paste a MongoDB connection string and an AI provider API key, then finish.

To quit, double-click "Stop ProfileGPT.bat" (this stops the local servers).
The browser tab can be closed at any time.

What you need
-------------

- A MongoDB database. A free MongoDB Atlas cluster works:
  https://www.mongodb.com/cloud/atlas/register
- An API key for one of: OpenRouter, Google AI Studio (Gemini), or OpenAI.
  Only the key for the provider you pick is stored.

No Node.js, Python or database server needs to be installed — everything is
bundled in this folder.

Where your data lives
---------------------

Everything stays inside this folder:

  config.json     credentials and generated session secrets
  data/           uploaded resumes and avatars
  logs/           backend, analyser and launcher logs
  ai/tmp/         temporary extraction files

Back up config.json if you want to move the install to another machine.
Delete config.json to run the setup wizard again.

Notes and limitations
---------------------

- Windows x64 only. The build is unsigned, so SmartScreen may show
  "Windows protected your PC" the first time. Choose "More info" → "Run anyway".
- The app only listens on 127.0.0.1; nothing is exposed to your network.
- Share links point at http://127.0.0.1:5001/share/... and therefore only work
  on this machine.
- Email verification and password-reset emails are disabled in this build.
  Any verification code is written to logs/backend.log instead. Email
  verification is not required to sign in.
- Document extraction uses a lightweight PDF/DOCX reader. Complex layouts
  (multi-column, scanned PDFs) may extract less cleanly than the full Docling
  pipeline used in development.
- The AI analyser runs locally but calls your chosen LLM provider over the
  internet, so an internet connection is required for analysis and chat.

Troubleshooting
---------------

- Nothing opens: run "Start ProfileGPT.bat" instead — it keeps a console open
  and prints startup errors.
- Port already in use: close other ProfileGPT windows, or set a different port
  before launching (PROFILEGPT_PORT=5055).
- Logs: logs\launcher.log, logs\backend.log, logs\analyser.log
- Antivirus blocks the bundled Python executable: allow
  ai\profilegpt-analyser.exe in your antivirus and start the app again.
