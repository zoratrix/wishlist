import { Link, Navigate } from 'react-router-dom';
import { buttonClasses } from '../components/button';
import { FullPage } from '../components/states';
import { useAuth } from '../hooks/use-auth';

const card = 'rounded-3xl border border-line bg-card';
const pill = 'inline-flex items-center gap-1.5 rounded-full border border-ink bg-card px-3 py-1.5 text-xs text-muted';

const MOCK_GIFTS = [
  { emoji: '🎧', title: 'Беспроводные наушники', price: '4 990 ₽', booked: false },
  { emoji: '📚', title: 'Сертификат в книжный', price: '1 500 ₽', booked: true },
  { emoji: '🧸', title: 'Плюшевый мишка', price: '2 300 ₽', booked: false },
] as const;

const STEPS = [
  {
    title: 'Соберите список',
    text: 'Добавьте подарки с ценами и ссылками — вручную или из карточек товаров.',
    tone: 'bg-butter-soft',
    emoji: '📝',
  },
  {
    title: 'Отправьте ссылку',
    text: 'Одна короткая ссылка для близких. Гостям не нужно регистрироваться.',
    tone: 'bg-sky-soft',
    emoji: '🔗',
  },
  {
    title: 'Получайте подарки',
    text: 'Гости бронируют сами. В режиме сюрприза вы не увидите, кто что выбрал.',
    tone: 'bg-mint-soft',
    emoji: '🎁',
  },
] as const;

const FEATURES = [
  {
    emoji: '🙋',
    title: 'Гостям без регистрации',
    text: 'Бронирование по ссылке: гостю достаточно имени и email, аккаунт не нужен.',
    tone: 'bg-accent-soft',
  },
  {
    emoji: '🏷️',
    title: 'Категории и сортировка',
    text: 'Теги, приоритеты и фильтры помогают выбрать подарок за минуту.',
    tone: 'bg-sky-soft',
  },
  {
    emoji: '🎨',
    title: 'Темы и обложки',
    text: 'Оформление под настроение: цвет темы, эмодзи-фон и обложка списка.',
    tone: 'bg-lavender-soft',
  },
  {
    emoji: '💌',
    title: 'Подписки и лента',
    text: 'Следите за списками близких и не пропускайте их дни рождения.',
    tone: 'bg-mint-soft',
  },
] as const;

/** Лендинг для гостя; вошедшего сразу отправляем в приложение. */
export default function HomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <FullPage>
        <p className="text-sm text-muted">Загрузка…</p>
      </FullPage>
    );
  }

  if (user) {
    return <Navigate to="/app/profile" replace />;
  }

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-paper/95">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3 md:px-6">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink bg-card px-2 py-1.5 text-sm font-semibold text-ink"
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm"
            >
              🎁
            </span>
            Хотелки
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Навигация лендинга">
            <a
              href="#features"
              className="rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              Возможности
            </a>
            <a
              href="#how"
              className="rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              Как это работает
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm font-medium text-ink hover:bg-card"
            >
              Войти
            </Link>
            <Link to="/register" className={buttonClasses('primary', 'sm')}>
              Создать список
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 md:px-6 md:pt-12">
        <section className="relative grid items-center gap-8 md:grid-cols-[1.05fr_1fr] md:gap-10">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-butter-soft px-3 py-1.5 text-xs font-medium text-ink">
              🎁 Подарки без спойлеров
            </span>
            <h1 className="mt-4 text-[2rem] leading-tight tracking-tight text-ink sm:text-4xl md:text-[2.75rem]">
              Списки желаний, которые действительно дарят
            </h1>
            <p className="mt-3 max-w-xl text-base text-muted">
              Хотелки — простой сервис вишлистов для себя и близких. Делитесь ссылкой,
              а гости бронируют подарки без регистрации и не портят сюрприз.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/register" className={buttonClasses('primary', 'md')}>
                Создать список
              </Link>
              <Link to="/login" className={buttonClasses('secondary', 'md')}>
                Войти
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className={pill}>
                <span aria-hidden="true">🙋</span> гостям не нужен аккаунт
              </span>
              <span className={pill}>
                <span aria-hidden="true">🔗</span> короткая ссылка
              </span>
              <span className={pill}>
                <span aria-hidden="true">🎨</span> свои темы
              </span>
            </div>
          </div>

          {/* Мокап списка: без картинок, только пастельные блоки и подписи. */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -left-3 top-6 h-24 w-24 rounded-full bg-sky-soft blur-[1px] sm:h-32 sm:w-32"
            />
            <div
              aria-hidden="true"
              className="absolute -right-2 bottom-10 h-20 w-20 rounded-full bg-powder-soft sm:h-24 sm:w-24"
            />
            <div className={`${card} relative p-4 sm:p-5 md:p-6`}>
              <div className="flex items-center gap-3 border-b border-line pb-4">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-butter-soft text-xl"
                >
                  🎂
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">День рождения</p>
                  <p className="text-xs text-muted">15 апреля · 8 подарков</p>
                </div>
                <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-ink">
                  🎁 ссылка
                </span>
              </div>

              <ul className="mt-3 space-y-2">
                {MOCK_GIFTS.map((gift) => (
                  <li
                    key={gift.title}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-card p-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-lg"
                    >
                      {gift.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{gift.title}</p>
                      <p className="text-xs text-muted">{gift.price}</p>
                    </div>
                    <span
                      className={[
                        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium',
                        gift.booked ? 'bg-powder-soft text-ink' : 'bg-mint-soft text-ink',
                      ].join(' ')}
                    >
                      {gift.booked ? 'Забронирован' : 'Свободен'}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
                <span className="rounded-full border border-dashed border-ink/30 px-2.5 py-1 text-[11px] text-muted">
                  до 15 апреля
                </span>
                <span className={buttonClasses('primary', 'sm')}>Поделиться</span>
              </div>
            </div>
          </div>
        </section>

        {/* Маленький баннер-полоса. */}
        <section className="mt-10 md:mt-12">
          <div className="flex flex-col gap-3 rounded-3xl bg-sky-soft p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
            <p className="text-sm text-ink">
              <span aria-hidden="true">🎁</span> Гости бронируют подарки без регистрации — и
              не портят сюрприз.
            </p>
            <a
              href="#how"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/15 bg-card px-4 text-sm font-medium text-ink hover:border-ink/30"
            >
              Как это работает ↓
            </a>
          </div>
        </section>

        <section id="how" className="mt-12 md:mt-16">
          <h2 className="text-2xl text-ink md:text-3xl">Как это работает</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <article key={step.title} className={`${card} p-5`}>
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${step.tone}`}
                  >
                    {step.emoji}
                  </span>
                  <span className="text-xs font-medium text-muted">Шаг {index + 1}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="mt-12 md:mt-16">
          <h2 className="text-2xl text-ink md:text-3xl">Что внутри</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <article key={feature.title} className={`${card} p-5`}>
                <span
                  aria-hidden="true"
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${feature.tone}`}
                >
                  {feature.emoji}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 md:mt-16">
          <div className={`${card} px-5 py-8 text-center md:px-10 md:py-12`}>
            <h2 className="text-2xl text-ink md:text-3xl">Готовы собрать свой список?</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
              Создайте вишлист за пару минут, добавьте подарки и отправьте короткую ссылку
              близким.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link to="/register" className={buttonClasses('primary', 'md')}>
                Создать список
              </Link>
              <Link to="/login" className={buttonClasses('secondary', 'md')}>
                Войти
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between md:px-6">
          <p className="font-medium text-ink">Хотелки · 2026</p>
          <p>Списки желаний без спойлеров. Гостям не нужен аккаунт.</p>
        </div>
      </footer>
    </div>
  );
}
