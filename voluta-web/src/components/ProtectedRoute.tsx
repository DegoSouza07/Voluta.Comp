import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Layout } from './Layout';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null; // evita flash de tela de login enquanto valida o token salvo
  if (!user) return <Navigate to="/login" replace />;

  return <Layout>{children}</Layout>;
}
