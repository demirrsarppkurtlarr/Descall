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
  console.log("[Feedback] ========== START ==========");
  
  try {
    console.log("[Feedback] Step 1: Parsing request body");
    const { category, priority, message, attachments = [] } = req.body;
    const user = req.user;
    
    console.log("[Feedback] Step 2: Got user:", JSON.stringify(user));
    console.log("[Feedback] Step 3: Body data:", { category, priority, messageLength: message?.length, attachmentsCount: attachments?.length });

    if (!category || !priority || !message) {
      console.log("[Feedback] ERROR: Missing fields");
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("[Feedback] Step 4: Building insert data");
    
    // Kullanıcı ID'sini kontrol et - UUID formatında mı?
    let userId = user.id;
    console.log("[Feedback] Step 5: User ID type:", typeof userId, "value:", userId);
    
    // Eğer userId string değilse veya undefined ise hata ver
    if (!userId) {
      console.log("[Feedback] ERROR: userId is undefined!");
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // attachments'ı JSON'a çevir (eğer array değilse)
    let attachmentsJson = attachments;
    if (typeof attachments === 'string') {
      try {
        attachmentsJson = JSON.parse(attachments);
      } catch (e) {
        attachmentsJson = [];
      }
    }
    
    const insertData = {
      user_id: userId,
      username: user.username || 'anonymous',
      category,
      priority,
      message,
      attachments: attachmentsJson,
      status: "new",
      created_at: new Date().toISOString(),
    };
    
    console.log("[Feedback] Step 6: Insert data prepared:", JSON.stringify(insertData));
    console.log("[Feedback] Step 7: Supabase client check - supabase is:", typeof supabase);

    console.log("[Feedback] Step 8: Calling supabase insert...");
    const { data, error } = await supabase
      .from("user_feedback")
      .insert(insertData)
      .select();

    console.log("[Feedback] Step 9: Supabase response received");
    
    if (error) {
      console.error("[Feedback] Step 9a: Supabase ERROR:", JSON.stringify(error));
      throw error;
    }

    console.log("[Feedback] Step 10: Supabase success, data:", JSON.stringify(data));

    console.log("[Feedback] Step 11: Adding to in-memory state");
    const feedback = state.addFeedback(
      { id: userId, username: user.username, avatar_url: user.avatar_url },
      category,
      priority,
      message,
      attachmentsJson
    );

    console.log("[Feedback] Step 12: Checking socket.io");
    try {
      const io = req.app.get("io");
      console.log("[Feedback] Step 13: io is:", typeof io);
      if (io) {
        io.to("admin").emit("feedback:new", feedback);
        console.log("[Feedback] Step 14: Socket event emitted");
      }
    } catch (socketErr) {
      console.error("[Feedback] Socket error (non-critical):", socketErr.message);
    }

    console.log("[Feedback] Step 15: Sending response");
    return res.json({ success: true, feedback, dbData: data });
    
  } catch (error) {
    console.error("[Feedback] CRITICAL ERROR:", error);
    console.error("[Feedback] ERROR MESSAGE:", error.message);
    console.error("[Feedback] ERROR STACK:", error.stack);
    
    // Her zaman JSON dön
    return res.status(500).json({ 
      error: "Failed to submit feedback", 
      details: error.message || "Unknown error",
      code: error.code || "UNKNOWN"
    });
  } finally {
    console.log("[Feedback] ========== END ==========");
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
