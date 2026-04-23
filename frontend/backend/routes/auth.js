const express = require("express");
const bcrypt = require("bcryptjs");
const supabase = require("../db/supabase");
const { signToken } = require("../config/jwt");
const { requireAuth } = require("../middleware/auth");
const { userLastLoginAt } = require("../runtime/sharedState");

const router = express.Router();

const BCRYPT_ROUNDS = 12;

function validateUsername(username) {
  if (typeof username !== "string") return "Username must be a string.";
  const trimmed = username.trim();
  if (trimmed.length < 2) return "Username must be at least 2 characters.";
  if (trimmed.length > 24) return "Username must be at most 24 characters.";
  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed))
    return "Username may only contain letters, numbers, underscores, hyphens, and dots.";
  return null;
}

function validatePassword(password) {
  if (typeof password !== "string") return "Password must be a string.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  if (password.length > 72) return "Password must be at most 72 characters.";
  return null;
}

router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const cleanUsername = username.trim();

    const { data: existing, error: lookupError } = await supabase
      .from("users")
      .select("id")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (lookupError) {
      return res.status(500).json({ error: "Internal server error." });
    }

    if (existing) {
      return res.status(409).json({ error: "Username is already taken." });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({ username: cleanUsername, password_hash })
      .select("id, username, avatar_url")
      .single();

    if (insertError) {
      return res.status(500).json({ error: "Failed to create user." });
    }

    return res.status(201).json({
      message: "User registered successfully.",
      user: { id: newUser.id, username: newUser.username, avatarUrl: newUser.avatar_url || null },
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Invalid request body." });
    }

    const cleanUsername = username.trim();
    console.log("[AUTH] Login attempt for:", cleanUsername);

    const { data: user, error: lookupError } = await supabase
      .from("users")
      .select("id, username, password_hash, avatar_url")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (lookupError) {
      console.error("[AUTH] Supabase lookup error:", lookupError);
      return res.status(500).json({ error: "Database error." });
    }

    const dummyHash = "$2a$12$invalidhashfortimingprotection000000000000000000000000";
    const hashToCompare = user ? user.password_hash : dummyHash;

    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const token = signToken({ id: user.id, username: user.username });

    userLastLoginAt.set(user.id, new Date().toISOString());

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: { id: user.id, username: user.username, avatarUrl: user.avatar_url || null },
    });
  } catch (err) {
    console.error("[AUTH] Login error:", err);
    return res.status(500).json({ error: "Internal server error.", details: err.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, avatar_url, is_admin")
      .eq("id", req.user.id)
      .single();
    
    if (error || !user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    return res.status(200).json({ user });
  } catch (err) {
    console.error("[AUTH] /me error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/test", async (_req, res) => {
  try {
    const { data, error } = await supabase.from("users").select("count").limit(1);
    if (error) {
      return res.status(500).json({ status: "db_error", error: error.message });
    }
    return res.json({ status: "ok", message: "Auth service running" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
