import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import {
  getSignaling,
  deleteSignaling,
  leaveCall,
  getParticipants,
  sendSignaling,
  getPublicKey,
  getSessionKey,
  API_URL,
  authHeaders,
} from "../../api/signaling";
import { jwtDecode } from "jwt-decode";
import HeaderBar from "../HeaderBar";
import VideoTileWithSpeaking from "../VideoTileWithSpeaking";
import {
  importSessionKeyB64,
  encryptWithSessionKey,
  decryptWithSessionKey,
  importPublicKeyFromPEM,
  importPrivateKeyFromPEM,
  decryptRSA,
} from "../../api/cryptoUtils";
import axios from "axios";
import {
  MdMic,
  MdMicOff,
  MdVideocam,
  MdVideocamOff,
  MdScreenShare,
  MdCallEnd,
} from "react-icons/md";
import LocalVideo from "../video/LocalVideo";
import RemoteVideo from "../video/RemoteVideo";


const MicIcon = MdMic as React.FC;
const MicOffIcon = MdMicOff as React.FC;
const VideoIcon = MdVideocam as React.FC;
const VideoOffIcon = MdVideocamOff as React.FC;
const ShareIcon = MdScreenShare as React.FC;
const EndCallIcon = MdCallEnd as React.FC;


interface Props {
  callId: string;
}

const VideoChatGroup: React.FC<Props> = ({ callId }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<{ [user: string]: MediaStream }>({});
  const [participants, setParticipants] = useState<string[]>([]);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [activeScreenSharer, setActiveScreenSharer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [peerPublicKeys, setPeerPublicKeys] = useState<{ [user: string]: CryptoKey }>({});
  const [myPrivateKey, setMyPrivateKey] = useState<CryptoKey | null>(null);
  const seenSignals = useRef<Set<number>>(new Set());
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [remoteCameraOff, setRemoteCameraOff] = useState<{ [user: string]: boolean }>({});
  



  const peers = useRef<{ [user: string]: Peer.Instance }>({});
  const token = localStorage.getItem("token");
  const me = token ? (jwtDecode(token) as any).sub : "";

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(setLocalStream);
  }, []);

  async function updateStatus(status: string) {
    try {
      await axios.post(`${API_URL}/users/status`, { status }, authHeaders());
    } catch (err) {
      console.error("Eroare la actualizarea statusului:", err);
    }
  }

  useEffect(() => {
    const intv = setInterval(() => {
      getParticipants(callId).then(async (res) => {
        const userIds = res.data.map((p: any) => p.user_id);
        setParticipants(userIds);
      
        if (userIds.includes(me)) {
          await updateStatus("in_call");
        }
      });
      
    }, 2000);
    return () => clearInterval(intv);
  }, [callId]);

  useEffect(() => {
    const loadKeys = async () => {
      const pubKeys: any = {};
      for (const user of participants) {
        if (user === me) continue;
        try {
          const pem = await getPublicKey(user);
          pubKeys[user] = await importPublicKeyFromPEM(pem);
        } catch (err) {
          console.error(`❌ Eroare la obținerea/importul cheii publice pentru ${user}:`, err);
        }
      }
      const privPEM = sessionStorage.getItem("privateKeyPEM");
      if (!privPEM) {
        console.error("❌ Nu există cheia privată în sessionStorage");
        return;
      }
      const priv = await importPrivateKeyFromPEM(privPEM);
      setPeerPublicKeys(pubKeys);
      setMyPrivateKey(priv);
    };
    if (participants.includes(me)) loadKeys();
  }, [participants]);

  useEffect(() => {
    if (!localStream || !peerPublicKeys || !myPrivateKey) return;
    (async () => {
      if (!sessionKey) {
        try {
          const res = await getSessionKey(callId);
          const imported = await importSessionKeyB64(res.data.session_key);
          setSessionKey(imported);

        } catch (err) {
          console.error("❌ Eroare la decriptarea cheii de sesiune:", err);
        }
      }
    })();
  }, [callId, sessionKey, myPrivateKey]);

  useEffect(() => {
    if (!localStream || !sessionKey) return;
    participants.forEach((user) => {
      if (user === me || peers.current[user]) return;
      const initiator = me < user;

      if (initiator) {
        const p = new Peer({
          initiator: true,
          trickle: false,
          stream: localStream,
          config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
        });

        p.on("signal", async (data: any) => {
          const payload = await encryptWithSessionKey(sessionKey, JSON.stringify(data));
          const type = data.type === "offer" || data.type === "answer" ? data.type : "ice";
          await sendSignaling(callId, type, payload, user);
        });

        p.on("stream", (stream) => {
          setRemotes((prev) => ({ ...prev, [user]: stream }));
        });

        peers.current[user] = p;
      }
    });
  }, [participants, sessionKey, localStream]);

  useEffect(() => {
    const poll = setInterval(async () => {
      if (!sessionKey || !localStream) return;

      const [offers, answers, ices, screens, cameras] = await Promise.all([
        getSignaling(callId, "offer", me),
        getSignaling(callId, "answer", me),
        getSignaling(callId, "ice", me),
        getSignaling(callId, "screen-share", me),
        getSignaling(callId, "camera", me),
      ]);
      

      const allSignals = [...offers, ...answers, ...ices, ...screens, ...cameras];

      for (const sig of allSignals) {
        if (seenSignals.current.has(sig.id)) continue;
        seenSignals.current.add(sig.id);

        const sender = sig.sender;

        if (sig.type === "screen-share") {
          console.log(`📺 Semnal screen-share primit de la ${sender}: ${sig.content}`);

          if (sig.content === "start") {
            setActiveScreenSharer(sender);
            setSharingScreen(true); 
          } else {
            setActiveScreenSharer(null);
            setSharingScreen(false); 
          }
          continue;
        }
        

        try {
          const decrypted = await decryptWithSessionKey(sessionKey, sig.content);
          const signal = JSON.parse(decrypted);

          if (!peers.current[sender]) {
            const p = new Peer({
              initiator: false,
              trickle: false,
              stream: localStream,
              config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
            });

            p.on("signal", async (data: any) => {
              const payload = await encryptWithSessionKey(sessionKey, JSON.stringify(data));
              const type = data.type === "offer" || data.type === "answer" ? data.type : "ice";
              await sendSignaling(callId, type, payload, sender);
            });

            p.on("stream", (stream) => {
              setRemotes((prev) => ({ ...prev, [sender]: stream }));
            });

            peers.current[sender] = p;
            p.signal(signal);
          } else {
            peers.current[sender].signal(signal);
          }
        } catch (err) {
          console.error("❌ Eroare la decriptarea semnalului:", err);
        }
      }

      for (const sig of cameras) {
        setRemoteCameraOff((prev) => ({
          ...prev,
          [sig.sender]: sig.content === "off",
        }));
      }
    }, 1200);

    return () => clearInterval(poll);
  }, [participants, sessionKey, localStream]);
  
  

  const handleShareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(stream);
      setSharingScreen(true);
      setActiveScreenSharer(me);
      for (const user in peers.current) {
        const sender = peers.current[user].streams[0].getTracks().find((t) => t.kind === "video");
        if (sender) {
          peers.current[user].replaceTrack(sender, stream.getVideoTracks()[0], peers.current[user].streams[0]);
        }
      }
      for (const user of participants) {
        if (user !== me) {
          await sendSignaling(callId, "screen-share", "start", user);
        }
      }      
      stream.getVideoTracks()[0].onended = handleStopShareScreen;
    } catch {
      setSharingScreen(false);
      setScreenStream(null);
    }
  };

  const handleStopShareScreen = async () => {
    if (activeScreenSharer === me) {
      setSharingScreen(false);
      setActiveScreenSharer(null);
    }
    setScreenStream(null);
    setActiveScreenSharer(null);
    const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(camStream);
    for (const user in peers.current) {
      const sender = peers.current[user].streams[0].getTracks().find((t) => t.kind === "video");
      if (sender) {
        peers.current[user].replaceTrack(sender, camStream.getVideoTracks()[0], peers.current[user].streams[0]);
      }
    }
    for (const user of participants) {
      if (user !== me) {
        await sendSignaling(callId, "screen-share", "stop", user);
      }
    }
  };

  const leaveGroup = async () => {
    Object.values(peers.current).forEach((p) => p.destroy());
    localStream?.getTracks().forEach((t) => t.stop());
    await leaveCall(callId);
    await deleteSignaling(callId);
    window.location.replace("/");
  };

  const isSharing = !!activeScreenSharer;
  const allUsers = [me, ...participants.filter((u) => u !== me && remotes[u])];
  const columnUsers = activeScreenSharer === me
  ? participants.filter((u) => u !== me && remotes[u])
  : [me, ...participants.filter((u) => u !== me && u !== activeScreenSharer && remotes[u])];

    const toggleMic = () => {
      if (!localStream) return;
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicOn(audioTrack.enabled);
      }
    };
    
    const toggleVideo = async () => {
      if (!localStream) return;
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoOn(videoTrack.enabled);
        await sendSignaling(callId, "camera", videoTrack.enabled ? "on" : "off");
      }
    };
    
    const shouldShowAvatar = (user: string): boolean => {
      if (user === me) return !videoOn;
    
      const remoteStream = remotes[user];
      const remoteOff = remoteCameraOff[user];
    
      if (!remoteStream) return true;
    
      const videoTrack = remoteStream.getVideoTracks()[0];
      return remoteOff || !videoTrack?.enabled;
    };
    
    

    return (
      <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-midnight via-darkblue to-almost-black py-8">
        <h3 className="text-3xl font-bold text-primary-blue mb-8 drop-shadow">Group Video Chat</h3>
    
        <div className="flex flex-row gap-10 w-full max-w-[95vw] justify-center">
          <div className="flex-1 bg-darkblue rounded-2xl shadow-xl p-4 flex items-center justify-center min-h-[600px] h-[75vh] max-w-[90vw] w-full">
            {isSharing ? (
              <div className="w-full flex justify-center items-center">
                {activeScreenSharer === me && screenStream ? (
                  <video
                    autoPlay
                    playsInline
                    muted
                    className="max-w-[950px] max-h-[68vh] w-full h-full rounded-2xl bg-black"
                    ref={(el) => {
                      if (el && screenStream) el.srcObject = screenStream;
                    }}
                  />
                ) : remotes[activeScreenSharer!] ? (
                  <video
                    autoPlay
                    playsInline
                    muted={activeScreenSharer === me}
                    className="max-w-[950px] max-h-[68vh] w-full h-full rounded-2xl bg-black"
                    ref={(el) => {
                      if (el && remotes[activeScreenSharer!]) el.srcObject = remotes[activeScreenSharer!];
                    }}
                  />
                ) : (
                  <div className="w-[950px] h-[68vh] rounded-2xl bg-black flex items-center justify-center text-white">
                    Se așteaptă partajare...
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full h-full justify-center items-center">
                {allUsers.map((user) => (
                  <div key={user} className="flex flex-col items-center">
                    <div className="w-72 h-52 rounded-2xl flex items-center justify-center">
                      {shouldShowAvatar(user) ? (
                        <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center text-white text-5xl font-bold shadow-xl">
                          {user?.[0]?.toUpperCase() ?? "?"}
                        </div>
                      ) : user === me ? (
                        <LocalVideo stream={localStream} />
                      ) : (
                        <RemoteVideo stream={remotes[user]} />
                      )}
                    </div>
                    <span className="text-center mt-1 font-bold text-white text-xs">{user === me ? `${me} (tu)` : user}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
    
          {isSharing && (
            <div className="w-72 flex flex-col items-center bg-midnight rounded-2xl shadow-lg p-4 gap-4 max-h-[72vh] overflow-y-auto">
              {columnUsers.map((user) => (
                <div key={user} className="flex flex-col items-center">
                  <div className="w-36 h-28 rounded-xl flex items-center justify-center">
                    {shouldShowAvatar(user) ? (
                      <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center text-white text-5xl font-bold shadow-xl">
                        {user?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    ) : user === me ? (
                      <LocalVideo stream={localStream} />
                    ) : (
                      <RemoteVideo stream={remotes[user]} />
                    )}
                  </div>
                  <span className="text-center mt-1 font-bold text-white text-xs">{user === me ? `${me} (tu)` : user}</span>
                </div>
              ))}
            </div>
          )}
        </div>
    
        <div className="text-center mt-6 flex gap-6 justify-center">
          <button
            className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white shadow transition"
            title="Părăsește grupul"
            onClick={leaveGroup}
          >
            <EndCallIcon />
          </button>
    
          {!sharingScreen ? (
            <button
              className="p-3 rounded-full bg-primary-blue hover:bg-accent-blue text-white shadow transition"
              title="Partajează ecranul"
              onClick={handleShareScreen}
            >
              <ShareIcon />
            </button>
          ) : (
            <button
              className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white shadow transition"
              title="Oprește partajarea"
              onClick={handleStopShareScreen}
            >
              <ShareIcon />
            </button>
          )}
    
          <button
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white shadow transition"
            title={micOn ? "Oprește microfonul" : "Pornește microfonul"}
            onClick={toggleMic}
          >
            {micOn ? <MicIcon /> : <MicOffIcon />}
          </button>
    
          <button
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white shadow transition"
            title={videoOn ? "Oprește camera" : "Pornește camera"}
            onClick={toggleVideo}
          >
            {videoOn ? <VideoIcon /> : <VideoOffIcon />}
          </button>
        </div>
      </div>
    );
    
};

export default VideoChatGroup;
