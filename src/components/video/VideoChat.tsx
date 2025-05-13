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
  const [accepted, setAccepted] = useState<boolean>(false);

  const peer = useRef<Peer.Instance | null>(null);
  const seenSignals = useRef<Set<number>>(new Set());
  const appliedAnswer = useRef(false);
  const appliedOffer = useRef(false);

  const attachPeerEvents = (p: Peer.Instance) => {
    p.on('signal', async (data) => {
      const type = data.type === 'offer' || data.type === 'answer' ? data.type : 'ice';
      await sendSignaling(callId, type, JSON.stringify(data));
    });

    p.on('stream', (stream) => {
      console.log('✅ Received remote stream');
      setRemoteStream(stream);
    });
  };

  // Get local media
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      setLocalStream(stream);
    }).catch(console.error);
  }, []);

  // Initiator: create and signal offer immediately
  useEffect(() => {
    if (!localStream || peer.current || !isInitiator) return;
    const p = new Peer({ initiator: true, trickle: false, stream: localStream });
    attachPeerEvents(p);
    peer.current = p;
  }, [localStream, isInitiator]);

  // Polling for signals, ICE, and detect call end/cancel
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!localStream) return;
      if (!accepted && !isInitiator) return;

      const offers = await getSignaling(callId, 'offer');
      const answers = await getSignaling(callId, 'answer');
      const ices = await getSignaling(callId, 'ice');

      // Detect call ended or cancelled: DB empty after start
      const started = isInitiator || appliedOffer.current || appliedAnswer.current;
      if (started && offers.length === 0 && answers.length === 0 && ices.length === 0) {
        console.log('💔 Call ended or cancelled, redirecting');
        peer.current?.destroy();
        peer.current = null;
        localStream.getTracks().forEach((track) => track.stop());
        window.location.href = '/';
        return;
      }

      // Handle offers (callee)
      for (const s of offers) {
        if (!seenSignals.current.has(s.id)) {
          seenSignals.current.add(s.id);
          const signal = JSON.parse(s.content);
          if (!isInitiator && signal.type === 'offer' && !appliedOffer.current) {
            const p = new Peer({ initiator: false, trickle: false, stream: localStream });
            attachPeerEvents(p);
            peer.current = p;
            try {
              p.signal(signal);
              appliedOffer.current = true;
            } catch (err) {
              console.warn('❌ Error applying offer:', err);
            }
          }
        }
      }

      // Handle answers (initiator)
      for (const s of answers) {
        if (!seenSignals.current.has(s.id)) {
          seenSignals.current.add(s.id);
          const signal = JSON.parse(s.content);
          if (isInitiator && signal.type === 'answer' && !appliedAnswer.current) {
            try {
              peer.current?.signal(signal);
              appliedAnswer.current = true;
            } catch (err) {
              console.warn('❌ Error applying answer:', err);
            }
          }
        }
      }

      // Handle ICE
      for (const c of ices) {
        if (!seenSignals.current.has(c.id)) {
          seenSignals.current.add(c.id);
          try {
            peer.current?.signal(JSON.parse(c.content));
          } catch (err) {
            console.warn('❌ ICE signal error:', err);
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [localStream, accepted]);

  // Callee accepts call
  const handleAccept = async () => {
    if (!localStream) return;
    const offerData = await getSignaling(callId, 'offer');
    if (!offerData.length) return;

    const offer = JSON.parse(offerData[0].content);
    const p = new Peer({ initiator: false, trickle: false, stream: localStream });
    attachPeerEvents(p);
    peer.current = p;
    try {
      p.signal(offer);
      appliedOffer.current = true;
    } catch (err) {
      console.warn('❌ Error applying offer (accept):', err);
    }
    setAccepted(true);
  };

  // Callee cancels call => deletes DB & redirects
  const handleCancel = async () => {
    await deleteSignaling(callId);
    window.location.href = '/';
  };

  // End call (both sides)
  const endCall = async () => {
    peer.current?.destroy();
    peer.current = null;
    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
    await deleteSignaling(callId);
    window.location.href = '/';
  };

  return (
    <div className="container mt-4">
      <h3 className="text-primary">WebRTC Video Chat</h3>
      <div className="row">
        <div className="col"><LocalVideo stream={localStream} /></div>
        <div className="col"><RemoteVideo stream={remoteStream} /></div>
      </div>

      {!isInitiator && !accepted && (
        <div className="text-center mt-4">
          <button className="btn btn-success me-2" onClick={handleAccept}>Accept</button>
          <button className="btn btn-danger" onClick={handleCancel}>Cancel</button>
        </div>
      )}

      {(isInitiator || accepted) && (
        <div className="text-center mt-4">
          <button className="btn btn-danger" onClick={endCall}>Închide apelul</button>
        </div>
      )}
    </div>
  );
};

export default VideoChat;
