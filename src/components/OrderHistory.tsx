import React, { useState, useEffect, useMemo } from 'react';
import { Search, Clock, RotateCcw, X, ChevronRight, Hash, Printer, Truck, DollarSign, ListOrdered, Share2 } from 'lucide-react';
import { cn, formatCurrency } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Invoice } from './Invoice';
import { listenToOrders } from '../services/db';
import toast from 'react-hot-toast';
import { toPng } from 'html-to-image';

interface OrderHistoryItem {
  id: number | string;
  daily_id?: number;
  type: string;
  table_number: string;
  driver_id?: string;
  delivery_fee?: number;
  customer?: any;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  items: any[];
}

interface OrderHistoryProps {
  isRtl: boolean;
  onClose: () => void;
  onReorder: (orderId: string) => void;
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ isRtl, onClose, onReorder }) => {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'delivery'>('all');
  const [loading, setLoading] = useState(true);
  const [printData, setPrintData] = useState<any>(null);
  const [screenshotData, setScreenshotData] = useState<any>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = listenToOrders((data) => {
      let filtered = data as OrderHistoryItem[];
      if (search) {
        const lowerSearch = search.toLowerCase();
        filtered = filtered.filter(o =>
          o.id.toString().includes(lowerSearch) ||
          (o.table_number && o.table_number.toLowerCase().includes(lowerSearch)) ||
          (o.type === 'delivery' && o.customer?.phone?.includes(lowerSearch))
        );
      }
      if (filterType === 'delivery') {
        filtered = filtered.filter(o => o.type === 'delivery');
      }
      setOrders(filtered.slice(0, 50)); // Last 50 orders
      setLoading(false);
    });

    return () => unsub();
  }, [search, filterType]);

  const deliveryStats = useMemo(() => {
    if (filterType !== 'delivery') return null;
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalFees = orders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
    return { totalOrders, totalRevenue, totalFees };
  }, [orders, filterType]);

  const handlePrint = async (order: OrderHistoryItem) => {
    try {
      const cartItems = order.items.map((item: any) => ({
        product_id: item.product_id,
        name: isRtl ? item.name_ar || item.name : item.name,
        quantity: item.quantity,
        price: item.price
      }));

      const total = cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const taxRateStr = localStorage.getItem('pos_tax_rate');
      const taxRate = taxRateStr !== null ? Number(taxRateStr) : 15;
      const tax = total * (taxRate / 100);

      setPrintData({
        cart: cartItems,
        total,
        tax,
        deliveryFee: order.delivery_fee || 0,
        grandTotal: order.total_amount,
        orderType: order.type,
        tableNumber: order.table_number,
        paymentMethod: order.payment_method,
        orderId: order.daily_id || order.id,
        customer: order.customer
      });

      setTimeout(() => {
        window.print();
        setTimeout(() => setPrintData(null), 1000);
      }, 100);
    } catch (err) {
      console.error('Failed to print order:', err);
    }
  };

  const handleShareSnapshot = async (order: OrderHistoryItem) => {
    if (isCapturing) return;
    try {
      setIsCapturing(true);
      const cartItems = order.items.map((item: any) => ({
        product_id: item.product_id,
        name: isRtl ? item.name_ar || item.name : item.name,
        quantity: item.quantity,
        price: item.price
      }));

      const total = cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const taxRateStr = localStorage.getItem('pos_tax_rate');
      const taxRate = taxRateStr !== null ? Number(taxRateStr) : 15;
      const tax = total * (taxRate / 100);

      setScreenshotData({
        cart: cartItems,
        total,
        tax,
        deliveryFee: order.delivery_fee || 0,
        grandTotal: order.total_amount,
        orderType: order.type,
        tableNumber: order.table_number,
        paymentMethod: order.payment_method,
        orderId: order.daily_id || order.id,
        customer: order.customer
      });

      // Wait for React to render the Invoice component in the DOM
      setTimeout(async () => {
        try {
          const element = document.getElementById('invoice-snapshot');
          if (element) {
            const imgData = await toPng(element, {
              cacheBust: true,
              pixelRatio: 2,
              backgroundColor: '#ffffff'
            });

            // Trigger download
            const link = document.createElement('a');
            link.href = imgData;
            link.download = `invoice-${order.id}.png`;
            link.click();

            toast.success(isRtl ? 'تم التقاط صورة الفاتورة بنجاح. ابحث في التنزيلات.' : 'Invoice snapshot saved successfully.');
          } else {
            toast.error(isRtl ? 'فشل في العثور على الفاتورة. تأكد من الانتظار.' : 'Failed to find invoice logic');
          }
        } catch (err) {
          console.error('Canvas error:', err);
          toast.error(isRtl ? 'حدث خطأ في الرسم' : 'Canvas drawing error');
        } finally {
          setScreenshotData(null);
          setIsCapturing(false);
        }
      }, 500);

    } catch (err) {
      console.error('Failed to capture snapshot:', err);
      toast.error(isRtl ? 'حدث خطأ أثناء التقاط الصورة' : 'Failed to capture snapshot');
      setScreenshotData(null);
      setIsCapturing(false);
    }
  };

  return (
    <motion.div
      initial={{ x: isRtl ? -400 : 400 }}
      animate={{ x: 0 }}
      exit={{ x: isRtl ? -400 : 400 }}
      className={cn(
        "fixed top-0 bottom-0 w-[400px] bg-white shadow-2xl z-50 flex flex-col",
        isRtl ? "left-0" : "right-0"
      )}
    >
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h2 className="text-xl font-black text-slate-800">{isRtl ? 'سجل الطلبات' : 'Order History'}</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            {isRtl ? 'آخر 50 طلب' : 'Last 50 orders'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center bg-white text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200 transition-all"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-6 border-b border-slate-50 space-y-4 shadow-sm relative z-10">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
              filterType === 'all' ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {isRtl ? 'كل الطلبات' : 'All Orders'}
          </button>
          <button
            onClick={() => setFilterType('delivery')}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
              filterType === 'delivery' ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {isRtl ? 'أرشيف الدليفري' : 'Delivery Archive'}
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder={isRtl ? 'بحث برقم الطلب أو الهاتف...' : 'Search by ID or phone...'}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filterType === 'delivery' && deliveryStats && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-brand-50 p-3 rounded-xl border border-brand-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-brand-600/70 mb-1">{isRtl ? 'الطلبات' : 'Orders'}</p>
                <p className="text-lg font-black text-brand-700">{deliveryStats.totalOrders}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                <ListOrdered size={16} />
              </div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-emerald-600/70 mb-1">{isRtl ? 'المبيعات' : 'Revenue'}</p>
                <p className="text-lg font-black text-emerald-700">{formatCurrency(deliveryStats.totalRevenue, isRtl)}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="col-span-2 bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-blue-600/70 mb-1">{isRtl ? 'رسوم التوصيل' : 'Delivery Fees'}</p>
                <p className="text-lg font-black text-blue-700">{formatCurrency(deliveryStats.totalFees, isRtl)}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <Truck size={16} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/30">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Clock size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-bold">{isRtl ? 'لا توجد طلبات سابقة' : 'No past orders found'}</p>
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className="bg-white border border-slate-100 rounded-2xl p-4 hover:border-brand-200 transition-all group shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-brand-50 text-brand-600 p-2 rounded-lg">
                    <Hash size={14} />
                  </div>
                  <span className="font-black text-slate-800">#{order.daily_id || order.id}</span>
                </div>
                <span className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                  order.status === 'completed' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                )}>
                  {isRtl ? (order.status === 'completed' ? 'مكتمل' : 'قيد الانتظار') : order.status}
                </span>
              </div>

              <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">
                {order.items?.map(i => `${i.quantity}x ${i.name}`).join(', ')}
              </p>

              <div className="flex justify-between items-center pt-3 border-t border-slate-50 relative z-10">
                <div className="flex flex-col">
                  <span className="text-lg font-black text-brand-600">{formatCurrency(order.total_amount, isRtl)}</span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePrint(order)}
                    className="flex items-center justify-center w-9 h-9 bg-slate-50 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-xl transition-all"
                    title={isRtl ? 'طباعة' : 'Print'}
                  >
                    <Printer size={16} />
                  </button>
                  <button
                    onClick={() => handleShareSnapshot(order)}
                    disabled={isCapturing}
                    className="flex items-center justify-center w-9 h-9 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl transition-all disabled:opacity-50"
                    title={isRtl ? 'مشاركة كصورة' : 'Share Image'}
                  >
                    <Share2 size={16} />
                  </button>
                  <button
                    onClick={() => onReorder(order.id.toString())}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 hover:bg-brand-600 hover:text-white rounded-xl text-xs font-bold transition-all"
                  >
                    <RotateCcw size={14} />
                    <span className="hidden sm:inline">{isRtl ? 'إعادة طلب' : 'Re-order'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {printData && (
        <Invoice
          {...printData}
          isRtl={isRtl}
        />
      )}
      {screenshotData && (
        <Invoice
          htmlId="invoice-snapshot"
          cart={screenshotData.cart}
          total={screenshotData.total}
          tax={screenshotData.tax}
          deliveryFee={screenshotData.deliveryFee}
          grandTotal={screenshotData.grandTotal}
          orderType={screenshotData.orderType}
          tableNumber={screenshotData.tableNumber}
          paymentMethod={screenshotData.paymentMethod}
          orderId={screenshotData.orderId}
          customer={screenshotData.customer}
          isRtl={isRtl}
        />
      )}
    </motion.div>
  );
};
