const express = require("express");
const router = express.Router();
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");

// BASİT TEST - Çalışıyor mu görelim
router.post("/test-feedback", requireAuth, async (req, res) => {
  console.log("[TEST-FB] ========== START ==========");
  
  try {
    const user = req.user;
    console.log("[TEST-FB] User:", user);
    
    // En basit insert
    const simpleData = {
      user_id: user.id,
      username: user.username || "test",
      category: "bug",
      priority: "medium", 
      message: "Test message " + Date.now(),
      attachments: [],
      status: "new",
      created_at: new Date().toISOString()
    };
    
    console.log("[TEST-FB] Inserting:", JSON.stringify(simpleData));
    
    const { data, error } = await supabase
      .from("user_feedback")
      .insert(simpleData)
      .select();
    
    if (error) {
      console.error("[TEST-FB] ERROR:", error);
      return res.status(500).json({ error: error.message, code: error.code });
    }
    
    console.log("[TEST-FB] SUCCESS:", data);
    return res.json({ success: true, data });
    
  } catch (err) {
    console.error("[TEST-FB] EXCEPTION:", err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
});

module.exports = router;
