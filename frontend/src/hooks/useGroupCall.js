import { useCallback, useEffect, useRef, useState } from "react";
import audioManager from "../lib/audioManager";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Grup DM (çok kişili) WebRTC hook
 * - Mesh architecture: Herkes herkese direkt bağlanır
 * - Max 15 kişi
 * - Her kullanıcı için ayrı RTCPeerConnection
 */
export function useGroupCall(socket) {
  const [isInCall, setIsInCall] = useState(false);
  const [callType, setCallType] = useState(null); // voice | video
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [participants, setParticipants] = useState([]); // [{ id, username, avatarUrl, hasVideo, hasAudio, isScreenSharing }]
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [dominantSpeaker, setDominantSpeaker] = useState(null); // Kim konuşuyor
  const [focusedParticipant, setFocusedParticipant] = useState(null); // Büyütülen kişi

  // Mesh connections: Map<userId, RTCPeerConnection>
  const peerConnectionsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map()); // Map<userId, MediaStream>
  const pendingIceRef = useRef(new Map()); // Map<userId, RTCIceCandidate[]>
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Cleanup all connections
  const cleanup = useCallback(() => {
    // Stop local streams
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => {
      pc.close();
    });
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingIceRef.current.clear();

    setIsInCall(false);
    setCallType(null);
    setActiveGroupId(null);
    setParticipants([]);
    setLocalStream(null);
    setScreenStream(null);
    setIsMuted(false);
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setDominantSpeaker(null);
    setFocusedParticipant(null);

    audioManager.stop("incomingCall");
    audioManager.stop("outgoingCall");
  }, []);

  // Create peer connection for specific user
  const createPeerConnection = useCallback((userId, isInitiator) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Add screen share track if active
    if (screenStreamRef.current) {
      screenStreamRef.current.getVideoTracks().forEach(track => {
        pc.addTrack(track, screenStreamRef.current);
      });
    }

    // Handle remote stream
    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      const track = e.track;
      
      console.log(`[GroupCall] ontrack from ${userId}:`, track?.kind, "muted:", track?.muted);

      // Store/update remote stream
      remoteStreamsRef.current.set(userId, remoteStream);

      // Update participant info
      setParticipants(prev => {
        const existing = prev.find(p => p.id === userId);
        if (existing) {
          return prev.map(p => p.id === userId ? {
            ...p,
            hasVideo: remoteStream.getVideoTracks().some(t => t.enabled && !t.muted),
            hasAudio: remoteStream.getAudioTracks().some(t => t.enabled && !t.muted),
          } : p);
        }
        return prev;
      });

      // Handle unmute for muted tracks
      if (track?.muted) {
        track.onunmute = () => {
          console.log(`[GroupCall] Track unmuted from ${userId}:`, track.kind);
          setParticipants(prev => prev.map(p => 
            p.id === userId ? { 
              ...p, 
              hasVideo: track.kind === "video" ? true : p.hasVideo,
              hasAudio: track.kind === "audio" ? true : p.hasAudio,
            } : p
          ));
        };
      }
    };

    // ICE candidate
    pc.onicecandidate = (e) => {
      if (e.candidate && socket?.connected) {
        socket.emit("group:call:ice", {
          groupId: activeGroupId,
          toUserId: userId,
          candidate: e.candidate,
        });
      }
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      console.log(`[GroupCall] Connection state with ${userId}:`, pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        // Remove participant
        setParticipants(prev => prev.filter(p => p.id !== userId));
        remoteStreamsRef.current.delete(userId);
        peerConnectionsRef.current.delete(userId);
      }
    };

    // Renegotiation
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socket?.connected) {
          socket.emit("group:call:offer", {
            groupId: activeGroupId,
            toUserId: userId,
            offer: pc.localDescription,
            callType: isScreenSharing ? "screen" : callType,
          });
        }
      } catch (err) {
        console.error(`[GroupCall] Negotiation failed with ${userId}:`, err);
      }
    };

    peerConnectionsRef.current.set(userId, pc);
    return pc;
  }, [socket, activeGroupId, callType, isScreenSharing]);

  // Start group call
  const startGroupCall = useCallback(async (groupId, type, members) => {
    if (!socket || !groupId) return;

    try {
      // Get local media
      const constraints = type === "video"
        ? { audio: true, video: { width: 1280, height: 720 } }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsCameraOn(type === "video");

      // Initialize participants list
      const initialParticipants = members
        .filter(m => m.id !== socket.user?.id)
        .map(m => ({
          id: m.id,
          username: m.username,
          avatarUrl: m.avatar_url,
          hasVideo: false,
          hasAudio: false,
          isScreenSharing: false,
        }));
      setParticipants(initialParticipants);

      setActiveGroupId(groupId);
      setCallType(type);
      setIsInCall(true);

      // Notify others
      socket.emit("group:call:start", { groupId, callType: type });

      // Join group room
      socket.emit("group:join", groupId);

      audioManager.play("outgoingCall", { loop: true });

    } catch (err) {
      console.error("[GroupCall] Start error:", err);
      cleanup();
    }
  }, [socket, cleanup]);

  // Accept incoming group call
  const acceptGroupCall = useCallback(async (groupId, type, fromUser) => {
    if (!socket) return;

    try {
      const constraints = type === "video"
        ? { audio: true, video: { width: 1280, height: 720 } }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsCameraOn(type === "video");

      setActiveGroupId(groupId);
      setCallType(type);
      setIsInCall(true);

      socket.emit("group:call:accept", { groupId, toUserId: fromUser.id });
      socket.emit("group:join", groupId);

      audioManager.stop("incomingCall");

    } catch (err) {
      console.error("[GroupCall] Accept error:", err);
      cleanup();
    }
  }, [socket, cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  }, []);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      // Stop camera
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStreamRef.current.removeTrack(videoTrack);
        
        // Remove from all peer connections
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) pc.removeTrack(sender);
        });
      }
      setIsCameraOn(false);
    } else {
      // Start camera
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(videoTrack);

        // Add to all peer connections
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, localStreamRef.current);
          }
        });

        setIsCameraOn(true);
      } catch (err) {
        console.error("[GroupCall] Camera error:", err);
      }
    }
  }, [isCameraOn]);

  // Start screen share
  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always", width: 1920, height: 1080 },
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      screenStreamRef.current = screenStream;
      setScreenStream(screenStream);

      // Add screen track to all peer connections
      peerConnectionsRef.current.forEach((pc) => {
        pc.addTrack(screenTrack, screenStream);
      });

      screenTrack.onended = () => {
        stopScreenShare();
      };

      setIsScreenSharing(true);

      if (socket?.connected) {
        socket.emit("group:screen:start", { groupId: activeGroupId });
      }

    } catch (err) {
      console.error("[GroupCall] Screen share error:", err);
    }
  }, [socket, activeGroupId]);

  // Stop screen share
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      
      // Remove from all peer connections
      screenStreamRef.current.getTracks().forEach(track => {
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find(s => s.track === track);
          if (sender) pc.removeTrack(sender);
        });
      });
      
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);

    if (socket?.connected) {
      socket.emit("group:screen:stop", { groupId: activeGroupId });
    }
  }, [socket, activeGroupId]);

  // Leave call
  const leaveCall = useCallback(() => {
    if (socket?.connected && activeGroupId) {
      socket.emit("group:call:leave", { groupId: activeGroupId });
    }
    cleanup();
  }, [socket, activeGroupId, cleanup]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Incoming call
    const onIncomingCall = ({ groupId, fromUser, callType: type }) => {
      if (isInCall) {
        // Already in call, auto-decline or handle merge
        return;
      }
      audioManager.play("incomingCall", { loop: true });
      // Show incoming call UI with fromUser info
    };

    // Someone accepted our call
    const onCallAccepted = ({ groupId, fromUserId }) => {
      audioManager.stop("outgoingCall");
      // Create peer connection to this user
      createPeerConnection(fromUserId, true);
    };

    // Someone declined
    const onCallDeclined = ({ groupId, fromUserId }) => {
      // Remove from participants
      setParticipants(prev => prev.filter(p => p.id !== fromUserId));
    };

    // WebRTC offer
    const onOffer = async ({ groupId, fromUser, offer, callType: type }) => {
      const pc = createPeerConnection(fromUser.id, false);
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socket.emit("group:call:answer", {
          groupId,
          toUserId: fromUser.id,
          answer: pc.localDescription,
        });
      } catch (err) {
        console.error("[GroupCall] Offer handling failed:", err);
      }
    };

    // WebRTC answer
    const onAnswer = async ({ groupId, fromUserId, answer }) => {
      const pc = peerConnectionsRef.current.get(fromUserId);
      if (!pc) return;
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error("[GroupCall] Answer handling failed:", err);
      }
    };

    // ICE candidate
    const onIce = async ({ groupId, fromUserId, candidate }) => {
      const pc = peerConnectionsRef.current.get(fromUserId);
      if (!pc) {
        // Store for later
        if (!pendingIceRef.current.has(fromUserId)) {
          pendingIceRef.current.set(fromUserId, []);
        }
        pendingIceRef.current.get(fromUserId).push(candidate);
        return;
      }
      
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("[GroupCall] ICE error:", err);
      }
    };

    // Someone left
    const onLeft = ({ groupId, userId }) => {
      const pc = peerConnectionsRef.current.get(userId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(userId);
      }
      remoteStreamsRef.current.delete(userId);
      setParticipants(prev => prev.filter(p => p.id !== userId));
    };

    // Screen share started
    const onScreenStarted = ({ groupId, fromUserId }) => {
      setParticipants(prev => prev.map(p => 
        p.id === fromUserId ? { ...p, isScreenSharing: true } : p
      ));
      // Auto-focus on screen share
      setFocusedParticipant(fromUserId);
    };

    // Screen share stopped
    const onScreenStopped = ({ groupId, fromUserId }) => {
      setParticipants(prev => prev.map(p => 
        p.id === fromUserId ? { ...p, isScreenSharing: false } : p
      ));
      if (focusedParticipant === fromUserId) {
        setFocusedParticipant(null);
      }
    };

    socket.on("group:call:incoming", onIncomingCall);
    socket.on("group:call:accepted", onCallAccepted);
    socket.on("group:call:declined", onCallDeclined);
    socket.on("group:call:offer", onOffer);
    socket.on("group:call:answer", onAnswer);
    socket.on("group:call:ice", onIce);
    socket.on("group:call:left", onLeft);
    socket.on("group:screen:started", onScreenStarted);
    socket.on("group:screen:stopped", onScreenStopped);

    return () => {
      socket.off("group:call:incoming", onIncomingCall);
      socket.off("group:call:accepted", onCallAccepted);
      socket.off("group:call:declined", onCallDeclined);
      socket.off("group:call:offer", onOffer);
      socket.off("group:call:answer", onAnswer);
      socket.off("group:call:ice", onIce);
      socket.off("group:call:left", onLeft);
      socket.off("group:screen:started", onScreenStarted);
      socket.off("group:screen:stopped", onScreenStopped);
    };
  }, [socket, isInCall, createPeerConnection, focusedParticipant]);

  return {
    // State
    isInCall,
    callType,
    activeGroupId,
    participants,
    localStream,
    screenStream,
    isMuted,
    isCameraOn,
    isScreenSharing,
    dominantSpeaker,
    focusedParticipant,
    remoteStreams: remoteStreamsRef,
    
    // Actions
    startGroupCall,
    acceptGroupCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    setFocusedParticipant,
    cleanup,
  };
}
