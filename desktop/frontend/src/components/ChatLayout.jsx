import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../context/ToastContext";
import MessageBubble from "./chat/MessageBubble";
import TypingIndicator from "./chat/TypingIndicator";
import SettingsPanel from "./settings/SettingsPanel";
import UserHoverCard from "./social/UserHoverCard";
import UserProfilePopover from "./social/UserProfilePopover";
import { MessageSkeleton } from "./ui/Skeleton";
import RippleButton from "./ui/RippleButton";
import Avatar from "./ui/Avatar";
import Modal from "./ui/Modal";

function StatusBadge({ status = "offline" }) {
  return <span className={`status-dot ${status}`} title={status} />;
}

function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatRelativeTime(iso) {
  if (!iso) return "";
  try {
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    if (diff < 60_000) return "Just now";
    if (diff < 3600_000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

function groupGeneralRows(messages) {
  return messages.map((msg, i) => {
    const prev = messages[i - 1];
    let compact = false;
    if (prev && prev.userId === msg.userId) {
      const gap = new Date(msg.timestamp) - new Date(prev.timestamp);
      if (gap < 7 * 60 * 1000) compact = true;
    }
    return { msg, compact };
  });
}

function groupDmRows(messages) {
  return messages.map((msg, i) => {
    const prev = messages[i - 1];
    let compact = false;
    if (prev && prev.from?.id === msg.from?.id) {
      const gap = new Date(msg.timestamp) - new Date(prev.timestamp);
      if (gap < 7 * 60 * 1000) compact = true;
    }
    return { msg, compact };
  });
}

export default function ChatLayout({
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
  generalUnread = 0,
  notifications = [],
  activeDmUser,
  dmMessages,
  dmUnread = {},
  dmByUserId = {},
  typingGeneral = [],
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
}) {
  const { toast } = useToast();
  const [composer, setComposer] = useState("");
  const [friendUsername, setFriendUsername] = useState("");
  const [sidebarView, setSidebarView] = useState("home");
  const [friendFilter, setFriendFilter] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [hoverCard, setHoverCard] = useState(null);
  const [compactBlur, setCompactBlur] = useState(14);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("descall_theme") || "dark";
    } catch {
      return "dark";
    }
  });

  const messagesRef = useRef(null);
  const typingTimerRef = useRef(null);
  const wasTypingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-reduce-motion", reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    document.documentElement.style.setProperty("--glass-blur", `${compactBlur}px`);
  }, [compactBlur]);

  useEffect(() => {
    try {
      localStorage.setItem("descall_theme", theme);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!historyReady || activeDmUser) return;
    onMarkGeneralRead?.();
  }, [historyReady, activeDmUser, onMarkGeneralRead]);

  const messages = activeDmUser ? dmMessages : generalMessages;
  const title = activeDmUser ? `@${activeDmUser.username}` : "#general";

  const sortedFriends = useMemo(
    () => [...friends].sort((a, b) => a.username.localeCompare(b.username)),
    [friends],
  );

  const filteredFriends = useMemo(() => {
    const q = friendFilter.trim().toLowerCase();
    if (!q) return sortedFriends;
    return sortedFriends.filter((f) => f.username.toLowerCase().includes(q));
  }, [sortedFriends, friendFilter]);

  const dmList = useMemo(() => {
    return friends
      .map((f) => {
        const list = dmByUserId[f.id] || [];
        const last = list.length ? list[list.length - 1] : null;
        return {
          friend: f,
          unread: dmUnread[f.id] || 0,
          preview: last?.text ?? "",
          timeLabel: last ? formatRelativeTime(last.timestamp) : "",
          sortKey: last ? new Date(last.timestamp).getTime() : 0,
        };
      })
      .sort((a, b) => {
        if (b.unread !== a.unread) return b.unread - a.unread;
        return b.sortKey - a.sortKey;
      });
  }, [friends, dmUnread, dmByUserId]);

  const generalGrouped = useMemo(() => groupGeneralRows(generalMessages), [generalMessages]);
  const dmGrouped = useMemo(() => groupDmRows(dmMessages), [dmMessages]);

  const notificationUnread = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const totalDmUnread = useMemo(
    () => Object.values(dmUnread).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0),
    [dmUnread],
  );

  const globalUnread = generalUnread + totalDmUnread + notificationUnread;

  useEffect(() => {
    scrollToBottom();
  }, [activeDmUser, scrollToBottom]);

  useEffect(() => {
    if (!historyReady || activeDmUser) return;
    scrollToBottom();
  }, [historyReady, activeDmUser, scrollToBottom]);

  const flushTyping = useCallback(() => {
    if (wasTypingRef.current) {
      if (activeDmUser) onTypingDmStop?.(activeDmUser.id);
      else onTypingGeneralStop?.();
      wasTypingRef.current = false;
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, [activeDmUser, onTypingDmStop, onTypingGeneralStop]);

  useEffect(() => () => flushTyping(), [flushTyping]);

  const handleMessagesScroll = (e) => {
    const el = e.target;
    if (el.scrollTop < 100) {
      if (activeDmUser) {
        if (!loadingOlderDm && dmHasMore) loadOlderDm?.();
      } else if (!loadingOlderGeneral && generalHasMore) {
        loadOlderGeneral?.();
      }
    }
  };

  const handleComposerChange = (e) => {
    const v = e.target.value;
    setComposer(v);
    if (!wasTypingRef.current) {
      wasTypingRef.current = true;
      if (activeDmUser) onTypingDmStart?.(activeDmUser.id);
      else onTypingGeneralStart?.();
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      flushTyping();
    }, 1800);
  };

  const submitMessage = (event) => {
    event.preventDefault();
    const text = composer.trim();
    if (!text) return;
    flushTyping();
    if (activeDmUser) onSendDm(activeDmUser.id, text);
    else onSendGeneral(text);
    setComposer("");
    requestAnimationFrame(() => scrollToBottom());
  };

  const submitFriendRequest = (event) => {
    event.preventDefault();
    const target = friendUsername.trim();
    if (!target) return;
    onSendFriendRequest(target);
    setFriendUsername("");
  };

  const inCall = voice?.mode === "active" || voice?.mode === "outgoing";

  const openProfileFromMessage = (msg) => {
    setProfileUser({
      username: msg.username,
      userId: msg.userId,
      avatarUrl: msg.avatarUrl,
    });
  };

  const typingNamesGeneral = typingGeneral.map((u) => u.username).filter(Boolean);
  const typingNamesDm = typingDmUser ? [typingDmUser.username] : [];

  const showSkeleton = !activeDmUser && !historyReady && generalMessages.length === 0;

  const isOnline = connectionLabel === "Online";

  return (
    <div className="app-root app-root-enhanced">
      <nav className="nav-rail" aria-label="Main">
        <motion.button
          type="button"
          className={`rail-btn ${sidebarView === "home" ? "active" : ""}`}
          title="Server chat"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            setSidebarView("home");
            onBackToGeneral();
          }}
        >
          #
        </motion.button>
        <motion.button
          type="button"
          className={`rail-btn ${sidebarView === "friends" ? "active" : ""}`}
          title="Friends"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setSidebarView("friends")}
        >
          👥
        </motion.button>
        <motion.button
          type="button"
          className={`rail-btn ${sidebarView === "dms" ? "active" : ""}`}
          title="Direct messages"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setSidebarView("dms")}
        >
          💬
        </motion.button>
        <motion.button
          type="button"
          className={`rail-btn ${notificationsOpen ? "active" : ""}`}
          title="Notifications"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setNotificationsOpen((o) => !o)}
        >
          🔔
          {globalUnread > 0 && <span className="rail-badge">{globalUnread > 99 ? "99+" : globalUnread}</span>}
        </motion.button>
        <motion.button
          type="button"
          className={`rail-btn ${sidebarView === "online" ? "active" : ""}`}
          title="Online"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setSidebarView("online")}
        >
          ●
        </motion.button>
        <div className="rail-spacer" />
        <motion.button
          type="button"
          className="rail-btn subtle"
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setSidebarOpen((o) => !o)}
        >
          ⏴
        </motion.button>
        <motion.button
          type="button"
          className="rail-btn subtle"
          title="Settings"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
        </motion.button>
      </nav>

      <motion.aside
        className="sidebar-secondary glass-sidebar"
        initial={false}
        animate={{
          width: sidebarOpen ? 300 : 0,
          opacity: sidebarOpen ? 1 : 0,
          x: sidebarOpen ? 0 : -12,
        }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        style={{ overflow: "hidden" }}
      >
        <div className="sidebar-inner">
          <div className="sidebar-brand">
            <span className="brand-mark">Descall</span>
            <span className={`conn-pill ${isOnline ? "on" : "off"}`}>{connectionLabel}</span>
          </div>
          {authError && reconnectState !== "connected" && (
            <div className="sidebar-error">{authError}</div>
          )}

          {sidebarView === "home" && (
            <div className="sidebar-section">
              <h4>Channels</h4>
              <RippleButton
                type="button"
                className="channel-pill active full"
                onClick={() => {
                  onBackToGeneral();
                }}
              >
                # general
                {generalUnread > 0 && <span className="channel-unread-pill">{generalUnread}</span>}
              </RippleButton>
              <p className="hint">Public channel. Add friends to use DMs and calls.</p>
              <div className="sidebar-mini-stats">
                <span>{onlineUsers.length} online</span>
                <span>{friends.length} friends</span>
              </div>
            </div>
          )}

          {sidebarView === "friends" && (
            <div className="sidebar-section grow">
              <h4>Add friend</h4>
              <form className="mini-form" onSubmit={submitFriendRequest}>
                <input
                  placeholder="Username"
                  value={friendUsername}
                  onChange={(e) => setFriendUsername(e.target.value)}
                />
                <RippleButton type="submit" title="Send request">
                  +
                </RippleButton>
              </form>
              <input
                className="filter-input"
                placeholder="Search friends..."
                value={friendFilter}
                onChange={(e) => setFriendFilter(e.target.value)}
              />
              <h4>Friends ({filteredFriends.length})</h4>
              <div className="scroll-list custom-scroll">
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="friend-row"
                    onMouseEnter={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setHoverCard({
                        user: friend,
                        x: Math.min(r.right + 8, window.innerWidth - 280),
                        y: r.top,
                      });
                    }}
                    onMouseLeave={() => setHoverCard(null)}
                  >
                    <button type="button" className="list-item" onClick={() => onOpenDm(friend)}>
                      <StatusBadge status={friend.status} />
                      <span className="friend-name">{friend.username}</span>
                    </button>
                    <div className="friend-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        title="Voice call"
                        disabled={inCall}
                        onClick={() => voice?.startCall(friend)}
                      >
                        📞
                      </button>
                      <button type="button" className="icon-btn" title="DM" onClick={() => onOpenDm(friend)}>
                        ✉
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        title="Remove"
                        onClick={() => onRemoveFriend(friend.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {filteredFriends.length === 0 && (
                  <p className="muted small">No friends match your search.</p>
                )}
              </div>
            </div>
          )}

          {sidebarView === "dms" && (
            <div className="sidebar-section grow">
              <h4>Direct messages</h4>
              <div className="scroll-list custom-scroll">
                {dmList.map(({ friend, unread, preview, timeLabel }) => (
                  <motion.button
                    key={friend.id}
                    type="button"
                    className={`dm-item ${activeDmUser?.id === friend.id ? "active" : ""}`}
                    onClick={() => onOpenDm(friend)}
                    whileHover={{ x: 2 }}
                  >
                    <Avatar name={friend.username} size={34} />
                    <div className="dm-item-body">
                      <div className="dm-item-top">
                        <span className="dm-name">{friend.username}</span>
                        {timeLabel && <span className="dm-time">{timeLabel}</span>}
                      </div>
                      <div className="dm-preview">
                        {preview || (unread > 0 ? "New messages" : "No messages yet")}
                      </div>
                    </div>
                    {unread > 0 && <span className="dm-badge">{unread > 9 ? "9+" : unread}</span>}
                  </motion.button>
                ))}
                {dmList.length === 0 && (
                  <p className="muted small">Add a friend to start a conversation.</p>
                )}
              </div>
            </div>
          )}

          {sidebarView === "online" && (
            <div className="sidebar-section grow">
              <h4>Online ({onlineUsers.length})</h4>
              <div className="scroll-list custom-scroll">
                {onlineUsers.map((user) => (
                  <div key={user.id ?? user.username} className="list-item static online-row">
                    <StatusBadge status={user.status} />
                    <span>{user.username}</span>
                    {user.username === me?.username && <em className="you-tag">you</em>}
                  </div>
                ))}
                {onlineUsers.length === 0 && <p className="muted small">No one is online.</p>}
              </div>
            </div>
          )}

          <div className="sidebar-section compact">
            <h4>Incoming requests</h4>
            {friendRequests.length === 0 && <p className="muted small">None</p>}
            {friendRequests.map((req) => (
              <div key={req.id} className="request-row compact-req">
                <span>{req.username}</span>
                <div>
                  <RippleButton type="button" className="btn-mini ok" onClick={() => onAcceptFriend(req.id)}>
                    Accept
                  </RippleButton>
                  <RippleButton type="button" className="btn-mini no" onClick={() => onDeclineFriend(req.id)}>
                    Decline
                  </RippleButton>
                </div>
              </div>
            ))}
          </div>

          {friendNotice && <div className="notice-banner">{friendNotice}</div>}

          <div className="user-bar" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="user-avatar-wrap"
              onClick={() =>
                setProfileUser({
                  username: me.username,
                  userId: me.id,
                })
              }
            >
              <Avatar name={me.username} size={36} />
            </button>
            <div className="user-meta">
              <div className="user-name">{me.username}</div>
              <select
                value={myStatus}
                onChange={(e) => onStatusChange(e.target.value)}
                className="status-mini"
              >
                <option value="online">Online</option>
                <option value="idle">Idle</option>
                <option value="dnd">Do not disturb</option>
                <option value="invisible">Invisible</option>
              </select>
            </div>
            <RippleButton type="button" className="logout-mini" onClick={onLogout}>
              Log out
            </RippleButton>
          </div>
        </div>
      </motion.aside>

      <section className="panel main-panel">
        <header className="panel-header glass-header">
          <div className="panel-title-wrap">
            <AnimatePresence mode="wait">
              <motion.div
                key={title}
                className="panel-title-block"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
              >
                <strong className="panel-title">{title}</strong>
                <span className="panel-sub">
                  {activeDmUser ? "Direct message" : "Server · text channel"}
                </span>
              </motion.div>
            </AnimatePresence>
            {activeDmUser && (
              <button type="button" className="back-link" onClick={onBackToGeneral}>
                ← #general
              </button>
            )}
            {activeDmUser && (
              <RippleButton
                type="button"
                className="header-call"
                disabled={inCall}
                onClick={() => voice?.startCall(activeDmUser)}
              >
                📞 Call
              </RippleButton>
            )}
          </div>
          <div className="panel-header-right">
            {!activeDmUser && generalUnread > 0 && (
              <span className="unread-chip" title="Unread in #general">
                {generalUnread} unread
              </span>
            )}
            <span className={`connection-chip ${isOnline ? "online" : "reconnect"}`}>{connectionLabel}</span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeDmUser ? `dm-${activeDmUser.id}` : "general"}
            className="messages-wrap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <div
              className="messages custom-scroll"
              ref={messagesRef}
              onScroll={handleMessagesScroll}
            >
              {(loadingOlderGeneral && !activeDmUser) || (loadingOlderDm && activeDmUser) ? (
                <div className="load-older-banner">Loading older messages…</div>
              ) : null}

              {showSkeleton && <MessageSkeleton count={5} />}

              {!showSkeleton && messages.length === 0 && (
                <motion.div
                  className="empty-state glass"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <h4>{activeDmUser ? `Conversation with ${activeDmUser.username}` : "#general"}</h4>
                  <p>
                    {activeDmUser
                      ? "No messages in this conversation yet."
                      : "No messages in this channel yet. Say hello."}
                  </p>
                </motion.div>
              )}

              {!activeDmUser &&
                generalGrouped.map(({ msg, compact }) => (
                  <MessageBubble
                    key={msg.id}
                    message={{ ...msg }}
                    compact={compact}
                    isOwn={msg.userId === me.id}
                    myUserId={me.id}
                    onReact={onReactGeneral}
                    onEdit={onEditGeneral}
                    onDelete={(id) => {
                      onDeleteGeneral(id);
                      toast("Message deleted", "info");
                    }}
                    onOpenProfile={openProfileFromMessage}
                  />
                ))}

              {activeDmUser &&
                dmGrouped.map(({ msg, compact }) => {
                  const fromSelf = msg.from?.id === me.id;
                  return (
                    <motion.article
                      key={msg.id}
                      className={`dm-msg ${fromSelf ? "own" : ""} ${compact ? "dm-compact" : ""}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {!compact ? (
                        <button
                          type="button"
                          className="dm-msg-avatar"
                          onClick={() =>
                            setProfileUser({
                              username: msg.from?.username ?? "?",
                              userId: msg.from?.id,
                            })
                          }
                        >
                          <Avatar name={msg.from?.username ?? "?"} size={36} />
                        </button>
                      ) : (
                        <div className="msg-avatar-spacer sm" aria-hidden />
                      )}
                      <div>
                        {!compact && (
                          <div className="msg-meta-line">
                            <strong>{msg.from?.username ?? "?"}</strong>
                            <span
                              className="msg-time-wrap"
                              data-tooltip={new Date(msg.timestamp).toLocaleString()}
                            >
                              {formatTime(msg.timestamp)}
                            </span>
                          </div>
                        )}
                        {compact && (
                          <span
                            className="msg-time-inline msg-time-wrap"
                            data-tooltip={new Date(msg.timestamp).toLocaleString()}
                          >
                            {formatTime(msg.timestamp)}
                          </span>
                        )}
                        <p className="dm-msg-text">{msg.text}</p>
                        {fromSelf && (
                          <div className="dm-ack" aria-label="Delivery status">
                            {msg.readAt ? (
                              <span className="ack-read">Read</span>
                            ) : msg.deliveredAt ? (
                              <span className="ack-delivered">Delivered</span>
                            ) : (
                              <span className="ack-sent">Sent</span>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.article>
                  );
                })}

              <AnimatePresence>
                {!activeDmUser && typingNamesGeneral.length > 0 && (
                  <TypingIndicator key="tg" names={typingNamesGeneral} />
                )}
                {activeDmUser && typingNamesDm.length > 0 && (
                  <TypingIndicator key="td" names={typingNamesDm} />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>

        <form
          className="composer glass-composer"
          onSubmit={submitMessage}
          onBlur={() => {
            flushTyping();
          }}
        >
          <input
            placeholder={
              activeDmUser ? `Message @${activeDmUser.username}` : "Message #general"
            }
            value={composer}
            onChange={handleComposerChange}
          />
          <RippleButton type="submit">Send</RippleButton>
        </form>
      </section>

      <aside className="right-rail custom-scroll">
        <div className="voice-activity glass">
          <h4>Voice</h4>
          {voice?.mode === "incoming" && voice.peer && (
            <p className="voice-hint">Incoming call from {voice.peer.username}</p>
          )}
          {(voice?.mode === "active" || voice?.mode === "outgoing") && voice.peer && (
            <p className="voice-hint">
              {voice.mode === "outgoing" ? "Calling" : "In call with"} {voice.peer.username}
            </p>
          )}
          {(!voice || voice.mode === "idle") && (
            <p className="voice-hint muted">No active call. Use Call in a DM to start WebRTC.</p>
          )}
        </div>
        <div className="tips-card glass">
          <h4>Shortcuts</h4>
          <ul>
            <li>
              <kbd>Enter</kbd> send
            </li>
            <li>Scroll up to load older messages</li>
            <li>Hover a message for reactions</li>
          </ul>
        </div>
      </aside>

      <AnimatePresence>
        {notificationsOpen && (
          <motion.aside
            className="notification-drawer glass"
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <header className="notif-head">
              <h3>Notifications</h3>
              <button type="button" className="icon-btn" onClick={() => setNotificationsOpen(false)}>
                ×
              </button>
            </header>
            {notificationUnread > 0 && (
              <div className="notif-actions">
                <button type="button" className="link-btn" onClick={() => onNotificationReadAll?.()}>
                  Mark all read
                </button>
              </div>
            )}
            <div className="notif-list custom-scroll">
              {notifications.length === 0 && <p className="muted small pad">No notifications.</p>}
              {notifications.map((n) => (
                <motion.button
                  key={n.id}
                  type="button"
                  className={`notif-item ${n.read ? "read" : ""}`}
                  onClick={() => {
                    if (!n.read) onNotificationRead?.(n.id);
                  }}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="notif-title">{n.title}</span>
                  <span className="notif-body">{n.body}</span>
                  <span className="notif-time">{formatRelativeTime(n.createdAt)}</span>
                </motion.button>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <audio ref={voice?.remoteAudioRef} autoPlay playsInline className="hidden-audio" />

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} wide>
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          compactBlur={compactBlur}
          setCompactBlur={setCompactBlur}
          reduceMotion={reduceMotion}
          setReduceMotion={setReduceMotion}
          theme={theme}
          setTheme={setTheme}
          me={me}
          onLogout={() => {
            setSettingsOpen(false);
            onLogout();
          }}
        />
      </Modal>

      <UserProfilePopover
        open={!!profileUser}
        onClose={() => setProfileUser(null)}
        user={profileUser}
        onlineUsers={onlineUsers}
      />

      <AnimatePresence>
        {hoverCard && (
          <motion.div
            className="hover-card-portal"
            style={{ position: "fixed", left: hoverCard.x, top: hoverCard.y, zIndex: 50 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <UserHoverCard user={hoverCard.user} />
          </motion.div>
        )}
      </AnimatePresence>

      {voice?.mode === "incoming" && voice.peer && (
        <div className="voice-modal-overlay">
          <motion.div
            className="voice-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="voice-avatar">{voice.peer.username?.charAt(0).toUpperCase()}</div>
            <h3>{voice.peer.username}</h3>
            <p>Incoming voice call</p>
            <div className="voice-modal-actions">
              <RippleButton type="button" className="btn-decline" onClick={voice.declineIncoming}>
                Decline
              </RippleButton>
              <RippleButton type="button" className="btn-accept" onClick={voice.acceptIncoming}>
                Accept
              </RippleButton>
            </div>
          </motion.div>
        </div>
      )}

      {(voice?.mode === "active" || voice?.mode === "outgoing") && voice.peer && (
        <motion.div
          className={`voice-bar ${voice.mode === "outgoing" ? "calling" : ""}`}
          initial={{ y: 80 }}
          animate={{ y: 0 }}
        >
          <span className="voice-bar-icon">📞</span>
          <div className="voice-bar-text">
            <strong>{voice.peer.username}</strong>
            <span>
              {voice.mode === "active"
                ? voice.formatDuration(voice.duration)
                : voice.mode === "outgoing"
                  ? "Ringing…"
                  : ""}
            </span>
          </div>
          <RippleButton type="button" className="voice-mute" onClick={voice.toggleMute}>
            {voice.muted ? "🔇" : "🎙"}
          </RippleButton>
          <RippleButton type="button" className="voice-hangup" onClick={() => voice.endCall(voice.peer.id)}>
            End
          </RippleButton>
        </motion.div>
      )}
    </div>
  );
}
