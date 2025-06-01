import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import VideoChatPage from './pages/VideoChatPage';
import LoginPage from './pages/LoginPage';
import CallSelectPage from './pages/CallSelectPage';
import GroupCallPage from './pages/GroupCallPage';
import InvitationsPoller from './api/InvitationsBanner';

const App: React.FC = () => {
  const token = localStorage.getItem("token");

  return (
    <BrowserRouter>
      <InvitationsPoller />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={token ? <CallSelectPage /> : <Navigate to="/login" />} />
        <Route path="/call/:callId" element={token ? <VideoChatPage /> : <Navigate to="/login" />} />
        <Route path="/group-call" element={token ? <GroupCallPage/> : <Navigate to="/login"/>} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
