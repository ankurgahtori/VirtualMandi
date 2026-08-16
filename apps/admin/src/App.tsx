import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAdminAuth } from './auth/auth-context';
import { LoginPage } from './pages/LoginPage';
import { PostFormPage } from './pages/PostFormPage';
import { PostsPage } from './pages/PostsPage';

const Protected = ({ children }: { children: ReactNode }) => {
  const { loading, user } = useAdminAuth();
  if (loading) return <div className="loading">Checking session…</div>;
  return user?.role === 'ADMIN' ? <>{children}</> : <Navigate to="/login" replace />;
};

export const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<Navigate to="/posts" replace />} />
    <Route
      path="/posts"
      element={
        <Protected>
          <PostsPage />
        </Protected>
      }
    />
    <Route
      path="/posts/new"
      element={
        <Protected>
          <PostFormPage />
        </Protected>
      }
    />
    <Route
      path="/posts/:id/edit"
      element={
        <Protected>
          <PostFormPage />
        </Protected>
      }
    />
    <Route path="*" element={<Navigate to="/posts" replace />} />
  </Routes>
);
