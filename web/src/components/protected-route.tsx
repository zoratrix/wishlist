import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { ErrorBlock, FullPage } from './states';

/** Пускает только авторизованных; гость уходит на /login, запомнив адрес. */
export function ProtectedRoute() {
 const { user, isLoading, isError, error, refetch } = useAuth();
 const location = useLocation();

 if (isLoading) {
 return (
 <FullPage>
 <p className="text-sm text-muted">Проверяем вход…</p>
 </FullPage>
 );
 }

 if (isError) {
 return (
 <FullPage>
 <ErrorBlock message={error?.message ?? 'Не удалось проверить вход.'} onRetry={refetch} />
 </FullPage>
 );
 }

 if (!user) {
 return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
 }

 return <Outlet />;
}
