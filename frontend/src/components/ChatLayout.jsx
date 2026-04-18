import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../context/ToastContext";
import TypingIndicator from "./chat/TypingIndicator";
import SettingsPanel from "./settings/SettingsPanel";
import VideoConference from "./VideoConference";
import UserHoverCard from "./social/UserHoverCard";
import UserProfilePopover from "./social/UserProfilePopover";
import RippleButton from "./ui/RippleButton";
import Avatar from "./ui/Avatar";
import Modal from "./ui/Modal";
import { uploadFile } from "../api/media";
import { getMediaUrl } from "../api/media";
import { getMyGroups, createGroup, leaveGroup, inviteToGroup, renameGroup } from "../api/groups";
import { 
  MessageSquare, Users, UserPlus, Bell, Circle, 
  PanelLeftClose, Settings, Send, Paperclip, 
  Phone, Video, X, Plus, Clock, Check, CheckCheck,
  Mic, MicOff, Camera, CameraOff, Monitor, PhoneOff,
  Search, LogOut, Volume2, VolumeX, Maximize2, Grid,
  ChevronLeft, ChevronRight, MoreVertical, Trash2
} from "lucide-react";

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

function CallBar({ call, peerScreenSharing }) {
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
    return (
      <motion.div className={`call-bar ${call.mode === "outgoing" ? "calling" : ""}`} initial={{ y: 80 }} animate={{ y: 0 }}>
        <div className="call-bar-left">
          <Avatar name={call.peer.username} size={32} imageUrl={call.peer.avatarUrl} />
          <div className="call-bar-text">
            <strong>{call.peer.username}</strong>
            <span>
              {call.mode === "active"
                ? call.formatDuration(call.duration)
                : "Ringing…"}
            </span>
            {peerScreenSharing && <span className="screen-indicator">🖥 Sharing screen</span>}
            {call.connectionQuality === "poor" && <span className="quality-warn">⚠ Weak</span>}
          </div>
        </div>
        <div className="call-bar-actions">
          <RippleButton type="button" className={`call-btn ${call.muted ? "active" : ""}`} onClick={call.toggleMute} title={call.muted ? "Unmute" : "Mute"}>
            {call.muted ? "🔇" : "🎙"}
          </RippleButton>
          <RippleButton type="button" className={`call-btn ${call.cameraOn ? "active" : ""}`} onClick={call.toggleCamera} title={call.cameraOn ? "Turn off camera" : "Turn on camera"}>
            {call.cameraOn ? "📹" : "📷"}
          </RippleButton>
          <RippleButton type="button" className={`call-btn ${call.screenSharing ? "active" : ""}`} onClick={call.screenSharing ? call.stopScreenShare : call.startScreenShare} title={call.screenSharing ? "Stop sharing" : "Share screen"}>
            🖥
          </RippleButton>
          <RippleButton type="button" className="call-btn hangup" onClick={() => call.endCall(call.peer.id)} title="End call">
            📞
          </RippleButton>
        </div>
      </motion.div>
    );
  }

  return null;
}

function VideoPanel({ call, peerScreenSharing }) {
  if (!call || call.mode !== "active") return null;
  
  // Always show panel during active call - video will render when stream available
  const hasVideo = call.callType === "video" || peerScreenSharing || call.cameraOn;
  
  return (
    <div className={`video-panel ${hasVideo ? "has-video" : "voice-only"}`}>
      {hasVideo && (
        <div className="video-remote-wrap">
          <video 
            ref={call.remoteVideoRef} 
            autoPlay 
            playsInline 
            className="video-remote"
            style={{ objectFit: "cover" }}
          />
          {peerScreenSharing && <div className="screen-share-label">🖥 Peer screen sharing</div>}
        </div>
      )}
      
      {/* Local video PIP - show when camera on or screen sharing */}
      {(call.cameraOn || call.screenSharing) && (
        <div className="video-pip-wrap">
          <video 
            ref={call.localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="video-pip"
          />
        </div>
      )}
      
      {/* Screen share preview (local) */}
      {call.screenSharing && (
        <div className="video-screen-preview">
          <video 
            ref={call.screenVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="video-screen"
          />
          <div className="screen-share-label local">🖥 You are sharing</div>
        </div>
      )}
      
      {/* Voice-only indicator */}
      {!hasVideo && (
        <div className="voice-indicator">
          <span className="voice-icon">🎤</span>
          <span>Voice call active</span>
        </div>
      )}
    </div>
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
  peerScreenSharing = false,
  groupCall,
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
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [myGroups, setMyGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(() => {
    try {
      const saved = localStorage.getItem("descall_active_group");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupComposer, setGroupComposer] = useState("");
  
  // Group management modals
  const [leaveGroupModalOpen, setLeaveGroupModalOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [renameGroupModalOpen, setRenameGroupModalOpen] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [membersToAdd, setMembersToAdd] = useState([]);
  
  // Global search
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ users: [], groups: [], messages: [] });
  
  const fileInputRef = useRef(null);

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

  // Fetch my groups
  useEffect(() => {
    if (!me) return;
    console.log("[Frontend] Fetching groups...");
    getMyGroups()
      .then((data) => {
        console.log("[Frontend] Groups received:", data);
        setMyGroups(data.groups || []);
      })
      .catch((err) => {
        console.error("[Frontend] Failed to fetch groups:", err);
        setMyGroups([]);
      });
  }, [me]);

  // Group handlers
  // Leave group handler
  const handleLeaveGroup = async () => {
    if (!activeGroup) return;
    try {
      await leaveGroup(activeGroup.id);
      setMyGroups((prev) => prev.filter((g) => g.id !== activeGroup.id));
      setActiveGroup(null);
      setLeaveGroupModalOpen(false);
      toast?.success?.("Left group successfully");
    } catch (err) {
      toast?.error?.(err.message || "Failed to leave group");
    }
  };

  // Add members handler
  const handleAddMembers = async () => {
    if (!activeGroup || membersToAdd.length === 0) return;
    try {
      await Promise.all(membersToAdd.map((userId) => inviteToGroup(activeGroup.id, userId)));
      setAddMemberModalOpen(false);
      setMembersToAdd([]);
      toast?.success?.(`Invited ${membersToAdd.length} member(s)`);
    } catch (err) {
      toast?.error?.(err.message || "Failed to add members");
    }
  };

  // Rename group handler
  const handleRenameGroup = async () => {
    if (!activeGroup || !renameValue.trim()) return;
    try {
      await renameGroup(activeGroup.id, renameValue.trim());
      setMyGroups((prev) =>
        prev.map((g) => (g.id === activeGroup.id ? { ...g, name: renameValue.trim() } : g))
      );
      if (activeGroup) setActiveGroup({ ...activeGroup, name: renameValue.trim() });
      setRenameGroupModalOpen(false);
      setRenameValue("");
      toast?.success?.("Group renamed successfully");
    } catch (err) {
      toast?.error?.(err.message || "Failed to rename group");
    }
  };

  // Global search handler
  const handleGlobalSearch = (query) => {
    setGlobalSearchQuery(query);
    if (!query.trim()) {
      setSearchResults({ users: [], groups: [], messages: [] });
      return;
    }
    const userResults = friends.filter(
      (f) => f.username?.toLowerCase().includes(query.toLowerCase())
    );
    const groupResults = myGroups.filter(
      (g) => g.name?.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults({ users: userResults, groups: groupResults, messages: [] });
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || selectedMembers.length === 0) return;
    try {
      const result = await createGroup({
        name: newGroupName.trim(),
        memberIds: selectedMembers,
      });
      setMyGroups((prev) => [result.group, ...prev]);
      setCreateGroupOpen(false);
      setNewGroupName("");
      setSelectedMembers([]);
      toast?.success?.("Group created!");
    } catch (err) {
      toast?.error?.(err.message || "Failed to create group");
    }
  };

  const handleOpenGroup = (group) => {
    setActiveGroup(group);
    try { localStorage.setItem("descall_active_group", JSON.stringify(group)); } catch {}
    setActiveDmUser(null); // DM'yi kapat
    // TODO: Load group messages from API
    setGroupMessages([]);
  };

  const handleSendGroupMessage = (e) => {
    e?.preventDefault();
    const text = groupComposer.trim();
    if (!text || !activeGroup) return;
    // TODO: Send via API
    const newMsg = {
      id: Date.now().toString(),
      content: text,
      sender: { id: me?.id, username: me?.username },
      created_at: new Date().toISOString(),
    };
    setGroupMessages((prev) => [...prev, newMsg]);
    setGroupComposer("");
  };

  const sortedFriends = useMemo(() => [...friends].sort((a, b) => a.username.localeCompare(b.username)), [friends]);
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

  const notificationUnread = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
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
    <div className="app-root app-root-enhanced">
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
                {dmList.map(({ friend, unread, preview, timeLabel }) => (
                  <motion.button
                    key={friend.id}
                    type="button"
                    className={`dm-item ${activeDmUser?.id === friend.id ? "active" : ""}`}
                    onClick={() => { setActiveGroup(null); try { localStorage.removeItem("descall_active_group"); } catch {}; onOpenDm(friend); }}
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
                {filteredFriends.map((friend) => (
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
                <h4>Groups ({myGroups.length})</h4>
                <button 
                  className="btn-icon"
                  onClick={() => setCreateGroupOpen(true)}
                  title="Create group"
                >
                  <Plus size={20} />
                </button>
              </div>
              <div className="scroll-list custom-scroll">
                {myGroups.length === 0 ? (
                  <div className="empty-state">
                    <p className="muted">No groups yet</p>
                    <button className="btn-secondary" onClick={() => setCreateGroupOpen(true)}>
                      Create your first group
                    </button>
                  </div>
                ) : (
                  myGroups.map((group) => (
                    <motion.button
                      key={group.id}
                      type="button"
                      className={`dm-item ${activeGroup?.id === group.id ? "active" : ""}`}
                      onClick={() => handleOpenGroup(group)}
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
                          {group.last_message ? group.last_message.content : "No messages yet"}
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

      <section className="panel main-panel">
        <header className="panel-header glass-header">
          <div className="panel-title-wrap">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeDmUser ? `dm-${activeDmUser.id}` : activeGroup ? `group-${activeGroup.id}` : "empty"}
                className="panel-title-block"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
              >
                <strong className="panel-title">
                  {activeDmUser ? `@${activeDmUser.username}` : activeGroup ? activeGroup.name : "Descall"}
                </strong>
                <span className="panel-sub">
                  {activeDmUser ? "Direct message" : activeGroup ? "Group chat" : "Select a conversation"}
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
            {activeGroup && (
              <div className="header-call-btns">
                <RippleButton type="button" className="header-call" disabled={inCall || !groupCall} onClick={() => groupCall?.startGroupCall?.(activeGroup.id, "voice", [])} title="Group voice call">
                  <Phone size={18} />
                </RippleButton>
                <RippleButton type="button" className="header-call" disabled={inCall || !groupCall} onClick={() => groupCall?.startGroupCall?.(activeGroup.id, "video", [])} title="Group video call">
                  <Video size={18} />
                </RippleButton>
                <RippleButton type="button" className="header-call" onClick={() => setGroupSettingsOpen(true)} title="Group settings">
                  <Settings size={18} />
                </RippleButton>
              </div>
            )}
          </div>
          <div className="panel-header-right">
            <RippleButton type="button" className="header-call" onClick={() => setGlobalSearchOpen(true)} title="Global search (Ctrl+K)">
              <Search size={18} />
            </RippleButton>
            <span className={`connection-chip ${isOnline ? "online" : "reconnect"}`}>{connectionLabel}</span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeDmUser ? `dm-${activeDmUser.id}` : activeGroup ? `group-${activeGroup.id}` : "empty"}
            className="messages-wrap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <div className="messages custom-scroll" ref={messagesRef} onScroll={handleMessagesScroll}>
              {loadingOlderDm && activeDmUser && <div className="load-older-banner">Loading older messages…</div>}

              {!activeDmUser && !activeGroup && (
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

              {activeDmUser && dmGrouped.map(({ msg, compact }) => {
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
              {activeGroup && groupMessages.length === 0 && (
                <motion.div className="empty-state glass" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                  <h4>Group: {activeGroup.name}</h4>
                  <p>No messages yet. Start the conversation!</p>
                </motion.div>
              )}

              {activeGroup && groupMessages.map((msg) => {
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
        {activeGroup && (
          <form
            className={`composer glass-composer ${inCall ? "composer-dimmed" : ""}`}
            onSubmit={handleSendGroupMessage}
          >
            <input
              placeholder={`Message #${activeGroup.name}`}
              value={groupComposer}
              onChange={(e) => setGroupComposer(e.target.value)}
            />
            <RippleButton type="submit">Send</RippleButton>
          </form>
        )}
      </section>

      <aside className="right-rail custom-scroll">
        <VideoPanel call={call} peerScreenSharing={peerScreenSharing} />
        <div className="voice-activity glass">
          <h4>Call</h4>
          {call?.mode === "incoming" && call.peer && <p className="voice-hint">Incoming {call.callType} call from {call.peer.username}</p>}
          {(call?.mode === "active" || call?.mode === "outgoing") && call.peer && (
            <p className="voice-hint">{call.mode === "outgoing" ? "Calling" : "In call with"} {call.peer.username} ({call.callType})</p>
          )}
          {(!call || call.mode === null) && <p className="voice-hint muted">No active call. Use Call in a DM to start WebRTC.</p>}
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
              {notifications.map((n) => (
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
      <Modal open={createGroupOpen} onClose={() => setCreateGroupOpen(false)}>
        <div className="create-group-modal">
          <h3>Create Group</h3>
          <form onSubmit={handleCreateGroup}>
            <label className="cg-field">
              <span>Group Name</span>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name"
                maxLength={50}
                required
              />
              <small>{newGroupName.length}/50</small>
            </label>

            <div className="cg-members">
              <span>Select Members (max 15)</span>
              <div className="cg-friends-list">
                {friends.map((friend) => (
                  <label key={friend.id} className="cg-friend-item">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(friend.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (selectedMembers.length < 14) {
                            setSelectedMembers([...selectedMembers, friend.id]);
                          }
                        } else {
                          setSelectedMembers(selectedMembers.filter((id) => id !== friend.id));
                        }
                      }}
                      disabled={!selectedMembers.includes(friend.id) && selectedMembers.length >= 14}
                    />
                    <Avatar src={friend.avatar_url} alt={friend.username} size={28} />
                    <span>{friend.username}</span>
                  </label>
                ))}
                {friends.length === 0 && (
                  <p className="muted small">Add friends first to create a group</p>
                )}
              </div>
              <small className="cg-count">{selectedMembers.length}/14 friends selected</small>
            </div>

            <div className="cg-actions">
              <RippleButton type="button" className="btn-secondary" onClick={() => setCreateGroupOpen(false)}>
                Cancel
              </RippleButton>
              <RippleButton 
                type="submit" 
                className="btn-primary"
                disabled={!newGroupName.trim() || selectedMembers.length === 0}
              >
                Create Group
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

      {/* Group Video Conference Overlay */}
      <VideoConference
        isOpen={groupCall?.isInCall || false}
        onClose={groupCall?.leaveCall || (() => {})}
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
      />

      {/* ========== GROUP MANAGEMENT MODALS ========== */}
      
      {/* Leave Group Modal */}
      <Modal open={leaveGroupModalOpen} onClose={() => setLeaveGroupModalOpen(false)}>
        <div className="modal-content" style={{ padding: 24, textAlign: "center" }}>
          <h3 style={{ marginBottom: 12 }}>Leave Group?</h3>
          <p style={{ marginBottom: 24, color: "#888" }}>Are you sure you want to leave <strong>{activeGroup?.name}</strong>?</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <RippleButton type="button" className="btn-secondary" onClick={() => setLeaveGroupModalOpen(false)}>Cancel</RippleButton>
            <RippleButton type="button" className="btn-danger" onClick={handleLeaveGroup} style={{ background: "#ed4245" }}>Leave Group</RippleButton>
          </div>
        </div>
      </Modal>

      {/* Add Member Modal */}
      <Modal open={addMemberModalOpen} onClose={() => { setAddMemberModalOpen(false); setMembersToAdd([]); }} wide>
        <div className="modal-content" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Add Members to {activeGroup?.name}</h3>
          <div className="cg-friends-list" style={{ maxHeight: 300, overflow: "auto", marginBottom: 16 }}>
            {friends.filter(f => !myGroups.find(g => g.id === activeGroup?.id)?.memberIds?.includes(f.id)).map((friend) => (
              <label key={friend.id} className="cg-friend-item" style={{ display: "flex", alignItems: "center", gap: 12, padding: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={membersToAdd.includes(friend.id)}
                  onChange={(e) => {
                    if (e.target.checked) setMembersToAdd([...membersToAdd, friend.id]);
                    else setMembersToAdd(membersToAdd.filter((id) => id !== friend.id));
                  }}
                />
                <Avatar name={friend.username} size={32} imageUrl={friend.avatarUrl} />
                <span>{friend.username}</span>
              </label>
            ))}
            {friends.length === 0 && <p className="muted small">No friends to add.</p>}
          </div>
          <small style={{ display: "block", marginBottom: 16 }}>{membersToAdd.length} selected</small>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <RippleButton type="button" className="btn-secondary" onClick={() => { setAddMemberModalOpen(false); setMembersToAdd([]); }}>Cancel</RippleButton>
            <RippleButton type="button" className="btn-primary" onClick={handleAddMembers} disabled={membersToAdd.length === 0}>Add Members</RippleButton>
          </div>
        </div>
      </Modal>

      {/* Rename Group Modal */}
      <Modal open={renameGroupModalOpen} onClose={() => { setRenameGroupModalOpen(false); setRenameValue(""); }}>
        <div className="modal-content" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Rename Group</h3>
          <form onSubmit={(e) => { e.preventDefault(); handleRenameGroup(); }}>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="New group name"
              maxLength={50}
              style={{ width: "100%", padding: 12, marginBottom: 16, background: "#1a1d21", border: "1px solid #2f3136", borderRadius: 6, color: "#fff" }}
            />
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <RippleButton type="button" className="btn-secondary" onClick={() => { setRenameGroupModalOpen(false); setRenameValue(""); }}>Cancel</RippleButton>
              <RippleButton type="submit" className="btn-primary" disabled={!renameValue.trim()}>Rename</RippleButton>
            </div>
          </form>
        </div>
      </Modal>

      {/* Group Settings Modal */}
      <Modal open={groupSettingsOpen} onClose={() => setGroupSettingsOpen(false)} wide>
        <div className="modal-content" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 24 }}>Group Settings: {activeGroup?.name}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <RippleButton type="button" className="btn-secondary" onClick={() => { setGroupSettingsOpen(false); setRenameValue(activeGroup?.name || ""); setRenameGroupModalOpen(true); }} style={{ justifyContent: "flex-start" }}>
              ✏️ Rename Group
            </RippleButton>
            <RippleButton type="button" className="btn-secondary" onClick={() => { setGroupSettingsOpen(false); setAddMemberModalOpen(true); }} style={{ justifyContent: "flex-start" }}>
              ➕ Add Members
            </RippleButton>
            <RippleButton type="button" className="btn-danger" onClick={() => { setGroupSettingsOpen(false); setLeaveGroupModalOpen(true); }} style={{ justifyContent: "flex-start", background: "rgba(237, 66, 69, 0.1)", color: "#ed4245" }}>
              🚪 Leave Group
            </RippleButton>
          </div>
        </div>
      </Modal>

      {/* ========== GLOBAL SEARCH MODAL ========== */}
      <Modal open={globalSearchOpen} onClose={() => { setGlobalSearchOpen(false); setGlobalSearchQuery(""); setSearchResults({ users: [], groups: [], messages: [] }); }} wide>
        <div className="modal-content" style={{ padding: 24, minHeight: 400 }}>
          <h3 style={{ marginBottom: 16 }}>Global Search</h3>
          <div style={{ position: "relative", marginBottom: 20 }}>
            <Search size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#72767d" }} />
            <input
              type="text"
              value={globalSearchQuery}
              onChange={(e) => handleGlobalSearch(e.target.value)}
              placeholder="Search users, groups, messages..."
              style={{ width: "100%", padding: "12px 12px 12px 40px", background: "#1a1d21", border: "1px solid #2f3136", borderRadius: 6, color: "#fff", fontSize: 15 }}
            />
          </div>
          
          <div style={{ display: "flex", gap: 24 }}>
            {/* Users Results */}
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: 12, color: "#72767d", fontSize: 12, textTransform: "uppercase" }}>Users ({searchResults.users.length})</h4>
              <div style={{ maxHeight: 300, overflow: "auto" }}>
                {searchResults.users.map((user) => (
                  <motion.button
                    key={user.id}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: 8, background: "transparent", border: "none", color: "#fff", cursor: "pointer", borderRadius: 4 }}
                    whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                    onClick={() => { onOpenDm(user); setGlobalSearchOpen(false); }}
                  >
                    <Avatar name={user.username} size={32} imageUrl={user.avatarUrl} />
                    <span>{user.username}</span>
                  </motion.button>
                ))}
                {globalSearchQuery && searchResults.users.length === 0 && <p className="muted small">No users found.</p>}
              </div>
            </div>

            {/* Groups Results */}
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: 12, color: "#72767d", fontSize: 12, textTransform: "uppercase" }}>Groups ({searchResults.groups.length})</h4>
              <div style={{ maxHeight: 300, overflow: "auto" }}>
                {searchResults.groups.map((group) => (
                  <motion.button
                    key={group.id}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: 8, background: "transparent", border: "none", color: "#fff", cursor: "pointer", borderRadius: 4 }}
                    whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                    onClick={() => { handleOpenGroup(group); setGlobalSearchOpen(false); }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#5865f2", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                    <span>{group.name}</span>
                  </motion.button>
                ))}
                {globalSearchQuery && searchResults.groups.length === 0 && <p className="muted small">No groups found.</p>}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Keyboard shortcut: Ctrl+K for global search */}
      <GlobalSearchShortcut onOpen={() => setGlobalSearchOpen(true)} />
    </div>
  );
}

// Global search shortcut component
function GlobalSearchShortcut({ onOpen }) {
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpen]);
  return null;
}
