const express = require("express");
const router = express.Router();
const supabase = require("../db/supabase");

// Store error from frontend
router.post("/", async (req, res) => {
  try {
    const { message, stack, componentStack, url, userAgent, timestamp, userId } = req.body;

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
      })
      .select();

    if (error) throw error;

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

module.exports = router;
