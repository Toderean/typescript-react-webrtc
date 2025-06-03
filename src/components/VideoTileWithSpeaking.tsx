import React from "react";
import { useSpeaking } from "../api/useSpeaking";
import VideoTile from "./VideoTile";

interface Props {
  stream: MediaStream | null;
  username: string;
}

const VideoTileWithSpeaking: React.FC<Props> = ({ stream, username }) => {
  const isSpeaking = useSpeaking(stream);
  return (
    <VideoTile stream={stream} username={username} isSpeaking={isSpeaking} />
  );
};

export default VideoTileWithSpeaking;
