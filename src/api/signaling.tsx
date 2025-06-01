import axios from "axios";
export const API_URL = "http://localhost:8000";

export function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    headers: { Authorization: `Bearer ${token}` }
  };
}

export function sendSignaling(
  callId: string,
  type: "offer" | "answer" | "ice" | "end" | "screen-share",
  content: string,
  targetUser?: string
) {
  return axios.post(
    `${API_URL}/signaling/send${targetUser ? "?target_user=" + targetUser : ""}`,
    { call_id: callId, type, content },
    authHeaders()
  );
}

export function getSignaling(
  callId: string,
  type: "offer" | "answer" | "ice" | "end" | "screen-share",
  forUser: string
) {
  return axios
    .get(`${API_URL}/signaling/${callId}/${type}`, {
      params: { for_user: forUser },
      ...authHeaders()
    })
    .then((r) => r.data);
}

export function deleteSignaling(callId: string) {
  return axios.delete(`${API_URL}/signaling/${callId}`, authHeaders());
}

export function joinCall(callId: string) {
  return axios.post(`${API_URL}/calls/${callId}/join`, {}, authHeaders());
}

export function leaveCall(callId: string) {
  return axios.post(`${API_URL}/calls/${callId}/leave`, {}, authHeaders());
}

export const getParticipants = (callId: string) =>
  axios.get(`${API_URL}/calls/${callId}/participants`, authHeaders());

export function getInvitations() {
  return axios.get(`${API_URL}/calls/invitations`, authHeaders());
}
