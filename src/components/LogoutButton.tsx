import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { API_URL, authHeaders } from "../api/signaling";

interface Props {
  inCall?: boolean;
  endCall?: () => Promise<void>;
}

const LogoutButton: React.FC<Props> = ({ inCall = false, endCall }) => {
  const navigate = useNavigate();
  const location = useLocation();

    async function updateStatus(status: string) {
      try {
        await axios.post(`${API_URL}/users/status`, { status }, authHeaders());
      } catch (err) {
        console.error("❌ Eroare la actualizarea statusului:", err);
      }
    }

  const handleLogout = async () => {
    if (inCall && endCall) {
      await endCall();
    }
    await updateStatus("offline");  
    sessionStorage.clear();
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <button
      className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold shadow transition"
      onClick={handleLogout}
    >
      Deconectare
    </button>
  );
};

export default LogoutButton;
