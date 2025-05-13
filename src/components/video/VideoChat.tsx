// src/components/video/VideoChat.tsx
import React, { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { sendSignaling, getSignaling, deleteSignaling } from '../../api/signaling';
import LocalVideo from './LocalVideo';
import RemoteVideo from './RemoteVideo';
import 'bootstrap/dist/css/bootstrap.min.css';

interface Props {
  callId: string;
  isInitiator: boolean;
}

const VideoChat: React.FC<Props> = ({ callId, isInitiator }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peer = useRef<Peer.Instance | null>(null);
  const seenSignals = useRef<Set<number>>(new Set());
  const [hasSeenAnySignal, setHasSeenAnySignal] = useState(false);

  const attachPeerEvents = (p: Peer.Instance) => {
    p.on('signal', async (data) => {
      if (data.type === 'offer' || data.type === 'answer') {
        await sendSignaling(callId, data.type, JSON.stringify(data));
      } else {
        await sendSignaling(callId, 'ice', JSON.stringify(data));
      }
    });

    p.on('stream', (stream) => {
      setRemoteStream(stream);
    });
  };

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      setLocalStream(stream);
    });
  }, []);

  useEffect(() => {
    if (!localStream || peer.current) return;

    if (isInitiator) {
      const p = new Peer({ initiator: true, trickle: false, stream: localStream });
      attachPeerEvents(p);
      peer.current = p;
    }
  }, [localStream]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!localStream) return;

      const signals = await getSignaling(callId, isInitiator ? 'answer' : 'offer');
      const ices = await getSignaling(callId, 'ice');

      if (!hasSeenAnySignal && (signals.length > 0 || ices.length > 0)) {
        setHasSeenAnySignal(true);
      }

      if (hasSeenAnySignal && signals.length === 0 && ices.length === 0) {
        console.log("Celălalt utilizator a închis apelul");
        peer.current?.destroy();
        peer.current = null;
        localStream.getTracks().forEach(track => track.stop());
        setRemoteStream(null);
        setLocalStream(null);
        window.location.href = "/";
        return;
      }

      signals.forEach((s: any) => {
        if (!seenSignals.current.has(s.id)) {
          seenSignals.current.add(s.id);
          const signal = JSON.parse(s.content);

          if (!peer.current && !isInitiator && signal.type === 'offer') {
            const p = new Peer({ initiator: false, trickle: false, stream: localStream });
            attachPeerEvents(p);
            peer.current = p;
            p.signal(signal);
            return;
          }

          if (peer.current) {
            peer.current.signal(signal);
          }
        }
      });

      ices.forEach((c: any) => {
        if (!seenSignals.current.has(c.id)) {
          seenSignals.current.add(c.id);
          peer.current?.signal(JSON.parse(c.content));
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [localStream, hasSeenAnySignal]);

  const endCall = async () => {
    if (peer.current) {
      peer.current.destroy();
      peer.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    setRemoteStream(null);
    setLocalStream(null);

    await deleteSignaling(callId);
    window.location.href = "/";
  };

  return (
    <div className="container mt-4">
      <h3 className="text-primary">WebRTC Video Chat</h3>
      <div className="row">
        <div className="col">
          <LocalVideo stream={localStream} />
        </div>
        <div className="col">
          <RemoteVideo stream={remoteStream} />
        </div>
      </div>
      <div className="text-center mt-4">
        <button className="btn btn-danger" onClick={endCall}>Închide apelul</button>
      </div>
    </div>
  );
};

export default VideoChat;
