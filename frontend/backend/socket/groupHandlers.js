/**
 * Modern Group Socket Handlers
 * Simple, reliable, works with 2-15 people
 */

function registerGroupHandlers(io, socket, state) {
  const myId = socket.user?.id;
  if (!myId) return;

  // Join group room
  socket.on("group:join", (groupId) => {
    if (!groupId) return;
    socket.join(`group:${groupId}`);
    console.log(`[Socket] ${myId} joined group: ${groupId}`);
  });

  // Leave group room
  socket.on("group:leave", (groupId) => {
    if (!groupId) return;
    socket.leave(`group:${groupId}`);
    console.log(`[Socket] ${myId} left group: ${groupId}`);
  });

  // Group message
  socket.on("group:message", ({ groupId, content, mediaUrl, mediaType }) => {
    if (!groupId || (!content?.trim() && !mediaUrl)) return;

    const message = {
      id: crypto.randomUUID(),
      sender_id: myId,
      content: content?.trim(),
      media_url: mediaUrl,
      media_type: mediaType,
      created_at: new Date().toISOString(),
      sender: {
        id: myId,
        username: socket.user.username,
        avatar_url: socket.user.avatar_url,
      },
    };

    // Broadcast to group (including sender for consistency)
    io.to(`group:${groupId}`).emit("group:message", { groupId, message });
  });

  // ========== GROUP CALL ==========

  // Start group call
  socket.on("group:call:start", ({ groupId, callType, memberIds = [] }) => {
    if (!groupId || !callType) return;

    console.log(`[GroupCall] ${myId} started ${callType} call in group ${groupId}`);

    const payload = {
      groupId,
      fromUser: {
        id: myId,
        username: socket.user.username,
        avatar_url: socket.user.avatar_url,
      },
      callType,
    };

    // Prefer direct user-targeted delivery (DM call style reliability).
    if (Array.isArray(memberIds) && memberIds.length > 0) {
      const uniqueTargets = [...new Set(memberIds)].filter((id) => id && id !== myId);
      uniqueTargets.forEach((targetUserId) => {
        io.to(`user:${targetUserId}`).emit("group:call:incoming", payload);
      });
      return;
    }

    // Fallback room broadcast if member list is not available.
    socket.to(`group:${groupId}`).emit("group:call:incoming", payload);
  });

  // Accept call and send offer
  socket.on("group:call:accept", ({ groupId, toUserId, offer }) => {
    if (!groupId || !toUserId || !offer) return;

    console.log(`[GroupCall] ${myId} accepted call, sending offer to ${toUserId}`);

    io.to(`user:${toUserId}`).emit("group:call:accepted", {
      groupId,
      fromUserId: myId,
      fromUser: {
        id: myId,
        username: socket.user.username,
        avatar_url: socket.user.avatar_url,
      },
      offer,
    });
  });

  // Send answer
  socket.on("group:call:answer", ({ groupId, toUserId, answer }) => {
    if (!groupId || !toUserId || !answer) return;

    io.to(`user:${toUserId}`).emit("group:call:answer", {
      groupId,
      fromUserId: myId,
      answer,
    });
  });

  // Send ICE candidate
  socket.on("group:call:ice", ({ groupId, toUserId, candidate }) => {
    if (!groupId || !toUserId || !candidate) return;

    io.to(`user:${toUserId}`).emit("group:call:ice", {
      groupId,
      fromUserId: myId,
      candidate,
    });
  });

  // Send offer (for renegotiation or camera toggle)
  socket.on("group:call:offer", ({ groupId, toUserId, offer, callType }) => {
    if (!groupId || !toUserId || !offer) return;

    io.to(`user:${toUserId}`).emit("group:call:offer", {
      groupId,
      fromUserId: myId,
      offer,
      callType,
    });
  });

  // Decline call
  socket.on("group:call:decline", ({ groupId, toUserId }) => {
    if (!groupId || !toUserId) return;

    io.to(`user:${toUserId}`).emit("group:call:declined", {
      groupId,
      fromUserId: myId,
    });
  });

  // Busy signal
  socket.on("group:call:busy", ({ groupId, toUserId }) => {
    if (!groupId || !toUserId) return;

    io.to(`user:${toUserId}`).emit("group:call:busy", {
      groupId,
      fromUserId: myId,
    });
  });

  // Leave call
  socket.on("group:call:leave", ({ groupId }) => {
    if (!groupId) return;

    socket.to(`group:${groupId}`).emit("group:call:left", {
      groupId,
      userId: myId,
    });
  });

  // End call for everyone
  socket.on("group:call:end", ({ groupId }) => {
    if (!groupId) return;

    console.log(`[GroupCall] ${myId} ended call in group ${groupId}`);

    socket.to(`group:${groupId}`).emit("group:call:ended", {
      groupId,
      endedBy: myId,
    });
  });

  // Screen share started
  socket.on("group:screen:start", ({ groupId }) => {
    if (!groupId) return;

    socket.to(`group:${groupId}`).emit("group:screen:started", {
      groupId,
      fromUserId: myId,
    });
  });

  // Screen share stopped
  socket.on("group:screen:stop", ({ groupId }) => {
    if (!groupId) return;

    socket.to(`group:${groupId}`).emit("group:screen:stopped", {
      groupId,
      fromUserId: myId,
    });
  });
}

module.exports = { registerGroupHandlers };
