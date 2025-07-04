import React, { useEffect, useState } from "react";
import axios from "axios";
import { decryptWithSessionKey, encryptMessageForUser, exportSessionKeyB64, generateSessionKey, importSessionKeyB64, fromBase64Url, importPrivateKeyFromPEM } from "../api/cryptoUtils";
import { API_URL, authHeaders } from "../api/signaling";

type Props = {
  receiver: string;
  publicKey: CryptoKey;
  currentUser: string;
  onClose: () => void;
};

type ChatMessage = {
  fromMe: boolean;
  text: string;
  status: "sent" | "seen";
};

const MiniChatWindow: React.FC<Props> = ({ receiver, publicKey, currentUser, onClose }) => {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);

  async function decryptMessageForUser(encryptedB64: string): Promise<string> {
    try {
      const payload = JSON.parse(atob(encryptedB64));
  
      const encryptedKey = fromBase64Url(payload.key);
      const iv = fromBase64Url(payload.iv);
      const ciphertext = fromBase64Url(payload.data);
  
      const privateKeyPEM = sessionStorage.getItem("privateKeyPEM");
      if (!privateKeyPEM) return "[Mesaj criptat cheia privată lipsește]";
  
      const privateKey = await importPrivateKeyFromPEM(privateKeyPEM);
  
      const aesRaw = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        encryptedKey
      );
  
      const aesKey = await crypto.subtle.importKey(
        "raw",
        aesRaw,
        "AES-GCM",
        true,
        ["decrypt"]
      );
  
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        ciphertext
      );
  
      return new TextDecoder().decode(decrypted);
    } catch (err) {
      console.error("Eroare la decriptarea mesajului:", err);
      return "[Eroare la decriptare]";
    }
  }
  
  const sendMessage = async () => {
    if (!message.trim()) return;
    const key = await generateSessionKey();
    const exported = await exportSessionKeyB64(key);
    sessionStorage.setItem(`session_key_${receiver}`, exported);

    const encrypted = await encryptMessageForUser(message, publicKey, key); 

    console.log(`mesaj scris de catre utilizator: ${message}`);
    console.log(`mesaj criptat trimis catre ${receiver} : ${encrypted}`);

    const res = await axios.post(`${API_URL}/messages/send`, {
      to: receiver,
      encrypted_content: encrypted,
    },authHeaders());

    setChat((prev) => [...prev, { fromMe: true, text: message, status: res.data.status }]);
    setMessage("");
  };

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const res = await axios.get(`${API_URL}/messages/with/${receiver}`, authHeaders());
        await axios.post(`${API_URL}/messages/mark_seen?with_user=${receiver}`, {}, authHeaders());
        const data = res.data;
  
        const decrypted = await Promise.all(
          data.map(async (msg: any) => {
            const text = msg.from === "me"
              ? "[Trimis de tine]"
              : await decryptMessageForUser(msg.content);
  
              console.log(`mesaj primit de la utilizator: ${msg.content}`);
              console.log(`mesaj decriptat: ${text}`);

            return {
              fromMe: msg.from === "me",
              text,
              status: msg.status,
            };
          })
        );
  
        setChat(decrypted);
      } catch (err) {
        console.error("Eroare la preluarea mesajelor:", err);
      }
    };
  
    loadMessages();
  
    const interval = setInterval(loadMessages, 3000);
    
  
    return () => clearInterval(interval);
  }, [receiver]);
  
  
  

  return (
    <div className="fixed bottom-4 right-4 w-72 bg-white rounded-lg shadow-xl z-50 flex flex-col">
      <div className="bg-blue-600 text-white font-semibold px-3 py-2 rounded-t flex justify-between items-center">
        Chat cu {receiver}
        <button onClick={onClose} className="text-sm text-white/80 hover:text-white">×</button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 max-h-60">
                {chat.map((msg, idx) => (
            <div key={idx} className={`my-1 text-sm ${msg.fromMe ? "text-right" : "text-left"}`}>
                <span className={`inline-block px-2 py-1 rounded ${msg.fromMe ? "bg-blue-500 text-white" : "bg-gray-200"}`}>
                {msg.text}
                {msg.fromMe && (
                    <small className={`ml-2 text-xs ${msg.status === "seen" ? "animate-pulse text-green-300" : "text-white/70"}`}>
                    {msg.status === "seen" ? "✅" : "✉️"}
                    </small>
                )}
                </span>
            </div>
            ))}
      </div>
      <div className="p-2 border-t flex gap-1">
        <input
          className="flex-1 border rounded px-2 text-sm"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Scrie un mesaj..."
        />
        <button onClick={sendMessage} className="bg-blue-500 text-white px-3 py-1 rounded text-sm">Trimite</button>
      </div>
    </div>
  );
};

export default MiniChatWindow;
