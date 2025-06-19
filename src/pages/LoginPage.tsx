import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { generateKeyPair, exportPrivateKeyPEM, exportPublicKeyPEM, downloadPEM, importPrivateKeyFromPEM } from "../api/cryptoUtils";
import { API_URL } from "../api/signaling";

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needKey, setNeedKey] = useState(false);
  const [needConfirmation, setNeedConfirmation] = useState(false);
  const navigate = useNavigate();

  const login = async () => {
    try {
      const res = await axios.post(`${API_URL}/auth/login`, {
        username,
        password,
      });
      localStorage.setItem("token", res.data.access_token);

      if (!sessionStorage.getItem("privateKeyPEM")) {
        setNeedKey(true);
        return;
      }
      window.location.href = "/";
    } catch (err: any) {
      if (err.response?.status === 403) {
        setNeedConfirmation(true);
      } else {
        setError("Autentificare eșuată");
      }
    }
  };

  async function handleUploadKey(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      const pem = await file.text();
      sessionStorage.setItem("privateKeyPEM", pem);
      setNeedKey(false);
      window.location.href = "/";
    }
  }

  const resendConfirmation = async () => {
    try {
      await axios.post(`${API_URL}/auth/resend-confirmation`, { username });
      alert("Email de confirmare retrimis!");
    } catch (err) {
      alert("Eroare la retrimiterea emailului de confirmare.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-midnight">
      <div className="w-full max-w-md bg-darkblue p-8 rounded-2xl shadow-xl">
        <h3 className="text-2xl font-bold mb-6 text-primary-blue text-center">Login</h3>
        <input
          className="w-full mb-4 px-4 py-2 rounded-lg bg-almost-black text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-blue"
          type="text"
          placeholder="Username sau email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="w-full mb-6 px-4 py-2 rounded-lg bg-almost-black text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-blue"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          className="w-full py-2 rounded-lg bg-primary-blue hover:bg-accent-blue text-white font-semibold transition"
          onClick={login}
        >
          Login
        </button>

        {error && <p className="text-red-400 mt-4 text-center">{error}</p>}

        {needConfirmation && (
          <div className="mt-4 text-center text-yellow-400">
            <p>Emailul nu este confirmat.</p>
            <button
              onClick={resendConfirmation}
              className="underline text-primary-blue font-semibold"
            >
              Retrimite emailul de confirmare
            </button>
          </div>
        )}

        {needKey && (
          <div className="mt-6 text-center">
            <p className="text-red-500 font-bold mb-2">Încarcă cheia privată (.pem):</p>
            <input
              type="file"
              accept=".pem"
              onChange={handleUploadKey}
              className="mt-2"
            />
          </div>
        )}

        <div className="mt-4 text-center">
          <span className="text-gray-400">Nu ai cont? </span>
          <button
            type="button"
            className="text-primary-blue underline font-semibold"
            onClick={() => navigate("/register")}
          >
            Înregistrează-te
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;