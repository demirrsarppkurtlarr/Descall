"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const mediaRoutes = require("./routes/media");
const groupRoutes = require("./routes/groups");
const errorRoutes = require("./routes/errors");
const feedbackRoutes = require("./routes/feedback");
const feedbackTestRoutes = require("./routes/feedback-test");
const { socketAuthMiddleware } = require("./middleware/socketAuth");
const { registerSocketHandlers } = require("./socket/handlers");
const { requireAuth } = require("./middleware/auth");
const { supabase } = require("./db/supabase");

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

// GET - Root endpoint
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Descall backend is running - DEPLOY-V2",
    version: "2.0.0",
    timestamp: Date.now(),
    features: ["auth", "presence", "friends", "dm", "voice-signaling", "video-signaling", "screen-share", "media-upload", "feedback-fixed"],
  });
});

// POST - Feedback test (same route)
app.post("/", express.json(), (req, res) => {
  console.log("[ROOT-POST] POST to / received!");
  console.log("[ROOT-POST] Body:", req.body);
  res.json({ success: true, received: req.body, endpoint: "root-post" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

console.log("[SERVER] Registering routes...");

// Simple debug - log ALL incoming requests
app.use((req, res, next) => {
  console.log(`[DEBUG-ALL] ${req.method} ${req.path} - Body:`, JSON.stringify(req.body).slice(0, 100));
  next();
});

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/media", mediaRoutes);
app.use("/groups", groupRoutes);

// INLINE TEST - bypass all cache issues
app.post("/api/test-feedback-simple", (req, res) => {
  console.log("[INLINE-TEST] POST /api/test-feedback-simple - HIT!");
  console.log("[INLINE-TEST] Body:", req.body);
  res.json({ success: true, timestamp: Date.now(), body: req.body });
});

console.log("[SERVER] Registering routes...");
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/media", mediaRoutes);
app.use("/groups", groupRoutes);
app.use("/api/feedback", feedbackRoutes);
console.log("[SERVER] Feedback routes registered at /api/feedback");
app.use("/api/errors", errorRoutes);
console.log("[SERVER] Error routes registered");
app.use("/api/test", feedbackTestRoutes);
console.log("[SERVER] All routes registered");
app.use("/media/files", express.static(path.join(__dirname, "uploads")));

// Serve frontend build in production
const distPath = path.join(__dirname, "..", "dist");
if (require("fs").existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Global error handler - MUST have 4 parameters
app.use((err, _req, res, _next) => {
  console.error("[GLOBAL-ERROR] Unhandled error:", err);
  console.error("[GLOBAL-ERROR] Stack:", err.stack);
  res.status(500).json({ error: err.message || "Internal server error", stack: err.stack });
});

app.use((_req, res) => {
  console.log("[404] Route not found:", _req.method, _req.path);
  res.status(404).json({ error: "Route not found." });
});

io.use(socketAuthMiddleware);

io.engine.on("connection_error", () => {});

registerSocketHandlers(io);

// Startup check
console.log("=== Starting Descall Backend ===");
console.log("PORT:", PORT);
console.log("SUPABASE_URL exists:", !!process.env.SUPABASE_URL);
console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET);

httpServer.listen(PORT, () => {
  console.log(`Descall backend listening on port ${PORT}`);
  console.log("Environment check passed - server is ready");
});
