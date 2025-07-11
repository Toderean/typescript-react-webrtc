import React, { useState, useEffect } from "react";
import { Search, Bell } from "lucide-react";
import LogoutButton from "./LogoutButton";
import axios from "axios";
import { API_URL, authHeaders } from "../api/signaling";
import { useJoinRequests } from "../api/useJoinRequest";
import { requestFormReset } from "react-dom";
import { jwtDecode } from "jwt-decode";

interface Props {
  searchQuery?: string;
  onSearchChange: (v: string) => void;
  inCall?: boolean;
  endCall?: () => Promise<void>;
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
}

const HeaderBar: React.FC<Props> = ({
  searchQuery,
  onSearchChange,
  inCall = false,
  endCall,
  currentStatus,
  onStatusChange,
}) => {
  
  const [invitations, setInvitations] = useState<any[]>([]);
  const { requests, acceptRequest, rejectRequest } = useJoinRequests();
  const [inboxOpen, setInboxOpen] = useState(false);

  const fetchInvitations = async () => {
    try {
      const res = await axios.get(`${API_URL}/groups/invitations`, authHeaders());
      setInvitations(res.data);
    } catch (err) {
      console.error("Eroare la încărcarea invitațiilor:", err);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const acceptInvite = async (groupId: number) => {
    try {
      await axios.post(`${API_URL}/groups/${groupId}/accept`, {}, authHeaders());
      setInvitations((prev) => prev.filter((g) => g.id !== groupId));
    } catch (err) {
      console.error("Eroare la acceptarea invitației:", err);
    }
  };

  return (
    <header className="w-full flex items-center justify-between px-10 py-3 bg-darkblue/80 backdrop-blur-md shadow-2xl rounded-3xl mt-0 mb-8 sticky top-0 z-30" style={{ minHeight: 70 }}>
      <div className="flex-1 flex items-center">
        <div className="relative w-[350px]">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
            <Search size={20} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-midnight text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-blue shadow-inner"
            placeholder="Caută utilizator..."
          />
        </div>
      </div>
  
      <div className="flex items-center gap-4">
        <div className="relative">
          <button onClick={() => setInboxOpen(!inboxOpen)} className="relative">
            <Bell className="text-white" />
            {(invitations.length > 0 || requests.length > 0) && (
              <span className="absolute top-0 right-0 bg-red-500 w-3 h-3 rounded-full" />
            )}
          </button>
  
          {inboxOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-darkblue rounded shadow-xl p-4 z-50">
              <h4 className="text-white font-bold mb-2">🔔 Notificări</h4>
  
              <div className="mb-4">
                <h5 className="text-primary-blue font-semibold text-sm mb-2">Invitații la grupuri</h5>
                {invitations.length === 0 ? (
                  <p className="text-gray-400 text-sm">Nu ai invitații.</p>
                ) : (
                  invitations.map((g) => (
                    <div key={g.id} className="flex justify-between items-center mb-2 text-sm">
                      <span className="text-white">{g.name}</span>
                      <button
                        className="text-green-400 hover:underline"
                        onClick={() => acceptInvite(g.id)}
                      >
                        Acceptă
                      </button>
                    </div>
                  ))
                )}
              </div>
                <div>
                <h5 className="text-primary-blue font-semibold text-sm mb-2">Cererile către grupurile tale</h5>
                {requests.length > 0 ? (
  <>
    <h4 className="text-white font-bold mb-2">Cererile de intrare în grupurile tale</h4>
    {requests.map((r) => (
      <div key={`${r.group_id}-${r.user_id}`} className="flex justify-between items-center mb-2 text-white text-sm">
        <span>
          <strong>{r.username}</strong> → <em>{r.group_name}</em>
        </span>
        <div className="flex gap-2">
          <button onClick={() => acceptRequest(r.group_id, r.user_id)} className="text-green-400 hover:underline">Acceptă</button>
          <button onClick={() => rejectRequest(r.group_id, r.user_id)} className="text-red-400 hover:underline">Respinge</button>
        </div>
      </div>
    ))}
  </>
) : (
  <p className="text-gray-400 text-sm">Nu ai cereri către grupurile tale.</p>
)}

              </div>
            </div>
          )}
        </div>
  
        <div className="flex items-center gap-2 text-white">
          <label htmlFor="status" className="text-sm opacity-70">Status:</label>
          <select
            id="status"
            value={currentStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="bg-midnight border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
          >
            <option value="available">🟢 Available</option>
            <option value="dnd">⛔ DND</option>
            <option value="in_call">📞 In Call</option>
            <option value="offline">⚫ Offline</option>
          </select>
        </div>
  
        <LogoutButton inCall={inCall} endCall={endCall} />
      </div>
    </header>
  );
  
};

export default HeaderBar;

