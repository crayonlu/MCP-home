import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  size?: 'default' | 'small' | 'icon';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'default',
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps): ReactNode {
  return (
    <button
      type={type}
      className={cn('button', `button-${variant}`, `button-${size}`, className)}
      {...props}
    >
      {children}
    </button>
  );
}
