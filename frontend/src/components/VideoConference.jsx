import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Grid, Maximize2, Users, Minimize2 } from "lucide-react";
import RippleButton from "./ui/RippleButton";

/**
 * Discord/Google Meet tarzı video conference UI
 * - Grid view: Tüm katılımcılar eşit boyutta
 * - Focus view: Aktif konuşan/ekran paylaşan büyük, diğerleri altta thumbnail
 * - Tıklama ile büyütme/küçültme
 * - Ekran paylaşımı otomatik focus
 */
export default function VideoConference({
  isOpen,
  onClose,
  minimized = false,
  onMinimize,
  call,
  participants,
  localStream,
  screenStream,
  isMuted,
  isCameraOn,
  isScreenSharing,
  toggleMute,
  toggleCamera,
  startScreenShare,
  stopScreenShare,
  leaveCall,
  callType,
  dominantSpeaker,
  focusedParticipant,
  setFocusedParticipant,
  duration = 0,
  remoteStreams,
}) {
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const remoteStreamMap = remoteStreams?.current instanceof Map ? remoteStreams.current : new Map();
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "focus"
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimer]);

  if (!isOpen) return null;

  // Minimized view - sleek draggable rectangle
  if (minimized) {
    return (
      <motion.div
        className="video-conference-pip"
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        drag
        dragMomentum={false}
        whileDrag={{ scale: 1.02, cursor: "grabbing" }}
        dragConstraints={{ left: -window.innerWidth + 320, right: 0, top: -window.innerHeight + 240, bottom: 0 }}
        style={{ 
          position: "fixed", 
          bottom: 24, 
          right: 24, 
          zIndex: 1000,
          cursor: "grab"
        }}
      >
        <div className="vc-pip-container">
          {/* Draggable Header Bar */}
          <div className="vc-pip-header">
            <div className="vc-pip-drag-handle">
              <div className="vc-pip-dots">
                <span></span><span></span><span></span>
              </div>
              <span className="vc-pip-participants">
                <Users size={12} />
                {safeParticipants.length + 1}
              </span>
            </div>
            <div className="vc-pip-window-controls">
              <button className="vc-pip-btn" onClick={onMinimize} title="Restore">
                <Maximize2 size={14} />
              </button>
              <button className="vc-pip-btn danger" onClick={leaveCall} title="End call">
                <PhoneOff size={14} />
              </button>
            </div>
          </div>

          {/* Main Video Area - Rectangle 16:9 */}
          <div className="vc-pip-video-area">
            {isCameraOn || isScreenSharing ? (
              <video
                ref={(el) => {
                  if (el && localStream) el.srcObject = localStream;
                }}
                autoPlay
                playsInline
                muted
                className="vc-pip-video"
              />
            ) : (
              <div className="vc-pip-avatar">
                <span>You</span>
              </div>
            )}
            
            {/* Status Overlay */}
            <div className="vc-pip-status">
              {isMuted && (
                <div className="vc-pip-badge muted">
                  <MicOff size={12} />
                </div>
              )}
              {isScreenSharing && (
                <div className="vc-pip-badge screen">
                  <Monitor size={12} />
                </div>
              )}
              <div className="vc-pip-duration">
                {Math.floor(duration / 60).toString().padStart(2, '0')}:{(duration % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Control Bar */}
          <div className="vc-pip-controls">
            <button 
              className={`vc-pip-control ${isMuted ? 'active' : ''}`} 
              onClick={toggleMute}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button 
              className={`vc-pip-control ${!isCameraOn ? 'active' : ''}`} 
              onClick={toggleCamera}
            >
              {isCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
            </button>
            <button 
              className={`vc-pip-control ${isScreenSharing ? 'active' : ''}`} 
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            >
              <Monitor size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Filter active participants (with streams)
  const activeParticipants = safeParticipants.filter((p) =>
    remoteStreamMap.has(p.id)
  );

  // Grid layout calculation
  const getGridCols = (count) => {
    if (count <= 1) return 1;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    return 4; // Max 16 (4x4) for 15 people limit
  };

  const getGridRows = (count, cols) => Math.ceil(count / cols);

  const totalVideos = activeParticipants.length + 1; // +1 for local
  const gridCols = getGridCols(totalVideos);
  const gridRows = getGridRows(totalVideos, gridCols);

  // Focus view: who to show big
  const focusTarget = focusedParticipant || 
    safeParticipants.find((p) => p.isScreenSharing)?.id ||
    dominantSpeaker ||
    activeParticipants[0]?.id;

  const focusParticipant = safeParticipants.find((p) => p.id === focusTarget);
  const focusStream = focusTarget ? remoteStreamMap.get(focusTarget) : null;

  // Thumbnail participants (focus view)
  const thumbnailParticipants = viewMode === "focus"
    ? (activeParticipants || []).filter(p => p.id !== focusTarget)
    : [];

  return (
    <motion.div
      ref={containerRef}
      className="video-conference-overlay"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{ transformOrigin: "50% 50%" }}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
    >
      {/* Header */}
      <motion.div 
        className={`vc-header ${showControls ? 'visible' : ''}`}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: showControls ? 0 : -20, opacity: showControls ? 1 : 0 }}
      >
        <div className="vc-title">
          <Users size={18} />
          <span>{safeParticipants.length + 1} participants</span>
        </div>
        <div className="vc-view-toggle">
          <button
            className={viewMode === "grid" ? "active" : ""}
            onClick={() => setViewMode("grid")}
          >
            <Grid size={18} />
          </button>
          <button
            className={viewMode === "focus" ? "active" : ""}
            onClick={() => setViewMode("focus")}
          >
            <Maximize2 size={18} />
          </button>
          {onMinimize && (
            <button onClick={onMinimize} title="Minimize">
              <Minimize2 size={18} />
            </button>
          )}
        </div>
      </motion.div>

      {/* Main Video Area */}
      <div className={`vc-main ${viewMode}`}>
        {viewMode === "grid" ? (
          // Grid View
          <div 
            className="vc-grid"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gridTemplateRows: `repeat(${gridRows}, 1fr)`,
            }}
          >
            {/* Local Video */}
            <div 
              className={`vc-video-cell ${focusedParticipant === 'local' ? 'focused' : ''}`}
              onClick={() => setFocusedParticipant('local')}
            >
              {isCameraOn || isScreenSharing ? (
                <video
                  ref={(el) => {
                    if (el && localStream) el.srcObject = localStream;
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="vc-video"
                />
              ) : (
                <div className="vc-avatar-placeholder">
                  <span>You</span>
                </div>
              )}
              <div className="vc-video-badge">
                {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                {isScreenSharing && <Monitor size={14} />}
              </div>
              <span className="vc-name">You</span>
            </div>

            {/* Remote Videos */}
            {activeParticipants.map((participant) => {
              const stream = remoteStreamMap.get(participant.id);
              const isFocused = focusedParticipant === participant.id;
              
              return (
                <div 
                  key={participant.id}
                  className={`vc-video-cell ${isFocused ? 'focused' : ''}`}
                  onClick={() => setFocusedParticipant(participant.id)}
                >
                  {stream && (participant.hasVideo || participant.isScreenSharing) ? (
                    <video
                      ref={(el) => {
                        if (el) el.srcObject = stream;
                      }}
                      autoPlay
                      playsInline
                      className="vc-video"
                    />
                  ) : (
                    <div className="vc-avatar-placeholder">
                      <img 
                        src={participant.avatarUrl || "/default-avatar.png"} 
                        alt={participant.username}
                      />
                      <span>{participant.username}</span>
                    </div>
                  )}
                  <div className="vc-video-badge">
                    {!participant.hasAudio && <MicOff size={14} />}
                    {participant.isScreenSharing && <Monitor size={14} />}
                  </div>
                  <span className="vc-name">{participant.username}</span>
                </div>
              );
            })}
          </div>
        ) : (
          // Focus View
          <>
            {/* Main Focus Video */}
            <div className="vc-focus-main">
              {focusTarget === 'local' ? (
                isCameraOn || isScreenSharing ? (
                  <video
                    ref={(el) => {
                      if (el && localStream) el.srcObject = localStream;
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="vc-video"
                  />
                ) : (
                  <div className="vc-avatar-placeholder large">
                    <span>You</span>
                  </div>
                )
              ) : focusStream ? (
                <video
                  ref={(el) => {
                    if (el) el.srcObject = focusStream;
                  }}
                  autoPlay
                  playsInline
                  className="vc-video"
                />
              ) : (
                <div className="vc-avatar-placeholder large">
                  <img 
                    src={focusParticipant?.avatarUrl || "/default-avatar.png"}
                    alt={focusParticipant?.username}
                  />
                  <span>{focusParticipant?.username}</span>
                </div>
              )}
              
              {/* Screen share indicator */}
              {(focusTarget === 'local' ? isScreenSharing : focusParticipant?.isScreenSharing) && (
                <div className="vc-screen-indicator">
                  <Monitor size={20} />
                  <span>Screen Sharing</span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            <div className="vc-thumbnails">
              {/* Local thumbnail */}
              {focusTarget !== 'local' && (
                <div 
                  className="vc-thumb"
                  onClick={() => setFocusedParticipant('local')}
                >
                  {isCameraOn ? (
                    <video
                      ref={(el) => {
                        if (el && localStream) el.srcObject = localStream;
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="vc-thumb-video"
                    />
                  ) : (
                    <div className="vc-thumb-avatar">You</div>
                  )}
                </div>
              )}

              {/* Remote thumbnails */}
              {thumbnailParticipants.map((p) => {
                const stream = remoteStreamMap.get(p.id);
                return (
                  <div 
                    key={p.id}
                    className="vc-thumb"
                    onClick={() => setFocusedParticipant(p.id)}
                  >
                    {stream && (p.hasVideo || p.isScreenSharing) ? (
                      <video
                        ref={(el) => {
                          if (el) el.srcObject = stream;
                        }}
                        autoPlay
                        playsInline
                        className="vc-thumb-video"
                      />
                    ) : (
                      <div className="vc-thumb-avatar">
                        <img src={p.avatarUrl || "/default-avatar.png"} alt={p.username} />
                      </div>
                    )}
                    <span className="vc-thumb-name">{p.username}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <motion.div 
        className={`vc-controls ${showControls ? 'visible' : ''}`}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: showControls ? 0 : 20, opacity: showControls ? 1 : 0 }}
      >
        <div className="vc-control-group">
          <RippleButton
            className={`vc-btn ${isMuted ? 'danger' : ''}`}
            onClick={toggleMute}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </RippleButton>
          
          <RippleButton
            className={`vc-btn ${!isCameraOn ? 'danger' : ''}`}
            onClick={toggleCamera}
            disabled={callType === "voice" && !isCameraOn}
          >
            {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
          </RippleButton>
          
          <RippleButton
            className={`vc-btn ${isScreenSharing ? 'active' : ''}`}
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          >
            <Monitor size={20} />
          </RippleButton>
        </div>

        <RippleButton
          className="vc-btn danger vc-end-call"
          onClick={leaveCall}
        >
          <PhoneOff size={20} />
          <span>End Call</span>
        </RippleButton>
      </motion.div>
    </motion.div>
  );
}
