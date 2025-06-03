import React, { useEffect, useRef } from "react";

const RemoteVideo = ({ stream }: { stream: MediaStream | null }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!stream) {
      console.warn("⚠️ No remote stream yet");
      return;
    }

    console.log("✅ Remote stream tracks:", stream.getTracks());
    console.log("✅ Remote video tracks:", stream.getVideoTracks());

    if (ref.current) {
      console.log("✅ Setting remote video stream");
      ref.current.srcObject = stream;
    } else {
      console.warn("⚠️ Remote video ref not ready");
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={false}
      style={{ width: "100%", backgroundColor: "black" }}
    />
  );
};

export default RemoteVideo;
