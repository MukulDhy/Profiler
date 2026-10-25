// ─────────────────────────────────────────────
//  handlers/room.js
//  Owns all "room:*" events.
// ─────────────────────────────────────────────

function registerRoomHandlers(io, socket) {

  // Client emits  →  { room }
  socket.on("room:join", ({ room } = {}, ack) => {
    if (!room) return ack?.({ ok: false, error: "ROOM_REQUIRED" });

    socket.join(room);

    // Tell everyone else in the room
    socket.to(room).emit("room:user_joined", {
      userId: socket.id,
      room,
      ts: Date.now(),
    });

    // Reply with current occupancy
    const count = io.sockets.adapter.rooms.get(room)?.size ?? 0;
    ack?.({ ok: true, room, occupancy: count });

    console.log(`[room] ${socket.id} joined "${room}"  (${count} total)`);
  });

  // Client emits  →  { room }
  socket.on("room:leave", ({ room } = {}, ack) => {
    if (!room) return ack?.({ ok: false, error: "ROOM_REQUIRED" });

    socket.leave(room);
    socket.to(room).emit("room:user_left", { userId: socket.id, room });

    ack?.({ ok: true });
    console.log(`[room] ${socket.id} left "${room}"`);
  });
}

module.exports = { registerRoomHandlers };