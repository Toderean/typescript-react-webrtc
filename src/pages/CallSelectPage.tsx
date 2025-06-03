import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { API_URL, authHeaders } from "../api/signaling";
import LogoutButton from "../components/LogoutButton";
import HeaderBar from "../components/HeaderBar";
import { motion, AnimatePresence } from "framer-motion";

const CallSelectPage: React.FC = () => {
  const [users, setUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const token = localStorage.getItem("token")!;
  const decoded: any = jwtDecode(token);
  const me = decoded.sub as string;

  useEffect(() => {
    if (!token) return;
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
  }, [me, token, navigate]);

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

  const callUser = async (callee: string) => {
    const callId = `${me}_${callee}`;
    try {
      await axios.post(`${API_URL}/calls/${callId}/join`, {}, authHeaders());
      navigate(`/call/${callId}`);
    } catch (e) {
      console.error("Could not start call:", e);
    }
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
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  className="px-4 py-1 rounded-lg bg-primary-blue hover:bg-accent-blue text-white font-semibold shadow transition"
                  onClick={() => callUser(u)}
                >
                  Apelează
                </motion.button>
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
    </div>
  );
};

export default CallSelectPage;
