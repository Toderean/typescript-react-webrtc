import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface VideoTileProps {
  stream: MediaStream | null;
  username: string;
  isSpeaking?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  username,
  isSpeaking = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <motion.div
      className="relative w-60 h-44 rounded-2xl bg-black flex items-center justify-center shadow-lg"
      animate={
        isSpeaking
          ? { boxShadow: "0 0 0 6px #38bdf8, 0 0 28px #38bdf8bb" }
          : { boxShadow: "0 0 0 0 transparent" }
      }
      transition={{ type: "spring", stiffness: 120, damping: 15 }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={username === "me"}
        className="w-full h-full rounded-2xl"
      />
      <span className="absolute bottom-2 left-2 text-white text-xs bg-darkblue/80 rounded px-2 py-1">
        {username}
      </span>
    </motion.div>
  );
};

export default VideoTile;
