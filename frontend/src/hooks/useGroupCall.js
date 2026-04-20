import { useCallback, useEffect, useRef, useState } from "react";
import audioManager from "../lib/audioManager";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Group Call Hook - Based on working DM call system (useCall.js)
 * Multi-peer WebRTC connections with star topology
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

  // Refs - EXACT same structure as useCall.js but Map for multi-peer
  const socketRef = useRef(socket);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const pcMapRef = useRef(new Map()); // userId -> { pc, pendingIce, remoteVideoRef }
  const remoteVideoRefs = useRef(new Map()); // userId -> videoRef
  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const myIdRef = useRef(null);
  const timerRef = useRef(null);
  const screenSenderRef = useRef(null);

  // Update refs
  useEffect(() => { socketRef.current = socket; }, [socket]);

  // Duration timer
  useEffect(() => {
    if (!isInCall) return;
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isInCall]);

  // Cleanup function - EXACT same as useCall.js but for Map
  const cleanup = useCallback(() => {
    console.log("[GroupCall] Cleanup started");
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setDuration(0);

    // Close all peer connections
    pcMapRef.current.forEach((peerData, userId) => {
      if (peerData.pc) peerData.pc.close();
    });
    pcMapRef.current.clear();

    // Stop all streams
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    // Clear video refs
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    screenVideoRef.current = null;
    remoteVideoRefs.current.clear();

    screenSenderRef.current = null;

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
    setParticipants([]);
    setIncomingCall(null);

    audioManager.stop("incomingCall");
    audioManager.stop("outgoingCall");
    
    console.log("[GroupCall] Cleanup complete");
  }, []);

  // Setup peer connection - EXACT same logic as useCall.js setupPeerConnection
  const setupPeerConnection = useCallback((pc, stream, userId) => {
    // Add all tracks
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    // ontrack handler - EXACT same as useCall.js
    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      const track = e.track;
      
      console.log(`[GroupCall] ontrack from ${userId}:`, track?.kind, "muted:", track?.muted, "enabled:", track?.enabled);

      // Get or create video ref for this user
      let videoRef = remoteVideoRefs.current.get(userId);
      if (!videoRef) {
        // Create a hidden video element if no ref exists
        videoRef = { current: null };
        remoteVideoRefs.current.set(userId, videoRef);
      }

      // Attach stream based on track type
      if (track.kind === "video" && videoRef.current) {
        videoRef.current.srcObject = remoteStream;
        videoRef.current.play().catch((err) => console.error(`[GroupCall] Video play error for ${userId}:`, err));
        
        // Update participant with video info
        setParticipants((prev) => {
          const exists = prev.find((p) => p.id === userId);
          if (exists) {
            return prev.map((p) => p.id === userId ? { ...p, stream: remoteStream, hasVideo: true } : p);
          }
          return [...prev, { id: userId, stream: remoteStream, hasVideo: true, hasAudio: true, username: "Member" }];
        });
      }

      if (track.kind === "audio") {
        // Create audio element for this user
        const audioEl = document.createElement("audio");
        audioEl.srcObject = remoteStream;
        audioEl.autoplay = true;
        audioEl.play().catch(() => {});
        
        // Update participant
        setParticipants((prev) => {
          const exists = prev.find((p) => p.id === userId);
          if (exists) {
            return prev.map((p) => p.id === userId ? { ...p, stream: remoteStream, hasAudio: true } : p);
          }
          return [...prev, { id: userId, stream: remoteStream, hasVideo: false, hasAudio: true, username: "Member" }];
        });
      }

      // Handle muted tracks - wait for unmute (EXACT same as useCall.js)
      if (track?.muted) {
        console.log(`[GroupCall] Track muted from ${userId}, waiting for unmute...`);
        track.onunmute = () => {
          console.log(`[GroupCall] Track unmuted from ${userId}:`, track.kind);
          if (track.kind === "video" && videoRef.current) {
            videoRef.current.srcObject = remoteStream;
            videoRef.current.play().catch(() => {});
          }
        };
      }
    };

    // ICE candidate handler
    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current?.connected) {
        socketRef.current.emit("group:call:ice", {
          groupId: activeGroupId,
          toUserId: userId,
          candidate: e.candidate,
        });
      }
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      console.log(`[GroupCall] Connection state with ${userId}:`, pc.connectionState);
      if (pc.connectionState === "connected") {
        console.log(`[GroupCall] Connected to ${userId}`);
      } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        pcMapRef.current.delete(userId);
        remoteVideoRefs.current.delete(userId);
        setParticipants((prev) => prev.filter((p) => p.id !== userId));
      }
    };

    // Renegotiation - EXACT same as useCall.js
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socketRef.current?.connected) {
          socketRef.current.emit("group:call:offer", {
            groupId: activeGroupId,
            toUserId: userId,
            offer: pc.localDescription,
            callType: callType || "voice",
          });
        }
      } catch { /* ignore */ }
    };
  }, [activeGroupId, callType]);

  // Flush ICE candidates - EXACT same as useCall.js
  const flushIce = async (pc, userId) => {
    const peerData = pcMapRef.current.get(userId);
    if (!peerData) return;
    
    for (const c of peerData.pendingIce) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    }
    peerData.pendingIce = [];
  };

  // Start group call - EXACT same flow as useCall.js startCall
  const startGroupCall = useCallback(async (groupId, type, memberIds = []) => {
    if (!groupId || !socketRef.current) return;
    
    try {
      console.log(`[GroupCall] Starting ${type} call in group ${groupId}`);
      
      const constraints = type === "video"
        ? { audio: true, video: { width: 1280, height: 720, facingMode: "user" } }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      setIsInCall(true);
      setIsInitiator(true);
      setCallType(type);
      setActiveGroupId(groupId);
      setIsCameraOn(type === "video");
      setParticipants([]);
      setIncomingCall(null);

      // Set local video
      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      // Notify server
      socketRef.current.emit("group:call:start", {
        groupId,
        callType: type,
        memberIds: Array.isArray(memberIds) ? memberIds : [],
      });

      audioManager.stop("incomingCall");
      audioManager.stop("outgoingCall");
      
      console.log("[GroupCall] Call started as initiator");
    } catch (err) {
      console.error("[GroupCall] Start failed:", err);
      cleanup();
    }
  }, [cleanup]);

  // Accept incoming call - EXACT same flow as useCall.js acceptIncoming
  const acceptGroupCall = useCallback(async (groupId, type, fromUser) => {
    if (!groupId || !fromUser?.id || !socketRef.current) return;
    
    try {
      console.log(`[GroupCall] Accepting call from ${fromUser.id}`);
      
      audioManager.stop("incomingCall");

      const constraints = type === "video"
        ? { audio: true, video: { width: 1280, height: 720, facingMode: "user" } }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      setIsInCall(true);
      setIsInitiator(false);
      setCallType(type);
      setActiveGroupId(groupId);
      setIsCameraOn(type === "video");
      setIncomingCall(null);

      // Set local video
      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      // Create peer connection for initiator
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const peerData = { pc, pendingIce: [] };
      pcMapRef.current.set(fromUser.id, peerData);
      
      setupPeerConnection(pc, stream, fromUser.id);

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send accept
      socketRef.current.emit("group:call:accept", {
        groupId,
        toUserId: fromUser.id,
        offer: pc.localDescription,
      });

      console.log("[GroupCall] Call accepted, offer sent");
    } catch (err) {
      console.error("[GroupCall] Accept failed:", err);
      cleanup();
    }
  }, [cleanup, setupPeerConnection]);

  // Decline call
  const declineCall = useCallback((groupId, fromUserId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("group:call:decline", { groupId, toUserId: fromUserId });
    }
    setIncomingCall(null);
    audioManager.stop("incomingCall");
  }, []);

  // Leave call
  const leaveCall = useCallback(() => {
    if (activeGroupId && socketRef.current?.connected) {
      socketRef.current.emit("group:call:leave", { groupId: activeGroupId });
      if (isInitiator) {
        socketRef.current.emit("group:call:end", { groupId: activeGroupId });
      }
    }
    cleanup();
  }, [activeGroupId, isInitiator, cleanup]);

  // Toggle mute - EXACT same as useCall.js
  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  }, []);

  // Toggle camera - EXACT same logic as useCall.js
  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = false;
      }
      if (localVideoRef.current) localVideoRef.current.style.display = "none";
      setIsCameraOn(false);
    } else {
      try {
        let videoTrack = localStreamRef.current?.getVideoTracks()[0];
        
        if (videoTrack) {
          videoTrack.enabled = true;
        } else {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: "user" },
          });
          videoTrack = videoStream.getVideoTracks()[0];
          
          if (localStreamRef.current) {
            localStreamRef.current.addTrack(videoTrack);
          }
          
          // Add to all peer connections
          pcMapRef.current.forEach((peerData, userId) => {
            try {
              peerData.pc.addTrack(videoTrack, localStreamRef.current);
            } catch (err) {
              console.error(`[GroupCall] Failed to add video for ${userId}:`, err);
            }
          });
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.style.display = "block";
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }
        setIsCameraOn(true);
        setCallType("video");
      } catch (err) {
        console.error("[GroupCall] Camera error:", err);
      }
    }
  }, [isCameraOn]);

  // Start screen share - EXACT same logic as useCall.js
  const startScreenShare = useCallback(async () => {
    if (isScreenSharing) return;
    
    try {
      console.log("[GroupCall] Starting screen share");
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always", width: 1920, height: 1080 },
        audio: false,
      });
      
      const screenTrack = stream.getVideoTracks()[0];
      screenStreamRef.current = stream;
      setScreenStream(stream);
      
      // Add screen track to all peer connections
      pcMapRef.current.forEach((peerData, userId) => {
        const sender = peerData.pc.addTrack(screenTrack, stream);
        if (userId === Array.from(pcMapRef.current.keys())[0]) {
          screenSenderRef.current = sender;
        }
      });

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play().catch(() => {});
      }

      screenTrack.onended = () => {
        console.log("[GroupCall] Screen share ended");
        stopScreenShare();
      };

      setIsScreenSharing(true);
      
      if (socketRef.current?.connected) {
        socketRef.current.emit("group:screen:start", { groupId: activeGroupId });
      }
    } catch (err) {
      console.error("[GroupCall] Screen share error:", err);
    }
  }, [isScreenSharing, activeGroupId]);

  // Stop screen share - EXACT same logic as useCall.js
  const stopScreenShare = useCallback(() => {
    if (!isScreenSharing) return;

    if (screenSenderRef.current) {
      pcMapRef.current.forEach((peerData) => {
        try {
          peerData.pc.removeTrack(screenSenderRef.current);
        } catch {}
      });
      screenSenderRef.current = null;
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    setIsScreenSharing(false);
    
    if (socketRef.current?.connected) {
      socketRef.current.emit("group:screen:stop", { groupId: activeGroupId });
    }
  }, [isScreenSharing, activeGroupId]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;
    
    const myId = socket.user?.id;
    myIdRef.current = myId;

    // Incoming call
    const onIncoming = ({ groupId, fromUser, callType: type }) => {
      if (!groupId || !fromUser?.id || fromUser.id === myId) return;
      if (isInCall) {
        socket.emit("group:call:busy", { groupId, toUserId: fromUser.id });
        return;
      }
      console.log(`[GroupCall] Incoming from ${fromUser.id}`);
      setIncomingCall({ groupId, fromUser, callType: type });
      audioManager.play("incomingCall", { loop: true });
    };

    // Handle accept (initiator receives this)
    const onAccept = async ({ groupId, fromUserId, fromUser, offer }) => {
      if (!fromUserId || !offer) return;
      
      const stream = localStreamRef.current;
      if (!stream) {
        console.log("[GroupCall] No local stream for accept");
        return;
      }

      try {
        // Create peer connection for this user
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        const peerData = { pc, pendingIce: [] };
        pcMapRef.current.set(fromUserId, peerData);
        
        setupPeerConnection(pc, stream, fromUserId);

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIce(pc, fromUserId);
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("group:call:answer", {
          groupId,
          toUserId: fromUserId,
          answer: pc.localDescription,
        });

        // Add participant
        setParticipants((prev) => {
          if (prev.find((p) => p.id === fromUserId)) return prev;
          return [...prev, { id: fromUserId, username: fromUser?.username || "Member", hasVideo: callType === "video" }];
        });

        console.log(`[GroupCall] Answer sent to ${fromUserId}`);
      } catch (err) {
        console.error("[GroupCall] Accept handler error:", err);
      }
    };

    // Handle answer (joiner receives this)
    const onAnswer = async ({ groupId, fromUserId, answer }) => {
      if (!fromUserId || !answer) return;
      
      const peerData = pcMapRef.current.get(fromUserId);
      if (!peerData) {
        console.log(`[GroupCall] No PC for ${fromUserId}`);
        return;
      }

      try {
        await peerData.pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIce(peerData.pc, fromUserId);
        console.log(`[GroupCall] Answer processed from ${fromUserId}`);
      } catch (err) {
        console.error("[GroupCall] Answer handler error:", err);
      }
    };

    // Handle offer (for renegotiation)
    const onOffer = async ({ groupId, fromUserId, offer }) => {
      if (!fromUserId || !offer) return;
      
      const peerData = pcMapRef.current.get(fromUserId);
      if (!peerData) return;

      try {
        await peerData.pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerData.pc.createAnswer();
        await peerData.pc.setLocalDescription(answer);
        
        socket.emit("group:call:answer", {
          groupId,
          toUserId: fromUserId,
          answer: peerData.pc.localDescription,
        });
      } catch (err) {
        console.error("[GroupCall] Offer handler error:", err);
      }
    };

    // Handle ICE
    const onIce = async ({ groupId, fromUserId, candidate }) => {
      if (!fromUserId || !candidate) return;
      
      const peerData = pcMapRef.current.get(fromUserId);
      
      if (!peerData || !peerData.pc.remoteDescription) {
        // Store pending
        if (!peerData) {
          const newPeerData = { pc: null, pendingIce: [candidate] };
          pcMapRef.current.set(fromUserId, newPeerData);
        } else {
          peerData.pendingIce.push(candidate);
        }
        return;
      }

      try {
        await peerData.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("[GroupCall] ICE error:", err);
      }
    };

    // Handle left
    const onLeft = ({ groupId, userId }) => {
      const peerData = pcMapRef.current.get(userId);
      if (peerData?.pc) {
        peerData.pc.close();
      }
      pcMapRef.current.delete(userId);
      remoteVideoRefs.current.delete(userId);
      setParticipants((prev) => prev.filter((p) => p.id !== userId));
    };

    // Handle ended
    const onEnded = ({ groupId }) => {
      if (groupId === activeGroupId) {
        cleanup();
      }
    };

    // Handle declined
    const onDeclined = ({ groupId, fromUserId }) => {
      const peerData = pcMapRef.current.get(fromUserId);
      if (peerData?.pc) {
        peerData.pc.close();
      }
      pcMapRef.current.delete(fromUserId);
      remoteVideoRefs.current.delete(fromUserId);
      setParticipants((prev) => prev.filter((p) => p.id !== fromUserId));
    };

    socket.on("group:call:incoming", onIncoming);
    socket.on("group:call:accepted", onAccept);
    socket.on("group:call:answer", onAnswer);
    socket.on("group:call:ice", onIce);
    socket.on("group:call:offer", onOffer);
    socket.on("group:call:left", onLeft);
    socket.on("group:call:ended", onEnded);
    socket.on("group:call:declined", onDeclined);

    return () => {
      socket.off("group:call:incoming", onIncoming);
      socket.off("group:call:accepted", onAccept);
      socket.off("group:call:answer", onAnswer);
      socket.off("group:call:ice", onIce);
      socket.off("group:call:offer", onOffer);
      socket.off("group:call:left", onLeft);
      socket.off("group:call:ended", onEnded);
      socket.off("group:call:declined", onDeclined);
    };
  }, [socket, activeGroupId, isInCall, callType, cleanup, setupPeerConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Set local video ref
  const setLocalVideo = useCallback((ref) => {
    localVideoRef.current = ref;
  }, []);

  // Set screen video ref
  const setScreenVideo = useCallback((ref) => {
    screenVideoRef.current = ref;
  }, []);

  // Set remote video ref for a user
  const setRemoteVideo = useCallback((userId, ref) => {
    remoteVideoRefs.current.set(userId, { current: ref });
  }, []);

  // Format duration
  const formatDuration = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

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
    incomingCall,
    
    // Refs
    localVideoRef,
    screenVideoRef,
    setLocalVideo,
    setScreenVideo,
    setRemoteVideo,
    
    // Methods
    startGroupCall,
    acceptGroupCall,
    declineCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    formatDuration,
    cleanup,
  };
}
