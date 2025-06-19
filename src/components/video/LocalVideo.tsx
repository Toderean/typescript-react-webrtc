import React from "react";

interface Props {
  stream: MediaStream | null;
}

const LocalVideo: React.FC<Props> = ({ stream }) => {
  const ref = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover rounded-2xl border-4 border-accent-blue shadow-xl bg-black"
      style={{ background: "#0b1121" }}
    />
  );
};

export default LocalVideo;
