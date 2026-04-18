import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../context/ToastContext";
import "../styles/discord.css";
import { 
  MessageSquare, Users, UserPlus, Bell, Circle, 
  PanelLeftClose, Settings, Send, Paperclip, 
  Phone, Video, X, Plus, Clock, Hash, AtSign,
  Search, LogOut, MoreVertical, ChevronRight, ChevronDown,
  Smile, Gift, Pin, Inbox, HelpCircle, Headphones, Mic
} from "lucide-react";
import SettingsPanel from "./settings/SettingsPanel";
import VideoConference from "./VideoConference";
import UserProfilePopover from "./social/UserProfilePopover";
import RippleButton from "./ui/RippleButton";
import Avatar from "./ui/Avatar";
import Modal from "./ui/Modal";
import { uploadFile } from "../api/media";
import { getMediaUrl } from "../api/media";
import { getMyGroups, createGroup } from "../api/groups";

// ============ ANIMATION VARIANTS ============
const slideInLeft = {
  hidden: { x: -30, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } }
};

const slideInRight = {
  hidden: { x: 30, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } }
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } }
};

const scaleIn = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 400, damping: 25 } }
};

const messageVariant = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 500, damping: 30 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
};

// ============ STATUS BADGE ============
function StatusBadge({ status = "offline", size = 12 }) {
  const colors = {
    online: "#3ba55d",
    idle: "#faa61a", 
    dnd: "#ed4245",
    offline: "#747f8d"
  };
  return (
    <span 
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: colors[status] || colors.offline,
        border: `2px solid #2f3136`,
        display: "inline-block"
      }} 
    />
  );
}

// ============ SERVER ICON ============
function ServerIcon({ children, active, onClick, tooltip, delay = 0 }) {
  return (
    <motion.div
      className={`server-icon ${active ? "active" : ""}`}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay, type: "spring", stiffness: 400, damping: 20 }}
      whileHover={{ scale: 1.08, borderRadius: 16 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      title={tooltip}
    >
      {children}
    </motion.div>
  );
}

// ============ DM ITEM ============
function DMItem({ friend, active, unread, preview, onClick, index }) {
  return (
    <motion.div
      className={`dm-item ${active ? "active" : ""}`}
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.03, type: "spring", stiffness: 400 }}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }}
      onClick={onClick}
    >
      <div className="dm-avatar">
        <Avatar name={friend.username} size={32} imageUrl={friend.avatarUrl} />
        <div className="dm-status">
          <StatusBadge status={friend.status} size={10} />
        </div>
      </div>
      <div className="dm-info">
        <div className="dm-name">{friend.username}</div>
        <div className="dm-preview">{preview || "No messages yet"}</div>
      </div>
      {unread > 0 && (
        <motion.div 
          className="dm-badge"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500 }}
        >
          {unread > 99 ? "99+" : unread}
        </motion.div>
      )}
    </motion.div>
  );
}

// ============ CHANNEL ITEM ============
function ChannelItem({ icon: Icon, name, active, onClick, index }) {
  return (
    <motion.div
      className={`channel-item ${active ? "active" : ""}`}
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.03 }}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.03)", x: 4 }}
      onClick={onClick}
    >
      <Icon size={18} />
      <span className="channel-name">{name}</span>
    </motion.div>
  );
}

// ============ MESSAGE ============
function Message({ msg, me, index, onProfileClick }) {
  const fromSelf = msg.from?.id === me?.id;
  return (
    <motion.div
      className={`message ${fromSelf ? "own" : ""}`}
      variants={messageVariant}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.03 }}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.02)" }}
    >
      <motion.div 
        className="message-avatar"
        whileHover={{ scale: 1.1, rotate: 5 }}
        onClick={() => onProfileClick(msg.from)}
      >
        <Avatar name={msg.from?.username} size={40} imageUrl={msg.from?.avatarUrl} />
      </motion.div>
      <div className="message-content">
        <div className="message-header">
          <span 
            className="message-author" 
            style={{ color: fromSelf ? "#5865F2" : "#fff" }}
          >
            {msg.from?.username}
          </span>
          <span className="message-time">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="message-text">{msg.text}</div>
      </div>
    </motion.div>
  );
}

// ============ COMPOSER ============
function Composer({ value, onChange, onSubmit, placeholder, disabled }) {
  return (
    <motion.form 
      className="composer"
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, type: "spring" }}
      onSubmit={onSubmit}
    >
      <div className="composer-inner">
        <motion.button type="button" className="composer-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Plus size={22} />
        </motion.button>
        <motion.button type="button" className="composer-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Gift size={22} />
        </motion.button>
        
        <input
          className="composer-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        
        <motion.button type="button" className="composer-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Paperclip size={22} />
        </motion.button>
        <motion.button type="button" className="composer-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Smile size={22} />
        </motion.button>
        
        <motion.button
          type="submit"
          className="composer-send"
          disabled={disabled || !value.trim()}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Send size={20} />
        </motion.button>
      </div>
    </motion.form>
  );
}

// ============ MAIN COMPONENT ============
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
  const [sidebarView, setSidebarView] = useState("dms");
  const [activeGroup, setActiveGroup] = useState(() => {
    try {
      const saved = localStorage.getItem("descall_active_group");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [myGroups, setMyGroups] = useState([]);
  const [composer, setComposer] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const wasTypingRef = useRef(false);

  // ============ GROUPS ============
  useEffect(() => {
    if (!me) return;
    console.log("[ChatLayout] Fetching groups...");
    getMyGroups()
      .then((data) => {
        console.log("[ChatLayout] Groups received:", data);
        setMyGroups(data.groups || []);
      })
      .catch((err) => {
        console.error("[ChatLayout] Groups error:", err);
        setMyGroups([]);
      });
  }, [me]);

  // ============ TYPING ============
  const flushTyping = useCallback(() => {
    if (wasTypingRef.current && activeDmUser) {
      onTypingDmStop?.(activeDmUser.id);
      wasTypingRef.current = false;
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, [activeDmUser, onTypingDmStop]);

  useEffect(() => () => flushTyping(), [flushTyping]);

  // ============ SCROLL ============
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [dmMessages, activeDmUser, scrollToBottom]);

  // ============ HANDLERS ============
  const handleSend = (e) => {
    e.preventDefault();
    if (!composer.trim() || !activeDmUser) return;
    flushTyping();
    onSendDm?.(activeDmUser.id, composer.trim());
    setComposer("");
    scrollToBottom();
  };

  const handleComposerChange = (value) => {
    setComposer(value);
    if (!wasTypingRef.current && activeDmUser) {
      wasTypingRef.current = true;
      onTypingDmStart?.(activeDmUser.id);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => flushTyping(), 1800);
  };

  const handleOpenGroup = (group) => {
    setActiveGroup(group);
    try { localStorage.setItem("descall_active_group", JSON.stringify(group)); } catch {}
    onOpenDm?.(null);
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

  // ============ DM LIST ============
  const dmList = useMemo(() => {
    return friends
      .map((f) => {
        const messages = dmByUserId[f.id] || [];
        const last = messages[messages.length - 1];
        return {
          friend: f,
          unread: dmUnread[f.id] || 0,
          preview: last?.text || "",
        };
      })
      .sort((a, b) => (b.unread > 0 ? 1 : -1));
  }, [friends, dmByUserId, dmUnread]);

  // ============ RENDER ============
  const inCall = call?.mode === "active" || call?.mode === "outgoing";
  const typingNamesDm = typingDmUser ? [typingDmUser.username] : [];

  return (
    <div className="discord-app">
      {/* ============ NAV RAIL ============ */}
      <motion.nav 
        className="nav-rail"
        variants={slideInLeft}
        initial="hidden"
        animate="visible"
      >
        {/* Home */}
        <ServerIcon 
          active={!activeGroup} 
          onClick={() => { setActiveGroup(null); onOpenDm?.(null); }}
          tooltip="Direct Messages"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </ServerIcon>

        <div className="server-divider" />

        {/* Groups */}
        <AnimatePresence>
          {myGroups.map((group, i) => (
            <ServerIcon
              key={group.id}
              active={activeGroup?.id === group.id}
              onClick={() => handleOpenGroup(group)}
              tooltip={group.name}
              delay={i * 0.05}
            >
              {group.name.charAt(0).toUpperCase()}
            </ServerIcon>
          ))}
        </AnimatePresence>

        {/* Add Group */}
        <ServerIcon onClick={() => setCreateGroupOpen(true)} tooltip="Create Group">
          <Plus size={24} />
        </ServerIcon>
      </motion.nav>

      {/* ============ SIDEBAR ============ */}
      <motion.aside 
        className="sidebar"
        variants={slideInLeft}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.1 }}
      >
        {/* Header */}
        <div className="sidebar-header">
          <h2>{sidebarView === "dms" ? "Direct Messages" : "Friends"}</h2>
          <div className="header-actions">
            <motion.button 
              className="header-btn"
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.1)" }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSidebarView(sidebarView === "dms" ? "friends" : "dms")}
            >
              {sidebarView === "dms" ? <Users size={18} /> : <MessageSquare size={18} />}
            </motion.button>
          </div>
        </div>

        {/* Content */}
        <motion.div 
          className="sidebar-content"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence mode="wait">
            {sidebarView === "dms" ? (
              <motion.div key="dms" variants={fadeIn}>
                {/* Online Friends Count */}
                <div className="category-header">
                  <ChevronRight size={12} />
                  ONLINE — {onlineUsers.filter(u => u.status === "online").length}
                </div>

                {/* DM List */}
                {dmList.map(({ friend, unread, preview }, i) => (
                  <DMItem
                    key={friend.id}
                    friend={friend}
                    active={activeDmUser?.id === friend.id}
                    unread={unread}
                    preview={preview}
                    onClick={() => { 
                      setActiveGroup(null);
                      try { localStorage.removeItem("descall_active_group"); } catch {};
                      onOpenDm?.(friend); 
                    }}
                    index={i}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div key="friends" variants={fadeIn}>
                <div className="category-header">FRIENDS</div>
                {friends.map((friend, i) => (
                  <ChannelItem
                    key={friend.id}
                    icon={Users}
                    name={friend.username}
                    onClick={() => { 
                      setSidebarView("dms"); 
                      onOpenDm?.(friend); 
                    }}
                    index={i}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* User Bar */}
        <motion.div 
          className="user-bar"
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="user-info" onClick={() => setProfileUser(me)}>
            <div className="user-avatar">
              <Avatar name={me?.username} size={32} imageUrl={me?.avatarUrl} />
              <div className="user-status">
                <StatusBadge status={myStatus} size={10} />
              </div>
            </div>
            <div className="user-details">
              <div className="user-name">{me?.username}</div>
              <div className="user-status-text">{myStatus}</div>
            </div>
          </div>
          <div className="user-actions">
            <motion.button 
              className="user-btn"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={18} />
            </motion.button>
            <motion.button 
              className="user-btn"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onLogout}
            >
              <LogOut size={18} />
            </motion.button>
          </div>
        </motion.div>
      </motion.aside>

      {/* ============ MAIN CHAT ============ */}
      <main className="main-chat">
        {/* Header */}
        <motion.header 
          className="chat-header"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          {activeDmUser ? (
            <>
              <div className="chat-icon">
                <AtSign size={24} />
              </div>
              <div className="chat-title">{activeDmUser.username}</div>
              <div className="chat-divider" />
              <div className="chat-topic">
                This is the beginning of your direct message history with @{activeDmUser.username}
              </div>
              <div className="chat-actions">
                <motion.button 
                  className="chat-action-btn"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => call?.startCall?.(activeDmUser, "voice")}
                  disabled={inCall}
                >
                  <Phone size={20} />
                </motion.button>
                <motion.button 
                  className="chat-action-btn"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => call?.startCall?.(activeDmUser, "video")}
                  disabled={inCall}
                >
                  <Video size={20} />
                </motion.button>
                <motion.button className="chat-action-btn" whileHover={{ scale: 1.1 }}>
                  <Pin size={20} />
                </motion.button>
                <motion.button className="chat-action-btn" whileHover={{ scale: 1.1 }}>
                  <Users size={20} />
                </motion.button>
              </div>
            </>
          ) : activeGroup ? (
            <>
              <div className="chat-icon">
                <Hash size={24} />
              </div>
              <div className="chat-title">{activeGroup.name}</div>
              <div className="chat-divider" />
              <div className="chat-topic">Group chat</div>
            </>
          ) : (
            <div className="chat-title">Select a conversation</div>
          )}
        </motion.header>

        {/* Messages */}
        <div className="messages-container">
          <AnimatePresence mode="wait">
            {!activeDmUser && !activeGroup ? (
              <motion.div 
                key="welcome"
                className="welcome-screen"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="#5865F2">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                  </svg>
                </motion.div>
                <h1>Welcome to Descall</h1>
                <p>Select a friend from the sidebar to start messaging</p>
              </motion.div>
            ) : (
              <motion.div
                key="messages"
                className="messages-list"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {loadingOlderDm && activeDmUser && (
                  <div className="loading-banner">Loading older messages…</div>
                )}
                
                {dmMessages?.map((msg, i) => (
                  <Message
                    key={msg.id || i}
                    msg={msg}
                    me={me}
                    index={i}
                    onProfileClick={setProfileUser}
                  />
                ))}
                
                {typingNamesDm.length > 0 && (
                  <motion.div 
                    className="typing-indicator"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span>{typingNamesDm.join(", ")} is typing...</span>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Composer */}
        {activeDmUser && (
          <Composer
            value={composer}
            onChange={handleComposerChange}
            onSubmit={handleSend}
            placeholder={`Message @${activeDmUser.username}`}
            disabled={!activeDmUser}
          />
        )}
      </main>

      {/* ============ RIGHT PANEL ============ */}
      <AnimatePresence>
        {activeDmUser && (
          <motion.aside 
            className="right-panel"
            variants={slideInRight}
            initial="hidden"
            animate="visible"
            exit={{ x: 50, opacity: 0 }}
          >
            <div className="profile-card">
              <motion.div 
                className="profile-avatar-large"
                whileHover={{ scale: 1.05 }}
              >
                <Avatar name={activeDmUser.username} size={80} imageUrl={activeDmUser.avatarUrl} />
                <div className="profile-status-large">
                  <StatusBadge status={activeDmUser.status} size={16} />
                </div>
              </motion.div>
              
              <h2 className="profile-name">{activeDmUser.username}</h2>
              <div className="profile-status">
                <StatusBadge status={activeDmUser.status} size={8} />
                <span>{activeDmUser.status?.toUpperCase() || "OFFLINE"}</span>
              </div>

              <div className="profile-actions">
                <motion.button
                  className="profile-action-btn primary"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => call?.startCall?.(activeDmUser, "voice")}
                  disabled={inCall}
                >
                  <Phone size={18} />
                  Voice Call
                </motion.button>
                <motion.button
                  className="profile-action-btn primary"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => call?.startCall?.(activeDmUser, "video")}
                  disabled={inCall}
                >
                  <Video size={18} />
                  Video Call
                </motion.button>
                <motion.button
                  className="profile-action-btn"
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Users size={18} />
                  View Profile
                </motion.button>
                <motion.button
                  className="profile-action-btn danger"
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onRemoveFriend?.(activeDmUser.id)}
                >
                  <X size={18} />
                  Remove Friend
                </motion.button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ============ MODALS ============ */}
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
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Create Group</h2>
              <form onSubmit={handleCreateGroup}>
                <input
                  className="modal-input"
                  placeholder="Group Name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  maxLength={50}
                />
                <div className="member-count">{selectedMembers.length}/14 friends selected</div>
                <div className="friends-list">
                  {friends.map((f) => (
                    <motion.label
                      key={f.id}
                      className={`friend-checkbox ${selectedMembers.includes(f.id) ? "selected" : ""}`}
                      whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(f.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (selectedMembers.length < 14) {
                              setSelectedMembers([...selectedMembers, f.id]);
                            }
                          } else {
                            setSelectedMembers(selectedMembers.filter(id => id !== f.id));
                          }
                        }}
                      />
                      <Avatar name={f.username} size={28} imageUrl={f.avatarUrl} />
                      <span>{f.username}</span>
                    </motion.label>
                  ))}
                </div>
                <div className="modal-actions">
                  <motion.button
                    type="button"
                    className="modal-btn secondary"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCreateGroupOpen(false)}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    className="modal-btn primary"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={!newGroupName.trim() || selectedMembers.length === 0}
                  >
                    Create
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {settingsOpen && (
        <SettingsPanel 
          onClose={() => setSettingsOpen(false)} 
          me={me}
          onLogout={onLogout}
        />
      )}

      <UserProfilePopover
        open={!!profileUser}
        onClose={() => setProfileUser(null)}
        user={profileUser}
        onlineUsers={onlineUsers}
      />

      {/* Call Bar */}
      {inCall && (
        <motion.div 
          className="call-bar"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
        >
          <div className="call-info">
            <Phone size={20} />
            <span>In call with {call.peer?.username}</span>
          </div>
          <div className="call-actions">
            <motion.button 
              className="call-btn"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Mic size={20} />
            </motion.button>
            <motion.button 
              className="call-btn end"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => call?.endCall?.()}
            >
              <Phone size={20} />
            </motion.button>
          </div>
        </motion.div>
      )}

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
    </div>
  );
}
