import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { PostDetailPage } from './pages/PostDetailPage';
import { PublicPlanPage } from './pages/PublicPlanPage';
// HashRouter de propósito — funciona em qualquer hospedagem estática
// (GitHub Pages incluso) sem precisar configurar rewrite de servidor pra
// rotas client-side. Trade-off: URLs com # no meio, aceitável pra um
// painel interno.
export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/clients" replace />} />
          <Route path="/plano/:slug" element={<PublicPlanPage />} />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <ClientsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients/:clientId"
            element={
              <ProtectedRoute>
                <ClientDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <ProtectedRoute>
                <ProjectDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/posts/:postId"
            element={
              <ProtectedRoute>
                <PostDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/clients" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}