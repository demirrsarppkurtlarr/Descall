"use strict";

const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { supabase } = require("../db/supabase");

const router = express.Router();

// Submit feedback - robust error handling
router.post("/submit", requireAuth, async (req, res) => {
  console.log("[FeedbackRoute] POST /api/feedback/submit received");
  
  try {
    const user = req.user;
    const { category, priority, message, attachments } = req.body;
    
    // Validation
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Message is required" 
      });
    }
    
    // Prepare data
    const feedbackData = {
      user_id: user.id,
      username: user.username,
      category: category || "general",
      priority: priority || "medium",
      message: message.trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
      status: "new",
      viewed: false,
      admin_replies: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log("[FeedbackRoute] Inserting to Supabase:", feedbackData);
    
    // Insert to Supabase
    const { data, error } = await supabase
      .from("user_feedback")
      .insert(feedbackData)
      .select()
      .single();
    
    if (error) {
      console.error("[FeedbackRoute] Supabase error:", error);
      return res.status(500).json({ 
        success: false, 
        error: error.message || "Database error" 
      });
    }
    
    console.log("[FeedbackRoute] Success:", data.id);
    
    // Return success response
    return res.status(200).json({
      success: true,
      feedback: data,
      message: "Feedback submitted successfully"
    });
    
  } catch (err) {
    console.error("[FeedbackRoute] Unexpected error:", err);
    return res.status(500).json({ 
      success: false, 
      error: err.message || "Internal server error" 
    });
  }
});

// Get all feedback (for admin)
router.get("/list", requireAuth, async (req, res) => {
  try {
    // Check if admin (simplified - you can add proper admin check)
    const { data, error } = await supabase
      .from("user_feedback")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[FeedbackRoute] List error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    return res.status(200).json({ success: true, feedback: data });
  } catch (err) {
    console.error("[FeedbackRoute] List error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Mark as viewed
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
      return res.status(500).json({ success: false, error: error.message });
    }
    
    return res.status(200).json({ success: true, feedback: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Add admin reply
router.post("/:id/reply", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const user = req.user;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Reply message required" });
    }
    
    // Get current feedback
    const { data: current, error: fetchError } = await supabase
      .from("user_feedback")
      .select("admin_replies")
      .eq("id", id)
      .single();
    
    if (fetchError) {
      return res.status(500).json({ success: false, error: fetchError.message });
    }
    
    // Add reply
    const replies = current.admin_replies || [];
    replies.push({
      id: Date.now().toString(),
      admin_id: user.id,
      admin_username: user.username,
      message: message.trim(),
      created_at: new Date().toISOString()
    });
    
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
      return res.status(500).json({ success: false, error: error.message });
    }
    
    return res.status(200).json({ success: true, feedback: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Delete feedback
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from("user_feedback")
      .delete()
      .eq("id", id);
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    return res.status(200).json({ success: true, message: "Feedback deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
