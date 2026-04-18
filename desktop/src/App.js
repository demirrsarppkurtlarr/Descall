import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";
const socket = io(SERVER_URL, { autoConnect: false });

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🔥", "🎉"];

const STATUS_CONFIG = {
  online:    { color: "#23a55a", label: "Online" },
  idle:      { color: "#f0b232", label: "Idle" },
  dnd:       { color: "#f23f43", label: "Do Not Disturb" },
  invisible: { color: "#80848e", label: "Invisible" },
  offline:   { color: "#80848e", label: "Offline" },
};

// ─── Extra CSS ────────────────────────────────────────────────────────────────
const EXTRA_CSS = `
  /* ── Sidebar tabs ── */
  .sidebar-tabs {
    display: flex;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    padding: 0 6px;
    gap: 2px;
    flex-shrink: 0;
  }
  .sidebar-tab {
    flex: 1;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #80848e;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .4px;
    padding: 9px 2px 7px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    transition: color .15s, border-color .15s;
    white-space: nowrap;
  }
  .sidebar-tab:hover { color: #ddd; }
  .sidebar-tab-active { color: #fff !important; border-bottom-color: #5865F2; }
  .req-badge { background: #f23f43 !important; }

  /* ── Friend pills ── */
  .friend-pill { position: relative; }
  .friend-pill:hover .friend-actions { opacity: 1; }
  .friend-actions {
    margin-left: auto;
    display: flex;
    gap: 3px;
    opacity: 0;
    transition: opacity .15s;
    flex-shrink: 0;
  }
  .request-pill .friend-actions { opacity: 1; }
  .friend-action-btn {
    background: rgba(255,255,255,0.07);
    border: none;
    border-radius: 5px;
    color: #aaa;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    flex-shrink: 0;
    transition: background .15s, color .15s;
  }
  .friend-action-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }
  .friend-action-accept:hover { background: #23a55a !important; color: #fff !important; }
  .friend-action-remove:hover { background: #f23f43 !important; color: #fff !important; }
  .friend-action-call:hover   { background: #23a55a !important; color: #fff !important; }

  /* ── Status dots ── */
  .dot-online    { background: #23a55a !important; }
  .dot-idle      { background: #f0b232 !important; }
  .dot-dnd       { background: #f23f43 !important; }
  .dot-invisible { background: #80848e !important; }
  .dot-offline   { background: #80848e !important; }

  /* ── Add friend form ── */
  .add-friend-form {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 10px 4px 4px;
    margin-top: 6px;
    border-top: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }
  .add-friend-row { display: flex; gap: 5px; }
  .add-friend-input {
    flex: 1;
    min-width: 0;
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    color: #fff;
    font-size: 12px;
    padding: 5px 9px;
    outline: none;
    transition: border-color .15s;
  }
  .add-friend-input::placeholder { color: #555; }
  .add-friend-input:focus { border-color: #5865F2; }
  .add-friend-btn {
    background: #5865F2;
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    font-size: 18px;
    font-weight: 700;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background .15s;
  }
  .add-friend-btn:hover:not(:disabled) { background: #4752c4; }
  .add-friend-btn:disabled { opacity: .35; cursor: not-allowed; }
  .add-friend-error   { color: #f23f43; font-size: 11px; margin: 0; }
  .add-friend-success { color: #23a55a; font-size: 11px; margin: 0; }

  /* ── Back button / DM header ── */
  .back-btn {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 4px 6px 4px 2px;
    border-radius: 5px;
    margin-right: 2px;
    transition: color .15s, background .15s;
  }
  .back-btn:hover { color: #fff; background: rgba(255,255,255,0.07); }
  .dm-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #5865F2;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-right: 7px;
  }

  /* ── Toast notification ── */
  .notif-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: #2b2d31;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    color: #fff;
    padding: 10px 20px;
    font-size: 13px;
    z-index: 9999;
    white-space: nowrap;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    animation: toastIn .2s ease;
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(12px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* ── Message reactions ── */
  .msg-reactions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
    align-items: center;
  }
  .reaction-item {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 2px 7px;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 3px;
    color: #b5bac1;
    transition: background .15s, border-color .15s;
    line-height: 1.4;
  }
  .reaction-item:hover { background: rgba(88,101,242,0.2); border-color: #5865F2; }
  .reaction-item.reacted {
    background: rgba(88,101,242,0.25);
    border-color: #5865F2;
    color: #fff;
  }
  .reaction-count { font-size: 11px; font-weight: 600; }
  .reaction-add-btn {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    color: #80848e;
    cursor: pointer;
    font-size: 13px;
    padding: 2px 7px;
    transition: background .15s, color .15s;
    line-height: 1.4;
  }
  .reaction-add-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
  .reaction-picker {
    position: absolute;
    background: #2b2d31;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 6px 8px;
    display: flex;
    gap: 4px;
    z-index: 100;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    bottom: calc(100% + 4px);
    left: 0;
  }
  .reaction-emoji-btn {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    border-radius: 6px;
    padding: 3px 4px;
    transition: background .1s;
    line-height: 1;
  }
  .reaction-emoji-btn:hover { background: rgba(255,255,255,0.1); }
  .msg-reaction-wrap {
    position: relative;
  }

  /* ── Typing indicator ── */
  .typing-indicator {
    height: 20px;
    padding: 0 16px 2px;
    font-size: 12px;
    color: #b5bac1;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .typing-names { font-weight: 600; }
  .typing-dots {
    display: inline-flex;
    gap: 3px;
    align-items: center;
  }
  .typing-dots span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #b5bac1;
    animation: typingBounce 1.2s infinite;
    display: inline-block;
  }
  .typing-dots span:nth-child(2) { animation-delay: .2s; }
  .typing-dots span:nth-child(3) { animation-delay: .4s; }
  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); }
    30%           { transform: translateY(-4px); }
  }

  /* ── Voice call modal (incoming) ── */
  .call-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeInBg .2s ease;
  }
  @keyframes fadeInBg {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .call-modal {
    background: #2b2d31;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 16px;
    padding: 32px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.6);
    animation: slideUp .25s ease;
    min-width: 280px;
  }
  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  .call-modal-avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: linear-gradient(135deg, #5865F2, #7289da);
    color: #fff;
    font-size: 30px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 4px rgba(88,101,242,0.3);
  }
  .call-modal-name {
    font-size: 20px;
    font-weight: 700;
    color: #fff;
  }
  .call-modal-status {
    font-size: 13px;
    color: #b5bac1;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .call-pulse {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #23a55a;
    animation: pulse 1s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: .5; transform: scale(1.3); }
  }
  .call-modal-actions {
    display: flex;
    gap: 24px;
    margin-top: 8px;
  }
  .call-accept-btn, .call-decline-btn {
    width: 56px; height: 56px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    transition: transform .15s, box-shadow .15s;
  }
  .call-accept-btn  { background: #23a55a; color: #fff; box-shadow: 0 4px 16px rgba(35,165,90,0.4); }
  .call-decline-btn { background: #f23f43; color: #fff; box-shadow: 0 4px 16px rgba(242,63,67,0.4); }
  .call-accept-btn:hover  { transform: scale(1.08); box-shadow: 0 6px 20px rgba(35,165,90,0.6); }
  .call-decline-btn:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(242,63,67,0.6); }

  /* ── Active call bar ── */
  .call-bar {
    background: rgba(35,165,90,0.12);
    border-top: 1px solid rgba(35,165,90,0.3);
    display: flex;
    align-items: center;
    padding: 8px 16px;
    gap: 10px;
    flex-shrink: 0;
  }
  .call-bar-icon {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: #23a55a;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    flex-shrink: 0;
  }
  .call-bar-info {
    flex: 1;
    min-width: 0;
  }
  .call-bar-name {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .call-bar-timer {
    font-size: 11px;
    color: #23a55a;
    font-variant-numeric: tabular-nums;
  }
  .call-bar-status {
    font-size: 11px;
    color: #b5bac1;
    font-style: italic;
  }
  .call-bar-actions { display: flex; gap: 6px; }
  .call-ctrl-btn {
    background: rgba(255,255,255,0.08);
    border: none;
    border-radius: 8px;
    color: #b5bac1;
    cursor: pointer;
    padding: 6px 10px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: background .15s, color .15s;
  }
  .call-ctrl-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }
  .call-ctrl-muted { background: rgba(242,63,67,0.15) !important; color: #f23f43 !important; }
  .call-ctrl-end {
    background: rgba(242,63,67,0.15) !important;
    color: #f23f43 !important;
  }
  .call-ctrl-end:hover { background: #f23f43 !important; color: #fff !important; }

  /* ── Status area ── */
  .sidebar-status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-top: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
    cursor: pointer;
    position: relative;
    transition: background .15s;
    border-radius: 0 0 0 0;
  }
  .sidebar-status-bar:hover { background: rgba(255,255,255,0.04); }
  .status-avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: #5865F2;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
  }
  .status-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid #2b2d31;
  }
  .status-info { flex: 1; min-width: 0; }
  .status-name {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status-label {
    font-size: 11px;
    color: #80848e;
  }
  .status-picker-dropdown {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 8px;
    right: 8px;
    background: #232428;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    overflow: hidden;
    z-index: 500;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
  }
  .status-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    cursor: pointer;
    font-size: 13px;
    color: #b5bac1;
    transition: background .1s;
  }
  .status-option:hover { background: rgba(255,255,255,0.06); color: #fff; }
  .status-dot-sm {
    width: 10px; height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ── DM conversation items in sidebar ── */
  .dm-conv-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: background .1s;
  }
  .dm-conv-item:hover { background: rgba(255,255,255,0.05); }
  .dm-conv-item.active { background: rgba(88,101,242,0.15); }
  .dm-conv-avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #5865F2, #7289da);
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
  }
  .dm-conv-status {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 10px; height: 10px;
    border-radius: 50%;
    border: 2px solid #2b2d31;
  }
  .dm-conv-info { flex: 1; min-width: 0; }
  .dm-conv-name {
    font-size: 13px;
    font-weight: 600;
    color: #f2f3f5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dm-conv-preview {
    font-size: 11px;
    color: #80848e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }
  .dm-unread-badge {
    background: #f23f43;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    border-radius: 10px;
    padding: 1px 6px;
    min-width: 18px;
    text-align: center;
    flex-shrink: 0;
  }

  /* ── Sidebar badge ── */
  .sidebar-badge {
    background: rgba(255,255,255,0.12);
    color: #b5bac1;
    font-size: 10px;
    font-weight: 700;
    border-radius: 10px;
    padding: 1px 5px;
    min-width: 16px;
    text-align: center;
  }

  /* ── Call button in DM header ── */
  .header-call-btn {
    background: rgba(35,165,90,0.12);
    border: 1px solid rgba(35,165,90,0.25);
    border-radius: 8px;
    color: #23a55a;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    font-size: 12px;
    font-weight: 600;
    transition: background .15s, border-color .15s;
  }
  .header-call-btn:hover { background: rgba(35,165,90,0.2); border-color: rgba(35,165,90,0.4); }
  .header-call-btn:disabled { opacity: .4; cursor: not-allowed; }

  /* ── Calling state ── */
  .call-bar-calling {
    background: rgba(88,101,242,0.12);
    border-top-color: rgba(88,101,242,0.3);
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function TypingDots() {
  return <span className="typing-dots"><span /><span /><span /></span>;
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwn, myUserId, reactions = {}, onReact }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function handler(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  if (msg.type === "system") {
    return (
      <div className="msg-system">
        <span className="msg-system-text">{msg.text}</span>
        <span className="msg-time">{formatTime(msg.timestamp)}</span>
      </div>
    );
  }

  const username = msg?.username || "";
  const reactionEntries = Object.entries(reactions);

  return (
    <div className={`msg-row ${isOwn ? "msg-own" : ""}`}>
      <div className="msg-avatar" aria-hidden="true">{username.charAt(0).toUpperCase()}</div>
      <div className="msg-body">
        <div className="msg-meta">
          <span className="msg-username">{username}</span>
          <span className="msg-time">{formatTime(msg.timestamp)}</span>
        </div>
        <div className="msg-bubble">{msg.text}</div>

        {/* Reactions row */}
        {msg.id && (
          <div className="msg-reactions msg-reaction-wrap">
            {reactionEntries.map(([emoji, users]) => (
              <button
                key={emoji}
                className={`reaction-item ${users.includes(myUserId) ? "reacted" : ""}`}
                onClick={() => onReact(msg.id, emoji)}
                title={`${users.length} reaction${users.length !== 1 ? "s" : ""}`}
              >
                {emoji} <span className="reaction-count">{users.length}</span>
              </button>
            ))}
            {onReact && (
              <div style={{ position: "relative" }} ref={pickerRef}>
                <button className="reaction-add-btn" onClick={() => setPickerOpen(p => !p)} title="Add reaction">
                  + 😀
                </button>
                {pickerOpen && (
                  <div className="reaction-picker">
                    {EMOJIS.map(e => (
                      <button
                        key={e}
                        className="reaction-emoji-btn"
                        onClick={() => { onReact(msg.id, e); setPickerOpen(false); }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status dot ───────────────────────────────────────────────────────────────
function StatusDot({ status, className = "" }) {
  const color = STATUS_CONFIG[status]?.color || STATUS_CONFIG.offline.color;
  return (
    <span
      className={`user-pill-dot ${className}`}
      style={{ background: color }}
    />
  );
}

// ─── User Pill ────────────────────────────────────────────────────────────────
function UserPill({ user, isMe }) {
  const username = user?.username || "";
  const status   = user?.status || "online";
  return (
    <div className={`user-pill ${isMe ? "user-pill-me" : ""}`}>
      <StatusDot status={status} />
      <span className="user-pill-avatar">{username.charAt(0).toUpperCase()}</span>
      <span className="user-pill-name">
        {username}{isMe && <em> (you)</em>}
      </span>
      {!isMe && (
        <span style={{ marginLeft: "auto", fontSize: 11, color: STATUS_CONFIG[status]?.color, opacity: .8 }}>
          {STATUS_CONFIG[status]?.label}
        </span>
      )}
    </div>
  );
}

// ─── Friend Pill ──────────────────────────────────────────────────────────────
function FriendPill({ friend, onDM, onRemove, onCall, inCall }) {
  const username = friend?.username || "";
  const status   = friend?.status || "offline";
  return (
    <div className="user-pill friend-pill">
      <StatusDot status={status} />
      <span className="user-pill-avatar">{username.charAt(0).toUpperCase()}</span>
      <span className="user-pill-name">{username}</span>
      <div className="friend-actions">
        <button className="friend-action-btn friend-action-call" onClick={() => onCall(friend)} title="Voice call" disabled={inCall}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.76a16 16 0 0 0 6 6l.76-1.76a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.4 15h.52z"/>
          </svg>
        </button>
        <button className="friend-action-btn" onClick={() => onDM(friend)} title="Send DM">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <button className="friend-action-btn friend-action-remove" onClick={() => onRemove(friend.id)} title="Remove friend">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Request Pill ─────────────────────────────────────────────────────────────
function RequestPill({ req, onAccept, onDecline }) {
  const username = req?.username || "";
  return (
    <div className="user-pill request-pill">
      <span className="user-pill-avatar">{username.charAt(0).toUpperCase()}</span>
      <span className="user-pill-name">{username}</span>
      <div className="friend-actions">
        <button className="friend-action-btn friend-action-accept" onClick={() => onAccept(req.id)} title="Accept">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
        <button className="friend-action-btn friend-action-remove" onClick={() => onDecline(req.id)} title="Decline">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Add Friend Form ──────────────────────────────────────────────────────────
function AddFriendForm({ onAdd, error, success }) {
  const [val, setVal] = useState("");
  function submit(e) {
    e.preventDefault();
    if (!val.trim()) return;
    onAdd(val.trim());
    setVal("");
  }
  return (
    <form className="add-friend-form" onSubmit={submit}>
      <div className="add-friend-row">
        <input
          className="add-friend-input"
          type="text"
          placeholder="Add friend by username..."
          value={val}
          onChange={e => setVal(e.target.value)}
          maxLength={24}
          spellCheck={false}
          autoComplete="off"
        />
        <button className="add-friend-btn" type="submit" disabled={!val.trim()}>+</button>
      </div>
      {error   && <p className="add-friend-error">{error}</p>}
      {success && <p className="add-friend-success">{success}</p>}
    </form>
  );
}

// ─── Incoming Call Modal ──────────────────────────────────────────────────────
function IncomingCallModal({ caller, onAccept, onDecline }) {
  const name = caller?.username || "";
  return (
    <div className="call-modal-overlay">
      <div className="call-modal">
        <div className="call-modal-avatar">{name.charAt(0).toUpperCase()}</div>
        <div className="call-modal-name">{name}</div>
        <div className="call-modal-status">
          <span className="call-pulse" />
          Incoming voice call...
        </div>
        <div className="call-modal-actions">
          <button className="call-accept-btn" onClick={onAccept} title="Accept">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.76a16 16 0 0 0 6 6l.76-1.76a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.4 15h.52z"/>
            </svg>
          </button>
          <button className="call-decline-btn" onClick={onDecline} title="Decline">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Active Call Bar ──────────────────────────────────────────────────────────
function ActiveCallBar({ callUser, status, duration, muted, onMute, onEnd }) {
  const name = callUser?.username || "";
  return (
    <div className={`call-bar ${status === "calling" ? "call-bar-calling" : ""}`}>
      <div className="call-bar-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.76a16 16 0 0 0 6 6l.76-1.76a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.4 15h.52z"/>
        </svg>
      </div>
      <div className="call-bar-info">
        <div className="call-bar-name">{name}</div>
        {status === "active"
          ? <div className="call-bar-timer">{formatDuration(duration)}</div>
          : <div className="call-bar-status">Calling...</div>
        }
      </div>
      <div className="call-bar-actions">
        {status === "active" && (
          <button
            className={`call-ctrl-btn ${muted ? "call-ctrl-muted" : ""}`}
            onClick={onMute}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? "🔇" : "🎙️"}
            {muted ? "Muted" : "Mute"}
          </button>
        )}
        <button className="call-ctrl-btn call-ctrl-end" onClick={onEnd} title="End call">
          📵 End
        </button>
      </div>
    </div>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator({ typers }) {
  if (!typers || typers.length === 0) return <div className="typing-indicator" />;
  const names = typers.map(t => t.username);
  const label = names.length === 1
    ? `${names[0]} is typing`
    : names.length === 2
      ? `${names[0]} and ${names[1]} are typing`
      : `${names[0]} and ${names.length - 1} others are typing`;
  return (
    <div className="typing-indicator">
      <TypingDots />
      <span><span className="typing-names">{label}</span>…</span>
    </div>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuthSuccess, error, loading }) {
  const [tab,      setTab]      = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [localErr, setLocalErr] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, [tab]);

  function switchTab(t) {
    setTab(t); setUsername(""); setPassword(""); setConfirm(""); setLocalErr("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    setLocalErr("");
    if (!username.trim() || !password) { setLocalErr("Please fill in all fields."); return; }
    if (tab === "register") {
      if (password !== confirm) { setLocalErr("Passwords do not match."); return; }
      if (password.length < 6)  { setLocalErr("Password must be at least 6 characters."); return; }
    }
    onAuthSuccess(tab, username.trim(), password);
  }

  const displayError = localErr || error;

  return (
    <div className="join-overlay">
      <div className="join-card">
        <div className="join-logo" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="16" fill="#5865F2"/>
            <path d="M32 16C32 16 28.5 15 24 15C19.5 15 16 16 16 16C14.3 16.7 13 19 13 22V27C13 30 14.3 32 16 32.5L17 35.5L20.5 32.5C21.6 32.8 22.8 33 24 33C25.2 33 26.4 32.8 27.5 32.5L31 35.5L32 32.5C33.7 32 35 30 35 27V22C35 19 33.7 16.7 32 16Z" fill="white"/>
            <circle cx="20" cy="24" r="2" fill="#5865F2"/>
            <circle cx="28" cy="24" r="2" fill="#5865F2"/>
          </svg>
        </div>
        <h1 className="join-title">Descall</h1>
        <p className="join-subtitle">Real-time chat. Jump right in.</p>
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === "login"    ? "auth-tab-active" : ""}`} onClick={() => switchTab("login")}    type="button">Login</button>
          <button className={`auth-tab ${tab === "register" ? "auth-tab-active" : ""}`} onClick={() => switchTab("register")} type="button">Register</button>
        </div>
        <form onSubmit={handleSubmit} className="join-form">
          <label className="join-label" htmlFor="auth-username">Username</label>
          <input id="auth-username" ref={inputRef} className={`join-input ${displayError ? "join-input-error" : ""}`} type="text" placeholder="e.g. cooldev42" value={username} maxLength={24} onChange={e => setUsername(e.target.value)} autoComplete="username" spellCheck={false} disabled={loading} />
          <label className="join-label" htmlFor="auth-password">Password</label>
          <input id="auth-password" className={`join-input ${displayError ? "join-input-error" : ""}`} type="password" placeholder="••••••••" value={password} maxLength={72} onChange={e => setPassword(e.target.value)} autoComplete={tab === "login" ? "current-password" : "new-password"} disabled={loading} />
          {tab === "register" && (
            <>
              <label className="join-label" htmlFor="auth-confirm">Confirm Password</label>
              <input id="auth-confirm" className={`join-input ${displayError ? "join-input-error" : ""}`} type="password" placeholder="••••••••" value={confirm} maxLength={72} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" disabled={loading} />
            </>
          )}
          {displayError && <p className="join-error">{displayError}</p>}
          <button className="join-btn" type="submit" disabled={loading || !username.trim() || !password}>
            {loading ? <TypingDots /> : tab === "login" ? "Login" : "Create Account"}
          </button>
        </form>
        <p className="auth-switch">
          {tab === "login"
            ? <> No account? <button className="auth-switch-btn" onClick={() => switchTab("register")}>Register</button></>
            : <> Have an account? <button className="auth-switch-btn" onClick={() => switchTab("login")}>Login</button></>
          }
        </p>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  me, myUserId, myStatus, users, friends, friendRequests, dmConvs, dmUnread, activeDM,
  onLeave, onFriendRequest, onAcceptFriend, onDeclineFriend, onRemoveFriend, onOpenDM,
  friendError, friendSuccess, onCall, inCall, onStatusChange,
}) {
  const [tab,            setTab]            = useState("online");
  const [statusDropdown, setStatusDropdown] = useState(false);
  const statusRef = useRef(null);

  useEffect(() => {
    if (!statusDropdown) return;
    function h(e) { if (statusRef.current && !statusRef.current.contains(e.target)) setStatusDropdown(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [statusDropdown]);

  // DM conversations derived from dmConvs
  const dmConvList = Object.entries(dmConvs).map(([userId, msgs]) => {
    const friend = friends.find(f => f.id === userId);
    const last   = msgs[msgs.length - 1];
    return { userId, username: friend?.username || "Unknown", status: friend?.status || "offline", lastMsg: last, unread: dmUnread[userId] || 0 };
  }).sort((a, b) => {
    const ta = a.lastMsg?.timestamp || "0";
    const tb = b.lastMsg?.timestamp || "0";
    return tb.localeCompare(ta);
  });

  const totalUnread = Object.values(dmUnread).reduce((s, n) => s + n, 0);

  return (
    <aside className="sidebar" style={{ display: "flex", flexDirection: "column" }}>
      <div className="sidebar-tabs">
        <button className={`sidebar-tab ${tab === "online"   ? "sidebar-tab-active" : ""}`} onClick={() => setTab("online")}>
          Online <span className="sidebar-badge">{users.length}</span>
        </button>
        <button className={`sidebar-tab ${tab === "friends"  ? "sidebar-tab-active" : ""}`} onClick={() => setTab("friends")}>
          Friends <span className="sidebar-badge">{friends.length}</span>
        </button>
        <button className={`sidebar-tab ${tab === "dms"      ? "sidebar-tab-active" : ""}`} onClick={() => setTab("dms")}>
          DMs {totalUnread > 0 && <span className="sidebar-badge req-badge">{totalUnread}</span>}
        </button>
        <button className={`sidebar-tab ${tab === "requests" ? "sidebar-tab-active" : ""}`} onClick={() => setTab("requests")}>
          Req {friendRequests.length > 0 && <span className="sidebar-badge req-badge">{friendRequests.length}</span>}
        </button>
      </div>

      <div className="sidebar-users" style={{ flex: 1, overflowY: "auto" }}>
        {tab === "online" && (
          <>
            {users.map(u => <UserPill key={u.id || u.username} user={u} isMe={u.username === me} />)}
            {users.length === 0 && <p className="sidebar-empty">No one online...</p>}
          </>
        )}
        {tab === "friends" && (
          <>
            {friends.map(f => (
              <FriendPill
                key={f.id}
                friend={f}
                onDM={onOpenDM}
                onRemove={onRemoveFriend}
                onCall={onCall}
                inCall={!!inCall}
              />
            ))}
            {friends.length === 0 && <p className="sidebar-empty">No friends yet.</p>}
            <AddFriendForm onAdd={onFriendRequest} error={friendError} success={friendSuccess} />
          </>
        )}
        {tab === "dms" && (
          <>
            {dmConvList.length === 0 && <p className="sidebar-empty">No conversations yet.<br/>DM a friend!</p>}
            {dmConvList.map(({ userId, username, status, lastMsg, unread }) => (
              <div
                key={userId}
                className={`dm-conv-item ${activeDM?.id === userId ? "active" : ""}`}
                onClick={() => onOpenDM({ id: userId, username, status })}
              >
                <div className="dm-conv-avatar">
                  {username.charAt(0).toUpperCase()}
                  <span className="dm-conv-status" style={{ background: STATUS_CONFIG[status]?.color || "#80848e" }} />
                </div>
                <div className="dm-conv-info">
                  <div className="dm-conv-name">{username}</div>
                  {lastMsg && (
                    <div className="dm-conv-preview">
                      {lastMsg.from?.username === me ? "You: " : ""}{lastMsg.text}
                    </div>
                  )}
                </div>
                {unread > 0 && <span className="dm-unread-badge">{unread > 99 ? "99+" : unread}</span>}
              </div>
            ))}
          </>
        )}
        {tab === "requests" && (
          <>
            {friendRequests.map(r => <RequestPill key={r.id} req={r} onAccept={onAcceptFriend} onDecline={onDeclineFriend} />)}
            {friendRequests.length === 0 && <p className="sidebar-empty">No pending requests.</p>}
          </>
        )}
      </div>

      {/* Status bar */}
      <div className="sidebar-status-bar" onClick={() => setStatusDropdown(p => !p)} ref={statusRef}>
        <div className="status-avatar">
          {me.charAt(0).toUpperCase()}
          <span className="status-badge" style={{ background: STATUS_CONFIG[myStatus]?.color }} />
        </div>
        <div className="status-info">
          <div className="status-name">{me}</div>
          <div className="status-label">{STATUS_CONFIG[myStatus]?.label}</div>
        </div>
        {statusDropdown && (
          <div className="status-picker-dropdown">
            {Object.entries(STATUS_CONFIG).filter(([k]) => k !== "offline").map(([key, cfg]) => (
              <div
                key={key}
                className="status-option"
                onClick={(e) => { e.stopPropagation(); onStatusChange(key); setStatusDropdown(false); }}
              >
                <span className="status-dot-sm" style={{ background: cfg.color }} />
                {cfg.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="leave-btn" onClick={onLeave} title="Leave chat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Leave
      </button>
    </aside>
  );
}

// ─── Composer ─────────────────────────────────────────────────────────────────
function Composer({ placeholder, connected, onSend, onTypingStart, onTypingStop }) {
  const [text,     setText]     = useState("");
  const inputRef   = useRef(null);
  const typingTimer = useRef(null);
  const isTyping   = useRef(false);

  function handleChange(e) {
    const val = e.target.value;
    setText(val);
    if (val.trim()) {
      if (!isTyping.current) { isTyping.current = true; onTypingStart?.(); }
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        isTyping.current = false;
        onTypingStop?.();
      }, 2000);
    } else {
      clearTimeout(typingTimer.current);
      if (isTyping.current) { isTyping.current = false; onTypingStop?.(); }
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !connected) return;
    clearTimeout(typingTimer.current);
    if (isTyping.current) { isTyping.current = false; onTypingStop?.(); }
    onSend(trimmed);
    setText("");
    inputRef.current?.focus();
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className="composer-input"
        type="text"
        placeholder={connected ? placeholder : "Reconnecting..."}
        value={text}
        onChange={handleChange}
        maxLength={1000}
        disabled={!connected}
        autoComplete="off"
        spellCheck
      />
      <button className="composer-send" type="submit" disabled={!text.trim() || !connected} aria-label="Send">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </form>
  );
}

// ─── General Chat ─────────────────────────────────────────────────────────────
function GeneralChat({ me, myUserId, messages, msgReactions, connected, onSend, typers, onReact, onTypingStart, onTypingStop }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  return (
    <>
      <header className="chat-header">
        <div className="chat-header-left">
          <span className="chat-hash" aria-hidden="true">#</span>
          <span className="chat-channel-name">general</span>
        </div>
        <div className="chat-header-right">
          <span className={`conn-badge ${connected ? "conn-on" : "conn-off"}`}>
            <span className="conn-dot" />{connected ? "Connected" : "Reconnecting..."}
          </span>
        </div>
      </header>
      <div className="messages-feed" role="log" aria-live="polite">
        {messages.length === 0 && <div className="feed-empty"><p>No messages yet. Say something!</p></div>}
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id || i}
            msg={msg}
            isOwn={msg.username === me}
            myUserId={myUserId}
            reactions={msg.id ? msgReactions[msg.id] || {} : {}}
            onReact={msg.id ? onReact : null}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <TypingIndicator typers={typers} />
      <Composer
        placeholder="Message #general"
        connected={connected}
        onSend={onSend}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
      />
    </>
  );
}

// ─── DM Conversation ──────────────────────────────────────────────────────────
function DMConversation({ me, partner, messages, connected, onSend, typers, onBack, onCall, inCall }) {
  const bottomRef   = useRef(null);
  const partnerName = partner?.username || "";
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  return (
    <>
      <header className="chat-header">
        <div className="chat-header-left">
          <button className="back-btn" onClick={onBack} title="Back to #general">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="dm-avatar" aria-hidden="true">{partnerName.charAt(0).toUpperCase()}</div>
          <span className="chat-channel-name">{partnerName}</span>
          <span style={{ marginLeft: 6, fontSize: 11, color: STATUS_CONFIG[partner?.status || "offline"]?.color }}>
            {STATUS_CONFIG[partner?.status || "offline"]?.label}
          </span>
        </div>
        <div className="chat-header-right" style={{ gap: 8 }}>
          <button
            className="header-call-btn"
            onClick={() => onCall(partner)}
            disabled={!!inCall || partner?.status === "offline"}
            title="Voice call"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.76a16 16 0 0 0 6 6l.76-1.76a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.4 15h.52z"/>
            </svg>
            Call
          </button>
          <span className={`conn-badge ${connected ? "conn-on" : "conn-off"}`}>
            <span className="conn-dot" />{connected ? "Connected" : "Reconnecting..."}
          </span>
        </div>
      </header>
      <div className="messages-feed" role="log" aria-live="polite">
        {messages.length === 0 && <div className="feed-empty"><p>Start of your DM with {partnerName}.</p></div>}
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id || i}
            msg={{ type: "chat", username: msg.from?.username || "", text: msg.text, timestamp: msg.timestamp }}
            isOwn={msg.from?.username === me}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <TypingIndicator typers={typers} />
      <Composer
        placeholder={`Message ${partnerName}`}
        connected={connected}
        onSend={onSend}
        onTypingStart={() => socket.emit("typing:start", { toUserId: partner?.id })}
        onTypingStop={() => socket.emit("typing:stop", { toUserId: partner?.id })}
      />
    </>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [phase,          setPhase]          = useState("auth");
  const [me,             setMe]             = useState("");
  const [myUserId,       setMyUserId]       = useState("");
  const [myStatus,       setMyStatus]       = useState("online");
  const [messages,       setMessages]       = useState([]);
  const [msgReactions,   setMsgReactions]   = useState({});
  const [users,          setUsers]          = useState([]);
  const [friends,        setFriends]        = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [connected,      setConnected]      = useState(false);
  const [authError,      setAuthError]      = useState("");
  const [loading,        setLoading]        = useState(false);
  const [friendError,    setFriendError]    = useState("");
  const [friendSuccess,  setFriendSuccess]  = useState("");
  const [activeDM,       setActiveDM]       = useState(null);
  const [dmConvs,        setDmConvs]        = useState({});
  const [dmUnread,       setDmUnread]       = useState({});
  const [toast,          setToast]          = useState("");

  // Typing state
  const [typingGeneral,  setTypingGeneral]  = useState([]);   // [{ id, username }]
  const [typingDM,       setTypingDM]       = useState({});   // { [userId]: { id, username } }

  // Voice call state
  const [incomingCall,   setIncomingCall]   = useState(null); // { fromUser, offer }
  const [activeCall,     setActiveCall]     = useState(null); // { user, status }
  const [callMuted,      setCallMuted]      = useState(false);
  const [callDuration,   setCallDuration]   = useState(0);

  const peerRef          = useRef(null);
  const localStreamRef   = useRef(null);
  const remoteAudioRef   = useRef(null);
  const pendingCandidates = useRef([]);
  const toastTimer       = useRef(null);
  const activeCallRef    = useRef(null);
  const activeDMRef      = useRef(null);

  // Keep refs in sync
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { activeDMRef.current   = activeDM;   }, [activeDM]);

  // Call duration timer
  useEffect(() => {
    if (activeCall?.status !== "active") { setCallDuration(0); return; }
    const timer = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, [activeCall?.status]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }

  // ── WebRTC helpers ───────────────────────────────────────────────────────────
  function createPeerConnection(targetUserId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("call:ice-candidate", { toUserId: targetUserId, candidate: e.candidate });
    };

    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setActiveCall(prev => prev ? { ...prev, status: "active" } : prev);
      }
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        cleanupCall();
      }
    };

    return pc;
  }

  function cleanupCall(notifyUserId = null) {
    if (peerRef.current) { peerRef.current.close(); peerRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = null; }
    pendingCandidates.current = [];
    setActiveCall(null);
    setCallMuted(false);
    if (notifyUserId) socket.emit("call:end", { toUserId: notifyUserId });
  }

  async function startCall(friend) {
    if (peerRef.current) return; // already in call
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = createPeerConnection(friend.id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call:offer", { toUserId: friend.id, offer: pc.localDescription });
      setActiveCall({ user: friend, status: "calling" });
    } catch (err) {
      showToast("Could not access microphone.");
      cleanupCall();
    }
  }

  async function acceptCall() {
    if (!incomingCall) return;
    const { fromUser, offer } = incomingCall;
    setIncomingCall(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = createPeerConnection(fromUser.id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      // Apply buffered candidates
      for (const c of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingCandidates.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("call:answer", { toUserId: fromUser.id, answer: pc.localDescription });
      setActiveCall({ user: fromUser, status: "active" });
    } catch (err) {
      showToast("Could not access microphone.");
      cleanupCall(fromUser.id);
    }
  }

  function declineCall() {
    if (!incomingCall) return;
    socket.emit("call:decline", { toUserId: incomingCall.fromUser.id });
    setIncomingCall(null);
    pendingCandidates.current = [];
  }

  function endCall() {
    const uid = activeCallRef.current?.user?.id;
    cleanupCall(uid);
  }

  function toggleMute() {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCallMuted(!track.enabled);
    }
  }

  // ── Socket events ────────────────────────────────────────────────────────────
  useEffect(() => {
    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("user:joined", ({ user }) => {
      setMe(user.username);
      setMyUserId(user.id);
      setPhase("chat");
      setAuthError("");
      setLoading(false);
    });

    socket.on("general:history", (msgs) => {
      setMessages(msgs);
    });

    socket.on("users:update",    setUsers);
    socket.on("friend:list",     setFriends);
    socket.on("friend:requests", setFriendRequests);

    socket.on("message:new", msg => setMessages(prev => [...prev, msg]));

    socket.on("message:reaction:update", ({ msgId, reactions }) => {
      setMsgReactions(prev => ({ ...prev, [msgId]: reactions }));
    });

    // Typing
    socket.on("typing:start", ({ fromUser, context }) => {
      if (context === "general") {
        setTypingGeneral(prev => prev.some(u => u.id === fromUser.id) ? prev : [...prev, fromUser]);
        setTimeout(() => {
          setTypingGeneral(prev => prev.filter(u => u.id !== fromUser.id));
        }, 3000);
      } else if (context === "dm") {
        setTypingDM(prev => ({ ...prev, [fromUser.id]: fromUser }));
        setTimeout(() => {
          setTypingDM(prev => { const n = { ...prev }; delete n[fromUser.id]; return n; });
        }, 3000);
      }
    });

    socket.on("typing:stop", ({ fromUserId, context }) => {
      if (context === "general") {
        setTypingGeneral(prev => prev.filter(u => u.id !== fromUserId));
      } else if (context === "dm") {
        setTypingDM(prev => { const n = { ...prev }; delete n[fromUserId]; return n; });
      }
    });

    // Friend events
    socket.on("friend:request:incoming", ({ from }) => {
      setFriendRequests(prev => prev.some(r => r.id === from.id) ? prev : [...prev, from]);
      showToast(`${from.username} sent you a friend request!`);
    });
    socket.on("friend:request:sent", ({ to }) => {
      setFriendError(""); setFriendSuccess(`Request sent to ${to}!`);
      setTimeout(() => setFriendSuccess(""), 3000);
    });
    socket.on("friend:accepted", ({ by }) => showToast(`${by.username} accepted your friend request!`));
    socket.on("friend:error",    ({ message }) => { setFriendError(message); setTimeout(() => setFriendError(""), 3000); });

    // DMs
    socket.on("dm:message", (msg) => {
      const { convWith } = msg;
      setDmConvs(prev => ({ ...prev, [convWith]: [...(prev[convWith] || []), msg] }));
      setActiveDM(current => {
        if (!current || current.id !== convWith) {
          // Increment unread
          setDmUnread(prev => ({ ...prev, [convWith]: (prev[convWith] || 0) + 1 }));
          // Toast preview
          const preview = msg.text.slice(0, 50) + (msg.text.length > 50 ? "…" : "");
          showToast(`📩 ${msg.from?.username}: ${preview}`);
        }
        return current;
      });
    });

    socket.on("dm:history", ({ withUserId, messages: msgs }) => {
      setDmConvs(prev => ({ ...prev, [withUserId]: msgs }));
    });

    // Voice calls
    socket.on("call:offer", ({ fromUser, offer }) => {
      if (peerRef.current) {
        socket.emit("call:decline", { toUserId: fromUser.id }); return;
      }
      setIncomingCall({ fromUser, offer });
      pendingCandidates.current = [];
    });

    socket.on("call:answer", async ({ fromUserId, answer }) => {
      if (!peerRef.current) return;
      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        for (const c of pendingCandidates.current) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingCandidates.current = [];
        setActiveCall(prev => prev ? { ...prev, status: "active" } : prev);
      } catch (err) { console.error("call:answer error", err); }
    });

    socket.on("call:ice-candidate", async ({ fromUserId, candidate }) => {
      if (!peerRef.current || !peerRef.current.remoteDescription) {
        pendingCandidates.current.push(candidate); return;
      }
      try { await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (err) { /* ignore */ }
    });

    socket.on("call:ended",   ({ fromUserId }) => {
      const cur = activeCallRef.current;
      if (cur?.user?.id === fromUserId) { cleanupCall(); showToast("Call ended."); }
      if (incomingCall?.fromUser?.id === fromUserId) setIncomingCall(null);
    });

    socket.on("call:declined", ({ fromUserId }) => {
      const cur = activeCallRef.current;
      if (cur?.user?.id === fromUserId) { cleanupCall(); showToast("Call declined."); }
    });

    socket.on("call:error", ({ message }) => { showToast(message); cleanupCall(); });

    socket.on("connect_error", (err) => { setAuthError(err.message || "Connection failed."); setLoading(false); socket.disconnect(); });
    socket.on("error",         ({ message }) => { setAuthError(message); setLoading(false); socket.disconnect(); });

    return () => {
      [
        "connect","disconnect","user:joined","general:history","users:update","friend:list",
        "friend:requests","message:new","message:reaction:update","typing:start","typing:stop",
        "friend:request:incoming","friend:request:sent","friend:accepted","friend:error",
        "dm:message","dm:history","call:offer","call:answer","call:ice-candidate",
        "call:ended","call:declined","call:error","connect_error","error",
      ].forEach(ev => socket.off(ev));
    };
  }, []); // eslint-disable-line

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const handleAuth = useCallback(async (mode, username, password) => {
    setAuthError(""); setLoading(true);
    try {
      if (mode === "register") {
        const res  = await fetch(`${SERVER_URL}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
        const data = await res.json();
        if (!res.ok) { setAuthError(data.error || "Registration failed."); setLoading(false); return; }
      }
      const res  = await fetch(`${SERVER_URL}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || "Login failed."); setLoading(false); return; }
      socket.auth = { token: data.token };
      socket.connect();
    } catch { setAuthError("Could not reach the server. Is it running?"); setLoading(false); }
  }, []);

  const handleLeave = useCallback(() => {
    cleanupCall();
    socket.disconnect();
    setPhase("auth"); setMe(""); setMyUserId(""); setMyStatus("online");
    setMessages([]); setMsgReactions({}); setUsers([]); setFriends([]);
    setFriendRequests([]); setConnected(false); setAuthError("");
    setActiveDM(null); setDmConvs({}); setDmUnread({});
    setTypingGeneral([]); setTypingDM({});
    setIncomingCall(null); setActiveCall(null);
  }, []); // eslint-disable-line

  const handleSend          = useCallback((text) => socket.emit("message:send", { text }), []);
  const handleFriendRequest = useCallback((username) => { setFriendError(""); setFriendSuccess(""); socket.emit("friend:request", { toUsername: username }); }, []);
  const handleAcceptFriend  = useCallback((fromUserId) => socket.emit("friend:accept",  { fromUserId }), []);
  const handleDeclineFriend = useCallback((fromUserId) => socket.emit("friend:decline", { fromUserId }), []);
  const handleRemoveFriend  = useCallback((friendId) => { socket.emit("friend:remove", { friendId }); setActiveDM(cur => cur?.id === friendId ? null : cur); }, []);
  const handleOpenDM        = useCallback((friend) => {
    setActiveDM(friend);
    setDmUnread(prev => { const n = { ...prev }; delete n[friend.id]; return n; });
    socket.emit("dm:history", { withUserId: friend.id });
  }, []);
  const handleDMSend        = useCallback((text) => { if (activeDMRef.current) socket.emit("dm:send", { toUserId: activeDMRef.current.id, text }); }, []);
  const handleReact         = useCallback((msgId, emoji) => socket.emit("message:react", { msgId, emoji }), []);
  const handleStatusChange  = useCallback((status) => { setMyStatus(status); socket.emit("status:set", { status }); }, []);

  if (phase === "auth") return <AuthScreen onAuthSuccess={handleAuth} error={authError} loading={loading} />;

  // Current DM typers
  const dmTypers = activeDM ? Object.values(typingDM).filter(u => u.id === activeDM.id) : [];

  // Find full friend data for activeDM
  const activeDMFriend = activeDM
    ? friends.find(f => f.id === activeDM.id) || activeDM
    : null;

  return (
    <>
      <style>{EXTRA_CSS}</style>
      <audio ref={remoteAudioRef} autoPlay style={{ display: "none" }} />

      {/* Incoming call modal */}
      {incomingCall && (
        <IncomingCallModal
          caller={incomingCall.fromUser}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}

      {toast && <div className="notif-toast">{toast}</div>}

      <div className="chat-layout">
        <Sidebar
          me={me}
          myUserId={myUserId}
          myStatus={myStatus}
          users={users}
          friends={friends}
          friendRequests={friendRequests}
          dmConvs={dmConvs}
          dmUnread={dmUnread}
          activeDM={activeDM}
          onLeave={handleLeave}
          onFriendRequest={handleFriendRequest}
          onAcceptFriend={handleAcceptFriend}
          onDeclineFriend={handleDeclineFriend}
          onRemoveFriend={handleRemoveFriend}
          onOpenDM={handleOpenDM}
          friendError={friendError}
          friendSuccess={friendSuccess}
          onCall={startCall}
          inCall={activeCall}
          onStatusChange={handleStatusChange}
        />

        <div className="chat-area" style={{ display: "flex", flexDirection: "column" }}>
          {activeDM ? (
            <DMConversation
              me={me}
              partner={activeDMFriend}
              messages={dmConvs[activeDM.id] || []}
              connected={connected}
              onSend={handleDMSend}
              typers={dmTypers}
              onBack={() => setActiveDM(null)}
              onCall={startCall}
              inCall={activeCall}
            />
          ) : (
            <GeneralChat
              me={me}
              myUserId={myUserId}
              messages={messages}
              msgReactions={msgReactions}
              connected={connected}
              onSend={handleSend}
              typers={typingGeneral}
              onReact={handleReact}
              onTypingStart={() => socket.emit("typing:start", {})}
              onTypingStop={() => socket.emit("typing:stop", {})}
            />
          )}

          {/* Active call bar */}
          {activeCall && (
            <ActiveCallBar
              callUser={activeCall.user}
              status={activeCall.status}
              duration={callDuration}
              muted={callMuted}
              onMute={toggleMute}
              onEnd={endCall}
            />
          )}
        </div>
      </div>
    </>
  );
}
