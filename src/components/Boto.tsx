import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'principal' | 'secundari' | 'discret'
}

export function Boto({ variant = 'principal', className = '', type = 'button', ...props }: Props) {
  return <button type={type} className={`boto boto-${variant} ${className}`} {...props} />
}
