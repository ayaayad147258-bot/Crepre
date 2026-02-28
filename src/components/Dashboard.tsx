import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TrendingUp, Users, ShoppingBag, DollarSign } from 'lucide-react';
import { formatCurrency } from '../utils';
import { listenToOrders } from '../services/db';
import { useRestaurantId } from '../context/RestaurantContext';

interface DashboardProps {
  isRtl: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ isRtl }) => {
  const restaurantId = useRestaurantId();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const unsub = listenToOrders(restaurantId, (orders) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todaysOrders = orders.filter((o: any) => new Date(o.created_at) >= today && o.status !== 'cancelled');

      const dailySales = {
        total: todaysOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
      };

      const orderCount = { count: todaysOrders.length };

      const productCounts: Record<string, { name: string, sold: number }> = {};
      todaysOrders.forEach(o => {
        (o.items || []).forEach((item: any) => {
          if (!productCounts[item.product_id]) {
            productCounts[item.product_id] = { name: isRtl ? (item.name_ar || item.name) : item.name, sold: 0 };
          }
          productCounts[item.product_id].sold += item.quantity;
        });
      });

      const topProducts = Object.values(productCounts).sort((a, b) => b.sold - a.sold).slice(0, 5);

      const payments: Record<string, number> = {};
      todaysOrders.forEach(o => {
        payments[o.payment_method] = (payments[o.payment_method] || 0) + (o.total_amount || 0);
      });

      const paymentSummary = Object.entries(payments).map(([pm, total]) => ({
        payment_method: pm === 'cash' ? (isRtl ? 'كاش' : 'Cash') : (isRtl ? 'بطاقة' : 'Card'),
        total
      }));

      // Generate mock hourly data based on total for the chart
      const hourlyData = [
        { time: '10am', sales: dailySales.total * 0.1 },
        { time: '12pm', sales: dailySales.total * 0.25 },
        { time: '2pm', sales: dailySales.total * 0.2 },
        { time: '4pm', sales: dailySales.total * 0.15 },
        { time: '6pm', sales: dailySales.total * 0.2 },
        { time: '8pm', sales: dailySales.total * 0.1 },
      ];

      setStats({
        dailySales,
        orderCount,
        topProducts,
        paymentSummary,
        hourlyData
      });
    });

    return () => unsub();
  }, [isRtl, restaurantId]);

  if (!stats) return <div className="p-8">Loading...</div>;

  const cards = [
    { label: isRtl ? 'مبيعات اليوم' : 'Daily Sales', value: formatCurrency(stats.dailySales.total || 0, isRtl), icon: DollarSign, color: 'bg-emerald-500' },
    { label: isRtl ? 'عدد الطلبات' : 'Total Orders', value: stats.orderCount.count, icon: ShoppingBag, color: 'bg-blue-500' },
    { label: isRtl ? 'متوسط الطلب' : 'Avg Order Value', value: formatCurrency(stats.dailySales.total / (stats.orderCount.count || 1), isRtl), icon: TrendingUp, color: 'bg-brand-500' },
    { label: isRtl ? 'العملاء' : 'Active Customers', value: '24', icon: Users, color: 'bg-amber-500' },
  ];

  const COLORS = ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  return (
    <div className="p-8 bg-slate-50 h-full overflow-y-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">{isRtl ? 'نظرة عامة' : 'Business Overview'}</h1>
        <p className="text-slate-500">{isRtl ? 'أداء المطعم اليوم' : "Today's restaurant performance"}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={`${card.color} p-3 rounded-xl text-white`}>
              <card.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">{card.label}</p>
              <p className="text-2xl font-bold text-slate-800">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">{isRtl ? 'المبيعات الساعية' : 'Hourly Sales'}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.hourlyData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">{isRtl ? 'أفضل المنتجات' : 'Top Performing Products'}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={100} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="sold" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">{isRtl ? 'طرق الدفع' : 'Payment Methods'}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.paymentSummary}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="total"
                  nameKey="payment_method"
                >
                  {stats.paymentSummary.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {stats.paymentSummary.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-sm text-slate-600 capitalize">{item.payment_method}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
