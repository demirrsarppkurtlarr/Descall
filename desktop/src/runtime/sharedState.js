"use strict";

/** Shared in-memory state for chat + admin (single process). */

const presence = new Map();
const socketToUser = new Map();
const friends = new Map();
const pendingRequests = new Map();
const lastSeenByUserId = new Map();
const usernameById = new Map();
const generalReadAt = new Map();
const dmUnreadByUser = new Map();
const notificationsByUser = new Map();
const dmHistory = new Map();

const generalMessages = [];

const MAX_GENERAL = 500;
const MAX_DM_PER_CONV = 500;
const MAX_NOTIFICATIONS = 100;

/** Admin / moderation */
const bannedUserIds = new Set();
/** userId -> 'user' | 'mod' | 'admin' */
const userRoles = new Map();
const auditLog = [];
const MAX_AUDIT = 5000;

const systemConfig = {
  rateLimitGlobalMs: 300,
  maxMessageLength: 2000,
  slowModeSeconds: 0,
  chatFrozen: false,
  dmRateLimitMs: 200,
  loggingLevel: "info",
  featureFlags: { voice: true, dm: true, general: true },
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
const rateLimitGeneral = new Map();
const rateLimitDm = new Map();
const slowModeLastPost = new Map();
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

function appendErrorLog(source, message, meta = {}) {
  const entry = { at: new Date().toISOString(), source, message, meta };
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
  generalReadAt,
  dmUnreadByUser,
  notificationsByUser,
  dmHistory,
  generalMessages,
  MAX_GENERAL,
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
  rateLimitGeneral,
  rateLimitDm,
  slowModeLastPost,
  serverErrorLog,
  appendErrorLog,
  MAX_AUDIT,
};
