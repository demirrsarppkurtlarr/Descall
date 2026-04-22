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

// Inline feedback - no external file needed
const { requireAuth } = require("./middleware/auth");
const supabase = require("./db/supabase");

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

// Register main routes
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/media", mediaRoutes);
app.use("/groups", groupRoutes);

// ============================================================================
// INLINE FEEDBACK ENDPOINTS - Direct in server.js (most reliable)
// ============================================================================

// Submit feedback - POST /api/feedback/submit
app.post("/api/feedback/submit", requireAuth, async (req, res) => {
  console.log("[FEEDBACK] POST /api/feedback/submit - START");
  console.log("[FEEDBACK] User:", req.user?.username);
  
  try {
    const { category, priority, message, attachments } = req.body;
    
    // Validation
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Message is required" });
    }
    
    // Prepare data
    const feedbackData = {
      user_id: String(req.user.id),
      username: req.user.username || "Anonymous",
      category: String(category || "general").toLowerCase(),
      priority: String(priority || "medium").toLowerCase(),
      message: message.trim(),
      attachments: Array.isArray(attachments) ? attachments.slice(0, 10) : [],
      status: "new",
      viewed: false,
      admin_replies: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log("[FEEDBACK] Inserting...");
    
    // Insert to Supabase
    const { data, error } = await supabase
      .from("user_feedback")
      .insert(feedbackData)
      .select()
      .single();
    
    if (error) {
      console.error("[FEEDBACK] Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    console.log("[FEEDBACK] SUCCESS! ID:", data?.id);
    
    return res.status(200).json({
      success: true,
      message: "Feedback submitted successfully",
      feedbackId: data?.id
    });
    
  } catch (err) {
    console.error("[FEEDBACK] ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// List feedback - GET /api/feedback/list
app.get("/api/feedback/list", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("user_feedback")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    return res.status(200).json({ success: true, feedback: data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Mark as viewed - POST /api/feedback/:id/view
app.post("/api/feedback/:id/view", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from("user_feedback")
      .update({ viewed: true, viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    return res.status(200).json({ success: true, feedback: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin reply - POST /api/feedback/:id/reply
app.post("/api/feedback/:id/reply", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Reply message required" });
    }
    
    // Get current
    const { data: current, error: fetchError } = await supabase
      .from("user_feedback")
      .select("admin_replies")
      .eq("id", id)
      .single();
    
    if (fetchError) return res.status(500).json({ success: false, error: fetchError.message });
    
    // Add reply
    const replies = current?.admin_replies || [];
    replies.push({
      id: Date.now().toString(),
      admin_id: req.user.id,
      admin_username: req.user.username,
      message: message.trim(),
      created_at: new Date().toISOString()
    });
    
    // Update
    const { data, error } = await supabase
      .from("user_feedback")
      .update({ admin_replies: replies, status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    return res.status(200).json({ success: true, feedback: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Delete feedback - DELETE /api/feedback/:id
app.delete("/api/feedback/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase.from("user_feedback").delete().eq("id", id);
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    return res.status(200).json({ success: true, message: "Feedback deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

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
