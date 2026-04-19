import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { adminFetch } from "../../api/adminHttp";
import RippleButton from "../ui/RippleButton";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "messages", label: "Messages" },
  { id: "dm", label: "DM" },
  { id: "sockets", label: "Sockets" },
  { id: "errors", label: "Errors" },
  { id: "system", label: "System" },
  { id: "audit", label: "Audit" },
];

export default function AdminPanel({ socket, onClose }) {
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [userQ, setUserQ] = useState("");
  const [messages, setMessages] = useState([]);
  const [msgQ, setMsgQ] = useState("");
  const [conversations, setConversations] = useState([]);
  const [audit, setAudit] = useState([]);
  const [system, setSystem] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [errorLogs, setErrorLogs] = useState([]);
  const [errorQ, setErrorQ] = useState("");
  const [errorFilter, setErrorFilter] = useState("all"); // all, unresolved, resolved
  const [expandedError, setExpandedError] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStats = useCallback(async () => {
    const d = await adminFetch("/stats");
    setStats(d);
  }, []);

  const loadUsers = useCallback(async () => {
    const q = userQ ? `?q=${encodeURIComponent(userQ)}` : "";
    const d = await adminFetch(`/users${q}`);
    setUsers(d.users || []);
  }, [userQ]);

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
    const d = await adminFetch("/api/errors");
    setErrorLogs(d || []);
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
    if (tab === "users") loadUsers().catch((e) => setErr(e.message));
    if (tab === "messages") loadMessages().catch((e) => setErr(e.message));
    if (tab === "dm") loadDm().catch((e) => setErr(e.message));
    if (tab === "errors") loadErrors().catch((e) => setErr(e.message));
    if (tab === "audit") loadAudit().catch((e) => setErr(e.message));
    if (tab === "system") loadSystem().catch((e) => setErr(e.message));
  }, [tab, loadUsers, loadMessages, loadDm, loadErrors, loadAudit, loadSystem]);

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
              <RippleButton type="button" onClick={() => act(loadUsers)} disabled={busy}>
                Search
              </RippleButton>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>ID</th>
                  <th>Online</th>
                  <th>Banned</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <motion.tr key={u.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td>{u.username}</td>
                    <td className="mono">{u.id.slice(0, 8)}…</td>
                    <td>{u.online ? "yes" : "no"}</td>
                    <td>{u.banned ? "yes" : "no"}</td>
                    <td>{u.role}</td>
                    <td className="admin-actions">
                      <button
                        type="button"
                        onClick={() =>
                          act(async () => {
                            await adminFetch(`/users/${u.id}/kick`, { method: "POST", body: JSON.stringify({}) });
                            await loadUsers();
                          })
                        }
                      >
                        Kick
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          act(async () => {
                            await adminFetch(`/users/${u.id}/ban`, {
                              method: "POST",
                              body: JSON.stringify({ reason: "Moderation" }),
                            });
                            await loadUsers();
                          })
                        }
                      >
                        Ban
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          act(async () => {
                            await adminFetch(`/users/${u.id}/unban`, { method: "POST", body: JSON.stringify({}) });
                            await loadUsers();
                          })
                        }
                      >
                        Unban
                      </button>
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
          <section className="admin-section">
            <h2>Error Logs</h2>
            <p className="muted">All frontend errors from all users</p>
            
            <div className="admin-toolbar">
              <input
                className="admin-input"
                placeholder="Search error message..."
                value={errorQ}
                onChange={(e) => setErrorQ(e.target.value)}
              />
              <select
                className="admin-select"
                value={errorFilter}
                onChange={(e) => setErrorFilter(e.target.value)}
              >
                <option value="all">All Errors</option>
                <option value="unresolved">Unresolved</option>
                <option value="resolved">Resolved</option>
              </select>
              <RippleButton type="button" onClick={() => act(loadErrors)} disabled={busy}>
                Refresh
              </RippleButton>
            </div>

            <div className="error-stats">
              <span>Total: {errorLogs.length}</span>
              <span>Unresolved: {errorLogs.filter(e => !e.resolved).length}</span>
              <span>Resolved: {errorLogs.filter(e => e.resolved).length}</span>
            </div>

            <div className="error-list">
              {(errorLogs || [])
                .filter(e => {
                  const matchesFilter = errorFilter === "all" || 
                    (errorFilter === "unresolved" && !e.resolved) ||
                    (errorFilter === "resolved" && e.resolved);
                  const matchesSearch = !errorQ || 
                    e.message?.toLowerCase().includes(errorQ.toLowerCase()) ||
                    e.url?.toLowerCase().includes(errorQ.toLowerCase());
                  return matchesFilter && matchesSearch;
                })
                .map((e) => (
                  <div key={e.id} className="error-item" style={{ opacity: e.resolved ? 0.5 : 1 }}>
                    <div className="error-header" onClick={() => setExpandedError(expandedError === e.id ? null : e.id)}>
                      <div className="error-info">
                        <span className="error-time">{new Date(e.timestamp).toLocaleString()}</span>
                        <span className="error-user mono">{e.user_id?.slice(0, 8)}…</span>
                        <span className="error-resolved">{e.resolved ? "✓ Resolved" : "⚠ Unresolved"}</span>
                      </div>
                      <span className="error-message">{e.message}</span>
                    </div>
                    
                    {expandedError === e.id && (
                      <div className="error-details">
                        <div className="error-detail-section">
                          <h4>URL</h4>
                          <code className="error-url">{e.url}</code>
                        </div>
                        
                        {e.stack && (
                          <div className="error-detail-section">
                            <h4>Error Stack</h4>
                            <pre className="error-stack">{e.stack}</pre>
                          </div>
                        )}
                        
                        {e.component_stack && (
                          <div className="error-detail-section">
                            <h4>Component Stack</h4>
                            <pre className="error-stack">{e.component_stack}</pre>
                          </div>
                        )}
                        
                        {e.user_agent && (
                          <div className="error-detail-section">
                            <h4>User Agent</h4>
                            <code className="error-user-agent">{e.user_agent}</code>
                          </div>
                        )}
                        
                        <div className="error-actions">
                          {!e.resolved && (
                            <button
                              type="button"
                              onClick={() =>
                                act(async () => {
                                  await fetch(`${window.location.origin}/api/errors/${e.id}/resolve`, {
                                    method: "PATCH",
                                  });
                                  await loadErrors();
                                })
                              }
                            >
                              Mark as Resolved
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              act(async () => {
                                await fetch(`${window.location.origin}/api/errors/${e.id}`, {
                                  method: "DELETE",
                                });
                                await loadErrors();
                              })
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
            
            {errorLogs.length === 0 && <p className="muted">No errors logged yet</p>}
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
