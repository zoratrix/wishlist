import { Navigate } from 'react-router-dom';

/** Старый адрес настроек профиля: редактирование переехало на /app/profile/edit. */
export default function SettingsPage() {
 return <Navigate to="/app/profile/edit" replace />;
}
