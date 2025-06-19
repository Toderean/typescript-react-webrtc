import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import VideoChatPage from "./pages/VideoChatPage";
import LoginPage from "./pages/LoginPage";
import CallSelectPage from "./pages/CallSelectPage";
import GroupCallPage from "./pages/GroupCallPage";
import InvitationsPoller from "./api/InvitationsBanner";
import RegisterPage from "./pages/RegisterPage";
import GroupManager from "./pages/GroupManager";
import GroupListPage from "./pages/GroupListPage";
import axios from "axios";
import { API_URL, authHeaders } from "./api/signaling";
import EmailConfirmationPage from "./pages/EmailConfirmationPage";

async function updateStatus(status: string) {
  try {
    await axios.post(`${API_URL}/users/status`, { status }, authHeaders());
  } catch (err) {
    console.error("Eroare la actualizarea statusului:", err);
  }
}

const pageVariants = {
  initial: { opacity: 0, y: 36 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -36 },
};

const AnimatedRoutes: React.FC = () => {
  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return; 
    updateStatus("available");
    window.addEventListener("beforeunload", () => {
      navigator.sendBeacon(
        `${API_URL}/users/status`,
        JSON.stringify({ status: "offline" })
      );
    });
  }, []);

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
            path="/my-groups"
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
                  <GroupListPage />
                </motion.div>
              ) : (
                <Navigate to="/login" />
              )
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
        <Route
          path="/groups"
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
                <GroupManager />
              </motion.div>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
            path="/confirm-email/:token"
            element={
              <motion.div
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
              >
                <EmailConfirmationPage />
              </motion.div>
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