import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../api/signaling";

export function useUserStatuses(usernames: string[]) {
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchStatuses = async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        usernames.map(async (u) => {
          try {
            const res = await fetch(`${API_URL}/users/status/${u}`, authHeaders());
            const data = await res.json();
            updates[u] = data.status;
          } catch {
            updates[u] = "offline";
          }
        })
      );
      setStatuses(updates);
    };

    fetchStatuses();
    const interval = setInterval(fetchStatuses, 4000);
    return () => clearInterval(interval);
  }, [usernames]);

  return statuses;
}
