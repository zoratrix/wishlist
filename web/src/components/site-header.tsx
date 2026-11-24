import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth, useLogout } from '../hooks/use-auth';
import { Button, buttonClasses } from './button';
import { UserAvatar } from './user-avatar';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'nb-focus inline-flex min-h-11 items-center rounded-full border border-transparent px-3.5 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
      : 'text-ink/70 hover:text-ink',
  ].join(' ');
}

function tabLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'nb-focus m-1 flex min-h-14 items-center justify-center rounded-full px-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent-soft text-ink'
      : 'text-muted hover:text-ink',
  ].join(' ');
}

const BRAND_CLASS = [
  'nb-focus inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-ink bg-card px-2 py-1.5',
  'text-sm font-semibold leading-none tracking-tight text-ink',
  'transition-colors hover:border-ink/20 sm:text-base',
].join(' ');

/** Логотип «Хотелки» — круглый стикер с подарком. Общий для шапки и страниц входа. */
export function BrandSticker({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className={BRAND_CLASS} aria-label="Хотелки — на главную">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm"
      >
        🎁
      </span>
      <span>Хотелки</span>
    </Link>
  );
}

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const AUTHED_ITEMS: NavItem[] = [
  { to: '/app/feed', label: 'Лента' },
  { to: '/app/following', label: 'Подписки' },
  { to: '/app/profile', label: 'Профиль' },
];

/**
 * Единая шапка сайта: логотип-стикер, меню и аватар пользователя.
 * Для гостя — «Лента»/«Войти»; нижняя мобильная навигация только для вошедших.
 */
export function SiteHeader() {
  const { user } = useAuth();
  const logout = useLogout();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout.mutateAsync();
    } catch {
      // Сессия на сервере могла уже истечь — выходим из интерфейса в любом случае.
    }
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2 px-3 py-2 md:px-6 lg:px-8">
          <BrandSticker to={user ? '/app/profile' : '/'} />

          {user ? (
            <>
              <nav className="ml-4 hidden items-center gap-0.5 rounded-full bg-sky-soft p-1 md:flex" aria-label="Основная навигация">
                {AUTHED_ITEMS.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
                <Link
                  to="/app/profile"
                  className="nb-focus flex min-h-11 items-center gap-2 rounded-full border border-transparent px-1.5 hover:bg-paper"
                >
                  <UserAvatar
                    name={user.displayName}
                    username={user.username}
                    avatarPath={user.avatarPath}
                    size="sm"
                  />
                  <span className="hidden max-w-40 truncate text-sm font-medium text-ink sm:block">
                    {user.displayName}
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleLogout()}
                  loading={logout.isPending}
                >
                  Выйти
                </Button>
              </div>
            </>
          ) : (
            <nav className="ml-auto flex items-center gap-1.5 sm:gap-2" aria-label="Гостевая навигация">
              <Link to="/login" className={navLinkClass({ isActive: false })}>
                Лента
              </Link>
              <Link to="/login" className={buttonClasses('secondary', 'sm')}>
                Войти
              </Link>
            </nav>
          )}
        </div>
      </header>

      {user ? (
        <nav
          aria-label="Нижняя навигация"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <div className="mx-auto grid max-w-3xl grid-cols-3">
            {AUTHED_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={tabLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      ) : null}
    </>
  );
}
