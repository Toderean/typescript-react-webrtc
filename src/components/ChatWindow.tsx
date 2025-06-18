import React, { useState } from "react"
import axios from "axios"
import { encryptMessageForUser, exportSessionKeyB64, generateSessionKey } from "../api/cryptoUtils"
import { API_URL, authHeaders } from "../api/signaling"

type ChatWindowProps = {
    receiverUsername: string;
    currentUser: string;
    receiverPublicKey: CryptoKey;
  };
  
type ChatMessage = {
    text: string;
    status: "sent" | "seen";
  };

export default function ChatWindow({
    receiverUsername,
    currentUser,
    receiverPublicKey,
  }: ChatWindowProps) {
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  
    const handleSend = async () => {
        if (!message.trim()) return;
        setSending(true);
      
        const aesKey = await generateSessionKey();
        const exported = await exportSessionKeyB64(aesKey);
        sessionStorage.setItem(`session_key_${receiverUsername}`, exported);
      
        const encrypted = await encryptMessageForUser(message, receiverPublicKey, aesKey); 
      
        const response = await axios.post(`${API_URL}/messages/send`, {
          to: receiverUsername,
          encrypted_content: encrypted,
        }, authHeaders());
      
        setChatLog((prev) => [
          ...prev,
          { text: message, status: response.data.status || "sent" },
        ]);
      
        setMessage("");
        setSending(false);
      };
      
  
    return (
      <div className="p-4 border rounded-lg shadow-md w-full max-w-md bg-white">
        <div className="overflow-y-auto max-h-64 mb-4">
          {chatLog.map((msg, idx) => (
            <div key={idx} className="flex justify-end animate-fade-in">
              <div className="bg-blue-500 text-white rounded-xl px-3 py-1 my-1 shadow">
                {msg.text} <small>{msg.status === "sent" ? "✓" : "✓✓"}</small>
              </div>
            </div>
          ))}
        </div>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full border rounded px-2 py-1 mb-2"
          placeholder="Scrie un mesaj..."
        />
        <button
          onClick={handleSend}
          disabled={sending}
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
        >
          Trimite
        </button>
      </div>
    );
  }