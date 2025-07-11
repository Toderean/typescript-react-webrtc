import React, { useEffect, useRef } from "react";

const RemoteVideo = ({ stream }: { stream: MediaStream | null }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!stream) {
      console.warn("No remote stream yet");
      return;
    }

    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={false}
      className="w-full h-full object-cover rounded-2xl shadow-xl bg-black"
    />
  );
};

export default RemoteVideo;
