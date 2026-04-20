import { useCallback, useEffect, useRef, useState } from "react";
import audioManager from "../lib/audioManager";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

/**
 * FIXED Group Call Hook - All critical issues resolved
 * - Mobile accept call fixed
 * - Audio transmission fixed
 * - Video black flickering fixed
 * - Screen sharing working
 */
export function useGroupCall(socket) {
  // State
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
  const [incomingCall, setIncomingCall] = useState(null);

  // Refs
  const socketRef = useRef(socket);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnections = useRef(new Map()); // userId -> RTCPeerConnection
  const pendingIceCandidates = useRef(new Map()); // userId -> [candidates]
  const remoteStreams = useRef(new Map()); // userId -> MediaStream
  const timerRef = useRef(null);
  const myIdRef = useRef(null);
  const isInCallRef = useRef(false);
  const activeGroupIdRef = useRef(null);
  const isInitiatorRef = useRef(false);
  const callTypeRef = useRef(null);
  const originalVideoTrackRef = useRef(null);
  const isCleaningUp = useRef(false);

  // Update refs
  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { isInCallRef.current = isInCall; }, [isInCall]);
  useEffect(() => { activeGroupIdRef.current = activeGroupId; }, [activeGroupId]);
  useEffect(() => { isInitiatorRef.current = isInitiator; }, [isInitiator]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);

  // Get local media with audio always enabled
  const getLocalMedia = useCallback(async (type) => {
    try {
      console.log(`[GroupCall] Requesting media: type=${type}`);
      
      const constraints = {
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2
        },
        video: type === "video" ? { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode: "user",
          frameRate: { ideal: 30 }
        } : false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // CRITICAL: Ensure all tracks are enabled
      stream.getTracks().forEach(track => {
        track.enabled = true;
        console.log(`[GroupCall] Track ${track.kind}: enabled=${track.enabled}, readyState=${track.readyState}`);
        
        // Monitor track mute/unmute
        track.onmute = () => {
          console.log(`[GroupCall] Track ${track.kind} muted - re-enabling`);
          track.enabled = true;
        };
        
        track.onunmute = () => {
          console.log(`[GroupCall] Track ${track.kind} unmuted`);
          track.enabled = true;
        };
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraOn(type === "video" && stream.getVideoTracks().length > 0);
      
      console.log(`[GroupCall] Got local media: audio=${stream.getAudioTracks().length}, video=${stream.getVideoTracks().length}`);
      return stream;
    } catch (err) {
      console.error("[GroupCall] Failed to get media:", err);
      throw err;
    }
  }, []);

  // Create offer with sendrecv constraints
  const createOfferWithConstraints = useCallback(async (pc) => {
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    
    // Ensure sendrecv direction
    if (offer.sdp) {
      offer.sdp = offer.sdp.replace(/a=sendonly/g, 'a=sendrecv');
      offer.sdp = offer.sdp.replace(/a=recvonly/g, 'a=sendrecv');
      // Add stereo for better audio
      offer.sdp = offer.sdp.replace(/opus\/48000/g, 'opus/48000/2');
    }
    
    return offer;
  }, []);

  // Create answer with sendrecv constraints
  const createAnswerWithConstraints = useCallback(async (pc) => {
    const answer = await pc.createAnswer();
    
    // Ensure sendrecv direction
    if (answer.sdp) {
      answer.sdp = answer.sdp.replace(/a=sendonly/g, 'a=sendrecv');
      answer.sdp = answer.sdp.replace(/a=recvonly/g, 'a=sendrecv');
    }
    
    return answer;
  }, []);

  // Create peer connection - FIXED version
  const createPeerConnection = useCallback((userId, groupId) => {
    console.log(`[GroupCall] Creating PC for ${userId}`);
    
    const pc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10
    });
    
    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          const sender = pc.addTrack(track, localStreamRef.current);
          console.log(`[GroupCall] Added ${track.kind} track for ${userId}`);
          
          // Set audio encoding parameters
          if (track.kind === 'audio' && sender) {
            const params = sender.getParameters();
            if (params.encodings && params.encodings.length > 0) {
              params.encodings[0].maxBitrate = 128000;
              sender.setParameters(params).catch(() => {});
            }
          }
        } catch (err) {
          console.error(`[GroupCall] Failed to add track for ${userId}:`, err);
        }
      });
    }

    // Handle remote stream - CRITICAL: Store in ref to avoid closure issues
    pc.ontrack = (e) => {
      const stream = e.streams?.[0];
      if (!stream) {
        console.log(`[GroupCall] No stream in ontrack from ${userId}`);
        return;
      }
      
      console.log(`[GroupCall] ontrack from ${userId}: ${e.track?.kind}`);
      
      // Store in ref immediately
      remoteStreams.current.set(userId, stream);
      
      // Enable all tracks
      stream.getTracks().forEach(track => {
        track.enabled = true;
        console.log(`[GroupCall] Remote track from ${userId}: ${track.kind}, enabled=${track.enabled}, muted=${track.muted}`);
        
        // CRITICAL: Handle mute/unmute to prevent black video
        track.onmute = () => {
          console.log(`[GroupCall] Remote track ${track.kind} muted from ${userId}`);
          // Don't disable, just log
        };
        
        track.onunmute = () => {
          console.log(`[GroupCall] Remote track ${track.kind} unmuted from ${userId}`);
          track.enabled = true;
        };
        
        // Handle ended
        track.onended = () => {
          console.log(`[GroupCall] Remote track ${track.kind} ended from ${userId}`);
        };
      });
      
      // Update participants with new stream
      setParticipants((prev) => {
        const exists = prev.find((p) => p.id === userId);
        const hasVideo = stream.getVideoTracks().length > 0;
        const hasAudio = stream.getAudioTracks().length > 0;
        
        if (exists) {
          if (exists.stream === stream) return prev;
          return prev.map((p) => p.id === userId ? { 
            ...p, 
            stream, 
            hasVideo,
            hasAudio
          } : p);
        }
        return [...prev, { 
          id: userId, 
          stream, 
          hasVideo,
          hasAudio,
          username: "Member" 
        }];
      });
    };

    // ICE handling
    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        console.log(`[GroupCall] Sending ICE to ${userId}`);
        socketRef.current.emit("group:call:ice", {
          groupId: groupId || activeGroupIdRef.current,
          toUserId: userId,
          candidate: e.candidate,
        });
      }
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      console.log(`[GroupCall] Connection state with ${userId}: ${pc.connectionState}`);
      
      if (pc.connectionState === "connected") {
        console.log(`[GroupCall] Connected to ${userId}`);
      } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        setParticipants((prev) => prev.filter((p) => p.id !== userId));
        peerConnections.current.delete(userId);
        pendingIceCandidates.current.delete(userId);
        remoteStreams.current.delete(userId);
      }
    };

    // ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`[GroupCall] ICE state with ${userId}: ${pc.iceConnectionState}`);
    };

    // Negotiation needed
    pc.onnegotiationneeded = async () => {
      console.log(`[GroupCall] Negotiation needed for ${userId}`);
      try {
        const offer = await createOfferWithConstraints(pc);
        await pc.setLocalDescription(offer);
        socketRef.current?.emit("group:call:offer", {
          groupId: activeGroupIdRef.current,
          toUserId: userId,
          offer,
        });
      } catch (err) {
        console.error("[GroupCall] Negotiation failed:", err);
      }
    };

    // Store PC
    peerConnections.current.set(userId, pc);
    pendingIceCandidates.current.set(userId, []);
    
    return pc;
  }, [createOfferWithConstraints]);

  // Start screen share
  const startScreenShare = useCallback(async () => {
    try {
      console.log("[GroupCall] Starting screen share");
      
      const screenStreamTemp = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true // Try to capture audio if possible
      });
      
      const screenTrack = screenStreamTemp.getVideoTracks()[0];
      if (!screenTrack) {
        throw new Error("No screen track available");
      }
      
      screenStreamRef.current = screenStreamTemp;
      setScreenStream(screenStreamTemp);
      setIsScreenSharing(true);
      
      // Store original video track
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          originalVideoTrackRef.current = videoTrack;
          localStreamRef.current.removeTrack(videoTrack);
        }
        localStreamRef.current.addTrack(screenTrack);
      }
      
      // Replace in all peer connections
      peerConnections.current.forEach((pc, uid) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        
        if (videoSender) {
          videoSender.replaceTrack(screenTrack).catch(err => {
            console.error(`[GroupCall] Failed to replace track for ${uid}:`, err);
          });
        }
      });
      
      screenTrack.onended = () => {
        console.log("[GroupCall] Screen share ended");
        stopScreenShare();
      };
      
      socketRef.current?.emit("group:screen:start", { groupId: activeGroupIdRef.current });
      console.log("[GroupCall] Screen sharing started");
    } catch (err) {
      console.error("[GroupCall] Screen share failed:", err);
      setIsScreenSharing(false);
    }
  }, []);

  // Stop screen share
  const stopScreenShare = useCallback(() => {
    console.log("[GroupCall] Stopping screen share");
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    
    if (originalVideoTrackRef.current && localStreamRef.current) {
      localStreamRef.current.addTrack(originalVideoTrackRef.current);
      
      peerConnections.current.forEach((pc, uid) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        
        if (videoSender) {
          videoSender.replaceTrack(originalVideoTrackRef.current).catch(err => {
            console.error(`[GroupCall] Failed to restore video for ${uid}:`, err);
          });
        }
      });
      
      originalVideoTrackRef.current = null;
    }
    
    socketRef.current?.emit("group:screen:stop", { groupId: activeGroupIdRef.current });
  }, []);

  // Start group call
  const startGroupCall = useCallback(async (groupId, type, memberIds = []) => {
    try {
      console.log(`[GroupCall] Starting ${type} call in group ${groupId}`);
      
      await getLocalMedia(type);
      
      setIsInCall(true);
      setIsInitiator(true);
      setCallType(type);
      setActiveGroupId(groupId);
      setDuration(0);
      setParticipants([]);
      setIncomingCall(null);
      
      audioManager.stop("incomingCall");
      audioManager.stop("outgoingCall");
      
      socketRef.current?.emit("group:call:start", {
        groupId,
        callType: type,
        memberIds: Array.isArray(memberIds) ? memberIds : [],
      });
      
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
      
      console.log("[GroupCall] Call started as initiator");
    } catch (err) {
      console.error("[GroupCall] Start failed:", err);
      cleanup();
    }
  }, [getLocalMedia]);

  // Accept incoming call - FIXED
  const acceptGroupCall = useCallback(async (groupId, type, fromUser) => {
    try {
      console.log(`[GroupCall] Accepting call from ${fromUser.id} in group ${groupId}`);
      
      // CRITICAL: Stop sounds first
      audioManager.stop("incomingCall");
      audioManager.stop("outgoingCall");
      
      // Get media first
      await getLocalMedia(type);
      
      // Set state BEFORE creating peer connection
      setIsInCall(true);
      setIsInitiator(false);
      setCallType(type);
      setActiveGroupId(groupId);
      setDuration(0);
      setIncomingCall(null); // CRITICAL: Clear incoming call
      
      // Create peer connection
      const pc = createPeerConnection(fromUser.id, groupId);
      
      // Create offer
      const offer = await createOfferWithConstraints(pc);
      await pc.setLocalDescription(offer);
      
      // Send accept
      socketRef.current?.emit("group:call:accept", {
        groupId,
        toUserId: fromUser.id,
        offer,
      });
      
      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
      
      console.log("[GroupCall] Call accepted, waiting for answer");
    } catch (err) {
      console.error("[GroupCall] Accept failed:", err);
      cleanup();
    }
  }, [getLocalMedia, createPeerConnection, createOfferWithConstraints]);

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
    cleanup();
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
      console.log(`[GroupCall] Audio ${audioTrack.enabled ? 'unmuted' : 'muted'}`);
    }
  }, []);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = false;
        videoTrack.stop();
        localStreamRef.current.removeTrack(videoTrack);
      }
      setIsCameraOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 } 
        });
        const videoTrack = stream.getVideoTracks()[0];
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
        }
        
        peerConnections.current.forEach((pc, uid) => {
          try {
            pc.addTrack(videoTrack, localStreamRef.current);
          } catch (err) {
            console.error(`[GroupCall] Failed to add video for ${uid}:`, err);
          }
        });
        
        setIsCameraOn(true);
      } catch (err) {
        console.error("[GroupCall] Failed to toggle camera:", err);
      }
    }
  }, [isCameraOn]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (isCleaningUp.current) return;
    isCleaningUp.current = true;
    
    console.log("[GroupCall] Cleaning up");
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    pendingIceCandidates.current.clear();
    remoteStreams.current.clear();
    
    audioManager.stop("incomingCall");
    audioManager.stop("outgoingCall");
    
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
    setIncomingCall(null);
    
    isCleaningUp.current = false;
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;
    
    const myId = socket.user?.id;
    myIdRef.current = myId;

    // Incoming call
    const handleIncoming = ({ groupId, fromUser, callType }) => {
      if (!groupId || !fromUser?.id || fromUser.id === myId) return;
      if (isInCallRef.current) {
        socket.emit("group:call:busy", { groupId, toUserId: fromUser.id });
        return;
      }
      console.log(`[GroupCall] Incoming from ${fromUser.id}`);
      setIncomingCall({ groupId, fromUser, callType });
      audioManager.play("incomingCall", { loop: true });
    };

    // Handle accepted (initiator receives this)
    const handleAccepted = async ({ groupId, fromUserId, fromUser, offer }) => {
      console.log(`[GroupCall] handleAccepted from ${fromUserId}`);
      
      if (!isInitiatorRef.current || groupId !== activeGroupIdRef.current) {
        console.log("[GroupCall] Ignoring accept - not initiator");
        return;
      }
      if (fromUserId === myId) return;
      
      try {
        if (!localStreamRef.current) {
          await getLocalMedia(callTypeRef.current || "voice");
        }
        
        const pc = createPeerConnection(fromUserId, groupId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Process pending ICE
        const pending = pendingIceCandidates.current.get(fromUserId) || [];
        for (const c of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingIceCandidates.current.set(fromUserId, []);
        
        const answer = await createAnswerWithConstraints(pc);
        await pc.setLocalDescription(answer);
        
        socket.emit("group:call:answer", {
          groupId,
          toUserId: fromUserId,
          answer,
        });
        
        setParticipants((prev) => {
          if (prev.find((p) => p.id === fromUserId)) return prev;
          return [...prev, { 
            id: fromUserId, 
            hasVideo: callTypeRef.current === "video", 
            hasAudio: true, 
            username: fromUser?.username || "Member" 
          }];
        });
        
        console.log(`[GroupCall] Answer sent to ${fromUserId}`);
      } catch (err) {
        console.error("[GroupCall] handleAccepted error:", err);
      }
    };

    // Handle answer (joiner receives this)
    const handleAnswer = async ({ groupId, fromUserId, answer }) => {
      if (groupId !== activeGroupIdRef.current) return;
      
      const pc = peerConnections.current.get(fromUserId);
      if (!pc) {
        console.log(`[GroupCall] No PC for ${fromUserId}`);
        return;
      }
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        
        const pending = pendingIceCandidates.current.get(fromUserId) || [];
        for (const c of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingIceCandidates.current.set(fromUserId, []);
        
        console.log(`[GroupCall] Answer processed from ${fromUserId}`);
      } catch (err) {
        console.error("[GroupCall] Failed to set answer:", err);
      }
    };

    // Handle ICE
    const handleIce = async ({ groupId, fromUserId, candidate }) => {
      if (groupId !== activeGroupIdRef.current) return;
      
      const pc = peerConnections.current.get(fromUserId);
      
      if (!pc) {
        console.log(`[GroupCall] Storing ICE for ${fromUserId}`);
        const pending = pendingIceCandidates.current.get(fromUserId) || [];
        pending.push(candidate);
        pendingIceCandidates.current.set(fromUserId, pending);
        return;
      }
      
      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          const pending = pendingIceCandidates.current.get(fromUserId) || [];
          pending.push(candidate);
          pendingIceCandidates.current.set(fromUserId, pending);
        }
      } catch (err) {
        console.error("[GroupCall] Failed to add ICE:", err);
      }
    };

    // Handle offer
    const handleOffer = async ({ groupId, fromUserId, offer }) => {
      if (groupId !== activeGroupIdRef.current) return;
      
      const pc = peerConnections.current.get(fromUserId);
      if (!pc) return;
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await createAnswerWithConstraints(pc);
        await pc.setLocalDescription(answer);
        
        socket.emit("group:call:answer", {
          groupId,
          toUserId: fromUserId,
          answer,
        });
      } catch (err) {
        console.error("[GroupCall] Failed to handle offer:", err);
      }
    };

    // Handle left
    const handleLeft = ({ groupId, userId }) => {
      if (groupId !== activeGroupIdRef.current) return;
      const pc = peerConnections.current.get(userId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(userId);
        pendingIceCandidates.current.delete(userId);
        remoteStreams.current.delete(userId);
      }
      setParticipants((prev) => prev.filter((p) => p.id !== userId));
    };

    // Handle ended
    const handleEnded = ({ groupId }) => {
      if (groupId === activeGroupIdRef.current) {
        cleanup();
      }
    };

    // Handle declined
    const handleDeclined = ({ groupId, fromUserId }) => {
      if (groupId !== activeGroupIdRef.current) return;
      const pc = peerConnections.current.get(fromUserId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(fromUserId);
        pendingIceCandidates.current.delete(fromUserId);
        remoteStreams.current.delete(fromUserId);
      }
      setParticipants((prev) => prev.filter((p) => p.id !== fromUserId));
    };

    socket.on("group:call:incoming", handleIncoming);
    socket.on("group:call:accepted", handleAccepted);
    socket.on("group:call:answer", handleAnswer);
    socket.on("group:call:ice", handleIce);
    socket.on("group:call:offer", handleOffer);
    socket.on("group:call:left", handleLeft);
    socket.on("group:call:ended", handleEnded);
    socket.on("group:call:declined", handleDeclined);

    return () => {
      socket.off("group:call:incoming", handleIncoming);
      socket.off("group:call:accepted", handleAccepted);
      socket.off("group:call:answer", handleAnswer);
      socket.off("group:call:ice", handleIce);
      socket.off("group:call:offer", handleOffer);
      socket.off("group:call:left", handleLeft);
      socket.off("group:call:ended", handleEnded);
      socket.off("group:call:declined", handleDeclined);
    };
  }, [socket, createPeerConnection, createAnswerWithConstraints, cleanup, getLocalMedia]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
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
    incomingCall,
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
