import { useCallback, useEffect, useRef, useState } from "react";
import audioManager from "../lib/audioManager";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Simplified Group Call Hook - Based on working DM call logic
 * Multi-peer WebRTC with Star Topology (Initiator = Center)
 * Each peer connection is managed independently like DM calls
 */
export function useGroupCall(socket) {
  // Call State
  const [isInCall, setIsInCall] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);
  const [callType, setCallType] = useState(null); // "voice" | "video"
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [duration, setDuration] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);

  // Refs
  const socketRef = useRef(socket);
  const localStreamRef = useRef(null);
  const peerConnections = useRef(new Map()); // userId -> { pc, pendingIce, remoteStream }
  const timerRef = useRef(null);
  const myIdRef = useRef(null);
  const isInCallRef = useRef(false);
  const activeGroupIdRef = useRef(null);
  const isInitiatorRef = useRef(false);
  const callTypeRef = useRef(null);

  // Update refs
  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { isInCallRef.current = isInCall; }, [isInCall]);
  useEffect(() => { activeGroupIdRef.current = activeGroupId; }, [activeGroupId]);
  useEffect(() => { isInitiatorRef.current = isInitiator; }, [isInitiator]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);

  // Get user media
  const getLocalMedia = useCallback(async (type) => {
    try {
      const constraints = {
        audio: { echoCancellation: true, noiseSuppression: true },
        video: type === "video" ? { width: 1280, height: 720, facingMode: "user" } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraOn(type === "video");
      console.log(`[GroupCall] Got local media: audio=${stream.getAudioTracks().length}, video=${stream.getVideoTracks().length}`);
      return stream;
    } catch (err) {
      console.error("[GroupCall] Failed to get media:", err);
      throw err;
    }
  }, []);

  // Create peer connection for a specific user
  const createPeerConnection = useCallback((userId, groupId, isInitiator) => {
    console.log(`[GroupCall] Creating peer connection for ${userId}, initiator=${isInitiator}`);
    
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peerData = { pc, pendingIce: [], remoteStream: null };
    
    // Add local tracks with proper enabled state
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          // Ensure track is enabled before adding
          track.enabled = true;
          const sender = pc.addTrack(track, localStreamRef.current);
          console.log(`[GroupCall] Added ${track.kind} track for ${userId}, enabled=${track.enabled}`);
        } catch (err) {
          console.error(`[GroupCall] Failed to add track for ${userId}:`, err);
        }
      });
    }

    // Handle incoming remote stream
    pc.ontrack = (e) => {
      const stream = e.streams?.[0];
      if (!stream) return;
      
      // Ensure all tracks are enabled (prevent black video)
      stream.getTracks().forEach(track => {
        if (!track.enabled) {
          track.enabled = true;
        }
      });
      
      peerData.remoteStream = stream;
      const audioCount = stream.getAudioTracks().length;
      const videoCount = stream.getVideoTracks().length;
      console.log(`[GroupCall] Got remote stream from ${userId}: audio=${audioCount}, video=${videoCount}`);
      
      // Update participants with slight delay to prevent rapid re-renders
      setParticipants((prev) => {
        const exists = prev.find((p) => p.id === userId);
        if (exists) {
          // Only update if stream actually changed
          if (exists.stream === stream) return prev;
          return prev.map((p) => p.id === userId ? { ...p, stream, hasVideo: videoCount > 0, hasAudio: audioCount > 0 } : p);
        }
        return [...prev, { id: userId, stream, hasVideo: videoCount > 0, hasAudio: audioCount > 0, username: "Member" }];
      });
    };

    // ICE candidate
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
        console.log(`[GroupCall] Successfully connected to ${userId}`);
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        setParticipants((prev) => prev.filter((p) => p.id !== userId));
        peerConnections.current.delete(userId);
      }
    };

    peerConnections.current.set(userId, peerData);
    return peerData;
  }, []);

  // Start group call (as initiator)
  const startGroupCall = useCallback(async (groupId, type, memberIds = []) => {
    try {
      console.log(`[GroupCall] Starting ${type} call in group ${groupId} with members:`, memberIds);
      
      await getLocalMedia(type);
      
      setIsInCall(true);
      setIsInitiator(true);
      setCallType(type);
      setActiveGroupId(groupId);
      setDuration(0);
      setParticipants([]);
      setIncomingCall(null);
      
      // Stop any playing sounds
      audioManager.stop("incomingCall");
      audioManager.stop("outgoingCall");
      
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
      
      console.log("[GroupCall] Call started as initiator");
    } catch (err) {
      console.error("[GroupCall] Start failed:", err);
      cleanup();
    }
  }, [getLocalMedia]);

  // Accept incoming call
  const acceptGroupCall = useCallback(async (groupId, type, fromUser) => {
    try {
      console.log(`[GroupCall] Accepting call from ${fromUser.id} in group ${groupId}`);
      
      // Stop incoming sound immediately
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
      const offer = await peerData.pc.createOffer();
      await peerData.pc.setLocalDescription(offer);
      
      // Send offer to initiator
      socketRef.current?.emit("group:call:accept", {
        groupId,
        toUserId: fromUser.id,
        offer,
      });
      
      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
      
      console.log("[GroupCall] Call accepted, offer sent");
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
    cleanup();
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
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        const videoTrack = stream.getVideoTracks()[0];
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
        }
        
        // Add to all peer connections
        peerConnections.current.forEach((peerData, userId) => {
          try {
            peerData.pc.addTrack(videoTrack, localStreamRef.current);
          } catch (err) {
            console.error(`[GroupCall] Failed to add video track for ${userId}:`, err);
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
    console.log("[GroupCall] Cleaning up...");
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop all streams
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    
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
    setIsMuted(false);
    setIsCameraOn(false);
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
        // Already in call, send busy
        socket.emit("group:call:busy", { groupId, toUserId: fromUser.id });
        return;
      }
      console.log(`[GroupCall] Incoming call from ${fromUser.id} in group ${groupId}`);
      setIncomingCall({ groupId, fromUser, callType });
      audioManager.play("incomingCall", { loop: true });
    };

    // Someone accepted our call (initiator receives this)
    const handleAccepted = async ({ groupId, fromUserId, fromUser, offer }) => {
      console.log(`[GroupCall] handleAccepted called: groupId=${groupId}, fromUserId=${fromUserId}, myId=${myId}, isInitiator=${isInitiatorRef.current}, activeGroup=${activeGroupIdRef.current}`);
      
      if (!isInitiatorRef.current || groupId !== activeGroupIdRef.current) {
        console.log(`[GroupCall] Ignoring accept - not initiator or wrong group`);
        return;
      }
      if (fromUserId === myId) return;
      
      try {
        console.log(`[GroupCall] ${fromUserId} accepted, creating answer`);
        
        // Ensure we have local stream first
        if (!localStreamRef.current) {
          console.log(`[GroupCall] Waiting for local stream before creating peer connection...`);
          await getLocalMedia(callTypeRef.current || "voice");
        }
        
        // Create peer connection for this user
        const peerData = createPeerConnection(fromUserId, groupId, true);
        
        // Set remote offer
        await peerData.pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Process any pending ICE candidates
        for (const c of peerData.pendingIce) {
          await peerData.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        peerData.pendingIce = [];
        
        // Create answer
        const answer = await peerData.pc.createAnswer();
        await peerData.pc.setLocalDescription(answer);
        
        // Send answer
        socket.emit("group:call:answer", {
          groupId,
          toUserId: fromUserId,
          answer,
        });
        
        // Add to participants
        setParticipants((prev) => {
          if (prev.find((p) => p.id === fromUserId)) return prev;
          return [...prev, { id: fromUserId, hasVideo: callTypeRef.current === "video", hasAudio: true, username: fromUser?.username || "Member" }];
        });
        
        console.log(`[GroupCall] Answer sent to ${fromUserId}`);
      } catch (err) {
        console.error("[GroupCall] Failed to handle accepted:", err);
      }
    };

    // Received answer (as joiner)
    const handleAnswer = async ({ groupId, fromUserId, answer }) => {
      if (groupId !== activeGroupIdRef.current) return;
      
      const peerData = peerConnections.current.get(fromUserId);
      if (!peerData) return;
      
      try {
        await peerData.pc.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Process pending ICE
        for (const c of peerData.pendingIce) {
          await peerData.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        peerData.pendingIce = [];
        
        console.log(`[GroupCall] Answer processed from ${fromUserId}`);
      } catch (err) {
        console.error("[GroupCall] Failed to set answer:", err);
      }
    };

    // ICE candidate
    const handleIce = async ({ groupId, fromUserId, candidate }) => {
      if (groupId !== activeGroupIdRef.current) return;
      
      const peerData = peerConnections.current.get(fromUserId);
      if (!peerData) {
        console.log(`[GroupCall] No peer connection for ${fromUserId}, storing ICE candidate`);
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

    // Someone left
    const handleLeft = ({ groupId, userId }) => {
      if (groupId !== activeGroupIdRef.current) return;
      const peerData = peerConnections.current.get(userId);
      if (peerData) {
        peerData.pc.close();
        peerConnections.current.delete(userId);
      }
      setParticipants((prev) => prev.filter((p) => p.id !== userId));
    };

    // Call ended
    const handleEnded = ({ groupId }) => {
      if (groupId === activeGroupIdRef.current) {
        cleanup();
      }
    };

    // Declined
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
    return () => cleanup();
  }, [cleanup]);

  return {
    isInCall,
    isInitiator,
    callType,
    activeGroupId,
    localStream,
    isMuted,
    isCameraOn,
    duration,
    participants,
    incomingCall,
    startGroupCall,
    acceptGroupCall,
    declineCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    cleanup,
  };
}
