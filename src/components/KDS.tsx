import React, { useState, useEffect } from 'react';
import { Order, OrderStatus } from '../types';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, PlayCircle, Truck } from 'lucide-react';
import { listenToOrders, updateOrderStatus, listenToDrivers, updateDriver, updateOrderAsDispacthed, updateOrderDriver } from '../services/db';
import { Driver } from '../types';
import { sendWhatsAppBackgroundMessage } from '../utils/whatsapp';
import { useRestaurantId, useRestaurantSettings } from '../context/RestaurantContext';
import { formatCurrency } from '../utils';

interface KDSProps {
  isRtl: boolean;
}

export const KDS: React.FC<KDSProps> = ({ isRtl }) => {
  const restaurantId = useRestaurantId();
  const settings = useRestaurantSettings();
  const [orders, setOrders] = useState<Order[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubOrders = listenToOrders(restaurantId, (data) => {
      setOrders(data.filter((o: Order) => o.status !== 'served' && o.status !== 'cancelled'));
    });

    const unsubDrivers = listenToDrivers(restaurantId, (data) => {
      setAllDrivers(data);
      setAvailableDrivers(data.filter(d => d.status === 'available'));
    });

    return () => {
      unsubOrders();
      unsubDrivers();
    };
  }, [restaurantId]);

  const updateStatus = async (id: string, status: OrderStatus, driver_id?: string) => {
    try {
      await updateOrderStatus(restaurantId, id, status, driver_id);
    } catch (err) {
      console.error('Failed to update order status:', err);
    }
  };

  const handleDispatchDelivery = async (orderId: string, driverId: string) => {
    if (!driverId) return;
    try {
      // Find the order to get customer info before dispatching
      const order = orders.find(o => o.id === orderId);

      await updateOrderAsDispacthed(restaurantId, orderId, driverId, 'served');
      await updateDriver(restaurantId, driverId, { status: 'busy' });

      // Send WhatsApp notification to customer
      if (order?.customer) {
        const customerPhone = (order.customer as any).whatsapp || order.customer.phone;
        if (customerPhone) {
          const driverInfo = allDrivers.find(d => d.id === driverId);
          const template = settings.wa_msg_dispatch
            || 'مرحباً {name}،\nتم تجهيز طلبك وخرج مع الدليفري 🚚\nاسم الطيار: {driver}\nشكراً لاختيارك لنا! ❤️';
          const waMessage = template
            .replace(/{name}/g, order.customer.name || '')
            .replace(/{phone}/g, customerPhone)
            .replace(/{order_id}/g, orderId.slice(-4))
            .replace(/{total}/g, formatCurrency(order.total_amount || 0, isRtl, settings.currency))
            .replace(/{driver}/g, driverInfo?.name || '');

          sendWhatsAppBackgroundMessage(customerPhone, waMessage, {
            apiUrl: settings.whatsapp_api_url,
            apiToken: settings.whatsapp_api_token,
            isSimulated: settings.whatsapp_simulate
          });
        }
      }
    } catch (error) {
      console.error("Failed to dispatch delivery:", error);
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'preparing': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ready': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="h-full bg-slate-900 p-6 overflow-hidden flex flex-col">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <ChefHat className="text-brand-400" size={32} />
          {isRtl ? 'شاشة المطبخ' : 'Kitchen Display System'}
        </h1>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-sm">{isRtl ? 'قيد الانتظار' : 'Pending'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm">{isRtl ? 'يتم التحضير' : 'Preparing'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm">{isRtl ? 'جاهز' : 'Ready'}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto pb-4 flex gap-6 no-scrollbar">
        <AnimatePresence>
          {orders.map((order) => (
            <motion.div
              layout
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={order.id}
              className="w-80 flex-shrink-0 flex flex-col bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
            >
              <div className={cn("p-4 border-b flex justify-between items-center", getStatusColor(order.status))}>
                <div>
                  <h3 className="font-bold text-lg whitespace-nowrap overflow-hidden text-ellipsis">
                    #{order.daily_id || order.id} - {
                      order.type === 'dine-in' && order.table_number
                        ? `${isRtl ? 'طاولة' : 'Table'} ${order.table_number}`
                        : order.customer?.name
                          ? order.customer.name
                          : (isRtl ? (order.type === 'delivery' ? 'دليفري' : 'تيك اوي') : (order.type === 'delivery' ? 'Delivery' : 'Takeaway'))
                    }
                  </h3>
                  <div className="flex items-center gap-1 text-xs opacity-75">
                    <Clock size={12} />
                    <span>{new Date(order.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-white/20">
                    {order.type === 'delivery' ? (isRtl ? 'دليفري' : 'Delivery') : order.type === 'takeaway' ? (isRtl ? 'تيك اوي' : 'Takeaway') : (isRtl ? 'محلي' : 'Dine-in')}
                  </span>
                  {order.type === 'delivery' && order.driver_id && (
                    <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                      <Truck size={10} />
                      {isRtl ? 'تم التعيين' : 'Assigned'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-slate-200">
                    <div className="flex gap-3">
                      <span className="font-bold text-brand-400">{item.quantity}x</span>
                      <span className="font-medium">
                        {item.name} {item.category_name && <span className="text-slate-400 text-sm">({item.category_name})</span>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-slate-800/50 border-t border-slate-700 grid grid-cols-2 gap-2">
                {order.status === 'pending' && (
                  <button
                    onClick={() => updateStatus(order.id.toString(), 'preparing', order.driver_id)}
                    className="col-span-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all"
                  >
                    <PlayCircle size={20} />
                    {isRtl ? 'بدء التحضير' : 'Start Cooking'}
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    onClick={() => updateStatus(order.id.toString(), 'ready', order.driver_id)}
                    className="col-span-2 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold transition-all"
                  >
                    <CheckCircle2 size={20} />
                    {isRtl ? 'جاهز للتقديم' : 'Mark as Ready'}
                  </button>
                )}
                {order.status === 'ready' && order.type !== 'delivery' && (
                  <button
                    onClick={() => updateStatus(order.id.toString(), 'served', order.driver_id)}
                    className="col-span-2 flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-all"
                  >
                    <CheckCircle2 size={20} />
                    {isRtl ? 'تم التقديم' : 'Mark as Served'}
                  </button>
                )}
                {order.status === 'ready' && order.type === 'delivery' && (
                  <div className="col-span-2 flex flex-col gap-2">
                    <select
                      value={order.driver_id || selectedDrivers[order.id.toString()] || ''}
                      onChange={(e) => {
                        if (order.driver_id) {
                          // Transfer to new driver
                          updateOrderDriver(restaurantId, order.id.toString(), e.target.value);
                        } else {
                          // Just select a driver before dispatching
                          setSelectedDrivers({ ...selectedDrivers, [order.id.toString()]: e.target.value });
                        }
                      }}
                      className="w-full bg-slate-700 text-white border-none focus:ring-2 focus:ring-brand-500 rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="">{isRtl ? 'اختر طيار لتسليم الطلب' : 'Assign Driver'}</option>
                      {allDrivers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.status === 'busy' && d.id !== order.driver_id ? (isRtl ? '(مشغول)' : '(Busy)') : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!order.driver_id && !selectedDrivers[order.id.toString()]}
                      onClick={() => {
                        const drvId = order.driver_id || selectedDrivers[order.id.toString()];
                        if (drvId) handleDispatchDelivery(order.id.toString(), drvId);
                        else updateStatus(order.id.toString(), 'served', order.driver_id || undefined);
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-all"
                    >
                      <Truck size={20} />
                      {isRtl ? 'خروج للتوصيل' : 'Dispatch Order'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {orders.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-4">
            <ChefHat size={120} strokeWidth={0.5} />
            <p className="text-xl font-medium">{isRtl ? 'لا توجد طلبات حالية' : 'No active orders'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ChefHat = ({ size, className, strokeWidth }: any) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
    <line x1="6" y1="17" x2="18" y2="17" />
  </svg>
);
