import { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Users, Minimize2, Sparkles } from "lucide-react";
import RippleButton from "./ui/RippleButton";
import VoiceEffectsPanel from "./VoiceEffectsPanel";

/**
 * Mobile-optimized video conference interface
 * - Full screen video area
 * - Bottom controls with proper spacing
 * - Touch-friendly buttons
 * - No overlap with navigation bar
 */
export default function VideoConferenceMobile({
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
  screenQuality,
  setScreenQuality,
  remoteStreams,
  onProcessedStream,
}) {
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const [showVoiceEffects, setShowVoiceEffects] = useState(false);
  
  // Get remote streams for mobile participants
  const remoteStreamMap = remoteStreams?.current instanceof Map ? remoteStreams.current : new Map();
  
  // Stable element management for mobile
  const videoElementRefs = useRef(new Map());
  const screenVideoElementRefs = useRef(new Map());
  const streamAssignments = useRef(new Map());
  const screenStreamAssignments = useRef(new Map());

  // Assign stream to video element
  const assignStreamToVideo = useCallback(async (participantId, stream) => {
    const video = videoElementRefs.current.get(participantId);
    if (video && video.srcObject !== stream) {
      if (video.srcObject) {
        video.pause();
        video.currentTime = 0;
      }
      video.srcObject = stream;
      streamAssignments.current.set(participantId, stream);
      
      if (stream) {
        try {
          await video.play();
        } catch (error) {
          console.warn(`[VideoConferenceMobile] Failed to play video for ${participantId}:`, error);
        }
      }
    }
  }, []);

  // Assign screen stream to video element
  const assignScreenStreamToVideo = useCallback(async (elementId, screenStream) => {
    const video = screenVideoElementRefs.current.get(elementId);
    if (video && video.srcObject !== screenStream) {
      if (video.srcObject) {
        video.pause();
        video.currentTime = 0;
      }
      video.srcObject = screenStream;
      screenStreamAssignments.current.set(elementId, screenStream);
      
      if (screenStream) {
        try {
          await video.play();
        } catch (error) {
          console.warn(`[VideoConferenceMobile] Failed to play screen video for ${elementId}:`, error);
        }
      }
    }
  }, []);

  // Update streams when they change
  useEffect(() => {
    const updateStreams = async () => {
      // Handle main participant video
      if (safeParticipants.length > 0) {
        const participant = safeParticipants[0];
        const participantStream = remoteStreamMap.get(participant.id);
        await assignStreamToVideo('main-participant', participantStream);
      }
      
      // Handle screen sharing
      if (screenStream && isScreenSharing) {
        await assignScreenStreamToVideo('mobile-main', screenStream);
      } else {
        await assignScreenStreamToVideo('mobile-main', null);
      }
    };
    
    updateStreams().catch(error => {
      console.error('[VideoConferenceMobile] Error updating streams:', error);
    });
  }, [safeParticipants, screenStream, isScreenSharing, assignStreamToVideo, assignScreenStreamToVideo, remoteStreamMap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      videoElementRefs.current.forEach((video, id) => {
        if (video) {
          video.srcObject = null;
        }
      });
      videoElementRefs.current.clear();
      
      screenVideoElementRefs.current.forEach((video, id) => {
        if (video) {
          video.srcObject = null;
        }
      });
      screenVideoElementRefs.current.clear();
      
      streamAssignments.current.clear();
      screenStreamAssignments.current.clear();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <motion.div
      className="video-conference-mobile"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
    >
      {/* Mobile Header */}
      <motion.div 
        className="vc-mobile-header"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="vc-mobile-title">
          <Users size={16} />
          <span>{safeParticipants.length + 1}</span>
        </div>
        <div className="vc-mobile-actions">
          {onMinimize && (
            <button onClick={onMinimize} className="vc-mobile-btn">
              <Minimize2 size={16} />
            </button>
          )}
          <button onClick={leaveCall} className="vc-mobile-btn danger">
            <PhoneOff size={16} />
          </button>
        </div>
      </motion.div>

      {/* Mobile Video Area - Full Screen */}
      <div className="vc-mobile-video-area">
        {isScreenSharing ? (
          <div className="vc-mobile-screen-share">
            <video
              ref={(el) => {
                if (el) {
                  screenVideoElementRefs.current.set('mobile-main', el);
                  const currentStream = screenStreamAssignments.current.get('mobile-main');
                  if (currentStream && el.srcObject !== currentStream) {
                    el.srcObject = currentStream;
                  }
                } else {
                  screenVideoElementRefs.current.delete('mobile-main');
                }
              }}
              autoPlay
              playsInline
              muted
              className="vc-mobile-video"
            />
            <div className="vc-mobile-screen-badge">
              <Monitor size={14} />
              <span>Screen Sharing</span>
            </div>
          </div>
        ) : safeParticipants.length > 0 ? (
          <div className="vc-mobile-participant">
            <video
              ref={(el) => {
                if (el) {
                  videoElementRefs.current.set('main-participant', el);
                  const currentStream = streamAssignments.current.get('main-participant');
                  if (currentStream && el.srcObject !== currentStream) {
                    el.srcObject = currentStream;
                  }
                } else {
                  videoElementRefs.current.delete('main-participant');
                }
              }}
              autoPlay
              playsInline
              className="vc-mobile-video"
            />
            <div className="vc-mobile-participant-info">
              <span>{safeParticipants[0]?.username || 'User'}</span>
            </div>
          </div>
        ) : (
          <div className="vc-mobile-local">
            {isCameraOn ? (
              <video
                ref={(el) => {
                  if (el && localStream) el.srcObject = localStream;
                }}
                autoPlay
                playsInline
                muted
                className="vc-mobile-video"
              />
            ) : (
              <div className="vc-mobile-avatar">
                <span>You</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Controls - Fixed Bottom with Safe Area */}
      <div className="vc-mobile-controls">
        <div className="vc-mobile-control-row">
          <RippleButton
            className={`vc-mobile-control-btn ${isMuted ? 'danger' : ''}`}
            onClick={toggleMute}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </RippleButton>
          
          <RippleButton
            className={`vc-mobile-control-btn ${!isCameraOn ? 'danger' : ''}`}
            onClick={toggleCamera}
          >
            {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
          </RippleButton>
          
          <RippleButton
            className={`vc-mobile-control-btn ${isScreenSharing ? 'active' : ''}`}
            onClick={async () => {
              if (isScreenSharing) {
                try {
                  await stopScreenShare();
                } catch (error) {
                  console.error('[VideoConferenceMobile] Error stopping screen share:', error);
                }
              } else {
                try {
                  await startScreenShare(screenQuality);
                } catch (error) {
                  console.error('[VideoConferenceMobile] Error starting screen share:', error);
                }
              }
            }}
          >
            <Monitor size={20} />
          </RippleButton>
          
          <RippleButton
            className={`vc-mobile-control-btn ${showVoiceEffects ? 'active' : ''}`}
            onClick={() => setShowVoiceEffects(!showVoiceEffects)}
          >
            <Sparkles size={20} />
          </RippleButton>
        </div>
      </div>

      {/* Voice Effects Panel - Mobile Optimized */}
      <AnimatePresence>
        {showVoiceEffects && (
          <VoiceEffectsPanel
            isOpen={showVoiceEffects}
            onClose={() => setShowVoiceEffects(false)}
            localStream={localStream}
            onProcessedStream={onProcessedStream}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
