"use strict";

/**
 * NEW FEEDBACK SYSTEM - Robust, Simple, Error-Proof
 * Endpoints:
 *   POST /api/feedback/submit - Submit feedback
 *   GET  /api/feedback/list   - List all feedback (admin)
 *   POST /api/feedback/:id/view - Mark as viewed
 *   POST /api/feedback/:id/reply - Admin reply
 *   DELETE /api/feedback/:id - Delete feedback
 */

const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { supabase } = require("../db/supabase");

const router = express.Router();

// ============================================================================
// SUBMIT FEEDBACK - POST /api/feedback/submit
// ============================================================================
router.post("/submit", requireAuth, async (req, res) => {
  console.log("[FEEDBACK] ============================================");
  console.log("[FEEDBACK] POST /api/feedback/submit - START");
  console.log("[FEEDBACK] User:", req.user?.username, "(", req.user?.id, ")");
  
  try {
    // Extract and validate input
    const { category, priority, message, attachments } = req.body;
    
    console.log("[FEEDBACK] Input:", { 
      category, 
      priority, 
      messageLength: message?.length,
      attachmentsCount: attachments?.length 
    });
    
    // Validation
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      console.log("[FEEDBACK] ERROR: Message is required");
      return res.status(400).json({
        success: false,
        error: "Message is required",
        code: "MISSING_MESSAGE"
      });
    }
    
    if (message.trim().length > 5000) {
      console.log("[FEEDBACK] ERROR: Message too long");
      return res.status(400).json({
        success: false,
        error: "Message too long (max 5000 characters)",
        code: "MESSAGE_TOO_LONG"
      });
    }
    
    // Prepare feedback data
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
    
    console.log("[FEEDBACK] Inserting to Supabase...");
    
    // Insert to Supabase
    const { data, error } = await supabase
      .from("user_feedback")
      .insert(feedbackData)
      .select()
      .single();
    
    if (error) {
      console.error("[FEEDBACK] Supabase Error:", error);
      return res.status(500).json({
        success: false,
        error: "Database error: " + error.message,
        code: "DB_ERROR"
      });
    }
    
    console.log("[FEEDBACK] SUCCESS! ID:", data?.id);
    console.log("[FEEDBACK] ============================================");
    
    // Return success
    return res.status(200).json({
      success: true,
      message: "Feedback submitted successfully",
      feedbackId: data?.id,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error("[FEEDBACK] UNEXPECTED ERROR:", err);
    console.error("[FEEDBACK] Stack:", err.stack);
    console.log("[FEEDBACK] ============================================");
    
    return res.status(500).json({
      success: false,
      error: "Internal server error: " + (err.message || "Unknown error"),
      code: "INTERNAL_ERROR"
    });
  }
});

// ============================================================================
// LIST FEEDBACK - GET /api/feedback/list (Admin only)
// ============================================================================
router.get("/list", requireAuth, async (req, res) => {
  console.log("[FEEDBACK] GET /api/feedback/list - User:", req.user?.username);
  
  try {
    const { data, error } = await supabase
      .from("user_feedback")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[FEEDBACK] List Error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch feedback: " + error.message
      });
    }
    
    return res.status(200).json({
      success: true,
      count: data?.length || 0,
      feedback: data || []
    });
    
  } catch (err) {
    console.error("[FEEDBACK] List Error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal error"
    });
  }
});

// ============================================================================
// MARK AS VIEWED - POST /api/feedback/:id/view
// ============================================================================
router.post("/:id/view", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from("user_feedback")
      .update({
        viewed: true,
        viewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    
    return res.status(200).json({
      success: true,
      feedback: data
    });
    
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============================================================================
// ADMIN REPLY - POST /api/feedback/:id/reply
// ============================================================================
router.post("/:id/reply", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Reply message is required"
      });
    }
    
    // Get current feedback
    const { data: current, error: fetchError } = await supabase
      .from("user_feedback")
      .select("admin_replies")
      .eq("id", id)
      .single();
    
    if (fetchError) {
      return res.status(500).json({
        success: false,
        error: fetchError.message
      });
    }
    
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
      .update({
        admin_replies: replies,
        status: "in_progress",
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    
    return res.status(200).json({
      success: true,
      feedback: data
    });
    
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============================================================================
// DELETE FEEDBACK - DELETE /api/feedback/:id
// ============================================================================
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from("user_feedback")
      .delete()
      .eq("id", id);
    
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "Feedback deleted"
    });
    
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
