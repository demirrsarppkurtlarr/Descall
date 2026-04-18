import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../context/ToastContext";
import { 
  Hash, Users, Bell, Pin, Inbox, HelpCircle, 
  Mic, Headphones, Settings, Plus, Smile, Gift, 
  Paperclip, Send, Phone, Video, MoreVertical,
  Search, AtSign, X, ChevronDown, ChevronRight
} from "lucide-react";
import SettingsPanel from "./settings/SettingsPanel";
import UserProfilePopover from "./social/UserProfilePopover";
import RippleButton from "./ui/RippleButton";
import { getMyGroups, createGroup } from "../api/groups";
import "../styles/discord-theme.css";

// Animasyon varyantları
const slideIn = {
  hidden: { x: -20, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.3 } }
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } }
};

const messageSlide = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.3 } }
};

const popIn = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1, 
    transition: { type: "spring", stiffness: 400, damping: 25 }
  }
};

export default function ChatLayout({
  me,
  connectionLabel,
  onlineUsers,
  friends,
  friendRequests,
  notifications = [],
  activeDmUser,
  dmMessages,
  dmUnread = {},
  onOpenDm,
  onSendDm,
  onSendFriendRequest,
  onAcceptFriend,
  onDeclineFriend,
  onRemoveFriend,
  onLogout,
  onStatusChange,
  call,
}) {
  const { toast } = useToast();
  const [sidebarView, setSidebarView] = useState("dms"); // dms, friends
  const [activeGroup, setActiveGroup] = useState(null);
  const [myGroups, setMyGroups] = useState([]);
  const [composer, setComposer] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  
  const messagesEndRef = useRef(null);

  // Grupları çek
  useEffect(() => {
    if (!me) return;
    getMyGroups()
      .then((data) => setMyGroups(data.groups || []))
      .catch((err) => console.error("[Groups] Failed:", err));
  }, [me]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [dmMessages, activeDmUser]);

  // Status renkleri
  const getStatusColor = (status) => {
    const colors = {
      online: "#3ba55d",
      idle: "#faa61a",
      dnd: "#ed4245",
      offline: "#747f8d"
    };
    return colors[status] || colors.offline;
  };

  // Mesaj gönder
  const handleSend = (e) => {
    e.preventDefault();
    if (!composer.trim() || !activeDmUser) return;
    onSendDm?.(activeDmUser.id, composer.trim());
    setComposer("");
  };

  // Grup oluştur
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

  // DM listesi
  const dmList = useMemo(() => {
    return friends.map((f) => {
      const messages = dmMessages?.filter(m => 
        m.from?.id === f.id || m.to?.id === f.id
      ) || [];
      const lastMsg = messages[messages.length - 1];
      return {
        friend: f,
        unread: dmUnread[f.id] || 0,
        preview: lastMsg?.text || "",
        lastTime: lastMsg?.timestamp,
      };
    }).sort((a, b) => {
      if (!a.lastTime) return 1;
      if (!b.lastTime) return -1;
      return new Date(b.lastTime) - new Date(a.lastTime);
    });
  }, [friends, dmMessages, dmUnread]);

  return (
    <div className="discord-app" style={{ display: "flex", height: "100vh", background: "#36393f" }}>
      {/* NAV RAIL - Sunucu İkonları */}
      <nav className="nav-rail-discord">
        {/* Home */}
        <motion.div 
          className="server-icon server-home active"
          whileHover={{ scale: 1.05, borderRadius: 16 }}
          whileTap={{ scale: 0.95 }}
          title="Direct Messages"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </motion.div>

        <div className="server-divider" />

        {/* Gruplar */}
        {myGroups.map((group, i) => (
          <motion.div
            key={group.id}
            className={`server-icon ${activeGroup?.id === group.id ? "active" : ""}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.05, borderRadius: 16 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveGroup(group)}
            title={group.name}
          >
            {group.name.charAt(0).toUpperCase()}
          </motion.div>
        ))}

        {/* Add Group Button */}
        <motion.div
          className="server-icon server-add"
          whileHover={{ scale: 1.05, borderRadius: 16 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCreateGroupOpen(true)}
          title="Create Group"
        >
          <Plus size={24} />
        </motion.div>
      </nav>

      {/* SIDEBAR - DM/Friends List */}
      <aside className="sidebar-discord">
        {/* Header */}
        <div className="sidebar-header">
          <h2>{sidebarView === "dms" ? "Direct Messages" : "Friends"}</h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              style={{ 
                width: 28, 
                height: 28, 
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#b9bbbe",
                background: "transparent"
              }}
              onClick={() => setSidebarView("friends")}
            >
              <Users size={18} />
            </motion.button>
          </div>
        </div>

        {/* Content */}
        <div className="sidebar-content">
          {sidebarView === "dms" ? (
            <>
              {/* DM List */}
              {dmList.map(({ friend, unread, preview }, i) => (
                <motion.div
                  key={friend.id}
                  className={`dm-item-discord ${activeDmUser?.id === friend.id ? "active" : ""}`}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                  onClick={() => onOpenDm(friend)}
                >
                  <div className="dm-avatar-discord" style={{ background: friend.color || "#5865F2" }}>
                    {friend.username.charAt(0).toUpperCase()}
                    <span 
                      className="status-indicator" 
                      style={{ 
                        background: getStatusColor(friend.status),
                        border: "3px solid #2f3136"
                      }}
                    />
                  </div>
                  <div className="dm-info">
                    <div className="dm-name">{friend.username}</div>
                    <div className="dm-preview">
                      {unread > 0 ? `${unread} new message${unread > 1 ? "s" : ""}` : preview}
                    </div>
                  </div>
                  {unread > 0 && (
                    <motion.div 
                      className="unread-badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      {unread}
                    </motion.div>
                  )}
                </motion.div>
              ))}

              {/* Friends Online */}
              <div className="channel-category">
                <ChevronRight size={12} />
                ONLINE — {onlineUsers.filter(u => u.status === "online").length}
              </div>
            </>
          ) : (
            <>
              {/* Friends View */}
              <div className="channel-category">FRIENDS</div>
              {friends.map((friend, i) => (
                <motion.div
                  key={friend.id}
                  className="channel-item"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => { setSidebarView("dms"); onOpenDm(friend); }}
                >
                  <Users size={20} />
                  <span className="channel-name">{friend.username}</span>
                  <div className="channel-actions">
                    <motion.button
                      className="channel-action-btn"
                      whileHover={{ scale: 1.1 }}
                      onClick={(e) => { e.stopPropagation(); call?.startCall?.(friend, "voice"); }}
                    >
                      <Phone size={16} />
                    </motion.button>
                    <motion.button
                      className="channel-action-btn"
                      whileHover={{ scale: 1.1 }}
                      onClick={(e) => { e.stopPropagation(); call?.startCall?.(friend, "video"); }}
                    >
                      <Video size={16} />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </>
          )}
        </div>

        {/* User Bar */}
        <div style={{ 
          padding: "8px 16px", 
          background: "#292b2f",
          display: "flex",
          alignItems: "center",
          gap: 12
        }}>
          <div 
            className="dm-avatar-discord" 
            style={{ cursor: "pointer" }}
            onClick={() => setProfileUser(me)}
          >
            {me?.username?.charAt(0).toUpperCase()}
            <span 
              className="status-indicator" 
              style={{ background: "#3ba55d", border: "3px solid #292b2f" }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{me?.username}</div>
            <div style={{ fontSize: 12, color: "#b9bbbe" }}>Online</div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{ color: "#b9bbbe" }}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={20} />
          </motion.button>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="chat-container">
        {/* Header */}
        <motion.header 
          className="chat-header"
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeDmUser ? (
            <>
              <div className="chat-header-icon">
                <AtSign size={24} color="#72767d" />
              </div>
              <div className="chat-header-title">{activeDmUser.username}</div>
              <div className="chat-header-divider" />
              <div className="chat-header-topic">
                This is the beginning of your direct message history with @{activeDmUser.username}
              </div>
              <div className="chat-header-actions">
                <motion.button 
                  className="chat-header-btn"
                  whileHover={{ scale: 1.1 }}
                  onClick={() => call?.startCall?.(activeDmUser, "voice")}
                >
                  <Phone size={20} />
                </motion.button>
                <motion.button 
                  className="chat-header-btn"
                  whileHover={{ scale: 1.1 }}
                  onClick={() => call?.startCall?.(activeDmUser, "video")}
                >
                  <Video size={20} />
                </motion.button>
                <motion.button className="chat-header-btn" whileHover={{ scale: 1.1 }}>
                  <Pin size={20} />
                </motion.button>
                <motion.button className="chat-header-btn" whileHover={{ scale: 1.1 }}>
                  <Users size={20} />
                </motion.button>
              </div>
            </>
          ) : activeGroup ? (
            <>
              <div className="chat-header-icon">
                <Hash size={24} color="#72767d" />
              </div>
              <div className="chat-header-title">{activeGroup.name}</div>
              <div className="chat-header-divider" />
              <div className="chat-header-topic">Group chat</div>
            </>
          ) : (
            <div className="chat-header-title">Select a conversation</div>
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
                  className="welcome-icon"
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="#5865F2">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                  </svg>
                </motion.div>
                <div className="welcome-title">Welcome to Descall</div>
                <div className="welcome-subtitle">
                  Select a friend from the sidebar to start messaging
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="messages"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {dmMessages?.map((msg, i) => (
                  <motion.div
                    key={msg.id || i}
                    className="message"
                    variants={messageSlide}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: i * 0.05 }}
                  >
                    <motion.div 
                      className="message-avatar"
                      whileHover={{ scale: 1.1 }}
                      style={{ 
                        background: msg.from?.id === me?.id 
                          ? "#5865F2" 
                          : "#3ba55d"
                      }}
                    >
                      {msg.from?.username?.charAt(0).toUpperCase()}
                    </motion.div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-author">
                          {msg.from?.username}
                        </span>
                        <span className="message-timestamp">
                          {new Date(msg.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="message-text">{msg.text}</div>
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Composer */}
        {activeDmUser && (
          <motion.div 
            className="composer-discord"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <form className="composer-inner" onSubmit={handleSend}>
              <motion.button
                type="button"
                className="composer-btn"
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.1)" }}
                whileTap={{ scale: 0.9 }}
              >
                <Plus size={20} />
              </motion.button>
              
              <input
                className="composer-input"
                placeholder={`Message @${activeDmUser.username}`}
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
              />
              
              <motion.button
                type="button"
                className="composer-btn"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Gift size={20} />
              </motion.button>
              
              <motion.button
                type="button"
                className="composer-btn"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Paperclip size={20} />
              </motion.button>
              
              <motion.button
                type="button"
                className="composer-btn"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Smile size={20} />
              </motion.button>
              
              <motion.button
                type="submit"
                className="composer-send"
                disabled={!composer.trim()}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Send size={18} />
              </motion.button>
            </form>
          </motion.div>
        )}
      </main>

      {/* RIGHT PANEL - User Profile */}
      <aside className="right-panel">
        <AnimatePresence>
          {activeDmUser && (
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 50, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="user-profile-card">
                <motion.div 
                  className="user-profile-avatar"
                  whileHover={{ scale: 1.05 }}
                  style={{ background: activeDmUser.color || "#5865F2" }}
                >
                  {activeDmUser.username.charAt(0).toUpperCase()}
                </motion.div>
                <div className="user-profile-name">{activeDmUser.username}</div>
                <div className="user-profile-status">
                  <span 
                    style={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: "50%",
                      background: getStatusColor(activeDmUser.status)
                    }}
                  />
                  {activeDmUser.status?.toUpperCase() || "OFFLINE"}
                </div>
              </div>

              <div className="user-actions">
                <motion.button
                  className="user-action-btn"
                  whileHover={{ x: 4, backgroundColor: "rgba(255,255,255,0.1)" }}
                  onClick={() => call?.startCall?.(activeDmUser, "voice")}
                >
                  <Phone size={16} />
                  Voice Call
                </motion.button>
                <motion.button
                  className="user-action-btn"
                  whileHover={{ x: 4, backgroundColor: "rgba(255,255,255,0.1)" }}
                  onClick={() => call?.startCall?.(activeDmUser, "video")}
                >
                  <Video size={16} />
                  Video Call
                </motion.button>
                <motion.button
                  className="user-action-btn"
                  whileHover={{ x: 4, backgroundColor: "rgba(255,255,255,0.1)" }}
                >
                  <Users size={16} />
                  View Profile
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      {/* Create Group Modal */}
      <AnimatePresence>
        {createGroupOpen && (
          <motion.div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCreateGroupOpen(false)}
          >
            <motion.div
              style={{
                background: "#36393f",
                borderRadius: 8,
                padding: 24,
                width: 400,
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)"
              }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16, color: "#fff" }}>
                Create Group
              </h2>
              <form onSubmit={handleCreateGroup}>
                <input
                  style={{
                    width: "100%",
                    padding: 12,
                    background: "#40444b",
                    border: "1px solid #202225",
                    borderRadius: 4,
                    color: "#fff",
                    marginBottom: 16,
                    fontSize: 16
                  }}
                  placeholder="Group Name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: "#b9bbbe", marginBottom: 8, textTransform: "uppercase" }}>
                    Select Friends ({selectedMembers.length}/14)
                  </div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {friends.map((f) => (
                      <motion.label
                        key={f.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: 8,
                          borderRadius: 4,
                          cursor: "pointer",
                          background: selectedMembers.includes(f.id) ? "rgba(88,101,242,0.2)" : "transparent"
                        }}
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
                        <div className="dm-avatar-discord" style={{ width: 28, height: 28 }}>
                          {f.username.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ color: "#fff" }}>{f.username}</span>
                      </motion.label>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <motion.button
                    type="button"
                    style={{
                      padding: "10px 24px",
                      borderRadius: 4,
                      background: "transparent",
                      color: "#fff",
                      border: "none"
                    }}
                    whileHover={{ background: "rgba(255,255,255,0.1)" }}
                    onClick={() => setCreateGroupOpen(false)}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    style={{
                      padding: "10px 24px",
                      borderRadius: 4,
                      background: "#5865F2",
                      color: "#fff",
                      border: "none",
                      fontWeight: 600
                    }}
                    whileHover={{ background: "#4752C4" }}
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

      {/* Settings Modal */}
      {settingsOpen && (
        <SettingsPanel onClose={() => setSettingsOpen(false)} me={me} />
      )}

      {/* User Profile Popover */}
      <UserProfilePopover
        open={!!profileUser}
        onClose={() => setProfileUser(null)}
        user={profileUser}
        onlineUsers={onlineUsers}
      />
    </div>
  );
}
