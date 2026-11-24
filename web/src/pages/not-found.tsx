import { buttonClasses } from '../components/button';

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <span
        aria-hidden="true"
        className="inline-block rounded-3xl bg-accent px-6 py-3 text-5xl font-semibold leading-none text-ink"
      >
        404
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Страница не найдена</h1>
      <p className="max-w-sm text-sm font-medium text-muted">
        Возможно, ссылка устарела или список стал доступен только по приглашению.
      </p>
      <a href="/" className={buttonClasses('primary')}>
        На главную
      </a>
    </main>
  );
}
