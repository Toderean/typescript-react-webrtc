import axios from "axios";

export const API_URL = "http://localhost:8000";

export type SignalingType =
  | "offer"
  | "answer"
  | "ice"
  | "end"
  | "screen-share"
  | "session-key";

interface Chunk {
  content: string;
}

interface ParsedChunk {
  index: number;
  total: number;
  content: string;
}

export function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    headers: { Authorization: `Bearer ${token}` },
  };
}

const sentKeys = new Set<string>();

export async function sendSignaling(
  callId: string,
  type: SignalingType,
  content: string,
  targetUser?: string
) {
  const dedupKey = `${callId}-${type}-${targetUser}`;
  if (type === "session-key" && sentKeys.has(dedupKey)) {
    console.warn("⚠️ Cheia de sesiune a fost deja trimisă, ignor.");
    return;
  }

  await axios.post(`${API_URL}/signaling/send`, {
    call_id: callId,
    type,
    content,
    target_user: targetUser,
  }, authHeaders());

  if (type === "session-key") {
    sentKeys.add(dedupKey);
  }
}



export async function getSignaling(callId: string, type: SignalingType, user: string) {
  const res = await axios.get(`${API_URL}/signaling/${callId}/${type}`, {
    ...authHeaders(),
    params: { for_user: user },
  });
  return res.data;
}




export async function getSignalingMerged(
  callId: string,
  type: SignalingType,
  forUser: string
): Promise<string | null> {
  const metaChunks: Chunk[] = await getSignaling(
    callId,
    `${type}-meta` as SignalingType,
    forUser
  );
  if (!metaChunks.length) {
    console.warn(`⚠️ Nu există metadata pentru semnalul ${type}`);
    return null;
  }

  

  const totalExpected = parseInt(metaChunks[0].content, 10);

  const chunks: Chunk[] = await getSignaling(callId, type, forUser);
  if (!chunks.length) return null;

  const parsed: ParsedChunk[] = chunks
    .map((chunk: Chunk): ParsedChunk | null => {
      const match = chunk.content.match(/^(\d+)\/(\d+):(.*)$/);
      if (!match) return null;
      return {
        index: Number(match[1]),
        total: Number(match[2]),
        content: match[3],
      };
    })
    .filter((p): p is ParsedChunk => !!p);

  console.log(`🔍 Reconstruim ${type} cu ${parsed.length}/${totalExpected} bucăți.`);
  parsed.forEach(p => {
    console.log(`🧩 Chunk ${p.index + 1}/${p.total} — lungime: ${p.content.length}`);
  });
  
  if (parsed.some(p => p.content.length === 0)) {
    console.warn("❗ Un chunk are conținut gol. Datele pot fi corupte.");
  }
  
  
  if (
    parsed.length !== totalExpected ||
    parsed.some((p) => p.total !== totalExpected)
  ) {
    console.warn(
      `⏳ Încă aștept bucățile semnalului... (${parsed.length}/${totalExpected})`
    );
    return null;
  }

  parsed.sort((a, b) => a.index - b.index);

  return parsed.map((p) => p.content).join("");
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

export async function getPublicKey(username: string): Promise<string> {
  const res = await axios.get(`${API_URL}/users/${username}`, authHeaders());
  return res.data.public_key;
}

export async function getSessionKey(callId: string) {
  return axios.get(`${API_URL}/calls/${callId}/session_key`, authHeaders());
}

