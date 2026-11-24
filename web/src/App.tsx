import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/app-layout';
import { ProtectedRoute } from './components/protected-route';
import AccountProfilePage from './pages/account-profile';
import FeedPage from './pages/feed';
import FollowersPage from './pages/followers';
import FollowingPage from './pages/following';
import ForgotPasswordPage from './pages/forgot-password';
import HomePage from './pages/home';
import ListEditorPage from './pages/list-editor';
import ListSettingsPage from './pages/list-settings';
import LoginPage from './pages/login';
import NotFoundPage from './pages/not-found';
import ProfileEditPage from './pages/profile-edit';
import PublicListPage from './pages/public-list';
import PublicProfilePage from './pages/public-profile';
import RegisterPage from './pages/register';
import ResetPasswordPage from './pages/reset-password';
import SettingsPage from './pages/settings';

export default function App() {
 return (
 <Routes>
 <Route path="/" element={<HomePage />} />
 <Route path="/login" element={<LoginPage />} />
 <Route path="/register" element={<RegisterPage />} />
 <Route path="/forgot-password" element={<ForgotPasswordPage />} />
 <Route path="/reset-password" element={<ResetPasswordPage />} />
 <Route path="/u/:username" element={<PublicProfilePage />} />

 <Route element={<ProtectedRoute />}>
 <Route path="/app" element={<AppLayout />}>
 <Route index element={<Navigate to="/app/profile" replace />} />
 <Route path="feed" element={<FeedPage />} />
 <Route path="lists/:id" element={<ListEditorPage />} />
 <Route path="lists/:id/settings" element={<ListSettingsPage />} />
 <Route path="followers" element={<FollowersPage />} />
 <Route path="following" element={<FollowingPage />} />
 <Route path="profile" element={<AccountProfilePage />} />
 <Route path="profile/edit" element={<ProfileEditPage />} />
 <Route path="settings" element={<SettingsPage />} />
 </Route>
 </Route>

 <Route path="/w/:token" element={<PublicListPage />} />
 <Route path="*" element={<NotFoundPage />} />
 </Routes>
 );
}
