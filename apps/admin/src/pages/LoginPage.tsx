import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../auth/auth-context';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, error } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      navigate('/posts');
    } catch {
      /* error is displayed by context */
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <form className="panel auth-card" onSubmit={submit}>
        <div className="brand-mark">Virtual Mandi</div>
        <h1>Admin sign in</h1>
        <p className="muted">Manage agricultural content and translations.</p>
        <label>
          Email
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            required
            minLength={8}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
};
