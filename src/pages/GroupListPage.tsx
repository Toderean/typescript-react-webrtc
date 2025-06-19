import React, { useEffect, useState } from "react";
import axios from "axios";
import { getMyGroups, getGroupMembers } from "../api/signaling";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import { encryptRSA, exportSessionKeyB64, generateSessionKey, getPeerPublicKey } from "../api/cryptoUtils";
import { API_URL, authHeaders, sendSignaling } from "../api/signaling";
import { useUserStatuses } from "../api/useUserStatuses";

const GroupListPage: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [members, setMembers] = useState<Record<number, any[]>>({});
  const token = localStorage.getItem("token");
  const currentUserId = token ? (jwtDecode(token) as any).user_id : null;
  const currentUsername = token ? (jwtDecode(token) as any).sub : "";
  const navigate = useNavigate();

  const allUsernames = Object.values(members).flat().map((m) => m.username);
  const statuses = useUserStatuses(allUsernames);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const myGroups = await getMyGroups();
        setGroups(myGroups);

        for (const group of myGroups) {
          const groupMembers = await getGroupMembers(group.id);
          setMembers((prev) => ({ ...prev, [group.id]: groupMembers }));
        }
      } catch (err) {
        console.error("Eroare la încărcarea grupurilor:", err);
      }
    };

    loadGroups();
  }, []);

  const startGroupCall = async (groupId: number) => {
    const groupMembers = members[groupId] || [];
    console.log("Membri grup:", groupMembers);

    const availableUsers = groupMembers
      .filter((m) => statuses[m.username] === "available" && m.username !== currentUsername)
      .map((m) => m.username);

    console.log("Utilizatori disponibili:", availableUsers);

    if (availableUsers.length === 0) return alert("Niciun utilizator disponibil în acest grup.");

    try {
      const sessionKey = await generateSessionKey();
      const exported = await exportSessionKeyB64(sessionKey);

      const res = await axios.post(
        `${API_URL}/calls/group`,
        {
          participants: availableUsers,
          session_key: exported,
        },
        authHeaders()
      );

      const { call_id } = res.data;
      sessionStorage.setItem(`session_key_${call_id}`, exported);

      for (const user of availableUsers) {
        try {
          const pubKey = await getPeerPublicKey(user);
          const encrypted = await encryptRSA(pubKey, exported);
          await sendSignaling(call_id, "session-key", encrypted, user);
        } catch (err) {
          console.error(`Eroare la trimiterea cheii către ${user}:`, err);
        }
      }

      navigate(`/call/${call_id}`);
    } catch (err) {
      console.error("Eroare la inițiere apel de grup:", err);
      alert("Eroare la inițiere apel de grup.");
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-midnight via-darkblue to-almost-black text-white">
      <h2 className="text-3xl font-bold mb-8 text-primary-blue text-center drop-shadow">Grupurile mele</h2>

      <div className="space-y-6 max-w-3xl mx-auto">
        {groups.map((group) => (
          <div
            key={group.id}
            className="bg-darkblue/80 p-6 rounded-2xl shadow-lg backdrop-blur-md"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {group.name} <span className="text-sm text-gray-400">#{group.id}</span>
                </h3>
                <p className="text-sm text-gray-400 mb-2">
                  Creat de: {group.creator_id === currentUserId ? "Tu" : group.creator_username}
                </p>
              </div>
              <button
                onClick={() => startGroupCall(group.id)}
                className="bg-primary-blue px-4 py-1 rounded text-white hover:bg-accent-blue text-sm"
              >
                Apelează disponibilii
              </button>
            </div>

            <ul className="pl-4 mt-2 list-disc space-y-1">
              {(members[group.id] || []).map((m) => (
                <li key={m.id} className="text-sm">
                  👤 {m.username} - <span className="italic text-gray-300">{statuses[m.username] || m.status}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white shadow"
        >
          ← Înapoi
        </button>
      </div>
    </div>
  );
};

export default GroupListPage;
