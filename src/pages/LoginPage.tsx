import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const login = async () => {
    try {
      const res = await axios.post("http://localhost:8000/auth/login", {
        username,
        password,
      });

      localStorage.setItem("token", res.data.access_token);
      window.location.href = "/"; // înlocuiește navigate('/') cu redirect complet
    } catch (err) {
      alert("Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-midnight">
      <div className="w-full max-w-md bg-darkblue p-8 rounded-2xl shadow-xl">
        <h3 className="text-2xl font-bold mb-6 text-primary-blue text-center">
          Login
        </h3>
        <input
          className="w-full mb-4 px-4 py-2 rounded-lg bg-almost-black text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-blue"
          type="text"
          placeholder="Username"
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
