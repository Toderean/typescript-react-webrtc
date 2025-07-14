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
import { MdMic, MdMicOff, MdVideocam, MdVideocamOff, MdScreenShare, MdCallEnd } from "react-icons/md";



interface Props {
  callId: string;
  isInitiator: boolean;
}

const MicIcon = MdMic as React.FC;
const MicOffIcon = MdMicOff as React.FC;
const VideoIcon = MdVideocam as React.FC;
const VideoOffIcon = MdVideocamOff as React.FC;
const ShareIcon = MdScreenShare as React.FC;
const EndCallIcon = MdCallEnd as React.FC;



const getSignalingType = (data: any): SignalingType => {
  if (data.type === "offer") return "offer";
  if (data.type === "answer") return "answer";
  return "ice";
};


const VideoChat: React.FC<Props> = ({ callId, isInitiator }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
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
  const [remoteCameraOff, setRemoteCameraOff] = useState(false);


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
      })
      .catch(console.error);
  }, []);

  async function updateStatus(status: string) {
    try {
      await axios.post(`${API_URL}/users/status`, { status }, authHeaders());
    } catch (err) {
      console.error("Eroare la actualizarea statusului:", err);
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
      } else {
        console.warn("initiatorul nu are cheia in sessionStorage!");
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
            console.warn("astept bucatile din cheia de sesiune...");
            return;
          }
          const decryptedB64: string = await decryptRSA(myPrivateKey, encryptedKey);
          const key: CryptoKey = await importSessionKeyB64(decryptedB64);
          
          console.info("cheia AES decriptată:", decryptedB64);

          setSessionKey(key);
          sessionStorage.setItem(`session_key_${callId}`, decryptedB64);
          setCanAccept(true);  
          if (pendingAccept) {
            setPendingAccept(false);
            handleAccept();
          }
          clearInterval(interval); 
        } catch (err) {
          console.error("Eroare la decriptarea cheii de sesiune:", err);
        }
      }, 1000); 
  
      return () => clearInterval(interval);
    }
  }, [isInitiator, myPrivateKey, sessionKey, loadingKeys, me, callId, pendingAccept]);
  
  

  useEffect(() => {
    if (!cameraStream || !sessionKey) {
      return;
    }
    const setupInitiator = async () => {
    if (isInitiator && !peer.current) {
      await updateStatus("in_call");
      joinCall(callId).catch((err) => console.error("joinCall failed:", err));

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
          console.log("Encrypted SDP offer (initiator):", payload); 
          await sendSignaling(callId, type, payload, targetUser);
        } catch (err) {
          console.error("Eroare la trimiterea semnalului:", err);
        }
      });
  
      p.on("stream", (stream: MediaStream) => {
        setRemoteStream(stream);
      });
  
      p.on("connect", () => {
      });
  
      p.on("error", (err) => {
        console.error("eroare în Peer:", err);
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
    await joinCall(callId);
    await updateStatus("in_call");
    const offerSignals = await getSignaling(callId, "offer", me);
    if (!offerSignals.length) return;
    const offerRaw = offerSignals[0].content;
    try {
      const decrypted = await decryptWithSessionKey(sessionKey, offerRaw);
      let offer;
      try {
        offer = JSON.parse(decrypted);
      } catch (jsonErr) {
        console.error("JSON.parse failed:", jsonErr);
        return;
      }
      const p = new Peer({
        initiator: false,
        trickle: false,
        stream: cameraStream,
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
      setAccepted(true);
  
    } catch (err) {
      console.error("Eroare la decriptarea ofertei:", err);
    }
  };
  

  useEffect(() => {
    const iv = setInterval(async () => {
      if (!cameraStream || !sessionKey) return;
      if (!isInitiator && !accepted) return;
  
      const [offerSignals, answerSignals, iceSignals, ends, screenShares, cameraSignals] = await Promise.all([
        getSignaling(callId, "offer", me),
        getSignaling(callId, "answer", me),
        getSignaling(callId, "ice", me),
        getSignaling(callId, "end", me),
        getSignaling(callId, "screen-share", me),
        getSignaling(callId, "camera", me),
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
          console.error("Eroare la procesarea offer-ului:", err);
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
          console.log("Decrypted SDP answer:", decrypted);
          const answer = JSON.parse(decrypted);
          peer.current.signal(answer);
          appliedAnswer.current = true;
          setAccepted(true);
        } catch (err) {
          console.error("Eroare la procesarea answer-ului:", err);
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
            console.error("Eroare la procesarea ICE:", err);
          }
        }
      }
      // SCREEN SHARE
      for (const sig of screenShares) {
        if (sig.content === "start") setRemoteScreenShare(true);
        if (sig.content === "stop") setRemoteScreenShare(false);
      }

      // CAMERA
      for (const sig of cameraSignals) {
        if (sig.content === "on") setRemoteCameraOff(false);
        if (sig.content === "off") setRemoteCameraOff(true);
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
    peer.current?.destroy();
    cameraStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    await sendSignaling(callId, "end", "", targetUser);
    setTimeout(() => {
      deleteSignaling(callId);
    }, 3000);
    
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
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-midnight via-darkblue to-almost-black py-8 px-4">
        <h3 className="text-3xl font-bold text-primary-blue mb-6 text-center">
          WebRTC Video Chat
        </h3>
    
        <div className="flex flex-col lg:flex-row gap-4 w-full h-[80vh]">
          <div className="flex-1 bg-black rounded-2xl overflow-hidden shadow-lg flex items-center justify-center">
            <video
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
              ref={(el) => {
                if (el && screenStream) el.srcObject = screenStream;
              }}
            />
          </div>
    
          <div className="flex flex-col gap-4 w-full lg:w-[420px]">
            <div className="flex-1 bg-darkblue rounded-2xl shadow-lg p-2 flex flex-col items-center">
              <span className="mb-2 text-accent-blue font-semibold">Tu</span>
              <LocalVideo stream={cameraStream} />
            </div>
    
            <div className="flex-1 bg-midnight rounded-2xl shadow-lg p-2 flex flex-col items-center">
              <span className="mb-2 text-primary-blue font-semibold">{targetUser}</span>
              {remoteStream ? (
                <RemoteVideo stream={remoteStream} />
              ) : (
                <div className="w-64 h-48 bg-gray-700 rounded-full flex items-center justify-center text-white text-6xl font-bold shadow-xl">
                  {targetUser?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
          </div>
        </div>
    
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={() => {
              const audioTrack = peer.current?.streams[0]
                ?.getAudioTracks()
                ?.find((t) => t.kind === "audio");
            
              if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
              }
            }}
            
            className={`p-3 rounded-full text-white text-xl shadow transition ${
              isMuted ? "bg-yellow-600 hover:bg-yellow-700" : "bg-primary-blue hover:bg-accent-blue"
            }`}
          >
            {isMuted ? <MicOffIcon /> : <MicIcon />}
          </button>
    
          <button
            onClick={() => {
              const video = cameraStream?.getVideoTracks()[0];
              if (video) {
                video.enabled = !video.enabled;
                setIsCameraOff(!video.enabled);
              }
            }}
            className={`p-3 rounded-full text-white text-xl shadow transition ${
              isCameraOff ? "bg-yellow-600 hover:bg-yellow-700" : "bg-primary-blue hover:bg-accent-blue"
            }`}
          >
            {isCameraOff ? <VideoOffIcon /> : <VideoIcon />}
          </button>
    
          <button
            onClick={handleStopShareScreen}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-xl shadow"
          >
            <ShareIcon />
          </button>
    
          <button
            onClick={endCall}
            className="p-3 rounded-full bg-red-700 hover:bg-red-800 text-white text-xl shadow"
          >
            <EndCallIcon />
          </button>
        </div>
      </div>
    );
    
  }

  // ------ layout pentru "cel care priveste" (remote screen share activ)
  if (isRemoteScreenSharing) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-midnight via-darkblue to-almost-black py-8 px-4">
        <h3 className="text-3xl font-bold text-primary-blue mb-6 text-center">
          WebRTC Video Chat
        </h3>
    
        <div className="flex flex-col lg:flex-row gap-4 w-full h-[80vh]">
          <div className="flex-1 bg-black rounded-2xl overflow-hidden shadow-lg flex items-center justify-center">
            <RemoteVideo stream={remoteStream} />
          </div>
    
          <div className="flex flex-col gap-4 w-full lg:w-[420px]">
            <div className="flex-1 bg-darkblue rounded-2xl shadow-lg p-2 flex flex-col items-center">
              <span className="mb-2 text-accent-blue font-semibold">Tu</span>
              <LocalVideo stream={cameraStream} />
            </div>
    
            <div className="flex-1 bg-midnight rounded-2xl shadow-lg p-2 flex flex-col items-center justify-center">
              <span className="text-primary-blue font-semibold">{targetUser}</span>
              <span className="text-white mt-2 text-sm opacity-70">Partajează ecranul</span>
            </div>
          </div>
        </div>
    
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={() => {
              const audioTrack = peer.current?.streams[0]
                ?.getAudioTracks()
                ?.find((t) => t.kind === "audio");
            
              if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
              }
            }}
            
            className={`p-3 rounded-full text-white text-xl shadow transition ${
              isMuted ? "bg-yellow-600 hover:bg-yellow-700" : "bg-primary-blue hover:bg-accent-blue"
            }`}
          >
            {isMuted ? <MicOffIcon /> : <MicIcon />}
          </button>
    
          <button
            onClick={() => {
              const videoTrack = peer.current?.streams[0]
                ?.getVideoTracks()
                ?.find((t) => t.kind === "video");
            
              if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraOff(!videoTrack.enabled);
              }
            }}
            
            className={`p-3 rounded-full text-white text-xl shadow transition ${
              isCameraOff ? "bg-yellow-600 hover:bg-yellow-700" : "bg-primary-blue hover:bg-accent-blue"
            }`}
          >
            {isCameraOff ? <VideoOffIcon /> : <VideoIcon />}
          </button>
    
          <button
            onClick={endCall}
            className="p-3 rounded-full bg-red-700 hover:bg-red-800 text-white text-xl shadow"
          >
            <EndCallIcon />
          </button>
        </div>
      </div>
    );
    
  }

  // ------ Layout normal, fără partajare
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-midnight via-darkblue to-almost-black py-8 px-4">
      <h3 className="text-3xl font-bold text-primary-blue mb-8 drop-shadow text-center">
        WebRTC Video Chat
      </h3>
  
      <div className="flex flex-col md:flex-row w-full h-[75vh] gap-4">
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center relative bg-darkblue rounded-2xl shadow-lg p-4">
          <span className="mb-2 text-accent-blue font-semibold">Tu</span>
            {!isCameraOff && localStream ? (
              <LocalVideo stream={localStream} />
            ):  (
            <div className="w-64 h-48 bg-gray-700 rounded-full flex items-center justify-center text-white text-6xl font-bold shadow-xl">
              {me?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
  
          <div className="absolute bottom-6 flex gap-3">
            <button
              onClick={() => {
                const audioTrack = peer.current?.streams[0]
                  ?.getAudioTracks()
                  ?.find((t) => t.kind === "audio");
              
                if (audioTrack) {
                  audioTrack.enabled = !audioTrack.enabled;
                  setIsMuted(!audioTrack.enabled);
                }
              }}
              
              className={`p-3 rounded-full text-white text-xl shadow transition ${
                isMuted ? "bg-yellow-600 hover:bg-yellow-700" : "bg-primary-blue hover:bg-accent-blue"
              }`}
            >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
            </button>
  
            <button
              onClick={async () => {
                const videoTrack = peer.current?.streams[0]
                  ?.getVideoTracks()
                  ?.find((t) => t.kind === "video");
              
                  if (videoTrack) {
                    videoTrack.enabled = !videoTrack.enabled;
                    setIsCameraOff(!videoTrack.enabled);
                    await sendSignaling(callId, "camera", videoTrack.enabled ? "on" : "off", targetUser);
                  }
              }}              
              className={`p-3 rounded-full text-white text-xl shadow transition ${
                isCameraOff ? "bg-yellow-600 hover:bg-yellow-700" : "bg-primary-blue hover:bg-accent-blue"
              }`}
            >
              {isCameraOff ? <VideoOffIcon /> : <VideoIcon />}
            </button>
  
            <button
              onClick={handleShareScreen}
              className="p-3 rounded-full bg-primary-blue hover:bg-accent-blue text-white text-xl shadow"
            >
              <ShareIcon />
            </button>
  
            <button
              onClick={endCall}
              className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-xl shadow"
            >
              <EndCallIcon />
            </button>
          </div>
        </div>
  
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center bg-midnight rounded-2xl shadow-lg p-4">
          <span className="mb-2 text-primary-blue font-semibold">{targetUser}</span>
          {!remoteCameraOff ? (
            <RemoteVideo stream={remoteStream} />
          ) : (
            <div className="w-64 h-48 bg-gray-700 rounded-full flex items-center justify-center text-white text-6xl font-bold shadow-xl">
              {targetUser?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          {!isInitiator && !accepted && (
            <div className="mt-6 flex gap-4">
              {canAccept ? (
                <button
                  className="px-6 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow transition"
                  onClick={handleAccept}
                >
                  Acceptă
                </button>
              ) : (
                <p className="text-white">Aștept cheia de sesiune...</p>
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
      </div>
    </div>
  );
  
};

export default VideoChat;
