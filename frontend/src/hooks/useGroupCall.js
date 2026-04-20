import { useCallback, useEffect, useRef, useState } from "react";
import audioManager from "../lib/audioManager";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Group Call Hook - Simplified multi-peer WebRTC
 * Based on working DM call (useCall.js) with Map for multiple peers
 */
export function useGroupCall(socket) {
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

  const socketRef = useRef(socket);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const pcMapRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const remoteAudioRefs = useRef(new Map());
  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const myIdRef = useRef(null);
  const timerRef = useRef(null);
  const screenSenderRef = useRef(null);

  useEffect(() => { socketRef.current = socket; }, [socket]);

  useEffect(() => {
    if (!isInCall) return;
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isInCall]);

  const cleanup = useCallback(() => {
    console.log("[GroupCall] Cleanup");
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setDuration(0);

    pcMapRef.current.forEach((peerData, userId) => {
      if (peerData.pc) peerData.pc.close();
    });
    pcMapRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    remoteStreamsRef.current.clear();
    
    remoteAudioRefs.current.forEach((audioEl) => {
      audioEl.srcObject = null;
      audioEl.remove();
    });
    remoteAudioRefs.current.clear();

    screenSenderRef.current = null;

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
  }, []);

  const setupPeerConnection = useCallback((pc, stream, userId) => {
    stream.getTracks().forEach((t) => {
      t.enabled = true;
      pc.addTrack(t, stream);
    });

    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      const track = e.track;
      console.log(`[GroupCall] Track from ${userId}:`, track.kind, "muted:", track.muted, "enabled:", track.enabled);
      
      remoteStreamsRef.current.set(userId, remoteStream);
      
      // Create audio element for this user if it doesn't exist
      if (track.kind === "audio") {
        let audioEl = remoteAudioRefs.current.get(userId);
        if (!audioEl) {
          audioEl = document.createElement("audio");
          audioEl.autoplay = true;
          audioEl.muted = false;
          audioEl.playsInline = true;
          audioEl.style.display = "none";
          document.body.appendChild(audioEl);
          remoteAudioRefs.current.set(userId, audioEl);
        }
        audioEl.srcObject = remoteStream;
        audioEl.play().catch((err) => console.error(`[GroupCall] Audio play error for ${userId}:`, err));
      }
      
      // Handle muted tracks
      if (track?.muted) {
        console.log(`[GroupCall] Track muted from ${userId}, waiting for unmute...`);
        track.onunmute = () => {
          console.log(`[GroupCall] Track unmuted from ${userId}:`, track.kind);
          if (track.kind === "audio") {
            const audioEl = remoteAudioRefs.current.get(userId);
            if (audioEl) {
              audioEl.srcObject = remoteStream;
              audioEl.play().catch((err) => console.error(`[GroupCall] Audio play error after unmute for ${userId}:`, err));
            }
          }
        };
      }
      
      setParticipants((prev) => {
        const exists = prev.find((p) => p.id === userId);
        if (exists) {
          return prev.map((p) => p.id === userId ? { 
            ...p, 
            stream: remoteStream,
            hasVideo: track.kind === "video" ? true : p.hasVideo,
            hasAudio: track.kind === "audio" ? true : p.hasAudio
          } : p);
        }
        return [...prev, { 
          id: userId, 
          stream: remoteStream, 
          hasVideo: track.kind === "video", 
          hasAudio: track.kind === "audio",
          username: "Member" 
        }];
      });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current?.connected) {
        socketRef.current.emit("group:call:ice", {
          groupId: activeGroupId,
          toUserId: userId,
          candidate: e.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[GroupCall] Connection with ${userId}:`, pc.connectionState);
      if (pc.connectionState === "connected") {
        console.log(`[GroupCall] Connected to ${userId}`);
      } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        pcMapRef.current.delete(userId);
        remoteStreamsRef.current.delete(userId);
        setParticipants((prev) => prev.filter((p) => p.id !== userId));
      }
    };

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
      } catch (err) {
        console.error("[GroupCall] Negotiation error:", err);
      }
    };
  }, [activeGroupId, callType]);

  const flushIce = async (pc, userId) => {
    const peerData = pcMapRef.current.get(userId);
    if (!peerData) return;
    
    for (const c of peerData.pendingIce) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    }
    peerData.pendingIce = [];
  };

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

      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      socketRef.current.emit("group:call:start", {
        groupId,
        callType: type,
        memberIds: Array.isArray(memberIds) ? memberIds : [],
      });

      audioManager.stop("incomingCall");
      audioManager.stop("outgoingCall");
      
      console.log("[GroupCall] Call started");
    } catch (err) {
      console.error("[GroupCall] Start failed:", err);
      cleanup();
    }
  }, [cleanup, activeGroupId]);

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

      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const peerData = { pc, pendingIce: [] };
      pcMapRef.current.set(fromUser.id, peerData);
      
      setupPeerConnection(pc, stream, fromUser.id);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current.emit("group:call:accept", {
        groupId,
        toUserId: fromUser.id,
        offer: pc.localDescription,
      });

      console.log("[GroupCall] Call accepted");
    } catch (err) {
      console.error("[GroupCall] Accept failed:", err);
      cleanup();
    }
  }, [cleanup, setupPeerConnection, activeGroupId]);

  const declineCall = useCallback((groupId, fromUserId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("group:call:decline", { groupId, toUserId: fromUserId });
    }
    setIncomingCall(null);
    audioManager.stop("incomingCall");
  }, []);

  const leaveCall = useCallback(() => {
    if (activeGroupId && socketRef.current?.connected) {
      socketRef.current.emit("group:call:leave", { groupId: activeGroupId });
      if (isInitiator) {
        socketRef.current.emit("group:call:end", { groupId: activeGroupId });
      }
    }
    cleanup();
  }, [activeGroupId, isInitiator, cleanup]);

  const toggleMute = useCallback(async () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);

      // Trigger renegotiation for all peers to send audio state
      pcMapRef.current.forEach(async (peerData, userId) => {
        try {
          const offer = await peerData.pc.createOffer();
          await peerData.pc.setLocalDescription(offer);
          if (socketRef.current?.connected) {
            socketRef.current.emit("group:call:offer", {
              groupId: activeGroupId,
              toUserId: userId,
              offer: peerData.pc.localDescription,
              callType: callType || "voice",
            });
          }
        } catch (err) {
          console.error(`[GroupCall] Mute renegotiation error for ${userId}:`, err);
        }
      });
    }
  }, [activeGroupId, callType]);

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

        // Trigger renegotiation for all peers to send video track
        pcMapRef.current.forEach(async (peerData, userId) => {
          try {
            const offer = await peerData.pc.createOffer();
            await peerData.pc.setLocalDescription(offer);
            if (socketRef.current?.connected) {
              socketRef.current.emit("group:call:offer", {
                groupId: activeGroupId,
                toUserId: userId,
                offer: peerData.pc.localDescription,
                callType: "video",
              });
            }
          } catch (err) {
            console.error(`[GroupCall] Renegotiation error for ${userId}:`, err);
          }
        });
      } catch (err) {
        console.error("[GroupCall] Camera error:", err);
      }
    }
  }, [isCameraOn, activeGroupId]);

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
      
      pcMapRef.current.forEach((peerData, userId) => {
        try {
          const sender = peerData.pc.addTrack(screenTrack, stream);
          if (!screenSenderRef.current) {
            screenSenderRef.current = sender;
          }
        } catch (err) {
          console.error(`[GroupCall] Failed to add screen track for ${userId}:`, err);
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
      
      // Trigger renegotiation for all peers to send screen track
      pcMapRef.current.forEach(async (peerData, userId) => {
        try {
          const offer = await peerData.pc.createOffer();
          await peerData.pc.setLocalDescription(offer);
          if (socketRef.current?.connected) {
            socketRef.current.emit("group:call:offer", {
              groupId: activeGroupId,
              toUserId: userId,
              offer: peerData.pc.localDescription,
              callType: callType || "video",
            });
          }
        } catch (err) {
          console.error(`[GroupCall] Screen share renegotiation error for ${userId}:`, err);
        }
      });
      
      if (socketRef.current?.connected) {
        socketRef.current.emit("group:screen:start", { groupId: activeGroupId });
      }
    } catch (err) {
      console.error("[GroupCall] Screen share error:", err);
    }
  }, [isScreenSharing, activeGroupId, callType]);

  const stopScreenShare = useCallback(async () => {
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
    
    // Trigger renegotiation for all peers to remove screen track
    pcMapRef.current.forEach(async (peerData, userId) => {
      try {
        const offer = await peerData.pc.createOffer();
        await peerData.pc.setLocalDescription(offer);
        if (socketRef.current?.connected) {
          socketRef.current.emit("group:call:offer", {
            groupId: activeGroupId,
            toUserId: userId,
            offer: peerData.pc.localDescription,
            callType: callType || "voice",
          });
        }
      } catch (err) {
        console.error(`[GroupCall] Screen stop renegotiation error for ${userId}:`, err);
      }
    });
    
    if (socketRef.current?.connected) {
      socketRef.current.emit("group:screen:stop", { groupId: activeGroupId });
    }
  }, [isScreenSharing, activeGroupId, callType]);

  useEffect(() => {
    if (!socket) return;
    
    const myId = socket.user?.id;
    myIdRef.current = myId;

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

    const onAccept = async ({ groupId, fromUserId, fromUser, offer }) => {
      if (!fromUserId || !offer) return;
      
      const stream = localStreamRef.current;
      if (!stream) {
        console.log("[GroupCall] No local stream for accept");
        return;
      }

      try {
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

        console.log(`[GroupCall] Answer sent to ${fromUserId}`);
      } catch (err) {
        console.error("[GroupCall] Accept handler error:", err);
      }
    };

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

    const onIce = async ({ groupId, fromUserId, candidate }) => {
      if (!fromUserId || !candidate) return;
      
      const peerData = pcMapRef.current.get(fromUserId);
      
      if (!peerData || !peerData.pc.remoteDescription) {
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

    const onLeft = ({ groupId, userId }) => {
      const peerData = pcMapRef.current.get(userId);
      if (peerData?.pc) {
        peerData.pc.close();
      }
      pcMapRef.current.delete(userId);
      remoteStreamsRef.current.delete(userId);
      setParticipants((prev) => prev.filter((p) => p.id !== userId));
    };

    const onEnded = ({ groupId }) => {
      if (groupId === activeGroupId) {
        cleanup();
      }
    };

    const onDeclined = ({ groupId, fromUserId }) => {
      const peerData = pcMapRef.current.get(fromUserId);
      if (peerData?.pc) {
        peerData.pc.close();
      }
      pcMapRef.current.delete(fromUserId);
      remoteStreamsRef.current.delete(fromUserId);
      setParticipants((prev) => prev.filter((p) => p.id !== fromUserId));
    };

    const onScreenStarted = ({ groupId, fromUserId }) => {
      console.log(`[GroupCall] Screen share started by ${fromUserId}`);
      setParticipants((prev) => prev.map((p) => 
        p.id === fromUserId ? { ...p, isScreenSharing: true } : p
      ));
    };

    const onScreenStopped = ({ groupId, fromUserId }) => {
      console.log(`[GroupCall] Screen share stopped by ${fromUserId}`);
      setParticipants((prev) => prev.map((p) => 
        p.id === fromUserId ? { ...p, isScreenSharing: false } : p
      ));
    };

    socket.on("group:call:incoming", onIncoming);
    socket.on("group:call:accepted", onAccept);
    socket.on("group:call:answer", onAnswer);
    socket.on("group:call:ice", onIce);
    socket.on("group:call:offer", onOffer);
    socket.on("group:call:left", onLeft);
    socket.on("group:call:ended", onEnded);
    socket.on("group:call:declined", onDeclined);
    socket.on("group:screen:started", onScreenStarted);
    socket.on("group:screen:stopped", onScreenStopped);

    return () => {
      socket.off("group:call:incoming", onIncoming);
      socket.off("group:call:accepted", onAccept);
      socket.off("group:call:answer", onAnswer);
      socket.off("group:call:ice", onIce);
      socket.off("group:call:offer", onOffer);
      socket.off("group:call:left", onLeft);
      socket.off("group:call:ended", onEnded);
      socket.off("group:call:declined", onDeclined);
      socket.off("group:screen:started", onScreenStarted);
      socket.off("group:screen:stopped", onScreenStopped);
    };
  }, [socket, activeGroupId, isInCall, callType, cleanup, setupPeerConnection]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const setLocalVideo = useCallback((ref) => {
    localVideoRef.current = ref;
  }, []);

  const setScreenVideo = useCallback((ref) => {
    screenVideoRef.current = ref;
  }, []);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

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
    remoteStreams: remoteStreamsRef,
    localVideoRef,
    screenVideoRef,
    setLocalVideo,
    setScreenVideo,
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
