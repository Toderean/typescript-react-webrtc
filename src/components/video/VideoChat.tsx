import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import {
  getSignaling,
  deleteSignaling,
  joinCall,
  authHeaders,
  API_URL,
  SignalingType,
  getSignalingMerged,
  sendSignaling,
} from "../../api/signaling";
import LocalVideo from "./LocalVideo";
import RemoteVideo from "./RemoteVideo";
import { jwtDecode } from "jwt-decode";
import HeaderBar from "../HeaderBar";
import CallingAvatar from "../AvatarCalling";
import {
  generateSessionKey,
  exportSessionKeyB64,
  importSessionKeyB64,
  encryptWithSessionKey,
  decryptWithSessionKey,
  importPublicKeyFromPEM,
  importPrivateKeyFromPEM,
  encryptRSA,
  decryptRSA,
} from "../../api/cryptoUtils";
import axios from "axios";


interface Props {
  callId: string;
  isInitiator: boolean;
}



const getSignalingType = (data: any): SignalingType => {
  if (data.type === "offer") return "offer";
  if (data.type === "answer") return "answer";
  return "ice";
};


const VideoChat: React.FC<Props> = ({ callId, isInitiator }) => {
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [pendingAccept, setPendingAccept] = useState(false);
  const [peerPublicKey, setPeerPublicKey] = useState<CryptoKey | null>(null);
  const [myPrivateKey, setMyPrivateKey] = useState<CryptoKey | null>(null);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteScreenShare, setRemoteScreenShare] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [canAccept, setCanAccept] = useState(false);

  const peer = useRef<Peer.Instance | null>(null);
  const seenSignals = useRef<Set<number>>(new Set());
  const appliedOffer = useRef(false);
  const appliedAnswer = useRef(false);

  const token = localStorage.getItem("token");
  const me = token ? (jwtDecode(token) as any).sub : "";
  const parts = callId.split("_");
  const targetUser = parts.find((u) => u !== me);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((camStream) => {
        setCameraStream(camStream);
        setLocalStream(camStream);
        console.log("📷 Camera stream obținut:", camStream);
      })
      .catch(console.error);
  }, []);

  async function updateStatus(status: string) {
    try {
      await axios.post(`${API_URL}/users/status`, { status }, authHeaders());
    } catch (err) {
      console.error("❌ Eroare la actualizarea statusului:", err);
    }
  }

  useEffect(() => {
    const loadKeys = async () => {
      setLoadingKeys(true);
      const allUsers = await axios.get(`${API_URL}/users`, authHeaders());
      const myUser = allUsers.data.find((u: any) => u.username === me);
      const peerUser = allUsers.data.find((u: any) => u.username === targetUser);

      const pub = await importPublicKeyFromPEM(peerUser.public_key);
      const priv = await importPrivateKeyFromPEM(sessionStorage.getItem("privateKeyPEM")!);

      setPeerPublicKey(pub);
      setMyPrivateKey(priv);
      setLoadingKeys(false);
    };
    if (me && targetUser) loadKeys();
  }, [me, targetUser]);

  useEffect(() => {
    const loadExistingKey = async () => {
      const keyB64 = sessionStorage.getItem(`session_key_${callId}`);
      if (keyB64) {
        const key = await importSessionKeyB64(keyB64);
        setSessionKey(key);
        console.log("🔑 Inițiator: cheia de sesiune încărcată din sessionStorage.");
      } else {
        console.warn("⚠️ Inițiatorul nu are cheia în sessionStorage!");
      }
    };
  
    if (isInitiator && !sessionKey) {
      loadExistingKey();
    }
  }, [isInitiator, callId, sessionKey]);
  
  

  useEffect(() => {
    if (!isInitiator && myPrivateKey && !sessionKey && !loadingKeys) {
      const interval = setInterval(async () => {
        try {
          const sessionSignals = await getSignaling(callId, "session-key", me);
          if (!sessionSignals.length) return;
          const encryptedKey = sessionSignals[0].content;

          if (!encryptedKey) {
            console.warn("🔁 Încă aștept bucățile cheii de sesiune...");
            return;
          }
  
          console.info("🔐 Am primit cheia completă criptată:", encryptedKey.slice(0, 50) + "...");
  
          const decryptedB64: string = await decryptRSA(myPrivateKey, encryptedKey);
          const key: CryptoKey = await importSessionKeyB64(decryptedB64);
  
          setSessionKey(key);
          sessionStorage.setItem(`session_key_${callId}`, decryptedB64);
          setCanAccept(true);
  
          console.log("✅ Cheia de sesiune a fost setată cu succes.");
  
          if (pendingAccept) {
            setPendingAccept(false);
            handleAccept();
          }
  
          clearInterval(interval); 
        } catch (err) {
          console.error("❌ Eroare la decriptarea cheii de sesiune:", err);
        }
      }, 1000); 
  
      return () => clearInterval(interval);
    }
  }, [isInitiator, myPrivateKey, sessionKey, loadingKeys, me, callId, pendingAccept]);
  
  

  useEffect(() => {
    if (!cameraStream || !sessionKey) {
      console.log("⏳ Astept camera sau cheia de sesiune...");
      return;
    }
    const setupInitiator = async () => {
    if (isInitiator && !peer.current) {
      await updateStatus("in_call");
      console.log("✅ Inițiator: creez peer și trimit offer");
      joinCall(callId).catch((err) => console.error("❌ joinCall failed:", err));

      const p = new Peer({
        initiator: true,
        trickle: false,
        stream: cameraStream,
      });


  
      p.on("signal", async (data: any) => {
        try {
          const payload = await encryptWithSessionKey(
            sessionKey,
            JSON.stringify(data)
          );
          const type: SignalingType = getSignalingType(data);
          await sendSignaling(callId, type, payload, targetUser);
          console.log(`📡 Semnal trimis:`, { type, data });
        } catch (err) {
          console.error("❌ Eroare la trimiterea semnalului:", err);
        }
      });
  
      p.on("stream", (stream: MediaStream) => {
        console.log("🎥 Stream primit de la peer.");
        setRemoteStream(stream);
      });
  
      p.on("connect", () => {
        console.log("✅ Peer conectat");
      });
  
      p.on("error", (err) => {
        console.error("🔥 Eroare în Peer:", err);
      });
  
      peer.current = p;
    }
  };
  if (cameraStream && sessionKey) {
    setupInitiator(); 
  }
  }, [cameraStream, sessionKey, isInitiator, callId, targetUser]);
  

  const handleAccept = async () => {
    if (!cameraStream || !sessionKey) {
      setPendingAccept(true);
      return;
    }

    console.log("🔑 Cheie AES în callee (b64):", sessionStorage.getItem(`session_key_${callId}`));

  
    await joinCall(callId);

    await updateStatus("in_call");


    const offerSignals = await getSignaling(callId, "offer", me);
    if (!offerSignals.length) return;
    const offerRaw = offerSignals[0].content;
    
    console.log("📦 Oferta criptată (primii 100 chars):", offerRaw?.slice(0, 100) + "...");
    console.log("🔑 Cheia AES (base64):", await exportSessionKeyB64(sessionKey!));
    console.log("📏 Lungime oferta criptată:", offerRaw?.length);
  
    try {
      const decrypted = await decryptWithSessionKey(sessionKey, offerRaw);
      console.log("🔓 Decrypted offer string:", decrypted);
  
      let offer;
      try {
        offer = JSON.parse(decrypted);
      } catch (jsonErr) {
        console.error("❌ JSON.parse failed:", jsonErr);
        console.log("🔐 Cheia de sesiune:", sessionKey);
        console.log("📦 Oferta criptată primită:", offerRaw);
        console.log("🔓 Decrypted (INVALID JSON):", decrypted);
        return;
      }
  
      const p = new Peer({
        initiator: false,
        trickle: false,
        stream: cameraStream,
      });
  
      p.on("signal", async (data: any) => {
        console.log("📤 Signal generat:", data);
        const payload = await encryptWithSessionKey(sessionKey, JSON.stringify(data));
        const type: SignalingType = getSignalingType(data);
        await sendSignaling(callId, type, payload, targetUser);
      });
      
  
      p.on("stream", (stream: MediaStream) => setRemoteStream(stream));
      peer.current = p;
      p.signal(offer);
      appliedOffer.current = true;
      setAccepted(true);
  
    } catch (err) {
      console.error("❌ Eroare la decriptarea ofertei:", err);
      console.log("🔐 Cheia AES (CryptoKey):", sessionKey);
      console.log("📦 Oferta criptată completă:", offerRaw);

    }
  };
  

  useEffect(() => {
    const iv = setInterval(async () => {
      if (!cameraStream || !sessionKey) return;
      if (!isInitiator && !accepted) return;
  
      const [offerSignals, answerSignals, iceSignals, ends, screenShares] = await Promise.all([
        getSignaling(callId, "offer", me),
        getSignaling(callId, "answer", me),
        getSignaling(callId, "ice", me),
        getSignaling(callId, "end", me),
        getSignaling(callId, "screen-share", me),
      ]);
  
      if (ends.length) {
        alert("Celălalt utilizator a închis apelul.");
        await deleteSignaling(callId);
        window.location.href = "/";
        return;
      }
  
      // OFFER
      if (
        !isInitiator &&
        !appliedOffer.current &&
        offerSignals.length > 0 &&
        offerSignals[0].content
      ) {
        try {
          const decrypted = await decryptWithSessionKey(sessionKey, offerSignals[0].content);
          const offer = JSON.parse(decrypted);
  
          const p = new Peer({
            initiator: false,
            trickle: false,
            stream: cameraStream,
            config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
          });
  
          p.on("signal", async (data: any) => {
            const payload = await encryptWithSessionKey(sessionKey, JSON.stringify(data));
            const type: SignalingType = getSignalingType(data);
            await sendSignaling(callId, type, payload, targetUser);
          });
  
          p.on("stream", (stream: MediaStream) => setRemoteStream(stream));
          peer.current = p;
          p.signal(offer);
          appliedOffer.current = true;
        } catch (err) {
          console.error("❌ Eroare la procesarea offer-ului:", err);
        }
      }
  
      // ANSWER
      if (
        isInitiator &&
        !appliedAnswer.current &&
        answerSignals.length > 0 &&
        answerSignals[0].content &&
        peer.current
      ) {
        try {
          const decrypted = await decryptWithSessionKey(sessionKey, answerSignals[0].content);
          const answer = JSON.parse(decrypted);
          peer.current.signal(answer);
          appliedAnswer.current = true;
          setAccepted(true);
        } catch (err) {
          console.error("❌ Eroare la procesarea answer-ului:", err);
        }
      }
  
      // ICE
      if (peer.current && iceSignals.length > 0) {
        for (const iceSignal of iceSignals) {
          try {
            const decrypted = await decryptWithSessionKey(sessionKey, iceSignal.content);
            const ice = JSON.parse(decrypted);
            peer.current.signal(ice);
          } catch (err) {
            console.error("❌ Eroare la procesarea ICE:", err);
          }
        }
      }
  
      // SCREEN SHARE
      for (const sig of screenShares) {
        if (sig.content === "start") setRemoteScreenShare(true);
        if (sig.content === "stop") setRemoteScreenShare(false);
      }
    }, 1500);
  
    return () => clearInterval(iv);
  }, [cameraStream, accepted, callId, isInitiator, targetUser, sessionKey]);
  

  
  const handleShareScreen = async () => {
    try {
      const scrStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(scrStream);
      await sendSignaling(callId, "screen-share", "start", targetUser);

      const screenTrack = scrStream.getVideoTracks()[0];
      if (peer.current) {
        const videoSender = peer.current.streams[0].getTracks().find((t) => t.kind === "video");
        if (videoSender) {
          peer.current.replaceTrack(videoSender, screenTrack, peer.current.streams[0]);
        }
      }
      scrStream.getVideoTracks()[0].onended = handleStopShareScreen;
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
        const videoSender = peer.current.streams[0].getTracks().find((t) => t.kind === "video");
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
        <h3 className="text-3xl font-bold text-primary-blue mb-8 drop-shadow">
          WebRTC Video Chat
        </h3>
        <div className="flex flex-row w-full max-w-6xl items-center justify-center mb-10 gap-10">
          <div className="flex-1 bg-darkblue rounded-2xl shadow-xl p-2 flex items-center justify-center min-h-[400px]">
            <video
              autoPlay
              playsInline
              muted
              className="w-full h-full rounded-2xl"
              ref={(el) => {
                if (el && screenStream) el.srcObject = screenStream;
              }}
            />
          </div>
          <div className="flex flex-col gap-6 min-w-[300px]">
            <div className="bg-midnight rounded-2xl shadow-xl p-2 flex flex-col items-center">
              <span className="mb-2 text-accent-blue font-semibold">Tu</span>
              <LocalVideo stream={cameraStream} />
            </div>
            <div className="bg-midnight rounded-2xl shadow-xl p-2 flex flex-col items-center">
              <span className="mb-2 text-primary-blue font-semibold">
                {targetUser}
              </span>
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
        <h3 className="text-3xl font-bold text-primary-blue mb-8 drop-shadow">
          WebRTC Video Chat
        </h3>
        <div
          className="relative w-full flex justify-center items-center mb-10"
          style={{ minHeight: 500 }}
        >
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
      <h3 className="text-3xl font-bold text-primary-blue mb-8 drop-shadow">
        WebRTC Video Chat
      </h3>
      <div className="flex flex-col md:flex-row gap-10 w-full max-w-3xl items-center justify-center mb-10">
        <div className="bg-darkblue rounded-2xl shadow-xl p-4 flex flex-col items-center w-full max-w-xs">
          <span className="mb-2 text-accent-blue font-semibold">Tu</span>
          <LocalVideo stream={cameraStream} />
        </div>
        <div className="bg-midnight rounded-2xl shadow-xl p-4 flex flex-col items-center w-full max-w-xs">
          <span className="mb-2 text-primary-blue font-semibold">
            {targetUser}
          </span>
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
          {canAccept ? (
            <button
            className="px-6 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow transition"
            onClick={handleAccept}
          >
            Acceptă
          </button>
          ) : (
            <p>🔐 Aștept cheia de sesiune...</p>
          )}
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
