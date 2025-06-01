import React from "react";
import { useParams } from "react-router-dom";
import VideoChat from "../components/video/VideoChat";
import VideoChatGroup from "../components/video/VideoChatGroup";
import { jwtDecode } from "jwt-decode";

const VideoChatPage: React.FC = () => {
  const { callId = "" } = useParams<{ callId: string }>();
  const token = localStorage.getItem("token");
  const me = token ? (jwtDecode(token) as any).sub : "";

  if (callId.startsWith("group_")) {
    return <VideoChatGroup callId={callId} />;
  } else {
    const initiator = callId.split("_")[0];
    const isInitiator = me === initiator;
    return <VideoChat callId={callId} isInitiator={isInitiator} />;
  }
};

export default VideoChatPage;
