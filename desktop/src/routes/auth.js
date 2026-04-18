const express = require("express");
const bcrypt = require("bcryptjs");
const supabase = require("../db/supabase");
const { signToken } = require("../config/jwt");
const { requireAuth } = require("../middleware/auth");
const { userLastLoginAt } = require("../runtime/sharedState");

const router = express.Router();

const BCRYPT_ROUNDS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// Input validation helpers
// ─────────────────────────────────────────────────────────────────────────────

function validateUsername(username) {
  if (typeof username !== "string") return "Username must be a string.";
  const trimmed = username.trim();
  if (trimmed.length < 2) return "Username must be at least 2 characters.";
  if (trimmed.length > 24) return "Username must be at most 24 characters.";
  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed))
    return "Username may only contain letters, numbers, underscores, hyphens, and dots.";
  return null; // valid
}

function validatePassword(password) {
  if (typeof password !== "string") return "Password must be a string.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  if (password.length > 72) return "Password must be at most 72 characters."; // bcrypt limit
  return null; // valid
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /register
// Body: { username, password }
// Returns: { message, user: { id, username } }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    // --- Validate inputs ---
    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const cleanUsername = username.trim();

    // --- Check for existing username (case-insensitive) ---
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

    // --- Hash password ---
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // --- Insert new user ---
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({ username: cleanUsername, password_hash })
      .select("id, username")
      .single();

    if (insertError) {
      return res.status(500).json({ error: "Failed to create user." });
    }

    return res.status(201).json({
      message: "User registered successfully.",
      user: { id: newUser.id, username: newUser.username },
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /login
// Body: { username, password }
// Returns: { message, token, user: { id, username } }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    // --- Basic presence check (avoid leaking which field is wrong) ---
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Invalid request body." });
    }

    const cleanUsername = username.trim();

    // --- Fetch user ---
    const { data: user, error: lookupError } = await supabase
      .from("users")
      .select("id, username, password_hash")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (lookupError) {
      return res.status(500).json({ error: "Internal server error." });
    }

    // Always run bcrypt compare to prevent timing attacks, even if user not found
    const dummyHash = "$2a$12$invalidhashfortimingprotection000000000000000000000000";
    const hashToCompare = user ? user.password_hash : dummyHash;

    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch) {
      // Generic message — don't reveal whether username exists
      return res.status(401).json({ error: "Invalid username or password." });
    }

    // --- Sign JWT ---
    const token = signToken({ id: user.id, username: user.username });

    userLastLoginAt.set(user.id, new Date().toISOString());

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/me", requireAuth, (req, res) => {
  return res.status(200).json({ user: req.user });
});

module.exports = router;
