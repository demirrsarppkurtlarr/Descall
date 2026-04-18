"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { requireAuth } = require("../middleware/auth");
const supabase = require("../db/supabase");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm"];
const ALLOWED_ALL = [...ALLOWED_IMAGE, ...ALLOWED_VIDEO];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".bin";
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_ALL.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`File type ${file.mimetype} not allowed.`));
  },
});

router.use(requireAuth);

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const file = req.file;
    const mediaType = ALLOWED_IMAGE.includes(file.mimetype) ? "image" : "video";
    const url = `/media/files/${file.filename}`;

    res.json({
      id: file.filename,
      url,
      mediaType,
      mimeType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
    });
  } catch (err) {
    res.status(500).json({ error: "Upload failed." });
  }
});

router.post("/avatar", upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No avatar uploaded." });
    if (!ALLOWED_IMAGE.includes(req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Avatar must be an image." });
    }

    const userId = req.user.id;
    const avatarUrl = `/media/files/${req.file.filename}`;

    const { error } = await supabase
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId);

    if (error) {
      return res.status(500).json({ error: "Failed to update avatar." });
    }

    res.json({ avatarUrl });
  } catch (err) {
    res.status(500).json({ error: "Avatar upload failed." });
  }
});

module.exports = router;
