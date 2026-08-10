const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Voting state.
// x/y are normalized from 0 to 1 so every screen size maps to the same place.
let state = {
  active: true,
  round: 1,
  clicks: [],
  maxOneVotePerConnection: true
};

function publicState() {
  return {
    active: state.active,
    round: state.round,
    clicks: state.clicks,
    totalVotes: state.clicks.length
  };
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.json({ ok: true }));

io.on("connection", (socket) => {
  socket.data.votedRound = null;
  socket.emit("state", publicState());

  socket.on("vote", (payload) => {
    if (!state.active) return;
    if (!payload || typeof payload.x !== "number" || typeof payload.y !== "number") return;

    const x = Math.max(0, Math.min(1, payload.x));
    const y = Math.max(0, Math.min(1, payload.y));

    if (state.maxOneVotePerConnection && socket.data.votedRound === state.round) {
      // Allow changing the vote: remove previous vote from this socket in current round.
      state.clicks = state.clicks.filter(v => !(v.socketId === socket.id && v.round === state.round));
    }

    state.clicks.push({
      x, y,
      socketId: socket.id,
      round: state.round,
      at: Date.now()
    });
    socket.data.votedRound = state.round;

    io.emit("state", publicState());
  });

  socket.on("admin:reset", () => {
    state.round += 1;
    state.clicks = [];
    state.active = true;
    for (const s of io.sockets.sockets.values()) s.data.votedRound = null;
    io.emit("state", publicState());
  });

  socket.on("admin:toggle", () => {
    state.active = !state.active;
    io.emit("state", publicState());
  });
});

server.listen(PORT, () => {
  console.log(`SHOGONN1 Click Vote running on port ${PORT}`);
});
