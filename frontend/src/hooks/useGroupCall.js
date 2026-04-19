import { useCallback, useEffect, useRef, useState } from "react";
import audioManager from "../lib/audioManager";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Group Call Hook - DM-like simple architecture but for groups
 * 
 * How it works:
 * 1. Caller initiates group call -> emits "group:call:start"
 * 2. Server broadcasts to all group members "group:call:incoming"
 * 3. Each member accepts -> creates peer connection with caller
 * 4. Caller accepts each member -> mesh-like connections but simpler
 * 
 * Each peer connection: Caller <-> Member (star topology from caller)
 */
export function useGroupCall(socket) {
  // Call state
  const [isInCall, setIsInCall] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);
  const [callType, setCallType] = useState(null); // "voice" | "video"
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  
  // Participants management
  const [participants, setParticipants] = useState([]); // [{ id, username, avatarUrl, hasAudio, hasVideo, isScreenSharing }]
  const participantsRef = useRef([]);
  
  // Peer connections: Map<userId, RTCPeerConnection>
  const peerConnectionsRef = useRef(new Map());
  
  // Remote streams: Map<userId, MediaStream>
  const remoteStreamsRef = useRef(new Map());
  
  // Pending ICE candidates
  const pendingIceRef = useRef(new Map()); // Map<userId, RTCIceCandidate[]>
  
  // Refs for cleanup
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenSenderRef = useRef(new Map());
  const timerRef = useRef(null);
  const myIdRef = useRef(null);

  // Update refs when state changes
  useEffect(() => { participantsRef.current = participants; }, [participants]);

  // Get my user ID from socket
  useEffect(() => {
    if (socket?.user?.id) {
      myIdRef.current = socket.user.id;
    }
  }, [socket]);

  // Cleanup everything
  const cleanup = useCallback(() => {
    console.log("[GroupCall] Cleanup called");
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
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
    peerConnectionsRef.current.forEach((pc, userId) => {
      console.log(`[GroupCall] Closing peer connection with ${userId}`);
      pc.close();
    });
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingIceRef.current.clear();
    screenSenderRef.current.clear();
    
    // Reset state
    setIsInCall(false);
    setIsInitiator(false);
    setCallType(null);
    setActiveGroupId(null);
    setLocalStream(null);
    setParticipants([]);
    setIsMuted(false);
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setDuration(0);
    
    // Stop sounds
    audioManager.stop("incomingCall");
    audioManager.stop("outgoingCall");
  }, []);

  // Create peer connection with a specific user
  const createPeerConnection = useCallback((userId, isCaller) => {
    console.log(`[GroupCall] Creating peer connection with ${userId}, isCaller: ${isCaller}`);
    
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }
    
    // Handle remote stream
    pc.ontrack = (event) => {
      console.log(`[GroupCall] Got remote stream from ${userId}`, event.streams);
      const stream = event.streams[0];
      if (stream) {
        remoteStreamsRef.current.set(userId, stream);
        
        // Update participant info
        setParticipants(prev => {
          const exists = prev.find(p => p.id === userId);
          if (!exists) return prev;
          return prev.map(p => 
            p.id === userId 
              ? { ...p, hasAudio: stream.getAudioTracks().length > 0, hasVideo: stream.getVideoTracks().length > 0 }
              : p
          );
        });
      }
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit("group:call:ice", {
          toUserId: userId,
          candidate: event.candidate,
          groupId: activeGroupId,
        });
      }
    };
    
    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log(`[GroupCall] Connection state with ${userId}: ${pc.connectionState}`);
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        // Remove participant if connection fails
        setParticipants(prev => prev.filter(p => p.id !== userId));
        remoteStreamsRef.current.delete(userId);
      }
    };
    
    peerConnectionsRef.current.set(userId, pc);
    return pc;
  }, [socket, activeGroupId]);

  // Start group call (as initiator)
  const startGroupCall = useCallback(async (groupId, type, memberIds = []) => {
    console.log(`[GroupCall] Starting ${type} call in group ${groupId}`, memberIds);
    
    if (!socket) {
      console.error("[GroupCall] No socket available");
      return;
    }
    
    try {
      // Get user media
      const constraints = type === "video" 
        ? { audio: true, video: { width: 1280, height: 720 } }
        : { audio: true, video: false };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsCameraOn(type === "video");
      setIsMuted(false);
      
      // Set state
      setActiveGroupId(groupId);
      setCallType(type);
      setIsInCall(true);
      setIsInitiator(true);
      
      // Join group room
      socket.emit("group:join", groupId);
      
      // Notify server we're starting a call
      socket.emit("group:call:start", { groupId, callType: type });
      
      // Initialize participants (we'll add them as they join)
      setParticipants([]);
      
      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
      
      // Play outgoing sound briefly
      audioManager.play("outgoingCall", { loop: true });
      setTimeout(() => audioManager.stop("outgoingCall"), 2000);
      
    } catch (err) {
      console.error("[GroupCall] Start error:", err);
      cleanup();
    }
  }, [socket, cleanup]);

  // Accept incoming group call
  const acceptGroupCall = useCallback(async (groupId, type, fromUser) => {
    console.log(`[GroupCall] Accepting ${type} call in group ${groupId} from`, fromUser);
    
    if (!socket) return;
    
    try {
      // Get user media
      const constraints = type === "video"
        ? { audio: true, video: { width: 1280, height: 720 } }
        : { audio: true, video: false };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsCameraOn(type === "video");
      setIsMuted(false);
      
      // Set state
      setActiveGroupId(groupId);
      setCallType(type);
      setIsInCall(true);
      setIsInitiator(false);
      
      // Join group room
      socket.emit("group:join", groupId);
      
      // Create peer connection with the initiator
      const pc = createPeerConnection(fromUser.id, false);
      
      // Add initiator as participant
      setParticipants([{
        id: fromUser.id,
        username: fromUser.username,
        avatarUrl: fromUser.avatarUrl,
        hasAudio: true,
        hasVideo: type === "video",
        isScreenSharing: false,
      }]);
      
      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit("group:call:offer", {
        toUserId: fromUser.id,
        offer,
        groupId,
        callType: type,
      });
      
      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
      
      audioManager.stop("incomingCall");
      
    } catch (err) {
      console.error("[GroupCall] Accept error:", err);
      cleanup();
    }
  }, [socket, createPeerConnection, cleanup]);

  // Decline incoming call
  const declineCall = useCallback((groupId, fromUserId) => {
    socket?.emit("group:call:decline", { groupId, toUserId: fromUserId });
    audioManager.stop("incomingCall");
  }, [socket]);

  // Leave call (ends call for everyone if initiator, or just leaves)
  const leaveCall = useCallback(() => {
    if (activeGroupId) {
      // End the call for everyone
      socket?.emit("group:call:end", { groupId: activeGroupId });
    }
    cleanup();
  }, [socket, activeGroupId, cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
      
      // Notify others about mute state change
      socket?.emit("group:call:mute", {
        groupId: activeGroupId,
        isMuted: !audioTrack.enabled,
      });
    }
  }, [socket, activeGroupId]);

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
          if (sender) {
            pc.removeTrack(sender);
          }
        });
      }
      setIsCameraOn(false);
      
      // Notify others
      socket?.emit("group:call:video", {
        groupId: activeGroupId,
        hasVideo: false,
      });
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
        
        // Notify others
        socket?.emit("group:call:video", {
          groupId: activeGroupId,
          hasVideo: true,
        });
      } catch (err) {
        console.error("[GroupCall] Failed to start camera:", err);
      }
    }
  }, [isCameraOn, socket, activeGroupId]);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
      });
      
      screenStreamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      
      // Replace video track in all peer connections
      peerConnectionsRef.current.forEach((pc, userId) => {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) {
          screenSenderRef.current.set(userId, sender.track);
          sender.replaceTrack(videoTrack);
        }
      });
      
      setIsScreenSharing(true);
      
      // Handle screen share end
      videoTrack.onended = () => {
        stopScreenShare();
      };
      
      // Notify others
      socket?.emit("group:screen:started", { groupId: activeGroupId });
      
    } catch (err) {
      console.error("[GroupCall] Screen share error:", err);
    }
  }, [socket, activeGroupId]);

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    
    // Restore camera track if camera is on
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    
    peerConnectionsRef.current.forEach((pc, userId) => {
      const sender = pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) {
        const oldTrack = screenSenderRef.current.get(userId);
        if (oldTrack && videoTrack) {
          sender.replaceTrack(videoTrack);
        } else if (!videoTrack) {
          // No camera, remove video sender
          pc.removeTrack(sender);
        }
      }
    });
    
    screenSenderRef.current.clear();
    setIsScreenSharing(false);
    
    // Notify others
    socket?.emit("group:screen:stopped", { groupId: activeGroupId });
  }, [socket, activeGroupId]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Incoming group call
    const handleIncomingCall = ({ groupId, fromUser, callType }) => {
      console.log("[GroupCall] Incoming call from", fromUser, "in group", groupId);
      
      // Don't show if we're already in a call
      if (isInCall) {
        console.log("[GroupCall] Already in call, declining");
        socket.emit("group:call:busy", { groupId, toUserId: fromUser.id });
        return;
      }
      
      // Show incoming call modal (handled by parent component via state)
      // Parent should listen for this event and show UI
    };

    // Someone accepted our call
    const handleCallAccepted = async ({ fromUserId, groupId, callType }) => {
      console.log("[GroupCall] User accepted:", fromUserId);
      
      if (!isInitiator || !localStreamRef.current) return;
      
      // Add as participant
      setParticipants(prev => {
        if (prev.find(p => p.id === fromUserId)) return prev;
        return [...prev, {
          id: fromUserId,
          username: "User", // Will be updated
          hasAudio: true,
          hasVideo: callType === "video",
          isScreenSharing: false,
        }];
      });
      
      // Create peer connection
      createPeerConnection(fromUserId, true);
    };

    // Got offer (as initiator)
    const handleOffer = async ({ fromUserId, offer, callType }) => {
      console.log("[GroupCall] Got offer from:", fromUserId);
      
      const pc = peerConnectionsRef.current.get(fromUserId);
      if (!pc) {
        console.error("[GroupCall] No peer connection for", fromUserId);
        return;
      }
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socket.emit("group:call:answer", {
          toUserId: fromUserId,
          answer,
          groupId: activeGroupId,
        });
      } catch (err) {
        console.error("[GroupCall] Handle offer error:", err);
      }
    };

    // Got answer (as acceptor)
    const handleAnswer = async ({ fromUserId, answer }) => {
      console.log("[GroupCall] Got answer from:", fromUserId);
      
      const pc = peerConnectionsRef.current.get(fromUserId);
      if (!pc) return;
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Process pending ICE candidates
        const pending = pendingIceRef.current.get(fromUserId) || [];
        for (const candidate of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingIceRef.current.delete(fromUserId);
      } catch (err) {
        console.error("[GroupCall] Handle answer error:", err);
      }
    };

    // Got ICE candidate
    const handleIce = async ({ fromUserId, candidate }) => {
      const pc = peerConnectionsRef.current.get(fromUserId);
      
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("[GroupCall] Add ICE error:", err);
        }
      } else {
        // Queue pending ICE
        if (!pendingIceRef.current.has(fromUserId)) {
          pendingIceRef.current.set(fromUserId, []);
        }
        pendingIceRef.current.get(fromUserId).push(candidate);
      }
    };

    // Someone left the call
    const handleLeft = ({ userId }) => {
      console.log("[GroupCall] User left:", userId);
      
      // Close peer connection
      const pc = peerConnectionsRef.current.get(userId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(userId);
      }
      
      // Remove stream
      remoteStreamsRef.current.delete(userId);
      
      // Remove from participants
      setParticipants(prev => prev.filter(p => p.id !== userId));
    };

    // Handle errors
    const handleError = ({ message }) => {
      console.error("[GroupCall] Error:", message);
      cleanup();
    };

    socket.on("group:call:incoming", handleIncomingCall);
    socket.on("group:call:accepted", handleCallAccepted);
    socket.on("group:call:offer", handleOffer);
    socket.on("group:call:answer", handleAnswer);
    socket.on("group:call:ice", handleIce);
    socket.on("group:call:left", handleLeft);
    socket.on("group:call:error", handleError);

    return () => {
      socket.off("group:call:incoming", handleIncomingCall);
      socket.off("group:call:accepted", handleCallAccepted);
      socket.off("group:call:offer", handleOffer);
      socket.off("group:call:answer", handleAnswer);
      socket.off("group:call:ice", handleIce);
      socket.off("group:call:left", handleLeft);
      socket.off("group:call:error", handleError);
    };
  }, [socket, isInCall, isInitiator, activeGroupId, createPeerConnection, cleanup]);

  return {
    // State
    isInCall,
    isInitiator,
    callType,
    activeGroupId,
    participants,
    localStream,
    remoteStreams: remoteStreamsRef,
    isMuted,
    isCameraOn,
    isScreenSharing,
    duration,
    socket,
    
    // Actions
    startGroupCall,
    acceptGroupCall,
    declineCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    cleanup,
  };
}
