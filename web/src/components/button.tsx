import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

/**
 * Кнопка-«наклейка»: чёрная рамка 2px, жёсткая тень 4px и сдвиг при наведении.
 * primary/secondary — светлый фон с ink-текстом, белый текст только на тёмном danger.
 */
const BASE = [
  'inline-flex min-w-0 items-center justify-center gap-2 rounded-full border',
  'text-center font-semibold leading-tight',
  'nb-focus transition-[transform,box-shadow,background-color,border-color] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-ink bg-accent text-ink nb-accent-shadow hover:bg-[#eed95f]',
  secondary: 'border-ink bg-card text-ink hover:bg-paper',
  ghost: 'border-ink bg-transparent text-ink hover:bg-paper',
  danger: 'border-ink bg-danger-soft text-danger hover:bg-powder-soft',
};

/* min-h-11 — тач-цель не меньше 44px на любой ширине экрана. */
const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4 py-2 text-base',
  sm: 'min-h-11 px-3 py-2 text-sm',
};

/** Общие классы кнопки — чтобы ссылки выглядели так же, как кнопки. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return [BASE, VARIANTS[variant], SIZES[size]].join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[buttonClasses(variant, size), className ?? ''].join(' ').trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {children}
    </button>
  );
}
