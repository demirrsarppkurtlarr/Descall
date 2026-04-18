// Grup DM Socket Handlerları
// 15 kişi max, mesh architecture (herkes eşit)

function registerGroupHandlers(io, socket, state) {
  const myId = socket.user?.id;
  if (!myId) return;

  // Grup mesajı gönder
  socket.on("group:message", ({ groupId, content, mediaUrl, mediaType } = {}) => {
    if (!groupId || (!content?.trim() && !mediaUrl)) return;
    
    // Grup üyelerine broadcast (kendisi hariç)
    socket.to(`group:${groupId}`).emit("group:message", {
      groupId,
      message: {
        id: Date.now().toString(), // temp id
        sender_id: myId,
        content: content?.trim(),
        media_url: mediaUrl,
        media_type: mediaType,
        created_at: new Date().toISOString(),
        sender: {
          id: myId,
          username: socket.user.username,
          avatar_url: socket.user.avatar_url,
        }
      }
    });
  });

  // Gruba katıl (room)
  socket.on("group:join", (groupId) => {
    if (!groupId) return;
    socket.join(`group:${groupId}`);
    console.log(`[Socket] ${myId} joined group room: ${groupId}`);
  });

  // Gruptan ayrıl
  socket.on("group:leave", (groupId) => {
    if (!groupId) return;
    socket.leave(`group:${groupId}`);
    console.log(`[Socket] ${myId} left group room: ${groupId}`);
  });

  // Grup çağrısı başlat (voice/video)
  socket.on("group:call:start", ({ groupId, callType } = {}) => {
    if (!groupId || !callType) return;
    
    socket.to(`group:${groupId}`).emit("group:call:incoming", {
      groupId,
      fromUser: { id: myId, username: socket.user.username },
      callType, // voice veya video
    });
  });

  // Grup çağrısına cevap
  socket.on("group:call:accept", ({ groupId, toUserId } = {}) => {
    if (!groupId || !toUserId) return;
    
    io.to(`user:${toUserId}`).emit("group:call:accepted", {
      groupId,
      fromUserId: myId,
    });
  });

  // Grup çağrısını reddet
  socket.on("group:call:decline", ({ groupId, toUserId } = {}) => {
    if (!groupId || !toUserId) return;
    
    io.to(`user:${toUserId}`).emit("group:call:declined", {
      groupId,
      fromUserId: myId,
    });
  });

  // WebRTC offer (mesh - herkes herkese)
  socket.on("group:call:offer", ({ groupId, toUserId, offer, callType } = {}) => {
    if (!groupId || !toUserId || !offer) return;
    
    io.to(`user:${toUserId}`).emit("group:call:offer", {
      groupId,
      fromUser: { id: myId, username: socket.user.username },
      offer,
      callType,
    });
  });

  // WebRTC answer
  socket.on("group:call:answer", ({ groupId, toUserId, answer } = {}) => {
    if (!groupId || !toUserId || !answer) return;
    
    io.to(`user:${toUserId}`).emit("group:call:answer", {
      groupId,
      fromUserId: myId,
      answer,
    });
  });

  // ICE candidate
  socket.on("group:call:ice", ({ groupId, toUserId, candidate } = {}) => {
    if (!groupId || !toUserId || !candidate) return;
    
    io.to(`user:${toUserId}`).emit("group:call:ice", {
      groupId,
      fromUserId: myId,
      candidate,
    });
  });

  // Ekran paylaşımı başlat
  socket.on("group:screen:start", ({ groupId } = {}) => {
    if (!groupId) return;
    
    socket.to(`group:${groupId}`).emit("group:screen:started", {
      groupId,
      fromUserId: myId,
    });
  });

  // Ekran paylaşımı durdur
  socket.on("group:screen:stop", ({ groupId } = {}) => {
    if (!groupId) return;
    
    socket.to(`group:${groupId}`).emit("group:screen:stopped", {
      groupId,
      fromUserId: myId,
    });
  });

  // Çağrıdan ayrıl
  socket.on("group:call:leave", ({ groupId } = {}) => {
    if (!groupId) return;
    
    socket.to(`group:${groupId}`).emit("group:call:left", {
      groupId,
      userId: myId,
    });
  });
}

module.exports = { registerGroupHandlers };
