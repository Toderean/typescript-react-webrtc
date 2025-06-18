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

  const peers = useRef<{ [user: string]: Peer.Instance }>({});
  const token = localStorage.getItem("token");
  const me = token ? (jwtDecode(token) as any).sub : "";

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(setLocalStream);
  }, []);

  useEffect(() => {
    const intv = setInterval(() => {
      getParticipants(callId).then((res) => {
        setParticipants(res.data.map((p: any) => p.user_id));
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

      const [offers, answers, ices, screens] = await Promise.all([
        getSignaling(callId, "offer", me),
        getSignaling(callId, "answer", me),
        getSignaling(callId, "ice", me),
        getSignaling(callId, "screen-share", me),
      ]);

      const allSignals = [...offers, ...answers, ...ices, ...screens];

      for (const sig of allSignals) {
        if (seenSignals.current.has(sig.id)) continue;
        seenSignals.current.add(sig.id);

        const sender = sig.sender;

        if (sig.type === "screen-share") {
          setActiveScreenSharer(sig.content === "start" ? sender : null);
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
      await sendSignaling(callId, "screen-share", "start");
      stream.getVideoTracks()[0].onended = handleStopShareScreen;
    } catch {
      setSharingScreen(false);
      setScreenStream(null);
    }
  };

  const handleStopShareScreen = async () => {
    setSharingScreen(false);
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
    await sendSignaling(callId, "screen-share", "stop");
  };

  const leaveGroup = async () => {
    Object.values(peers.current).forEach((p) => p.destroy());
    localStream?.getTracks().forEach((t) => t.stop());
    await leaveCall(callId);
    await deleteSignaling(callId);
    window.location.replace("/");
  };

  const isSharing = !!activeScreenSharer;
  const allUsers = [me, ...Object.keys(remotes).filter((u) => u !== me)];
  const columnUsers = activeScreenSharer === me
    ? Object.keys(remotes).filter((user) => user !== me)
    : [me, ...Object.keys(remotes).filter((user) => user !== me && user !== activeScreenSharer)];

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-midnight via-darkblue to-almost-black py-8">
      <HeaderBar onSearchChange={setSearchQuery} inCall={true} endCall={leaveGroup} />
      <h3 className="text-3xl font-bold text-primary-blue mb-8 drop-shadow">Group Video Chat</h3>
      <div className="flex flex-row gap-10 w-full max-w-6xl justify-center">
        <div className="flex-1 bg-darkblue rounded-2xl shadow-xl p-4 flex items-center justify-center min-h-[480px] max-h-[75vh] max-w-4xl">
          {isSharing ? (
            <div className="w-full flex justify-center items-center">
              {activeScreenSharer === me && screenStream ? (
                <video autoPlay playsInline muted className="max-w-[950px] max-h-[68vh] w-full h-full rounded-2xl bg-black" ref={(el) => {
                  if (el && screenStream) {
                    el.srcObject = screenStream;
                  }
                }} />
              ) : remotes[activeScreenSharer!] ? (
                <div className="max-w-[950px] max-h-[68vh] w-full h-full rounded-2xl bg-black flex items-center justify-center">
                  <VideoTileWithSpeaking stream={remotes[activeScreenSharer!]} username={activeScreenSharer!} />
                </div>
              ) : (
                <div className="w-[950px] h-[68vh] rounded-2xl bg-black flex items-center justify-center text-white">
                  Se așteaptă partajare...
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 w-full justify-center items-center">
              {allUsers.map((user) => (
                <div key={user} className="flex flex-col items-center">
                  <div className="w-60 h-44 rounded-2xl flex items-center justify-center">
                    <VideoTileWithSpeaking stream={user === me ? localStream : remotes[user]} username={user === me ? `${me} (tu)` : user} />
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
                  <VideoTileWithSpeaking stream={user === me ? localStream : remotes[user]} username={user === me ? `${me} (tu)` : user} />
                </div>
                <span className="text-center mt-1 font-bold text-white text-xs">{user === me ? `${me} (tu)` : user}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="text-center mt-6 flex gap-4 justify-center">
        <button className="px-8 py-2 rounded-xl bg-gradient-to-r from-primary-blue to-accent-blue text-white font-bold shadow hover:from-accent-blue hover:to-primary-blue transition" onClick={leaveGroup}>
          Părăsește grupul
        </button>
        {!sharingScreen ? (
          <button className="px-5 py-2 rounded-xl bg-primary-blue hover:bg-accent-blue text-white font-bold shadow transition" onClick={handleShareScreen}>
            Partajează ecranul
          </button>
        ) : (
          <button className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow transition" onClick={handleStopShareScreen}>
            Oprește partajarea
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoChatGroup;
