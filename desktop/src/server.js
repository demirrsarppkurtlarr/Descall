"use strict";

require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const { socketAuthMiddleware } = require("./middleware/socketAuth");
const { registerSocketHandlers } = require("./socket/handlers");

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const ALLOW_ALL_ORIGINS = process.env.ALLOW_ALL_ORIGINS !== "false";
const ALLOWED_ORIGINS =
  CLIENT_ORIGIN === "*"
    ? null
    : CLIENT_ORIGIN.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOW_ALL_ORIGINS) return true;
  if (!ALLOWED_ORIGINS) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function corsOriginDelegate(origin, callback) {
  if (isOriginAllowed(origin)) return callback(null, true);
  return callback(new Error(`CORS blocked for origin: ${origin}`));
}

const expressCorsConfig = ALLOW_ALL_ORIGINS
  ? { origin: true, credentials: false }
  : { origin: corsOriginDelegate, credentials: false };

const socketCorsConfig = ALLOW_ALL_ORIGINS
  ? { origin: true, methods: ["GET", "POST"], credentials: false }
  : { origin: corsOriginDelegate, methods: ["GET", "POST"], credentials: false };

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: socketCorsConfig,
  transports: ["websocket", "polling"],
  allowUpgrades: true,
  pingInterval: 25000,
  pingTimeout: 20000,
});

app.set("io", io);

app.use(cors(expressCorsConfig));
app.options("*", cors(expressCorsConfig));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Descall backend is running 🚀",
    version: "1.1.0",
    features: ["auth", "presence", "friends", "dm", "voice-signaling", "general-chat"],
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found." });
});

io.use(socketAuthMiddleware);

io.engine.on("connection_error", () => {});

registerSocketHandlers(io);

httpServer.listen(PORT);
