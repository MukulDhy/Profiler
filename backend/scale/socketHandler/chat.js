// ─────────────────────────────────────────────
//  handlers/chat.js
//  Owns all "chat:*" events.
//  Add new chat features here — nothing else
//  needs to change.
// ─────────────────────────────────────────────

function registerChatHandlers(io, socket) {

  // Client emits  →  { room, text }
  socket.on("chat:message", (payload, ack) => {
    const { room, text } = payload ?? {};

    if (!room || !text) {
      return ack?.({ ok: false, error: "INVALID_PAYLOAD" });
    }

    const message = {
      id: Date.now().toString(36),
      senderId: socket.id,
      // senderId: socket.user?.id,   // ← use when auth is on
      text,
      room,
      ts: Date.now(),
    };

    // Broadcast to everyone in the room (including sender)
    io.to(room).emit("chat:message", message);

    // Optional: acknowledge the sender
    ack?.({ ok: true, message });
  });

  // Client emits  →  { room }  (typing indicator)
  socket.on("chat:typing", ({ room } = {}) => {
    if (!room) return;
    socket.to(room).emit("chat:typing", { senderId: socket.id, room });
  });
}

module.exports = { registerChatHandlers };