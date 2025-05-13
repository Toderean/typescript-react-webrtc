import React from 'react';
import { useParams } from 'react-router-dom';
import {jwtDecode} from 'jwt-decode';
import VideoChat from '../components/video/VideoChat';

const VideoChatPage: React.FC = () => {
  const { callId } = useParams();
  const token = localStorage.getItem("token");
  const decoded: any = jwtDecode(token!);
  const currentUser = decoded.sub;

  const isInitiator = callId?.startsWith(currentUser) ?? false;

  return <VideoChat callId={callId!} isInitiator={isInitiator} />;
};

export default VideoChatPage;