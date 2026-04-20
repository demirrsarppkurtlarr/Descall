"use strict";

const presence = new Map();
const socketToUser = new Map();
const friends = new Map();
const pendingRequests = new Map();
const lastSeenByUserId = new Map();
const usernameById = new Map();
const dmUnreadByUser = new Map();
const notificationsByUser = new Map();
const dmHistory = new Map();

const MAX_DM_PER_CONV = 500;
const MAX_NOTIFICATIONS = 100;

const bannedUserIds = new Set();
const userRoles = new Map();
const auditLog = [];
const MAX_AUDIT = 5000;

const systemConfig = {
  dmRateLimitMs: 200,
  loggingLevel: "info",
  featureFlags: { voice: true, dm: true, video: true, screen: true },
  themeForce: null,
  maintenanceMode: false,
};

const profanityWords = new Set();
const autoDeleteRules = [];
const flaggedMessages = [];
const messageFlags = new Map();
const dmBlockPairs = new Set();
const userLastLoginAt = new Map();
const userSessionStartMs = new Map();
const userOnlineAccumMs = new Map();
const rateLimitDm = new Map();
const serverErrorLog = [];
const MAX_ERROR_LOG = 500;

function appendAudit(actorId, actorUsername, action, target, meta = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    at: new Date().toISOString(),
    actorId,
    actorUsername,
    action,
    target: target || null,
    meta,
  };
  auditLog.unshift(entry);
  if (auditLog.length > MAX_AUDIT) auditLog.length = MAX_AUDIT;
  return entry;
}

function appendErrorLog(source, message, meta = {}, userId = null, username = null) {
  const entry = { 
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    at: new Date().toISOString(), 
    source, 
    message, 
    meta,
    userId,
    username
  };
  serverErrorLog.unshift(entry);
  if (serverErrorLog.length > MAX_ERROR_LOG) serverErrorLog.length = MAX_ERROR_LOG;
}

module.exports = {
  presence,
  socketToUser,
  friends,
  pendingRequests,
  lastSeenByUserId,
  usernameById,
  dmUnreadByUser,
  notificationsByUser,
  dmHistory,
  MAX_DM_PER_CONV,
  MAX_NOTIFICATIONS,
  bannedUserIds,
  userRoles,
  auditLog,
  appendAudit,
  systemConfig,
  profanityWords,
  autoDeleteRules,
  flaggedMessages,
  messageFlags,
  dmBlockPairs,
  userLastLoginAt,
  userSessionStartMs,
  userOnlineAccumMs,
  rateLimitDm,
  serverErrorLog,
  appendErrorLog,
  MAX_AUDIT,
};
