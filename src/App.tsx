import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import VideoChatPage from './pages/VideoChatPage';
import LoginPage from './pages/LoginPage';
import CallSelectPage from './pages/CallSelectPage';

const App = () => {
  const token = localStorage.getItem("token");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={token ? <CallSelectPage /> : <Navigate to="/login" />} />
        <Route path="/call/:callId" element={token ? <VideoChatPage /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
