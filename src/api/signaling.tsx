import axios from 'axios';

export const API_URL = 'http://localhost:8000';

const getToken = () => localStorage.getItem("token");

export const authHeaders = () => ({
  headers: {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json'
  }
});

export const sendSignaling = async (callId: string, type: string, content: string) => {
  return axios.post(`${API_URL}/signaling/send`, {
    call_id: callId,
    type,
    content
  }, authHeaders());
};

export const getSignaling = async (callId: string, type: string) => {
  const res = await axios.get(`${API_URL}/signaling/${callId}/${type}`, authHeaders());
  return res.data;
};

export const deleteSignaling = async (callId: string) => {
    await axios.delete(`${API_URL}/signaling/${callId}`, authHeaders());
};