import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Button, ErrorBanner, Field, TextInput } from '../components/ui';
import { ApiError } from '../lib/api';
import s from './LoginPage.module.css';

const LOGO_SQUARES = ['#f2c33c', '#e8583f', '#e85f9c', '#3f6ad8', '#ffffff', '#3fb6d8', '#7a4fd6', '#2f9e5e', '#f2a33c'];

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/clients" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={s.screen}>
      <div className={s.hero}>
        <div className={s.heroTop}>
          <span className={s.brandMark}>
            {LOGO_SQUARES.map((color, i) => (
              <span key={i} style={{ background: color }} />
            ))}
          </span>
        </div>
        <div>
          <h1 className={s.heroTitle}>
            Plano
            <br />
            <em>Visual</em>
          </h1>
        </div>
        <p className={s.heroFoot}>
          O painel de controle da Voluta — do upload do ensaio à aprovação do cliente, num lugar só.
        </p>
      </div>

      <div className={s.formSide}>
        <form className={s.formCard} onSubmit={handleSubmit}>
          <h2 className={s.formTitle}>Entrar</h2>
          <p className={s.formSubtitle}>Use suas credenciais da equipe Voluta.</p>

          <ErrorBanner>{error}</ErrorBanner>

          <Field label="E-mail">
            <TextInput
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Senha">
            <TextInput
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <div className={s.submitRow}>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
