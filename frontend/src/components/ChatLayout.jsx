import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../context/ToastContext";
import { useMobile } from "../hooks/useMobile";
import { useProfileCustomization } from "../hooks/useProfileCustomization";
import TypingIndicator from "./chat/TypingIndicator";
import SettingsPanel from "./settings/SettingsPanel";
import ProfileCustomizationPanel from "./profile/ProfileCustomizationPanel";
import VideoConference from "./VideoConference";
import UserHoverCard from "./social/UserHoverCard";
import UserProfilePopover from "./social/UserProfilePopover";
import RippleButton from "./ui/RippleButton";
import { Avatar } from "./ui/Avatar";
import Modal from "./ui/Modal";
import { uploadFile } from "../api/media";
import { getMediaUrl } from "../api/media";
// Modern Group API
import { getMyGroups, createGroup, sendGroupMessage, getGroupMessages, leaveGroup, renameGroup, inviteToGroup } from "../api/groups";
import {
  MessageSquare, Users, UserPlus, Bell, Circle,
  PanelLeftClose, Settings, Send, Paperclip,
  Phone, Video, X, Plus, Clock, Check, CheckCheck,
  Mic, MicOff, Camera, CameraOff, Monitor, PhoneOff,
  Search, LogOut, Volume2, VolumeX, Maximize2, Grid,
  ChevronLeft, ChevronRight, MoreVertical, Trash2,
  Menu, Palette, Sparkles, User
} from "lucide-react";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function StatusBadge({ status = "offline" }) {
  return <span className={`status-dot ${status}`} title={status} />;
}

function formatTime(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

function formatRelativeTime(iso) {
  if (!iso) return "";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "Just now";
    if (diff < 3600_000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(iso).toLocaleDateString();
  } catch { return ""; }
}

function groupDmRows(messages) {
  if (!messages || !Array.isArray(messages)) return [];
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

function MediaMessage({ media, onOpenLightbox }) {
  const url = getMediaUrl(media.url);
  if (media.mediaType === "image") {
    return (
      <div className="dm-media-wrap">
        <img
          src={url}
          alt={media.originalName || "image"}
          className="dm-media-img"
          loading="lazy"
          onClick={() => onOpenLightbox(url)}
        />
      </div>
    );
  }
  if (media.mediaType === "video") {
    return (
      <div className="dm-media-wrap">
        <video
          src={url}
          className="dm-media-video"
          controls
          preload="metadata"
        />
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="dm-media-file">
      📎 {media.originalName || "file"}
    </a>
  );
}

function Lightbox({ url, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      className="lightbox-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <img src={url} alt="" className="lightbox-img" onClick={(e) => e.stopPropagation()} />
      <button type="button" className="lightbox-close" onClick={onClose}>✕</button>
    </motion.div>
  );
}

function CallBar({ call, peerScreenSharing, onMinimize }) {
  const [minimized, setMinimized] = useState(false);

  if (!call || call.mode === null) return null;

  if (call.mode === "incoming" && call.peer) {
    return (
      <div className="voice-modal-overlay">
        <motion.div className="voice-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="voice-avatar">{call.peer.username?.charAt(0).toUpperCase()}</div>
          <h3>{call.peer.username}</h3>
          <p>Incoming {call.callType === "video" ? "video" : "voice"} call</p>
          <div className="voice-modal-actions">
            <RippleButton type="button" className="btn-decline" onClick={call.declineIncoming}>Decline</RippleButton>
            <RippleButton type="button" className="btn-accept" onClick={call.acceptIncoming}>Accept</RippleButton>
          </div>
        </motion.div>
      </div>
    );
  }

  if ((call.mode === "active" || call.mode === "outgoing") && call.peer) {
    if (minimized) {
      // Minimized floating button
      return (
        <motion.div 
          className="call-minimized-btn" 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setMinimized(false)}
        >
          <div className="minimized-avatar">
            <Avatar name={call.peer.username} size={40} imageUrl={call.peer.avatarUrl} />
            <span className="minimized-pulse" />
          </div>
          <span className="minimized-duration">{call.formatDuration(call.duration)}</span>
          <span className="minimized-expand">↗</span>
        </motion.div>
      );
    }

    // Fullscreen call modal
    return (
      <div className="call-fullscreen-overlay">
        <motion.div 
          className="call-fullscreen"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          {/* Header */}
          <div className="call-fullscreen-header">
            <div className="call-header-info">
              <Avatar name={call.peer.username} size={48} imageUrl={call.peer.avatarUrl} />
              <div>
                <h3>{call.peer.username}</h3>
                <span className="call-status">
                  {call.mode === "active"
                    ? call.formatDuration(call.duration)
                    : "Ringing…"}
                </span>
                {peerScreenSharing && <span className="screen-indicator">🖥 Sharing screen</span>}
                {call.connectionQuality === "poor" && <span className="quality-warn">⚠ Weak connection</span>}
              </div>
            </div>
            <button 
              className="call-minimize-btn" 
              onClick={() => setMinimized(true)}
              title="Minimize call"
            >
              <Minimize2 size={20} />
            </button>
          </div>

          {/* Video area */}
          {call.callType === "video" && (
            <div className="call-fullscreen-video">
              <video 
                ref={call.remoteVideoRef} 
                autoPlay 
                playsInline 
                className="call-remote-video"
              />
              {call.cameraOn && (
                <div className="call-pip-video">
                  <video 
                    ref={call.localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="call-local-video"
                  />
                </div>
              )}
              {peerScreenSharing && (
                <div className="call-screen-share">
                  <video 
                    ref={call.screenVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="call-screen-video"
                  />
                </div>
              )}
            </div>
          )}

          {/* Voice-only visualization */}
          {call.callType === "voice" && (
            <div className="call-fullscreen-voice">
              <div className="voice-visualizer">
                <div className="voice-avatar-large">
                  <Avatar name={call.peer.username} size={120} imageUrl={call.peer.avatarUrl} />
                </div>
                <div className="voice-waves">
                  <span className="wave" />
                  <span className="wave" />
                  <span className="wave" />
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="call-fullscreen-controls">
            <RippleButton 
              type="button" 
              className={`call-control-btn ${call.muted ? "muted" : ""}`} 
              onClick={call.toggleMute}
            >
              {call.muted ? <MicOff size={24} /> : <Mic size={24} />}
              <span>{call.muted ? "Unmute" : "Mute"}</span>
            </RippleButton>
            
            {call.callType === "video" && (
              <RippleButton 
                type="button" 
                className={`call-control-btn ${call.cameraOn ? "active" : ""}`} 
                onClick={call.toggleCamera}
              >
                {call.cameraOn ? <CameraOff size={24} /> : <Camera size={24} />}
                <span>{call.cameraOn ? "Camera off" : "Camera on"}</span>
              </RippleButton>
            )}
            
            <RippleButton 
              type="button" 
              className={`call-control-btn ${call.screenSharing ? "active" : ""}`} 
              onClick={call.screenSharing ? call.stopScreenShare : call.startScreenShare}
            >
              <Monitor size={24} />
              <span>{call.screenSharing ? "Stop sharing" : "Share screen"}</span>
            </RippleButton>
            
            <RippleButton 
              type="button" 
              className="call-control-btn hangup" 
              onClick={() => call.endCall(call.peer.id)}
            >
              <PhoneOff size={24} />
              <span>End call</span>
            </RippleButton>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}

// Add subtle animations
function AnimatedSidebar({ children, isOpen }) {
  return (
    <motion.aside
      className={`sidebar glass ${!isOpen ? "collapsed" : ""}`}
      initial={{ width: isOpen ? 240 : 60 }}
      animate={{ width: isOpen ? 240 : 60 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
    </motion.aside>
  );
}

function AnimatedMessage({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
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
  notifications = [],
  activeDmUser,
  dmMessages,
  dmUnread = {},
  dmByUserId = {},
  typingDmUser,
  onOpenDm,
  onSendDm,
  socket,
  onSendDmMedia,
  onSendFriendRequest,
  onAcceptFriend,
  onDeclineFriend,
  onRemoveFriend,
  onLogout,
  onStatusChange,
  friendNotice,
  call,
  onTypingDmStart,
  onTypingDmStop,
  loadOlderDm,
  dmHasMore,
  loadingOlderDm,
  onNotificationRead,
  onNotificationReadAll,
  peerScreenSharing,
  groupCall,
  onClearDm,
  myGroups,
  setMyGroups,
}) {
  const { toast } = useToast();
  const [composer, setComposer] = useState("");
  const [friendUsername, setFriendUsername] = useState("");
  const [sidebarView, setSidebarView] = useState("dms");
  const [friendFilter, setFriendFilter] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [hoverCard, setHoverCard] = useState(null);
  const [compactBlur, setCompactBlur] = useState(14);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("descall_theme") || "dark"; } catch { return "dark"; }
  });
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  // ========== MODERN GROUP SYSTEM ==========
  const [groups, setGroups] = useState({
    list: [],
    active: null,
    messages: [],
    call: {
      minimized: false,
    },
    ui: {
      createOpen: false,
      renameOpen: false,
      inviteOpen: false,
      newGroupName: "",
      selectedMembers: [],
      renameValue: "",
      inviteUsername: "",
      groupComposer: "",
    }
  });
  // ========== MOBILE & CUSTOMIZATION ==========
  const { isMobile, isPortrait, touchSupported, vibrate } = useMobile();
  const profileCustomization = useProfileCustomization();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeMobileView, setActiveMobileView] = useState("dms"); // "dms", "groups", "calls", "profile"
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const fileInputRef = useRef(null);
  const groupsList = asArray(groups.list);
  const groupsMessages = asArray(groups.messages);

  const messagesRef = useRef(null);
  const typingTimerRef = useRef(null);
  const wasTypingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => { document.documentElement.toggleAttribute("data-reduce-motion", reduceMotion); }, [reduceMotion]);
  useEffect(() => { document.documentElement.style.setProperty("--glass-blur", `${compactBlur}px`); }, [compactBlur]);
  useEffect(() => {
    try { localStorage.setItem("descall_theme", theme); } catch {}
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => { scrollToBottom(); }, [activeDmUser, scrollToBottom]);

  // ========== MODERN GROUP SYSTEM ==========
  
  // Fetch groups on mount
  useEffect(() => {
    if (!me) return;
    getMyGroups()
      .then((data) => {
        const normalized =
          Array.isArray(data) ? data :
          Array.isArray(data?.groups) ? data.groups :
          [];
        setGroups((g) => ({ ...g, list: normalized }));
      })
      .catch(() => setGroups(g => ({ ...g, list: [] })));
  }, [me]);

  // Socket event listeners for groups
  useEffect(() => {
    if (!socket) return;

    // Real-time group messages
    const onGroupMessage = ({ groupId, message }) => {
      if (groupId === groups.active?.id) {
        setGroups(g => ({
          ...g,
          messages: [...(g.messages || []).filter(m => m.id !== message.id), message]
        }));
      }
    };

    // Call ended
    const onCallEnded = () => {
      setGroups((g) => ({ ...g, call: { ...g.call, minimized: false } }));
    };

    socket.on("group:message", onGroupMessage);
    socket.on("group:call:left", onCallEnded);
    socket.on("group:call:ended", onCallEnded);

    return () => {
      socket.off("group:message", onGroupMessage);
      socket.off("group:call:left", onCallEnded);
      socket.off("group:call:ended", onCallEnded);
    };
  }, [socket, groups.active?.id, groupsList]);

  useEffect(() => {
    if (groupCall?.isInCall) return;
    setGroups((g) => ({ ...g, call: { ...g.call, minimized: false } }));
  }, [groupCall?.isInCall]);

  // Keep socket subscribed to all my group rooms for live messages/calls.
  useEffect(() => {
    if (!socket) return;
    const ids = groupsList.map((g) => g?.id).filter(Boolean);
    ids.forEach((id) => socket.emit("group:join", id));
    return () => {
      ids.forEach((id) => socket.emit("group:leave", id));
    };
  }, [socket, groupsList]);

  // Group actions
  const groupActions = {
    // Open group
    open: async (group) => {
      console.log("[ChatLayout] Opening group:", group);
      // Clear active DM when opening a group
      onClearDm?.();
      setGroups(g => ({ ...g, active: group }));
      // Also save to localStorage
      try {
        localStorage.setItem("descall_active_group", JSON.stringify({ id: group.id, name: group.name }));
      } catch {}
      try {
        const result = await getGroupMessages(group.id);
        console.log("[ChatLayout] Group messages loaded:", result);
        setGroups(g => ({ ...g, messages: result?.messages || [] }));
      } catch (err) {
        console.error("[ChatLayout] Failed to load group messages:", err);
        setGroups(g => ({ ...g, messages: [] }));
      }
      // Socket join handled by useGroupCall hook
    },

    // Send message
    sendMessage: async (text) => {
      if (!text?.trim() || !groups.active) return;
      try {
        const result = await sendGroupMessage(groups.active.id, { content: text });
        if (result?.message) {
          setGroups(g => ({ ...g, messages: [...g.messages, result.message] }));
        }
      } catch (err) {
        toast?.error?.("Failed to send message");
      }
    },

    // Create group
    create: async (e) => {
      e?.preventDefault();
      const { newGroupName, selectedMembers } = groups.ui;
      const members = asArray(selectedMembers);
      if (!newGroupName?.trim() || members.length === 0) {
        toast?.error?.("Please enter a group name and select at least one member");
        return;
      }
      try {
        const result = await createGroup({
          name: newGroupName.trim(),
          memberIds: members,
        });
        setGroups(g => ({
          ...g,
          list: [result.group, ...g.list],
          ui: { ...g.ui, createOpen: false, newGroupName: "", selectedMembers: [] }
        }));
        toast?.success?.("Group created!");
      } catch (err) {
        toast?.error?.(err.message || "Failed to create group");
      }
    },

    // Leave group
    leave: async (groupId) => {
      if (!confirm("Leave this group?")) return;
      try {
        await leaveGroup(groupId);
        setGroups(g => ({
          ...g,
          list: (g.list || []).filter(grp => grp.id !== groupId),
          active: g.active?.id === groupId ? null : g.active
        }));
        toast?.success?.("Left group");
      } catch (err) {
        toast?.error?.(err.message || "Failed to leave group");
      }
    },

    // Rename group
    rename: async (e) => {
      e?.preventDefault();
      const { renameValue } = groups.ui;
      if (!renameValue?.trim() || !groups.active) return;
      try {
        await renameGroup(groups.active.id, renameValue.trim());
        setGroups(g => ({
          ...g,
          list: g.list.map(grp =>
            grp.id === groups.active.id ? { ...grp, name: renameValue.trim() } : grp
          ),
          active: g.active ? { ...g.active, name: renameValue.trim() } : null,
          ui: { ...g.ui, renameOpen: false, renameValue: "" }
        }));
        toast?.success?.("Group renamed!");
      } catch (err) {
        toast?.error?.(err.message || "Failed to rename group");
      }
    },

    // Invite to group
    invite: async (e) => {
      e?.preventDefault();
      const { inviteUsername } = groups.ui;
      if (!inviteUsername?.trim() || !groups.active) return;
      try {
        await inviteToGroup(groups.active.id, inviteUsername.trim());
        setGroups(g => ({ ...g, ui: { ...g.ui, inviteOpen: false, inviteUsername: "" } }));
        toast?.success?.("Friend invited!");
      } catch (err) {
        toast?.error?.(err.message || "Failed to invite");
      }
    },

    // Update UI state
    setUI: (updates) => setGroups(g => ({ ...g, ui: { ...g.ui, ...updates } })),
    
    // Toggle call minimized
    toggleMinimized: () => setGroups(g => ({ ...g, call: { ...g.call, minimized: !g.call.minimized } })),
  };


  const sortedFriends = useMemo(() => [...friends].sort((a, b) => a.username.localeCompare(b.username)), [friends]);
  const filteredFriends = useMemo(() => {
    const q = friendFilter.trim().toLowerCase();
    if (!q) return sortedFriends;
    return (sortedFriends || []).filter((f) => f.username.toLowerCase().includes(q));
  }, [sortedFriends, friendFilter]);

  const dmList = useMemo(() => {
    return friends
      .map((f) => {
        const list = dmByUserId[f.id] || [];
        const last = list.length ? list[list.length - 1] : null;
        return {
          friend: f,
          unread: dmUnread[f.id] || 0,
          preview: last?.text ?? (last?.media ? `📎 ${last.media.originalName || "media"}` : ""),
          timeLabel: last ? formatRelativeTime(last.timestamp) : "",
          sortKey: last ? new Date(last.timestamp).getTime() : 0,
        };
      })
      .sort((a, b) => {
        if (b.unread !== a.unread) return b.unread - a.unread;
        return b.sortKey - a.sortKey;
      });
  }, [friends, dmUnread, dmByUserId]);

  const dmGrouped = useMemo(() => groupDmRows(dmMessages), [dmMessages]);

  const notificationUnread = useMemo(() => (notifications || []).filter((n) => !n.read).length, [notifications]);
  const totalDmUnread = useMemo(() => Object.values(dmUnread).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0), [dmUnread]);
  const globalUnread = totalDmUnread + notificationUnread;

  const flushTyping = useCallback(() => {
    if (wasTypingRef.current) {
      if (activeDmUser) onTypingDmStop?.(activeDmUser.id);
      wasTypingRef.current = false;
    }
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
  }, [activeDmUser, onTypingDmStop]);

  useEffect(() => () => flushTyping(), [flushTyping]);

  const handleMessagesScroll = (e) => {
    const el = e.target;
    if (el.scrollTop < 100 && activeDmUser && !loadingOlderDm && dmHasMore) loadOlderDm?.();
  };

  const handleComposerChange = (e) => {
    const v = e.target.value;
    setComposer(v);
    if (!wasTypingRef.current && activeDmUser) {
      wasTypingRef.current = true;
      onTypingDmStart?.(activeDmUser.id);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => flushTyping(), 1800);
  };

  const submitMessage = (event) => {
    event.preventDefault();
    const text = composer.trim();
    if (!text || !activeDmUser) return;
    flushTyping();
    onSendDm(activeDmUser.id, text);
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeDmUser) return;
    try {
      setUploading(true);
      const result = await uploadFile(file);
      onSendDmMedia(activeDmUser.id, {
        url: result.url,
        mediaType: result.mediaType,
        mimeType: result.mimeType,
        size: result.size,
        originalName: result.originalName,
      });
      requestAnimationFrame(() => scrollToBottom());
    } catch (err) {
      toast(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const inCall = call?.mode === "active" || call?.mode === "outgoing";
  const isOnline = connectionLabel === "Online";
  const typingNamesDm = typingDmUser ? [typingDmUser.username] : [];

  return (
    <div className={`app-root app-root-enhanced ${isMobile ? "mobile-view" : ""}`}>
      {/* Desktop Sidebar - Hidden on Mobile */}
      {!isMobile && (
        <>
          <nav className="nav-rail" aria-label="Main">
            <motion.button type="button" className={`rail-btn ${sidebarView === "dms" ? "active" : ""}`} title="Direct messages" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setSidebarView("dms")}>
              <MessageSquare size={22} />
            </motion.button>
            <motion.button type="button" className={`rail-btn ${sidebarView === "groups" ? "active" : ""}`} title="Groups" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setSidebarView("groups")}>
              <Users size={22} />
            </motion.button>
            <motion.button type="button" className={`rail-btn ${sidebarView === "friends" ? "active" : ""}`} title="Friends" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setSidebarView("friends")}>
              <UserPlus size={22} />
            </motion.button>
            <motion.button type="button" className={`rail-btn ${notificationsOpen ? "active" : ""}`} title="Notifications" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setNotificationsOpen((o) => !o)}>
              <Bell size={22} />
              {globalUnread > 0 && <span className="rail-badge">{globalUnread > 99 ? "99+" : globalUnread}</span>}
            </motion.button>
            <motion.button type="button" className={`rail-btn ${sidebarView === "online" ? "active" : ""}`} title="Online" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setSidebarView("online")}>
              <Circle size={10} fill="currentColor" />
            </motion.button>
            <div className="rail-spacer" />
            <motion.button type="button" className="rail-btn subtle" title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setSidebarOpen((o) => !o)}>
              <PanelLeftClose size={20} />
            </motion.button>
            <motion.button type="button" className="rail-btn subtle" title="Settings" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setSettingsOpen(true)}>
              <Settings size={20} />
            </motion.button>
          </nav>

          <motion.aside
            className="sidebar-secondary"
            initial={false}
            animate={{ width: sidebarOpen ? 300 : 0 }}
            transition={{ type: "tween", duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
        <div className="sidebar-inner">
          <div className="sidebar-brand">
            <span className="brand-mark">Descall</span>
            <span className={`conn-pill ${isOnline ? "on" : "off"}`}>{connectionLabel}</span>
          </div>
          {authError && reconnectState !== "connected" && <div className="sidebar-error">{authError}</div>}

          {sidebarView === "dms" && (
            <div className="sidebar-section grow">
              <h4>Direct messages</h4>
              <div className="scroll-list custom-scroll">
                {(dmList || []).map(({ friend, unread, preview, timeLabel }) => (
                  <motion.button
                    key={friend.id}
                    type="button"
                    className={`dm-item ${activeDmUser?.id === friend.id ? "active" : ""}`}
                    onClick={() => { setGroups(g => ({ ...g, active: null })); try { localStorage.removeItem("descall_active_group"); } catch {}; onOpenDm(friend); }}
                    whileHover={{ x: 2 }}
                  >
                    <Avatar name={friend.username} size={34} imageUrl={friend.avatarUrl} />
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
                {dmList.length === 0 && <p className="muted small">Add a friend to start a conversation.</p>}
              </div>
            </div>
          )}

          {sidebarView === "friends" && (
            <div className="sidebar-section grow">
              <h4>Add friend</h4>
              <form className="mini-form" onSubmit={submitFriendRequest}>
                <input placeholder="Username" value={friendUsername} onChange={(e) => setFriendUsername(e.target.value)} />
                <RippleButton type="submit" title="Send request"><Plus size={18} /></RippleButton>
              </form>
              <input className="filter-input" placeholder="Search friends..." value={friendFilter} onChange={(e) => setFriendFilter(e.target.value)} />
              <h4>Friends ({filteredFriends.length})</h4>
              <div className="scroll-list custom-scroll">
                {(filteredFriends || []).map((friend) => (
                  <div
                    key={friend.id}
                    className="friend-row"
                    onMouseEnter={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setHoverCard({ user: friend, x: Math.min(r.right + 8, window.innerWidth - 280), y: r.top });
                    }}
                    onMouseLeave={() => setHoverCard(null)}
                  >
                    <button type="button" className="list-item" onClick={() => onOpenDm(friend)}>
                      <StatusBadge status={friend.status} />
                      <span className="friend-name">{friend.username}</span>
                    </button>
                    <div className="friend-actions">
                      <button type="button" className="icon-btn" title="Voice call" disabled={inCall} onClick={() => call?.startCall(friend, "voice")}><Phone size={16} /></button>
                      <button type="button" className="icon-btn" title="Video call" disabled={inCall} onClick={() => call?.startCall(friend, "video")}><Video size={16} /></button>
                      <button type="button" className="icon-btn" title="DM" onClick={() => onOpenDm(friend)}><MessageSquare size={16} /></button>
                      <button type="button" className="icon-btn danger" title="Remove" onClick={() => onRemoveFriend(friend.id)}><X size={16} /></button>
                    </div>
                  </div>
                ))}
                {filteredFriends.length === 0 && <p className="muted small">No friends match your search.</p>}
              </div>
            </div>
          )}

          {sidebarView === "groups" && (
            <div className="sidebar-section grow">
              <div className="sidebar-section-header">
                <h4>Groups ({groupsList.length})</h4>
                <button 
                  className="btn-icon"
                  onClick={() => groupActions.setUI({ createOpen: true })}
                  title="Create group"
                >
                  <Plus size={20} />
                </button>
              </div>
              <div className="scroll-list custom-scroll">
                {groupsList.length === 0 ? (
                  <div className="empty-state">
                    <p className="muted">No groups yet</p>
                    <button className="btn-secondary" onClick={() => groupActions.setUI({ createOpen: true })}>
                      Create your first group
                    </button>
                  </div>
                ) : (
                  groupsList.map((group) => (
                    <motion.button
                      key={group.id}
                      type="button"
                      className={`dm-item ${groups.active?.id === group.id ? "active" : ""}`}
                      onClick={() => groupActions.open(group)}
                      whileHover={{ x: 2 }}
                    >
                      <div className="dm-avatar">
                        {group.avatar_url ? (
                          <img src={group.avatar_url} alt={group.name} />
                        ) : (
                          <div className="avatar-fallback">{group.name.charAt(0).toUpperCase()}</div>
                        )}
                      </div>
                      <div className="dm-meta">
                        <div className="dm-name-row">
                          <span className="dm-name">{group.name}</span>
                          {group.unread > 0 && <span className="dm-badge">{group.unread}</span>}
                        </div>
                        <div className="dm-preview">
                          {group.last_message?.content || "No messages yet"}
                        </div>
                      </div>
                    </motion.button>
                  ))
                )}
              </div>
            </div>
          )}

          {sidebarView === "online" && (
            <div className="sidebar-section grow">
              <h4>Online ({onlineUsers.length})</h4>
              <div className="scroll-list custom-scroll">
                {(onlineUsers || []).map((user) => (
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
            {(friendRequests || []).map((req) => (
              <div key={req.id} className="request-row compact-req">
                <span>{req.username}</span>
                <div>
                  <RippleButton type="button" className="btn-mini ok" onClick={() => onAcceptFriend(req.id)}>Accept</RippleButton>
                  <RippleButton type="button" className="btn-mini no" onClick={() => onDeclineFriend(req.id)}>Decline</RippleButton>
                </div>
              </div>
            ))}
          </div>

          {friendNotice && <div className="notice-banner">{friendNotice}</div>}

          <div className="user-bar" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="user-avatar-wrap" onClick={() => setProfileUser({ username: me.username, userId: me.id, avatarUrl: me.avatarUrl })}>
              <Avatar name={me.username} size={36} imageUrl={me.avatarUrl} />
            </button>
            <div className="user-meta">
              <div className="user-name">{me.username}</div>
              <select value={myStatus} onChange={(e) => onStatusChange(e.target.value)} className="status-mini">
                <option value="online">Online</option>
                <option value="idle">Idle</option>
                <option value="dnd">Do not disturb</option>
                <option value="invisible">Invisible</option>
              </select>
            </div>
            <RippleButton type="button" className="logout-mini" onClick={onLogout}><LogOut size={16} /></RippleButton>
          </div>
        </div>
      </motion.aside>
        </>
      )}

      <section className="panel main-panel">
        <header className="panel-header glass-header">
          <div className="panel-title-wrap">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeDmUser ? `dm-${activeDmUser.id}` : groups.active ? `group-${groups.active.id}` : "empty"}
                className="panel-title-block"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
              >
                <strong className="panel-title">
                  {activeDmUser ? `@${activeDmUser.username}` : groups.active ? groups.active.name : "Descall"}
                </strong>
                <span className="panel-sub">
                  {activeDmUser ? "Direct message" : groups.active ? "Group chat" : "Select a conversation"}
                </span>
              </motion.div>
            </AnimatePresence>
            {activeDmUser && (
              <div className="header-call-btns">
                <RippleButton type="button" className="header-call" disabled={inCall} onClick={() => call?.startCall(activeDmUser, "voice")} title="Voice call">
                  <Phone size={18} />
                </RippleButton>
                <RippleButton type="button" className="header-call" disabled={inCall} onClick={() => call?.startCall(activeDmUser, "video")} title="Video call">
                  <Video size={18} />
                </RippleButton>
              </div>
            )}
            {groups.active && (
              <>
                {/* Call Buttons */}
                <div className="header-call-btns">
                  <RippleButton 
                    type="button" 
                    className="header-call-btn voice" 
                    disabled={inCall || !groupCall} 
                    onClick={() => groupCall?.startGroupCall?.(groups.active.id, "voice", (groups.active?.memberIds || []).filter((id) => id !== me?.id))} 
                    title="Group voice call"
                  >
                    <div className="call-btn-icon">
                      <Phone size={18} />
                    </div>
                    <span className="call-btn-label">Voice</span>
                  </RippleButton>
                  <RippleButton 
                    type="button" 
                    className="header-call-btn video" 
                    disabled={inCall || !groupCall} 
                    onClick={() => groupCall?.startGroupCall?.(groups.active.id, "video", (groups.active?.memberIds || []).filter((id) => id !== me?.id))} 
                    title="Group video call"
                  >
                    <div className="call-btn-icon">
                      <Video size={18} />
                    </div>
                    <span className="call-btn-label">Video</span>
                  </RippleButton>
                </div>

                {/* Group Management Actions */}
                <div className="header-group-actions">
                  <div className="group-actions-menu">
                    <RippleButton 
                      type="button" 
                      className="group-action-btn primary" 
                      onClick={() => groupActions.setUI({ inviteOpen: true })} 
                      title="Invite friend"
                    >
                      <div className="action-btn-content">
                        <div className="action-icon-wrapper invite">
                          <UserPlus size={16} />
                        </div>
                        <span className="action-label">Invite</span>
                      </div>
                    </RippleButton>
                    
                    <RippleButton 
                      type="button" 
                      className="group-action-btn secondary" 
                      onClick={() => { groupActions.setUI({ renameValue: groups.active.name, renameOpen: true }); }} 
                      title="Rename group"
                    >
                      <div className="action-btn-content">
                        <div className="action-icon-wrapper rename">
                          <Settings size={16} />
                        </div>
                        <span className="action-label">Rename</span>
                      </div>
                    </RippleButton>
                    
                    <RippleButton 
                      type="button" 
                      className="group-action-btn danger" 
                      onClick={() => groupActions.leave(groups.active.id)} 
                      title="Leave group"
                    >
                      <div className="action-btn-content">
                        <div className="action-icon-wrapper leave">
                          <LogOut size={16} />
                        </div>
                        <span className="action-label">Leave</span>
                      </div>
                    </RippleButton>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="panel-header-right">
            <span className={`connection-chip ${isOnline ? "online" : "reconnect"}`}>{connectionLabel}</span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={isMobile ? `mobile-${activeMobileView}` : activeDmUser ? `dm-${activeDmUser.id}` : groups.active ? `group-${groups.active.id}` : "empty"}
            className="messages-wrap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <div className="messages custom-scroll" ref={messagesRef} onScroll={handleMessagesScroll}>
              {loadingOlderDm && activeDmUser && <div className="load-older-banner">Loading older messages…</div>}

              {/* Mobile View Switcher */}
              {isMobile && activeMobileView === "dms" && !activeDmUser && !groups.active && (
                <motion.div className="mobile-view-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mobile-section">
                    <h4>Direct Messages</h4>
                    {(dmList || []).length === 0 ? (
                      <div className="empty-state glass">
                        <h4>No conversations yet</h4>
                        <p>Go to Friends to start chatting</p>
                      </div>
                    ) : (
                      <div className="mobile-list">
                        {(dmList || []).map(({ friend, unread, preview, timeLabel }) => (
                          <motion.button
                            key={friend.id}
                            className="mobile-list-item"
                            onClick={() => {
                              setGroups(g => ({ ...g, active: null }));
                              try { localStorage.removeItem("descall_active_group"); } catch {}
                              onOpenDm(friend);
                            }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Avatar name={friend.username} size={48} imageUrl={friend.avatarUrl} />
                            <div className="mobile-list-body">
                              <div className="mobile-list-top">
                                <span className="mobile-list-name">{friend.username}</span>
                                {timeLabel && <span className="mobile-list-time">{timeLabel}</span>}
                              </div>
                              <div className="mobile-list-preview">{preview || "No messages"}</div>
                            </div>
                            {unread > 0 && <span className="mobile-badge">{unread > 9 ? "9+" : unread}</span>}
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {isMobile && activeMobileView === "groups" && !groups.active && (
                <motion.div className="mobile-view-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mobile-section">
                    <div className="mobile-section-header">
                      <h4>Groups</h4>
                      <button className="mobile-fab" onClick={() => groupActions.setUI({ createOpen: true })}>
                        <Plus size={20} />
                      </button>
                    </div>
                    {(groupsList || []).length === 0 ? (
                      <div className="empty-state glass">
                        <h4>No groups yet</h4>
                        <p>Create a group to start chatting with multiple friends</p>
                      </div>
                    ) : (
                      <div className="mobile-list">
                        {(groupsList || []).map((group) => (
                          <motion.button
                            key={group.id}
                            className="mobile-list-item"
                            onClick={() => groupActions.open(group)}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="mobile-group-avatar">{group.name?.charAt(0).toUpperCase()}</div>
                            <div className="mobile-list-body">
                              <div className="mobile-list-top">
                                <span className="mobile-list-name">{group.name}</span>
                                <span className="mobile-list-time">{group.memberCount} members</span>
                              </div>
                              <div className="mobile-list-preview">Click to open group chat</div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {isMobile && activeMobileView === "calls" && (
                <motion.div className="mobile-view-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mobile-section">
                    <h4>Recent Calls</h4>
                    <div className="empty-state glass">
                      <Phone size={48} className="mobile-icon-muted" />
                      <h4>No recent calls</h4>
                      <p>Start a call from a DM or Group chat</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {isMobile && activeMobileView === "friends" && (
                <motion.div className="mobile-view-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mobile-section">
                    <div className="mobile-section-header">
                      <h4>Friends</h4>
                    </div>
                    <form className="mobile-search-form" onSubmit={submitFriendRequest}>
                      <input 
                        className="mobile-search-input" 
                        placeholder="Add friend by username..." 
                        value={friendUsername} 
                        onChange={(e) => setFriendUsername(e.target.value)} 
                      />
                      <button type="submit" className="mobile-fab">
                        <Plus size={20} />
                      </button>
                    </form>
                    {(filteredFriends || []).length === 0 ? (
                      <div className="empty-state glass">
                        <UserPlus size={48} className="mobile-icon-muted" />
                        <h4>No friends yet</h4>
                        <p>Add friends to start chatting</p>
                      </div>
                    ) : (
                      <div className="mobile-list">
                        {(filteredFriends || []).map((friend) => (
                          <motion.div
                            key={friend.id}
                            className="mobile-friend-item"
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="mobile-friend-info" onClick={() => onOpenDm(friend)}>
                              <StatusBadge status={friend.status} />
                              <span className="mobile-friend-name">{friend.username}</span>
                            </div>
                            <div className="mobile-friend-actions">
                              <button className="mobile-icon-btn" onClick={() => call?.startCall(friend, "voice")}>
                                <Phone size={16} />
                              </button>
                              <button className="mobile-icon-btn" onClick={() => call?.startCall(friend, "video")}>
                                <Video size={16} />
                              </button>
                              <button className="mobile-icon-btn danger" onClick={() => onRemoveFriend(friend.id)}>
                                <X size={16} />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {!isMobile && !activeDmUser && !groups.active && (
                <motion.div className="empty-state glass" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                  <h4>Welcome to Descall</h4>
                  <p>Select a friend or start a new conversation to begin messaging.</p>
                </motion.div>
              )}

              {activeDmUser && dmMessages.length === 0 && (
                <motion.div className="empty-state glass" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                  <h4>Conversation with {activeDmUser.username}</h4>
                  <p>No messages yet. Say hello or share a file.</p>
                </motion.div>
              )}

              {activeDmUser && (dmGrouped || []).map(({ msg, compact }) => {
                const fromSelf = msg.from?.id === me.id;
                return (
                  <motion.article
                    key={msg.id}
                    className={`dm-msg ${fromSelf ? "own" : ""} ${compact ? "dm-compact" : ""}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {!compact ? (
                      <button type="button" className="dm-msg-avatar" onClick={() => setProfileUser({ username: msg.from?.username ?? "?", userId: msg.from?.id, avatarUrl: msg.from?.avatarUrl })}>
                        <Avatar name={msg.from?.username ?? "?"} size={36} imageUrl={msg.from?.avatarUrl} />
                      </button>
                    ) : (
                      <div className="msg-avatar-spacer sm" aria-hidden />
                    )}
                    <div>
                      {!compact && (
                        <div className="msg-meta-line">
                          <strong>{msg.from?.username ?? "?"}</strong>
                          <span className="msg-time-wrap" data-tooltip={new Date(msg.timestamp).toLocaleString()}>
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                      )}
                      {compact && (
                        <span className="msg-time-inline msg-time-wrap" data-tooltip={new Date(msg.timestamp).toLocaleString()}>
                          {formatTime(msg.timestamp)}
                        </span>
                      )}
                      {msg.media && <MediaMessage media={msg.media} onOpenLightbox={setLightboxUrl} />}
                      {msg.text && <p className="dm-msg-text">{msg.text}</p>}
                      {fromSelf && (
                        <div className="dm-ack" aria-label="Delivery status">
                          {msg.readAt ? <span className="ack-read">Read</span> : msg.deliveredAt ? <span className="ack-delivered">Delivered</span> : <span className="ack-sent">Sent</span>}
                        </div>
                      )}
                    </div>
                  </motion.article>
                );
              })}

              <AnimatePresence>
                {activeDmUser && typingNamesDm.length > 0 && <TypingIndicator key="td" names={typingNamesDm} />}
              </AnimatePresence>

              {/* Group Messages */}
              {groups.active && groupsMessages.length === 0 && (
                <motion.div className="empty-state glass" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                  <h4>Group: {groups.active.name}</h4>
                  <p>No messages yet. Start the conversation!</p>
                </motion.div>
              )}

              {groups.active && groupsMessages.map((msg) => {
                const fromSelf = msg.sender?.id === me?.id;
                return (
                  <motion.article
                    key={msg.id}
                    className={`dm-msg ${fromSelf ? "own" : ""}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <button type="button" className="dm-msg-avatar" onClick={() => setProfileUser({ username: msg.sender?.username ?? "?", userId: msg.sender?.id })}>
                      <Avatar name={msg.sender?.username ?? "?"} size={36} />
                    </button>
                    <div>
                      <div className="msg-meta-line">
                        <span className="msg-author">{msg.sender?.username}</span>
                        <span className="msg-time msg-time-wrap" data-tooltip={new Date(msg.created_at).toLocaleString()}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                      <p className="dm-msg-text">{msg.content}</p>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* DM Composer */}
        {activeDmUser && (
          <form
            className={`composer glass-composer ${inCall ? "composer-dimmed" : ""}`}
            onSubmit={submitMessage}
            onBlur={() => flushTyping()}
          >
            <input
              placeholder={`Message @${activeDmUser.username}`}
              value={composer}
              onChange={handleComposerChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              className="hidden-file-input"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <RippleButton type="button" className="attach-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach file">
              {uploading ? <Clock size={18} /> : <Paperclip size={18} />}
            </RippleButton>
            <RippleButton type="submit"><Send size={18} /></RippleButton>
          </form>
        )}

        {/* Group Composer */}
        {groups.active && (
          <form
            className={`composer glass-composer ${inCall ? "composer-dimmed" : ""}`}
            onSubmit={(e) => { e.preventDefault(); groupActions.sendMessage(groups.ui.groupComposer); groupActions.setUI({ groupComposer: "" }); }}
          >
            <input
              placeholder={`Message #${groups.active.name}`}
              value={groups.ui.groupComposer || ""}
              onChange={(e) => groupActions.setUI({ groupComposer: e.target.value })}
            />
            <RippleButton type="submit">Send</RippleButton>
          </form>
        )}
      </section>

      {/* Right Rail - Desktop Only */}
      {!isMobile && (
        <aside className="right-rail custom-scroll">
          <div className="voice-activity glass">
            <h4>Call</h4>
            {call?.mode === "incoming" && call.peer && <p className="voice-hint">Incoming {call.callType} call from {call.peer.username}</p>}
            {(call?.mode === "active" || call?.mode === "outgoing") && call.peer && (
              <p className="voice-hint">{call.mode === "outgoing" ? "Calling" : "In call with"} {call.peer.username} ({call.callType})</p>
            )}
            {call?.mode === null && <p className="voice-hint">No active call</p>}
          </div>
          <div className="tips-card glass">
            <h4>Shortcuts</h4>
            <ul>
              <li><kbd>Enter</kbd> send</li>
              <li>Scroll up to load older messages</li>
              <li>📎 button to share images/videos</li>
              <li>📹 for video call, 📞 for voice</li>
            </ul>
          </div>
        </aside>
      )}

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
              <button type="button" className="icon-btn" onClick={() => setNotificationsOpen(false)}>×</button>
            </header>
            {notificationUnread > 0 && (
              <div className="notif-actions">
                <button type="button" className="link-btn" onClick={() => onNotificationReadAll?.()}>Mark all read</button>
              </div>
            )}
            <div className="notif-list custom-scroll">
              {notifications.length === 0 && <p className="muted small pad">No notifications.</p>}
              {(notifications || []).map((n) => (
                <motion.button
                  key={n.id}
                  type="button"
                  className={`notif-item ${n.read ? "read" : ""}`}
                  onClick={() => { if (!n.read) onNotificationRead?.(n.id); }}
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

      <audio ref={call?.remoteAudioRef} autoPlay playsInline className="hidden-audio" />

      {/* Call UI - Fullscreen modal on both desktop and mobile */}
      <CallBar call={call} peerScreenSharing={peerScreenSharing} />

      <AnimatePresence>
        {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
      </AnimatePresence>

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
          onLogout={() => { setSettingsOpen(false); onLogout(); }}
        />
      </Modal>

      {/* Create Group Modal */}
      <Modal open={groups.ui.createOpen} onClose={() => groupActions.setUI({ createOpen: false })}>
        <div className="create-group-modal modern-modal">
          <div className="modal-header">
            <h3>Create Group</h3>
            <button type="button" className="modal-close" onClick={() => groupActions.setUI({ createOpen: false })}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={groupActions.create}>
            <label className="modern-field">
              <span>Group Name</span>
              <input
                type="text"
                value={groups.ui.newGroupName}
                onChange={(e) => groupActions.setUI({ newGroupName: e.target.value })}
                placeholder="Enter group name"
                maxLength={50}
                required
                className="modern-input"
              />
              <small className="char-count">{groups.ui.newGroupName.length}/50</small>
            </label>

            <div className="cg-members modern-members">
              <div className="members-header">
                <span>Select Members (max 15)</span>
                <small className="member-count">{groups.ui.selectedMembers.length}/14 friends selected</small>
              </div>
              <div className="cg-friends-list modern-friends-list">
                {(friends || []).map((friend) => (
                  <label key={friend.id} className="cg-friend-item modern-friend-item">
                    <input
                      type="checkbox"
                      checked={groups.ui.selectedMembers.includes(friend.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (groups.ui.selectedMembers.length < 14) {
                            groupActions.setUI({ selectedMembers: [...groups.ui.selectedMembers, friend.id] });
                          }
                        } else {
                          groupActions.setUI({ selectedMembers: (groups.ui.selectedMembers || []).filter((id) => id !== friend.id) });
                        }
                      }}
                      disabled={!groups.ui.selectedMembers.includes(friend.id) && groups.ui.selectedMembers.length >= 14}
                    />
                    <Avatar src={friend.avatar_url} alt={friend.username} size={32} />
                    <span>{friend.username}</span>
                  </label>
                ))}
                {friends.length === 0 && (
                  <p className="muted small empty-hint">Add friends first to create a group</p>
                )}
              </div>
            </div>

            <div className="cg-actions modern-actions">
              <RippleButton type="button" className="btn-secondary modern-btn" onClick={() => groupActions.setUI({ createOpen: false })}>
                Cancel
              </RippleButton>
              <RippleButton
                type="submit"
                className="btn-primary modern-btn"
                disabled={!groups.ui.newGroupName.trim() || groups.ui.selectedMembers.length === 0}
              >
                Create Group
              </RippleButton>
            </div>
          </form>
        </div>
      </Modal>

      {/* Rename Group Modal */}
      <Modal open={groups.ui.renameOpen} onClose={() => groupActions.setUI({ renameOpen: false })}>
        <div className="create-group-modal modern-modal">
          <div className="modal-header">
            <h3>Rename Group</h3>
            <button type="button" className="modal-close" onClick={() => groupActions.setUI({ renameOpen: false })}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={groupActions.rename}>
            <label className="modern-field">
              <span>New Group Name</span>
              <input
                type="text"
                value={groups.ui.renameValue}
                onChange={(e) => groupActions.setUI({ renameValue: e.target.value })}
                placeholder="Enter new group name"
                maxLength={50}
                required
                className="modern-input"
              />
              <small className="char-count">{groups.ui.renameValue.length}/50</small>
            </label>

            <div className="cg-actions modern-actions">
              <RippleButton type="button" className="btn-secondary modern-btn" onClick={() => groupActions.setUI({ renameOpen: false })}>
                Cancel
              </RippleButton>
              <RippleButton
                type="submit"
                className="btn-primary modern-btn"
                disabled={!groups.ui.renameValue.trim() || groups.ui.renameValue === groups.active?.name}
              >
                Rename
              </RippleButton>
            </div>
          </form>
        </div>
      </Modal>

      {/* Invite to Group Modal */}
      <Modal open={groups.ui.inviteOpen} onClose={() => groupActions.setUI({ inviteOpen: false })}>
        <div className="create-group-modal modern-modal">
          <div className="modal-header">
            <h3>Invite Friend to Group</h3>
            <button type="button" className="modal-close" onClick={() => groupActions.setUI({ inviteOpen: false })}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={groupActions.invite}>
            <label className="modern-field">
              <span>Friend Username</span>
              <input
                type="text"
                value={groups.ui.inviteUsername}
                onChange={(e) => groupActions.setUI({ inviteUsername: e.target.value })}
                placeholder="Enter friend's username"
                maxLength={50}
                required
                className="modern-input"
              />
            </label>

            <div className="cg-actions modern-actions">
              <RippleButton type="button" className="btn-secondary modern-btn" onClick={() => groupActions.setUI({ inviteOpen: false })}>
                Cancel
              </RippleButton>
              <RippleButton
                type="submit"
                className="btn-primary modern-btn"
                disabled={!groups.ui.inviteUsername.trim()}
              >
                Invite
              </RippleButton>
            </div>
          </form>
        </div>
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

      {/* Incoming Group Call Modal - DM Style */}
      {groupCall?.incomingCall && !groupCall?.isInCall && (
        <div className="voice-modal-overlay group-call-overlay">
          <motion.div
            className="voice-modal group-call-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="group-call-avatar">
              {groupCall.incomingCall.fromUser.username?.charAt(0).toUpperCase()}
            </div>
            <h3>{groupCall.incomingCall.fromUser.username}</h3>
            <p className="group-name">in {groupsList.find((g) => g.id === groupCall.incomingCall.groupId)?.name || "Group"}</p>
            <p className="call-type">Incoming {groupCall.incomingCall.callType} call</p>

            <div className="voice-modal-actions">
              <RippleButton
                type="button"
                className="btn-decline"
                onClick={() => {
                  groupCall?.declineCall?.(groupCall.incomingCall.groupId, groupCall.incomingCall.fromUser.id);
                }}
              >
                Decline
              </RippleButton>
              <RippleButton
                type="button"
                className="btn-accept"
                onClick={() => {
                  groupCall?.acceptGroupCall?.(
                    groupCall.incomingCall.groupId,
                    groupCall.incomingCall.callType,
                    groupCall.incomingCall.fromUser
                  );
                  // Open the group
                  const group = groupsList.find((g) => g.id === groupCall.incomingCall.groupId);
                  if (group) groupActions.open(group);
                }}
              >
                Accept
              </RippleButton>
            </div>
          </motion.div>
        </div>
      )}

      {/* Group Video Conference Overlay */}
      <VideoConference
        key={`${groupCall?.activeGroupId || "none"}-${groups.call.minimized ? "mini" : "full"}`}
        isOpen={groupCall?.isInCall || false}
        onClose={groupCall?.leaveCall || (() => {})}
        minimized={groups.call.minimized}
        onMinimize={() => setGroups(g => ({ ...g, call: { ...g.call, minimized: !g.call.minimized } }))}
        call={groupCall}
        participants={groupCall?.participants || []}
        localStream={groupCall?.localStream}
        screenStream={groupCall?.screenStream}
        isMuted={groupCall?.isMuted || false}
        isCameraOn={groupCall?.isCameraOn || false}
        isScreenSharing={groupCall?.isScreenSharing || false}
        toggleMute={groupCall?.toggleMute || (() => {})}
        toggleCamera={groupCall?.toggleCamera || (() => {})}
        startScreenShare={groupCall?.startScreenShare || (() => {})}
        stopScreenShare={groupCall?.stopScreenShare || (() => {})}
        leaveCall={groupCall?.leaveCall || (() => {})}
        callType={groupCall?.callType}
        dominantSpeaker={groupCall?.dominantSpeaker}
        focusedParticipant={groupCall?.focusedParticipant}
        setFocusedParticipant={groupCall?.setFocusedParticipant || (() => {})}
        duration={groupCall?.duration || 0}
      />

      {/* Profile Customization Modal */}
      <Modal open={customizationOpen} onClose={() => setCustomizationOpen(false)} wide>
        <ProfileCustomizationPanel
          {...profileCustomization}
          onClose={() => setCustomizationOpen(false)}
          me={me}
        />
      </Modal>

      {/* Mobile UI Components */}
      {isMobile && (
        <>
          {/* Mobile Header */}
          <div className="mobile-header">
            <div className="mobile-header-title">Descall</div>
            <div className="mobile-header-actions">
              <button
                className="mobile-header-btn touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setNotificationsOpen(true);
                }}
              >
                <Bell size={20} />
                {notificationUnread > 0 && (
                  <span className="badge">{notificationUnread}</span>
                )}
              </button>
              <button
                className="mobile-header-btn touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setMobileSidebarOpen(true);
                }}
              >
                <Menu size={20} />
              </button>
            </div>
          </div>

          {/* Mobile Sidebar Overlay */}
          <div
            className={`mobile-sidebar-overlay ${mobileSidebarOpen ? "open" : ""}`}
            onClick={() => setMobileSidebarOpen(false)}
          />

          {/* Mobile Sidebar Drawer */}
          <motion.div
            className={`mobile-sidebar ${mobileSidebarOpen ? "open" : ""}`}
            initial={{ x: "-100%" }}
            animate={{ x: mobileSidebarOpen ? "0%" : "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="mobile-sidebar-header">
              <div className="mobile-sidebar-avatar">
                {me?.username?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="mobile-sidebar-user">
                <div className="mobile-sidebar-username">@{me?.username}</div>
                <div className="mobile-sidebar-status">
                  {profileCustomization.customization.profile.statusEmoji} {profileCustomization.customization.profile.customStatus || myStatus}
                </div>
              </div>
            </div>

            <nav className="mobile-sidebar-menu">
              <button
                className="mobile-sidebar-item touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setActiveMobileView("dms");
                  setMobileSidebarOpen(false);
                }}
              >
                <MessageSquare size={20} />
                <span>Messages</span>
                {totalDmUnread > 0 && <span className="badge">{totalDmUnread}</span>}
              </button>
              <button
                className="mobile-sidebar-item touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setActiveMobileView("groups");
                  setMobileSidebarOpen(false);
                }}
              >
                <Users size={20} />
                <span>Groups</span>
                <span className="badge">{groupsList.length}</span>
              </button>
              <button
                className="mobile-sidebar-item touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setActiveMobileView("profile");
                  setMobileSidebarOpen(false);
                }}
              >
                <User size={20} />
                <span>Profile</span>
              </button>
              <button
                className="mobile-sidebar-item touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setCustomizationOpen(true);
                  setMobileSidebarOpen(false);
                }}
              >
                <Palette size={20} />
                <span>Customize</span>
              </button>
              <button
                className="mobile-sidebar-item touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setSettingsOpen(true);
                  setMobileSidebarOpen(false);
                }}
              >
                <Settings size={20} />
                <span>Settings</span>
              </button>
              <button
                className="mobile-sidebar-item touch-feedback"
                onClick={() => {
                  vibrate(50);
                  onLogout();
                }}
              >
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </nav>
          </motion.div>

          {/* Mobile Bottom Navigation */}
          <nav className="mobile-bottom-nav">
            <button
              className={`mobile-nav-item ${activeMobileView === "dms" ? "active" : ""}`}
              onClick={() => {
                vibrate(10);
                setActiveMobileView("dms");
              }}
            >
              <MessageSquare className="mobile-nav-icon" size={24} />
              <span>Chats</span>
              {totalDmUnread > 0 && (
                <span className="mobile-nav-badge">{totalDmUnread}</span>
              )}
            </button>
            <button
              className={`mobile-nav-item ${activeMobileView === "groups" ? "active" : ""}`}
              onClick={() => {
                vibrate(10);
                setActiveMobileView("groups");
              }}
            >
              <Users className="mobile-nav-icon" size={24} />
              <span>Groups</span>
              <span className="mobile-nav-badge">{groupsList.length}</span>
            </button>
            <button
              className={`mobile-nav-item ${activeMobileView === "calls" ? "active" : ""}`}
              onClick={() => {
                vibrate(10);
                setActiveMobileView("calls");
              }}
            >
              <Phone className="mobile-nav-icon" size={24} />
              <span>Calls</span>
            </button>
            <button
              className={`mobile-nav-item ${activeMobileView === "friends" ? "active" : ""}`}
              onClick={() => {
                vibrate(10);
                setActiveMobileView("friends");
              }}
            >
              <UserPlus className="mobile-nav-icon" size={24} />
              <span>Friends</span>
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

// Import mobile styles
import "../styles.mobile.css";
