import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | undefined | null, isRtl: boolean = false, overrideCurrency?: string) {
  const currency = overrideCurrency || localStorage.getItem('pos_currency') || 'EGP';
  const validAmount = amount || 0;

  if (currency === 'EGP') {
    return isRtl ? `${validAmount.toFixed(2)} ج.م` : `EGP ${validAmount.toFixed(2)}`;
  }

  try {
    return new Intl.NumberFormat(isRtl ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: currency,
    }).format(validAmount);
  } catch (e) {
    return isRtl ? `${validAmount.toFixed(2)} ${currency}` : `${currency} ${validAmount.toFixed(2)}`;
  }
}

export function checkAccess(user: User | null | undefined, tabId: string, defaultRoles: string[]): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.permissions && user.permissions.includes(tabId)) return true;
  // Fallback for legacy cashier role without explicit permissions
  if (user.role === 'cashier' && defaultRoles.includes('cashier')) return true;
  return false;
}
