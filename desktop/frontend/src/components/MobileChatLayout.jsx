import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import ConnectionBanner from "./mobile/ConnectionBanner";
import MobileBottomNav from "./mobile/MobileBottomNav";
import MobileDrawer from "./mobile/MobileDrawer";
import MessageBubble from "./chat/MessageBubble";
import TypingIndicator from "./chat/TypingIndicator";
import Avatar from "./ui/Avatar";
import { useSwipe } from "../hooks/useSwipe";
import { useViewport } from "../hooks/useViewport";
import AdminPanel from "./admin/AdminPanel";

/* ─── helpers ─────────────────────────────────────── */

function fmtTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function fmtRel(iso) {
  if (!iso) return "";
  try {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60_000) return "now";
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
    return new Date(iso).toLocaleDateString();
  } catch { return ""; }
}

function groupRows(msgs, keyFn) {
  return msgs.map((msg, i) => {
    const prev = msgs[i - 1];
    let compact = false;
    if (prev && keyFn(prev) === keyFn(msg)) {
      const gap = new Date(msg.timestamp) - new Date(prev.timestamp);
      if (gap < 7 * 60_000) compact = true;
    }
    return { msg, compact };
  });
}

/* ─── MobileMessageInput ───────────────────────────── */

function MobileMessageInput({ onSend, onTypingStart, onTypingStop, placeholder = "Message…" }) {
  const [text, setText] = useState("");
  const taRef = useRef(null);
  const timerRef = useRef(null);
  const wasTyping = useRef(false);

  const flushTyping = useCallback(() => {
    if (wasTyping.current) { onTypingStop?.(); wasTyping.current = false; }
    clearTimeout(timerRef.current);
  }, [onTypingStop]);

  const handleChange = (e) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
    if (!wasTyping.current) { wasTyping.current = true; onTypingStart?.(); }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushTyping, 1800);
  };

  const handleSend = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    flushTyping();
    onSend(t);
    setText("");
    if (taRef.current) taRef.current.style.height = "auto";
  }, [text, flushTyping, onSend]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = text.trim().length > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        padding: "8px 12px",
        paddingBottom: "calc(8px + var(--sab, 0px))",
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      <textarea
        ref={taRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKey}
        placeholder={placeholder}
        rows={1}
        style={{
          flex: 1,
          resize: "none",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 22,
          padding: "10px 16px",
          fontSize: 15,
          color: "var(--text-primary)",
          outline: "none",
          lineHeight: 1.4,
          maxHeight: 120,
          overflowY: "auto",
          fontFamily: "inherit",
        }}
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: canSend ? "var(--accent, #7c5cfc)" : "var(--border)",
          border: "none",
          cursor: canSend ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.15s",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}

/* ─── MobileChatView (general or DM) ──────────────── */

function MobileChatView({
  title,
  subtitle,
  messages,
  grouped,
  me,
  typing,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onSend,
  onTypingStart,
  onTypingStop,
  onReact,
  onEdit,
  onDelete,
  onBack,
  headerRight,
}) {
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const prevLen = useRef(0);

  useEffect(() => {
    if (messages.length !== prevLen.current) {
      prevLen.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleScroll = (e) => {
    if (e.target.scrollTop < 80 && hasMore && !loadingOlder) {
      onLoadOlder?.();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          flexShrink: 0,
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent, #7c5cfc)",
              cursor: "pointer",
              padding: "4px 0",
              fontSize: 22,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
            }}
          >
            ‹
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }} className="truncate">{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{subtitle}</div>
          )}
        </div>
        {headerRight}
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 0",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {loadingOlder && (
          <div style={{ textAlign: "center", padding: 12, color: "var(--text-muted)", fontSize: 13 }}>
            Loading…
          </div>
        )}
        {grouped.map(({ msg, compact }) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.userId === me?.id || msg.from?.id === me?.id}
            myUserId={me?.id}
            compact={compact}
            onReact={onReact ? (msgId, emoji) => onReact(msgId, emoji) : undefined}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        <AnimatePresence>
          {typing?.length > 0 && <TypingIndicator names={typing} />}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MobileMessageInput
        onSend={onSend}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        placeholder={`Message ${title}`}
      />
    </div>
  );
}

/* ─── DmListView ───────────────────────────────────── */

function DmListView({ friends, dmUnread, dmByUserId, onOpenDm, onSendFriendRequest }) {
  const [newFriend, setNewFriend] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const dmList = useMemo(() => {
    return friends
      .map((f) => {
        const list = dmByUserId[f.id] || [];
        const last = list[list.length - 1] ?? null;
        return {
          friend: f,
          unread: dmUnread[f.id] || 0,
          preview: last?.text ?? "",
          time: last ? fmtRel(last.timestamp) : "",
          sortKey: last ? new Date(last.timestamp).getTime() : 0,
        };
      })
      .sort((a, b) => (b.unread - a.unread) || (b.sortKey - a.sortKey));
  }, [friends, dmUnread, dmByUserId]);

  const submit = (e) => {
    e.preventDefault();
    const t = newFriend.trim();
    if (t) { onSendFriendRequest(t); setNewFriend(""); setShowAdd(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, fontWeight: 700, fontSize: 17 }}>Direct Messages</div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          style={{
            background: "var(--accent-dim, rgba(124,92,252,0.15))",
            border: "none",
            borderRadius: 8,
            padding: "6px 12px",
            color: "var(--accent, #7c5cfc)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          + Add Friend
        </button>
      </div>

      {/* Add friend input */}
      <AnimatePresence>
        {showAdd && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={submit}
            style={{
              overflow: "hidden",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-elevated)",
            }}
          >
            <div style={{ display: "flex", gap: 8, padding: "10px 16px" }}>
              <input
                value={newFriend}
                onChange={(e) => setNewFriend(e.target.value)}
                placeholder="Enter username…"
                style={{
                  flex: 1,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                style={{
                  background: "var(--accent, #7c5cfc)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Send
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* DM list */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {dmList.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>📩</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No direct messages yet</div>
            <div>Add a friend to start chatting</div>
          </div>
        )}
        {dmList.map(({ friend, unread, preview, time }) => (
          <button
            key={friend.id}
            onClick={() => onOpenDm(friend)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              background: "none",
              border: "none",
              borderBottom: "1px solid var(--border)",
              cursor: "pointer",
              textAlign: "left",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Avatar name={friend.displayName || friend.username} size={46} />
              {friend.status === "online" && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 1,
                    right: 1,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "var(--online, #22c55e)",
                    border: "2px solid var(--bg-secondary)",
                  }}
                />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span
                  style={{
                    fontWeight: unread ? 700 : 600,
                    fontSize: 15,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {friend.displayName || friend.username}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{time}</span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: unread ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: unread ? 600 : 400,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginTop: 2,
                }}
              >
                {preview || "No messages yet"}
              </div>
            </div>
            {unread > 0 && (
              <span
                style={{
                  background: "var(--accent, #7c5cfc)",
                  color: "#fff",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  minWidth: 20,
                  height: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 5px",
                  flexShrink: 0,
                }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── NotificationsView ────────────────────────────── */

function NotificationsView({ notifications, onRead, onReadAll }) {
  const unread = notifications.filter((n) => !n.read);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          flexShrink: 0,
          gap: 8,
        }}
      >
        <div style={{ flex: 1, fontWeight: 700, fontSize: 17 }}>Notifications</div>
        {unread.length > 0 && (
          <button
            onClick={onReadAll}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent, #7c5cfc)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 0",
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {notifications.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔔</div>
            <div style={{ fontWeight: 600 }}>All caught up!</div>
          </div>
        )}
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => !n.read && onRead(n.id)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "14px 16px",
              background: n.read ? "none" : "var(--accent-dim, rgba(124,92,252,0.06))",
              border: "none",
              borderBottom: "1px solid var(--border)",
              cursor: n.read ? "default" : "pointer",
              textAlign: "left",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: n.read ? "transparent" : "var(--accent, #7c5cfc)",
                flexShrink: 0,
                marginTop: 6,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: n.read ? 400 : 600,
                  color: "var(--text-primary)",
                  lineHeight: 1.4,
                }}
              >
                {n.text || n.message || "New notification"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                {fmtRel(n.createdAt || n.timestamp)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── ProfileView ──────────────────────────────────── */

function ProfileView({ me, myStatus, onStatusChange, onLogout, isAdmin, onOpenAdmin }) {
  const statuses = ["online", "away", "busy", "offline"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          fontWeight: 700,
          fontSize: 17,
          flexShrink: 0,
        }}
      >
        Profile
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {/* Avatar + name */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "32px 16px 24px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-elevated)",
          }}
        >
          <Avatar name={me?.displayName || me?.username} size={72} />
          <div style={{ marginTop: 14, fontWeight: 700, fontSize: 20 }}>
            {me?.displayName || me?.username}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 3 }}>
            @{me?.username}
          </div>
        </div>

        {/* Status */}
        <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
            Status
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 20,
                  border: "1.5px solid",
                  borderColor: myStatus === s ? "var(--accent, #7c5cfc)" : "var(--border)",
                  background: myStatus === s ? "var(--accent-dim, rgba(124,92,252,0.12))" : "none",
                  color: myStatus === s ? "var(--accent, #7c5cfc)" : "var(--text-secondary)",
                  fontWeight: myStatus === s ? 700 : 400,
                  fontSize: 13,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Admin */}
        {isAdmin && (
          <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
            <button
              onClick={onOpenAdmin}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "rgba(234,179,8,0.1)",
                border: "1px solid rgba(234,179,8,0.3)",
                borderRadius: 12,
                color: "#ca8a04",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>👑</span>
              Admin Panel
            </button>
          </div>
        )}

        {/* Logout */}
        <div style={{ padding: "8px 16px" }}>
          <button
            onClick={onLogout}
            style={{
              width: "100%",
              padding: "14px 16px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 12,
              color: "var(--danger, #ef4444)",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── MobileChatLayout (main export) ──────────────── */

export default function MobileChatLayout({
  me,
  connectionLabel,
  reconnectState,
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
  onOpenDm,
  onBackToGeneral,
  onSendGeneral,
  onSendDm,
  onSendFriendRequest,
  onAcceptFriend,
  onDeclineFriend,
  onRemoveFriend,
  onLogout,
  onStatusChange,
  friendNotice,
  voice,
  onReactGeneral,
  onEditGeneral,
  onDeleteGeneral,
  onTypingGeneralStart,
  onTypingGeneralStop,
  onTypingDmStart,
  onTypingDmStop,
  onMarkGeneralRead,
  loadOlderGeneral,
  loadOlderDm,
  generalHasMore,
  dmHasMore,
  loadingOlderGeneral,
  loadingOlderDm,
  onNotificationRead,
  onNotificationReadAll,
  socketApi,
}) {
  const [activeTab, setActiveTab] = useState("general");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const { keyboardVisible } = useViewport();

  /* Set safe-area CSS vars */
  useEffect(() => {
    document.documentElement.style.setProperty("--sat", "env(safe-area-inset-top, 0px)");
    document.documentElement.style.setProperty("--sab", "env(safe-area-inset-bottom, 0px)");
  }, []);

  /* Swipe right → open drawer, swipe left → close */
  const swipe = useSwipe({
    onSwipeRight: () => !drawerOpen && setDrawerOpen(true),
    onSwipeLeft: () => drawerOpen && setDrawerOpen(false),
    threshold: 60,
  });

  /* Mark general read when entering general tab */
  useEffect(() => {
    if (activeTab === "general" && historyReady) {
      onMarkGeneralRead?.();
    }
  }, [activeTab, historyReady, onMarkGeneralRead]);

  /* Derived */
  const isConnected = connectionLabel === "Online";
  const isReconnecting = reconnectState === "reconnecting";

  const totalDmUnread = useMemo(
    () => Object.values(dmUnread).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0),
    [dmUnread],
  );

  const notifUnread = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const generalGrouped = useMemo(
    () => groupRows(generalMessages, (m) => m.userId),
    [generalMessages],
  );

  const dmGrouped = useMemo(
    () => groupRows(dmMessages, (m) => m.from?.id),
    [dmMessages],
  );

  const typingGeneralNames = typingGeneral.map((u) => u.username).filter(Boolean);
  const typingDmNames = typingDmUser ? [typingDmUser.username] : [];

  const isAdmin = me?.username === "admin";

  /* Navigate from drawer */
  const handleDrawerNav = (tab) => {
    if (tab === "admin") {
      setAdminOpen(true);
      return;
    }
    setActiveTab(tab);
    // When switching to DM tab, clear active DM user
    if (tab !== "dm") {
      // keep activeDmUser as-is — backing out of DM chat is via onBackToGeneral
    }
  };

  /* Back from DM chat → return to DM list */
  const handleDmBack = () => {
    onBackToGeneral();
  };

  /* Render active content pane */
  const renderContent = () => {
    // Admin overlay
    if (adminOpen) {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setAdminOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent, #7c5cfc)",
                cursor: "pointer",
                fontSize: 22,
                lineHeight: 1,
              }}
            >
              ‹
            </button>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Admin Panel</span>
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            <AdminPanel socket={socketApi} onClose={() => setAdminOpen(false)} />
          </div>
        </div>
      );
    }

    if (activeTab === "general") {
      return (
        <MobileChatView
          title="# general"
          subtitle={`${onlineUsers.length} online`}
          messages={generalMessages}
          grouped={generalGrouped}
          me={me}
          typing={typingGeneralNames}
          hasMore={generalHasMore}
          loadingOlder={loadingOlderGeneral}
          onLoadOlder={loadOlderGeneral}
          onSend={onSendGeneral}
          onTypingStart={onTypingGeneralStart}
          onTypingStop={onTypingGeneralStop}
          onReact={onReactGeneral}
          onEdit={onEditGeneral}
          onDelete={onDeleteGeneral}
          headerRight={
            <button
              onClick={() => setDrawerOpen(true)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
              </svg>
            </button>
          }
        />
      );
    }

    if (activeTab === "dm") {
      if (activeDmUser) {
        return (
          <MobileChatView
            title={`@${activeDmUser.username}`}
            subtitle={activeDmUser.status === "online" ? "Online" : "Offline"}
            messages={dmMessages}
            grouped={dmGrouped}
            me={me}
            typing={typingDmNames}
            hasMore={dmHasMore}
            loadingOlder={loadingOlderDm}
            onLoadOlder={loadOlderDm}
            onSend={(text) => onSendDm(activeDmUser.id, text)}
            onTypingStart={() => onTypingDmStart?.(activeDmUser.id)}
            onTypingStop={() => onTypingDmStop?.(activeDmUser.id)}
            onBack={handleDmBack}
          />
        );
      }
      return (
        <DmListView
          friends={friends}
          dmUnread={dmUnread}
          dmByUserId={dmByUserId}
          onOpenDm={onOpenDm}
          onSendFriendRequest={onSendFriendRequest}
        />
      );
    }

    if (activeTab === "notifications") {
      return (
        <NotificationsView
          notifications={notifications}
          onRead={onNotificationRead}
          onReadAll={onNotificationReadAll}
        />
      );
    }

    if (activeTab === "profile") {
      return (
        <ProfileView
          me={me}
          myStatus={myStatus}
          onStatusChange={onStatusChange}
          onLogout={onLogout}
          isAdmin={isAdmin}
          onOpenAdmin={() => setAdminOpen(true)}
        />
      );
    }

    return null;
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        background: "var(--bg-primary)",
        position: "relative",
      }}
      {...swipe}
    >
      {/* Connection banner */}
      <ConnectionBanner connected={isConnected} reconnecting={isReconnecting} />

      {/* Friendly notice (toast) */}
      <AnimatePresence>
        {friendNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              position: "absolute",
              top: 40,
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
              borderRadius: 20,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
              zIndex: 300,
              whiteSpace: "nowrap",
              boxShadow: "var(--shadow-lg)",
              pointerEvents: "none",
            }}
          >
            {friendNotice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawer overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 199,
              backdropFilter: "blur(2px)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        me={me}
        onNavigate={handleDrawerNav}
        onLogout={onLogout}
      />

      {/* Main content */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          paddingTop: "var(--sat, 0px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${activeTab}-${activeDmUser?.id ?? "none"}-${adminOpen}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            style={{ height: "100%", display: "flex", flexDirection: "column" }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav — hide when keyboard visible */}
      <AnimatePresence>
        {!keyboardVisible && (
          <motion.div
            initial={{ y: 0 }}
            exit={{ y: 80 }}
            transition={{ duration: 0.2 }}
          >
            <MobileBottomNav
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                // If switching away from DM, clear active DM
                if (tab !== "dm" && activeDmUser) onBackToGeneral();
              }}
              dmUnread={totalDmUnread}
              notifUnread={notifUnread}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
