import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../api/signaling";
import {
  generateKeyPair,
  exportPrivateKeyPEM,
  exportPublicKeyPEM,
  downloadPEM,
} from "../api/cryptoUtils";

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !email.trim() || !password || !password2) {
      setError("Completează toate câmpurile!");
      return;
    }
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setError("Email invalid!");
      return;
    }
    if (password !== password2) {
      setError("Parolele nu coincid!");
      return;
    }

    setLoading(true);
    try {
      const { publicKey, privateKey } = await generateKeyPair();
      const publicKeyPEM = await exportPublicKeyPEM(publicKey);
      const privateKeyPEM = await exportPrivateKeyPEM(privateKey);

      await axios.post(`${API_URL}/auth/register`, {
        username,
        email,
        password,
        public_key: publicKeyPEM,
      });

      downloadPEM(privateKeyPEM, "private_key.pem");
      alert(
        "Cheia privată a fost generată. Salvează fișierul cu grijă! Nu o vei mai putea descărca ulterior."
      );

      localStorage.setItem("privateKeyPEM", privateKeyPEM);
      localStorage.setItem("registeredUsername", username);
      localStorage.setItem("registeredPassword", password);

      // ✅ Afișăm mesaj de succes și dezactivăm butonul
      setSuccessMessage("Cont creat! Verifică emailul pentru confirmare.");
    } catch (err: any) {
      setError(
        err?.response?.data?.detail
          ? String(err.response.data.detail)
          : "Eroare la înregistrare!"
      );
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-midnight via-darkblue to-almost-black py-8">
      <div className="w-full max-w-md bg-darkblue/90 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
        <h2 className="text-2xl font-bold text-primary-blue text-center mb-6 drop-shadow">
          Înregistrare cont nou
        </h2>
        <form className="flex flex-col gap-4" onSubmit={handleRegister}>
          <input
            type="text"
            className="rounded-lg px-4 py-2 bg-midnight text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
            placeholder="Username"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            disabled={!!successMessage}
          />
          <input
            type="email"
            className="rounded-lg px-4 py-2 bg-midnight text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
            placeholder="Email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!successMessage}
          />
          <input
            type="password"
            className="rounded-lg px-4 py-2 bg-midnight text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
            placeholder="Parolă"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            disabled={!!successMessage}
          />
          <input
            type="password"
            className="rounded-lg px-4 py-2 bg-midnight text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
            placeholder="Confirmă parolă"
            value={password2}
            autoComplete="new-password"
            onChange={(e) => setPassword2(e.target.value)}
            disabled={!!successMessage}
          />

          {error && <div className="text-red-400 text-center">{error}</div>}
          {successMessage && <div className="text-green-400 text-center font-semibold">{successMessage}</div>}

          <button
            type="submit"
            className="py-2 rounded-xl bg-primary-blue hover:bg-accent-blue text-white font-bold shadow transition"
            disabled={loading || !!successMessage}
          >
            {loading ? "Se înregistrează..." : successMessage ? "Așteaptă confirmarea..." : "Creează cont"}
          </button>
        </form>
        <div className="mt-4 text-center">
          <span className="text-gray-400">Ai deja cont? </span>
          <button
            type="button"
            className="text-primary-blue underline font-semibold"
            onClick={() => navigate("/login")}
            disabled={!!successMessage}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
