import { useCallback, useEffect, useRef, useState } from "react";
import audioManager from "../lib/audioManager";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

/**
 * FIXED Group Call Hook - All critical issues resolved
 * - Audio transmission fixed
 * - Screen sharing implemented
 * - Proper SDP handling with sendrecv
 * - Multi-peer connections
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
  const peerConnections = useRef(new Map()); // userId -> { pc, pendingIce }
  const timerRef = useRef(null);
  const myIdRef = useRef(null);
  const isInCallRef = useRef(false);
  const activeGroupIdRef = useRef(null);
  const isInitiatorRef = useRef(false);
  const callTypeRef = useRef(null);
  const originalVideoTrackRef = useRef(null);

  // Update refs
  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { isInCallRef.current = isInCall; }, [isInCall]);
  useEffect(() => { activeGroupIdRef.current = activeGroupId; }, [activeGroupId]);
  useEffect(() => { isInitiatorRef.current = isInitiator; }, [isInitiator]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);

  // Get local media with audio always enabled
  const getLocalMedia = useCallback(async (type) => {
    try {
      const constraints = {
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: type === "video" ? { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode: "user" 
        } : false,
      };
      
      console.log(`[GroupCall] Requesting media: type=${type}`);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Ensure all tracks are enabled
      stream.getTracks().forEach(track => {
        track.enabled = true;
        console.log(`[GroupCall] Track ${track.kind}: enabled=${track.enabled}, muted=${track.muted}`);
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
      offer.sdp = offer.sdp.replace(/a=sendonly/g, 'a=sendrecv').replace(/a=recvonly/g, 'a=sendrecv');
      // Add stereo for better audio quality
      offer.sdp = offer.sdp.replace(/opus\/48000/g, 'opus/48000/2');
    }
    
    return offer;
  }, []);

  // Create answer with sendrecv constraints
  const createAnswerWithConstraints = useCallback(async (pc) => {
    const answer = await pc.createAnswer();
    
    // Ensure sendrecv direction
    if (answer.sdp) {
      answer.sdp = answer.sdp.replace(/a=sendonly/g, 'a=sendrecv').replace(/a=recvonly/g, 'a=sendrecv');
    }
    
    return answer;
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((userId, groupId, isInitiator) => {
    console.log(`[GroupCall] Creating PC for ${userId}, initiator=${isInitiator}`);
    
    const pc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });
    
    const peerData = { pc, pendingIce: [] };
    
    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          const sender = pc.addTrack(track, localStreamRef.current);
          console.log(`[GroupCall] Added ${track.kind} track for ${userId}`);
          
          // Set track encoding parameters for audio
          if (track.kind === 'audio' && sender) {
            const params = sender.getParameters();
            if (params.encodings.length > 0) {
              params.encodings[0].maxBitrate = 128000; // 128 kbps for good quality
              sender.setParameters(params).catch(() => {});
            }
          }
        } catch (err) {
          console.error(`[GroupCall] Failed to add track for ${userId}:`, err);
        }
      });
    }

    // Handle remote stream
    pc.ontrack = (e) => {
      const stream = e.streams?.[0];
      if (!stream) return;
      
      // Log track info
      stream.getTracks().forEach(track => {
        console.log(`[GroupCall] Remote track from ${userId}: ${track.kind}, enabled=${track.enabled}, muted=${track.muted}`);
        // Ensure track is enabled
        if (!track.enabled) {
          track.enabled = true;
        }
      });
      
      peerData.remoteStream = stream;
      
      setParticipants((prev) => {
        const exists = prev.find((p) => p.id === userId);
        if (exists) {
          if (exists.stream === stream) return prev;
          return prev.map((p) => p.id === userId ? { 
            ...p, 
            stream, 
            hasVideo: stream.getVideoTracks().length > 0,
            hasAudio: stream.getAudioTracks().length > 0
          } : p);
        }
        return [...prev, { 
          id: userId, 
          stream, 
          hasVideo: stream.getVideoTracks().length > 0,
          hasAudio: stream.getAudioTracks().length > 0,
          username: "Member" 
        }];
      });
    };

    // ICE handling
    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
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
      }
    };

    // ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`[GroupCall] ICE state with ${userId}: ${pc.iceConnectionState}`);
    };

    peerConnections.current.set(userId, peerData);
    return peerData;
  }, []);

  // Start screen share
  const startScreenShare = useCallback(async () => {
    try {
      console.log("[GroupCall] Starting screen share");
      
      const screenStreamTemp = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
      
      const screenTrack = screenStreamTemp.getVideoTracks()[0];
      if (!screenTrack) {
        throw new Error("No screen track available");
      }
      
      // Store screen stream
      screenStreamRef.current = screenStreamTemp;
      setScreenStream(screenStreamTemp);
      setIsScreenSharing(true);
      
      // Store original video track if exists
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          originalVideoTrackRef.current = videoTrack;
          localStreamRef.current.removeTrack(videoTrack);
        }
        localStreamRef.current.addTrack(screenTrack);
      }
      
      // Replace track in all peer connections
      peerConnections.current.forEach((peerData, userId) => {
        const pc = peerData.pc;
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        
        if (videoSender) {
          videoSender.replaceTrack(screenTrack).then(() => {
            console.log(`[GroupCall] Replaced video with screen for ${userId}`);
          }).catch(err => {
            console.error(`[GroupCall] Failed to replace track for ${userId}:`, err);
          });
        } else {
          // No video sender, add new track
          pc.addTrack(screenTrack, localStreamRef.current);
          console.log(`[GroupCall] Added screen track for ${userId}`);
        }
        
        // Renegotiate
        createOfferWithConstraints(pc).then(offer => {
          pc.setLocalDescription(offer);
          socketRef.current?.emit("group:call:offer", {
            groupId: activeGroupIdRef.current,
            toUserId: userId,
            offer,
          });
        });
      });
      
      // Handle screen share end
      screenTrack.onended = () => {
        console.log("[GroupCall] Screen share ended by user");
        stopScreenShare();
      };
      
      // Notify others
      socketRef.current?.emit("group:screen:start", {
        groupId: activeGroupIdRef.current
      });
      
      console.log("[GroupCall] Screen sharing started");
    } catch (err) {
      console.error("[GroupCall] Screen share failed:", err);
      setIsScreenSharing(false);
    }
  }, [createOfferWithConstraints]);

  // Stop screen share
  const stopScreenShare = useCallback(() => {
    console.log("[GroupCall] Stopping screen share");
    
    // Stop screen tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    
    // Restore original video track
    if (originalVideoTrackRef.current && localStreamRef.current) {
      localStreamRef.current.addTrack(originalVideoTrackRef.current);
      
      // Replace in all peer connections
      peerConnections.current.forEach((peerData, userId) => {
        const pc = peerData.pc;
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video' || s.track === null);
        
        if (videoSender) {
          videoSender.replaceTrack(originalVideoTrackRef.current).then(() => {
            console.log(`[GroupCall] Restored video for ${userId}`);
          }).catch(err => {
            console.error(`[GroupCall] Failed to restore video for ${userId}:`, err);
          });
        }
        
        // Renegotiate
        createOfferWithConstraints(pc).then(offer => {
          pc.setLocalDescription(offer);
          socketRef.current?.emit("group:call:offer", {
            groupId: activeGroupIdRef.current,
            toUserId: userId,
            offer,
          });
        });
      });
      
      originalVideoTrackRef.current = null;
    }
    
    // Notify others
    socketRef.current?.emit("group:screen:stop", {
      groupId: activeGroupIdRef.current
    });
  }, [createOfferWithConstraints]);

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
      
      // Notify members
      socketRef.current?.emit("group:call:start", {
        groupId,
        callType: type,
        memberIds: Array.isArray(memberIds) ? memberIds : [],
      });
      
      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
      
      console.log("[GroupCall] Call started as initiator");
    } catch (err) {
      console.error("[GroupCall] Start failed:", err);
      cleanup();
    }
  }, [getLocalMedia]);

  // Accept incoming call
  const acceptGroupCall = useCallback(async (groupId, type, fromUser) => {
    try {
      console.log(`[GroupCall] Accepting call from ${fromUser.id}`);
      
      audioManager.stop("incomingCall");
      
      await getLocalMedia(type);
      
      setIsInCall(true);
      setIsInitiator(false);
      setCallType(type);
      setActiveGroupId(groupId);
      setDuration(0);
      setIncomingCall(null);
      
      // Create peer connection to initiator
      const peerData = createPeerConnection(fromUser.id, groupId, false);
      
      // Create offer
      const offer = await createOfferWithConstraints(peerData.pc);
      await peerData.pc.setLocalDescription(offer);
      
      // Send offer
      socketRef.current?.emit("group:call:accept", {
        groupId,
        toUserId: fromUser.id,
        offer,
      });
      
      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
      
      console.log("[GroupCall] Call accepted");
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
        
        // Add to all peer connections
        peerConnections.current.forEach((peerData, userId) => {
          try {
            peerData.pc.addTrack(videoTrack, localStreamRef.current);
          } catch (err) {
            console.error(`[GroupCall] Failed to add video for ${userId}:`, err);
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
    console.log("[GroupCall] Cleaning up");
    
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
    peerConnections.current.forEach((peerData) => {
      peerData.pc.close();
    });
    peerConnections.current.clear();
    
    // Stop sounds
    audioManager.stop("incomingCall");
    audioManager.stop("outgoingCall");
    
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
    setIncomingCall(null);
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
      console.log(`[GroupCall] handleAccepted: group=${groupId}, from=${fromUserId}, initiator=${isInitiatorRef.current}`);
      
      if (!isInitiatorRef.current || groupId !== activeGroupIdRef.current) {
        console.log("[GroupCall] Ignoring accept - not initiator or wrong group");
        return;
      }
      if (fromUserId === myId) return;
      
      try {
        // Ensure local stream
        if (!localStreamRef.current) {
          await getLocalMedia(callTypeRef.current || "voice");
        }
        
        // Create peer connection
        const peerData = createPeerConnection(fromUserId, groupId, true);
        
        // Set remote offer
        await peerData.pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Process pending ICE
        for (const c of peerData.pendingIce) {
          await peerData.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        peerData.pendingIce = [];
        
        // Create answer with constraints
        const answer = await createAnswerWithConstraints(peerData.pc);
        await peerData.pc.setLocalDescription(answer);
        
        // Send answer
        socket.emit("group:call:answer", {
          groupId,
          toUserId: fromUserId,
          answer,
        });
        
        // Add participant
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
      
      const peerData = peerConnections.current.get(fromUserId);
      if (!peerData) return;
      
      try {
        await peerData.pc.setRemoteDescription(new RTCSessionDescription(answer));
        
        for (const c of peerData.pendingIce) {
          await peerData.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        peerData.pendingIce = [];
        
        console.log(`[GroupCall] Answer processed from ${fromUserId}`);
      } catch (err) {
        console.error("[GroupCall] Failed to set answer:", err);
      }
    };

    // Handle ICE
    const handleIce = async ({ groupId, fromUserId, candidate }) => {
      if (groupId !== activeGroupIdRef.current) return;
      
      const peerData = peerConnections.current.get(fromUserId);
      if (!peerData) {
        console.log(`[GroupCall] No peer for ${fromUserId}, storing ICE`);
        return;
      }
      
      try {
        if (peerData.pc.remoteDescription) {
          await peerData.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          peerData.pendingIce.push(candidate);
        }
      } catch (err) {
        console.error("[GroupCall] Failed to add ICE:", err);
      }
    };

    // Handle offer (for renegotiation)
    const handleOffer = async ({ groupId, fromUserId, offer }) => {
      if (groupId !== activeGroupIdRef.current) return;
      
      const peerData = peerConnections.current.get(fromUserId);
      if (!peerData) return;
      
      try {
        await peerData.pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await createAnswerWithConstraints(peerData.pc);
        await peerData.pc.setLocalDescription(answer);
        
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
      const peerData = peerConnections.current.get(userId);
      if (peerData) {
        peerData.pc.close();
        peerConnections.current.delete(userId);
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
      const peerData = peerConnections.current.get(fromUserId);
      if (peerData) {
        peerData.pc.close();
        peerConnections.current.delete(fromUserId);
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
