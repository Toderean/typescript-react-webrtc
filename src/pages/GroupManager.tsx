import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { API_URL, authHeaders } from "../api/signaling";
import HeaderBar from "../components/HeaderBar";

const GroupManager: React.FC = () => {
  const [users, setUsers] = useState<string[]>([]);
  const [publicKeys, setPublicKeys] = useState<Record<string, CryptoKey>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [status, setStatus] = useState("available");
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupMembers, setGroupMembers] = useState<Record<number, any[]>>({});

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
    axios
      .get(`${API_URL}/users`, authHeaders())
      .then((res) => {
        setUsers(res.data.map((u: any) => u.username).filter((u: string) => u !== me));
      })
      .catch(console.error);

    axios
      .get(`${API_URL}/groups/all`, authHeaders())
      .then((res) => setAllGroups(res.data))
      .catch(console.error);
  }, [me]);

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    try {
      await axios.post(`${API_URL}/users/status`, { status: newStatus }, authHeaders());
    } catch (err) {
      console.error("Eroare la actualizarea statusului propriu:", err);
    }
  };

  const toggleSelect = (username: string) => {
    setSelectedMembers((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  };

  const createGroup = async () => {
    if (!groupName.trim()) return alert("Introdu un nume pentru grup!");
    try {
      const res = await axios.post(`${API_URL}/groups`, { name: groupName }, authHeaders());
      
      const groupId = res.data.id;

      for (const user of selectedMembers) {
        const userRes = await axios.get(`${API_URL}/users/${user}`, authHeaders());
        const userId = userRes.data.id;
        await axios.post(`${API_URL}/groups/${groupId}/invite`, { user_id: userId }, authHeaders());
      }

      alert("Grup creat și invitații trimise!");
      setGroupName("");
      setSelectedMembers([]);
    } catch (err) {
      console.error("Eroare la creare grup:", err);
      alert("Eroare la creare grup!");
    }
  };

  const requestToJoin = async (groupId: number) => {
    try {
      await axios.post(`${API_URL}/groups/${groupId}/request`, {}, authHeaders());
      alert("Cerere trimisă către grup!");
    } catch (err) {
      console.error("Eroare la cererea de aderare:", err);
      alert("Nu s-a putut trimite cererea.");
    }
  };

  const handleGroupSearch = async (id: number) => {
    try {
      const res = await axios.get(`${API_URL}/groups/${id}/members`, authHeaders());
      setGroupMembers((prev) => ({ ...prev, [id]: res.data }));
    } catch (err) {
      console.error("Eroare la încărcarea membrilor grupului:", err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-midnight via-darkblue to-almost-black py-10">
      <HeaderBar
        inCall={false}
        currentStatus={status}
        onStatusChange={handleStatusChange}
        searchQuery={""}
        onSearchChange={() => {}}
      />

      <div className="w-full max-w-xl bg-darkblue/80 rounded-2xl p-8 shadow-2xl backdrop-blur-md mb-8">
        <h2 className="text-2xl font-bold text-primary-blue text-center mb-6 drop-shadow">
          Creează un grup nou
        </h2>

        <input
          type="text"
          placeholder="Numele grupului"
          className="w-full mb-4 px-4 py-2 rounded-lg bg-midnight text-white placeholder-gray-400"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />

        <div className="mb-4">
          <p className="text-white mb-2">Selectează membri:</p>
          <input
            type="text"
            placeholder="Caută utilizator..."
            className="w-full mb-4 px-4 py-2 rounded-lg bg-midnight text-white placeholder-gray-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <ul className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
            {users
              .filter((u) => u.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((u) => (
                <label key={u} className="flex items-center gap-2 text-white">
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(u)}
                    onChange={() => toggleSelect(u)}
                  />
                  {u}
                </label>
              ))}
          </ul>

          {selectedMembers.length > 0 && (
            <div className="mt-4">
              <p className="text-white mb-2">Membri adăugați:</p>
              <ul className="flex flex-wrap gap-2">
                {selectedMembers.map((member) => (
                  <li
                    key={member}
                    className="px-3 py-1 bg-primary-blue rounded-full text-white text-sm shadow"
                  >
                    {member}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          onClick={createGroup}
          className="w-full py-3 rounded-lg bg-primary-blue hover:bg-accent-blue text-white font-bold text-lg shadow transition"
        >
          Creează grupul
        </button>
      </div>

      <div className="w-full max-w-xl bg-darkblue/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
        <h2 className="text-xl font-bold text-white mb-4">Caută un grup existent</h2>
        <input
          type="text"
          placeholder="Numele grupului"
          className="w-full mb-4 px-4 py-2 rounded-lg bg-midnight text-white placeholder-gray-400"
          value={groupSearch}
          onChange={(e) => setGroupSearch(e.target.value)}
        />

        <ul className="space-y-4">
          {allGroups
            .filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
            .map((g) => (
              <li key={g.id} className="bg-midnight p-4 rounded-lg text-white shadow-md">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{g.name} <span className="text-gray-400 text-sm">#{g.id}</span></p>
                    <p className="text-sm text-gray-400">Creat de: User #{g.creator_id}</p>
                  </div>
                  <button
                    onClick={() => {
                      handleGroupSearch(g.id);
                      requestToJoin(g.id);
                    }}
                    className="bg-primary-blue px-3 py-1 rounded text-white hover:bg-accent-blue"
                  >
                    Cere aderare
                  </button>
                </div>

                {groupMembers[g.id] && (
                  <ul className="mt-2 pl-4 list-disc text-sm text-gray-300">
                    {groupMembers[g.id].map((m) => (
                      <li key={m.id}>👤 {m.username} ({m.status})</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
        </ul>
      </div>

      <button
        onClick={() => navigate("/")}
        className="mt-10 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
      >
        ← Înapoi
      </button>
    </div>
  );
};

export default GroupManager;