import React, { useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../api/signaling";
import { importPrivateKeyForSign } from "../api/cryptoUtils";

const EmailConfirmationPage: React.FC = () => {
  const { token } = useParams();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");

  const handleConfirm = async () => {
    try {
      await axios.get(`${API_URL}/auth/confirm-email/${token}`);
      setStatus("success");

      const username = localStorage.getItem("registeredUsername");
      const password = localStorage.getItem("registeredPassword");
      const privateKeyPEM = localStorage.getItem("privateKeyPEM");

      if (username && password && privateKeyPEM) {
        const nonceRes = await axios.post(`${API_URL}/auth/get-nonce`, { username });
        const nonce = nonceRes.data.nonce;

        const privateKey = await importPrivateKeyForSign(privateKeyPEM);
        const encoder = new TextEncoder();
        const data = encoder.encode(nonce);
        const signature = await window.crypto.subtle.sign(
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          privateKey,
          data
        );
        const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

        const res = await axios.post(`${API_URL}/auth/login`, {
          username,
          password,
          signature: signatureB64,
        });

        localStorage.setItem("token", res.data.access_token);

        sessionStorage.setItem("privateKeyPEM", privateKeyPEM);
        localStorage.removeItem("privateKeyPEM");
        localStorage.removeItem("registeredUsername");
        localStorage.removeItem("registeredPassword");

        window.location.href = "/";
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-midnight text-white px-4">
      <div className="bg-darkblue/90 p-8 rounded-xl shadow-xl max-w-md w-full text-center space-y-6">
        <h2 className="text-2xl font-bold text-primary-blue">Confirmare Email</h2>

        {status === "pending" && (
          <>
            <p className="text-gray-300">Apasă pe buton pentru a confirma adresa ta de email.</p>
            <button
              onClick={handleConfirm}
              className="py-2 px-6 bg-primary-blue hover:bg-accent-blue text-white rounded-lg font-semibold transition"
            >
              Confirmă emailul
            </button>
          </>
        )}

        {status === "success" && (
          <p className="text-green-400 font-bold">Email confirmat cu succes! Te conectăm... ✅</p>
        )}

        {status === "error" && (
          <p className="text-red-400 font-bold">Link invalid sau expirat. ❌</p>
        )}
      </div>
    </div>
  );
};

export default EmailConfirmationPage;
