import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';

export interface Product {
  id: string;
  category_id: string;
  name: string;
  name_ar?: string;
  price: number;
  cost?: number; // legacy
  food_cost?: number;
  image?: string;
  active: boolean;
  stock_tracking?: boolean;
  sizes?: {
    mini?: number;
    medium?: number;
    large?: number;
    roll?: number;
  };
  created_at?: string;
}

export interface Category {
  id: number | string;
  name: string;
  name_ar: string;
  created_at?: string;
}

export interface OrderItem {
  id?: number | string;
  product_id: number | string;
  name: string;
  category_name?: string;
  quantity: number;
  price: number;
  selectedSize?: 'mini' | 'medium' | 'large' | 'roll';
}

export interface Order {
  id: number | string;
  daily_id?: number;
  status: OrderStatus;
  type: 'dine-in' | 'takeaway' | 'delivery';
  table_number?: string;
  driver_id?: string;
  delivery_fee?: number;
  customer?: { id?: string, name: string, phone: string, address?: string };
  total_amount: number;
  is_paid?: boolean;
  payment_method?: string;
  created_at?: string;
  items: OrderItem[];
}

export interface OnlineOrder extends Order {
  customer: {
    name: string;
    phone: string;
    whatsapp?: string;
    address: string;
    birthday?: string;
  };
}

export interface User {
  id: number | string;
  username: string;
  role: string;
  permissions?: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  whatsapp?: string;
  birthday?: string; // ISO String or YYYY-MM-DD
  created_at: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  status: 'available' | 'busy';
  created_at: string;
}

export interface Expense {
  id: string;
  amount: number;
  reason: string;
  date: string; // ISO String
}
