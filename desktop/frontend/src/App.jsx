import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthView from "./components/AuthView";
import ChatLayout from "./components/ChatLayout";
import MobileChatLayout from "./components/MobileChatLayout";
import { getMe, login, register } from "./api/auth";
import { createSocket } from "./socket";
import { API_BASE_URL } from "./config/api";
import { useVoiceCall } from "./hooks/useVoiceCall";
import { useMobile } from "./hooks/useMobile";
import {
  clearToken,
  clearUser,
  getToken,
  getUser,
  setToken,
  setUser,
} from "./lib/storage";
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
  const [generalMessages, setGeneralMessages] = useState([]);
  const [dmByUserId, setDmByUserId] = useState({});
  const [dmUnread, setDmUnread] = useState({});
  const [generalUnread, setGeneralUnread] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [activeDmUser, setActiveDmUser] = useState(null);
  const [friendNotice, setFriendNotice] = useState("");
  const [socketApi, setSocketApi] = useState(null);
  const [typingGeneral, setTypingGeneral] = useState([]);
  const [typingDmUser, setTypingDmUser] = useState(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [generalHasMore, setGeneralHasMore] = useState(true);
  const [loadingOlderGeneral, setLoadingOlderGeneral] = useState(false);
  const [dmHasMore, setDmHasMore] = useState(true);
  const [loadingOlderDm, setLoadingOlderDm] = useState(false);
  const [reconnectState, setReconnectState] = useState("idle");
  const [adminOpen, setAdminOpen] = useState(false);

  const socketRef = useRef(null);
  const activeDmRef = useRef(null);
  const myIdRef = useRef(null);
  const transportFallbackStepRef = useRef(0);
  const voice = useVoiceCall(socketApi);
  const { isMobile } = useMobile();

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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token || !me || !sessionChecked) return;
    connectSocket(token);
    return () => {
      socketRef.current?.disconnect();
    };
  }, [me?.id, sessionChecked]);

  const verifyBackendEndpoint = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { method: "GET" });
      if (!response.ok) {
        throw new Error(`Backend health check failed with status ${response.status}`);
      }
      const data = await response.json().catch(() => null);
      if (!data || data.status !== "ok") {
        throw new Error("Invalid backend health response.");
      }
      return true;
    } catch {
      throw new Error(
        `Wrong backend URL (${API_BASE_URL}). VITE_API_BASE_URL must point to your Node/Socket backend service.`,
      );
    }
  };

  const emitDmActive = useCallback((socket, peerId) => {
    if (typeof peerId === "string") {
      socket.emit("dm:set_active", { withUserId: peerId });
    } else {
      socket.emit("dm:set_active", { withUserId: null });
    }
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
      const dm = activeDmRef.current;
      emitDmActive(socket, dm?.id ?? null);
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

      if (
        msg.toLowerCase().includes("xhr poll error") ||
        msg.toLowerCase().includes("authentication failed") ||
        msg.toLowerCase().includes("authentication required")
      ) {
        clearToken();
        clearUser();
        setMe(null);
        socket.disconnect();
      }

      if (msg.toLowerCase().includes("xhr poll error")) {
        setAuthError(
          "Socket connection failed. Check backend deploy status, backend URL, and CORS settings.",
        );
        return;
      }

      setAuthError(msg);
    });

    socket.on("connected", (payload) => {
      if (payload?.user) {
        setUser(payload.user);
        setMe(payload.user);
      }
    });

    socket.on("sync:state", (state) => {
      if (state && typeof state.generalUnread === "number") setGeneralUnread(state.generalUnread);
      if (state?.dmUnreadByPeer && typeof state.dmUnreadByPeer === "object") {
        setDmUnread({ ...state.dmUnreadByPeer });
      }
      if (Array.isArray(state?.notifications)) setNotifications(state.notifications);
    });

    socket.on("general:history", (msgs) => {
      setGeneralMessages(Array.isArray(msgs) ? msgs : []);
      setHistoryReady(true);
      setGeneralHasMore((Array.isArray(msgs) ? msgs : []).length >= 50);
    });

    socket.on("general:page", ({ messages, hasMore } = {}) => {
      setLoadingOlderGeneral(false);
      if (!Array.isArray(messages)) return;
      setGeneralMessages((prev) => mergeById(prev, messages));
      setGeneralHasMore(!!hasMore);
    });

    socket.on("general:unread", ({ count } = {}) => {
      if (typeof count === "number") setGeneralUnread(count);
    });

    socket.on("message:new", (message) => {
      setGeneralMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    socket.on("message:reaction:update", ({ msgId, reactions } = {}) => {
      if (!msgId) return;
      setGeneralMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, reactions: reactions || {} } : m)),
      );
    });

    socket.on("message:updated", ({ msgId, text, edited, editedAt } = {}) => {
      if (!msgId) return;
      setGeneralMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, text, edited: !!edited, editedAt: editedAt || m.editedAt } : m,
        ),
      );
    });

    socket.on("message:deleted", ({ msgId } = {}) => {
      if (!msgId) return;
      setGeneralMessages((prev) => prev.filter((m) => m.id !== msgId));
    });

    socket.on("typing:update", (payload = {}) => {
      const { context, fromUser, typing } = payload;
      if (!fromUser?.id || fromUser.id === myIdRef.current) return;
      if (context === "general") {
        setTypingGeneral((prev) => {
          const rest = prev.filter((u) => u.id !== fromUser.id);
          if (typing) return [...rest, fromUser];
          return rest;
        });
        return;
      }
      if (context === "dm") {
        const peer = activeDmRef.current;
        if (!peer || peer.id !== fromUser.id) {
          if (!typing) setTypingDmUser((cur) => (cur?.id === fromUser.id ? null : cur));
          return;
        }
        setTypingDmUser(typing ? fromUser : null);
      }
    });

    socket.on("users:update", (users) => setOnlineUsers(users ?? []));

    socket.on("friend:list", (list) => setFriends(list ?? []));
    socket.on("friend:requests", (list) => setFriendRequests(list ?? []));
    socket.on("friend:request:incoming", ({ from }) => {
      if (!from) return;
      setFriendRequests((prev) => {
        if (prev.some((req) => req.id === from.id)) return prev;
        return [...prev, from];
      });
    });
    socket.on("friend:accepted", () => {
      socket.emit("friend:list");
    });
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
      setDmByUserId((prev) => ({
        ...prev,
        [convWith]: [...(prev[convWith] ?? []), message],
      }));
      const fromOther = message.from?.id && message.from.id !== myIdRef.current;
      if (fromOther && message.from?.id) {
        socket.emit("dm:delivered", { msgId: message.id, fromUserId: message.from.id });
      }
    });

    socket.on("dm:message:update", ({ msgId, convWith, deliveredAt } = {}) => {
      if (!msgId || !convWith) return;
      setDmByUserId((prev) => {
        const cur = prev[convWith];
        if (!cur) return prev;
        return {
          ...prev,
          [convWith]: cur.map((m) =>
            m.id === msgId ? { ...m, deliveredAt: deliveredAt ?? m.deliveredAt } : m,
          ),
        };
      });
    });

    socket.on("dm:unread:sync", ({ peerId, count } = {}) => {
      if (!peerId) return;
      setDmUnread((prev) => {
        const n = { ...prev };
        if (count === 0) delete n[peerId];
        else n[peerId] = count;
        return n;
      });
    });

    socket.on("dm:peer_read", ({ peerId, at } = {}) => {
      if (!peerId) return;
      setDmByUserId((prev) => {
        const cur = prev[peerId];
        if (!cur) return prev;
        const selfId = myIdRef.current;
        return {
          ...prev,
          [peerId]: cur.map((m) =>
            m.from?.id === selfId && m.to?.id === peerId ? { ...m, readAt: m.readAt || at } : m,
          ),
        };
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

    socket.on("system:kick", () => {
      clearToken();
      clearUser();
      setMe(null);
      socket.disconnect();
    });

    socket.on("system:maintenance", () => {
      clearToken();
      clearUser();
      setMe(null);
      socket.disconnect();
    });

    socket.on("admin:user_messages_removed", ({ userId } = {}) => {
      if (!userId) return;
      setGeneralMessages((prev) => prev.filter((m) => m.userId !== userId));
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
    voice.cleanup();
    socketRef.current?.emit("dm:set_active", { withUserId: null });
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocketApi(null);
    clearToken();
    clearUser();
    setMe(null);
    setIsConnected(false);
    setOnlineUsers([]);
    setFriends([]);
    setFriendRequests([]);
    setGeneralMessages([]);
    setDmByUserId({});
    setDmUnread({});
    setGeneralUnread(0);
    setNotifications([]);
    setActiveDmUser(null);
    setAuthError("");
    setTypingGeneral([]);
    setTypingDmUser(null);
    setHistoryReady(false);
    setGeneralHasMore(true);
    setDmHasMore(true);
  };

  const handleSendGeneral = (text) => {
    socketRef.current?.emit("message:send", { text });
  };

  const handleOpenDm = (friend) => {
    setActiveDmUser(friend);
    setDmUnread((u) => {
      const n = { ...u };
      delete n[friend.id];
      return n;
    });
    socketRef.current?.emit("dm:mark_read", { withUserId: friend.id });
    socketRef.current?.emit("dm:history", { withUserId: friend.id });
    socketRef.current?.emit("dm:set_active", { withUserId: friend.id });
  };

  const handleSendDm = (toUserId, text) => {
    socketRef.current?.emit("dm:send", { toUserId, text });
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
    setDmByUserId((prev) => {
      const n = { ...prev };
      delete n[friendId];
      return n;
    });
  };

  const handleStatusChange = (status) => {
    setMyStatus(status);
    socketRef.current?.emit("status:set", { status });
  };

  const handleReactGeneral = (msgId, emoji) => {
    socketRef.current?.emit("message:react", { msgId, emoji });
  };

  const handleEditGeneral = (msgId, text) => {
    socketRef.current?.emit("message:edit", { msgId, text });
  };

  const handleDeleteGeneral = (msgId) => {
    socketRef.current?.emit("message:delete", { msgId });
  };

  const emitTypingGeneralStart = () => {
    socketRef.current?.emit("typing:start", { context: "general" });
  };
  const emitTypingGeneralStop = () => {
    socketRef.current?.emit("typing:stop", { context: "general" });
  };
  const emitTypingDmStart = (toUserId) => {
    socketRef.current?.emit("typing:start", { context: "dm", toUserId });
  };
  const emitTypingDmStop = (toUserId) => {
    socketRef.current?.emit("typing:stop", { context: "dm", toUserId });
  };

  const handleMarkGeneralRead = useCallback(() => {
    socketRef.current?.emit("general:mark_read");
  }, []);

  const handleBackToGeneral = () => {
    setActiveDmUser(null);
    socketRef.current?.emit("dm:set_active", { withUserId: null });
  };

  const loadOlderGeneral = () => {
    const s = socketRef.current;
    if (!s || loadingOlderGeneral || !generalHasMore) return;
    const oldest = generalMessages[0]?.timestamp;
    if (!oldest) return;
    setLoadingOlderGeneral(true);
    s.emit("general:fetch", { before: oldest, limit: 50 });
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

  if (!sessionChecked) {
    return <div className="session-boot" aria-busy="true" />;
  }

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

  /* ── shared layout props ─────────────────────────── */
  const layoutProps = {
    me,
    connectionLabel,
    reconnectState,
    authError,
    myStatus,
    onlineUsers,
    friends,
    friendRequests,
    generalMessages,
    historyReady,
    generalUnread,
    notifications,
    activeDmUser,
    dmMessages,
    dmUnread,
    dmByUserId,
    typingGeneral,
    typingDmUser,
    onOpenDm: handleOpenDm,
    onBackToGeneral: handleBackToGeneral,
    onSendGeneral: handleSendGeneral,
    onSendDm: handleSendDm,
    onSendFriendRequest: handleSendFriendRequest,
    onAcceptFriend: handleAcceptFriend,
    onDeclineFriend: handleDeclineFriend,
    onRemoveFriend: handleRemoveFriend,
    onLogout: handleLogout,
    onStatusChange: handleStatusChange,
    friendNotice,
    voice,
    onReactGeneral: handleReactGeneral,
    onEditGeneral: handleEditGeneral,
    onDeleteGeneral: handleDeleteGeneral,
    onTypingGeneralStart: emitTypingGeneralStart,
    onTypingGeneralStop: emitTypingGeneralStop,
    onTypingDmStart: emitTypingDmStart,
    onTypingDmStop: emitTypingDmStop,
    onMarkGeneralRead: handleMarkGeneralRead,
    loadOlderGeneral,
    loadOlderDm,
    generalHasMore,
    dmHasMore,
    loadingOlderGeneral,
    loadingOlderDm,
    onNotificationRead: handleNotificationRead,
    onNotificationReadAll: handleNotificationReadAll,
    socketApi,
  };

  if (isMobile) {
    return <MobileChatLayout {...layoutProps} />;
  }

  return (
    <>
      {me?.username === "admin" && !adminOpen && (
        <button type="button" className="admin-fab" onClick={() => setAdminOpen(true)} title="Admin panel">
          Admin
        </button>
      )}
      {me?.username === "admin" && adminOpen && (
        <AdminPanel socket={socketApi} onClose={() => setAdminOpen(false)} />
      )}
      <ChatLayout {...layoutProps} />
    </>
  );
}
