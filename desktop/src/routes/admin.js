"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");
const state = require("../runtime/sharedState");
const {
  kickUser,
  disconnectAll,
  notifyAdminRoom,
  buildSnapshot,
} = require("../socket/adminHandlers");

const router = express.Router();
const BCRYPT_ROUNDS = 12;

router.use(requireAuth, requireAdmin);

function getIo(req) {
  return req.app.get("io");
}

function audit(actor, action, target, meta) {
  return state.appendAudit(actor.id, actor.username, action, target, meta);
}

function cleanupUserMemory(userId) {
  state.presence.delete(userId);
  state.socketToUser.forEach((uid, sid) => {
    if (uid === userId) state.socketToUser.delete(sid);
  });
  state.friends.delete(userId);
  for (const [, set] of state.friends) {
    if (set?.has(userId)) set.delete(userId);
  }
  state.pendingRequests.delete(userId);
  for (const [, m] of state.pendingRequests) {
    if (m?.has(userId)) m.delete(userId);
  }
  for (const key of [...state.dmHistory.keys()]) {
    const parts = key.split("::");
    if (parts.includes(userId)) state.dmHistory.delete(key);
  }
  state.notificationsByUser.delete(userId);
  state.dmUnreadByUser.delete(userId);
  state.generalReadAt.delete(userId);
  state.usernameById.delete(userId);
  state.userRoles.delete(userId);
  state.rateLimitGeneral.delete(userId);
  state.rateLimitDm.delete(userId);
  state.slowModeLastPost.delete(userId);
  state.userSessionStartMs.delete(userId);
  state.generalMessages.splice(
    0,
    state.generalMessages.length,
    ...state.generalMessages.filter((m) => m.userId !== userId),
  );
}

// —— Stats & health ——
router.get("/stats", (req, res) => {
  res.json({
    uptime: process.uptime(),
    onlineUsers: state.presence.size,
    generalMessageCount: state.generalMessages.length,
    dmConversationKeys: state.dmHistory.size,
    bannedUsers: state.bannedUserIds.size,
    auditEntries: state.auditLog.length,
    memory: process.memoryUsage(),
  });
});

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    maintenanceMode: state.systemConfig.maintenanceMode,
    chatFrozen: state.systemConfig.chatFrozen,
  });
});

// —— Users ——
router.get("/users", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const page = Math.max(0, parseInt(req.query.page || "0", 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "50", 10) || 50));
    const from = page * limit;
    const to = from + limit - 1;

    let query = supabase.from("users").select("id, username", { count: "exact" });
    if (q) {
      query = query.ilike("username", `%${q}%`);
    }
    const { data, error, count } = await query.order("username", { ascending: true }).range(from, to);
    if (error) return res.status(500).json({ error: error.message });

    const rows = (data || []).map((u) => ({
      ...u,
      online: state.presence.has(u.id),
      banned: state.bannedUserIds.has(u.id),
      role: state.userRoles.get(u.id) || "user",
      lastLoginAt: state.userLastLoginAt.get(u.id) || null,
      onlineMsTotal: state.userOnlineAccumMs.get(u.id) || 0,
    }));

    res.json({ users: rows, total: count ?? rows.length, page, limit });
  } catch (e) {
    res.status(500).json({ error: "Failed to list users." });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, username")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "User not found." });

    const p = state.presence.get(data.id);
    res.json({
      user: data,
      presence: p
        ? { status: p.status, socketId: p.socketId }
        : { status: "offline", socketId: null },
      banned: state.bannedUserIds.has(data.id),
      role: state.userRoles.get(data.id) || "user",
      friends: state.friends.get(data.id) ? [...state.friends.get(data.id)] : [],
      lastLoginAt: state.userLastLoginAt.get(data.id) || null,
      onlineMsTotal: state.userOnlineAccumMs.get(data.id) || 0,
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to load user." });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "username and password required." });
    }
    const clean = username.trim();
    if (clean.length < 2) return res.status(400).json({ error: "Invalid username." });
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { data, error } = await supabase
      .from("users")
      .insert({ username: clean, password_hash: hash })
      .select("id, username")
      .single();
    if (error) return res.status(400).json({ error: error.message });
    audit(req.user, "user_create", data.id, { username: data.username });
    notifyAdminRoom(getIo(req), { type: "user_created", id: data.id });
    res.status(201).json({ user: data });
  } catch (e) {
    res.status(500).json({ error: "Create failed." });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const { role } = req.body || {};
    if (role && ["user", "mod", "admin"].includes(role)) {
      state.userRoles.set(req.params.id, role);
      audit(req.user, "user_role", req.params.id, { role });
    }
    notifyAdminRoom(getIo(req), { type: "user_patch", id: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Patch failed." });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (id === req.user.id) return res.status(400).json({ error: "Cannot delete yourself." });
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    cleanupUserMemory(id);
    state.bannedUserIds.delete(id);
    audit(req.user, "user_delete", id, {});
    notifyAdminRoom(getIo(req), { type: "user_deleted", id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Delete failed." });
  }
});

router.post("/users/:id/ban", (req, res) => {
  const id = req.params.id;
  if (id === req.user.id) return res.status(400).json({ error: "Cannot ban yourself." });
  state.bannedUserIds.add(id);
  kickUser(getIo(req), {
    actorId: req.user.id,
    actorUsername: req.user.username,
    targetUserId: id,
    reason: req.body?.reason || "Banned",
  });
  audit(req.user, "ban", id, { reason: req.body?.reason });
  notifyAdminRoom(getIo(req), { type: "ban", userId: id });
  res.json({ ok: true });
});

router.post("/users/:id/unban", (req, res) => {
  state.bannedUserIds.delete(req.params.id);
  audit(req.user, "unban", req.params.id, {});
  notifyAdminRoom(getIo(req), { type: "unban", userId: req.params.id });
  res.json({ ok: true });
});

router.post("/users/:id/kick", (req, res) => {
  kickUser(getIo(req), {
    actorId: req.user.id,
    actorUsername: req.user.username,
    targetUserId: req.params.id,
    reason: req.body?.reason || "Kicked",
  });
  res.json({ ok: true });
});

router.patch("/users/:id/status", (req, res) => {
  const { status } = req.body || {};
  const allowed = ["online", "idle", "dnd", "invisible"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status." });
  const p = state.presence.get(req.params.id);
  if (p) {
    p.status = status;
    state.presence.set(req.params.id, p);
    getIo(req).emit("users:update", [...state.presence].map(([id, x]) => ({ id, username: x.username, status: x.status })));
  }
  audit(req.user, "force_status", req.params.id, { status });
  res.json({ ok: true });
});

router.post("/users/bulk", (req, res) => {
  const { userIds, action } = req.body || {};
  if (!Array.isArray(userIds)) return res.status(400).json({ error: "userIds array required." });
  const io = getIo(req);
  let n = 0;
  for (const id of userIds) {
    if (typeof id !== "string" || id === req.user.id) continue;
    if (action === "ban") {
      state.bannedUserIds.add(id);
      kickUser(io, { actorId: req.user.id, actorUsername: req.user.username, targetUserId: id, reason: "Bulk ban" });
      n++;
    } else if (action === "unban") {
      state.bannedUserIds.delete(id);
      n++;
    } else if (action === "kick") {
      kickUser(io, { actorId: req.user.id, actorUsername: req.user.username, targetUserId: id, reason: "Bulk kick" });
      n++;
    }
  }
  audit(req.user, "bulk", action, { count: n });
  res.json({ ok: true, affected: n });
});

router.get("/users/:id/activity", (req, res) => {
  const id = req.params.id;
  const tail = state.auditLog.filter((e) => e.target === id || e.actorId === id).slice(0, 100);
  res.json({
    lastLoginAt: state.userLastLoginAt.get(id) || null,
    onlineMsTotal: state.userOnlineAccumMs.get(id) || 0,
    sessionStartMs: state.userSessionStartMs.get(id) || null,
    audit: tail,
  });
});

// —— Messages ——
router.get("/messages", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const userId = req.query.userId;
  let list = [...state.generalMessages];
  if (userId) list = list.filter((m) => m.userId === userId);
  if (q) list = list.filter((m) => (m.text || "").toLowerCase().includes(q));
  const limit = Math.min(500, parseInt(req.query.limit || "200", 10) || 200);
  res.json({ messages: list.slice(-limit), total: list.length });
});

router.delete("/messages/:msgId", (req, res) => {
  const idx = state.generalMessages.findIndex((m) => m.id === req.params.msgId);
  if (idx < 0) return res.status(404).json({ error: "Not found." });
  state.generalMessages.splice(idx, 1);
  getIo(req).emit("message:deleted", { msgId: req.params.msgId });
  audit(req.user, "message_delete", req.params.msgId, {});
  notifyAdminRoom(getIo(req), { type: "message_delete", msgId: req.params.msgId });
  res.json({ ok: true });
});

router.patch("/messages/:msgId", (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "text required." });
  const m = state.generalMessages.find((x) => x.id === req.params.msgId);
  if (!m) return res.status(404).json({ error: "Not found." });
  m.text = text;
  m.edited = true;
  m.editedAt = new Date().toISOString();
  m.adminEdit = true;
  getIo(req).emit("message:updated", {
    msgId: m.id,
    text: m.text,
    edited: true,
    editedAt: m.editedAt,
  });
  audit(req.user, "message_edit", m.id, {});
  res.json({ ok: true, message: m });
});

router.delete("/messages/user/:userId", (req, res) => {
  const uid = req.params.userId;
  const before = state.generalMessages.length;
  const next = state.generalMessages.filter((m) => m.userId !== uid);
  state.generalMessages.length = 0;
  state.generalMessages.push(...next);
  getIo(req).emit("admin:user_messages_removed", { userId: uid });
  audit(req.user, "purge_user_messages", uid, { removed: before - next.length });
  res.json({ ok: true, removed: before - next.length });
});

router.delete("/messages/:msgId/reactions", (req, res) => {
  const m = state.generalMessages.find((x) => x.id === req.params.msgId);
  if (!m) return res.status(404).json({ error: "Not found." });
  m.reactions = {};
  getIo(req).emit("message:reaction:update", { msgId: m.id, reactions: {} });
  audit(req.user, "reactions_clear", m.id, {});
  res.json({ ok: true });
});

router.post("/messages/:msgId/flag", (req, res) => {
  const m = state.generalMessages.find((x) => x.id === req.params.msgId);
  if (!m) return res.status(404).json({ error: "Not found." });
  state.flaggedMessages.push({
    msgId: m.id,
    userId: m.userId,
    at: new Date().toISOString(),
    reason: req.body?.reason || "flag",
  });
  audit(req.user, "message_flag", m.id, {});
  res.json({ ok: true });
});

router.get("/export/messages", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(state.generalMessages, null, 2));
});

// —— DM ——
router.get("/dm/conversations", (_req, res) => {
  const out = [];
  for (const [key, arr] of state.dmHistory) {
    const last = arr.length ? arr[arr.length - 1] : null;
    out.push({ key, messageCount: arr.length, last });
  }
  res.json({ conversations: out });
});

router.get("/dm/export", (_req, res) => {
  const out = {};
  for (const [k, v] of state.dmHistory) out[k] = v;
  res.json(out);
});

router.get("/dm/:key", (req, res) => {
  const arr = state.dmHistory.get(req.params.key) || [];
  res.json({ messages: arr });
});

router.delete("/dm/:key", (req, res) => {
  state.dmHistory.delete(req.params.key);
  audit(req.user, "dm_conv_delete", req.params.key, {});
  res.json({ ok: true });
});

router.delete("/dm/:key/messages/:msgId", (req, res) => {
  const arr = state.dmHistory.get(req.params.key);
  if (!arr) return res.status(404).json({ error: "Not found." });
  const next = arr.filter((m) => m.id !== req.params.msgId);
  state.dmHistory.set(req.params.key, next);
  audit(req.user, "dm_msg_delete", req.params.msgId, {});
  res.json({ ok: true });
});

router.post("/dm/block", (req, res) => {
  const { userIdA, userIdB } = req.body || {};
  if (typeof userIdA !== "string" || typeof userIdB !== "string") {
    return res.status(400).json({ error: "userIdA and userIdB required." });
  }
  const key = [userIdA, userIdB].sort().join("::");
  state.dmBlockPairs.add(key);
  audit(req.user, "dm_block", key, {});
  res.json({ ok: true });
});

router.post("/dm/unblock", (req, res) => {
  const { userIdA, userIdB } = req.body || {};
  const key = [userIdA, userIdB].sort().join("::");
  state.dmBlockPairs.delete(key);
  res.json({ ok: true });
});

router.get("/friends/graph", (_req, res) => {
  const edges = [];
  for (const [uid, set] of state.friends) {
    for (const fid of set || []) {
      edges.push({ a: uid, b: fid });
    }
  }
  res.json({ edges, pending: [...state.pendingRequests.entries()].map(([uid, m]) => ({ uid, pending: [...m.keys()] })) });
});

// —— System ——
router.get("/system", (_req, res) => {
  res.json({
    config: state.systemConfig,
    profanityCount: state.profanityWords.size,
    flaggedCount: state.flaggedMessages.length,
  });
});

router.patch("/system", (req, res) => {
  Object.assign(state.systemConfig, req.body || {});
  audit(req.user, "system_config", "config", req.body || {});
  notifyAdminRoom(getIo(req), { type: "system_config" });
  res.json({ config: state.systemConfig });
});

router.post("/chat/freeze", (req, res) => {
  state.systemConfig.chatFrozen = !!req.body?.frozen;
  audit(req.user, "chat_freeze", String(state.systemConfig.chatFrozen), {});
  notifyAdminRoom(getIo(req), { type: "chat_freeze", frozen: state.systemConfig.chatFrozen });
  res.json({ chatFrozen: state.systemConfig.chatFrozen });
});

router.post("/chat/slowmode", (req, res) => {
  const s = Math.max(0, parseInt(req.body?.seconds || "0", 10) || 0);
  state.systemConfig.slowModeSeconds = s;
  audit(req.user, "slowmode", String(s), {});
  res.json({ slowModeSeconds: s });
});

router.post("/maintenance", (req, res) => {
  state.systemConfig.maintenanceMode = !!req.body?.enabled;
  audit(req.user, "maintenance", String(state.systemConfig.maintenanceMode), {});
  res.json({ maintenanceMode: state.systemConfig.maintenanceMode });
});

router.post("/profanity", (req, res) => {
  const w = String(req.body?.word || "").trim();
  if (!w) return res.status(400).json({ error: "word required." });
  state.profanityWords.add(w);
  audit(req.user, "profanity_add", w, {});
  res.json({ ok: true, count: state.profanityWords.size });
});

router.delete("/profanity/:word", (req, res) => {
  state.profanityWords.delete(req.params.word);
  res.json({ ok: true });
});

router.post("/broadcast", (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "text required." });
  getIo(req).emit("server:announcement", {
    text,
    at: new Date().toISOString(),
    from: "admin",
  });
  audit(req.user, "broadcast", "all", { len: text.length });
  res.json({ ok: true });
});

router.post("/sockets/kick-all", (req, res) => {
  disconnectAll(getIo(req), req.user.id, req.user.username);
  res.json({ ok: true });
});

router.post("/sockets/kick/:userId", (req, res) => {
  kickUser(getIo(req), {
    actorId: req.user.id,
    actorUsername: req.user.username,
    targetUserId: req.params.userId,
    reason: req.body?.reason || "Kicked by admin",
  });
  res.json({ ok: true });
});

router.get("/sockets", (_req, res) => {
  const list = [];
  for (const [userId, p] of state.presence) {
    list.push({ userId, username: p.username, socketId: p.socketId, status: p.status });
  }
  res.json({ sockets: list });
});

router.get("/audit", (req, res) => {
  const limit = Math.min(500, parseInt(req.query.limit || "200", 10) || 200);
  res.json({ entries: state.auditLog.slice(0, limit) });
});

router.get("/errors", (_req, res) => {
  res.json({ errors: state.serverErrorLog.slice(0, 200) });
});

router.post("/cleanup", (_req, res) => {
  const before = state.auditLog.length;
  state.auditLog.length = Math.min(state.auditLog.length, 1000);
  res.json({ trimmed: before - state.auditLog.length });
});

router.post("/backup", (_req, res) => {
  const snapshot = {
    at: new Date().toISOString(),
    generalMessages: state.generalMessages,
    dmKeys: [...state.dmHistory.keys()],
    systemConfig: state.systemConfig,
    auditSample: state.auditLog.slice(0, 50),
  };
  res.json(snapshot);
});

router.post("/restart", (req, res) => {
  audit(req.user, "server_restart", "process", {});
  res.json({ ok: true, message: "Restarting." });
  setTimeout(() => process.exit(0), 250);
});

router.get("/permissions", (_req, res) => {
  res.json({
    roles: ["user", "mod", "admin"],
    matrix: {
      user: ["chat", "dm", "friends"],
      mod: ["chat", "dm", "friends", "moderate_messages"],
      admin: ["*"],
    },
  });
});

router.get("/snapshot", (req, res) => {
  const io = req.app.get("io");
  if (!io) return res.status(500).json({ error: "IO not ready." });
  res.json(buildSnapshot(io));
});

module.exports = router;
