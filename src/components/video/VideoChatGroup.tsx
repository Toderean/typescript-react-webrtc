import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { sendSignaling, getSignaling, deleteSignaling, joinCall, leaveCall, getParticipants } from "../../api/signaling";
import LocalVideo from "./LocalVideo";
import RemoteVideo from "./RemoteVideo";
import { jwtDecode } from "jwt-decode";

interface SignalingData {
  id: number;
  sender: string;
  content: string;
  type: string;
  target_user: string;
}

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

  const peers = useRef<{ [user: string]: Peer.Instance }>({});
  const seenSignals = useRef<Set<number>>(new Set());
  const token = localStorage.getItem("token");
  const me = token ? (jwtDecode(token) as any).sub : "";

  // 1. Local video
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((s) => setLocalStream(s))
      .catch(console.error);
  }, []);

  // 2. Participanți polling
  useEffect(() => {
    const intv = setInterval(() => {
      getParticipants(callId).then((res) => {
        setParticipants(res.data.map((p: any) => p.user_id));
      });
    }, 2000);
    return () => clearInterval(intv);
  }, [callId]);

  // 3. Peer connections
  useEffect(() => {
    if (!localStream || participants.length === 0) return;
    participants.forEach((user) => {
      if (user === me) return;
      if (peers.current[user]) return;
      const initiator = me < user;
      if (initiator) {
        const p = new Peer({
          initiator: true,
          trickle: false,
          stream: localStream,
          config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
        });

        p.on("signal", async (data: any) => {
          await sendSignaling(
            callId,
            data.type === "offer" || data.type === "answer" ? data.type : "ice",
            JSON.stringify(data),
            user
          );
        });

        p.on("stream", (stream: MediaStream) => {
          setRemotes((rem) => ({ ...rem, [user]: stream }));
        });

        p.on("error", err => {
          console.error(`[${me}] Peer error with ${user}:`, err);
        });

        peers.current[user] = p;
      }
    });
  }, [participants, localStream, me, callId]);

  // 4. Poll signaling (screen share detection)
  useEffect(() => {
    const intv = setInterval(async () => {
      for (let user of participants) {
        if (user === me) continue;

        const offers: SignalingData[] = await getSignaling(callId, "offer", me);
        const answers: SignalingData[] = await getSignaling(callId, "answer", me);
        const ices: SignalingData[] = await getSignaling(callId, "ice", me);
        const screens: SignalingData[] = await getSignaling(callId, "screen-share", me);

        // Screen-share signaling: dacă cineva începe partajarea
        screens
          .filter((sig: any) => !seenSignals.current.has(sig.id))
          .forEach((sig: any) => {
            seenSignals.current.add(sig.id);
            if (sig.content === "start") {
              setActiveScreenSharer(sig.sender);
            }
            if (sig.content === "stop") {
              setActiveScreenSharer((prev) => (prev === sig.sender ? null : prev));
            }
          });

        // restul semnalelor ca înainte (offer, answer, ice)
        offers.filter((sig) => sig.sender === user && !seenSignals.current.has(sig.id)).forEach((sig) => {
          if (!peers.current[user]) {
            const p = new Peer({
              initiator: false,
              trickle: false,
              stream: localStream!,
              config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
            });

            p.on("signal", async (data: any) => {
              await sendSignaling(
                callId,
                data.type === "offer" || data.type === "answer" ? data.type : "ice",
                JSON.stringify(data),
                user
              );
            });

            p.on("stream", (stream: MediaStream) => {
              setRemotes((rem) => ({ ...rem, [user]: stream }));
            });

            p.on("error", err => {
              console.error(`[${me}] Peer error with ${user}:`, err);
            });

            peers.current[user] = p;
          }
          peers.current[user].signal(JSON.parse(sig.content));
          seenSignals.current.add(sig.id);
        });

        answers.filter((sig) => sig.sender === user && !seenSignals.current.has(sig.id)).forEach((sig) => {
          if (peers.current[user]) {
            peers.current[user].signal(JSON.parse(sig.content));
            seenSignals.current.add(sig.id);
          }
        });

        ices.filter((sig) => sig.sender === user && !seenSignals.current.has(sig.id)).forEach((sig) => {
          if (peers.current[user]) {
            peers.current[user].signal(JSON.parse(sig.content));
            seenSignals.current.add(sig.id);
          }
        });
      }
    }, 1200);
    return () => clearInterval(intv);
  }, [participants, me, callId, localStream]);

  // 5. Partajare ecran
  const handleShareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(stream);
      setSharingScreen(true);
      setActiveScreenSharer(me);

      Object.values(peers.current).forEach((p) => {
        const sender = p.streams[0].getTracks().find((t) => t.kind === "video");
        if (sender) {
          p.replaceTrack(sender, stream.getVideoTracks()[0], p.streams[0]);
        }
      });

      await sendSignaling(callId, "screen-share", "start");

      stream.getVideoTracks()[0].onended = async () => {
        handleStopShareScreen();
      };
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

    Object.values(peers.current).forEach((p) => {
      const sender = p.streams[0].getTracks().find((t) => t.kind === "video");
      if (sender) {
        p.replaceTrack(sender, camStream.getVideoTracks()[0], p.streams[0]);
      }
    });
    await sendSignaling(callId, "screen-share", "stop");
  };

  // 6. Ieșire din apel
  const leaveGroup = async () => {
    Object.values(peers.current).forEach(p => p.destroy());
    localStream?.getTracks().forEach(t => t.stop());
    await leaveCall(callId);
    await deleteSignaling(callId);
    window.location.href = "/";
  };

  // === LAYOUT LOGIC ===
  let mainContent = null;
  if (activeScreenSharer) {
    if (activeScreenSharer === me && screenStream) {
      mainContent = (
        <div className="w-full flex justify-center">
          <video
            autoPlay
            playsInline
            muted
            className="max-w-[900px] max-h-[65vh] w-full h-full rounded-2xl"
            ref={el => {
              if (el && screenStream) el.srcObject = screenStream;
            }}
          />
        </div>
      );
    } else if (remotes[activeScreenSharer]) {
      mainContent = (
        <div className="w-full flex justify-center">
          <div className="max-w-[900px] max-h-[65vh] w-full h-full rounded-2xl overflow-hidden flex items-center justify-center bg-darkblue">
            {/* Nu poți da className direct pe RemoteVideo, deci îl pui într-un div */}
            <RemoteVideo stream={remotes[activeScreenSharer]} />
          </div>
        </div>
      );
    }
  }

  // grid camere (toți userii)
  const cameraTiles = [
    <div key={me} className="mb-4 flex flex-col items-center">
      <LocalVideo stream={localStream} />
      <span className="text-center mt-1 font-bold text-white text-xs">{me} (tu)</span>
    </div>,
    ...Object.entries(remotes).map(([user, stream]) => (
      <div key={user} className="mb-4 flex flex-col items-center">
        <RemoteVideo stream={stream} />
        <span className="text-center mt-1 font-bold text-white text-xs">{user}</span>
      </div>
    )),
  ];

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-midnight via-darkblue to-almost-black py-8">
      <h3 className="text-3xl font-bold text-primary-blue mb-8 drop-shadow">Group Video Chat</h3>
      <div className="flex flex-row gap-12 w-full max-w-6xl justify-center">
        {/* Main area */}
        <div className="flex-1 bg-darkblue rounded-2xl shadow-xl p-4 flex items-center justify-center min-h-[480px] max-h-[75vh] max-w-4xl">
          {mainContent || (
            <div className="flex flex-wrap gap-6 justify-center items-center w-full">
              {cameraTiles}
            </div>
          )}
        </div>
        {/* Coloană camere dreapta - doar când cineva face share */}
        {activeScreenSharer && (
          <div className="w-64 flex flex-col items-center bg-midnight rounded-2xl shadow-lg p-4 overflow-auto max-h-[75vh]">
            {cameraTiles}
          </div>
        )}
      </div>
      <div className="text-center mt-6 flex gap-4 justify-center">
        <button className="px-8 py-2 rounded-xl bg-gradient-to-r from-primary-blue to-accent-blue text-white font-bold shadow hover:from-accent-blue hover:to-primary-blue transition"
          onClick={leaveGroup}>
          Părăsește grupul
        </button>
        {!sharingScreen ? (
          <button className="px-5 py-2 rounded-xl bg-primary-blue hover:bg-accent-blue text-white font-bold shadow transition"
            onClick={handleShareScreen}>
            Partajează ecranul
          </button>
        ) : (
          <button className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow transition"
            onClick={handleStopShareScreen}>
            Oprește partajarea
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoChatGroup;
