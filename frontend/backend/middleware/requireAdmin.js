"use strict";

function requireAdmin(req, res, next) {
  const u = req.user;
  if (!u || u.username !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  return next();
}

module.exports = { requireAdmin };
