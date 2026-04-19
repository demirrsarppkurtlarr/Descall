import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, Users, UserPlus, Bell, Circle, 
  PanelLeftClose, Settings, Send, Paperclip, 
  Phone, Video, VideoOff, X, Plus, Clock, Check, CheckCheck,
  Mic, MicOff, Camera, CameraOff, Monitor, MonitorX, PhoneOff,
  Search, LogOut, Volume2, VolumeX, Maximize2, Minimize2, Grid,
  ChevronLeft, ChevronRight, MoreVertical, Trash2
} from "lucide-react";
import { useToast } from "../context/ToastContext";
import { Avatar } from "./ui/Avatar";
import { RippleButton } from "./ui/RippleButton";

// Helper: format time
function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
// Icon component doesn't exist, using Lucide icons directly
import { sendGroupMessage, getGroupMessages, getGroupById, createGroup } from "../api/groups";

// Hidden audio for remote stream
function RemoteAudio({ stream }) {
  const audioRef = useRef(null);
  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch((err) => console.error("[RemoteAudio] Autoplay error:", err));
    }
  }, [stream]);
  return <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />;
}

// Screen share indicator
function ScreenShareBadge() {
  return (
    <div className="screen-share-badge">
      <span className="icon">🖥</span>
      <span>Screen sharing</span>
    </div>
  );
}

// Compact hover card
function CompactHoverCard({ user, onOpen, onCall, position, onClose }) {
  if (!user) return null;
  return (
    <motion.div
      className="compact-hover-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      style={{ left: position?.x || 0, top: position?.y || 0 }}
      onMouseLeave={onClose}
    >
      <div className="compact-hover-header">
        <Avatar name={user?.username} size={48} imageUrl={user?.avatar_url} />
        <div className="compact-hover-info">
          <div className="compact-hover-name">{user?.username || user?.name || "User"}</div>
          <div className={`compact-hover-status ${user?.status || "offline"}`}>{user?.status || "offline"}</div>
        </div>
      </div>
      <div className="compact-hover-actions">
        <button onClick={() => { onOpen?.(); onClose?.(); }} className="compact-hover-btn">Message</button>
        {onCall && <button onClick={() => { onCall(); onClose?.(); }} className="compact-hover-btn primary">Call</button>}
      </div>
    </motion.div>
  );
}

// ChatLayout Component
export default function ChatLayout({
  me,
  connectionLabel,
  reconnectState,
  authError,
  myStatus,
  onlineUsers,
  friends,
  friendRequests,
  notifications,
  myGroups: myGroupsProp,
  setMyGroups: setMyGroupsProp,
  activeDmUser,
  dmMessages,
  dmUnread,
  dmByUserId,
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
  
  // Use props or local state
  const myGroups = myGroupsProp || [];
  const setMyGroups = setMyGroupsProp || (() => {});
  
  // Group states
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupComposer, setGroupComposer] = useState("");
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ users: [], groups: [], messages: [] });
  const [loadingGroup, setLoadingGroup] = useState(false);
  
  // Group creation states
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  const composerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const dmMessagesRef = useRef(null);

  const inCall = call?.mode !== null;

  // Theme apply
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") root.classList.add("light");
    else root.classList.remove("light");
    try { localStorage.setItem("descall_theme", theme); } catch {}
  }, [theme]);

  // Friend filter
  const filteredFriends = useMemo(() => {
    const q = friendFilter.trim().toLowerCase();
    if (!q) return friends || [];
    return (friends || []).filter((f) => (f?.username || "").toLowerCase().includes(q));
  }, [friends, friendFilter]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [dmMessages, activeDmUser]);

  // Typing indicator
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!activeDmUser?.id) return;
    if (typing) {
      const t = setTimeout(() => setTyping(false), 1500);
      return () => clearTimeout(t);
    }
  }, [typing, activeDmUser?.id]);

  const handleTyping = () => {
    if (!typing) {
      setTyping(true);
      onTypingDmStart?.();
    }
  };

  // Submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!composer.trim() || !activeDmUser?.id) return;
    onSendDm?.(composer.trim());
    setComposer("");
    setTyping(false);
    onTypingDmStop?.();
  };

  // File upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeDmUser?.id) return;
    setUploading(true);
    try {
      await onSendDmMedia?.(file);
    } finally {
      setUploading(false);
    }
  };

  // Friend request
  const handleSendFriendRequest = async (e) => {
    e.preventDefault();
    if (!friendUsername.trim()) return;
    try {
      await onSendFriendRequest?.(friendUsername.trim());
      setFriendUsername("");
      toast?.success?.("Friend request sent");
    } catch (err) {
      toast?.error?.(err?.message || "Failed to send friend request");
    }
  };

  // Notifications
  const unreadNotifications = useMemo(
    () => (notifications || []).filter((n) => !n.read).length,
    [notifications]
  );

  // Search
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults({ users: [], groups: [], messages: [] });
      return;
    }
    const safeGroups = Array.isArray(myGroups) ? myGroups : [];
    const userResults = friends.filter(
      (f) => f.username?.toLowerCase().includes(query.toLowerCase())
    );
    const groupResults = safeGroups.filter(
      (g) => g.name?.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults({ users: userResults, groups: groupResults, messages: [] });
  };

  // Grup mesaji gonderme
  const handleSendGroupMessage = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const text = groupComposer?.trim();
    if (!text || !activeGroup?.id) return;
    
    console.log("[GroupMessage] Sending message to group:", activeGroup.id, "text:", text);
    
    try {
      const result = await sendGroupMessage(activeGroup.id, { content: text });
      console.log("[GroupMessage] API result:", result);
      
      const newMsg = {
        id: result?.message?.id || result?.id || Date.now().toString(),
        content: text,
        sender: { id: me?.id, username: me?.username },
        created_at: new Date().toISOString(),
      };
      setGroupMessages((prev) => [...prev, newMsg]);
      setGroupComposer("");
    } catch (err) {
      console.error("[GroupMessage] Error:", err);
      toast?.error?.(err?.message || "Failed to send message");
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || selectedMembers.length === 0) return;
    try {
      const result = await createGroup({
        name: newGroupName.trim(),
        memberIds: selectedMembers,
      });
      setMyGroups((prev) => [...prev, result?.group]);
      setNewGroupName("");
      setSelectedMembers([]);
      setCreateGroupOpen(false);
      toast?.success?.("Group created");
    } catch (err) {
      toast?.error?.(err?.message || "Failed to create group");
    }
  };

  const toggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Grup acma - DUZELTILDI
  const handleOpenGroup = async (group) => {
    if (!group || !group.id) {
      console.error("[handleOpenGroup] Invalid group object:", group);
      toast?.error?.("Invalid group");
      return;
    }
    
    console.log("[handleOpenGroup] Opening group:", group.id, group.name);
    
    setLoadingGroup(true);
    try {
      setActiveDmUser(null);
      setActiveGroup(group);
      
      const messages = await getGroupMessages(group.id);
      console.log("[handleOpenGroup] Messages loaded:", messages?.length || 0);
      setGroupMessages(messages || []);
    } catch (err) {
      console.error("[handleOpenGroup] Error:", err);
      toast?.error?.(err?.message || "Failed to load group");
      setActiveGroup(null);
    } finally {
      setLoadingGroup(false);
    }
  };

  // Incoming Call Modal
  function IncomingCallModal({ call }) {
    if (!call || call.mode !== "incoming" || !call.peer) return null;
    return (
      <div className="call-overlay incoming-call-overlay">
        <motion.div
          className="incoming-call-container"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <div className="incoming-call-header">
            <div className="call-pulse-ring">
              <Avatar name={call.peer?.username} size={80} imageUrl={call.peer?.avatarUrl} />
            </div>
            <h2 className="incoming-call-name">{call.peer?.username}</h2>
            <p className="incoming-call-status">
              Incoming {call.callType === "video" ? "video" : "voice"} call
              {call.callType === "video" && <Video size={16} />}
              {call.callType === "voice" && <Phone size={16} />}
            </p>
          </div>
          <div className="incoming-call-actions">
            <motion.button
              type="button"
              className="call-action-btn decline"
              onClick={() => call.decline?.()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="action-icon"><PhoneOff size={24} /></span>
              <span className="action-label">Decline</span>
            </motion.button>
            <motion.button
              type="button"
              className="call-action-btn accept"
              onClick={() => call.accept?.()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="action-icon">{call.callType === "video" ? <Video size={24} /> : <Phone size={24} />}</span>
              <span className="action-label">Accept</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // DM Call Overlay
  function DMCallOverlay({ call, peerScreenSharing }) {
    const [isFullscreen, setIsFullscreen] = useState(true);
    
    if (!call || call.mode === null) return null;
    
    const isActive = call.mode === "active";
    const isOutgoing = call.mode === "outgoing";
    const hasVideo = isActive && (call.callType === "video" || peerScreenSharing || call.cameraOn);
    
    if (!isActive && !isOutgoing) return null;
    if (!call.peer) return null;
    
    const toggleFullscreen = () => {
      setIsFullscreen(!isFullscreen);
    };
    
    return (
      <div className={`call-overlay dm-call-overlay ${isFullscreen ? 'fullscreen' : 'minimized'}`} style={{ zIndex: 9998 }}>
        <motion.button
          type="button"
          className="dm-sidebar-toggle"
          onClick={() => setSidebarOpen(v => !v)}
          whileHover={{ x: 5 }}
          whileTap={{ scale: 0.95 }}
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftClose size={20} style={{ transform: 'rotate(180deg)' }} />}
        </motion.button>
        
        <motion.button
          type="button"
          className="dm-fullscreen-toggle"
          onClick={toggleFullscreen}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title={isFullscreen ? "Minimize" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </motion.button>
        
        <motion.div 
          className="dm-call-container"
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="dm-call-video-area">
            {hasVideo ? (
              <div className="dm-video-grid">
                <div className="dm-video-item dm-video-remote">
                  <video
                    ref={call.remoteVideoRef}
                    autoPlay
                    playsInline
                    className="dm-video-element"
                  />
                  <span className="dm-video-label">{call.peer?.username}</span>
                </div>
                
                {(call.cameraOn || call.screenSharing) && (
                  <div className="dm-video-item dm-video-local">
                    <video
                      ref={call.localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="dm-video-element"
                    />
                    <span className="dm-video-label">You</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="dm-voice-view">
                <div className="dm-voice-avatar">
                  <Avatar name={call.peer?.username} size={120} imageUrl={call.peer?.avatarUrl} />
                  {isActive && call.duration > 0 && (
                    <div className="dm-voice-timer">{call.formatDuration(call.duration)}</div>
                  )}
                </div>
                <h2 className="dm-voice-name">{call.peer?.username}</h2>
                <p className="dm-voice-status">
                  {isOutgoing ? "Ringing..." : "Voice call in progress"}
                </p>
              </div>
            )}
          </div>
          
          <div className="dm-call-controls">
            <div className="dm-controls-row">
              <motion.button
                type="button"
                className={`dm-control-btn ${call.muted ? "active" : ""}`}
                onClick={call.toggleMute}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                {call.muted ? <MicOff size={24} /> : <Mic size={24} />}
                <span>{call.muted ? "Unmute" : "Mute"}</span>
              </motion.button>
              
              {hasVideo && (
                <motion.button
                  type="button"
                  className={`dm-control-btn ${call.cameraOn ? "" : "active"}`}
                  onClick={call.toggleCamera}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {call.cameraOn ? <Video size={24} /> : <VideoOff size={24} />}
                  <span>{call.cameraOn ? "Camera off" : "Camera on"}</span>
                </motion.button>
              )}
              
              <motion.button
                type="button"
                className={`dm-control-btn ${call.screenSharing ? "active" : ""}`}
                onClick={call.screenSharing ? call.stopScreenShare : call.startScreenShare}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                {call.screenSharing ? <MonitorX size={24} /> : <Monitor size={24} />}
                <span>{call.screenSharing ? "Stop" : "Share"}</span>
              </motion.button>
              
              <motion.button
                type="button"
                className="dm-control-btn hangup"
                onClick={() => call.endCall(call.peer?.id)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <PhoneOff size={24} />
                <span>End</span>
              </motion.button>
            </div>
            
            {isActive && (
              <div className="dm-call-info">
                <span className="dm-call-timer">{call.formatDuration(call.duration)}</span>
                {peerScreenSharing && <span className="dm-screen-badge">Screen sharing</span>}
                {call.connectionQuality === "poor" && <span className="dm-quality-badge">Weak connection</span>}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // CallBar
  function CallBar({ call, peerScreenSharing }) {
    if (!call || !call.peer) return null;
    return null; // DMCallOverlay kullaniliyor
  }

  // VideoPanel
  function VideoPanel({ call, peerScreenSharing }) {
    return null; // DMCallOverlay kullaniliyor
  }

  return (
    <div className={`chat-layout theme-${theme}`}>
      <aside className={`sidebar glass ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="sidebar-header">
          <div className="brand">
            <h2>Descall</h2>
          </div>
          <div className="sidebar-actions">
            <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Settings">
              <Settings size={18} />
            </button>
            <button className="icon-btn" onClick={() => setSearchOpen(true)} title="Search">
              <Search size={18} />
            </button>
            <button className="icon-btn" onClick={() => setNotificationsOpen(true)} title="Notifications">
              <Bell size={18} />
              {unreadNotifications > 0 && <span className="badge">{unreadNotifications}</span>}
            </button>
            <button className="icon-btn collapse-btn" onClick={() => setSidebarOpen((v) => !v)} title="Toggle sidebar">
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftClose size={18} style={{ transform: 'rotate(180deg)' }} />}
            </button>
          </div>
        </div>

        <div className="sidebar-tabs">
          <button className={sidebarView === "dms" ? "active" : ""} onClick={() => setSidebarView("dms")}>
            <MessageSquare size={16} />
            <span>DMs</span>
          </button>
          <button className={sidebarView === "friends" ? "active" : ""} onClick={() => setSidebarView("friends")}>
            <Users size={16} />
            <span>Friends</span>
          </button>
          <button className={sidebarView === "groups" ? "active" : ""} onClick={() => setSidebarView("groups")}>
            <Grid size={16} />
            <span>Groups</span>
          </button>
        </div>

        <div className="sidebar-content custom-scroll">
          {sidebarView === "dms" && (
            <div className="dm-list">
              {Array.isArray(filteredFriends) && filteredFriends.map((friend) => {
                const unread = dmUnread?.[friend?.id] || 0;
                return (
                  <motion.div
                    key={friend?.id}
                    className={`dm-item ${activeDmUser?.id === friend?.id ? "active" : ""}`}
                    onClick={() => onOpenDm?.(friend)}
                    whileHover={{ x: 4 }}
                  >
                    <div className="dm-avatar-wrapper">
                      <Avatar name={friend?.username} size={36} imageUrl={friend?.avatar_url} />
                      <span className={`status-dot ${onlineUsers?.includes(friend?.id) ? "online" : "offline"}`} />
                    </div>
                    <div className="dm-info">
                      <div className="dm-name">{friend?.username || "Unknown"}</div>
                      {typingDmUser === friend?.id && <div className="dm-preview typing">typing...</div>}
                    </div>
                    {unread > 0 && <span className="unread-badge">{unread}</span>}
                  </motion.div>
                );
              })}
            </div>
          )}

          {sidebarView === "friends" && (
            <div className="friends-section">
              <div className="add-friend-form">
                <input
                  type="text"
                  placeholder="Add friend by username"
                  value={friendUsername}
                  onChange={(e) => setFriendUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendFriendRequest(e)}
                />
                <RippleButton onClick={handleSendFriendRequest} disabled={!friendUsername.trim()}>
                  <UserPlus size={16} />
                </RippleButton>
              </div>

              <div className="filter-bar">
                <input
                  type="text"
                  placeholder="Search friends"
                  value={friendFilter}
                  onChange={(e) => setFriendFilter(e.target.value)}
                />
              </div>

              <div className="section-title">Online ({filteredFriends.filter((f) => onlineUsers?.includes(f?.id)).length})</div>
              {filteredFriends
                .filter((f) => onlineUsers?.includes(f?.id))
                .map((friend) => (
                  <div key={friend?.id} className="friend-row">
                    <div className="friend-info" onClick={() => onOpenDm?.(friend)}>
                      <Avatar name={friend?.username} size={32} imageUrl={friend?.avatar_url} />
                      <span className="friend-name">{friend?.username}</span>
                      <Circle size={8} className="online-indicator" fill="#2ed573" />
                    </div>
                    <div className="friend-actions">
                      <button onClick={() => onOpenDm?.(friend)} title="Message"><MessageSquare size={16} /></button>
                      <button onClick={() => onRemoveFriend?.(friend?.id)} title="Remove" className="danger"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}

              <div className="section-title offline">Offline ({filteredFriends.filter((f) => !onlineUsers?.includes(f?.id)).length})</div>
              {filteredFriends
                .filter((f) => !onlineUsers?.includes(f?.id))
                .map((friend) => (
                  <div key={friend?.id} className="friend-row offline">
                    <div className="friend-info" onClick={() => onOpenDm?.(friend)}>
                      <Avatar name={friend?.username} size={32} imageUrl={friend?.avatar_url} />
                      <span className="friend-name">{friend?.username}</span>
                    </div>
                    <div className="friend-actions">
                      <button onClick={() => onOpenDm?.(friend)} title="Message"><MessageSquare size={16} /></button>
                      <button onClick={() => onRemoveFriend?.(friend?.id)} title="Remove" className="danger"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {sidebarView === "groups" && (
            <div className="groups-section">
              <button className="create-group-btn" onClick={() => setCreateGroupOpen(true)}>
                <Plus size={16} />
                Create Group
              </button>
              
              {(myGroups || []).map((group) => (
                <motion.div
                  key={group?.id}
                  className={`group-item ${activeGroup?.id === group?.id ? "active" : ""}`}
                  onClick={() => handleOpenGroup(group)}
                  whileHover={{ x: 4 }}
                >
                  <div className="group-avatar">
                    <Avatar name={group?.name} size={36} imageUrl={group?.avatar_url} />
                  </div>
                  <div className="group-info">
                    <div className="group-name">{group?.name || "Unnamed Group"}</div>
                    <div className="group-meta">{group?.memberCount || 0} members</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="me-row">
            <Avatar name={me?.username} size={36} imageUrl={me?.avatar_url} />
            <div className="me-info">
              <div className="me-name">{me?.username || "Guest"}</div>
              <div className="me-status">{myStatus || "online"}</div>
            </div>
            <select
              className="status-select"
              value={myStatus}
              onChange={(e) => onStatusChange?.(e.target.value)}
            >
              <option value="online">Online</option>
              <option value="away">Away</option>
              <option value="dnd">Do Not Disturb</option>
              <option value="invisible">Invisible</option>
            </select>
            <button className="icon-btn" onClick={onLogout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
          {connectionLabel && (
            <div className={`connection-status ${reconnectState?.isReconnecting ? "reconnecting" : ""}`}>
              <span className="pulse-dot" />
              {connectionLabel}
              {reconnectState?.isReconnecting && (
                <span className="reconnect-info">Attempt {reconnectState.attempt}/{reconnectState.maxAttempts}</span>
              )}
            </div>
          )}
          {authError && <div className="auth-error">{authError}</div>}
        </div>
      </aside>

      <section className={`chat ${!sidebarOpen ? "expanded" : ""}`}>
        <header className="chat-header glass">
          <div className="header-left">
            {activeDmUser ? (
              <>
                <Avatar name={activeDmUser?.username} size={40} imageUrl={activeDmUser?.avatar_url} />
                <div className="header-info">
                  <div className="header-name">{activeDmUser?.username}</div>
                  <div className={`header-status ${onlineUsers?.includes(activeDmUser?.id) ? "online" : "offline"}`}>
                    {onlineUsers?.includes(activeDmUser?.id) ? "Online" : "Offline"}
                    {typingDmUser === activeDmUser?.id && <span className="typing-text"> • typing...</span>}
                  </div>
                </div>
              </>
            ) : activeGroup ? (
              <>
                <Avatar name={activeGroup?.name} size={40} imageUrl={activeGroup?.avatar_url} />
                <div className="header-info">
                  <div className="header-name">{activeGroup?.name}</div>
                  <div className="header-status">{activeGroup?.memberCount || 0} members</div>
                </div>
              </>
            ) : (
              <div className="header-placeholder">Select a conversation</div>
            )}
          </div>
          
          <div className="header-actions">
            {activeDmUser && (
              <>
                <RippleButton type="button" className="header-call" disabled={inCall} onClick={() => call?.startCall?.(activeDmUser, "voice")} title="Voice call">
                  <Phone size={18} />
                </RippleButton>
                <RippleButton type="button" className="header-call" disabled={inCall} onClick={() => call?.startCall?.(activeDmUser, "video")} title="Video call">
                  <Video size={18} />
                </RippleButton>
              </>
            )}
            {activeGroup?.id && (
              <div className="header-call-btns">
                <RippleButton 
                  type="button" 
                  className="header-call" 
                  disabled={inCall || !groupCall} 
                  onClick={() => {
                    const memberIds = activeGroup?.memberIds || activeGroup?.members?.map(m => m.id) || [];
                    console.log("[GroupCall] Starting voice call with members:", memberIds);
                    groupCall?.startGroupCall?.(activeGroup?.id, "voice", memberIds);
                  }} 
                  title="Group voice call"
                >
                  <Phone size={18} />
                </RippleButton>
                <RippleButton 
                  type="button" 
                  className="header-call" 
                  disabled={inCall || !groupCall} 
                  onClick={() => {
                    const memberIds = activeGroup?.memberIds || activeGroup?.members?.map(m => m.id) || [];
                    console.log("[GroupCall] Starting video call with members:", memberIds);
                    groupCall?.startGroupCall?.(activeGroup?.id, "video", memberIds);
                  }} 
                  title="Group video call"
                >
                  <Video size={18} />
                </RippleButton>
                <RippleButton type="button" className="header-call" onClick={() => setGroupSettingsOpen(true)} title="Group settings">
                  <Settings size={18} />
                </RippleButton>
              </div>
            )}
          </div>
        </header>

        <div className="messages custom-scroll" ref={dmMessagesRef}>
          {activeDmUser && dmHasMore && (
            <div className="load-more">
              <button onClick={loadOlderDm} disabled={loadingOlderDm}>
                {loadingOlderDm ? "Loading..." : "Load older messages"}
              </button>
            </div>
          )}
          
          {(activeDmUser ? dmMessages : activeGroup ? groupMessages : []).map((msg, idx) => {
            const isMe = msg?.sender?.id === me?.id || msg?.sender_id === me?.id;
            const showAvatar = !isMe && (idx === 0 || (activeDmUser ? dmMessages : groupMessages)[idx - 1]?.sender?.id !== msg?.sender?.id);
            
            return (
              <motion.div
                key={msg?.id || idx}
                className={`message ${isMe ? "me" : ""}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {!isMe && showAvatar && (
                  <div className="message-avatar">
                    <Avatar name={msg?.sender?.username} size={32} imageUrl={msg?.sender?.avatar_url} />
                  </div>
                )}
                <div className="message-bubble">
                  {activeGroup && !isMe && <div className="message-sender">{msg?.sender?.username}</div>}
                  {msg?.media_url ? (
                    <div className="message-media">
                      {msg?.media_type?.startsWith?.("image") ? (
                        <img src={msg?.media_url} alt="Shared" onClick={() => setLightboxUrl(msg?.media_url)} />
                      ) : (
                        <a href={msg?.media_url} target="_blank" rel="noopener noreferrer" className="file-attachment">
                          <Paperclip size={16} />
                          <span>File attachment</span>
                        </a>
                      )}
                    </div>
                  ) : null}
                  <div className="message-text">{msg?.content || msg?.text}</div>
                  <div className="message-meta">
                    <span className="message-time">{formatTime(msg?.created_at || msg?.timestamp)}</span>
                    {isMe && (
                      <span className="message-status">
                        {msg?.read ? <CheckCheck size={12} /> : msg?.delivered ? <Check size={12} /> : <Clock size={12} />}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* DM Composer */}
        {activeDmUser?.id && !inCall && (
          <form className="composer glass-composer" onSubmit={handleSubmit}>
            <input
              ref={composerRef}
              value={composer}
              onChange={(e) => { setComposer(e.target.value); handleTyping(); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
              placeholder={`Message @${activeDmUser?.username || 'user'}`}
              disabled={uploading}
            />
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
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
        {activeGroup?.id && (
          <form
            className={`composer glass-composer ${inCall ? "composer-dimmed" : ""}`}
            onSubmit={handleSendGroupMessage}
          >
            <input
              type="text"
              placeholder={`Message #${activeGroup?.name || 'group'}`}
              value={groupComposer || ""}
              onChange={(e) => setGroupComposer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendGroupMessage(e);
                }
              }}
            />
            <RippleButton type="submit" title="Send message">
              <Send size={18} />
            </RippleButton>
          </form>
        )}
      </section>

      <aside className="right-rail custom-scroll">
        <div className="voice-activity glass">
          <h4>Call</h4>
          {call?.mode === "incoming" && call.peer && <p className="voice-hint">Incoming {call.callType} call from {call.peer.username}</p>}
          {(call?.mode === "active" || call?.mode === "outgoing") && call.peer && (
            <p className="voice-hint">{call.mode === "outgoing" ? "Calling" : "In call with"} {call.peer.username} ({call.callType})</p>
          )}
          {!call?.mode && <p className="voice-hint">No active call</p>}
        </div>

        <div className="active-now glass">
          <h4>Active Now</h4>
          <div className="active-list">
            {(onlineUsers || []).filter((id) => id !== me?.id).map((userId) => {
              const friend = (friends || []).find((f) => f?.id === userId);
              if (!friend) return null;
              return (
                <div key={userId} className="active-item" onClick={() => onOpenDm?.(friend)}>
                  <div className="active-avatar">
                    <Avatar name={friend?.username} size={36} imageUrl={friend?.avatar_url} />
                    <span className="active-indicator" />
                  </div>
                  <div className="active-name">{friend?.username}</div>
                </div>
              );
            })}
            {(onlineUsers || []).filter((id) => id !== me?.id).length === 0 && (
              <div className="active-empty">No friends online</div>
            )}
          </div>
        </div>
      </aside>

      {/* Incoming Call Modal */}
      <IncomingCallModal call={call} />

      {/* DM Call Overlay */}
      <DMCallOverlay call={call} peerScreenSharing={peerScreenSharing} />

      {/* Create Group Modal */}
      <AnimatePresence>
        {createGroupOpen && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCreateGroupOpen(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Create Group</h3>
                <button className="icon-btn" onClick={() => setCreateGroupOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateGroup} className="create-group-form">
                <input
                  type="text"
                  placeholder="Group name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
                <div className="member-select">
                  <h4>Select Members</h4>
                  {(friends || []).map((friend) => (
                    <label key={friend?.id} className="member-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(friend?.id)}
                        onChange={() => toggleMember(friend?.id)}
                      />
                      <Avatar name={friend?.username} size={32} imageUrl={friend?.avatar_url} />
                      <span>{friend?.username}</span>
                    </label>
                  ))}
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setCreateGroupOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={!newGroupName.trim() || selectedMembers.length === 0}>
                    Create Group
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSettingsOpen(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Settings</h3>
                <button className="icon-btn" onClick={() => setSettingsOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="settings-content">
                <div className="setting-row">
                  <label>Theme</label>
                  <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>
                <div className="setting-row">
                  <label>Compact Blur</label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={compactBlur}
                    onChange={(e) => setCompactBlur(Number(e.target.value))}
                  />
                </div>
                <div className="setting-row">
                  <label>Reduce Motion</label>
                  <input
                    type="checkbox"
                    checked={reduceMotion}
                    onChange={(e) => setReduceMotion(e.target.checked)}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications Modal */}
      <AnimatePresence>
        {notificationsOpen && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNotificationsOpen(false)}
          >
            <motion.div
              className="modal-content notifications-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Notifications</h3>
                <div className="modal-actions">
                  <button className="btn-text" onClick={() => onNotificationReadAll?.()}>Mark all read</button>
                  <button className="icon-btn" onClick={() => setNotificationsOpen(false)}>
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="notifications-list">
                {(notifications || []).length === 0 && (
                  <div className="empty-state">No notifications</div>
                )}
                {(notifications || []).map((n) => (
                  <div
                    key={n?.id}
                    className={`notification-item ${!n?.read ? "unread" : ""}`}
                    onClick={() => { onNotificationRead?.(n?.id); setNotificationsOpen(false); }}
                  >
                    <div className="notification-content">{n?.content || n?.message}</div>
                    <div className="notification-time">{formatTime(n?.created_at)}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              className="modal-content search-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Search</h3>
                <button className="icon-btn" onClick={() => setSearchOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="search-content">
                <input
                  type="text"
                  placeholder="Search users, groups, messages..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  autoFocus
                />
                
                {searchResults.users.length > 0 && (
                  <div className="search-section">
                    <h4>Users</h4>
                    {searchResults.users.map((user) => (
                      <div key={user?.id} className="search-result" onClick={() => { onOpenDm?.(user); setSearchOpen(false); }}>
                        <Avatar name={user?.username} size={32} imageUrl={user?.avatar_url} />
                        <span>{user?.username}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {searchResults.groups.length > 0 && (
                  <div className="search-section">
                    <h4>Groups</h4>
                    {searchResults.groups.map((group) => (
                      <div key={group?.id} className="search-result" onClick={() => { handleOpenGroup(group); setSearchOpen(false); }}>
                        <Avatar name={group?.name} size={32} imageUrl={group?.avatar_url} />
                        <span>{group?.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {searchQuery && searchResults.users.length === 0 && searchResults.groups.length === 0 && (
                  <div className="empty-state">No results found</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            className="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
          >
            <img src={lightboxUrl} alt="Full size" />
            <button className="lightbox-close" onClick={() => setLightboxUrl(null)}>
              <X size={24} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Friend Notice */}
      <AnimatePresence>
        {friendNotice && (
          <motion.div
            className="friend-notice"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Avatar name={friendNotice?.username} size={32} imageUrl={friendNotice?.avatar_url} />
            <span>{friendNotice?.username} is now online!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Settings Modal */}
      <AnimatePresence>
        {groupSettingsOpen && activeGroup && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setGroupSettingsOpen(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Group Settings</h3>
                <button className="icon-btn" onClick={() => setGroupSettingsOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="group-settings-content">
                <div className="group-info-row">
                  <Avatar name={activeGroup?.name} size={64} imageUrl={activeGroup?.avatar_url} />
                  <div>
                    <h4>{activeGroup?.name}</h4>
                    <p>{activeGroup?.memberCount || 0} members</p>
                  </div>
                </div>
                
                <div className="group-members-list">
                  <h4>Members</h4>
                  {(activeGroup?.members || []).map((member) => (
                    <div key={member?.id} className="group-member-item">
                      <Avatar name={member?.username} size={32} imageUrl={member?.avatar_url} />
                      <span>{member?.username}</span>
                      {member?.id === activeGroup?.created_by && <span className="owner-badge">Owner</span>}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden remote audio element */}
      <audio ref={call?.remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
}
