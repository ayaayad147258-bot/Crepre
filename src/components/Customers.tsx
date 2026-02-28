import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Download, Edit2, Trash2, MessageCircle, Gift, Send, X, ExternalLink, Play } from 'lucide-react';
import { cn } from '../utils';
import { generateWhatsAppLink, getBirthdayMessage } from '../utils/whatsapp';
import { listenToCustomers, addCustomer, updateCustomer, deleteCustomer } from '../services/db';
import { Customer } from '../types';
import toast from 'react-hot-toast';
import { useRestaurantId } from '../context/RestaurantContext';

interface CustomersProps {
    isRtl: boolean;
}

export const Customers: React.FC<CustomersProps> = ({ isRtl }) => {
    const restaurantId = useRestaurantId();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    // Broadcast State
    const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastIndex, setBroadcastIndex] = useState(0);
    const [broadcastRecipients, setBroadcastRecipients] = useState<Customer[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        whatsapp: '',
        birthday: '',
        address: ''
    });

    useEffect(() => {
        const unsub = listenToCustomers(restaurantId, setCustomers);
        return () => unsub();
    }, [restaurantId]);

    const handleOpenModal = (customer?: Customer) => {
        if (customer) {
            setEditingCustomer(customer);
            setFormData({
                name: customer.name,
                phone: customer.phone,
                address: customer.address || '',
                whatsapp: customer.whatsapp || '',
                birthday: customer.birthday || ''
            });
        } else {
            setEditingCustomer(null);
            setFormData({ name: '', phone: '', address: '', whatsapp: '', birthday: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCustomer(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            toast.error(isRtl ? 'يجب إدخال الاسم ورقم الهاتف' : 'Name and phone are required');
            return;
        }

        try {
            if (editingCustomer) {
                await updateCustomer(restaurantId, editingCustomer.id, formData);
                toast.success(isRtl ? 'تم تحديث بيانات العميل' : 'Customer updated');
            } else {
                await addCustomer(restaurantId, formData);
                toast.success(isRtl ? 'تم إضافة العميل بنجاح' : 'Customer added');
            }
            handleCloseModal();
        } catch (error) {
            console.error(error);
            toast.error(isRtl ? 'حدث خطأ غير متوقع' : 'An error occurred');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm(isRtl ? 'هل أنت متأكد من حذف هذا العميل؟' : 'Are you sure you want to delete this customer?')) {
            try {
                await deleteCustomer(restaurantId, id);
                toast.success(isRtl ? 'تم الحذف بنجاح' : 'Deleted successfully');
            } catch (error) {
                toast.error(isRtl ? 'حدث خطأ' : 'An error occurred');
            }
        }
    };

    const handleExportCSV = () => {
        // Basic CSV Export
        const headers = [
            isRtl ? 'الاسم' : 'Name',
            isRtl ? 'الهاتف' : 'Phone',
            isRtl ? 'الواتساب' : 'WhatsApp',
            isRtl ? 'تاريخ الميلاد' : 'Birthday',
            isRtl ? 'العنوان' : 'Address',
            isRtl ? 'تاريخ الإضافة' : 'Added Date'
        ].join(',');

        const rows = customers.map(c => [
            `"${c.name}"`,
            c.phone,
            c.whatsapp || '',
            c.birthday || '',
            `"${c.address || ''}"`,
            new Date(c.created_at).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')
        ].join(','));

        const csvContent = "data:text/csv;charset=utf-8,\\uFEFF" + headers + "\\n" + rows.join('\\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "customers.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpenBroadcast = () => {
        // Only include customers with valid phone numbers or whatsapp
        const validRecipients = customers.filter(c => c.phone || c.whatsapp);
        setBroadcastRecipients(validRecipients);
        setBroadcastIndex(0);
        setBroadcastMessage('');
        setIsBroadcastModalOpen(true);
    };

    const handleSendNextBroadcast = () => {
        if (broadcastIndex < broadcastRecipients.length) {
            const customer = broadcastRecipients[broadcastIndex];
            const link = generateWhatsAppLink(customer.whatsapp || customer.phone, broadcastMessage);
            window.open(link, '_blank');
            setBroadcastIndex(prev => prev + 1);
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    );

    return (
        <div className="p-8 bg-slate-50 h-full overflow-y-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <Users className="text-brand-600" size={32} />
                        {isRtl ? 'إدارة العملاء' : 'Customer Management'}
                    </h1>
                    <p className="text-slate-500 mt-2">
                        {isRtl ? 'إدارة بيانات العملاء، طلبات التوصيل، ورسائل الواتساب' : 'Manage customer info, deliveries, and WhatsApp messages'}
                    </p>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={handleExportCSV}
                        className="flex-1 md:flex-none flex justify-center items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Download size={20} />
                        {isRtl ? 'تصدير' : 'Export'}
                    </button>

                    <button
                        onClick={handleOpenBroadcast}
                        className="flex-1 md:flex-none flex justify-center items-center gap-2 px-4 py-2 bg-green-50 text-green-600 border border-green-200 rounded-xl font-bold hover:bg-green-100 transition-all shadow-sm"
                    >
                        <Send size={20} />
                        {isRtl ? 'رسالة للعملاء' : 'Broadcast Message'}
                    </button>

                    <button
                        onClick={() => handleOpenModal()}
                        className="flex-1 md:flex-none flex justify-center items-center gap-2 px-6 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all shadow-md hover:shadow-lg"
                    >
                        <Plus size={20} />
                        {isRtl ? 'إضافة عميل' : 'Add Customer'}
                    </button>
                </div>
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

            {/* Customers Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr className="text-slate-500 text-sm">
                                <th className="p-4 font-bold">{isRtl ? 'الاسم' : 'Name'}</th>
                                <th className="p-4 font-bold">{isRtl ? 'رقم الهاتف' : 'Phone'}</th>
                                <th className="p-4 font-bold hidden md:table-cell">{isRtl ? 'العنوان' : 'Address'}</th>
                                <th className="p-4 font-bold hidden sm:table-cell">{isRtl ? 'تاريخ الميلاد' : 'Birthday'}</th>
                                <th className="p-4 font-bold text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-400">
                                        {isRtl ? 'لا يوجد عملاء مطابقين للبحث' : 'No customers found'}
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-bold text-slate-800">{customer.name}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-slate-600">{customer.phone}</span>
                                                {customer.whatsapp && customer.whatsapp !== customer.phone && (
                                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                                        <MessageCircle size={12} /> {customer.whatsapp}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-500 hidden md:table-cell">
                                            <span className="line-clamp-1">{customer.address || '-'}</span>
                                        </td>
                                        <td className="p-4 text-slate-500 hidden sm:table-cell">
                                            {customer.birthday || '-'}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-center gap-2">
                                                {/* WhatsApp Button */}
                                                <a
                                                    href={generateWhatsAppLink(customer.whatsapp || customer.phone, '')}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title={isRtl ? 'مراسلة عبر واتساب' : 'Message on WhatsApp'}
                                                    className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                                >
                                                    <MessageCircle size={18} />
                                                </a>

                                                {/* Birthday WhatsApp Button (Only show if birthday exists) */}
                                                {customer.birthday && (
                                                    <a
                                                        href={generateWhatsAppLink(customer.whatsapp || customer.phone, getBirthdayMessage(customer, isRtl))}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        title={isRtl ? 'إرسال تهنئة عيد ميلاد' : 'Send Birthday Wish'}
                                                        className="p-2 bg-amber-50 text-amber-500 rounded-lg hover:bg-amber-100 transition-colors hidden md:flex"
                                                    >
                                                        <Gift size={18} />
                                                    </a>
                                                )}

                                                <button
                                                    onClick={() => handleOpenModal(customer)}
                                                    className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(customer.id)}
                                                    className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add / Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl">
                        <header className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-xl font-bold text-slate-800">
                                {editingCustomer
                                    ? (isRtl ? 'تعديل بيانات العميل' : 'Edit Customer')
                                    : (isRtl ? 'إضافة عميل جديد' : 'Add New Customer')}
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

                                <div className="grid grid-cols-2 gap-4">
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
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">{isRtl ? 'رقم الواتساب' : 'WhatsApp'}</label>
                                        <input
                                            type="tel"
                                            placeholder={isRtl ? 'نفس رقم الهاتف' : 'Same as phone'}
                                            value={formData.whatsapp}
                                            onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-left"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">{isRtl ? 'العنوان السكني / التوصيل' : 'Address'}</label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">{isRtl ? 'تاريخ الميلاد' : 'Birthday'}</label>
                                    <input
                                        type="date"
                                        value={formData.birthday}
                                        onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                    />
                                </div>
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

            {/* Broadcast Message Modal */}
            {isBroadcastModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <header className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <MessageCircle className="text-green-500" />
                                {isRtl ? 'إرسال رسائل للعملاء' : 'Broadcast Messages'}
                            </h3>
                            <button onClick={() => setIsBroadcastModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 bg-white rounded-xl shadow-sm border border-slate-200">
                                <X size={20} />
                            </button>
                        </header>

                        <div className="p-4 md:p-6 flex-1 overflow-y-auto">
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    {isRtl ? 'نص الرسالة الموحدة' : 'Broadcast Message'}
                                </label>
                                <textarea
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all resize-none h-32"
                                    placeholder={isRtl ? 'اكتب رسالتك هنا... مرحباً %NAME%...' : 'Type your message here... Hello %NAME%...'}
                                    value={broadcastMessage}
                                    onChange={(e) => setBroadcastMessage(e.target.value)}
                                    // Make sure text displays correctly based on language
                                    dir="auto"
                                ></textarea>
                                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                    <MessageCircle size={14} />
                                    {isRtl
                                        ? 'المتصفح يمنع الإرسال الجماعي التلقائي، لذا سيتم تجهيز الرسائل لتضغط إرسال واحدة تلو الأخرى بسرعة بطابور ذكي.'
                                        : 'Browsers block automatic bulk sending. We queued the messages so you can quickly send them sequentially.'}
                                </p>
                            </div>

                            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                                    <h4 className="font-bold text-slate-700 text-sm">
                                        {isRtl ? 'طابور العملاء' : 'Customers Queue'}
                                        <span className="inline-block bg-slate-100 px-2 py-0.5 rounded-full mr-2 ml-2 text-xs">
                                            {broadcastRecipients.length} {isRtl ? 'مستلم' : 'Recipient'}
                                        </span>
                                    </h4>

                                    {/* Action Button for Queue Flow */}
                                    <div className="flex gap-2">
                                        {broadcastIndex < broadcastRecipients.length ? (
                                            <button
                                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all text-sm shadow-md"
                                                onClick={handleSendNextBroadcast}
                                                disabled={!broadcastMessage.trim()}
                                            >
                                                <Play size={16} />
                                                {isRtl ? `إرسال للعميل #${broadcastIndex + 1}` : `Send to #${broadcastIndex + 1}`}
                                            </button>
                                        ) : (
                                            <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl font-bold text-sm flex items-center gap-2">
                                                ✅ {isRtl ? 'تم إرسال الجميع!' : 'All Sent!'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {broadcastRecipients.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500 text-sm">
                                            {isRtl ? 'لا يوجد عملاء لهم هواتف' : 'No customers with phone numbers'}
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-slate-100">
                                            {broadcastRecipients.map((recipient, idx) => {
                                                const isCurrent = idx === broadcastIndex;
                                                const isPast = idx < broadcastIndex;

                                                return (
                                                    <li key={recipient.id} className={cn(
                                                        "p-4 flex justify-between items-center text-sm transition-colors",
                                                        isCurrent ? "bg-green-50/50" : isPast ? "opacity-60 bg-slate-50" : "bg-white"
                                                    )}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "w-6 h-6 rounded-full flex justify-center items-center text-[10px] font-bold shrink-0",
                                                                isCurrent ? "bg-green-600 text-white shadow-sm" : isPast ? "bg-slate-300 text-slate-600" : "bg-slate-100 text-slate-500"
                                                            )}>
                                                                {isPast ? '✓' : idx + 1}
                                                            </div>
                                                            <div>
                                                                <span className={cn("font-bold block leading-none", isCurrent ? 'text-green-800' : 'text-slate-700')}>{recipient.name}</span>
                                                                <span className="text-xs text-slate-400 mt-1 block leading-none">{recipient.whatsapp || recipient.phone}</span>
                                                            </div>
                                                        </div>
                                                        {isPast ? (
                                                            <span className="text-xs font-bold text-emerald-600 px-2 py-1 bg-emerald-50 rounded bg-opacity-70">
                                                                {isRtl ? 'تم التجهيز' : 'Sent'}
                                                            </span>
                                                        ) : (
                                                            <a
                                                                href={generateWhatsAppLink(recipient.whatsapp || recipient.phone, broadcastMessage)}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className={cn(
                                                                    "flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors text-xs font-bold",
                                                                    !broadcastMessage.trim() ? "opacity-50 pointer-events-none" : ""
                                                                )}
                                                                // Use onClick to advance index if clicked manually
                                                                onClick={() => {
                                                                    if (idx === broadcastIndex) setBroadcastIndex(prev => prev + 1);
                                                                }}
                                                            >
                                                                {isRtl ? 'إرسال يدوي' : 'Manual Send'} <ExternalLink size={12} />
                                                            </a>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
