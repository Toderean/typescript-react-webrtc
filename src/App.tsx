import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from "framer-motion";
import VideoChatPage from './pages/VideoChatPage';
import LoginPage from './pages/LoginPage';
import CallSelectPage from './pages/CallSelectPage';
import GroupCallPage from './pages/GroupCallPage';
import InvitationsPoller from './api/InvitationsBanner';
import RegisterPage from './pages/RegisterPage';

const pageVariants = {
  initial: { opacity: 0, y: 36 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -36 }
};

const AnimatedRoutes: React.FC = () => {
  const token = localStorage.getItem("token");
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/login"
          element={
            <motion.div
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.38, ease: "easeInOut" }}
              className="min-h-screen"
            >
              <LoginPage />
            </motion.div>
          }
        />
        <Route
          path="/register"
          element={
            <motion.div
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.38, ease: "easeInOut" }}
              className="min-h-screen"
            >
              <RegisterPage />
            </motion.div>
          }
        />
        <Route
          path="/"
          element={
            token ? (
              <motion.div
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.38, ease: "easeInOut" }}
                className="min-h-screen"
              >
                <CallSelectPage />
              </motion.div>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/call/:callId"
          element={
            token ? (
              <motion.div
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.38, ease: "easeInOut" }}
                className="min-h-screen"
              >
                <VideoChatPage />
              </motion.div>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/group-call"
          element={
            token ? (
              <motion.div
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.38, ease: "easeInOut" }}
                className="min-h-screen"
              >
                <GroupCallPage />
              </motion.div>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <InvitationsPoller />
      <AnimatedRoutes />
    </BrowserRouter>
  );
};

export default App;
