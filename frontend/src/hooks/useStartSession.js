import { useNavigate } from 'react-router-dom';
import { studySessionAPI } from '../services/api.js';

/** Start a planned study session and open the focus screen; `returnTo` is where finishing leads. */
export default function useStartSession(returnTo) {
  const navigate = useNavigate();
  return async (session) => {
    await studySessionAPI.start(session.id);
    navigate(`/study-session/${session.id}`, returnTo ? { state: { returnTo } } : undefined);
  };
}
