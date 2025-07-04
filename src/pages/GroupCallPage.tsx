import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL, authHeaders, sendSignaling } from "../api/signaling";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { encryptRSA, exportSessionKeyB64, generateSessionKey, getPeerPublicKey } from "../api/cryptoUtils";

const GroupCallPage: React.FC = () => {
  const [users, setUsers] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const currentUser = token ? (jwtDecode(token) as any).sub : "";

  useEffect(() => {
    axios
      .get(`${API_URL}/users`, authHeaders())
      .then((res) => {
        const names = res.data
          .map((u: any) => u.username)
          .filter((u: string) => u !== currentUser);
        setUsers(names);
      })
      .catch(console.error);
  }, []);

  const toggleSelect = (username: string) => {
    setSelected((prev) =>
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username],
    );
  };

  const createGroupCall = async () => {
    if (selected.length === 0) return alert("Selectează pe cineva!");
    try {
      const sessionKey = await generateSessionKey();
      const exported = await exportSessionKeyB64(sessionKey);
  
      const res = await axios.post(
        `${API_URL}/calls/group`,
        { participants: selected, 
          session_key: exported
        },
        authHeaders(),
      );
  
      const { call_id } = res.data;
  
      sessionStorage.setItem(`session_key_${call_id}`, exported);
  
      for (const user of selected) {
        try {
          const pubKey = await getPeerPublicKey(user);
          if (!pubKey) throw new Error(`cheie publica lipsa pentru ${user}`);
          const encrypted = await encryptRSA(pubKey, exported);
          await sendSignaling(call_id, "session-key", encrypted, user);
        } catch (err) {
          console.error(`eroare la trimiterea cheii catre ${user}:`, err);
        }
      }
      
  
      navigate(`/call/${call_id}`);
    } catch (err) {
      console.error(err);
      alert("Eroare la creare apel de grup!");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-midnight via-darkblue to-almost-black">
      <div className="w-full max-w-lg bg-darkblue/90 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
        <h3 className="text-2xl font-bold text-primary-blue text-center mb-6 drop-shadow">
          Inițiază apel de grup
        </h3>
        <ul className="flex flex-col gap-4 mb-6">
          {users.map((u) => (
            <li
              key={u}
              className="flex items-center justify-between bg-midnight/80 px-5 py-3 rounded-xl shadow-lg hover:bg-midnight/90 transition"
            >
              <span className="text-white font-medium">{u}</span>
              <input
                type="checkbox"
                checked={selected.includes(u)}
                onChange={() => toggleSelect(u)}
                className="form-checkbox h-5 w-5 accent-primary-blue rounded focus:ring-2 focus:ring-primary-blue"
              />
            </li>
          ))}
        </ul>
        <button
          className="w-full py-3 rounded-lg bg-gradient-to-r from-primary-blue to-accent-blue text-white font-bold text-lg shadow hover:from-accent-blue hover:to-primary-blue transition"
          onClick={createGroupCall}
        >
          Creează apelul de grup
        </button>
      </div>
    </div>
  );
};

export default GroupCallPage;
