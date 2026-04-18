"use strict";

const supabase = require("../db/supabase");
const {
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
  systemConfig,
  profanityWords,
  bannedUserIds,
  userRoles,
  rateLimitDm,
  userSessionStartMs,
  userOnlineAccumMs,
  dmBlockPairs,
  appendAudit,
} = require("../runtime/sharedState");
const { setupAdminSocket, notifyAdminRoom } = require("./adminHandlers");

function ensureSet(map, key) {
  if (!map.has(key)) map.set(key, new Set());
  return map.get(key);
}

function ensurePending(userId) {
  if (!pendingRequests.has(userId)) pendingRequests.set(userId, new Map());
  return pendingRequests.get(userId);
}

function ensureDmUnreadMap(userId) {
  if (!dmUnreadByUser.has(userId)) dmUnreadByUser.set(userId, new Map());
  return dmUnreadByUser.get(userId);
}

function convKey(a, b) {
  return [a, b].sort().join("::");
}

function getNotifications(userId) {
  return notificationsByUser.get(userId) || [];
}

function pushNotification(io, userId, n) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const entry = {
    id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: false,
    createdAt: new Date().toISOString(),
    meta: n.meta || {},
  };
  const list = notificationsByUser.get(userId) || [];
  list.unshift(entry);
  if (list.length > MAX_NOTIFICATIONS) list.length = MAX_NOTIFICATIONS;
  notificationsByUser.set(userId, list);
  emitToUser(io, userId, "notification:new", { notification: entry });
}

function broadcastUsers(io) {
  const list = [];
  for (const [id, p] of presence) {
    list.push({ id, username: p.username, status: p.status || "online" });
  }
  io.emit("users:update", list);
}

function getSocketForUser(io, userId) {
  const p = presence.get(userId);
  if (!p?.socketId) return null;
  return io.sockets.sockets.get(p.socketId);
}

function getFriendList(userId) {
  const set = friends.get(userId);
  if (!set) return [];
  const out = [];
  for (const fid of set) {
    const p = presence.get(fid);
    const lastSeen = lastSeenByUserId.get(fid) || null;
    const uname = usernameById.get(fid) || p?.username || "?";
    out.push({
      id: fid,
      username: uname,
      status: p ? p.status || "online" : "offline",
      lastSeen: p ? null : lastSeen,
    });
  }
  return out.sort((a, b) => a.username.localeCompare(b.username));
}

function getPendingList(userId) {
  const m = pendingRequests.get(userId);
  if (!m) return [];
  return Array.from(m.values());
}

function emitToUser(io, userId, event, payload) {
  const p = presence.get(userId);
  if (!p?.socketId) return;
  io.to(p.socketId).emit(event, payload);
}

function buildSyncState(userId) {
  const dmMap = ensureDmUnreadMap(userId);
  const dmUnreadByPeer = {};
  for (const [k, v] of dmMap) {
    dmUnreadByPeer[k] = v;
  }
  return {
    dmUnreadByPeer,
    notifications: getNotifications(userId),
  };
}

async function findUserByUsername(username) {
  const clean = String(username || "").trim();
  if (!clean) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, username")
    .ilike("username", clean)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    const me = socket.user;
    const myId = me.id;

    if (systemConfig.maintenanceMode && me.username !== "admin") {
      socket.emit("system:maintenance", { message: "Server is in maintenance mode." });
      socket.disconnect(true);
      return;
    }

    if (!userRoles.has(myId)) {
      userRoles.set(myId, me.username === "admin" ? "admin" : "user");
    }
    userSessionStartMs.set(myId, Date.now());

    usernameById.set(myId, me.username);

    presence.set(myId, {
      username: me.username,
      status: "online",
      socketId: socket.id,
    });
    socketToUser.set(socket.id, myId);
    socket.data.activeDmPeer = null;

    setupAdminSocket(io, socket);

    socket.emit("connected", {
      user: me,
      message: "Socket connected successfully.",
    });

    broadcastUsers(io);
    socket.emit("friend:list", getFriendList(myId));
    socket.emit("friend:requests", getPendingList(myId));
    socket.emit("sync:state", buildSyncState(myId));

    socket.on("status:set", ({ status } = {}) => {
      const allowed = ["online", "idle", "dnd", "invisible"];
      const s = allowed.includes(status) ? status : "online";
      const p = presence.get(myId);
      if (p) {
        p.status = s;
        presence.set(myId, p);
      }
      broadcastUsers(io);
      io.to(socket.id).emit("friend:list", getFriendList(myId));
    });

    socket.on("friend:list", () => {
      socket.emit("friend:list", getFriendList(myId));
      socket.emit("friend:requests", getPendingList(myId));
    });

    socket.on("friend:request", async ({ toUsername } = {}) => {
      try {
        const target = await findUserByUsername(toUsername);
        if (!target) {
          return socket.emit("friend:error", { message: "User not found." });
        }
        if (target.id === myId) {
          return socket.emit("friend:error", { message: "You cannot add yourself." });
        }
        const myFriends = ensureSet(friends, myId);
        if (myFriends.has(target.id)) {
          return socket.emit("friend:error", { message: "Already friends." });
        }
        const theirPending = ensurePending(target.id);
        if (theirPending.has(myId)) {
          return socket.emit("friend:error", { message: "Request already pending." });
        }

        theirPending.set(myId, { id: myId, username: me.username });
        usernameById.set(myId, me.username);
        emitToUser(io, target.id, "friend:request:incoming", {
          from: { id: myId, username: me.username },
        });
        pushNotification(io, target.id, {
          type: "friend_request",
          title: "Friend request",
          body: `${me.username} sent you a friend request`,
          meta: { fromUserId: myId },
        });
        socket.emit("friend:request:sent", { to: target.username });
      } catch (e) {
        socket.emit("friend:error", { message: "Could not send request." });
      }
    });

    socket.on("friend:accept", ({ fromUserId } = {}) => {
      if (typeof fromUserId !== "string") return;
      const theirPending = pendingRequests.get(myId);
      if (!theirPending?.has(fromUserId)) return;

      const fromProf = theirPending.get(fromUserId);
      theirPending.delete(fromUserId);
      if (theirPending.size === 0) pendingRequests.delete(myId);

      ensureSet(friends, myId).add(fromUserId);
      ensureSet(friends, fromUserId).add(myId);
      if (fromProf?.username) usernameById.set(fromUserId, fromProf.username);

      emitToUser(io, fromUserId, "friend:accepted", { by: { id: myId, username: me.username } });
      pushNotification(io, fromUserId, {
        type: "friend_accepted",
        title: "Friend request accepted",
        body: `${me.username} accepted your friend request`,
        meta: { userId: myId },
      });

      socket.emit("friend:list", getFriendList(myId));
      socket.emit("friend:requests", getPendingList(myId));
      socket.emit("sync:state", buildSyncState(myId));
      emitToUser(io, fromUserId, "friend:list", getFriendList(fromUserId));
      emitToUser(io, fromUserId, "sync:state", buildSyncState(fromUserId));
    });

    socket.on("friend:decline", ({ fromUserId } = {}) => {
      if (typeof fromUserId !== "string") return;
      const theirPending = pendingRequests.get(myId);
      if (theirPending?.has(fromUserId)) {
        theirPending.delete(fromUserId);
        if (theirPending.size === 0) pendingRequests.delete(myId);
      }
      socket.emit("friend:requests", getPendingList(myId));
    });

    socket.on("friend:remove", ({ friendId } = {}) => {
      if (typeof friendId !== "string") return;
      const a = friends.get(myId);
      const b = friends.get(friendId);
      if (a) a.delete(friendId);
      if (b) b.delete(myId);
      ensureDmUnreadMap(myId).delete(friendId);
      ensureDmUnreadMap(friendId).delete(myId);
      socket.emit("friend:list", getFriendList(myId));
      socket.emit("sync:state", buildSyncState(myId));
      emitToUser(io, friendId, "friend:list", getFriendList(friendId));
      emitToUser(io, friendId, "sync:state", buildSyncState(friendId));
    });

    socket.on("dm:set_active", ({ withUserId } = {}) => {
      socket.data.activeDmPeer = typeof withUserId === "string" ? withUserId : null;
    });

    socket.on("typing:start", (payload = {}) => {
      const { context = "dm", toUserId } = payload;
      if (context === "dm" && typeof toUserId === "string") {
        emitToUser(io, toUserId, "typing:update", {
          context: "dm",
          fromUser: { id: myId, username: me.username },
          typing: true,
        });
      }
    });

    socket.on("typing:stop", (payload = {}) => {
      const { context = "dm", toUserId } = payload;
      if (context === "dm" && typeof toUserId === "string") {
        emitToUser(io, toUserId, "typing:update", {
          context: "dm",
          fromUser: { id: myId, username: me.username },
          typing: false,
        });
      }
    });

    socket.on("dm:send", ({ toUserId, text, media } = {}) => {
      if (!systemConfig.featureFlags.dm) {
        return socket.emit("friend:error", { message: "Direct messages are disabled." });
      }
      if (typeof toUserId !== "string") return;
      const trimmed = (typeof text === "string" ? text.trim() : "") || "";
      if (!trimmed && !media) return;
      const blockKey = [myId, toUserId].sort().join("::");
      if (dmBlockPairs.has(blockKey)) {
        return socket.emit("friend:error", { message: "This DM conversation is blocked." });
      }
      const dmNow = Date.now();
      const lastDm = rateLimitDm.get(myId) || 0;
      if (dmNow - lastDm < (systemConfig.dmRateLimitMs || 200)) {
        return socket.emit("friend:error", { message: "DM rate limit — slow down." });
      }
      rateLimitDm.set(myId, dmNow);
      if (!friends.get(myId)?.has(toUserId)) {
        return socket.emit("friend:error", { message: "Not friends with this user." });
      }
      const key = convKey(myId, toUserId);
      const msg = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        from: { id: myId, username: me.username },
        to: { id: toUserId },
        text: trimmed || "",
        media: media || null,
        timestamp: new Date().toISOString(),
        convWith: toUserId,
        deliveredAt: null,
        readAt: null,
      };
      if (!dmHistory.has(key)) dmHistory.set(key, []);
      const arr = dmHistory.get(key);
      arr.push(msg);
      if (arr.length > MAX_DM_PER_CONV) arr.splice(0, arr.length - MAX_DM_PER_CONV);

      socket.emit("dm:message", { ...msg, convWith: toUserId });
      emitToUser(io, toUserId, "dm:message", { ...msg, convWith: myId });

      const peerSock = getSocketForUser(io, toUserId);
      const viewing = peerSock?.data?.activeDmPeer === myId;
      if (!viewing) {
        const umap = ensureDmUnreadMap(toUserId);
        umap.set(myId, (umap.get(myId) || 0) + 1);
        emitToUser(io, toUserId, "dm:unread:sync", { peerId: myId, count: umap.get(myId) });
        pushNotification(io, toUserId, {
          type: "dm_message",
          title: "Direct message",
          body: `${me.username}: ${trimmed.slice(0, 120)}`,
          meta: { fromUserId: myId, msgId: msg.id },
        });
      }
    });

    socket.on("dm:delivered", ({ msgId, fromUserId } = {}) => {
      if (typeof msgId !== "string" || typeof fromUserId !== "string") return;
      const key = convKey(myId, fromUserId);
      const arr = dmHistory.get(key);
      const m = arr?.find((x) => x.id === msgId);
      if (!m || m.from?.id !== fromUserId || m.to?.id !== myId) return;
      const at = new Date().toISOString();
      m.deliveredAt = m.deliveredAt || at;
      emitToUser(io, fromUserId, "dm:message:update", {
        msgId,
        convWith: myId,
        deliveredAt: m.deliveredAt,
      });
    });

    socket.on("dm:mark_read", ({ withUserId } = {}) => {
      if (typeof withUserId !== "string") return;
      if (!friends.get(myId)?.has(withUserId)) return;
      const key = convKey(myId, withUserId);
      const arr = dmHistory.get(key);
      const at = new Date().toISOString();
      if (arr) {
        for (const m of arr) {
          if (m.from?.id === withUserId && m.to?.id === myId) {
            m.readAt = m.readAt || at;
          }
        }
      }
      const umap = ensureDmUnreadMap(myId);
      umap.delete(withUserId);
      emitToUser(io, myId, "dm:unread:sync", { peerId: withUserId, count: 0 });
      emitToUser(io, withUserId, "dm:peer_read", { peerId: myId, at });
    });

    socket.on("dm:history", ({ withUserId } = {}) => {
      if (typeof withUserId !== "string") return;
      if (!friends.get(myId)?.has(withUserId)) {
        return socket.emit("dm:history", { withUserId, messages: [] });
      }
      const key = convKey(myId, withUserId);
      const all = dmHistory.get(key) || [];
      socket.emit("dm:history", {
        withUserId,
        messages: all.slice(-100),
      });
    });

    socket.on("dm:fetch", ({ withUserId, before, limit = 50 } = {}) => {
      if (typeof withUserId !== "string") return;
      if (!friends.get(myId)?.has(withUserId)) {
        return socket.emit("dm:page", { withUserId, messages: [], hasMore: false });
      }
      const key = convKey(myId, withUserId);
      const arr = dmHistory.get(key) || [];
      const pool = typeof before === "string" ? arr.filter((m) => m.timestamp < before) : arr;
      const slice = pool.slice(-limit);
      socket.emit("dm:page", {
        withUserId,
        messages: slice,
        hasMore: slice.length === limit,
      });
    });

    socket.on("notification:read", ({ id } = {}) => {
      if (typeof id !== "string") return;
      const list = notificationsByUser.get(myId);
      if (!list) return;
      const n = list.find((x) => x.id === id);
      if (n) n.read = true;
      emitToUser(io, myId, "notifications:sync", { notifications: getNotifications(myId) });
    });

    socket.on("notification:read_all", () => {
      const list = notificationsByUser.get(myId);
      if (list) for (const n of list) n.read = true;
      emitToUser(io, myId, "notifications:sync", { notifications: getNotifications(myId) });
    });

    socket.on("call:offer", ({ toUserId, offer, callType } = {}) => {
      if (typeof toUserId !== "string" || !offer) return;
      emitToUser(io, toUserId, "call:offer", {
        fromUser: { id: myId, username: me.username },
        offer,
        callType: callType || "voice",
      });
    });

    socket.on("call:answer", ({ toUserId, answer } = {}) => {
      if (typeof toUserId !== "string" || !answer) return;
      emitToUser(io, toUserId, "call:answer", {
        fromUserId: myId,
        answer,
      });
    });

    socket.on("call:ice-candidate", ({ toUserId, candidate } = {}) => {
      if (typeof toUserId !== "string" || !candidate) return;
      emitToUser(io, toUserId, "call:ice-candidate", {
        fromUserId: myId,
        candidate,
      });
    });

    socket.on("call:end", ({ toUserId } = {}) => {
      if (typeof toUserId !== "string") return;
      emitToUser(io, toUserId, "call:ended", { fromUserId: myId });
    });

    socket.on("call:decline", ({ toUserId } = {}) => {
      if (typeof toUserId !== "string") return;
      emitToUser(io, toUserId, "call:declined", { fromUserId: myId });
    });

    socket.on("screen:share-start", ({ toUserId } = {}) => {
      if (typeof toUserId !== "string") return;
      emitToUser(io, toUserId, "screen:share-start", { fromUserId: myId });
    });

    socket.on("screen:share-stop", ({ toUserId } = {}) => {
      if (typeof toUserId !== "string") return;
      emitToUser(io, toUserId, "screen:share-stop", { fromUserId: myId });
    });

    socket.on("room:join", (roomId) => {
      if (typeof roomId !== "string" || !roomId.trim()) return;
      socket.join(roomId);
      socket.to(roomId).emit("room:user_joined", { user: me, roomId });
    });

    socket.on("room:message", ({ roomId, text } = {}) => {
      if (typeof roomId !== "string" || typeof text !== "string") return;
      const trimmed = text.trim();
      if (!trimmed) return;
      io.to(roomId).emit("room:message:new", {
        id: String(Date.now()),
        roomId,
        username: me.username,
        userId: myId,
        text: trimmed,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      const sessStart = userSessionStartMs.get(myId);
      if (sessStart) {
        userOnlineAccumMs.set(myId, (userOnlineAccumMs.get(myId) || 0) + (Date.now() - sessStart));
      }
      userSessionStartMs.delete(myId);
      socketToUser.delete(socket.id);
      const p = presence.get(myId);
      if (p?.username) usernameById.set(myId, p.username);
      lastSeenByUserId.set(myId, new Date().toISOString());
      presence.delete(myId);
      broadcastUsers(io);
      notifyAdminRoom(io, { type: "presence", online: presence.size });
    });
  });
}

module.exports = { registerSocketHandlers };
