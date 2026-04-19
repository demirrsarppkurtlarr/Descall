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
  const peerConnections = useRef(new Map());
  const remoteStreams = useRef(new Map());
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const timerRef = useRef(null);
  const myIdRef = useRef(null);
  const participantsRef = useRef([]);

  // Update ref when participants change
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  // Get local media
  const getLocalMedia = useCallback(async (type) => {
    try {
      const constraints = {
        audio: { echoCancellation: true, noiseSuppression: true },
        video: type === "video" ? { width: 1280, height: 720 } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraOn(type === "video");
      return stream;
    } catch (err) {
      console.error("[GroupCall] Failed to get media:", err);
      throw err;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((userId, isCaller) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate && socket && pc.connectionState !== 'closed') {
        try {
          socket.emit("group:call:ice", {
            groupId: activeGroupId,
            toUserId: userId,
            candidate: e.candidate,
          });
        } catch (err) {
          console.error("[GroupCall] Failed to emit ICE candidate:", err);
        }
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams?.[0];
      if (!stream) {
        console.warn("[GroupCall] No stream in track event");
        return;
      }
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
          },
        ];
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        setParticipants((prev) => prev.filter((p) => p.id !== userId));
        remoteStreams.current.delete(userId);
        peerConnections.current.delete(userId);
      }
    };

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStreamRef.current);
        } catch (err) {
          console.error("[GroupCall] Failed to add track:", err);
        }
      });
    }

    peerConnections.current.set(userId, pc);
    return pc;
  }, [socket, activeGroupId]);

  // Start group call (as initiator)
  const startGroupCall = useCallback(async (groupId, type, memberIds) => {
    try {
      await getLocalMedia(type);
      
      setIsInCall(true);
      setIsInitiator(true);
      setCallType(type);
      setActiveGroupId(groupId);
      setDuration(0);
      setParticipants([]);
      
      // Notify all members
      socket?.emit("group:call:start", { groupId, callType: type });
      
      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
      
      audioManager.play("callStart");
      
    } catch (err) {
      console.error("[GroupCall] Start failed:", err);
      cleanup();
    }
  }, [getLocalMedia, socket]);

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
      
      // Create peer connection to caller
      const pc = createPeerConnection(fromUser.id, false);
      
      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket?.emit("group:call:accept", {
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
  }, [getLocalMedia, createPeerConnection, socket]);

  // Decline call
  const declineCall = useCallback((groupId, fromUserId) => {
    socket?.emit("group:call:decline", { groupId, toUserId: fromUserId });
    setIncomingCall(null);
    audioManager.stop("incomingCall");
  }, [socket]);

  // Leave call
  const leaveCall = useCallback(() => {
    if (activeGroupId) {
      socket?.emit("group:call:leave", { groupId: activeGroupId });
      if (isInitiator) {
        socket?.emit("group:call:end", { groupId: activeGroupId });
      }
    }
    cleanup();
  }, [activeGroupId, isInitiator, socket]);

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
    if (isCameraOn) {
      // Turn off
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStreamRef.current.removeTrack(videoTrack);
      }
      setIsCameraOn(false);
    } else {
      // Turn on
      try {
        // Stop previous video track if exists
        const prevVideoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (prevVideoTrack) {
          prevVideoTrack.stop();
          localStreamRef.current.removeTrack(prevVideoTrack);
        }

        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = newStream.getVideoTracks()[0];
        
        // Add to local stream
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
        } else {
          localStreamRef.current = new MediaStream([videoTrack]);
        }
        
        // Replace in all peer connections
        peerConnections.current.forEach((pc) => {
          if (pc.connectionState === 'closed') return;
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, localStreamRef.current);
          }
        });
        
        setLocalStream(localStreamRef.current);
        setIsCameraOn(true);
      } catch (err) {
        console.error("[GroupCall] Failed to toggle camera:", err);
      }
    }
  }, [isCameraOn]);

  // Start screen share
  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      // Replace video track in all peer connections
      const screenTrack = stream.getVideoTracks()[0];
      peerConnections.current.forEach((pc) => {
        if (pc.connectionState === 'closed') return;
        const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        } else if (localStreamRef.current) {
          pc.addTrack(screenTrack, localStreamRef.current);
        }
      });

      // Handle screen share stop
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("[GroupCall] Screen share failed:", err);
    }
  }, []);

  // Stop screen share
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);

    // Restore camera track if available
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    peerConnections.current.forEach((pc) => {
      if (pc.connectionState === 'closed') return;
      const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (videoSender && videoTrack) {
        videoSender.replaceTrack(videoTrack);
      }
    });
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
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

    audioManager.stop("incomingCall");
  }, []);

  // Refs to avoid stale closures
  const isInCallRef = useRef(false);
  const isInitiatorRef = useRef(false);
  const activeGroupIdRef = useRef(null);
  const callTypeRef = useRef(null);

  // Update refs when state changes
  useEffect(() => { isInCallRef.current = isInCall; }, [isInCall]);
  useEffect(() => { isInitiatorRef.current = isInitiator; }, [isInitiator]);
  useEffect(() => { activeGroupIdRef.current = activeGroupId; }, [activeGroupId]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

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
    const handleAccepted = async ({ groupId, fromUserId, offer }) => {
      if (!isInitiatorRef.current || groupId !== activeGroupIdRef.current) return;

      try {
        const pc = createPeerConnection(fromUserId, true);
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
            return prev.map((p) => p.id === fromUserId ? { ...p, hasVideo } : p);
          }
          return [...prev, { id: fromUserId, hasVideo, hasAudio: true }];
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
      cleanup();
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
  }, [socket, createPeerConnection, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Set my ID from socket
  useEffect(() => {
    if (socket) {
      myIdRef.current = socket.user?.id || socket.id;
    }
  }, [socket]);

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
  };
}
