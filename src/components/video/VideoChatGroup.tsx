import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import {
  sendSignaling,
  getSignaling,
  deleteSignaling,
  leaveCall,
  getParticipants,
} from "../../api/signaling";
import { jwtDecode } from "jwt-decode";
import HeaderBar from "../HeaderBar";
import VideoTileWithSpeaking from "../VideoTileWithSpeaking";

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
  const [activeScreenSharer, setActiveScreenSharer] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");

  const peers = useRef<{ [user: string]: Peer.Instance }>({});
  const seenSignals = useRef<Set<number>>(new Set());
  const token = localStorage.getItem("token");
  const me = token ? (jwtDecode(token) as any).sub : "";

  // ------------- Array-uri pentru tiles
  const allUsers = [me, ...Object.keys(remotes).filter((u) => u !== me)];

  const columnUsers =
    activeScreenSharer === me
      ? Object.keys(remotes).filter((user) => user !== me)
      : [
          me,
          ...Object.keys(remotes).filter(
            (user) => user !== me && user !== activeScreenSharer,
          ),
        ];

  // ------------------- EFFECTS

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => setLocalStream(s))
      .catch(console.error);
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
          config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
        });

        p.on("signal", async (data: any) => {
          await sendSignaling(
            callId,
            data.type === "offer" || data.type === "answer" ? data.type : "ice",
            JSON.stringify(data),
            user,
          );
        });

        p.on("stream", (stream: MediaStream) => {
          setRemotes((rem) => ({ ...rem, [user]: stream }));
        });

        p.on("error", (err) => {
          console.error(`[${me}] Peer error with ${user}:`, err);
        });

        peers.current[user] = p;
      }
    });
  }, [participants, localStream, me, callId]);

  useEffect(() => {
    const intv = setInterval(async () => {
      for (let user of participants) {
        if (user === me) continue;

        const offers: SignalingData[] = await getSignaling(callId, "offer", me);
        const answers: SignalingData[] = await getSignaling(
          callId,
          "answer",
          me,
        );
        const ices: SignalingData[] = await getSignaling(callId, "ice", me);
        const screens: SignalingData[] = await getSignaling(
          callId,
          "screen-share",
          me,
        );

        // Screen-share signaling
        screens
          .filter((sig: any) => !seenSignals.current.has(sig.id))
          .forEach((sig: any) => {
            seenSignals.current.add(sig.id);
            if (sig.content === "start") {
              setActiveScreenSharer(sig.sender);
            }
            if (sig.content === "stop") {
              setActiveScreenSharer((prev) =>
                prev === sig.sender ? null : prev,
              );
            }
          });

        // Offers/answers/ices
        offers
          .filter(
            (sig) => sig.sender === user && !seenSignals.current.has(sig.id),
          )
          .forEach((sig) => {
            if (!peers.current[user]) {
              const p = new Peer({
                initiator: false,
                trickle: false,
                stream: localStream!,
                config: {
                  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
                },
              });

              p.on("signal", async (data: any) => {
                await sendSignaling(
                  callId,
                  data.type === "offer" || data.type === "answer"
                    ? data.type
                    : "ice",
                  JSON.stringify(data),
                  user,
                );
              });

              p.on("stream", (stream: MediaStream) => {
                setRemotes((rem) => ({ ...rem, [user]: stream }));
              });

              p.on("error", (err) => {
                console.error(`[${me}] Peer error with ${user}:`, err);
              });

              peers.current[user] = p;
            }
            peers.current[user].signal(JSON.parse(sig.content));
            seenSignals.current.add(sig.id);
          });

        answers
          .filter(
            (sig) => sig.sender === user && !seenSignals.current.has(sig.id),
          )
          .forEach((sig) => {
            if (peers.current[user]) {
              peers.current[user].signal(JSON.parse(sig.content));
              seenSignals.current.add(sig.id);
            }
          });

        ices
          .filter(
            (sig) => sig.sender === user && !seenSignals.current.has(sig.id),
          )
          .forEach((sig) => {
            if (peers.current[user]) {
              peers.current[user].signal(JSON.parse(sig.content));
              seenSignals.current.add(sig.id);
            }
          });
      }
    }, 1200);
    return () => clearInterval(intv);
  }, [participants, me, callId, localStream]);

  // Share screen
  const handleShareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
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

    const camStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    setLocalStream(camStream);

    Object.values(peers.current).forEach((p) => {
      const sender = p.streams[0].getTracks().find((t) => t.kind === "video");
      if (sender) {
        p.replaceTrack(sender, camStream.getVideoTracks()[0], p.streams[0]);
      }
    });
    await sendSignaling(callId, "screen-share", "stop");
  };

  // Iesire apel
  const leaveGroup = async () => {
    Object.values(peers.current).forEach((p) => p.destroy());
    localStream?.getTracks().forEach((t) => t.stop());
    await leaveCall(callId);
    await deleteSignaling(callId);
    window.location.replace("/");
  };

  // Main content (centru): dacă eu share-uiesc, văd screen-ul meu, altfel văd screen-ul lui X (RemoteVideo)
  const isSharing = !!activeScreenSharer;
  let mainContent = null;
  if (isSharing) {
    const isMeSharing = activeScreenSharer === me;
    mainContent = (
      <div className="w-full flex justify-center items-center">
        {isMeSharing && screenStream ? (
          <video
            autoPlay
            playsInline
            muted
            className="max-w-[950px] max-h-[68vh] w-full h-full rounded-2xl bg-black"
            ref={(el) => {
              if (el && screenStream) el.srcObject = screenStream;
            }}
          />
        ) : !!activeScreenSharer && remotes[activeScreenSharer] ? (
          <div className="max-w-[950px] max-h-[68vh] w-full h-full rounded-2xl bg-black flex items-center justify-center">
            <VideoTileWithSpeaking
              stream={remotes[activeScreenSharer]}
              username={activeScreenSharer}
            />
          </div>
        ) : (
          <div className="w-[950px] h-[68vh] rounded-2xl bg-black flex items-center justify-center text-white">
            Se așteaptă partajare...
          </div>
        )}
      </div>
    );
  }

  // Camera column când cineva share-uiește
  const cameraColumn = (
    <div className="w-72 flex flex-col items-center bg-midnight rounded-2xl shadow-lg p-4 gap-4 max-h-[72vh] overflow-y-auto">
      {columnUsers.map((user, idx) => (
        <div key={user} className="flex flex-col items-center">
          <div className="w-36 h-28 rounded-xl flex items-center justify-center">
            <VideoTileWithSpeaking
              stream={user === me ? localStream : remotes[user]}
              username={user === me ? `${me} (tu)` : user}
            />
          </div>
          <span className="text-center mt-1 font-bold text-white text-xs">
            {user === me ? `${me} (tu)` : user}
          </span>
        </div>
      ))}
    </div>
  );

  // Camera grid când nimeni nu share-uiește
  const cameraGrid = (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 w-full justify-center items-center">
      {allUsers.map((user) => (
        <div key={user} className="flex flex-col items-center">
          <div className="w-60 h-44 rounded-2xl flex items-center justify-center">
            <VideoTileWithSpeaking
              stream={user === me ? localStream : remotes[user]}
              username={user === me ? `${me} (tu)` : user}
            />
          </div>
          <span className="text-center mt-1 font-bold text-white text-xs">
            {user === me ? `${me} (tu)` : user}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-midnight via-darkblue to-almost-black py-8">
      <HeaderBar
        onSearchChange={setSearchQuery}
        inCall={true}
        endCall={leaveGroup}
      />
      <h3 className="text-3xl font-bold text-primary-blue mb-8 drop-shadow">
        Group Video Chat
      </h3>
      <div className="flex flex-row gap-10 w-full max-w-6xl justify-center">
        <div className="flex-1 bg-darkblue rounded-2xl shadow-xl p-4 flex items-center justify-center min-h-[480px] max-h-[75vh] max-w-4xl">
          {isSharing ? mainContent : cameraGrid}
        </div>
        {isSharing && cameraColumn}
      </div>
      <div className="text-center mt-6 flex gap-4 justify-center">
        <button
          className="px-8 py-2 rounded-xl bg-gradient-to-r from-primary-blue to-accent-blue text-white font-bold shadow hover:from-accent-blue hover:to-primary-blue transition"
          onClick={leaveGroup}
        >
          Părăsește grupul
        </button>
        {!sharingScreen ? (
          <button
            className="px-5 py-2 rounded-xl bg-primary-blue hover:bg-accent-blue text-white font-bold shadow transition"
            onClick={handleShareScreen}
          >
            Partajează ecranul
          </button>
        ) : (
          <button
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow transition"
            onClick={handleStopShareScreen}
          >
            Oprește partajarea
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoChatGroup;
