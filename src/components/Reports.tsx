import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Download,
  Calendar,
  Filter,
  FileText,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  FileSpreadsheet
} from 'lucide-react';
import { cn, formatCurrency } from '../utils';
import { listenToOrders, listenToProducts, listenToInventory, listenToRecipes, listenToExpenses } from '../services/db';
import { Expense } from '../types';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface ReportsProps {
  isRtl: boolean;
}

export const Reports: React.FC<ReportsProps> = ({ isRtl }) => {
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);

  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    setLoading(true);
    let u1 = listenToOrders(setOrders);
    let u2 = listenToProducts(setProducts);
    let u3 = listenToInventory(setInventory);
    let u4 = listenToRecipes(setRecipes);
    let u5 = listenToExpenses(setExpenses);

    // Initial brief loading state
    setTimeout(() => setLoading(false), 600);

    return () => {
      u1(); u2(); u3(); u4(); u5();
    };
  }, []);

  const { salesData, performanceData, inventoryUsage, summary } = useMemo(() => {
    if (!orders.length) return { salesData: [], performanceData: [], inventoryUsage: [], summary: { totalRevenue: 0, totalExpenses: 0, netProfit: 0 } };

    const now = new Date();
    let startDate = new Date();
    if (period === 'daily') startDate.setHours(0, 0, 0, 0);
    else if (period === 'weekly') startDate.setDate(now.getDate() - 7);
    else if (period === 'monthly') startDate.setMonth(now.getMonth() - 1);

    const validOrders = orders.filter(o =>
      new Date(o.created_at) >= startDate && o.status !== 'cancelled'
    );

    // 1. Sales Trend Data
    const salesMap: Record<string, number> = {};
    validOrders.forEach(o => {
      const dateStr = new Date(o.created_at).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
        month: 'short', day: 'numeric', ...(period === 'daily' && { hour: 'numeric' })
      });
      salesMap[dateStr] = (salesMap[dateStr] || 0) + (o.total_amount || 0);
    });

    // Convert map to array and take last chronological items roughly
    const calculatedSalesData = Object.entries(salesMap).map(([date, total]) => ({ date, total })).reverse();

    // 2. Performance Data (Products)
    const perfMap: Record<string, { quantity: number, revenue: number }> = {};
    validOrders.forEach(o => {
      (o.items || []).forEach((item: any) => {
        if (!perfMap[item.product_id]) {
          perfMap[item.product_id] = { quantity: 0, revenue: 0 };
        }
        perfMap[item.product_id].quantity += item.quantity;
        perfMap[item.product_id].revenue += (item.price * item.quantity);
      });
    });

    const calculatedPerformanceData = Object.entries(perfMap)
      .map(([id, stats]) => {
        const prod = products.find(p => p.id.toString() === id);
        return {
          name: prod ? (isRtl ? (prod.name_ar || prod.name) : prod.name) : 'Unknown',
          quantity: stats.quantity,
          revenue: stats.revenue
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // 3. Inventory Usage (Derived from ordered products' recipes)
    const invUsageMap: Record<string, number> = {};
    validOrders.forEach(o => {
      (o.items || []).forEach((item: any) => {
        const itemRecipes = recipes.filter(r => r.product_id === item.product_id.toString());
        itemRecipes.forEach(recipe => {
          invUsageMap[recipe.ingredient_id] = (invUsageMap[recipe.ingredient_id] || 0) + (recipe.quantity * item.quantity);
        });
      });
    });

    const calculatedInventoryUsage = Object.entries(invUsageMap)
      .map(([id, used_quantity]) => {
        const ing = inventory.find(i => i.id.toString() === id);
        return {
          name: ing ? ing.name : 'Unknown',
          used_quantity
        };
      })
      .sort((a, b) => b.used_quantity - a.used_quantity)
      .slice(0, 5); // top 5 used ingredients

    // 4. Calculate Totals and Expenses based on period
    const validExpenses = expenses.filter(e => new Date(e.date) >= startDate);

    // Revenue is the sum of total from salesMap or just validOrders total
    const totalRevenue = validOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalExpenses = validExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    return {
      salesData: calculatedSalesData,
      performanceData: calculatedPerformanceData,
      inventoryUsage: calculatedInventoryUsage,
      summary: { totalRevenue, totalExpenses, netProfit }
    };
  }, [orders, products, inventory, recipes, expenses, period, isRtl]);

  const COLORS = ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#ec4899'];

  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    const input = document.getElementById('report-content');
    if (!input) return;

    try {
      setIsExporting(true);
      const canvas = await html2canvas(input, {
        scale: 2, // Higher scale for better resolution
        useCORS: true,
        backgroundColor: '#f8fafc', // match slate-50 background
        logging: false,
        windowWidth: input.scrollWidth,
        windowHeight: input.scrollHeight
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = position - pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`report-${period}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    try {
      let csvStr = isRtl
        ? 'المنتج,الكمية المباعة,الإيرادات\n'
        : 'Product,Qty Sold,Revenue\n';

      performanceData.forEach((item: any) => {
        csvStr += `"${item.name}",${item.quantity},${item.revenue}\n`;
      });

      csvStr += `\n${isRtl ? 'إجمالي الإيرادات' : 'Total Revenue'},,${summary.totalRevenue}\n`;
      csvStr += `${isRtl ? 'إجمالي المصروفات' : 'Total Expenses'},,${summary.totalExpenses}\n`;
      csvStr += `${isRtl ? 'صافي الربح' : 'Net Profit'},,${summary.netProfit}\n`;

      const blob = new Blob(['\uFEFF' + csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${period}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error generating CSV:', e);
    }
  };

  return (
    <div className="p-8 bg-slate-50 h-full overflow-y-auto">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            {isRtl ? 'التقارير والتحليلات' : 'Reports & Analytics'}
          </h1>
          <p className="text-slate-500">
            {isRtl ? 'تحليل أداء المبيعات والمخزون' : 'Analyze sales performance and inventory usage'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-bold hover:bg-emerald-100 transition-all"
          >
            <FileSpreadsheet size={18} />
            {isRtl ? 'تصدير إكسيل' : 'Export Excel'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <Download size={18} />
            {isExporting ? (isRtl ? 'جاري التصدير...' : 'Exporting...') : (isRtl ? 'تصدير PDF' : 'Export PDF')}
          </button>
          <div className="flex bg-white border border-slate-200 rounded-xl p-1">
            {['daily', 'weekly', 'monthly'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  period === p ? "bg-brand-600 text-white shadow-md" : "text-slate-500 hover:text-slate-800"
                )}
              >
                {isRtl ? (p === 'daily' ? 'يومي' : p === 'weekly' ? 'أسبوعي' : 'شهري') : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div id="report-content" className="p-2 -m-2">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
              <TrendingUp size={28} />
            </div>
            <div>
              <p className="text-slate-500 font-medium text-sm mb-1">{isRtl ? 'إجمالي الإيرادات' : 'Total Revenue'}</p>
              <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(summary.totalRevenue || 0, isRtl)}</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
              <BarChart3 size={28} />
            </div>
            <div>
              <p className="text-slate-500 font-medium text-sm mb-1">{isRtl ? 'إجمالي المصروفات' : 'Total Expenses'}</p>
              <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(summary.totalExpenses || 0, isRtl)}</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-bl-full -z-10 opacity-50"></div>
            <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
              <PieChartIcon size={28} />
            </div>
            <div>
              <p className="text-slate-500 font-medium text-sm mb-1">{isRtl ? 'صافي الربح' : 'Net Profit'}</p>
              <h3 className={cn("text-2xl font-bold", (summary.netProfit || 0) >= 0 ? "text-brand-600" : "text-red-500")}>
                {formatCurrency(summary.netProfit || 0, isRtl)}
              </h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Sales Trend */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp size={20} className="text-brand-500" />
                {isRtl ? 'اتجاه المبيعات' : 'Sales Trend'}
              </h3>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Product Performance Pie */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <PieChartIcon size={20} className="text-emerald-500" />
              {isRtl ? 'توزيع المبيعات' : 'Revenue Distribution'}
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={performanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="revenue"
                  >
                    {performanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {performanceData.slice(0, 4).map((item: any, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-600">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-800">{formatCurrency(item.revenue, isRtl)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Detailed Performance Table */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <BarChart3 size={20} className="text-blue-500" />
              {isRtl ? 'أداء المنتجات بالتفصيل' : 'Product Performance Details'}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
                    <th className="pb-4 font-bold">{isRtl ? 'المنتج' : 'Product'}</th>
                    <th className="pb-4 font-bold">{isRtl ? 'الكمية' : 'Qty Sold'}</th>
                    <th className="pb-4 font-bold">{isRtl ? 'الإيرادات' : 'Revenue'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {performanceData.map((item: any, i) => (
                    <tr key={i} className="text-sm">
                      <td className="py-4 font-medium text-slate-700">{item.name}</td>
                      <td className="py-4 text-slate-500">{item.quantity}</td>
                      <td className="py-4 font-bold text-slate-900">{formatCurrency(item.revenue, isRtl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inventory Usage */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <FileText size={20} className="text-amber-500" />
              {isRtl ? 'استهلاك المخزون' : 'Inventory Usage'}
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryUsage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={100} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="used_quantity" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
