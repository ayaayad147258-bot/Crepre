import React, { useState, useEffect } from 'react';
import { Truck, Search, Plus, Edit2, Trash2, Banknote, ListOrdered, X, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import { cn, formatCurrency } from '../utils';
import { listenToDrivers, addDriver, updateDriver, deleteDriver, listenToOrders, markOrderAsPaid, updateOrderDriver } from '../services/db';
import { Driver, Order } from '../types';
import toast from 'react-hot-toast';

interface DriversProps {
    isRtl: boolean;
}

export const Drivers: React.FC<DriversProps> = ({ isRtl }) => {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [allOrders, setAllOrders] = useState<Order[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

    const [isAccountingModalOpen, setIsAccountingModalOpen] = useState(false);
    const [selectedDriverForAccounting, setSelectedDriverForAccounting] = useState<Driver | null>(null);
    const [transferModalOrderId, setTransferModalOrderId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        status: 'available' as 'available' | 'busy'
    });

    useEffect(() => {
        const unsubDrivers = listenToDrivers(setDrivers);
        const unsubOrders = listenToOrders(setAllOrders);

        return () => {
            unsubDrivers();
            unsubOrders();
        };
    }, []);

    const handleOpenModal = (driver?: Driver) => {
        if (driver) {
            setEditingDriver(driver);
            setFormData({
                name: driver.name,
                phone: driver.phone,
                status: driver.status
            });
        } else {
            setEditingDriver(null);
            setFormData({ name: '', phone: '', status: 'available' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingDriver(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            toast.error(isRtl ? 'يجب إدخال الاسم ورقم الهاتف' : 'Name and phone are required');
            return;
        }

        try {
            if (editingDriver) {
                await updateDriver(editingDriver.id, formData);
                toast.success(isRtl ? 'تم تحديث بيانات الطيار' : 'Driver updated');
            } else {
                await addDriver({ ...formData, created_at: new Date().toISOString() });
                toast.success(isRtl ? 'تم إضافة الطيار بنجاح' : 'Driver added');
            }
            handleCloseModal();
        } catch (error) {
            console.error(error);
            toast.error(isRtl ? 'حدث خطأ غير متوقع' : 'An error occurred');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm(isRtl ? 'هل أنت متأكد من حذف هذا الطيار؟' : 'Are you sure you want to delete this driver?')) {
            try {
                await deleteDriver(id);
                toast.success(isRtl ? 'تم الحذف بنجاح' : 'Deleted successfully');
            } catch (error) {
                toast.error(isRtl ? 'حدث خطأ' : 'An error occurred');
            }
        }
    };

    const filteredDrivers = drivers.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.phone.includes(searchQuery)
    );

    const getDriverOrders = (driverId: string) => {
        return allOrders.filter(o => o.driver_id === driverId);
    };

    const getDriverCashToCollect = (driverId: string) => {
        const driverOrders = getDriverOrders(driverId);
        return driverOrders
            .filter(o => o.payment_method === 'cash' && o.status !== 'cancelled' && !o.is_paid)
            .reduce((sum, o) => sum + o.total_amount, 0);
    };

    const openAccountingModal = (driver: Driver) => {
        setSelectedDriverForAccounting(driver);
        setIsAccountingModalOpen(true);
    };

    const handleCollectCash = async (orderId: string) => {
        try {
            await markOrderAsPaid(orderId);
            toast.success(isRtl ? 'تم تحصيل المبلغ بنجاح' : 'Cash collected successfully');
        } catch (error) {
            console.error('Failed to collect cash:', error);
            toast.error(isRtl ? 'حدث خطأ أثناء التحصيل' : 'Failed to collect cash');
        }
    };

    const handleTransferDriver = async (orderId: string, newDriverId: string) => {
        if (!newDriverId) return;
        try {
            await updateOrderDriver(orderId, newDriverId);
            toast.success(isRtl ? 'تم نقل الطلب لطيار آخر' : 'Order transferred to another driver');
        } catch (error) {
            console.error('Failed to transfer driver:', error);
            toast.error(isRtl ? 'حدث خطأ أثناء نقل الطلب' : 'Failed to transfer order');
        }
    };

    const handleToggleStatus = async (driver: Driver) => {
        try {
            const newStatus = driver.status === 'available' ? 'busy' : 'available';
            await updateDriver(driver.id, { status: newStatus });
            toast.success(isRtl ? 'تم تغيير حالة الطيار' : 'Driver status updated');
        } catch (error) {
            console.error('Failed to toggle status:', error);
            toast.error(isRtl ? 'حدث خطأ' : 'Failed to update status');
        }
    };

    return (
        <div className="p-8 bg-slate-50 h-full overflow-y-auto w-full">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <Truck className="text-brand-600" size={32} />
                        {isRtl ? 'إدارة الطيارين' : 'Drivers Management'}
                    </h1>
                    <p className="text-slate-500 mt-2">
                        {isRtl ? 'إدارة طيارين الدليفري ومتابعة حالاتهم' : 'Manage delivery drivers and track their status'}
                    </p>
                </div>

                <button
                    onClick={() => handleOpenModal()}
                    className="w-full md:w-auto flex justify-center items-center gap-2 px-6 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all shadow-md hover:shadow-lg"
                >
                    <Plus size={20} />
                    {isRtl ? 'إضافة طيار' : 'Add Driver'}
                </button>
            </header>

            {/* Search and Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder={isRtl ? 'ابحث بالاسم أو رقم الهاتف...' : 'Search by name or phone...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                </div>
            </div>

            {/* Drivers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredDrivers.length === 0 ? (
                    <div className="col-span-full p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        {isRtl ? 'لا يوجد طيارين مطابقين للبحث' : 'No drivers found'}
                    </div>
                ) : (
                    filteredDrivers.map((driver) => (
                        <div key={driver.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative group">
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleOpenModal(driver)}
                                    className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(driver.id)}
                                    className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex flex-col items-center text-center mt-2">
                                <div className={cn(
                                    "w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-sm",
                                    driver.status === 'available' ? 'bg-green-50 text-green-500' : 'bg-orange-50 text-orange-500'
                                )}>
                                    <Truck size={32} />
                                </div>
                                <h3 className="font-bold text-lg text-slate-800">{driver.name}</h3>
                                <p className="text-slate-500 text-sm mt-1 mb-4" dir="ltr">{driver.phone}</p>

                                <button
                                    onClick={() => handleToggleStatus(driver)}
                                    title={isRtl ? 'اضغط لتغيير الحالة' : 'Click to toggle status'}
                                    className={cn(
                                        "px-4 py-1.5 rounded-full text-xs font-bold border mb-4 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm flex items-center gap-1.5",
                                        driver.status === 'available'
                                            ? "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                                            : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                                    )}
                                >
                                    <div className={cn("w-2 h-2 rounded-full", driver.status === 'available' ? "bg-green-500 animate-pulse" : "bg-orange-500")} />
                                    {driver.status === 'available'
                                        ? (isRtl ? 'متاح' : 'Available')
                                        : (isRtl ? 'مشغول' : 'Busy')}
                                </button>

                                <div className="w-full flex gap-2 mt-auto pt-4 border-t border-slate-100">
                                    <div className="flex-1 bg-slate-50 rounded-xl p-2 text-center">
                                        <div className="text-xs text-slate-500 mb-1 font-bold">{isRtl ? 'الطلبات' : 'Orders'}</div>
                                        <div className="text-lg font-black text-slate-700">{getDriverOrders(driver.id).length}</div>
                                    </div>
                                    <button
                                        onClick={() => openAccountingModal(driver)}
                                        className="flex-[2] bg-brand-50 hover:bg-brand-600 text-brand-600 hover:text-white rounded-xl flex items-center justify-center gap-2 font-bold transition-all text-sm group-hover:shadow-md"
                                    >
                                        <Banknote size={16} />
                                        {isRtl ? 'الحسابات' : 'Accounting'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add / Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl">
                        <header className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-xl font-bold text-slate-800">
                                {editingDriver
                                    ? (isRtl ? 'تعديل بيانات الطيار' : 'Edit Driver')
                                    : (isRtl ? 'إضافة طيار جديد' : 'Add New Driver')}
                            </h3>
                        </header>

                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">{isRtl ? 'الاسم *' : 'Name *'}</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">{isRtl ? 'رقم الهاتف *' : 'Phone *'}</label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-left"
                                        dir="ltr"
                                    />
                                </div>

                                {editingDriver && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">{isRtl ? 'الحالة' : 'Status'}</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="status"
                                                    value="available"
                                                    checked={formData.status === 'available'}
                                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                                    className="w-4 h-4 text-brand-600 focus:ring-brand-500"
                                                />
                                                <span className="text-sm font-medium text-slate-700">{isRtl ? 'متاح' : 'Available'}</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="status"
                                                    value="busy"
                                                    checked={formData.status === 'busy'}
                                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                                    className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                                                />
                                                <span className="text-sm font-medium text-slate-700">{isRtl ? 'مشغول' : 'Busy'}</span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    {isRtl ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 px-4 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors shadow-md"
                                >
                                    {isRtl ? 'حفظ' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Accounting Modal */}
            {isAccountingModalOpen && selectedDriverForAccounting && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                        <header className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                    <Banknote className="text-brand-600" />
                                    {isRtl ? `حسابات الطيار: ${selectedDriverForAccounting.name}` : `Accounting for: ${selectedDriverForAccounting.name}`}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsAccountingModalOpen(false)}
                                className="w-10 h-10 flex items-center justify-center bg-white text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200 transition-all"
                            >
                                <X size={20} />
                            </button>
                        </header>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                            <div className="mb-6 bg-brand-600 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
                                <div>
                                    <h4 className="text-brand-100 font-medium mb-1">{isRtl ? 'إجمالي النقدية المطلوب تحصيلها' : 'Total Cash to Collect'}</h4>
                                    <div className="text-4xl font-black">{formatCurrency(getDriverCashToCollect(selectedDriverForAccounting.id), isRtl)}</div>
                                </div>
                                <div className="flex gap-6 bg-white/10 px-6 py-4 rounded-xl">
                                    <div className="text-center">
                                        <div className="text-brand-100 text-xs mb-1 font-bold">{isRtl ? 'إجمالي الطلبات' : 'Total Orders'}</div>
                                        <div className="text-2xl font-bold">{getDriverOrders(selectedDriverForAccounting.id).length}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse" dir={isRtl ? "rtl" : "ltr"}>
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                        <tr>
                                            <th className="p-4 font-bold">{isRtl ? 'رقم الطلب' : 'Order ID'}</th>
                                            <th className="p-4 font-bold">{isRtl ? 'العميل' : 'Customer'}</th>
                                            <th className="p-4 font-bold">{isRtl ? 'رسوم التوصيل' : 'Delivery Fee'}</th>
                                            <th className="p-4 font-bold">{isRtl ? 'الإجمالي' : 'Total'}</th>
                                            <th className="p-4 font-bold">{isRtl ? 'الدفع' : 'Payment'}</th>
                                            <th className="p-4 font-bold">{isRtl ? 'الحالة' : 'Status'}</th>
                                            <th className="p-4 font-bold text-center">{isRtl ? 'إجراء' : 'Action'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {getDriverOrders(selectedDriverForAccounting.id).length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-slate-400">
                                                    {isRtl ? 'لا توجد طلبات مسجلة لهذا الطيار' : 'No orders found for this driver'}
                                                </td>
                                            </tr>
                                        ) : (
                                            getDriverOrders(selectedDriverForAccounting.id).map(order => (
                                                <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-4 font-bold text-slate-700">#{order.id}</td>
                                                    <td className="p-4">
                                                        <div className="font-bold text-slate-800">{order.customer?.name || (isRtl ? 'غير محدد' : 'Unknown')}</div>
                                                        <div className="text-xs text-slate-500">{order.customer?.phone}</div>
                                                    </td>
                                                    <td className="p-4 font-medium text-slate-600">
                                                        {formatCurrency(order.delivery_fee || 0, isRtl)}
                                                    </td>
                                                    <td className="p-4 font-black justify-end text-brand-600">
                                                        {formatCurrency(order.total_amount, isRtl)}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={cn(
                                                            "px-2 py-1 rounded text-xs font-bold uppercase",
                                                            order.payment_method === 'cash' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                                        )}>
                                                            {order.payment_method === 'cash' ? (isRtl ? 'كاش' : 'Cash') : (isRtl ? 'بطاقة' : 'Card')}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={cn(
                                                            "px-2 py-1 rounded text-xs font-bold uppercase",
                                                            order.status === 'served' ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-600"
                                                        )}>
                                                            {isRtl ? (order.status === 'served' ? 'مكتمل' : 'نشط') : order.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex flex-col gap-2 items-center justify-center">
                                                            {order.payment_method === 'cash' && order.status !== 'cancelled' ? (
                                                                order.is_paid ? (
                                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                                                        <CheckCircle2 size={12} />
                                                                        {isRtl ? 'تم التحصيل' : 'Collected'}
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleCollectCash(order.id.toString())}
                                                                        className="w-full px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                                                    >
                                                                        {isRtl ? 'تحصيل' : 'Collect'}
                                                                    </button>
                                                                )
                                                            ) : (
                                                                <span className="text-slate-300 text-xs">-</span>
                                                            )}

                                                            {order.status !== 'served' && order.status !== 'cancelled' && (
                                                                <button
                                                                    onClick={() => setTransferModalOrderId(order.id.toString())}
                                                                    className="w-full mt-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 border border-slate-200"
                                                                    title={isRtl ? 'نقل الطلب لطيار آخر' : 'Transfer order to another driver'}
                                                                >
                                                                    <ArrowRightLeft size={14} />
                                                                    {isRtl ? 'نقل' : 'Transfer'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Transfer Order Modal */}
            {transferModalOrderId && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-[60] p-4">
                    <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
                        <header className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <ArrowRightLeft className="text-brand-600" />
                                {isRtl ? 'نقل الطلب' : 'Transfer Order'}
                            </h3>
                            <button
                                onClick={() => setTransferModalOrderId(null)}
                                className="w-8 h-8 flex items-center justify-center bg-white text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200 transition-all"
                            >
                                <X size={16} />
                            </button>
                        </header>

                        <div className="p-6 space-y-4">
                            <p className="text-sm font-semibold text-slate-600 mb-4">
                                {isRtl ? 'اختر الطيار الذي تريد نقل الطلب إليه:' : 'Select the driver to transfer the order to:'}
                            </p>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {drivers
                                    .filter(d => d.id !== selectedDriverForAccounting?.id)
                                    .map(driver => (
                                        <button
                                            key={driver.id}
                                            onClick={() => {
                                                handleTransferDriver(transferModalOrderId, driver.id);
                                                setTransferModalOrderId(null);
                                            }}
                                            className="w-full text-right px-4 py-3 bg-slate-50 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 border border-slate-100 rounded-xl transition-all flex items-center gap-3 font-bold text-slate-700 shadow-sm"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                                <Truck size={18} className={driver.status === 'available' ? 'text-green-500' : 'text-orange-500'} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span>{driver.name}</span>
                                                <span className="text-xs text-slate-400 font-medium">
                                                    {driver.status === 'available' ? (isRtl ? 'متاح' : 'Available') : (isRtl ? 'مشغول' : 'Busy')}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                {drivers.filter(d => d.id !== selectedDriverForAccounting?.id).length === 0 && (
                                    <div className="text-center text-slate-500 text-sm py-4">
                                        {isRtl ? 'لا يوجد طيارين آخرين متاحين' : 'No other drivers available'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
