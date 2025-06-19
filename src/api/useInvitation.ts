import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL, authHeaders } from "./signaling";

export function useGroupInvitations() {
  const [invitations, setInvitations] = useState<any[]>([]);

  useEffect(() => {
    const fetchInvites = async () => {
      try {
        const res = await axios.get(`${API_URL}/groups/invitations`, authHeaders());
        setInvitations(res.data);
      } catch (err) {
        console.error("Eroare la preluarea invitațiilor:", err);
      }
    };
    fetchInvites();
  }, []);

  return invitations;
}
