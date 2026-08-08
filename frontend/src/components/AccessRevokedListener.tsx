import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  ACCESS_REVOKED_MESSAGE,
  onAccessRevoked,
} from '../lib/access-revoked';
import { setAccessToken } from '../api/token-store';
import Modal from './Modal';

/** Central session teardown on access-revoked / failed refresh. */
export default function AccessRevokedListener() {
  const { signOut, user, status } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(ACCESS_REVOKED_MESSAGE);

  useEffect(() => {
    return onAccessRevoked((detail) => {
      setMessage(detail.message || ACCESS_REVOKED_MESSAGE);
      setOpen(true);
      setAccessToken(null);
      void signOut().finally(() => {
        const role = user?.role;
        if (role === 'AGENCY') navigate('/agency/login', { replace: true });
        else if (role === 'USER' || !role) navigate('/signin', { replace: true });
        else navigate('/login', { replace: true });
      });
    });
  }, [navigate, signOut, user?.role]);

  // Also listen for DOM CustomEvent from non-React callers.
  useEffect(() => {
    if (status !== 'authenticated') return;
    function onWindowEvent(e: Event) {
      const ce = e as CustomEvent<{ message?: string }>;
      setMessage(ce.detail?.message || ACCESS_REVOKED_MESSAGE);
      setOpen(true);
    }
    window.addEventListener('access-revoked', onWindowEvent);
    return () => window.removeEventListener('access-revoked', onWindowEvent);
  }, [status]);

  if (!open) return null;

  return (
    <Modal title="قطع دسترسی" onClose={() => setOpen(false)} variant="dark">
      <div data-testid="access-revoked-dialog" className="space-y-4">
        <p className="m-0 text-[13px] leading-7 text-[#c7d2e3]">{message}</p>
        <button
          type="button"
          data-testid="access-revoked-ack"
          onClick={() => setOpen(false)}
          className="rounded-[10px] bg-[#1668c4] px-4 py-2.5 text-xs font-extrabold text-white"
        >
          متوجه شدم
        </button>
      </div>
    </Modal>
  );
}
