import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../api/signaling";

export function useMessagesPoller(currentUser: string) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/messages/unread?for=${currentUser}`, authHeaders());
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      } catch (e) {
        console.error("Polling eșuat:", e);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [currentUser]);

  return unreadCount;
}
