import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { API_URL, authHeaders, sendSignaling } from "../api/signaling";
import HeaderBar from "../components/HeaderBar";
import { motion, AnimatePresence } from "framer-motion";
import { generateSessionKey, exportSessionKeyB64, importPublicKeyFromPEM, encryptRSA, getPeerPublicKey } from "../api/cryptoUtils";
import ChatWindow from "../components/ChatWindow";
import FloatingChatButton from "../components/FloatingChatButton";
import MiniChatWindow from "../components/MiniChatWindow";

const CallSelectPage: React.FC = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<string | null>(null);
  const [users, setUsers] = useState<string[]>([]);
  const [publicKeys, setPublicKeys] = useState<Record<string, CryptoKey>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChatUser, setActiveChatUser] = useState<string | null>(null);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  let decoded: any = null;

  if (token) {
    try {
      decoded = jwtDecode(token);
    } catch (err) {
      decoded = navigate("/login"); 
    }
  }
  const me = decoded?.sub as string;

  useEffect(() => {
    if (!decoded) return;
    const iv = setInterval(async () => {
      try {
        const res = await axios.get(
          `${API_URL}/signaling/${me}`,
          authHeaders(),
        );
        const incoming = res.data.find(
          (s: any) =>
            s.type === "offer" &&
            !s.call_id.startsWith("group_") &&
            !window.location.pathname.includes(s.call_id),
        );
        if (incoming) {
          clearInterval(iv);
          navigate(`/call/${incoming.call_id}`);
        }
      } catch (err) {}
    }, 2000);
    return () => clearInterval(iv);
  }, [me, decoded, navigate]);

  useEffect(() => {
    axios
      .get(`${API_URL}/users`, authHeaders())
      .then((res) => {
        setUsers(
          res.data.map((u: any) => u.username).filter((u: string) => u !== me),
        );
      })
      .catch(console.error);
  }, [me]);

  useEffect(() => {
    const loadKeys = async () => {
      const result: Record<string, CryptoKey> = {};
      for (const user of users) {
        try {
          const key = await getPeerPublicKey(user);
          result[user] = key;
        } catch (err) {
          console.error("Eroare la obținerea cheii pentru", user);
        }
      }
      setPublicKeys(result);
    };
  
    if (users.length > 0) loadKeys();
  }, [users]);
  

  const callUser = async (callee: string) => {
    const callId = `${me}_${callee}`;
    const key = await generateSessionKey();
    const exported = await exportSessionKeyB64(key);
    sessionStorage.setItem(`session_key_${callId}`, exported);
  
    await axios.post(`${API_URL}/calls/${callId}/join`, {
      session_key: exported,
    }, authHeaders());
  
    const peerPublicKey = await getPeerPublicKey(callee);
    const encrypted = await encryptRSA(peerPublicKey, exported);
    await sendSignaling(callId, "session-key", encrypted, callee);
  
    navigate(`/call/${callId}`);
  };
  
  
  

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-midnight via-darkblue to-almost-black py-10">
      <HeaderBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        inCall={false}
      />
  
      <div className="w-full max-w-xl bg-darkblue/80 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
        <h2 className="text-2xl font-bold text-primary-blue text-center mb-6 drop-shadow">
          Selectează un utilizator pentru apel
        </h2>
        <motion.ul
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.07 } },
          }}
          className="flex flex-col gap-4"
        >
          <AnimatePresence>
            {users.map((u) => (
              <motion.li
                key={u}
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 },
                }}
                exit={{ opacity: 0, x: 30, transition: { duration: 0.15 } }}
                transition={{ duration: 0.32, type: "tween" }}
                whileHover={{
                  scale: 1.04,
                  boxShadow: "0 6px 30px #2a3fff38",
                }}
                className="flex items-center justify-between bg-midnight/80 px-5 py-3 rounded-xl shadow-lg hover:bg-midnight/90 transition"
              >
                <span className="text-white font-medium">{u}</span>
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className="px-4 py-1 rounded-lg bg-primary-blue hover:bg-accent-blue text-white font-semibold shadow transition"
                    onClick={() => callUser(u)}
                  >
                    Apelează
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className="px-4 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium shadow transition"
                    onClick={() => {
                      setChatTarget(u);
                      setChatOpen(true);
                    }}
                  >
                    Chat
                  </motion.button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
  
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: "0 8px 32px #265BFF33" }}
          whileTap={{ scale: 0.98 }}
          className="w-full mt-8 py-3 rounded-lg bg-gradient-to-r from-primary-blue to-accent-blue text-white font-bold text-lg shadow hover:from-accent-blue hover:to-primary-blue transition"
          onClick={() => navigate("/group-call")}
        >
          Apel de grup
        </motion.button>
      </div>
  
      {!chatOpen && (
        <FloatingChatButton
          onClick={() => {
            setChatTarget(users[0]); 
            setChatOpen(true);
          }}
          unreadCount={3} 
        />
      )}
  
      {chatOpen && chatTarget && publicKeys[chatTarget] && (
        <MiniChatWindow
          receiver={chatTarget}
          currentUser={me}
          publicKey={publicKeys[chatTarget]}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
  
};

export default CallSelectPage;
