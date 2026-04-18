import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { adminFetch } from "../../api/adminHttp";
import RippleButton from "../ui/RippleButton";

function fmtUptime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${h}h ${m}m ${sec}s`;
}
function fmtBytes(b) {
  if (b == null) return "—";
  if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024).toFixed(1)} KB`;
}
function fmtMs(ms) {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h) return `${h}h ${m % 60}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function Badge({ color = "var(--accent)", children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {children}
    </span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4, borderLeft: color ? `3px solid ${color}` : undefined }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
      <strong style={{ fontSize: 26, fontWeight: 800, color: color || "var(--text-primary)", lineHeight: 1 }}>{value ?? "—"}</strong>
    </div>
  );
}

function ConfirmDialog({ msg, onYes, onNo }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }}
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, maxWidth: 360, width: "90%" }}>
        <p style={{ marginBottom: 20, fontSize: 15, lineHeight: 1.5 }}>{msg}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onNo} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
          <button onClick={onYes} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--danger, #ef4444)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Confirm</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const TABS = [
  { id: "overview",  label: "📊 Overview" },
  { id: "users",     label: "👥 Users" },
  { id: "messages",  label: "💬 Messages" },
  { id: "dm",        label: "📩 DMs" },
  { id: "sockets",   label: "🔌 Sockets" },
  { id: "friends",   label: "🤝 Friends" },
  { id: "system",    label: "⚙️ System" },
  { id: "audit",     label: "📋 Audit" },
  { id: "errors",    label: "🔴 Errors" },
];

export default function AdminPanel({ socket, onClose }) {
  const [tab, setTab]             = useState("overview");
  const [stats, setStats]         = useState(null);
  const [health, setHealth]       = useState(null);
  const [users, setUsers]         = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage]   = useState(0);
  const [userQ, setUserQ]         = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userActivity, setUserActivity] = useState(null);
  const [messages, setMessages]   = useState([]);
  const [msgQ, setMsgQ]           = useState("");
  const [editMsg, setEditMsg]     = useState(null);
  const [editText, setEditText]   = useState("");
  const [conversations, setConversations] = useState([]);
  const [openConv, setOpenConv]   = useState(null);
  const [convMsgs, setConvMsgs]   = useState([]);
  const [audit, setAudit]         = useState([]);
  const [auditFilter, setAuditFilter] = useState("");
  const [system, setSystem]       = useState(null);
  const [profanityList, setProfanityList] = useState([]);
  const [snapshot, setSnapshot]   = useState(null);
  const [sockets, setSockets]     = useState([]);
  const [friendGraph, setFriendGraph] = useState(null);
  const [errors, setErrors]       = useState([]);
  const [err, setErr]             = useState("");
  const [busy, setBusy]           = useState(false);
  const [confirm, setConfirm]     = useState(null);
  const [toast, setToast]         = useState("");
  const [createForm, setCreateForm] = useState({ username: "", password: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [profanityWord, setProfanityWord] = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const askConfirm = (msg, fn) => setConfirm({ msg, fn });

  const act = async (fn, successMsg) => {
    try { setBusy(true); setErr(""); await fn(); if (successMsg) showToast(successMsg); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const loadStats = useCallback(async () => {
    const [d, h] = await Promise.all([adminFetch("/stats"), adminFetch("/health")]);
    setStats(d); setHealth(h);
  }, []);

  const loadUsers = useCallback(async (page = 0, q = "") => {
    const params = new URLSearchParams({ page, limit: 25 });
    if (q) params.set("q", q);
    const d = await adminFetch(`/users?${params}`);
    setUsers(d.users || []); setUserTotal(d.total || 0);
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

  const loadConvMsgs = async (key) => {
    const d = await adminFetch(`/dm/${encodeURIComponent(key)}`);
    setConvMsgs(d.messages || []); setOpenConv(key);
  };

  const loadAudit = useCallback(async () => {
    const d = await adminFetch("/audit?limit=500");
    setAudit(d.entries || []);
  }, []);

  const loadSystem = useCallback(async () => {
    const d = await adminFetch("/system");
    setSystem(d); setProfanityList(d.config?.profanityList || []);
  }, []);

  const loadSockets = useCallback(async () => {
    const d = await adminFetch("/sockets");
    setSockets(d.sockets || []);
  }, []);

  const loadFriends = useCallback(async () => {
    const d = await adminFetch("/friends/graph");
    setFriendGraph(d);
  }, []);

  const loadErrors = useCallback(async () => {
    const d = await adminFetch("/errors");
    setErrors(d.errors || []);
  }, []);

  useEffect(() => {
    adminFetch("/snapshot").then(setSnapshot).catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onSync = (p) => setSnapshot(p);
    const onUp = (p) => setSnapshot((s) => s ? { ...s, ...p } : p);
    socket.on("admin:sync", onSync);
    socket.on("admin:update", onUp);
    socket.emit("admin:subscribe");
    return () => { socket.off("admin:sync", onSync); socket.off("admin:update", onUp); };
  }, [socket]);

  useEffect(() => { loadStats().catch((e) => setErr(e.message)); }, [loadStats]);

  useEffect(() => {
    const map = { users: () => loadUsers(0, ""), messages: loadMessages, dm: loadDm, audit: loadAudit, system: loadSystem, sockets: loadSockets, friends: loadFriends, errors: loadErrors };
    map[tab]?.()?.catch((e) => setErr(e.message));
  }, [tab]); // eslint-disable-line

  return (
    <motion.div className="admin-shell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
      <AnimatePresence>
        {confirm && <ConfirmDialog msg={confirm.msg} onYes={() => { act(confirm.fn); setConfirm(null); }} onNo={() => setConfirm(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#22c55e", color: "#fff", borderRadius: 20, padding: "8px 20px", fontWeight: 700, fontSize: 13, zIndex: 9998, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="admin-top">
        <div>
          <h1>⚡ Administration</h1>
          <p className="admin-sub">Live moderation · backend-enforced · username === admin</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {health && <Badge color={health.chatFrozen ? "#ef4444" : health.maintenanceMode ? "#f59e0b" : "#22c55e"}>{health.maintenanceMode ? "Maintenance" : health.chatFrozen ? "Frozen" : "Healthy"}</Badge>}
          <RippleButton type="button" className="admin-close" onClick={onClose}>✕ Close</RippleButton>
        </div>
      </header>

      {err && (
        <div className="admin-error" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{err}</span>
          <button onClick={() => setErr("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}

      <nav className="admin-tabs" style={{ flexWrap: "wrap", gap: 4 }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`admin-tab ${tab === t.id ? "active" : ""}`} onClick={() => { setTab(t.id); setErr(""); }}>{t.label}</button>
        ))}
      </nav>

      <div className="admin-body custom-scroll">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <section className="admin-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2>Server Overview</h2>
              <RippleButton type="button" onClick={() => act(loadStats, "Refreshed")} disabled={busy}>↻ Refresh</RippleButton>
            </div>
            {stats && (
              <>
                <div className="admin-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
                  <StatCard label="Uptime" value={fmtUptime(stats.uptime)} color="#7c5cfc" />
                  <StatCard label="Online Users" value={stats.onlineUsers} color="#22c55e" />
                  <StatCard label="General Msgs" value={stats.generalMessageCount} color="#3b82f6" />
                  <StatCard label="DM Threads" value={stats.dmConversationKeys} color="#8b5cf6" />
                  <StatCard label="Banned" value={stats.bannedUsers} color="#ef4444" />
                  <StatCard label="Audit Entries" value={stats.auditEntries} color="#f59e0b" />
                </div>
                {stats.memory && (
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ marginBottom: 10, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Memory Usage</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {Object.entries(stats.memory).map(([k, v]) => (
                        <div key={k} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", minWidth: 120 }}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
                          <div style={{ fontWeight: 700 }}>{fmtBytes(v)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {health && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 10, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Health Status</h3>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Badge color={health.chatFrozen ? "#ef4444" : "#22c55e"}>Chat: {health.chatFrozen ? "FROZEN" : "Active"}</Badge>
                  <Badge color={health.maintenanceMode ? "#f59e0b" : "#22c55e"}>Maintenance: {health.maintenanceMode ? "ON" : "off"}</Badge>
                  <Badge color="#3b82f6">Uptime: {fmtUptime(health.uptime || 0)}</Badge>
                </div>
              </div>
            )}
            {snapshot && (
              <div className="admin-live">
                <h3>Live Socket Snapshot</h3>
                <pre className="admin-pre">{JSON.stringify(snapshot, null, 2)}</pre>
              </div>
            )}
          </section>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <section className="admin-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <h2>Users <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}>({userTotal} total)</span></h2>
              <button onClick={() => setShowCreate((v) => !v)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--accent)", background: "rgba(124,92,252,0.1)", color: "var(--accent)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Create User</button>
            </div>

            <AnimatePresence>
              {showCreate && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <input className="admin-input" placeholder="Username" value={createForm.username} onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} style={{ flex: 1, minWidth: 140 }} />
                    <input className="admin-input" type="password" placeholder="Password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} style={{ flex: 1, minWidth: 140 }} />
                    <RippleButton type="button" disabled={busy || !createForm.username || !createForm.password}
                      onClick={() => act(async () => {
                        await adminFetch("/users", { method: "POST", body: JSON.stringify(createForm) });
                        setCreateForm({ username: "", password: "" }); setShowCreate(false);
                        await loadUsers(0, userQ);
                      }, "User created")}>Create</RippleButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="admin-toolbar" style={{ marginBottom: 10, flexWrap: "wrap" }}>
              <input className="admin-input" placeholder="Search username…" value={userQ} onChange={(e) => setUserQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && act(() => loadUsers(0, userQ))} style={{ flex: 1 }} />
              <RippleButton type="button" onClick={() => act(() => loadUsers(0, userQ))} disabled={busy}>Search</RippleButton>
              <button disabled={userPage === 0} onClick={() => { const p = userPage - 1; setUserPage(p); act(() => loadUsers(p, userQ)); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "var(--text-primary)", cursor: "pointer", opacity: userPage === 0 ? 0.4 : 1 }}>‹ Prev</button>
              <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center", whiteSpace: "nowrap" }}>Page {userPage + 1} / {Math.max(1, Math.ceil(userTotal / 25))}</span>
              <button disabled={(userPage + 1) * 25 >= userTotal} onClick={() => { const p = userPage + 1; setUserPage(p); act(() => loadUsers(p, userQ)); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "var(--text-primary)", cursor: "pointer", opacity: (userPage + 1) * 25 >= userTotal ? 0.4 : 1 }}>Next ›</button>
            </div>

            <AnimatePresence>
              {selectedUser && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <strong style={{ fontSize: 15 }}>@{selectedUser.username}</strong>
                      <button onClick={() => { setSelectedUser(null); setUserActivity(null); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}>✕</button>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      <Badge color={selectedUser.online ? "#22c55e" : "#6b7280"}>{selectedUser.online ? "Online" : "Offline"}</Badge>
                      <Badge color={selectedUser.banned ? "#ef4444" : "#22c55e"}>{selectedUser.banned ? "Banned" : "Active"}</Badge>
                      <Badge color="#7c5cfc">{selectedUser.role}</Badge>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, fontFamily: "monospace" }}>ID: {selectedUser.id}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Role:</span>
                      {["user", "moderator", "admin"].map((r) => (
                        <button key={r} onClick={() => act(async () => {
                          await adminFetch(`/users/${selectedUser.id}`, { method: "PATCH", body: JSON.stringify({ role: r }) });
                          await loadUsers(userPage, userQ); setSelectedUser((u) => ({ ...u, role: r }));
                        }, `Role → ${r}`)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${selectedUser.role === r ? "var(--accent)" : "var(--border)"}`, background: selectedUser.role === r ? "rgba(124,92,252,0.1)" : "none", color: selectedUser.role === r ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{r}</button>
                      ))}
                    </div>
                    {!userActivity ? (
                      <button onClick={() => act(async () => { const d = await adminFetch(`/users/${selectedUser.id}/activity`); setUserActivity(d); })} style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Load activity →</button>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <span>Session: {fmtMs(userActivity.sessionMs)}</span>
                        <span>Total online: {fmtMs(userActivity.totalOnlineMs)}</span>
                        <span>Last login: {userActivity.lastLoginAt ? new Date(userActivity.lastLoginAt).toLocaleString() : "—"}</span>
                        <span>Messages: {userActivity.messageCount ?? "—"}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <table className="admin-table">
              <thead><tr><th>Username</th><th>ID</th><th>Status</th><th>Role</th><th>Last Login</th><th>Online Time</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <motion.tr key={u.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ cursor: "pointer", background: selectedUser?.id === u.id ? "rgba(124,92,252,0.05)" : undefined }} onClick={() => { setSelectedUser(u); setUserActivity(null); }}>
                    <td style={{ fontWeight: 600 }}>{u.username}{u.online && <span style={{ marginLeft: 6, width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />}</td>
                    <td className="mono">{u.id.slice(0, 8)}…</td>
                    <td>{u.banned ? <Badge color="#ef4444">Banned</Badge> : <Badge color={u.online ? "#22c55e" : "#6b7280"}>{u.online ? "Online" : "Offline"}</Badge>}</td>
                    <td><Badge color="#7c5cfc">{u.role}</Badge></td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}</td>
                    <td style={{ fontSize: 11 }}>{fmtMs(u.onlineMsTotal)}</td>
                    <td className="admin-actions" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => act(async () => { await adminFetch(`/users/${u.id}/kick`, { method: "POST", body: JSON.stringify({}) }); showToast(`Kicked ${u.username}`); })}>Kick</button>
                      {u.banned
                        ? <button onClick={() => act(async () => { await adminFetch(`/users/${u.id}/unban`, { method: "POST", body: JSON.stringify({}) }); await loadUsers(userPage, userQ); }, "Unbanned")} style={{ color: "#22c55e" }}>Unban</button>
                        : <button onClick={() => askConfirm(`Ban @${u.username}?`, async () => { await adminFetch(`/users/${u.id}/ban`, { method: "POST", body: JSON.stringify({ reason: "Admin action" }) }); await loadUsers(userPage, userQ); })} style={{ color: "#f59e0b" }}>Ban</button>}
                      <button onClick={() => act(async () => { await adminFetch(`/messages/user/${u.id}`, { method: "DELETE" }); showToast("Messages wiped"); })} style={{ color: "#ef4444" }}>Wipe msgs</button>
                      <button onClick={() => askConfirm(`Permanently delete @${u.username}?`, async () => { await adminFetch(`/users/${u.id}`, { method: "DELETE" }); await loadUsers(userPage, userQ); })} style={{ color: "#ef4444" }}>Delete</button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── MESSAGES ── */}
        {tab === "messages" && (
          <section className="admin-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2>General Messages</h2>
              <RippleButton type="button" onClick={() => act(async () => {
                const d = await adminFetch("/export/messages");
                const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "messages.json"; a.click();
              }, "Exported")}>↓ Export JSON</RippleButton>
            </div>

            <div className="admin-toolbar" style={{ marginBottom: 10 }}>
              <input className="admin-input" placeholder="Search text / username…" value={msgQ} onChange={(e) => setMsgQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && act(loadMessages)} style={{ flex: 1 }} />
              <RippleButton type="button" onClick={() => act(loadMessages)} disabled={busy}>Search</RippleButton>
            </div>

            <AnimatePresence>
              {editMsg && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
                  <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, width: 420, maxWidth: "90%" }}>
                    <h3 style={{ marginBottom: 12 }}>Edit Message</h3>
                    <textarea value={editText} onChange={(e) => setEditText(e.target.value)} style={{ width: "100%", minHeight: 80, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, color: "var(--text-primary)", fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                      <button onClick={() => setEditMsg(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
                      <button onClick={() => act(async () => { await adminFetch(`/messages/${editMsg}`, { method: "PATCH", body: JSON.stringify({ text: editText }) }); setEditMsg(null); await loadMessages(); }, "Edited")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Save</button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <table className="admin-table">
              <thead><tr><th>Time</th><th>User</th><th>Text</th><th>Reactions</th><th>Actions</th></tr></thead>
              <tbody>
                {messages.map((m) => (
                  <motion.tr key={m.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : "—"}</td>
                    <td style={{ fontWeight: 600 }}>{m.username}</td>
                    <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.edited && <Badge color="#f59e0b">edited</Badge>} {m.text}</td>
                    <td style={{ fontSize: 12 }}>{m.reactions && Object.keys(m.reactions).length > 0 ? Object.entries(m.reactions).map(([e, ids]) => `${e}${Array.isArray(ids) ? ids.length : ""}`).join(" ") : "—"}</td>
                    <td className="admin-actions">
                      <button onClick={() => { setEditMsg(m.id); setEditText(m.text); }}>Edit</button>
                      <button onClick={() => act(async () => { await adminFetch(`/messages/${m.id}/reactions`, { method: "DELETE" }); await loadMessages(); }, "Reactions cleared")}>Clear 👍</button>
                      <button onClick={() => act(async () => { await adminFetch(`/messages/${m.id}/flag`, { method: "POST", body: JSON.stringify({ reason: "admin" }) }); showToast("Flagged"); })} style={{ color: "#f59e0b" }}>Flag</button>
                      <button onClick={() => askConfirm("Delete this message?", async () => { await adminFetch(`/messages/${m.id}`, { method: "DELETE" }); await loadMessages(); })} style={{ color: "#ef4444" }}>Delete</button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── DMs ── */}
        {tab === "dm" && (
          <section className="admin-section">
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ width: 220, flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h3 style={{ fontSize: 13 }}>Conversations ({conversations.length})</h3>
                  <RippleButton type="button" onClick={() => act(loadDm)} disabled={busy}>↻</RippleButton>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 500, overflowY: "auto" }}>
                  {conversations.map((c) => (
                    <button key={c.key} onClick={() => act(() => loadConvMsgs(c.key))} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${openConv === c.key ? "var(--accent)" : "var(--border)"}`, background: openConv === c.key ? "rgba(124,92,252,0.1)" : "var(--bg-elevated)", color: "var(--text-primary)", cursor: "pointer", textAlign: "left", fontSize: 11 }}>
                      <div className="mono" style={{ marginBottom: 2, wordBreak: "break-all" }}>{c.key}</div>
                      <div style={{ color: "var(--text-muted)" }}>{c.messageCount} msgs</div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {openConv ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <h3 style={{ fontSize: 13, fontFamily: "monospace", wordBreak: "break-all" }}>{openConv}</h3>
                      <div style={{ display: "flex", gap: 8 }}>
                        <RippleButton type="button" onClick={() => act(async () => { const d = await adminFetch("/dm/export"); const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "dm-export.json"; a.click(); }, "Exported")}>↓ Export</RippleButton>
                        <RippleButton type="button" className="danger" onClick={() => askConfirm(`Delete entire conversation?`, async () => { await adminFetch(`/dm/${encodeURIComponent(openConv)}`, { method: "DELETE" }); setOpenConv(null); setConvMsgs([]); await loadDm(); })}>Delete conv</RippleButton>
                      </div>
                    </div>
                    <div style={{ maxHeight: 400, overflowY: "auto" }}>
                      <table className="admin-table compact">
                        <thead><tr><th>Time</th><th>From</th><th>Text</th><th /></tr></thead>
                        <tbody>
                          {convMsgs.map((m) => (
                            <tr key={m.id}>
                              <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : "—"}</td>
                              <td>{m.from?.username || m.fromUsername || "?"}</td>
                              <td style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.text}</td>
                              <td><button onClick={() => askConfirm("Delete this DM?", async () => { await adminFetch(`/dm/${encodeURIComponent(openConv)}/messages/${m.id}`, { method: "DELETE" }); await loadConvMsgs(openConv); })} style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>Del</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)" }}>← Select a conversation</div>}

                <div style={{ marginTop: 16, padding: 14, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10 }}>
                  <h3 style={{ marginBottom: 10, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Block / Unblock</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input className="admin-input" id="blk-a" placeholder="User A ID" style={{ flex: 1, minWidth: 100 }} />
                    <input className="admin-input" id="blk-b" placeholder="User B ID" style={{ flex: 1, minWidth: 100 }} />
                    <button onClick={() => act(async () => { const a = document.getElementById("blk-a").value.trim(), b = document.getElementById("blk-b").value.trim(); await adminFetch("/dm/block", { method: "POST", body: JSON.stringify({ userAId: a, userBId: b }) }); }, "Blocked")} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.15)", color: "#ef4444", fontWeight: 700, cursor: "pointer" }}>Block</button>
                    <button onClick={() => act(async () => { const a = document.getElementById("blk-a").value.trim(), b = document.getElementById("blk-b").value.trim(); await adminFetch("/dm/unblock", { method: "POST", body: JSON.stringify({ userAId: a, userBId: b }) }); }, "Unblocked")} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "rgba(34,197,94,0.15)", color: "#22c55e", fontWeight: 700, cursor: "pointer" }}>Unblock</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── SOCKETS ── */}
        {tab === "sockets" && (
          <section className="admin-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2>Connected Sockets ({sockets.length})</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <RippleButton type="button" onClick={() => act(loadSockets)} disabled={busy}>↻ Refresh</RippleButton>
                <RippleButton type="button" className="danger" onClick={() => askConfirm("Disconnect ALL users?", async () => { await adminFetch("/sockets/kick-all", { method: "POST", body: JSON.stringify({}) }); await loadSockets(); })}>Disconnect All</RippleButton>
              </div>
            </div>
            <table className="admin-table">
              <thead><tr><th>Socket ID</th><th>User</th><th>User ID</th><th>Transport</th><th>Actions</th></tr></thead>
              <tbody>
                {sockets.map((s) => (
                  <tr key={s.id || s.socketId}>
                    <td className="mono" style={{ fontSize: 11 }}>{(s.id || s.socketId || "").slice(0, 14)}…</td>
                    <td style={{ fontWeight: 600 }}>{s.username || "—"}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{s.userId ? s.userId.slice(0, 8) + "…" : "—"}</td>
                    <td><Badge color="#3b82f6">{s.transport || "ws"}</Badge></td>
                    <td className="admin-actions">{s.userId && <button onClick={() => act(async () => { await adminFetch(`/sockets/kick/${s.userId}`, { method: "POST", body: JSON.stringify({}) }); await loadSockets(); }, `Kicked ${s.username}`)} style={{ color: "#ef4444" }}>Kick</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {snapshot?.sockets && <details style={{ marginTop: 12 }}><summary style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 12 }}>Raw JSON</summary><pre className="admin-pre" style={{ marginTop: 8 }}>{JSON.stringify(snapshot.sockets, null, 2)}</pre></details>}
          </section>
        )}

        {/* ── FRIENDS ── */}
        {tab === "friends" && (
          <section className="admin-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2>Friend Graph</h2>
              <RippleButton type="button" onClick={() => act(loadFriends)} disabled={busy}>↻ Refresh</RippleButton>
            </div>
            {friendGraph && (
              <>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                  <StatCard label="Total Users" value={friendGraph.totalUsers} color="#7c5cfc" />
                  <StatCard label="Friendships" value={friendGraph.totalEdges} color="#22c55e" />
                  <StatCard label="Pending" value={friendGraph.pendingRequests} color="#f59e0b" />
                </div>
                {Array.isArray(friendGraph.edges) && friendGraph.edges.length > 0 && (
                  <table className="admin-table"><thead><tr><th>User A</th><th>User B</th><th>Since</th></tr></thead>
                    <tbody>{friendGraph.edges.slice(0, 100).map((e, i) => (<tr key={i}><td>{e.userA || e.a}</td><td>{e.userB || e.b}</td><td style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.since ? new Date(e.since).toLocaleDateString() : "—"}</td></tr>))}</tbody>
                  </table>
                )}
                {Array.isArray(friendGraph.pending) && friendGraph.pending.length > 0 && (
                  <><h3 style={{ marginTop: 20, marginBottom: 8, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Pending Requests</h3>
                    <table className="admin-table"><thead><tr><th>From</th><th>To</th></tr></thead><tbody>{friendGraph.pending.map((p, i) => (<tr key={i}><td>{p.from}</td><td>{p.to}</td></tr>))}</tbody></table></>
                )}
              </>
            )}
          </section>
        )}

        {/* ── SYSTEM ── */}
        {tab === "system" && system && (
          <section className="admin-section">
            <h2 style={{ marginBottom: 20 }}>System Configuration</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
              <div>
                <h3 style={{ marginBottom: 12, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Config</h3>
                <div className="admin-form">
                  {[{ key: "maxMessageLength", label: "Max message length", type: "number" }, { key: "rateLimitGlobalMs", label: "Rate limit (ms)", type: "number" }, { key: "slowModeSeconds", label: "Slow mode (sec)", type: "number" }].map(({ key, label, type }) => (
                    <label key={key}>{label}<input type={type} defaultValue={system.config?.[key]} onBlur={(e) => act(async () => { const body = key === "slowModeSeconds" ? { seconds: Number(e.target.value) } : { [key]: Number(e.target.value) }; await adminFetch(key === "slowModeSeconds" ? "/chat/slowmode" : "/system", { method: key === "slowModeSeconds" ? "POST" : "PATCH", body: JSON.stringify(body) }); await loadSystem(); }, "Saved")} /></label>
                  ))}
                  <div className="admin-row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <RippleButton type="button" style={{ flex: 1 }} onClick={() => act(async () => { await adminFetch("/chat/freeze", { method: "POST", body: JSON.stringify({ frozen: !system.config?.chatFrozen }) }); await loadSystem(); }, "Toggled")}>{system.config?.chatFrozen ? "🔓 Unfreeze chat" : "🔒 Freeze chat"}</RippleButton>
                    <RippleButton type="button" style={{ flex: 1 }} onClick={() => act(async () => { await adminFetch("/maintenance", { method: "POST", body: JSON.stringify({ enabled: !system.config?.maintenanceMode }) }); await loadSystem(); }, "Toggled")}>{system.config?.maintenanceMode ? "✅ Disable maintenance" : "🚧 Enable maintenance"}</RippleButton>
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ marginBottom: 12, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Broadcast</h3>
                <textarea className="admin-textarea" placeholder="Announcement text…" value={broadcastText} onChange={(e) => setBroadcastText(e.target.value)} style={{ marginBottom: 8 }} />
                <RippleButton type="button" disabled={!broadcastText.trim()} onClick={() => act(async () => { await adminFetch("/broadcast", { method: "POST", body: JSON.stringify({ text: broadcastText }) }); setBroadcastText(""); }, "Sent!")}>📢 Send Broadcast</RippleButton>

                <h3 style={{ margin: "20px 0 10px", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Profanity Filter</h3>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input className="admin-input" placeholder="Add word…" value={profanityWord} onChange={(e) => setProfanityWord(e.target.value)} style={{ flex: 1 }} />
                  <RippleButton type="button" disabled={!profanityWord.trim()} onClick={() => act(async () => { await adminFetch("/profanity", { method: "POST", body: JSON.stringify({ word: profanityWord }) }); setProfanityWord(""); await loadSystem(); }, "Added")}>Add</RippleButton>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {profanityList.map((w) => (
                    <span key={w} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 99, fontSize: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
                      {w}<button onClick={() => act(async () => { await adminFetch(`/profanity/${encodeURIComponent(w)}`, { method: "DELETE" }); await loadSystem(); })} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                    </span>
                  ))}
                  {profanityList.length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No words filtered</span>}
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <h3 style={{ marginBottom: 12, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#ef4444" }}>⚠️ Danger Zone</h3>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: 16, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10 }}>
                  <RippleButton type="button" onClick={() => act(async () => { await adminFetch("/cleanup", { method: "POST", body: JSON.stringify({}) }); }, "Cleaned up")}>🧹 Cleanup memory</RippleButton>
                  <RippleButton type="button" onClick={() => act(async () => { const d = await adminFetch("/backup", { method: "POST", body: JSON.stringify({}) }); const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "backup.json"; a.click(); }, "Backup downloaded")}>💾 Download backup</RippleButton>
                  <RippleButton type="button" className="danger" onClick={() => askConfirm("Restart the Node.js server process?", async () => { await adminFetch("/restart", { method: "POST", body: JSON.stringify({}) }); })}>🔄 Restart server</RippleButton>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── AUDIT ── */}
        {tab === "audit" && (
          <section className="admin-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2>Audit Log ({audit.length})</h2>
              <RippleButton type="button" onClick={() => act(loadAudit)} disabled={busy}>↻ Refresh</RippleButton>
            </div>
            <input className="admin-input" placeholder="Filter by actor, action, or target…" value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)} style={{ marginBottom: 10, width: "100%" }} />
            <table className="admin-table compact">
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
              <tbody>
                {audit.filter((e) => { if (!auditFilter) return true; const q = auditFilter.toLowerCase(); return (e.actorUsername || "").toLowerCase().includes(q) || (e.action || "").toLowerCase().includes(q) || String(e.target || "").toLowerCase().includes(q); }).map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{e.at ? new Date(e.at).toLocaleString() : "—"}</td>
                    <td style={{ fontWeight: 600 }}>{e.actorUsername}</td>
                    <td><Badge color={e.action?.includes("ban") || e.action?.includes("delete") ? "#ef4444" : e.action?.includes("kick") ? "#f59e0b" : "#7c5cfc"}>{e.action}</Badge></td>
                    <td className="mono" style={{ fontSize: 11 }}>{String(e.target).slice(0, 40)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── ERRORS ── */}
        {tab === "errors" && (
          <section className="admin-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2>Server Errors ({errors.length})</h2>
              <RippleButton type="button" onClick={() => act(loadErrors)} disabled={busy}>↻ Refresh</RippleButton>
            </div>
            {errors.length === 0
              ? <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}><div style={{ fontSize: 36, marginBottom: 12 }}>✅</div><div style={{ fontWeight: 600 }}>No errors recorded</div></div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {errors.map((e, i) => (
                    <div key={i} style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <Badge color="#ef4444">{e.type || "Error"}</Badge>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.at ? new Date(e.at).toLocaleString() : "—"}</span>
                      </div>
                      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>{e.message}</div>
                      {e.stack && <pre style={{ fontSize: 11, color: "var(--text-muted)", overflow: "auto", maxHeight: 120, margin: 0 }}>{e.stack}</pre>}
                    </div>
                  ))}
                </div>}
          </section>
        )}

      </div>
    </motion.div>
  );
}
