import { useAuth } from '../context/AuthContext';
import LoginPage from './LoginPage';

export default function ProtectedRoute({ children, fallback = <LoginPage /> }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'var(--bg, #f8fafc)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 border-4 border-solid rounded-full animate-spin"
            style={{
              borderColor: 'rgba(15, 23, 42, 0.15)',
              borderTopColor: 'var(--navy, #0f172a)',
            }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--sub, #64748b)' }}>
            Checking WeatherGPT session…
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return fallback;
  }

  return children;
}
