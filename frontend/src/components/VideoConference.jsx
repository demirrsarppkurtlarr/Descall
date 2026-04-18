import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Grid, Maximize2, Users } from "lucide-react";
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
}) {
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

  // Filter active participants (with streams)
  const activeParticipants = participants.filter(p => 
    call.remoteStreams.current.has(p.id)
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
    participants.find(p => p.isScreenSharing)?.id ||
    dominantSpeaker ||
    activeParticipants[0]?.id;

  const focusParticipant = participants.find(p => p.id === focusTarget);
  const focusStream = focusTarget ? call.remoteStreams.current.get(focusTarget) : null;

  // Thumbnail participants (focus view)
  const thumbnailParticipants = viewMode === "focus" 
    ? activeParticipants.filter(p => p.id !== focusTarget)
    : [];

  return (
    <motion.div
      ref={containerRef}
      className="video-conference-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
          <span>{participants.length + 1} participants</span>
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
              const stream = call.remoteStreams.current.get(participant.id);
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
                const stream = call.remoteStreams.current.get(p.id);
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
