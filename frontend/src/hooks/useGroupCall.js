import { useCallback, useEffect, useRef, useState } from "react";
import audioManager from "../lib/audioManager";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Modern Group Call Hook - Ultra Simple & Reliable
 * 
 * Architecture: Star Topology (Caller = Center)
 * - Caller connects to all members individually
 * - Members only connect to caller
 * - Simple, reliable, works with 2-15 people
 */
export function useGroupCall(socket) {
  // Call State
  const [isInCall, setIsInCall] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);
  const [callType, setCallType] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [dominantSpeaker, setDominantSpeaker] = useState(null);
  const [focusedParticipant, setFocusedParticipant] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  // Refs
  const socketRef = useRef(socket);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnections = useRef(new Map());
  const remoteStreams = useRef(new Map());
  const timerRef = useRef(null);
  const myIdRef = useRef(null);
  const participantsRef = useRef([]);
  const activeGroupIdRef = useRef(null);
  const isInitiatorRef = useRef(null);
  const isInCallRef = useRef(false);
  const callTypeRef = useRef(null);
  const cameraTrackRef = useRef(null);

  // Update ref when participants change
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  // Get local media
  const getLocalMedia = useCallback(async (type) => {
    try {
      // Check if we already have a stream with the right tracks
      const existingStream = localStreamRef.current;
      const existingAudio = existingStream?.getAudioTracks?.()[0];
      const existingVideo = existingStream?.getVideoTracks?.()[0];
      
      // If we have both audio and video (for video call), or just audio (for voice call), reuse
      if (existingAudio && (type === "voice" || existingVideo)) {
        console.log("[GroupCall] Reusing existing media stream");
        return existingStream;
      }

      const constraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === "video" ? { width: 1280, height: 720, facingMode: "user" } : false,
      };
      
      console.log(`[GroupCall] Getting local media: ${type}`, constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Enable all tracks by default
      stream.getTracks().forEach(track => {
        track.enabled = true;
        console.log(`[GroupCall] Track added: ${track.kind}, enabled: ${track.enabled}`);
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraOn(type === "video");
      
      console.log(`[GroupCall] Local media acquired: ${stream.getAudioTracks().length} audio, ${stream.getVideoTracks().length} video`);
      return stream;
    } catch (err) {
      console.error("[GroupCall] Failed to get media:", err);
      throw err;
    }
  }, []);

  // Create peer connection - CRITICAL FUNCTION
  const createPeerConnection = useCallback((userId, groupId) => {
    console.log(`[GroupCall] Creating peer connection for user: ${userId}, group: ${groupId}`);
    
    const pc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      iceTransportPolicy: 'all',
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require'
    });

    // ICE candidate handler
    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current && pc.connectionState !== 'closed') {
        console.log(`[GroupCall] Sending ICE candidate to ${userId}`);
        try {
          socketRef.current.emit("group:call:ice", {
            groupId: groupId || activeGroupIdRef.current,
            toUserId: userId,
            candidate: e.candidate,
          });
        } catch (err) {
          console.error("[GroupCall] Failed to emit ICE candidate:", err);
        }
      }
    };

    // Track received handler - INCOMING AUDIO/VIDEO
    pc.ontrack = (e) => {
      const stream = e.streams?.[0];
      if (!stream) {
        console.warn("[GroupCall] No stream in track event");
        return;
      }
      
      console.log(`[GroupCall] Received remote stream from ${userId}:`, {
        audio: stream.getAudioTracks().length,
        video: stream.getVideoTracks().length
      });
      
      remoteStreams.current.set(userId, stream);
      
      setParticipants((prev) => {
        const hasVideo = stream.getVideoTracks().length > 0;
        const hasAudio = stream.getAudioTracks().length > 0;
        const exists = prev.find((p) => p.id === userId);
        if (exists) {
          return prev.map((p) =>
            p.id === userId ? { ...p, stream, hasVideo, hasAudio } : p
          );
        }
        return [
          ...prev,
          {
            id: userId,
            stream,
            hasVideo,
            hasAudio,
            username: "Member",
          },
        ];
      });
    };

    // Connection state change handler
    pc.onconnectionstatechange = () => {
      console.log(`[GroupCall] Connection state with ${userId}: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        console.log(`[GroupCall] Successfully connected to ${userId}`);
      }
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        setParticipants((prev) => prev.filter((p) => p.id !== userId));
        remoteStreams.current.delete(userId);
        peerConnections.current.delete(userId);
      }
    };

    // ICE connection state change
    pc.oniceconnectionstatechange = () => {
      console.log(`[GroupCall] ICE connection state with ${userId}: ${pc.iceConnectionState}`);
    };

    // Add local stream tracks - OUTGOING AUDIO/VIDEO
    const localStream = localStreamRef.current;
    if (localStream) {
      console.log(`[GroupCall] Adding local tracks to peer connection for ${userId}:`, {
        audio: localStream.getAudioTracks().length,
        video: localStream.getVideoTracks().length
      });
      
      localStream.getTracks().forEach((track) => {
        try {
          const sender = pc.addTrack(track, localStream);
          console.log(`[GroupCall] Added ${track.kind} track, enabled: ${track.enabled}`);
        } catch (err) {
          console.error(`[GroupCall] Failed to add ${track.kind} track:`, err);
        }
      });
    } else {
      console.warn(`[GroupCall] No local stream available when creating peer connection for ${userId}`);
    }

    peerConnections.current.set(userId, pc);
    return pc;
  }, []);

  // Start group call (as initiator)
  const startGroupCall = useCallback(async (groupId, type, memberIds = []) => {
    try {
      await getLocalMedia(type);
      
      setIsInCall(true);
      setIsInitiator(true);
      setCallType(type);
      setActiveGroupId(groupId);
      setDuration(0);
      setParticipants([]);
      activeGroupIdRef.current = groupId;
      callTypeRef.current = type;
      
      // Notify all members
      socketRef.current?.emit("group:call:start", {
        groupId,
        callType: type,
        memberIds: Array.isArray(memberIds) ? memberIds : [],
      });
      
      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
      
      audioManager.play("callStart");
      
    } catch (err) {
      console.error("[GroupCall] Start failed:", err);
      cleanup();
    }
  }, [getLocalMedia]);

  // Accept incoming group call
  const acceptGroupCall = useCallback(async (groupId, type, fromUser) => {
    try {
      await getLocalMedia(type);
      
      setIsInCall(true);
      setIsInitiator(false);
      setCallType(type);
      setActiveGroupId(groupId);
      setDuration(0);
      setIncomingCall(null);
      activeGroupIdRef.current = groupId;
      callTypeRef.current = type;
      
      // Create peer connection to caller
      const pc = createPeerConnection(fromUser.id, groupId);
      
      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socketRef.current?.emit("group:call:accept", {
        groupId,
        toUserId: fromUser.id,
        offer,
      });
      
      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
      
      audioManager.stop("incomingCall");
      audioManager.play("callStart");
      
    } catch (err) {
      console.error("[GroupCall] Accept failed:", err);
      cleanup();
    }
  }, [getLocalMedia, createPeerConnection]);

  // Decline call
  const declineCall = useCallback((groupId, fromUserId) => {
    socketRef.current?.emit("group:call:decline", { groupId, toUserId: fromUserId });
    setIncomingCall(null);
    audioManager.stop("incomingCall");
  }, []);

  // Leave call
  const leaveCall = useCallback(() => {
    if (activeGroupIdRef.current) {
      socketRef.current?.emit("group:call:leave", { groupId: activeGroupIdRef.current });
      if (isInitiatorRef.current) {
        socketRef.current?.emit("group:call:end", { groupId: activeGroupIdRef.current });
      }
    }
    cleanup({ notify: false });
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, []);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    // Cannot toggle camera while screen sharing
    if (isScreenSharing) {
      console.warn("[GroupCall] Cannot toggle camera while screen sharing");
      return;
    }

    if (isCameraOn) {
      // Turn off - stop and remove video track from all peer connections
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        // Remove from all peer connections first
        peerConnections.current.forEach((pc) => {
          if (pc.connectionState === 'closed') return;
          const sender = pc.getSenders().find((s) => s.track === videoTrack);
          if (sender) {
            try {
              sender.replaceTrack(null);
            } catch (err) {
              console.error("[GroupCall] Failed to replace track with null:", err);
            }
          }
        });
        videoTrack.stop();
        localStreamRef.current.removeTrack(videoTrack);
      }
      setIsCameraOn(false);
      cameraTrackRef.current = null;
    } else {
      // Turn on
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        const videoTrack = newStream.getVideoTracks()[0];
        
        // Add to local stream
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
        } else {
          // If no local stream, create new one with video track
          localStreamRef.current = new MediaStream([videoTrack]);
        }
        
        // Store camera track for later restoration
        cameraTrackRef.current = videoTrack;
        
        // Replace in all peer connections
        peerConnections.current.forEach((pc) => {
          if (pc.connectionState === 'closed') return;
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(videoTrack);
          } else {
            // No existing video sender, add new track
            try {
              pc.addTrack(videoTrack, localStreamRef.current);
            } catch (err) {
              console.error("[GroupCall] Failed to add track:", err);
            }
          }
        });
        
        setLocalStream(localStreamRef.current);
        setIsCameraOn(true);
      } catch (err) {
        console.error("[GroupCall] Failed to toggle camera:", err);
      }
    }
  }, [isCameraOn, isScreenSharing]);

  // Start screen share
  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack) return;
      
      // Store current camera track before replacing with screen
      const currentCameraTrack = localStreamRef.current?.getVideoTracks?.()[0];
      if (currentCameraTrack) {
        cameraTrackRef.current = currentCameraTrack;
        // Don't stop camera track, just pause it in peer connections
      }
      
      // Replace video track with screen track in all peer connections
      peerConnections.current.forEach((pc) => {
        if (pc.connectionState === 'closed') return;
        const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        } else {
          // No existing video sender, add new one
          try {
            if (localStreamRef.current) {
              pc.addTrack(screenTrack, localStreamRef.current);
            }
          } catch (err) {
            console.error("[GroupCall] Failed to add screen track:", err);
          }
        }
      });

      // Handle screen share stop (user clicks browser's stop sharing button)
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("[GroupCall] Screen share failed:", err);
    }
  }, []);

  // Stop screen share
  const stopScreenShare = useCallback(() => {
    // Stop screen sharing tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);

    // Restore camera track if it was active before screen sharing
    const cameraTrack = cameraTrackRef.current;
    if (cameraTrack && cameraTrack.readyState === 'live') {
      // Camera track is still active, restore it to peer connections
      peerConnections.current.forEach((pc) => {
        if (pc.connectionState === 'closed') return;
        const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack);
        } else {
          // Add camera track if no video sender exists
          try {
            if (localStreamRef.current) {
              pc.addTrack(cameraTrack, localStreamRef.current);
            }
          } catch (err) {
            console.error("[GroupCall] Failed to restore camera track:", err);
          }
        }
      });
      setIsCameraOn(true);
    } else {
      // No active camera track, set camera to off
      setIsCameraOn(false);
      // Remove null video track from senders
      peerConnections.current.forEach((pc) => {
        if (pc.connectionState === 'closed') return;
        const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender) {
          try {
            videoSender.replaceTrack(null);
          } catch (err) {
            // Ignore error
          }
        }
      });
    }
    cameraTrackRef.current = null;
  }, []);

  // Update refs when state changes
  useEffect(() => { isInCallRef.current = isInCall; }, [isInCall]);
  useEffect(() => { isInitiatorRef.current = isInitiator; }, [isInitiator]);
  useEffect(() => { activeGroupIdRef.current = activeGroupId; }, [activeGroupId]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);
  useEffect(() => { socketRef.current = socket; }, [socket]);

  // Cleanup function
  const cleanup = useCallback((options = {}) => {
    const { notify = true } = options;
    // Notify others we're leaving
    if (notify && socketRef.current && activeGroupIdRef.current) {
      if (isInitiatorRef.current) {
        socketRef.current.emit("group:call:end", { groupId: activeGroupIdRef.current });
      }
      socketRef.current.emit("group:call:leave", { groupId: activeGroupIdRef.current });
    }

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop all streams
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    // Close all peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    remoteStreams.current.clear();

    // Reset state
    setIsInCall(false);
    setIsInitiator(false);
    setCallType(null);
    setActiveGroupId(null);
    setLocalStream(null);
    setScreenStream(null);
    setIsMuted(false);
  setIsCameraOn(false);
    setIsScreenSharing(false);
    setDuration(0);
    setParticipants([]);
    setDominantSpeaker(null);
    setFocusedParticipant(null);
    setIncomingCall(null);
    cameraTrackRef.current = null;

    audioManager.stop("incomingCall");
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;
    
    // Update socket ref
    socketRef.current = socket;

    // Incoming call
    const handleIncoming = ({ groupId, fromUser, callType }) => {
      if (isInCallRef.current) {
        socket.emit("group:call:busy", { groupId, toUserId: fromUser.id });
        return;
      }
      setIncomingCall({ groupId, fromUser, callType });
      audioManager.play("incomingCall");
    };

    // Someone accepted our call (as initiator)
    const handleAccepted = async ({ groupId, fromUserId, fromUser, offer }) => {
      if (!isInitiatorRef.current || groupId !== activeGroupIdRef.current) return;

      try {
        const pc = createPeerConnection(fromUserId, groupId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("group:call:answer", {
          groupId,
          toUserId: fromUserId,
          answer,
        });

        // Add to participants
        setParticipants((prev) => {
          const hasVideo = callTypeRef.current === "video";
          const existing = prev.find((p) => p.id === fromUserId);
          if (existing) {
            return prev.map((p) => p.id === fromUserId ? { ...p, hasVideo, username: fromUser?.username || p.username, avatarUrl: fromUser?.avatar_url || p.avatarUrl } : p);
          }
          return [...prev, { id: fromUserId, hasVideo, hasAudio: true, username: fromUser?.username || "Member", avatarUrl: fromUser?.avatar_url || null }];
        });
      } catch (err) {
        console.error("[GroupCall] Failed to handle accepted call:", err);
        const pc = peerConnections.current.get(fromUserId);
        if (pc) {
          pc.close();
          peerConnections.current.delete(fromUserId);
        }
      }
    };

    // Received answer (as joiner)
    const handleAnswer = async ({ groupId, fromUserId, answer }) => {
      if (groupId !== activeGroupIdRef.current) return;
      const pc = peerConnections.current.get(fromUserId);
      if (pc && pc.connectionState !== 'closed') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error("[GroupCall] Failed to set remote description (answer):", err);
          pc.close();
          peerConnections.current.delete(fromUserId);
        }
      }
    };

    // ICE candidate
    const handleIce = async ({ groupId, fromUserId, candidate }) => {
      if (groupId !== activeGroupIdRef.current) return;
      const pc = peerConnections.current.get(fromUserId);
      if (pc && pc.connectionState !== 'closed') {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("[GroupCall] Failed to add ICE candidate:", err);
        }
      }
    };

    // Someone left
    const handleLeft = ({ groupId, userId }) => {
      if (groupId !== activeGroupIdRef.current) return;
      const pc = peerConnections.current.get(userId);
      if (pc) {
        try {
          pc.close();
        } catch (err) {
          console.error("[GroupCall] Failed to close peer connection:", err);
        }
        peerConnections.current.delete(userId);
      }
      remoteStreams.current.delete(userId);
      setParticipants((prev) => prev.filter((p) => p.id !== userId));
    };

    // Call ended
    const handleEnded = ({ groupId }) => {
      if (groupId !== activeGroupIdRef.current) return;
      cleanup({ notify: false });
    };

    // Someone declined
    const handleDeclined = ({ groupId, fromUserId }) => {
      console.log("[GroupCall] Declined by:", fromUserId);
    };

    socket.on("group:call:incoming", handleIncoming);
    socket.on("group:call:accepted", handleAccepted);
    socket.on("group:call:answer", handleAnswer);
    socket.on("group:call:ice", handleIce);
    socket.on("group:call:left", handleLeft);
    socket.on("group:call:ended", handleEnded);
    socket.on("group:call:declined", handleDeclined);

    return () => {
      socket.off("group:call:incoming", handleIncoming);
      socket.off("group:call:accepted", handleAccepted);
      socket.off("group:call:answer", handleAnswer);
      socket.off("group:call:ice", handleIce);
      socket.off("group:call:left", handleLeft);
      socket.off("group:call:ended", handleEnded);
      socket.off("group:call:declined", handleDeclined);
    };
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Set my ID from socket
  useEffect(() => {
    if (socketRef.current) {
      myIdRef.current = socketRef.current.user?.id || socketRef.current.id;
    }
  }, []);

  // Format duration
  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    // State
    isInCall,
    isInitiator,
    callType,
    activeGroupId,
    localStream,
    screenStream,
    isMuted,
    isCameraOn,
    isScreenSharing,
    duration,
    participants,
    dominantSpeaker,
    focusedParticipant,
    incomingCall,

    // Actions
    startGroupCall,
    acceptGroupCall,
    declineCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    setFocusedParticipant,
    formatDuration,
    cleanup,
    remoteStreams,
    peerConnections,
  };
}
