import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  ChefHat,
  Package,
  BarChart3,
  Users,
  Truck,
  Settings,
  LogOut,
  Languages,
  Bell,
  Wallet,
  Shield,
  ShoppingBag,
  Store
} from 'lucide-react';
import { cn, checkAccess } from '../utils';
import { listenToInventory } from '../services/db';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useRestaurantId } from '../context/RestaurantContext';

interface Ingredient {
  id: number | string;
  name: string;
  stock_level: number;
  min_stock: number;
  unit: string;
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isRtl: boolean;
  setIsRtl: (rtl: boolean) => void;
  user: any;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isRtl, setIsRtl, user, onLogout }) => {
  const restaurantId = useRestaurantId();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Ingredient[]>([]);
  const [onlineOrdersCount, setOnlineOrdersCount] = useState(0);
  const isInitialLoad = React.useRef(true);

  // Play a simple double beep using Web Audio API
  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const playBeep = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0.1, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playBeep(880, now, 0.1);
      playBeep(1760, now + 0.15, 0.15);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  useEffect(() => {
    // Listen to real-time inventory updates for low stock notifications
    const unsub = listenToInventory(restaurantId, (data: Ingredient[]) => {
      const lowStock = data.filter(item => item.stock_level <= item.min_stock);
      setNotifications(lowStock);

      // Trigger popup toast notifications (once per item)
      lowStock.forEach(item => {
        // We use the item ID as the toast ID so it doesn't duplicate if already showing
        toast.error(
          isRtl
            ? `مخزون منخفض: ${item.name} (${item.stock_level} ${item.unit})`
            : `Low stock: ${item.name} (${item.stock_level} ${item.unit})`,
          { id: `low-stock-${item.id}` }
        );
      });
    });

    // Listen to online orders scoped to this restaurant
    const q = query(
      collection(db, 'restaurants', restaurantId, 'online_orders'),
      where('status', '==', 'pending_online')
    );
    const unsubOrders = onSnapshot(q, (snapshot) => {
      setOnlineOrdersCount(snapshot.docs.length);

      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }

      const addedDocs = snapshot.docChanges().filter(change => change.type === 'added');
      if (addedDocs.length > 0) {
        playNotificationSound();
        toast.success(isRtl ? 'طلب أونلاين جديد!' : 'New Online Order!', {
          icon: '🔔',
          duration: 4000
        });
      }
    });

    return () => {
      unsub();
      unsubOrders();
    };
  }, [isRtl, restaurantId]);
  const menuItems = [
    { id: 'pos', icon: ShoppingCart, label: isRtl ? 'نقطة البيع' : 'POS', roles: ['admin', 'cashier'] },
    { id: 'online_orders', icon: ShoppingBag, label: isRtl ? 'طلبات الأونلاين' : 'Online Orders', roles: ['admin', 'cashier'], badge: onlineOrdersCount },
    { id: 'kds', icon: ChefHat, label: isRtl ? 'المطبخ' : 'KDS', roles: ['admin', 'cashier'] },
    { id: 'dashboard', icon: LayoutDashboard, label: isRtl ? 'لوحة التحكم' : 'Dashboard', roles: ['admin'] },
    { id: 'inventory', icon: Package, label: isRtl ? 'المخزون' : 'Inventory', roles: ['admin'] },
    { id: 'customers', icon: Users, label: isRtl ? 'العملاء' : 'Customers', roles: ['admin'] },
    { id: 'drivers', icon: Truck, label: isRtl ? 'الطيارين' : 'Drivers', roles: ['admin'] },
    { id: 'expenses', icon: Wallet, label: isRtl ? 'المصروفات' : 'Expenses', roles: ['admin', 'cashier'] },
    { id: 'reports', icon: BarChart3, label: isRtl ? 'التقارير' : 'Reports', roles: ['admin'] },
    { id: 'settings', icon: Settings, label: isRtl ? 'الإعدادات' : 'Settings', roles: ['admin'] },
    { id: 'view_menu', icon: Store, label: isRtl ? 'المنيو المباشر' : 'Live Menu', roles: ['admin', 'cashier'], external: true },
  ].filter(item => checkAccess(user, item.id, item.roles));

  return (
    <aside className={cn(
      "bg-brand-900 text-white flex border-brand-800 transition-all z-40 shrink-0",
      "md:flex-col md:w-[80px] md:h-full md:py-6 md:border-r",
      "flex-row w-full h-[70px] px-2 py-0 border-t order-last md:order-first"
    )}>
      <div className="hidden md:flex w-12 h-12 bg-white rounded-xl items-center justify-center text-brand-900 font-bold text-xl shadow-lg mx-auto mb-8">
        CP
      </div>

      <nav className="flex-1 flex md:flex-col flex-row justify-around md:justify-start gap-1 md:gap-4 w-full md:px-2 items-center overflow-y-auto no-scrollbar pb-2 md:pb-0">
        {menuItems.map((item: any) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.external) {
                window.open(`/${restaurantId}`, '_blank');
              } else {
                setActiveTab(item.id);
              }
            }}
            className={cn(
              "p-2 md:p-3 rounded-xl transition-all duration-200 flex flex-col items-center gap-1 group relative",
              activeTab === item.id
                ? "bg-white text-brand-900 shadow-md"
                : "text-brand-300 hover:bg-brand-800 hover:text-white"
            )}
            title={item.label}
          >
            <item.icon size={22} className="md:w-6 md:h-6" />
            {item.badge ? (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center border border-brand-900 shadow-md">
                {item.badge}
              </span>
            ) : null}
            <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity absolute md:-bottom-4 -top-8 md:top-auto bg-brand-950 text-white px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="hidden md:flex flex-col gap-4 mt-auto items-center">
        <button
          onClick={() => setIsRtl(!isRtl)}
          className="p-3 text-brand-300 hover:text-white transition-colors"
          title={isRtl ? 'English' : 'العربية'}
        >
          <Languages size={24} />
        </button>
        <div className="relative">
          <button
            className="p-3 text-brand-300 hover:text-white transition-colors relative"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={24} />
            {notifications.length > 0 && (
              <span className="absolute top-1 max-md:right-1 md:right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-brand-900">
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className={cn(
              "absolute bottom-0 mb-14 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col",
              isRtl ? "right-full mr-4" : "left-full ml-4"
            )}>
              <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h4 className="font-bold text-slate-800 text-sm">{isRtl ? 'الإشعارات' : 'Notifications'}</h4>
                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {notifications.length} {isRtl ? 'جديد' : 'New'}
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    {isRtl ? 'لا توجد إشعارات' : 'No notifications'}
                  </div>
                ) : (
                  notifications.map(item => (
                    <div key={item.id} className="p-3 border-b border-slate-50 hover:bg-slate-50 flex items-start gap-3 transition-colors cursor-pointer" onClick={() => { setActiveTab('inventory'); setShowNotifications(false); }}>
                      <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                        <Package size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-red-500 mt-0.5">
                          {isRtl ? 'مخزون منخفض' : 'Low stock'}: {item.stock_level} {item.unit}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onLogout}
          className="p-3 text-brand-300 hover:text-red-400 transition-colors"
          title={isRtl ? 'تسجيل الخروج' : 'Logout'}
        >
          <LogOut size={24} />
        </button>
      </div>

      {/* Mobile Actions Container */}
      <div className="flex md:hidden items-center px-2 gap-2 border-l border-brand-800/50">
        <button
          onClick={() => setIsRtl(!isRtl)}
          className="p-2 text-brand-300 hover:text-white transition-colors"
          title={isRtl ? 'English' : 'العربية'}
        >
          <Languages size={20} />
        </button>
        <button
          onClick={onLogout}
          className="p-2 text-brand-300 hover:text-red-400 transition-colors"
          title={isRtl ? 'تسجيل الخروج' : 'Logout'}
        >
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  );
};
