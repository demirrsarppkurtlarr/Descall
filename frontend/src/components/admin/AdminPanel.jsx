import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Shield, Users, MessageSquare, Activity, AlertCircle, Settings, 
  FileText, BarChart3, Bell, Search, Filter, Download, RefreshCw,
  Ban, Trash2, Eye, EyeOff, Lock, Unlock, Wifi, WifiOff, Zap,
  Database, Server, Clock, Calendar, MapPin, Smartphone, Globe,
  Mail, Send, Image, Paperclip, X, CheckCircle, AlertTriangle,
  Info, MoreHorizontal, ChevronDown, ChevronUp, Terminal, Cpu,
  HardDrive, Network, TrendingUp, TrendingDown, UserCheck,
  UserX, MessageCircle, Volume2, VolumeX, Flag, FlagOff,
  History, RotateCcw, Save, Edit3, Layers, Grid, List, PieChart,
  Activity as ActivityIcon, Box, Code, GitBranch, Layers2, Monitor,
  MousePointer, Play, Pause, Square, Maximize2, Minimize2, Copy,
  ExternalLink, FileDown, Printer, Share2, Star, ThumbsUp,
  ThumbsDown, Upload, Video, Voicemail, ZoomIn, ZoomOut
} from "lucide-react";
import { adminFetch } from "../../api/adminHttp";
import { API_BASE_URL } from "../../config/api";
import RippleButton from "../ui/RippleButton";
import AdminFeedback from "./AdminFeedback";
import AdminErrorLogs from "./AdminErrorLogs";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "dm", label: "DM", icon: Mail },
  { id: "sockets", label: "Sockets", icon: Wifi },
  { id: "errors", label: "Error Logs", icon: AlertCircle },
  { id: "feedback", label: "Feedback", icon: Bell },
  { id: "moderation", label: "Moderation", icon: Shield },
  { id: "analytics", label: "Analytics", icon: Activity },
  { id: "system", label: "System", icon: Settings },
  { id: "security", label: "Security", icon: Lock },
  { id: "maintenance", label: "Maintenance", icon: Server },
  { id: "audit", label: "Audit", icon: FileText },
];

export default function AdminPanel({ socket, onClose, onAdminChanged }) {
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [userQ, setUserQ] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [userSessions, setUserSessions] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [messages, setMessages] = useState([]);
  const [msgQ, setMsgQ] = useState("");
  const [conversations, setConversations] = useState([]);
  const [audit, setAudit] = useState([]);
  const [system, setSystem] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  
  // Enhanced Error Log States
  const [errorLogs, setErrorLogs] = useState([]);
  const [errorQ, setErrorQ] = useState("");
  const [errorSourceFilter, setErrorSourceFilter] = useState("all");
  const [errorUserFilter, setErrorUserFilter] = useState("all");
  const [errorSeverityFilter, setErrorSeverityFilter] = useState("all");
  const [errorTimeRange, setErrorTimeRange] = useState("24h");
  const [errorSources, setErrorSources] = useState([]);
  const [errorUsers, setErrorUsers] = useState([]);
  const [expandedError, setExpandedError] = useState(null);
  const [realtimeErrors, setRealtimeErrors] = useState(true);
  const [errorStats, setErrorStats] = useState(null);
  const [selectedErrors, setSelectedErrors] = useState(new Set());
  const [autoRefreshErrors, setAutoRefreshErrors] = useState(true);
  const errorLogEndRef = useRef(null);
  
  // User Feedback States
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackFilter, setFeedbackFilter] = useState("all");
  const [feedbackStatus, setFeedbackStatus] = useState("all");
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [feedbackReply, setFeedbackReply] = useState("");
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [newFeedbackCount, setNewFeedbackCount] = useState(0);
  const [feedbackCategories, setFeedbackCategories] = useState([]);
  const [feedbackPriority, setFeedbackPriority] = useState("all");
  
  // Moderation States
  const [bannedWords, setBannedWords] = useState([]);
  const [spamPatterns, setSpamPatterns] = useState([]);
  const [moderationQueue, setModerationQueue] = useState([]);
  const [autoModSettings, setAutoModSettings] = useState(null);
  const [reportedContent, setReportedContent] = useState([]);
  const [shadowBannedUsers, setShadowBannedUsers] = useState([]);
  const [slowModeSettings, setSlowModeSettings] = useState(null);
  const [ipBlacklist, setIpBlacklist] = useState([]);
  
  // Analytics States
  const [trafficData, setTrafficData] = useState([]);
  const [userGrowth, setUserGrowth] = useState([]);
  const [messageStats, setMessageStats] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [deviceStats, setDeviceStats] = useState([]);
  const [geographicData, setGeographicData] = useState([]);
  const [retentionData, setRetentionData] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState([]);
  
  // Security States
  const [failedLogins, setFailedLogins] = useState([]);
  const [suspiciousActivities, setSuspiciousActivities] = useState([]);
  const [activeThreats, setActiveThreats] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [twoFactorStats, setTwoFactorStats] = useState(null);
  const [tokenBlacklist, setTokenBlacklist] = useState([]);
  
  // Maintenance States
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [chatFrozen, setChatFrozen] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [cacheStats, setCacheStats] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  
  // UI States
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [notification, setNotification] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [dateRange, setDateRange] = useState("7d");
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [sortBy, setSortBy] = useState("timestamp");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState("json");
  const [modalContent, setModalContent] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(null);
  const [bulkAction, setBulkAction] = useState(null);
  
  // Real-time updates
  const [liveUsers, setLiveUsers] = useState([]);
  const [liveMessages, setLiveMessages] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);

  const loadStats = useCallback(async () => {
    const d = await adminFetch("/stats");
    setStats(d);
  }, []);

  const loadUsers = useCallback(async () => {
    const q = userQ ? `?q=${encodeURIComponent(userQ)}` : "";
    const d = await adminFetch(`/users${q}`);
    setUsers(d.users || []);
  }, [userQ]);

  const loadAllUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem("descall_token");
      console.log("[ADMIN] Loading users, token:", !!token);
      console.log("[ADMIN] API_BASE_URL:", API_BASE_URL);
      
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      
      console.log("[ADMIN] Users response:", d);
      
      if (d.success) {
        setUsers(d.users || []);
      } else {
        console.error("[ADMIN] Failed to load users:", d.error);
        setErr(d.error || "Failed to load users");
      }
    } catch (err) {
      console.error("[ADMIN] Error loading users:", err);
      setErr(err.message);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    const q = msgQ ? `?q=${encodeURIComponent(msgQ)}` : "";
    const d = await adminFetch(`/messages${q}`);
    setMessages(d.messages || []);
  }, [msgQ]);

  const loadDm = useCallback(async () => {
    const d = await adminFetch("/dm/conversations");
    setConversations(d.conversations || []);
  }, []);

  const loadAudit = useCallback(async () => {
    const d = await adminFetch("/audit?limit=300");
    setAudit(d.entries || []);
  }, []);

  const loadSystem = useCallback(async () => {
    const d = await adminFetch("/system");
    setSystem(d);
  }, []);

  const loadErrors = useCallback(async () => {
    const d = await adminFetch("/errors");
    const logs = Array.isArray(d) ? d : Array.isArray(d?.errors) ? d.errors : [];
    setErrorLogs(logs);
    setErrorSources(d?.sources || []);
    setErrorUsers(d?.usersWithErrors || []);
  }, []);

  useEffect(() => {
    adminFetch("/snapshot")
      .then(setSnapshot)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onSync = (p) => setSnapshot(p);
    const onUp = (p) => setSnapshot((s) => (s ? { ...s, lastEvent: p } : s));
    socket.on("admin:sync", onSync);
    socket.on("admin:update", onUp);
    socket.emit("admin:subscribe");
    return () => {
      socket.off("admin:sync", onSync);
      socket.off("admin:update", onUp);
    };
  }, [socket]);

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        await loadStats();
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [loadStats]);

  useEffect(() => {
    if (tab === "users") loadAllUsers().catch((e) => setErr(e.message));
    if (tab === "messages") loadMessages().catch((e) => setErr(e.message));
    if (tab === "dm") loadDm().catch((e) => setErr(e.message));
    if (tab === "audit") loadAudit().catch((e) => setErr(e.message));
    if (tab === "system") loadSystem().catch((e) => setErr(e.message));
    // feedback and errors tabs use their own components with internal loading
  }, [tab, loadAllUsers, loadMessages, loadDm, loadAudit, loadSystem]);

  const act = async (fn) => {
    try {
      setBusy(true);
      setErr("");
      await fn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="admin-shell"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
    >
      <header className="admin-top">
        <div>
          <h1>Administration</h1>
          <p className="admin-sub">Live moderation · backend-enforced · username === admin</p>
        </div>
        <RippleButton type="button" className="admin-close" onClick={onClose}>
          Close
        </RippleButton>
      </header>

      {err && <div className="admin-error">{err}</div>}

      <nav className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`admin-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="admin-body custom-scroll">
        {tab === "overview" && (
          <section className="admin-section">
            <h2>Server stats</h2>
            {stats && (
              <div className="admin-grid">
                <div className="admin-card">
                  <span>Uptime (s)</span>
                  <strong>{Math.floor(stats.uptime)}</strong>
                </div>
                <div className="admin-card">
                  <span>Online</span>
                  <strong>{stats.onlineUsers}</strong>
                </div>
                <div className="admin-card">
                  <span>#general msgs</span>
                  <strong>{stats.generalMessageCount}</strong>
                </div>
                <div className="admin-card">
                  <span>DM threads</span>
                  <strong>{stats.dmConversationKeys}</strong>
                </div>
                <div className="admin-card">
                  <span>Banned</span>
                  <strong>{stats.bannedUsers}</strong>
                </div>
                <div className="admin-card">
                  <span>Audit entries</span>
                  <strong>{stats.auditEntries}</strong>
                </div>
              </div>
            )}
            <RippleButton type="button" onClick={() => act(loadStats)} disabled={busy}>
              Refresh
            </RippleButton>
            {snapshot && (
              <div className="admin-live">
                <h3>Live socket snapshot</h3>
                <pre className="admin-pre">{JSON.stringify(snapshot, null, 2)}</pre>
              </div>
            )}
          </section>
        )}

        {tab === "users" && (
          <section className="admin-section">
            <div className="admin-toolbar">
              <input
                className="admin-input"
                placeholder="Search username…"
                value={userQ}
                onChange={(e) => setUserQ(e.target.value)}
              />
              <RippleButton type="button" onClick={() => act(loadAllUsers)} disabled={busy}>
                Search
              </RippleButton>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Admin</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <motion.tr key={u.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td>{u.username}</td>
                    <td className="mono">{u.id.slice(0, 8)}…</td>
                    <td className="admin-status">
                      {u.isOnline ? (
                        <span className="status-badge online">Online</span>
                      ) : (
                        <span className="status-badge offline">Offline</span>
                      )}
                    </td>
                    <td className="admin-status">
                      {u.is_admin ? (
                        <span className="admin-badge">Admin</span>
                      ) : (
                        <span className="admin-badge-false">User</span>
                      )}
                    </td>
                    <td className="admin-actions">
                      {u.is_admin ? (
                        <button
                          type="button"
                          className="admin-btn-red"
                          onClick={() =>
                            act(async () => {
                              console.log("[ADMIN] Removing admin for user:", u.id);
                              const token = localStorage.getItem("descall_token");
                              const res = await fetch(`${API_BASE_URL}/api/admin/remove-admin/${u.id}`, {
                                method: "PUT",
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              console.log("[ADMIN] Remove admin response:", res.status);
                              if (res.ok) {
                                await loadAllUsers();
                                console.log("[ADMIN] Calling onAdminChanged...");
                                onAdminChanged?.();
                              }
                            })
                          }
                        >
                          Remove Admin
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="admin-btn-green"
                          onClick={() =>
                            act(async () => {
                              console.log("[ADMIN] Making admin for user:", u.id);
                              const token = localStorage.getItem("descall_token");
                              const res = await fetch(`${API_BASE_URL}/api/admin/make-admin/${u.id}`, {
                                method: "PUT",
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              console.log("[ADMIN] Make admin response:", res.status);
                              if (res.ok) {
                                await loadAllUsers();
                                console.log("[ADMIN] Calling onAdminChanged...");
                                onAdminChanged?.();
                              }
                            })
                          }
                        >
                          Make Admin
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === "messages" && (
          <section className="admin-section">
            <div className="admin-toolbar">
              <input
                className="admin-input"
                placeholder="Search text…"
                value={msgQ}
                onChange={(e) => setMsgQ(e.target.value)}
              />
              <RippleButton type="button" onClick={() => act(loadMessages)} disabled={busy}>
                Load
              </RippleButton>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Text</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <motion.tr key={m.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td>{m.timestamp}</td>
                    <td>{m.username}</td>
                    <td className="msg-cell">{m.text}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          act(async () => {
                            await adminFetch(`/messages/${m.id}`, { method: "DELETE" });
                            await loadMessages();
                          })
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === "dm" && (
          <section className="admin-section">
            <h2>DM conversations (in-memory keys)</h2>
            <ul className="admin-list">
              {conversations.map((c) => (
                <li key={c.key}>
                  <code>{c.key}</code> — {c.messageCount} msgs
                </li>
              ))}
            </ul>
            <RippleButton
              type="button"
              onClick={() =>
                act(async () => {
                  const d = await adminFetch("/dm/export");
                  const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "dm-export.json";
                  a.click();
                })
              }
            >
              Export DM JSON
            </RippleButton>
          </section>
        )}

        {tab === "sockets" && (
          <section className="admin-section">
            <h2>Connected sockets</h2>
            <p className="muted">From latest admin:sync / admin:update</p>
            <pre className="admin-pre">{JSON.stringify(snapshot?.sockets || [], null, 2)}</pre>
            <div className="admin-row">
              <RippleButton
                type="button"
                className="danger"
                onClick={() =>
                  act(async () => {
                    await adminFetch("/sockets/kick-all", { method: "POST", body: JSON.stringify({}) });
                  })
                }
              >
                Disconnect everyone
              </RippleButton>
            </div>
          </section>
        )}

        {tab === "errors" && (
          <section className="admin-section admin-section-full">
            <AdminErrorLogs socket={socket} />
          </section>
        )}

        {tab === "feedback" && (
          <section className="admin-section admin-section-full">
            <AdminFeedback socket={socket} />
          </section>
        )}

        {tab === "moderation" && (
          <section className="admin-section">
            <h2>Content Moderation</h2>
            <p className="muted">Manage banned users, flagged messages, and content filters</p>
            
            <div className="admin-toolbar">
              <RippleButton type="button" onClick={() => act(loadSystem)} disabled={busy}>
                Refresh
              </RippleButton>
            </div>
            
            {system && (
              <div className="admin-form">
                <h3>Banned Users</h3>
                <div className="banned-users-list">
                  {system.bannedUserIds?.length > 0 ? (
                    system.bannedUserIds.map(id => (
                      <div key={id} className="banned-user-item">
                        <code>{id}</code>
                        <RippleButton 
                          type="button" 
                          className="small"
                          onClick={() => act(async () => {
                            await adminFetch(`/users/${id}/unban`, { method: "POST" });
                            await loadSystem();
                          })}
                        >
                          Unban
                        </RippleButton>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No banned users</p>
                  )}
                </div>
                
                <h3>Flagged Messages</h3>
                <div className="flagged-messages-list">
                  {system.flaggedMessages?.length > 0 ? (
                    system.flaggedMessages.map(msg => (
                      <div key={msg.id} className="flagged-message-item">
                        <span>{msg.text}</span>
                        <span className="badge">{msg.reason}</span>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No flagged messages</p>
                  )}
                </div>
                
                <h3>Profanity Filter</h3>
                <label>
                  Add word to filter
                  <input className="admin-input" id="prof-moderation" placeholder="Enter word..." />
                  <RippleButton
                    type="button"
                    onClick={() => {
                      const w = document.getElementById("prof-moderation")?.value?.trim();
                      if (!w) return;
                      act(async () => {
                        await adminFetch("/profanity", { method: "POST", body: JSON.stringify({ word: w }) });
                        await loadSystem();
                      });
                    }}
                  >
                    Add
                  </RippleButton>
                </label>
                <div className="profanity-list">
                  {system.profanityWords?.length > 0 ? (
                    system.profanityWords.map(word => (
                      <span key={word} className="profanity-tag">{word}</span>
                    ))
                  ) : (
                    <p className="muted">No filter words</p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "analytics" && (
          <section className="admin-section">
            <h2>Analytics Dashboard</h2>
            <p className="muted">Real-time system analytics and usage statistics</p>
            
            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>User Activity</h3>
                <div className="stat-row">
                  <span>Online Now:</span>
                  <strong>{snapshot?.onlineCount || 0}</strong>
                </div>
                <div className="stat-row">
                  <span>Total Connections:</span>
                  <strong>{snapshot?.sockets?.length || 0}</strong>
                </div>
                <div className="stat-row">
                  <span>Banned Users:</span>
                  <strong>{snapshot?.bannedCount || 0}</strong>
                </div>
              </div>
              
              <div className="analytics-card">
                <h3>Message Statistics</h3>
                <div className="stat-row">
                  <span>Total Messages:</span>
                  <strong>{stats?.totalMessages || 0}</strong>
                </div>
                <div className="stat-row">
                  <span>DM Conversations:</span>
                  <strong>{stats?.totalDmConversations || 0}</strong>
                </div>
                <div className="stat-row">
                  <span>Groups:</span>
                  <strong>{stats?.totalGroups || 0}</strong>
                </div>
              </div>
              
              <div className="analytics-card">
                <h3>System Health</h3>
                <div className="stat-row">
                  <span>Uptime:</span>
                  <strong>{stats?.uptime || "N/A"}</strong>
                </div>
                <div className="stat-row">
                  <span>Memory Usage:</span>
                  <strong>{stats?.memoryUsage || "N/A"}</strong>
                </div>
                <div className="stat-row">
                  <span>Last Restart:</span>
                  <strong>{stats?.lastRestart || "N/A"}</strong>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "security" && (
          <section className="admin-section">
            <h2>Security Center</h2>
            <p className="muted">Security settings and access control</p>
            
            <div className="security-grid">
              <div className="security-card">
                <h3>Access Control</h3>
                <label>
                  <input 
                    type="checkbox" 
                    checked={system?.config?.registrationEnabled !== false}
                    onChange={(e) => act(async () => {
                      await adminFetch("/system", {
                        method: "PATCH",
                        body: JSON.stringify({ registrationEnabled: e.target.checked }),
                      });
                      await loadSystem();
                    })}
                  />
                  Allow new user registrations
                </label>
                
                <label>
                  <input 
                    type="checkbox" 
                    checked={system?.config?.dmEnabled !== false}
                    onChange={(e) => act(async () => {
                      await adminFetch("/system", {
                        method: "PATCH",
                        body: JSON.stringify({ dmEnabled: e.target.checked }),
                      });
                      await loadSystem();
                    })}
                  />
                  Enable direct messages
                </label>
                
                <label>
                  <input 
                    type="checkbox" 
                    checked={system?.config?.groupCreationEnabled !== false}
                    onChange={(e) => act(async () => {
                      await adminFetch("/system", {
                        method: "PATCH",
                        body: JSON.stringify({ groupCreationEnabled: e.target.checked }),
                      });
                      await loadSystem();
                    })}
                  />
                  Allow group creation
                </label>
              </div>
              
              <div className="security-card">
                <h3>Rate Limits</h3>
                <label>
                  Max login attempts per minute
                  <input 
                    type="number" 
                    className="admin-input"
                    value={system?.config?.maxLoginAttempts || 5}
                    onChange={(e) => act(async () => {
                      await adminFetch("/system", {
                        method: "PATCH",
                        body: JSON.stringify({ maxLoginAttempts: Number(e.target.value) }),
                      });
                      await loadSystem();
                    })}
                  />
                </label>
                
                <label>
                  Max messages per minute
                  <input 
                    type="number" 
                    className="admin-input"
                    value={system?.config?.maxMessagesPerMinute || 60}
                    onChange={(e) => act(async () => {
                      await adminFetch("/system", {
                        method: "PATCH",
                        body: JSON.stringify({ maxMessagesPerMinute: Number(e.target.value) }),
                      });
                      await loadSystem();
                    })}
                  />
                </label>
              </div>
            </div>
          </section>
        )}

        {tab === "maintenance" && (
          <section className="admin-section">
            <h2>System Maintenance</h2>
            <p className="muted">System maintenance and cleanup tools</p>
            
            <div className="maintenance-grid">
              <div className="maintenance-card">
                <h3>Cache Management</h3>
                <RippleButton
                  type="button"
                  onClick={() =>
                    act(async () => {
                      await adminFetch("/cache/clear", { method: "POST" });
                      alert("Cache cleared successfully");
                    })
                  }
                >
                  Clear System Cache
                </RippleButton>
                <p className="muted">Clears all temporary caches</p>
              </div>
              
              <div className="maintenance-card">
                <h3>Log Management</h3>
                <RippleButton
                  type="button"
                  onClick={() =>
                    act(async () => {
                      await adminFetch("/logs/archive", { method: "POST" });
                      alert("Old logs archived successfully");
                    })
                  }
                >
                  Archive Old Logs
                </RippleButton>
                <p className="muted">Archives logs older than 30 days</p>
              </div>
              
              <div className="maintenance-card">
                <h3>Database</h3>
                <RippleButton
                  type="button"
                  onClick={() =>
                    act(async () => {
                      const d = await adminFetch("/backup", { method: "POST" });
                      alert("Backup created: " + d.backupId);
                    })
                  }
                >
                  Create Backup
                </RippleButton>
                <p className="muted">Creates a full system backup</p>
              </div>
              
              <div className="maintenance-card danger">
                <h3>Danger Zone</h3>
                <RippleButton
                  type="button"
                  className="danger"
                  onClick={() =>
                    act(async () => {
                      if (!window.confirm("Restart Node process?\n\nAll connections will be lost.")) return;
                      await adminFetch("/restart", { method: "POST" });
                    })
                  }
                >
                  Restart Server
                </RippleButton>
                <p className="muted warning">Immediately restarts the server</p>
              </div>
            </div>
          </section>
        )}

        {tab === "system" && (
          <section className="admin-section">
            {system && (
              <div className="admin-form">
                <label>
                  Max message length
                  <input
                    type="number"
                    defaultValue={system.config?.maxMessageLength}
                    onBlur={(e) =>
                      act(async () => {
                        await adminFetch("/system", {
                          method: "PATCH",
                          body: JSON.stringify({ maxMessageLength: Number(e.target.value) }),
                        });
                        await loadSystem();
                      })
                    }
                  />
                </label>
                <label>
                  Rate limit (ms)
                  <input
                    type="number"
                    defaultValue={system.config?.rateLimitGlobalMs}
                    onBlur={(e) =>
                      act(async () => {
                        await adminFetch("/system", {
                          method: "PATCH",
                          body: JSON.stringify({ rateLimitGlobalMs: Number(e.target.value) }),
                        });
                        await loadSystem();
                      })
                    }
                  />
                </label>
                <label>
                  Slow mode (seconds)
                  <input
                    type="number"
                    defaultValue={system.config?.slowModeSeconds}
                    onBlur={(e) =>
                      act(async () => {
                        await adminFetch("/chat/slowmode", {
                          method: "POST",
                          body: JSON.stringify({ seconds: Number(e.target.value) }),
                        });
                        await loadSystem();
                      })
                    }
                  />
                </label>
                <div className="admin-row">
                  <RippleButton
                    type="button"
                    onClick={() =>
                      act(async () => {
                        await adminFetch("/chat/freeze", {
                          method: "POST",
                          body: JSON.stringify({ frozen: !system.config?.chatFrozen }),
                        });
                        await loadSystem();
                      })
                    }
                  >
                    Toggle chat freeze
                  </RippleButton>
                  <RippleButton
                    type="button"
                    onClick={() =>
                      act(async () => {
                        await adminFetch("/maintenance", {
                          method: "POST",
                          body: JSON.stringify({ enabled: !system.config?.maintenanceMode }),
                        });
                        await loadSystem();
                      })
                    }
                  >
                    Toggle maintenance
                  </RippleButton>
                </div>
                <label>
                  Broadcast
                  <textarea
                    className="admin-textarea"
                    placeholder="Announcement text"
                    id="bc-text"
                  />
                  <RippleButton
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("bc-text");
                      const text = el?.value?.trim();
                      if (!text) return;
                      act(async () => {
                        await adminFetch("/broadcast", { method: "POST", body: JSON.stringify({ text }) });
                      });
                    }}
                  >
                    Send broadcast
                  </RippleButton>
                </label>
                <label>
                  Profanity word
                  <input className="admin-input" id="prof" />
                  <RippleButton
                    type="button"
                    onClick={() => {
                      const w = document.getElementById("prof")?.value?.trim();
                      if (!w) return;
                      act(async () => {
                        await adminFetch("/profanity", { method: "POST", body: JSON.stringify({ word: w }) });
                        await loadSystem();
                      });
                    }}
                  >
                    Add filter
                  </RippleButton>
                </label>
                <div className="admin-row">
                  <RippleButton
                    type="button"
                    onClick={() =>
                      act(async () => {
                        await adminFetch("/backup", { method: "POST", body: JSON.stringify({}) });
                      })
                    }
                  >
                    Memory backup (JSON response in network tab)
                  </RippleButton>
                  <RippleButton
                    type="button"
                    className="danger"
                    onClick={() =>
                      act(async () => {
                        if (!window.confirm("Restart Node process?")) return;
                        await adminFetch("/restart", { method: "POST", body: JSON.stringify({}) });
                      })
                    }
                  >
                    Restart server
                  </RippleButton>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "audit" && (
          <section className="admin-section">
            <table className="admin-table compact">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e.id}>
                    <td>{e.at}</td>
                    <td>{e.actorUsername}</td>
                    <td>{e.action}</td>
                    <td className="mono">{String(e.target)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </motion.div>
  );
}
