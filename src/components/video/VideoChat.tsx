import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { sendSignaling, getSignaling, deleteSignaling, joinCall } from "../../api/signaling";
import LocalVideo from "./LocalVideo";
import RemoteVideo from "./RemoteVideo";
import { jwtDecode } from "jwt-decode";
import LogoutButton from "../LogoutButton";
import HeaderBar from "../HeaderBar";
import CallingAvatar from "../AvatarCalling";


interface Props {
  callId: string;
  isInitiator: boolean;
}

const VideoChat: React.FC<Props> = ({ callId, isInitiator }) => {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteScreenShare, setRemoteScreenShare] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");


  const peer = useRef<Peer.Instance | null>(null);
  const seenSignals = useRef<Set<number>>(new Set());
  const appliedOffer = useRef(false);
  const appliedAnswer = useRef(false);

  const token = localStorage.getItem("token");
  const me = token ? (jwtDecode(token) as any).sub : "";
  const parts = callId.split("_");
  const targetUser = parts.find((u) => u !== me);

  // 1. Camera la început
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((camStream) => {
        setCameraStream(camStream);
        setLocalStream(camStream);
      })
      .catch(console.error);
  }, []);

  // 2. Inițiator: offer
  useEffect(() => {
    if (!cameraStream) return;
    if (isInitiator && !peer.current) {
      joinCall(callId).catch(console.error);
      const p = new Peer({ initiator: true, trickle: false, stream: cameraStream });
      p.on("signal", async (data: any) => {
        await sendSignaling(
          callId,
          data.type === "offer" || data.type === "answer" ? data.type : "ice",
          JSON.stringify(data),
          targetUser
        );
      });
      p.on("stream", (stream: MediaStream) => setRemoteStream(stream));
      peer.current = p;
    }
  }, [cameraStream, isInitiator, callId, targetUser]);

  // 3. Callee: accept
  const handleAccept = async () => {
    if (!cameraStream) return;
    await joinCall(callId);
    const offers: any[] = await getSignaling(callId, "offer", me);
    if (!offers.length) return;
    const offer = JSON.parse(offers[0].content);
    const p = new Peer({ initiator: false, trickle: false, stream: cameraStream });
    p.on("signal", async (data: any) => {
      await sendSignaling(
        callId,
        data.type === "offer" || data.type === "answer" ? data.type : "ice",
        JSON.stringify(data),
        targetUser
      );
    });
    p.on("stream", (stream: MediaStream) => setRemoteStream(stream));
    peer.current = p;
    try {
      p.signal(offer);
      appliedOffer.current = true;
      setAccepted(true);
    } catch (err) {
      console.warn("Eroare la accept:", err);
    }
  };

  // 4. Poll signaling + screen-share flag
  useEffect(() => {
    const iv = setInterval(async () => {
      if (!cameraStream) return;
      if (!isInitiator && !accepted) return;
      const offers: any[] = await getSignaling(callId, "offer", me);
      const answers: any[] = await getSignaling(callId, "answer", me);
      const ices: any[] = await getSignaling(callId, "ice", me);
      const ends = await getSignaling(callId, "end", me);
      const screenShares = await getSignaling(callId, "screen-share", me);

      if (ends.length) {
        alert("Celălalt utilizator a închis apelul.");
        await deleteSignaling(callId);
        window.location.href = "/";
      }

      offers.forEach((sig: any) => {
        if (seenSignals.current.has(sig.id)) return;
        seenSignals.current.add(sig.id);
        if (!isInitiator && !appliedOffer.current) {
          const p = new Peer({
            initiator: false,
            trickle: false,
            stream: cameraStream,
            config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
          });
          p.on("signal", async (data: any) => {
            await sendSignaling(
              callId,
              data.type === "offer" || data.type === "answer" ? data.type : "ice",
              JSON.stringify(data),
              targetUser
            );
          });
          p.on("stream", (stream: MediaStream) => setRemoteStream(stream));
          peer.current = p;
          p.signal(JSON.parse(sig.content));
          appliedOffer.current = true;
        }
      });
      answers.forEach((sig: any) => {
        if (seenSignals.current.has(sig.id)) return;
        seenSignals.current.add(sig.id);
        if (isInitiator && peer.current && !appliedAnswer.current) {
          peer.current.signal(JSON.parse(sig.content));
          appliedAnswer.current = true;
          setAccepted(true);
        }
      });
      ices.forEach((sig: any) => {
        if (seenSignals.current.has(sig.id)) return;
        seenSignals.current.add(sig.id);
        if (peer.current) {
          peer.current.signal(JSON.parse(sig.content));
        }
      });

      // Prinde screen-share de la peer
      screenShares.forEach((sig: any) => {
        if (sig.content === "start") setRemoteScreenShare(true);
        if (sig.content === "stop") setRemoteScreenShare(false);
      });
    }, 1500);
    return () => clearInterval(iv);
  }, [cameraStream, accepted, callId, isInitiator, targetUser]);

  // Share screen logic
  const handleShareScreen = async () => {
    try {
      const scrStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(scrStream);
      await sendSignaling(callId, "screen-share", "start", targetUser);

      const screenTrack = scrStream.getVideoTracks()[0];
      if (peer.current) {
        const videoSender = peer.current.streams[0]
          .getTracks()
          .find((t: MediaStreamTrack) => t.kind === "video");
        if (videoSender) {
          peer.current.replaceTrack(videoSender, screenTrack, peer.current.streams[0]);
        }
      }
      scrStream.getVideoTracks()[0].onended = () => handleStopShareScreen();
    } catch (err) {
      alert("Nu s-a putut partaja ecranul!");
      setScreenStream(null);
    }
  };

  const handleStopShareScreen = async () => {
    try {
      setScreenStream(null);
      await sendSignaling(callId, "screen-share", "stop", targetUser);

      if (peer.current && cameraStream) {
        const videoSender = peer.current.streams[0]
          .getTracks()
          .find((t: MediaStreamTrack) => t.kind === "video");
        if (videoSender) {
          peer.current.replaceTrack(
            videoSender,
            cameraStream.getVideoTracks()[0],
            peer.current.streams[0]
          );
        }
      }
    } catch (err) {
      alert("Nu s-a putut reveni la cameră!");
    }
  };

  const handleCancel = async () => {
    await deleteSignaling(callId);
    window.location.href = "/";
  };
  const endCall = async () => {
    peer.current?.destroy();
    cameraStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    await sendSignaling(callId, "end", "", targetUser);
    window.location.href = "/";
  };

  // ================= LAYOUT =====================

  const isLocalScreenSharing = !!screenStream;
  const isRemoteScreenSharing = !!remoteScreenShare;

  if (!accepted && isInitiator) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-midnight via-darkblue to-almost-black py-8">
        <h3 className="text-2xl font-bold text-primary-blue mb-8 drop-shadow">
          Apelezi pe {targetUser}...
        </h3>
        <CallingAvatar username={targetUser || "?"} />
        <button
          className="mt-10 px-8 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold shadow transition"
          onClick={endCall}
        >
          Anulează apelul
        </button>
      </div>
    );
  }

  // ------ layout pentru "cel care partajeaza"
  if (isLocalScreenSharing) {
    return (
      <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-midnight via-darkblue to-almost-black py-8">
        <h3 className="text-3xl font-bold text-primary-blue mb-8 drop-shadow">WebRTC Video Chat</h3>
        <div className="flex flex-row w-full max-w-6xl items-center justify-center mb-10 gap-10">
          <div className="flex-1 bg-darkblue rounded-2xl shadow-xl p-2 flex items-center justify-center min-h-[400px]">
            <video
              autoPlay
              playsInline
              muted
              className="w-full h-full rounded-2xl"
              ref={(el) => { if (el && screenStream) el.srcObject = screenStream; }}
            />
          </div>
          <div className="flex flex-col gap-6 min-w-[300px]">
            <div className="bg-midnight rounded-2xl shadow-xl p-2 flex flex-col items-center">
              <span className="mb-2 text-accent-blue font-semibold">Tu</span>
              <LocalVideo stream={cameraStream} />
            </div>
            <div className="bg-midnight rounded-2xl shadow-xl p-2 flex flex-col items-center">
              <span className="mb-2 text-primary-blue font-semibold">{targetUser}</span>
              <RemoteVideo stream={remoteStream} />
            </div>
          </div>
        </div>
        <div className="flex gap-4 mt-2">
          <button
            className="px-8 py-2 rounded-xl bg-gradient-to-r from-primary-blue to-accent-blue text-white font-bold shadow hover:from-accent-blue hover:to-primary-blue transition"
            onClick={endCall}
          >
            Închide apelul
          </button>
          <button
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow transition"
            onClick={handleStopShareScreen}
          >
            Oprește partajarea
          </button>
        </div>
      </div>
    );
  }

  // ------ layout pentru "cel care priveste" (remote screen share activ)
  if (isRemoteScreenSharing) {
    return (
      <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-midnight via-darkblue to-almost-black py-8">
        <h3 className="text-3xl font-bold text-primary-blue mb-8 drop-shadow">WebRTC Video Chat</h3>
        <div className="relative w-full flex justify-center items-center mb-10" style={{ minHeight: 500 }}>
          <div className="max-w-[900px] max-h-[65vh] w-full flex justify-center">
            <RemoteVideo stream={remoteStream} />
          </div>
          <div className="absolute bottom-6 right-8 w-56 h-40 bg-midnight rounded-xl shadow-lg flex items-center justify-center border-2 border-accent-blue">
            <LocalVideo stream={cameraStream} />
          </div>
        </div>
        <div className="flex gap-4 mt-2">
          <button
            className="px-8 py-2 rounded-xl bg-gradient-to-r from-primary-blue to-accent-blue text-white font-bold shadow hover:from-accent-blue hover:to-primary-blue transition"
            onClick={endCall}
          >
            Închide apelul
          </button>
        </div>
      </div>
    );
  }

  // ------ Layout normal, fără partajare
  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-midnight via-darkblue to-almost-black py-8">
            <HeaderBar
            onSearchChange={setSearchQuery}
        inCall={true}
        endCall={endCall} 
      />
      <h3 className="text-3xl font-bold text-primary-blue mb-8 drop-shadow">WebRTC Video Chat</h3>
      <div className="flex flex-col md:flex-row gap-10 w-full max-w-3xl items-center justify-center mb-10">
        <div className="bg-darkblue rounded-2xl shadow-xl p-4 flex flex-col items-center w-full max-w-xs">
          <span className="mb-2 text-accent-blue font-semibold">Tu</span>
          <LocalVideo stream={cameraStream} />
        </div>
        <div className="bg-midnight rounded-2xl shadow-xl p-4 flex flex-col items-center w-full max-w-xs">
          <span className="mb-2 text-primary-blue font-semibold">{targetUser}</span>
          <RemoteVideo stream={remoteStream} />
        </div>
      </div>
      {(isInitiator || accepted) && (
        <div className="flex gap-4 mt-2">
          <button
            className="px-8 py-2 rounded-xl bg-gradient-to-r from-primary-blue to-accent-blue text-white font-bold shadow hover:from-accent-blue hover:to-primary-blue transition"
            onClick={endCall}
          >
            Închide apelul
          </button>
          <button
            className="px-5 py-2 rounded-xl bg-primary-blue hover:bg-accent-blue text-white font-bold shadow transition"
            onClick={handleShareScreen}
          >
            Partajează ecranul
          </button>
        </div>
      )}
      {!isInitiator && !accepted && (
        <div className="flex gap-4 mt-2">
          <button
            className="px-6 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow transition"
            onClick={handleAccept}
          >
            Acceptă
          </button>
          <button
            className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow transition"
            onClick={handleCancel}
          >
            Refuză
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoChat;
