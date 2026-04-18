const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

let users = [];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (username) => {
    users.push({ id: socket.id, username });
    io.emit("users", users);
  });

  socket.on("sendMessage", (data) => {
    io.emit("message", data);
  });

  socket.on("disconnect", () => {
    users = users.filter((u) => u.id !== socket.id);
    io.emit("users", users);
    console.log("User disconnected:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("Descall backend is running");
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
