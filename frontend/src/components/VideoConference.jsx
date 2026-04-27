import { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Grid, Maximize2, Users, Minimize2, Volume2, Headphones, ChevronDown, Settings, Sparkles, Activity, Check, X } from "lucide-react";
import RippleButton from "./ui/RippleButton";
import VoiceEffectsPanel from "./VoiceEffectsPanel";

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
  screenQuality,
  setScreenQuality,
  // Audio device selection props
  audioInputDevices = [],
  audioOutputDevices = [],
  selectedAudioInput = "",
  selectedAudioOutput = "",
  onAudioInputChange = () => {},
  onAudioOutputChange = () => {},
}) {
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const remoteStreamMap = remoteStreams?.current instanceof Map ? remoteStreams.current : new Map();
  
  // DEBUG: Log participants data
  console.log("[VideoConference] Participants raw:", JSON.stringify(safeParticipants, null, 2));
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "focus"
  const [showControls, setShowControls] = useState(true);
  const [fullscreenParticipant, setFullscreenParticipant] = useState(null); // null | 'local' | userId
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showVoiceEffects, setShowVoiceEffects] = useState(false);
  const [showScreenQuality, setShowScreenQuality] = useState(false);
  const [localAudioInputs, setLocalAudioInputs] = useState([]);
  const [localAudioOutputs, setLocalAudioOutputs] = useState([]);
  const controlsTimeoutRef = useRef(null);
  const containerRef = useRef(null);
  const audioSettingsRef = useRef(null);
  const screenQualityRef = useRef(null);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // Stable screen stream handling - prevents flickering
  // Use Map for multiple participant screen shares
  const screenVideoRefs = useRef(new Map());
  
  // Cleanup refs when unmounting
  useEffect(() => {
    return () => {
      screenVideoRefs.current.forEach((video, id) => {
        if (video) {
          video.srcObject = null;
        }
      });
      screenVideoRefs.current.clear();
    };
  }, []);
  
  // Handle local screen share
  useEffect(() => {
    if (screenStream && isScreenSharing) {
      const localVideo = screenVideoRefs.current.get('local');
      if (localVideo && localVideo.srcObject !== screenStream) {
        localVideo.srcObject = screenStream;
        localVideo.play().catch(() => {});
      }
    }
    return () => {
      const localVideo = screenVideoRefs.current.get('local');
      if (localVideo && !isScreenSharing) {
        localVideo.srcObject = null;
      }
    };
  }, [screenStream, isScreenSharing]);
  
  // TDZ FIX: Define activeParticipants BEFORE useEffect that uses it
  // Filter active participants (with streams)
  const activeParticipants = safeParticipants.filter((p) =>
    remoteStreamMap.has(p.id)
  );

  // COMPLETE REWRITE: Stable video element management
  const videoElementRefs = useRef(new Map()); // participantId -> video element
  const screenVideoElementRefs = useRef(new Map()); // participantId -> screen video element
  const streamAssignments = useRef(new Map()); // participantId -> current stream
  const screenStreamAssignments = useRef(new Map()); // participantId -> current screen stream
  
  // Manual stream assignment function - async with proper sequencing
  const assignStreamToVideo = useCallback(async (participantId, stream) => {
    const video = videoElementRefs.current.get(participantId);
    if (video && video.srcObject !== stream) {
      console.log(`[VideoConference] Assigning stream to ${participantId}`);
      
      // Stop current playback to prevent race condition
      if (video.srcObject) {
        video.pause();
        video.currentTime = 0;
      }
      
      // Assign new stream
      video.srcObject = stream;
      streamAssignments.current.set(participantId, stream);
      
      // Wait for stream to be ready before playing
      if (stream) {
        try {
          await video.play();
        } catch (error) {
          console.warn(`[VideoConference] Failed to play video for ${participantId}:`, error);
        }
      }
    }
  }, []);
  
  // Manual screen stream assignment function - async with proper sequencing
  const assignScreenStreamToVideo = useCallback(async (participantId, screenStream) => {
    const video = screenVideoElementRefs.current.get(participantId);
    if (video && video.srcObject !== screenStream) {
      console.log(`[VideoConference] Assigning screen stream to ${participantId}`);
      
      // Stop current playback to prevent race condition
      if (video.srcObject) {
        video.pause();
        video.currentTime = 0;
      }
      
      // Assign new stream
      video.srcObject = screenStream;
      screenStreamAssignments.current.set(participantId, screenStream);
      
      // Wait for stream to be ready before playing
      if (screenStream) {
        try {
          await video.play();
        } catch (error) {
          console.warn(`[VideoConference] Failed to play screen video for ${participantId}:`, error);
        }
      }
    }
  }, []);
  
  // Cleanup function for removed participants
  const cleanupParticipant = useCallback((participantId) => {
    const video = videoElementRefs.current.get(participantId);
    if (video) {
      video.srcObject = null;
      video.load();
    }
    const screenVideo = screenVideoElementRefs.current.get(participantId);
    if (screenVideo) {
      screenVideo.srcObject = null;
      screenVideo.load();
    }
    videoElementRefs.current.delete(participantId);
    screenVideoElementRefs.current.delete(participantId);
    streamAssignments.current.delete(participantId);
    screenStreamAssignments.current.delete(participantId);
    console.log(`[VideoConference] Cleaned up participant ${participantId}`);
  }, []);
  
  // Update streams when participants change - but only assign to existing elements
  useEffect(() => {
    const updateStreams = async () => {
      const currentIds = new Set(activeParticipants.map(p => p.id));
      
      // Cleanup removed participants - check BOTH video and screen refs
      const allParticipantIds = new Set([
        ...videoElementRefs.current.keys(),
        ...screenVideoElementRefs.current.keys()
      ]);
      
      for (const participantId of allParticipantIds) {
        if (!currentIds.has(participantId)) {
          cleanupParticipant(participantId);
        }
      }
      
      // Update streams for existing participants - await all assignments
      const streamPromises = activeParticipants.map(async (p) => {
        const stream = remoteStreamMap.get(p.id);
        await assignStreamToVideo(p.id, stream);
        
        if (p.screenStream && p.isScreenSharing) {
          await assignScreenStreamToVideo(p.id, p.screenStream);
        } else {
          await assignScreenStreamToVideo(p.id, null);
        }
      });
      
      // Wait for all stream assignments to complete
      await Promise.allSettled(streamPromises);
    };
    
    updateStreams().catch(error => {
      console.error('[VideoConference] Error updating streams:', error);
    });
  }, [activeParticipants, remoteStreamMap, assignStreamToVideo, assignScreenStreamToVideo, cleanupParticipant]);

  // Screen sharing quality handlers
  const handleStartScreenShare = useCallback(async () => {
    if (startScreenShare) {
      await startScreenShare(screenQuality);
    }
  }, [startScreenShare, screenQuality]);

  const handleResolutionChange = useCallback(async (resolution) => {
    if (setScreenQuality) {
      setScreenQuality(prev => ({ ...prev, resolution }));
      // If already screen sharing, restart with new quality
      if (isScreenSharing && stopScreenShare && startScreenShare) {
        console.log('[VideoConference] Restarting screen share with new resolution:', resolution);
        await stopScreenShare();
        // Small delay to ensure cleanup
        setTimeout(() => startScreenShare({ resolution, fps: screenQuality.fps }), 100);
      }
    }
  }, [setScreenQuality, isScreenSharing, stopScreenShare, startScreenShare, screenQuality]);

  const handleFpsChange = useCallback(async (fps) => {
    if (setScreenQuality) {
      setScreenQuality(prev => ({ ...prev, fps }));
      // If already screen sharing, restart with new quality
      if (isScreenSharing && stopScreenShare && startScreenShare) {
        console.log('[VideoConference] Restarting screen share with new FPS:', fps);
        await stopScreenShare();
        // Small delay to ensure cleanup
        setTimeout(() => startScreenShare({ resolution: screenQuality.resolution, fps }), 100);
      }
    }
  }, [setScreenQuality, isScreenSharing, stopScreenShare, startScreenShare, screenQuality]);

  // Enumerate audio devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setLocalAudioInputs(inputs);
        setLocalAudioOutputs(outputs);
      } catch (err) {
        console.error("[VideoConference] Failed to enumerate devices:", err);
      }
    };
    
    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, []);

  // Close audio settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (audioSettingsRef.current && !audioSettingsRef.current.contains(e.target)) {
        setShowAudioSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
            {isScreenSharing ? (
              <video
                ref={(el) => {
                  if (el) {
                    screenVideoRefs.current.set('local', el);
                    if (screenStream && el.srcObject !== screenStream) {
                      el.srcObject = screenStream;
                    }
                  } else {
                    // Cleanup on unmount
                    const video = screenVideoRefs.current.get('local');
                    if (video) {
                      video.pause();
                      video.srcObject = null;
                    }
                    screenVideoRefs.current.delete('local');
                  }
                }}
                autoPlay
                playsInline
                muted
                className="vc-pip-video"
              />
            ) : isCameraOn ? (
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
              onClick={() => isScreenSharing ? stopScreenShare() : startScreenShare()}
              title={isScreenSharing ? "Stop screen sharing" : "Start screen sharing"}
            >
              <Monitor size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

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
    <>
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
              {isCameraOn ? (
                <video
                  ref={(el) => {
                    if (el && localStream) el.srcObject = localStream;
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="vc-video"
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              ) : (
                <div className="vc-avatar-placeholder">
                  <span>You</span>
                </div>
              )}
              <div className="vc-video-badge">
                {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
              </div>
              <span className="vc-name">You</span>
            </div>

            {/* Remote Videos */}
            {activeParticipants.map((participant) => {
              const stream = remoteStreamMap.get(participant.id);
              const screenStream = participant.screenStream;
              const isFocused = focusedParticipant === participant.id;
              const isFullscreen = fullscreenParticipant === participant.id;
              const hasScreenShare = screenStream && participant.isScreenSharing;
              
              return (
                <div 
                  key={participant.id}
                  className={`vc-video-cell ${isFocused ? 'focused' : ''} ${hasScreenShare ? 'has-screen-share' : ''}`}
                  onClick={() => setFocusedParticipant(participant.id)}
                >
                  {/* Camera Video */}
                  {stream && participant.hasVideo ? (
                    <video
                      ref={(el) => {
                        if (el) {
                          videoElementRefs.current.set(participant.id, el);
                          // Assign current stream if available
                          const currentStream = streamAssignments.current.get(participant.id);
                          if (currentStream && el.srcObject !== currentStream) {
                            el.srcObject = currentStream;
                          }
                        } else {
                          // Cleanup on unmount
                          videoElementRefs.current.delete(participant.id);
                        }
                      }}
                      autoPlay
                      playsInline
                      className="vc-video"
                      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                    />
                  ) : (
                    <div className="vc-avatar-placeholder">
                      <img 
                        src={participant.avatarUrl || "/default-avatar.png"} 
                        alt={participant.username}
                      />
                      <span>{participant.username || participant.user?.username || "Unknown"}</span>
                    </div>
                  )}
                  
                  {/* Screen Share Overlay */}
                  {hasScreenShare && (
                    <div 
                      className={`vc-screen-overlay ${isFullscreen ? 'fullscreen' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullscreenParticipant(isFullscreen ? null : participant.id);
                      }}
                    >
                      <video
                        ref={(el) => {
                          if (el) {
                            screenVideoElementRefs.current.set(participant.id, el);
                            // Assign current screen stream if available
                            const currentStream = screenStreamAssignments.current.get(participant.id);
                            if (currentStream && el.srcObject !== currentStream) {
                              el.srcObject = currentStream;
                            }
                          } else {
                            // Cleanup on unmount
                            screenVideoElementRefs.current.delete(participant.id);
                          }
                        }}
                        autoPlay
                        playsInline
                        className="vc-screen-video"
                      />
                      <div className="vc-screen-badge">
                        <Monitor size={14} />
                        <span>Screen</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="vc-video-badge">
                    {!participant.hasAudio && <MicOff size={14} />}
                    {hasScreenShare && <Monitor size={14} />}
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
                isScreenSharing ? (
                  <video
                    ref={(el) => {
                      if (el) {
                        screenVideoRefs.current.set('local', el);
                        if (screenStream && el.srcObject !== screenStream) {
                          el.srcObject = screenStream;
                        }
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="vc-video"
                  />
                ) : isCameraOn ? (
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
                    if (el) {
                      videoElementRefs.current.set(focusTarget, el);
                      if (el.srcObject !== focusStream) {
                        el.srcObject = focusStream;
                      }
                    } else {
                      videoElementRefs.current.delete(focusTarget);
                    }
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
                  <span>{focusParticipant?.username || focusParticipant?.user?.username || "Unknown"}</span>
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
                        if (el) {
                          videoElementRefs.current.set('local', el);
                          if (el.srcObject !== localStream) {
                            el.srcObject = localStream;
                          }
                        } else {
                          videoElementRefs.current.delete('local');
                        }
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
                          if (el) {
                            videoElementRefs.current.set(p.id, el);
                            if (el.srcObject !== stream) {
                              el.srcObject = stream;
                            }
                          } else {
                            videoElementRefs.current.delete(p.id);
                          }
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
                    <span className="vc-thumb-name">{p.username || p.user?.username || "Unknown"}</span>
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
          {/* Audio Settings Button with Dropdown */}
          <div className="vc-audio-settings-container" ref={audioSettingsRef}>
            <RippleButton
              className={`vc-btn ${showAudioSettings ? 'active' : ''}`}
              onClick={() => setShowAudioSettings(!showAudioSettings)}
              title="Audio Settings"
            >
              <Settings size={20} />
              <ChevronDown size={14} className={`vc-dropdown-icon ${showAudioSettings ? 'open' : ''}`} />
            </RippleButton>
            
            {/* Audio Settings Panel */}
            <AnimatePresence>
              {showAudioSettings && (
                <motion.div
                  className="vc-audio-settings-panel"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="vc-audio-section">
                    <div className="vc-audio-label">
                      <Mic size={14} />
                      <span>Mikrofon</span>
                    </div>
                    <select 
                      className="vc-audio-select"
                      value={selectedAudioInput}
                      onChange={(e) => onAudioInputChange(e.target.value)}
                    >
                      {audioInputDevices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Mikrofon ${device.deviceId.slice(0, 5)}`}
                        </option>
                      ))}
                      {audioInputDevices.length === 0 && (
                        <option value="">Mikrofon bulunamadı</option>
                      )}
                    </select>
                  </div>
                  
                  <div className="vc-audio-section">
                    <div className="vc-audio-label">
                      <Headphones size={14} />
                      <span>Cihaz</span>
                    </div>
                    <select 
                      className="vc-audio-select"
                      value={selectedAudioOutput}
                      onChange={(e) => onAudioOutputChange(e.target.value)}
                    >
                      {audioOutputDevices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Hoparlör ${device.deviceId.slice(0, 5)}`}
                        </option>
                      ))}
                      {audioOutputDevices.length === 0 && (
                        <option value="">Varsayılan cihaz</option>
                      )}
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <RippleButton
            className={`vc-btn ${isMuted ? 'danger' : ''}`}
            onClick={toggleMute}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </RippleButton>
          
          {/* Voice Effects Button */}
          <RippleButton
            className={`vc-btn ${showVoiceEffects ? 'active' : ''}`}
            onClick={() => setShowVoiceEffects(!showVoiceEffects)}
            title="Ses Efektleri"
          >
            <Sparkles size={20} />
          </RippleButton>
          
          <RippleButton
            className={`vc-btn ${!isCameraOn ? 'danger' : ''}`}
            onClick={toggleCamera}
            disabled={callType === "voice" && !isCameraOn}
          >
            {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
          </RippleButton>
          
          {/* Screen Share with Quality Selector */}
          <div className="screen-share-container" ref={screenQualityRef}>
            <RippleButton
              className={`vc-btn ${isScreenSharing ? 'active' : ''}`}
              onClick={() => isScreenSharing ? stopScreenShare() : handleStartScreenShare()}
              title={isScreenSharing ? "Stop screen sharing" : "Start screen sharing"}
            >
              <Monitor size={20} />
            </RippleButton>
            
            {/* Quality Settings Dropdown */}
            {!isScreenSharing && (
              <button
                className="quality-toggle-btn"
                onClick={() => setShowScreenQuality(!showScreenQuality)}
                title="Screen quality settings"
              >
                <Settings size={14} />
              </button>
            )}
            
            {/* Advanced Quality Selector Panel */}
            <AnimatePresence>
              {showScreenQuality && !isScreenSharing && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="screen-quality-panel advanced"
                >
                  <div className="quality-header">
                    <Monitor size={18} />
                    <span>Advanced Screen Settings</span>
                    <button 
                      className="quality-close-btn"
                      onClick={() => setShowScreenQuality(false)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  
                  {/* Resolution Selector */}
                  <div className="quality-section">
                    <label className="quality-label">
                      <Maximize2 size={16} />
                      Resolution
                      <span className="quality-description">Select display resolution</span>
                    </label>
                    <div className="quality-options-grid">
                      {[
                        { value: '480p', label: '480p', desc: '854×480', icon: '📱' },
                        { value: '720p', label: '720p HD', desc: '1280×720', icon: '🎥' },
                        { value: '1080p', label: '1080p FHD', desc: '1920×1080', icon: '📺' },
                        { value: '1440p', label: '1440p QHD', desc: '2560×1440', icon: '🖥️' },
                        { value: '2160p', label: '2160p 4K', desc: '3840×2160', icon: '🎬' },
                        { value: 'custom', label: 'Custom', desc: 'Custom size', icon: '⚙️' }
                      ].map((res) => (
                        <button
                          key={res.value}
                          className={`quality-option-card ${screenQuality?.resolution === res.value ? 'active' : ''}`}
                          onClick={() => handleResolutionChange(res.value)}
                        >
                          <div className="quality-option-icon">{res.icon}</div>
                          <div className="quality-option-content">
                            <div className="quality-option-label">{res.label}</div>
                            <div className="quality-option-desc">{res.desc}</div>
                          </div>
                          {screenQuality?.resolution === res.value && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* FPS Selector */}
                  <div className="quality-section">
                    <label className="quality-label">
                      <Activity size={16} />
                      Frame Rate (FPS)
                      <span className="quality-description">Higher FPS = smoother video</span>
                    </label>
                    <div className="quality-options-grid">
                      {[
                        { value: 15, label: '15 FPS', desc: 'Low bandwidth', icon: '🐌' },
                        { value: 24, label: '24 FPS', desc: 'Cinema standard', icon: '🎬' },
                        { value: 30, label: '30 FPS', desc: 'Standard smooth', icon: '📹' },
                        { value: 60, label: '60 FPS', desc: 'High quality', icon: '🎮' },
                        { value: 120, label: '120 FPS', desc: 'Ultra smooth', icon: '⚡' },
                        { value: 144, label: '144 FPS', desc: 'Gaming grade', icon: '🚀' }
                      ].map((fps) => (
                        <button
                          key={fps.value}
                          className={`quality-option-card ${screenQuality?.fps === fps.value ? 'active' : ''}`}
                          onClick={() => handleFpsChange(fps.value)}
                        >
                          <div className="quality-option-icon">{fps.icon}</div>
                          <div className="quality-option-content">
                            <div className="quality-option-label">{fps.label}</div>
                            <div className="quality-option-desc">{fps.desc}</div>
                          </div>
                          {screenQuality?.fps === fps.value && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Additional Settings */}
                  <div className="quality-section">
                    <label className="quality-label">
                      <Settings size={16} />
                      Additional Settings
                      <span className="quality-description">Optimize your sharing experience</span>
                    </label>
                    <div className="quality-toggles">
                      <div className="quality-toggle-item">
                        <label className="toggle-label">
                          <input type="checkbox" defaultChecked />
                          <span className="toggle-slider"></span>
                          <span className="toggle-text">Show cursor</span>
                        </label>
                      </div>
                      <div className="quality-toggle-item">
                        <label className="toggle-label">
                          <input type="checkbox" defaultChecked />
                          <span className="toggle-slider"></span>
                          <span className="toggle-text">Optimize for motion</span>
                        </label>
                      </div>
                      <div className="quality-toggle-item">
                        <label className="toggle-label">
                          <input type="checkbox" />
                          <span className="toggle-slider"></span>
                          <span className="toggle-text">Hardware acceleration</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="quality-footer">
                    <div className="quality-stats">
                      <div className="quality-stat">
                        <span className="stat-label">Estimated Bandwidth:</span>
                        <span className="stat-value">
                          {screenQuality?.resolution === '2160p' && screenQuality?.fps >= 60 ? '15-25 Mbps' :
                           screenQuality?.resolution === '1440p' && screenQuality?.fps >= 60 ? '10-15 Mbps' :
                           screenQuality?.resolution === '1080p' && screenQuality?.fps >= 60 ? '8-12 Mbps' :
                           screenQuality?.resolution === '1080p' ? '5-8 Mbps' :
                           screenQuality?.resolution === '720p' ? '3-5 Mbps' : '1-3 Mbps'}
                        </span>
                      </div>
                      <div className="quality-stat">
                        <span className="stat-label">Performance Impact:</span>
                        <span className={`stat-value ${screenQuality?.resolution === '2160p' || (screenQuality?.resolution === '1440p' && screenQuality?.fps >= 60) ? 'high' : screenQuality?.resolution === '1440p' || (screenQuality?.resolution === '1080p' && screenQuality?.fps >= 60) ? 'medium' : 'low'}`}>
                          {screenQuality?.resolution === '2160p' || (screenQuality?.resolution === '1440p' && screenQuality?.fps >= 60) ? 'High' :
                           screenQuality?.resolution === '1440p' || (screenQuality?.resolution === '1080p' && screenQuality?.fps >= 60) ? 'Medium' : 'Low'}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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

    {/* Voice Effects Panel - outside main container but inside return */}
    {showVoiceEffects && (
      <VoiceEffectsPanel
        isOpen={showVoiceEffects}
        onClose={() => setShowVoiceEffects(false)}
        localStream={localStream}
        onProcessedStream={(processedStream) => {
          console.log('Voice effects stream processed');
        }}
      />
    )}
  </>
  );
}
