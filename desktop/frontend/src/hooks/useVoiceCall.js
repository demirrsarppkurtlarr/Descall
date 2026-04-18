import { useCallback, useEffect, useRef, useState } from "react";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function useVoiceCall(socket) {
  const [mode, setMode] = useState(null);
  const [peer, setPeer] = useState(null);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pendingIceRef = useRef([]);
  const incomingOfferRef = useRef(null);
  const peerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    peerRef.current = peer;
  }, [peer]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setDuration(0);
    incomingOfferRef.current = null;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    pendingIceRef.current = [];
    setMode(null);
    setPeer(null);
    setMuted(false);
  }, []);

  useEffect(() => {
    if (mode !== "active") return;
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode]);

  useEffect(() => {
    if (!socket) return;

    const flushIce = async (pc) => {
      for (const c of pendingIceRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingIceRef.current = [];
    };

    const onOffer = ({ fromUser, offer } = {}) => {
      if (!fromUser?.id || !offer) return;
      incomingOfferRef.current = offer;
      setPeer(fromUser);
      setMode("incoming");
    };

    const onAnswer = async ({ fromUserId, answer } = {}) => {
      if (!fromUserId || !answer || !pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIce(pcRef.current);
        setMode("active");
      } catch {
        /* ignore */
      }
    };

    const onIce = async ({ fromUserId, candidate } = {}) => {
      if (!candidate || !fromUserId) return;
      const pc = pcRef.current;
      if (!pc) {
        pendingIceRef.current.push(candidate);
        return;
      }
      if (!pc.remoteDescription) {
        pendingIceRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        /* ignore */
      }
    };

    const onEnded = ({ fromUserId } = {}) => {
      if (peerRef.current?.id === fromUserId) cleanup();
    };

    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice-candidate", onIce);
    socket.on("call:ended", onEnded);
    socket.on("call:declined", onEnded);

    return () => {
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice-candidate", onIce);
      socket.off("call:ended", onEnded);
      socket.off("call:declined", onEnded);
    };
  }, [socket, cleanup]);

  const endCall = useCallback(
    (toUserId) => {
      if (toUserId && socket?.connected) socket.emit("call:end", { toUserId });
      cleanup();
    },
    [socket, cleanup],
  );

  const declineIncoming = useCallback(() => {
    if (peer?.id) socket.emit("call:decline", { toUserId: peer.id });
    cleanup();
  }, [peer, socket, cleanup]);

  const acceptIncoming = useCallback(async () => {
    const offer = incomingOfferRef.current;
    if (!peer?.id || !offer || !socket) return;
    const applyPending = async (pc) => {
      for (const c of pendingIceRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingIceRef.current = [];
    };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((t) => {
        t.enabled = true; // Ensure track is enabled
        pc.addTrack(t, stream);
        console.log('Added audio track to peer connection:', t.kind, t.enabled, t.label);
      });
      
      // Verify tracks were added
      const senders = pc.getSenders();
      console.log('Peer connection senders:', senders.length);
      senders.forEach(sender => {
        console.log('Sender track:', sender.track?.kind, sender.track?.enabled);
      });
      pc.ontrack = (e) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = e.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("call:ice-candidate", { toUserId: peer.id, candidate: e.candidate });
      };
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await applyPending(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("call:answer", { toUserId: peer.id, answer: pc.localDescription });
      setMode("active");
    } catch {
      cleanup();
    }
  }, [peer, socket, cleanup]);

  const startCall = useCallback(
    async (friend) => {
      if (!friend?.id || !socket) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
        localStreamRef.current = stream;
        setPeer(friend);
        setMode("outgoing");
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        stream.getTracks().forEach((t) => {
          t.enabled = true; // Ensure track is enabled
          pc.addTrack(t, stream);
          console.log('Added audio track to peer connection:', t.kind, t.enabled, t.label);
        });
        
        // Verify tracks were added
        const senders = pc.getSenders();
        console.log('Peer connection senders:', senders.length);
        senders.forEach(sender => {
          console.log('Sender track:', sender.track?.kind, sender.track?.enabled);
        });
        pc.ontrack = (e) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = e.streams[0];
            remoteAudioRef.current.play().catch(() => {});
          }
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit("call:ice-candidate", { toUserId: friend.id, candidate: e.candidate });
        };
        pc.onconnectionstatechange = () => {
          console.log('Peer connection state changed to:', pc.connectionState);
          if (pc.connectionState === "connected") setMode("active");
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:offer", { toUserId: friend.id, offer: pc.localDescription });
      } catch {
        cleanup();
      }
    },
    [socket, cleanup],
  );

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      const wasEnabled = track.enabled;
      track.enabled = !wasEnabled;
      setMuted(!wasEnabled);
      console.log('Audio track enabled:', track.enabled);
    } else {
      console.warn('No audio track found for muting');
    }
  }, []);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return {
    remoteAudioRef,
    mode,
    peer,
    muted,
    duration,
    formatDuration,
    startCall,
    endCall,
    acceptIncoming,
    declineIncoming,
    toggleMute,
    cleanup,
  };
}
