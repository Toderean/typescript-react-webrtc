import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL, authHeaders } from "./signaling";

export function useJoinRequests() {
  const [requests, setRequests] = useState<any[]>([]);

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/groups/requests`, authHeaders());
      setRequests(res.data);
    } catch (err) {
      console.error("Eroare la preluarea cererilor:", err);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 1000); 
    return () => clearInterval(interval); 
  }, []);

  const acceptRequest = async (groupId: number, userId: number) => {
    await axios.post(`${API_URL}/groups/${groupId}/requests/${userId}/accept`, null, authHeaders());
    setRequests(reqs => reqs.filter(r => !(r.group_id === groupId && r.user_id === userId)));
  };

  const rejectRequest = async (groupId: number, userId: number) => {
    await axios.post(`${API_URL}/groups/${groupId}/requests/${userId}/reject`, null, authHeaders());
    setRequests(reqs => reqs.filter(r => !(r.group_id === groupId && r.user_id === userId)));
  };

  return { requests, acceptRequest, rejectRequest };
}
