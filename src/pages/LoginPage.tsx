import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const login = async () => {
    try {
      const res = await axios.post('http://localhost:8000/auth/login', {
        username,
        password
      });
  
      localStorage.setItem('token', res.data.access_token);
      window.location.href = '/'; // înlocuiește navigate('/') cu redirect complet
    } catch (err) {
      alert('Login failed');
    }
  };
  
  

  return (
    <div className="container mt-5" style={{ maxWidth: '400px' }}>
      <h3 className="text-center mb-4">Login</h3>
      <input
        className="form-control mb-3"
        type="text"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />
      <input
        className="form-control mb-3"
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button className="btn btn-primary w-100" onClick={login}>Login</button>
    </div>
  );
};

export default LoginPage;
