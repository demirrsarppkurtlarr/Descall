import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthView from "./components/AuthView";
import ChatLayout from "./components/ChatLayout";
import { getMe, login, register } from "./api/auth";
import { createSocket } from "./socket";
import { API_BASE_URL } from "./config/api";
import { useCall } from "./hooks/useCall";
import { useGroupCall } from "./hooks/useGroupCall";
import {
  clearToken,
  clearUser,
  getToken,
  getUser,
  setToken,
  setUser,
} from "./lib/storage";
import audioManager, { initAudioManager } from "./lib/audioManager";
import AdminPanel from "./components/admin/AdminPanel";

function mergeById(existing, incoming) {
  const ids = new Set(existing.map((m) => m.id));
  const out = [...incoming.filter((m) => m && !ids.has(m.id)), ...existing];
  return out.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export default function App() {
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [me, setMe] = useState(() => getUser());
  const [isConnected, setIsConnected] = useState(false);
  const [myStatus, setMyStatus] = useState("online");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [dmByUserId, setDmByUserId] = useState({});
  const [dmUnread, setDmUnread] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [activeDmUser, setActiveDmUser] = useState(null);
  const [friendNotice, setFriendNotice] = useState("");
  const [socketApi, setSocketApi] = useState(null);
  const [typingDmUser, setTypingDmUser] = useState(null);
  const [dmHasMore, setDmHasMore] = useState(true);
  const [loadingOlderDm, setLoadingOlderDm] = useState(false);
  const [reconnectState, setReconnectState] = useState("idle");
  const [adminOpen, setAdminOpen] = useState(false);
  const [peerScreenSharing, setPeerScreenSharing] = useState(false);

  const socketRef = useRef(null);
  const activeDmRef = useRef(null);
  const myIdRef = useRef(null);
  const transportFallbackStepRef = useRef(0);
  const prevOnlineUsersRef = useRef([]);
  const call = useCall(socketApi);
  const groupCall = useGroupCall(socketApi);

  useEffect(() => {
    myIdRef.current = me?.id ?? null;
  }, [me?.id]);

  useEffect(() => {
    activeDmRef.current = activeDmUser;
  }, [activeDmUser]);

  useEffect(() => {
    setTypingDmUser(null);
  }, [activeDmUser?.id]);

  const dmMessages = useMemo(
    () => (activeDmUser ? dmByUserId[activeDmUser.id] ?? [] : []),
    [activeDmUser, dmByUserId],
  );

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setSessionChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { user } = await getMe(token);
        if (!cancelled) {
          setUser(user);
          setMe(user);
        }
      } catch {
        if (!cancelled) {
          clearToken();
          clearUser();
          setMe(null);
        }
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Initialize audio manager on app startup
  useEffect(() => {
    initAudioManager().catch(() => {});
    return () => { audioManager.destroy(); };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token || !me || !sessionChecked) return;
    connectSocket(token);
    return () => { socketRef.current?.disconnect(); };
  }, [me?.id, sessionChecked]);

  const verifyBackendEndpoint = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { method: "GET" });
      if (!response.ok) throw new Error(`Backend health check failed with status ${response.status}`);
      const data = await response.json().catch(() => null);
      if (!data || data.status !== "ok") throw new Error("Invalid backend health response.");
      return true;
    } catch {
      throw new Error(`Wrong backend URL (${API_BASE_URL}). VITE_API_BASE_URL must point to your Node/Socket backend service.`);
    }
  };

  const emitDmActive = useCallback((socket, peerId) => {
    if (typeof peerId === "string") socket.emit("dm:set_active", { withUserId: peerId });
    else socket.emit("dm:set_active", { withUserId: null });
  }, []);

  const connectSocket = (token, options = {}) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = createSocket(token, options);
    socketRef.current = socket;
    setSocketApi(socket);

    socket.on("connect", () => {
      setIsConnected(true);
      setReconnectState("connected");
      transportFallbackStepRef.current = 0;
      setAuthError("");
      emitDmActive(socket, activeDmRef.current?.id ?? null);
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      setReconnectState(reason === "io client disconnect" ? "idle" : "disconnected");
    });

    socket.io.on("reconnect_attempt", (attempt) => {
      setReconnectState("reconnecting");
      setAuthError(`Reconnecting… attempt ${attempt}`);
    });

    socket.io.on("reconnect", () => {
      setReconnectState("connected");
      setAuthError("");
      emitDmActive(socket, activeDmRef.current?.id ?? null);
    });

    socket.io.on("reconnect_failed", () => {
      setAuthError("Socket reconnect failed. Check backend URL and CORS.");
    });

    socket.on("connect_error", (error) => {
      setIsConnected(false);
      const msg = error?.message || "Socket authentication failed";
      if (transportFallbackStepRef.current === 0) {
        transportFallbackStepRef.current = 1;
        setAuthError("Connection retry: switching to polling-first…");
        connectSocket(token, { transports: ["polling", "websocket"] });
        return;
      }
      if (transportFallbackStepRef.current === 1) {
        transportFallbackStepRef.current = 2;
        setAuthError("Connection retry: switching to polling-only…");
        connectSocket(token, { transports: ["polling"] });
        return;
      }
      if (msg.toLowerCase().includes("xhr poll error") || msg.toLowerCase().includes("authentication failed") || msg.toLowerCase().includes("authentication required")) {
        clearToken(); clearUser(); setMe(null); socket.disconnect();
      }
      if (msg.toLowerCase().includes("xhr poll error")) {
        setAuthError("Socket connection failed. Check backend deploy status, backend URL, and CORS settings.");
        return;
      }
      setAuthError(msg);
    });

    socket.on("connected", (payload) => {
      if (payload?.user) { setUser(payload.user); setMe(payload.user); }
    });

    socket.on("sync:state", (state) => {
      if (state?.dmUnreadByPeer && typeof state.dmUnreadByPeer === "object") setDmUnread({ ...state.dmUnreadByPeer });
      if (Array.isArray(state?.notifications)) setNotifications(state.notifications);
    });

    socket.on("typing:update", (payload = {}) => {
      const { context, fromUser, typing } = payload;
      if (!fromUser?.id || fromUser.id === myIdRef.current) return;
      if (context === "dm") {
        const peer = activeDmRef.current;
        if (!peer || peer.id !== fromUser.id) {
          if (!typing) setTypingDmUser((cur) => (cur?.id === fromUser.id ? null : cur));
          return;
        }
        setTypingDmUser(typing ? fromUser : null);
      }
    });

    socket.on("users:update", (users) => {
      const newUsers = users ?? [];
      const prevIds = new Set(prevOnlineUsersRef.current.map((u) => u.id));
      const friendsSet = new Set(friends.map((f) => f.id));
      
      // Check if any friends just came online
      const newOnlineFriends = newUsers.filter(
        (u) => !prevIds.has(u.id) && friendsSet.has(u.id) && u.id !== myIdRef.current
      );
      
      if (newOnlineFriends.length > 0) {
        // Play notification sound for friends coming online (use notification type)
        audioManager.play("notification");
      }
      
      prevOnlineUsersRef.current = newUsers;
      setOnlineUsers(newUsers);
    });

    socket.on("friend:list", (list) => setFriends(list ?? []));
    socket.on("friend:requests", (list) => setFriendRequests(list ?? []));
    socket.on("friend:request:incoming", ({ from }) => {
      if (!from) return;
      setFriendRequests((prev) => prev.some((req) => req.id === from.id) ? prev : [...prev, from]);
    });
    socket.on("friend:accepted", () => { socket.emit("friend:list"); });
    socket.on("friend:error", ({ message } = {}) => {
      setFriendNotice(message || "Friend action failed.");
      setTimeout(() => setFriendNotice(""), 4000);
    });
    socket.on("friend:request:sent", ({ to } = {}) => {
      setFriendNotice(to ? `Request sent to ${to}` : "Request sent.");
      setTimeout(() => setFriendNotice(""), 3000);
    });

    socket.on("dm:history", ({ withUserId, messages }) => {
      if (!withUserId) return;
      setDmByUserId((prev) => ({ ...prev, [withUserId]: messages ?? [] }));
      setDmHasMore((messages?.length ?? 0) >= 50);
    });

    socket.on("dm:page", ({ withUserId, messages, hasMore } = {}) => {
      setLoadingOlderDm(false);
      if (!withUserId || !Array.isArray(messages)) return;
      setDmByUserId((prev) => {
        const cur = prev[withUserId] ?? [];
        return { ...prev, [withUserId]: mergeById(cur, messages) };
      });
      setDmHasMore(!!hasMore);
    });

    socket.on("dm:message", (message) => {
      const convWith = message?.convWith;
      if (!convWith) return;
      setDmByUserId((prev) => ({ ...prev, [convWith]: [...(prev[convWith] ?? []), message] }));
      const fromOther = message.from?.id && message.from.id !== myIdRef.current;
      if (fromOther && message.from?.id) {
        socket.emit("dm:delivered", { msgId: message.id, fromUserId: message.from.id });
        // Play notification sound for new message (not from active conversation to avoid spam)
        if (activeDmRef.current?.id !== convWith) {
          audioManager.play("message");
        }
      }
    });

    socket.on("dm:message:update", ({ msgId, convWith, deliveredAt } = {}) => {
      if (!msgId || !convWith) return;
      setDmByUserId((prev) => {
        const cur = prev[convWith];
        if (!cur) return prev;
        return { ...prev, [convWith]: cur.map((m) => m.id === msgId ? { ...m, deliveredAt: deliveredAt ?? m.deliveredAt } : m) };
      });
    });

    socket.on("dm:unread:sync", ({ peerId, count } = {}) => {
      if (!peerId) return;
      setDmUnread((prev) => { const n = { ...prev }; if (count === 0) delete n[peerId]; else n[peerId] = count; return n; });
    });

    socket.on("dm:peer_read", ({ peerId, at } = {}) => {
      if (!peerId) return;
      setDmByUserId((prev) => {
        const cur = prev[peerId];
        if (!cur) return prev;
        const selfId = myIdRef.current;
        return { ...prev, [peerId]: cur.map((m) => m.from?.id === selfId && m.to?.id === peerId ? { ...m, readAt: m.readAt || at } : m) };
      });
    });

    socket.on("notification:new", ({ notification } = {}) => {
      if (!notification) return;
      setNotifications((prev) => [notification, ...prev].slice(0, 100));
    });

    socket.on("notifications:sync", ({ notifications: list } = {}) => {
      if (Array.isArray(list)) setNotifications(list);
    });

    socket.on("chat:error", ({ message } = {}) => {
      setFriendNotice(message || "Chat error.");
      setTimeout(() => setFriendNotice(""), 5000);
    });

    socket.on("server:announcement", ({ text } = {}) => {
      setFriendNotice(`Server: ${text || ""}`);
      setTimeout(() => setFriendNotice(""), 8000);
    });

    socket.on("system:kick", () => { clearToken(); clearUser(); setMe(null); socket.disconnect(); });
    socket.on("system:maintenance", () => { clearToken(); clearUser(); setMe(null); socket.disconnect(); });

    socket.on("screen:share-start", ({ fromUserId } = {}) => {
      if (fromUserId === activeDmRef.current?.id) setPeerScreenSharing(true);
    });
    socket.on("screen:share-stop", ({ fromUserId } = {}) => {
      if (fromUserId === activeDmRef.current?.id) setPeerScreenSharing(false);
    });

    socket.connect();
  };

  const handleLogin = async (payload) => {
    try {
      setAuthLoading(true);
      setAuthError("");
      await verifyBackendEndpoint();
      const data = await login(payload);
      transportFallbackStepRef.current = 0;
      setToken(data.token);
      setUser(data.user);
      setMe(data.user);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (payload) => {
    try {
      setAuthLoading(true);
      setAuthError("");
      await register(payload);
      await handleLogin(payload);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    call.cleanup();
    socketRef.current?.emit("dm:set_active", { withUserId: null });
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocketApi(null);
    clearToken(); clearUser(); setMe(null);
    setIsConnected(false); setOnlineUsers([]); setFriends([]); setFriendRequests([]);
    setDmByUserId({}); setDmUnread({}); setNotifications([]);
    setActiveDmUser(null); setAuthError(""); setTypingDmUser(null); setDmHasMore(true);
  };

  const handleOpenDm = (friend) => {
    if (!friend || !friend.id) {
      // DM'yi kapat (null friend)
      setActiveDmUser(null);
      socketRef.current?.emit("dm:set_active", { withUserId: null });
      return;
    }
    setActiveDmUser(friend);
    setDmUnread((u) => { const n = { ...u }; delete n[friend.id]; return n; });
    socketRef.current?.emit("dm:mark_read", { withUserId: friend.id });
    socketRef.current?.emit("dm:history", { withUserId: friend.id });
    socketRef.current?.emit("dm:set_active", { withUserId: friend.id });
  };

  const handleSendDm = (toUserId, text) => {
    socketRef.current?.emit("dm:send", { toUserId, text });
  };

  const handleSendDmMedia = (toUserId, mediaInfo) => {
    socketRef.current?.emit("dm:send", { toUserId, text: "", media: mediaInfo });
  };

  const handleSendFriendRequest = (toUsername) => {
    socketRef.current?.emit("friend:request", { toUsername });
  };

  const handleAcceptFriend = (fromUserId) => {
    socketRef.current?.emit("friend:accept", { fromUserId });
  };

  const handleDeclineFriend = (fromUserId) => {
    socketRef.current?.emit("friend:decline", { fromUserId });
  };

  const handleRemoveFriend = (friendId) => {
    socketRef.current?.emit("friend:remove", { friendId });
    setActiveDmUser((cur) => (cur?.id === friendId ? null : cur));
    setDmByUserId((prev) => { const n = { ...prev }; delete n[friendId]; return n; });
  };

  const handleStatusChange = (status) => {
    setMyStatus(status);
    socketRef.current?.emit("status:set", { status });
  };

  const emitTypingDmStart = (toUserId) => {
    socketRef.current?.emit("typing:start", { context: "dm", toUserId });
  };
  const emitTypingDmStop = (toUserId) => {
    socketRef.current?.emit("typing:stop", { context: "dm", toUserId });
  };

  const loadOlderDm = () => {
    const s = socketRef.current;
    const peer = activeDmUser;
    if (!s || !peer || loadingOlderDm || !dmHasMore) return;
    const list = dmByUserId[peer.id] ?? [];
    const oldest = list[0]?.timestamp;
    if (!oldest) return;
    setLoadingOlderDm(true);
    s.emit("dm:fetch", { withUserId: peer.id, before: oldest, limit: 50 });
  };

  const handleNotificationRead = (id) => {
    socketRef.current?.emit("notification:read", { id });
  };

  const handleNotificationReadAll = () => {
    socketRef.current?.emit("notification:read_all");
  };

  const connectionLabel = useMemo(() => {
    if (!isConnected) {
      if (reconnectState === "reconnecting") return "Reconnecting…";
      return "Offline";
    }
    return "Online";
  }, [isConnected, reconnectState]);

  if (!sessionChecked) return <div className="session-boot" aria-busy="true" />;

  if (!me) {
    return (
      <AuthView
        onLogin={handleLogin}
        onRegister={handleRegister}
        loading={authLoading}
        error={authError}
      />
    );
  }

  return (
    <>
      {me?.username === "admin" && !adminOpen && (
        <button type="button" className="admin-fab" onClick={() => setAdminOpen(true)} title="Admin panel">Admin</button>
      )}
      {me?.username === "admin" && adminOpen && (
        <AdminPanel socket={socketApi} onClose={() => setAdminOpen(false)} />
      )}
      <ChatLayout
        me={me}
        connectionLabel={connectionLabel}
        reconnectState={reconnectState}
        authError={authError}
        myStatus={myStatus}
        onlineUsers={onlineUsers}
        friends={friends}
        friendRequests={friendRequests}
        notifications={notifications}
        activeDmUser={activeDmUser}
        dmMessages={dmMessages}
        dmUnread={dmUnread}
        dmByUserId={dmByUserId}
        typingDmUser={typingDmUser}
        onOpenDm={handleOpenDm}
        onSendDm={handleSendDm}
        onSendDmMedia={handleSendDmMedia}
        onSendFriendRequest={handleSendFriendRequest}
        onAcceptFriend={handleAcceptFriend}
        onDeclineFriend={handleDeclineFriend}
        onRemoveFriend={handleRemoveFriend}
        onLogout={handleLogout}
        onStatusChange={handleStatusChange}
        friendNotice={friendNotice}
        call={call}
        onTypingDmStart={emitTypingDmStart}
        onTypingDmStop={emitTypingDmStop}
        loadOlderDm={loadOlderDm}
        dmHasMore={dmHasMore}
        loadingOlderDm={loadingOlderDm}
        onNotificationRead={handleNotificationRead}
        onNotificationReadAll={handleNotificationReadAll}
        peerScreenSharing={peerScreenSharing}
        groupCall={groupCall}
      />
    </>
  );
}
