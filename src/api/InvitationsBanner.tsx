import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL, authHeaders } from "./signaling";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

interface Invitation {
  call_id: string;
  creator?: string;
}

const InvitationsBanner: React.FC = () => {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const me = token ? (jwtDecode(token) as any).sub : "";

  useEffect(() => {
    if (!token) return;
    const iv = setInterval(async () => {
      try {
        const res = await axios.get(
          `${API_URL}/calls/invitations`,
          authHeaders(),
        );
        const calls = res.data.filter(
          (inv: any) =>
            inv.call_id.startsWith("group_") &&
            !window.location.pathname.includes(inv.call_id) &&
            !dismissed.includes(inv.call_id),
        );
        if (calls.length > 0) {
          setInvitation(calls[0]);
        } else {
          setInvitation(null);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(iv);
  }, [token, navigate, dismissed]);

  const handleAccept = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    if (invitation) {
      navigate(`/call/${invitation.call_id}`);
      setInvitation(null); 
    }
  };

  const handleDismiss = () => {
    if (invitation) {
      setDismissed([...dismissed, invitation.call_id]);
      setInvitation(null);
    }
  };

  if (!invitation) return null;

  return (
    <div
      className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 min-w-[320px] max-w-lg w-full 
                 bg-darkblue/95 border border-primary-blue shadow-2xl rounded-2xl px-6 py-4
                 flex flex-col items-center gap-3 animate-fade-in"
    >
      <div className="text-white text-center text-lg">
        <span className="font-bold text-primary-blue">
          {invitation.creator || "Cineva"}
        </span>
        <span className="mx-1">te-a invitat la un apel de grup.</span>
      </div>
      <div className="flex gap-3">
        <button
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-primary-blue to-accent-blue text-white font-bold shadow hover:from-accent-blue hover:to-primary-blue transition"
          onClick={handleAccept}
        >
          Acceptă
        </button>
        <button
          className="px-5 py-2 rounded-xl bg-gray-700 hover:bg-gray-800 text-white font-bold shadow transition"
          onClick={handleDismiss}
        >
          Refuză
        </button>
      </div>
    </div>
  );
};

export default InvitationsBanner;
