import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { authHeaders, API_URL } from '../api/signaling';
import axios from 'axios';

const CallSelectPage: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
//   const [incomingCallId, setIncomingCallId] = useState

  let currentUser = "";
  if (token) {
    const decoded: any = jwtDecode(token);
    currentUser = decoded.sub;
  }

  useEffect(() => {
    if (!token) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/signaling/${currentUser}`, authHeaders());
        const activeCall = res.data.find((s: any) =>
          s.call_id.endsWith(currentUser) && s.type === "offer"
        );
        if (activeCall) {
          clearInterval(interval);
          navigate(`/call/${activeCall.call_id}`);
        }
      } catch (err) {
        console.error("Failed to check signaling", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [navigate, token]);

  if (!token) return <div>Not logged in</div>;

  const users = ["ana", "mihai", "geo", "alex"].filter(u => u !== currentUser);

  const callUser = (callee: string) => {
    const callId = `${currentUser}_${callee}`;
    navigate(`/call/${callId}`);
  };

  return (
    <div className="container mt-5">
      <h3>Selectează un utilizator pentru apel</h3>
      <ul className="list-group">
        {users.map(user => (
          <li key={user} className="list-group-item d-flex justify-content-between align-items-center">
            {user}
            <button className="btn btn-sm btn-success" onClick={() => callUser(user)}>Apelează</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CallSelectPage;
