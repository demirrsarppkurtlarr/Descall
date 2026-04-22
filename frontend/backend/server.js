"use strict";

/**
 * DESCALL BACKEND - CLEAN VERSION
 * Simple, robust, error-proof
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Routes
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const mediaRoutes = require("./routes/media");
const groupRoutes = require("./routes/groups");
const feedbackRoutes = require("./routes/feedback");

// Socket
const { socketAuthMiddleware } = require("./middleware/socketAuth");
const { registerSocketHandlers } = require("./socket/handlers");

const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"], credentials: false },
  transports: ["websocket", "polling"],
  allowUpgrades: true,
  pingInterval: 25000,
  pingTimeout: 20000,
});

app.set("io", io);

// Middleware
app.use(cors({ origin: true, credentials: false }));
app.use(express.json());

// Debug - log all requests
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.path}`);
  next();
});

// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Descall Backend v3.0 - Feedback System Ready",
    timestamp: new Date().toISOString(),
    version: "3.0.0"
  });
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Test endpoint - no auth required
app.post("/api/test", (req, res) => {
  console.log("[TEST] POST /api/test received");
  res.json({
    success: true,
    message: "Test endpoint works",
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// Register routes
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/media", mediaRoutes);
app.use("/groups", groupRoutes);
app.use("/api/feedback", feedbackRoutes);

console.log("[SERVER] Routes registered:");
console.log("  - /auth");
console.log("  - /admin");
console.log("  - /media");
console.log("  - /groups");
console.log("  - /api/feedback");
console.log("  - /api/test (no auth)");
console.log("  - /health");

// Static files
app.use("/media/files", express.static(path.join(__dirname, "uploads")));

// Serve frontend in production
const distPath = path.join(__dirname, "..", "dist");
if (require("fs").existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// 404 handler
app.use((_req, res) => {
  console.log("[404]", _req.method, _req.path);
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err);
  res.status(500).json({ error: err.message || "Internal error" });
});

// Socket.IO
io.use(socketAuthMiddleware);
io.engine.on("connection_error", () => {});
registerSocketHandlers(io);

// Start server
console.log("=== Descall Backend v3.0 ===");
console.log("PORT:", PORT);
console.log("ENV check:");
console.log("  SUPABASE_URL:", !!process.env.SUPABASE_URL);
console.log("  SUPABASE_SERVICE_ROLE_KEY:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("  JWT_SECRET:", !!process.env.JWT_SECRET);

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
