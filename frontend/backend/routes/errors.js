const express = require("express");
const router = express.Router();
const supabase = require("../db/supabase");
const state = require("../runtime/sharedState");
const { requireAuth } = require("../middleware/auth");

// Store error from frontend
router.post("/", async (req, res) => {
  try {
    const { message, stack, componentStack, url, userAgent, timestamp, userId, username, severity = "error", source = "frontend" } = req.body;

    // Store error in Supabase
    const { data, error } = await supabase
      .from("error_logs")
      .insert({
        message,
        stack,
        component_stack: componentStack,
        url,
        user_agent: userAgent,
        user_id: userId || "anonymous",
        timestamp: timestamp || new Date().toISOString(),
        resolved: false,
        severity,
        source,
      })
      .select();

    if (error) throw error;

    // Also store in enhanced in-memory error logs
    state.appendErrorLog(source, message, {
      severity,
      stack,
      componentStack,
      url,
      userAgent,
      request: { url, userAgent },
    }, userId, username);

    // Emit to admin in real-time
    const io = req.app.get("io");
    if (io) {
      io.to("admin").emit("error:new", {
        id: data?.[0]?.id,
        timestamp,
        severity,
        source,
        message,
        stack,
        user: userId ? { id: userId, username } : null,
      });
    }

    res.json({ success: true, id: data?.[0]?.id });
  } catch (error) {
    console.error("[Error Log] Failed to log error:", error);
    res.status(500).json({ error: "Failed to log error" });
  }
});

// Get all errors (admin only)
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("error_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error("[Error Log] Failed to fetch errors:", error);
    res.status(500).json({ error: "Failed to fetch errors" });
  }
});

// Mark error as resolved
router.patch("/:id/resolve", async (req, res) => {
  try {
    const { error } = await supabase
      .from("error_logs")
      .update({ resolved: true })
      .eq("id", req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error("[Error Log] Failed to resolve error:", error);
    res.status(500).json({ error: "Failed to resolve error" });
  }
});

// Delete error
router.delete("/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("error_logs")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error("[Error Log] Failed to delete error:", error);
    res.status(500).json({ error: "Failed to delete error" });
  }
});

// ========== USER FEEDBACK ENDPOINTS ==========

// Submit feedback (authenticated users)
router.post("/feedback", requireAuth, async (req, res) => {
  try {
    const { category, priority, message, attachments = [] } = req.body;
    const user = req.user;

    console.log("[Feedback] Received submission:", { 
      userId: user?.id, 
      username: user?.username,
      category, 
      priority, 
      messageLength: message?.length,
      attachmentsCount: attachments?.length 
    });

    if (!category || !priority || !message) {
      console.log("[Feedback] Missing required fields:", { category, priority, message: !!message });
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Store in Supabase
    const insertData = {
      user_id: user.id,
      username: user.username,
      category,
      priority,
      message,
      attachments: attachments || [],
      status: "new",
      created_at: new Date().toISOString(),
    };
    
    console.log("[Feedback] Inserting to Supabase:", insertData);

    const { data, error } = await supabase
      .from("user_feedback")
      .insert(insertData)
      .select();

    if (error) {
      console.error("[Feedback] Supabase insert error:", error);
      throw error;
    }

    console.log("[Feedback] Supabase insert success:", data);

    // Add to in-memory state
    const feedback = state.addFeedback(
      { id: user.id, username: user.username, avatar_url: user.avatar_url },
      category,
      priority,
      message,
      attachments
    );

    // Emit to admin in real-time
    const io = req.app.get("io");
    if (io) {
      io.to("admin").emit("feedback:new", feedback);
    }

    console.log("[Feedback] Sending success response");
    return res.json({ success: true, feedback, dbData: data });
  } catch (error) {
    console.error("[Feedback] FAILED:", error);
    console.error("[Feedback] Error stack:", error.stack);
    return res.status(500).json({ 
      error: "Failed to submit feedback", 
      details: error.message,
      stack: error.stack 
    });
  }
});

// Get user's own feedback history
router.get("/feedback/my", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("user_feedback")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error("[Feedback] Failed to fetch feedback:", error);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

module.exports = router;
