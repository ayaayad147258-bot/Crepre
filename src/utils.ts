import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, isRtl: boolean = false) {
  const currency = localStorage.getItem('pos_currency') || 'EGP';

  if (currency === 'EGP') {
    return isRtl ? `${amount.toFixed(2)} ج.م` : `EGP ${amount.toFixed(2)}`;
  }

  return new Intl.NumberFormat(isRtl ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function checkAccess(user: User | null | undefined, tabId: string, defaultRoles: string[]): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.permissions && user.permissions.includes(tabId)) return true;
  // Fallback for legacy cashier role without explicit permissions
  if (user.role === 'cashier' && defaultRoles.includes('cashier')) return true;
  return false;
}
