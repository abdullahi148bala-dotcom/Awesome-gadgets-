import { useState } from 'react';
import { ArrowLeft, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { ownerApi } from '../lib/supabase';

const SESSION = 'web-forge-owner-session-v1';
const STORE = 'web-forge-owner-store-v1';

const cleanCode = value => value.replace(/[^0-9]/g, '').slice(0, 8);

export default function OwnerAuth({ go }) {
  const [mode, setMode] = useState('login');
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async e => {
    e.preventDefault();
    setMsg('');

    if (!/^[0-9]{8}$/.test(code)) {
      setMsg('Enter exactly 8 digits.');
      return;
    }

    if (mode === 'change' && code !== confirm) {
      setMsg('The two codes do not match.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        const r = await ownerApi({ action: 'login', code });
        localStorage.setItem(SESSION, r.token);
        localStorage.setItem(STORE, JSON.stringify(r.store));

        if (r.forceChange) {
          setMode('change');
          setCode('');
          setConfirm('');
          setMsg('This is your temporary code. Choose your permanent 8-digit code below.');
        } else {
          go('owner/dashboard');
        }
      } else {
        const r = await ownerApi({
          action: 'change_code',
          token: localStorage.getItem(SESSION),
          newCode: code
        });
        localStorage.setItem(SESSION, r.token);
        setCode('');
        setConfirm('');
        setMsg('Access code changed.');
        setMode('login');
        go('owner/dashboard');
      }
    } catch (err) {
      setMsg(err.message || 'Could not complete the request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="owner-shell">
      <button className="owner-back" onClick={() => go('home')}>
        <ArrowLeft /> Back to site
      </button>

      <div className="owner-card">
        <p className="eyebrow">WEB FORGE / OWNER AREA</p>
        <div className="owner-auth-icon"><KeyRound /></div>
        <h1>{mode === 'login' ? 'Owner access.' : 'Choose your access code.'}</h1>
        <p className="owner-muted">
          {mode === 'login'
            ? 'Enter the 8-digit code Web Forge gave you.'
            : 'Your temporary code has done its job. Choose a new 8-digit code that you will use from now on.'}
        </p>

        <form className="owner-form" onSubmit={submit}>
          <label>
            {mode === 'login' ? '8-digit access code' : 'New 8-digit access code'}
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength="8"
              pattern="[0-9]{8}"
              value={code}
              onChange={e => setCode(cleanCode(e.target.value))}
              placeholder="••••••••"
              required
            />
          </label>

          {mode === 'change' && (
            <label>
              Confirm new code
              <input
                inputMode="numeric"
                maxLength="8"
                pattern="[0-9]{8}"
                value={confirm}
                onChange={e => setConfirm(cleanCode(e.target.value))}
                placeholder="••••••••"
                required
              />
            </label>
          )}

          {msg && <p className="owner-message">{msg}</p>}

          <button className="primary full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Continue' : 'Set new code'}
            {mode === 'login' ? <ArrowRight /> : <ShieldCheck />}
          </button>
        </form>

        {mode === 'login' && (
          <p className="owner-security-note">
            Never share your owner access code publicly. If it is compromised, Web Forge can revoke and replace it.
          </p>
        )}
      </div>
    </section>
  );
}
