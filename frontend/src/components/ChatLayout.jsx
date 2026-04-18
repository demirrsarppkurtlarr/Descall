import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../context/ToastContext";
import "../styles/discord.css";
import { 
  MessageSquare, Users, UserPlus, Bell, Circle, 
  Settings, Send, Paperclip, Phone, Video, X, Plus, 
  Clock, Hash, AtSign, Search, LogOut, MoreVertical, 
  ChevronRight, ChevronDown, Smile, Gift, Pin, Inbox, 
  HelpCircle, Headphones, Mic, Volume2, Monitor, PhoneOff,
  Check, CheckCheck, Trash2, UserX, Shield, Crown,
  Moon, Sun, Palette, VolumeX, Maximize2, Grid3X3
} from "lucide-react";
import SettingsPanel from "./settings/SettingsPanel";
import VideoConference from "./VideoConference";
import UserProfilePopover from "./social/UserProfilePopover";
import RippleButton from "./ui/RippleButton";
import Avatar from "./ui/Avatar";
import { getMyGroups, createGroup } from "../api/groups";

// ============ ANIMATION VARIANTS ============
const slideInLeft = { hidden: { x: -30, opacity: 0 }, visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } } };
const slideInRight = { hidden: { x: 30, opacity: 0 }, visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } } };
const fadeIn = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.3 } } };
const scaleIn = { hidden: { scale: 0.8, opacity: 0 }, visible: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 400, damping: 25 } } };
const messageVariant = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 500, damping: 30 } } };
const staggerContainer = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } } };

// ============ STATUS COMPONENTS ============
const StatusBadge = ({ status = "offline", size = 12 }) => {
  const colors = { online: "#3ba55d", idle: "#faa61a", dnd: "#ed4245", offline: "#747f8d" };
  return <span style={{ width: size, height: size, borderRadius: "50%", background: colors[status] || colors.offline, border: `2px solid #2f3136`, display: "inline-block" }} />;
};

// ============ UI COMPONENTS ============
const ServerIcon = ({ children, active, onClick, tooltip, delay = 0, color }) => (
  <motion.div className={`server-icon ${active ? "active" : ""}`} style={{ background: color || (active ? "#5865f2" : "#36393f") }} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay, type: "spring", stiffness: 400, damping: 20 }} whileHover={{ scale: 1.08, borderRadius: 16 }} whileTap={{ scale: 0.92 }} onClick={onClick} title={tooltip}>
    {children}
  </motion.div>
);

const DMItem = ({ friend, active, unread, preview, onClick, index, status }) => (
  <motion.div className={`dm-item ${active ? "active" : ""}`} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: index * 0.03, type: "spring", stiffness: 400 }} whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }} onClick={onClick}>
    <div className="dm-avatar"><Avatar name={friend.username} size={32} imageUrl={friend.avatarUrl} />
      <div className="dm-status"><StatusBadge status={status || friend.status} size={10} /></div>
    </div>
    <div className="dm-info"><div className="dm-name">{friend.username}</div><div className="dm-preview">{preview || "No messages yet"}</div></div>
    {unread > 0 && <motion.div className="dm-badge" initial={{ scale: 0 }} animate={{ scale: 1 }}>{unread}</motion.div>}
  </motion.div>
);

const ChannelItem = ({ icon: Icon, name, active, onClick, index, count }) => (
  <motion.div className={`channel-item ${active ? "active" : ""}`} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: index * 0.03 }} whileHover={{ backgroundColor: "rgba(255,255,255,0.03)", x: 4 }} onClick={onClick}>
    <Icon size={18} /><span className="channel-name">{name}</span>{count > 0 && <span className="channel-count">{count}</span>}
  </motion.div>
);

const Message = ({ msg, me, index }) => {
  const fromSelf = msg.from?.id === me?.id;
  return (
    <motion.div className={`message ${fromSelf ? "own" : ""}`} variants={messageVariant} initial="hidden" animate="visible" transition={{ delay: index * 0.03 }} whileHover={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
      <motion.div className="message-avatar" whileHover={{ scale: 1.1, rotate: 5 }}>
        <Avatar name={msg.from?.username} size={40} imageUrl={msg.from?.avatarUrl} />
      </motion.div>
      <div className="message-content">
        <div className="message-header">
          <span className="message-author" style={{ color: fromSelf ? "#5865F2" : "#fff" }}>{msg.from?.username}</span>
          <span className="message-time">{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="message-text">{msg.text}</div>
      </div>
    </motion.div>
  );
};

const Composer = ({ value, onChange, onSubmit, placeholder, disabled }) => (
  <motion.form className="composer" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, type: "spring" }} onSubmit={onSubmit}>
    <div className="composer-inner">
      <motion.button type="button" className="composer-btn gift" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><Gift size={22} /></motion.button>
      <motion.button type="button" className="composer-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><Plus size={22} /></motion.button>
      <input className="composer-input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      <motion.button type="button" className="composer-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><Paperclip size={22} /></motion.button>
      <motion.button type="button" className="composer-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><Smile size={22} /></motion.button>
      <motion.button type="submit" className="composer-send" disabled={disabled || !value.trim()} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><Send size={20} /></motion.button>
    </div>
  </motion.form>
);

// ============ MAIN LAYOUT ============
export default function ChatLayout({
  me, connectionLabel, reconnectState, authError, myStatus, onlineUsers, friends, friendRequests,
  notifications = [], activeDmUser, dmMessages, dmUnread = {}, dmByUserId = {}, typingDmUser,
  onOpenDm, onSendDm, onSendDmMedia, onSendFriendRequest, onAcceptFriend, onDeclineFriend, onRemoveFriend,
  onLogout, onStatusChange, friendNotice, call, onTypingDmStart, onTypingDmStop, groupCall,
}) {
  const { toast } = useToast();
  const [sidebarView, setSidebarView] = useState("dms"); // dms, friends, online, pending, blocked
  const [activeGroup, setActiveGroup] = useState(() => { try { const saved = localStorage.getItem("descall_active_group"); return saved ? JSON.parse(saved) : null; } catch { return null; } });
  const [myGroups, setMyGroups] = useState([]);
  const [composer, setComposer] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [friendUsername, setFriendUsername] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [friendFilter, setFriendFilter] = useState("all"); // all, online, pending, blocked
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [showVideoConference, setShowVideoConference] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const wasTypingRef = useRef(false);

  // Fetch groups
  useEffect(() => { if (!me) return; getMyGroups().then((data) => setMyGroups(data.groups || [])).catch(() => setMyGroups([])); }, [me]);

  // Typing
  const flushTyping = useCallback(() => { if (wasTypingRef.current && activeDmUser) { onTypingDmStop?.(activeDmUser.id); wasTypingRef.current = false; } if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; } }, [activeDmUser, onTypingDmStop]);
  useEffect(() => () => flushTyping(), [flushTyping]);

  // Scroll
  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, []);
  useEffect(() => { scrollToBottom(); }, [dmMessages, activeDmUser, scrollToBottom]);

  // Handlers
  const handleSend = (e) => { e.preventDefault(); if (!composer.trim() || !activeDmUser) return; flushTyping(); onSendDm?.(activeDmUser.id, composer.trim()); setComposer(""); scrollToBottom(); };
  const handleComposerChange = (value) => { setComposer(value); if (!wasTypingRef.current && activeDmUser) { wasTypingRef.current = true; onTypingDmStart?.(activeDmUser.id); } if (typingTimerRef.current) clearTimeout(typingTimerRef.current); typingTimerRef.current = setTimeout(() => flushTyping(), 1800); };
  const handleOpenGroup = (group) => { setActiveGroup(group); try { localStorage.setItem("descall_active_group", JSON.stringify(group)); } catch {} onOpenDm?.(null); };
  const handleCreateGroup = async (e) => { e.preventDefault(); if (!newGroupName.trim() || selectedMembers.length === 0) return; try { const result = await createGroup({ name: newGroupName.trim(), memberIds: selectedMembers }); setMyGroups((prev) => [result.group, ...prev]); setCreateGroupOpen(false); setNewGroupName(""); setSelectedMembers([]); toast?.success?.("Group created!"); } catch (err) { toast?.error?.(err.message || "Failed"); } };
  const handleSendFriendRequest = (e) => { e.preventDefault(); if (!friendUsername.trim()) return; onSendFriendRequest?.(friendUsername); setFriendUsername(""); setAddFriendOpen(false); };

  // Lists
  const safeFriends = friends || [];
  const safeFriendRequests = friendRequests || [];
  const dmList = useMemo(() => safeFriends.map((f) => { const messages = dmByUserId[f.id] || []; const last = messages[messages.length - 1]; return { friend: f, unread: dmUnread[f.id] || 0, preview: last?.text || "", status: f.status }; }).sort((a, b) => (b.unread > 0 ? 1 : -1)), [safeFriends, dmByUserId, dmUnread]);
  const filteredFriends = useMemo(() => { let list = [...safeFriends]; if (friendFilter === "online") list = list.filter(f => f.status === "online"); if (searchQuery) list = list.filter(f => f.username.toLowerCase().includes(searchQuery.toLowerCase())); return list; }, [safeFriends, friendFilter, searchQuery]);
  const onlineCount = safeFriends.filter(f => f.status === "online").length;
  const pendingCount = safeFriendRequests.length;
  const typingNamesDm = typingDmUser ? [typingDmUser.username] : [];
  const inCall = call?.mode === "active" || call?.mode === "outgoing";

  return (
    <div className="discord-app">
      {/* ============ NAV RAIL ============ */}
      <motion.nav className="nav-rail" variants={slideInLeft} initial="hidden" animate="visible">
        <ServerIcon active={!activeGroup && sidebarView === "dms"} onClick={() => { setActiveGroup(null); setSidebarView("dms"); onOpenDm?.(null); }} tooltip="Direct Messages"><svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg></ServerIcon>
        <div className="server-divider" />
        {myGroups.map((group, i) => (<ServerIcon key={group.id} active={activeGroup?.id === group.id} onClick={() => handleOpenGroup(group)} tooltip={group.name} delay={i * 0.05}>{group.name.charAt(0).toUpperCase()}</ServerIcon>))}
        <ServerIcon onClick={() => setCreateGroupOpen(true)} tooltip="Create Group" color="#36393f"><Plus size={24} /></ServerIcon>
        {notifications.length > 0 && <div className="notification-pill">{notifications.length}</div>}
      </motion.nav>

      {/* ============ SIDEBAR ============ */}
      <motion.aside className="sidebar" variants={slideInLeft} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
        {/* Header */}
        <div className="sidebar-header">
          <h2>{sidebarView === "dms" ? "Direct Messages" : sidebarView === "friends" ? "Friends" : "Online"}</h2>
          <div className="header-actions">
            <motion.button className="header-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setSidebarView(sidebarView === "dms" ? "friends" : "dms")}>{sidebarView === "dms" ? <Users size={18} /> : <MessageSquare size={18} />}</motion.button>
            {sidebarView === "friends" && <motion.button className="header-btn add" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setAddFriendOpen(true)}><UserPlus size={18} /></motion.button>}
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-bar"><Search size={16} /><input type="text" placeholder={sidebarView === "friends" ? "Search friends..." : "Find a conversation..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>

        {/* Content */}
        <motion.div className="sidebar-content" variants={staggerContainer} initial="hidden" animate="visible">
          <AnimatePresence mode="wait">
            {sidebarView === "dms" ? (
              <motion.div key="dms" variants={fadeIn}>
                <div className="category-header"><ChevronRight size={12} />ONLINE — {onlineCount}</div>
                {dmList.filter(d => d.friend.status === "online" || d.unread > 0).map(({ friend, unread, preview, status }, i) => (
                  <DMItem key={friend.id} friend={friend} active={activeDmUser?.id === friend.id} unread={unread} preview={preview} onClick={() => { setActiveGroup(null); onOpenDm?.(friend); }} index={i} status={status} />
                ))}
                <div className="category-header" style={{ marginTop: 16 }}><ChevronRight size={12} />OFFLINE — {friends.length - onlineCount}</div>
                {dmList.filter(d => d.friend.status !== "online" && d.unread === 0).map(({ friend, unread, preview, status }, i) => (
                  <DMItem key={friend.id} friend={friend} active={activeDmUser?.id === friend.id} unread={unread} preview={preview} onClick={() => { setActiveGroup(null); onOpenDm?.(friend); }} index={i} status={status} />
                ))}
              </motion.div>
            ) : sidebarView === "friends" ? (
              <motion.div key="friends" variants={fadeIn}>
                {/* Friend Tabs */}
                <div className="friend-tabs">
                  <button className={friendFilter === "all" ? "active" : ""} onClick={() => setFriendFilter("all")}>All<span>{friends.length}</span></button>
                  <button className={friendFilter === "online" ? "active" : ""} onClick={() => setFriendFilter("online")}>Online<span>{onlineCount}</span></button>
                  <button className={friendFilter === "pending" ? "active" : ""} onClick={() => setFriendFilter("pending")}>Pending<span>{pendingCount}</span></button>
                </div>
                
                {/* Friend List */}
                <div className="category-header" style={{ marginTop: 8 }}>{friendFilter.toUpperCase()} — {filteredFriends.length}</div>
                {filteredFriends.map((friend, i) => (
                  <motion.div key={friend.id} className={`friend-row ${activeDmUser?.id === friend.id ? "active" : ""}`} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.02 }} whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <div className="friend-avatar"><Avatar name={friend.username} size={32} imageUrl={friend.avatarUrl} /><div className="friend-status"><StatusBadge status={friend.status} size={10} /></div></div>
                    <div className="friend-info" onClick={() => onOpenDm?.(friend)}>
                      <div className="friend-name">{friend.username}</div>
                      <div className="friend-status-text">{friend.status}</div>
                    </div>
                    <div className="friend-actions">
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => call?.startCall?.(friend, "voice")} disabled={inCall}><Phone size={16} /></motion.button>
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => call?.startCall?.(friend, "video")} disabled={inCall}><Video size={16} /></motion.button>
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="danger" onClick={() => onRemoveFriend?.(friend.id)}><Trash2 size={16} /></motion.button>
                    </div>
                  </motion.div>
                ))}
                
                {/* Pending Requests */}
                {friendFilter === "pending" && safeFriendRequests.length > 0 && (
                  <>
                    <div className="category-header" style={{ marginTop: 16 }}>INCOMING REQUESTS — {safeFriendRequests.length}</div>
                    {safeFriendRequests.map((req, i) => (
                      <motion.div key={req.id} className="friend-row pending" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.02 }}>
                        <div className="friend-avatar"><Avatar name={req.username} size={32} /></div>
                        <div className="friend-info"><div className="friend-name">{req.username}</div><div className="friend-status-text">Incoming request</div></div>
                        <div className="friend-actions">
                          <motion.button className="accept" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => onAcceptFriend?.(req.id)}><Check size={16} /></motion.button>
                          <motion.button className="decline" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => onDeclineFriend?.(req.id)}><X size={16} /></motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>

        {/* User Bar */}
        <motion.div className="user-bar" initial={{ y: 50 }} animate={{ y: 0 }} transition={{ delay: 0.3 }}>
          <div className="user-info" onClick={() => setProfileUser(me)}>
            <div className="user-avatar"><Avatar name={me?.username} size={32} imageUrl={me?.avatarUrl} /><div className="user-status"><StatusBadge status={myStatus} size={10} /></div></div>
            <div className="user-details"><div className="user-name">{me?.username}</div><div className="user-status-text">{myStatus}</div></div>
          </div>
          <div className="user-actions">
            <motion.button className="user-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setSettingsOpen(true)}><Settings size={18} /></motion.button>
            <motion.button className="user-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onLogout}><LogOut size={18} /></motion.button>
          </div>
        </motion.div>
      </motion.aside>

      {/* ============ MAIN CHAT ============ */}
      <main className="main-chat">
        <motion.header className="chat-header" initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 400 }}>
          {activeDmUser ? (<><div className="chat-icon"><AtSign size={24} /></div><div className="chat-title">{activeDmUser.username}</div><div className="chat-divider" /><div className="chat-topic">This is the beginning of your DM with @{activeDmUser.username}</div>
            <div className="chat-actions">
              <motion.button className="chat-action-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => call?.startCall?.(activeDmUser, "voice")} disabled={inCall}><Phone size={20} /></motion.button>
              <motion.button className="chat-action-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => call?.startCall?.(activeDmUser, "video")} disabled={inCall}><Video size={20} /></motion.button>
              <motion.button className="chat-action-btn" whileHover={{ scale: 1.1 }}><Pin size={20} /></motion.button>
              <motion.button className="chat-action-btn" whileHover={{ scale: 1.1 }}><Users size={20} /></motion.button>
              <motion.button className="chat-action-btn" whileHover={{ scale: 1.1 }} onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={20} />{notifications.length > 0 && <span className="notif-dot" />}</motion.button>
            </div></>) : activeGroup ? (<><div className="chat-icon"><Hash size={24} /></div><div className="chat-title">{activeGroup.name}</div><div className="chat-divider" /><div className="chat-topic">{myGroups.find(g => g.id === activeGroup.id)?.memberCount || 0} members</div></>) : (<div className="chat-title">Select a conversation</div>)}
        </motion.header>

        <div className="messages-container">
          <AnimatePresence mode="wait">
            {!activeDmUser && !activeGroup ? (
              <motion.div key="welcome" className="welcome-screen" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.4 }}>
                <motion.div animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}><svg width="80" height="80" viewBox="0 0 24 24" fill="#5865F2"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg></motion.div>
                <h1>Welcome to Descall</h1><p>Select a friend from the sidebar to start messaging</p>
                <div className="quick-actions">
                  <motion.button className="quick-btn" whileHover={{ scale: 1.02 }} onClick={() => setSidebarView("friends")}><Users size={18} /> View Friends</motion.button>
                  <motion.button className="quick-btn" whileHover={{ scale: 1.02 }} onClick={() => setAddFriendOpen(true)}><UserPlus size={18} /> Add Friend</motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="messages" className="messages-list" variants={staggerContainer} initial="hidden" animate="visible">
                {dmMessages?.map((msg, i) => (<Message key={msg.id || i} msg={msg} me={me} index={i} />))}
                {typingNamesDm.length > 0 && (<motion.div className="typing-indicator" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><div className="typing-dots"><span /><span /><span /></div><span>{typingNamesDm.join(", ")} is typing...</span></motion.div>)}
                <div ref={messagesEndRef} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {activeDmUser && <Composer value={composer} onChange={handleComposerChange} onSubmit={handleSend} placeholder={`Message @${activeDmUser.username}`} disabled={!activeDmUser} />}
      </main>

      {/* ============ RIGHT PANEL ============ */}
      <AnimatePresence>{activeDmUser && (<motion.aside className="right-panel" variants={slideInRight} initial="hidden" animate="visible" exit={{ x: 50, opacity: 0 }}>
        <div className="profile-card">
          <motion.div className="profile-avatar-large" whileHover={{ scale: 1.05 }}><Avatar name={activeDmUser.username} size={80} imageUrl={activeDmUser.avatarUrl} /><div className="profile-status-large"><StatusBadge status={activeDmUser.status} size={16} /></div></motion.div>
          <h2 className="profile-name">{activeDmUser.username}</h2>
          <div className="profile-status"><StatusBadge status={activeDmUser.status} size={8} /><span>{activeDmUser.status?.toUpperCase() || "OFFLINE"}</span></div>
          <div className="profile-section">
            <div className="section-title">About Me</div>
            <div className="section-content">Hey there! I'm using Descall.</div>
          </div>
          <div className="profile-actions">
            <motion.button className="profile-action-btn primary" whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => call?.startCall?.(activeDmUser, "voice")} disabled={inCall}><Phone size={18} /> Voice Call</motion.button>
            <motion.button className="profile-action-btn primary" whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => call?.startCall?.(activeDmUser, "video")} disabled={inCall}><Video size={18} /> Video Call</motion.button>
            <motion.button className="profile-action-btn" whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }}><MessageSquare size={18} /> Message</motion.button>
            <motion.button className="profile-action-btn danger" whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }} onClick={() => onRemoveFriend?.(activeDmUser.id)}><UserX size={18} /> Remove Friend</motion.button>
          </div>
        </div>
      </motion.aside>)}</AnimatePresence>

      {/* ============ MODALS ============ */}
      <AnimatePresence>
        {createGroupOpen && (<ModalOverlay onClose={() => setCreateGroupOpen(false)}><motion.div className="modal-content large" variants={scaleIn} initial="hidden" animate="visible" exit={{ scale: 0.9, opacity: 0 }}><h2>Create a Server</h2><p>Choose a name for your new group</p><form onSubmit={handleCreateGroup}><input className="modal-input" placeholder="Server Name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} maxLength={50} /><div className="member-count">{selectedMembers.length}/14 friends selected</div><div className="friends-list compact">{safeFriends.map((f) => (<motion.label key={f.id} className={`friend-checkbox ${selectedMembers.includes(f.id) ? "selected" : ""}`} whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}><input type="checkbox" checked={selectedMembers.includes(f.id)} onChange={(e) => { if (e.target.checked) { if (selectedMembers.length < 14) setSelectedMembers([...selectedMembers, f.id]); } else { setSelectedMembers(selectedMembers.filter(id => id !== f.id)); } }} /><Avatar name={f.username} size={28} imageUrl={f.avatarUrl} /><span>{f.username}</span></motion.label>))}</div><div className="modal-actions"><motion.button type="button" className="modal-btn secondary" whileHover={{ scale: 1.02 }} onClick={() => setCreateGroupOpen(false)}>Cancel</motion.button><motion.button type="submit" className="modal-btn primary" whileHover={{ scale: 1.02 }} disabled={!newGroupName.trim() || selectedMembers.length === 0}>Create</motion.button></div></form></motion.div></ModalOverlay>)}
        {addFriendOpen && (<ModalOverlay onClose={() => setAddFriendOpen(false)}><motion.div className="modal-content" variants={scaleIn} initial="hidden" animate="visible" exit={{ scale: 0.9, opacity: 0 }}><h2>Add Friend</h2><p>You can add friends by their username</p><form onSubmit={handleSendFriendRequest}><input className="modal-input" placeholder="Enter username" value={friendUsername} onChange={(e) => setFriendUsername(e.target.value)} /><div className="modal-actions"><motion.button type="button" className="modal-btn secondary" whileHover={{ scale: 1.02 }} onClick={() => setAddFriendOpen(false)}>Cancel</motion.button><motion.button type="submit" className="modal-btn primary" whileHover={{ scale: 1.02 }} disabled={!friendUsername.trim()}>Send Friend Request</motion.button></div></form></motion.div></ModalOverlay>)}
        {notificationsOpen && (<ModalOverlay onClose={() => setNotificationsOpen(false)}><motion.div className="modal-content notifications" variants={scaleIn} initial="hidden" animate="visible" exit={{ scale: 0.9, opacity: 0 }}><h2>Notifications</h2>{notifications.length === 0 ? <p className="empty">No new notifications</p> : notifications.map((n, i) => (<motion.div key={n.id} className="notification-item" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}><div className="notif-icon"><Bell size={18} /></div><div className="notif-content"><div className="notif-title">{n.title}</div><div className="notif-body">{n.body}</div></div><motion.button className="notif-close" whileHover={{ scale: 1.1 }} onClick={() => {}}><X size={16} /></motion.button></motion.div>))}</motion.div></ModalOverlay>)}
      </AnimatePresence>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} me={me} onLogout={onLogout} />}
      <UserProfilePopover open={!!profileUser} onClose={() => setProfileUser(null)} user={profileUser} onlineUsers={onlineUsers} />
      {inCall && <CallBar call={call} onEnd={() => call?.endCall?.()} />}
      <VideoConference isOpen={groupCall?.isInCall || false} onClose={groupCall?.leaveCall || (() => {})} call={groupCall} participants={groupCall?.participants || []} localStream={groupCall?.localStream} screenStream={groupCall?.screenStream} isMuted={groupCall?.isMuted || false} isCameraOn={groupCall?.isCameraOn || false} isScreenSharing={groupCall?.isScreenSharing || false} toggleMute={groupCall?.toggleMute || (() => {})} toggleCamera={groupCall?.toggleCamera || (() => {})} startScreenShare={groupCall?.startScreenShare || (() => {})} stopScreenShare={groupCall?.stopScreenShare || (() => {})} leaveCall={groupCall?.leaveCall || (() => {})} callType={groupCall?.callType} dominantSpeaker={groupCall?.dominantSpeaker} focusedParticipant={groupCall?.focusedParticipant} setFocusedParticipant={groupCall?.setFocusedParticipant || (() => {})} />
    </div>
  );
}

// ============ HELPER COMPONENTS ============
const ModalOverlay = ({ children, onClose }) => (
  <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    {children}
  </motion.div>
);

const CallBar = ({ call, onEnd }) => (
  <motion.div className="call-bar" initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}>
    <div className="call-info">
      <div className="call-avatar"><Avatar name={call.peer?.username} size={40} imageUrl={call.peer?.avatarUrl} /></div>
      <div className="call-details">
        <div className="call-name">{call.peer?.username}</div>
        <div className="call-type">{call.callType} call • 00:00</div>
      </div>
    </div>
    <div className="call-controls">
      <motion.button className="call-control" whileHover={{ scale: 1.1 }}><Mic size={20} /></motion.button>
      <motion.button className="call-control" whileHover={{ scale: 1.1 }}><Volume2 size={20} /></motion.button>
      <motion.button className="call-control end" whileHover={{ scale: 1.1 }} onClick={onEnd}><PhoneOff size={20} /></motion.button>
    </div>
  </motion.div>
);
