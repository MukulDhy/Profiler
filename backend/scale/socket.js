// ─────────────────────────────────────────────
//  socket.js  —  Core Socket.IO initializer
//  • Creates the io instance ONCE
//  • Wires middleware (auth, logging)
//  • Delegates events to handlers/
// ─────────────────────────────────────────────

const { Server } = require("socket.io");
const { registerChatHandlers } = require("./handlers/chat");
const { registerRoomHandlers } = require("./handlers/room");
// 🔌 Add more handler imports here as the app grows

let io; // singleton — import getIO() anywhere on the server

// ── Middleware: auth ──────────────────────────
function authMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  // TODO: replace with real JWT / session check
  if (!token) {
    return next(new Error("AUTH_REQUIRED"));
  }

  // Attach user info to socket so handlers can read it
  socket.user = { id: socket.id, token };
  next();
}

// ── Middleware: logger ────────────────────────
function loggerMiddleware(socket, next) {
  console.log(`[socket] connect  id=${socket.id}`);
  socket.onAny((event, ...args) => {
    console.log(`[socket] event="${event}" id=${socket.id}`, args);
  });
  next();
}

// ── Init ──────────────────────────────────────
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || "*", // tighten in production
      methods: ["GET", "POST"],
    },
    // Tune transports, ping intervals, etc. here
    // transports: ["websocket"],
  });

  // ── Global middleware ─────────────────────
  // io.use(authMiddleware);   // ← uncomment to enforce auth
  io.use(loggerMiddleware);

  // ── Per-connection logic ──────────────────
  io.on("connection", (socket) => {
    // Register feature-specific event handlers
    registerChatHandlers(io, socket);
    registerRoomHandlers(io, socket);
    // 🔌 registerYourHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      console.log(`[socket] disconnect id=${socket.id} reason=${reason}`);
    });
  });

  console.log("[socket] Socket.IO initialized ✓");
  return io;
}

// ── Getter (use in REST routes or cron jobs) ──
function getIO() {
  if (!io) throw new Error("Socket.IO not initialized. Call initSocket() first.");
  return io;
}

module.exports = { initSocket, getIO };