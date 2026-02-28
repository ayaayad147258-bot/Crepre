import React, { useState, useEffect } from 'react';
import {
    Store, Plus, Pencil, Trash2, Copy, ExternalLink,
    CheckCircle, XCircle, X, Save, Globe, Loader2
} from 'lucide-react';
import { cn } from '../utils';
import { listenToRestaurants, addRestaurant, updateRestaurant, deleteRestaurant } from '../services/db';
import toast from 'react-hot-toast';

interface Restaurant {
    id: string;
    name: string;
    logo?: string;
    active: boolean;
    theme: {
        primaryColor: string;
        secondaryColor: string;
    };
    created_at?: string;
}

interface RestaurantsProps {
    isRtl: boolean;
}

const defaultTheme = { primaryColor: '#e63946', secondaryColor: '#ffd700' };

const emptyForm = {
    name: '',
    logo: '',
    active: true,
    theme: { ...defaultTheme },
};

export const Restaurants: React.FC<RestaurantsProps> = ({ isRtl }) => {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...emptyForm, theme: { ...defaultTheme } });

    // Get base URL for restaurant links
    const baseUrl = window.location.origin;

    useEffect(() => {
        const unsub = listenToRestaurants((data) => {
            setRestaurants(data);
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    const getMenuUrl = (id: string) => `${baseUrl}/r/${id}`;

    const handleCopyLink = (id: string) => {
        const url = getMenuUrl(id);
        navigator.clipboard.writeText(url).then(() => {
            toast.success(isRtl ? 'تم نسخ الرابط!' : 'Link copied!');
        }).catch(() => {
            toast.error(isRtl ? 'فشل النسخ' : 'Copy failed');
        });
    };

    const handleOpenLink = (id: string) => {
        window.open(getMenuUrl(id), '_blank');
    };

    const handleEdit = (r: Restaurant) => {
        setEditingId(r.id);
        setForm({
            name: r.name,
            logo: r.logo || '',
            active: r.active,
            theme: { ...r.theme },
        });
        setShowForm(true);
    };

    const handleNew = () => {
        setEditingId(null);
        setForm({ ...emptyForm, theme: { ...defaultTheme } });
        setShowForm(true);
    };

    const handleClose = () => {
        setShowForm(false);
        setEditingId(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return toast.error(isRtl ? 'الاسم مطلوب' : 'Name is required');
        setIsSaving(true);
        try {
            const data = {
                name: form.name.trim(),
                logo: form.logo.trim(),
                active: form.active,
                theme: form.theme,
            };
            if (editingId) {
                await updateRestaurant(editingId, data);
                toast.success(isRtl ? 'تم تحديث المطعم' : 'Restaurant updated');
            } else {
                await addRestaurant(data);
                toast.success(isRtl ? 'تم إضافة المطعم' : 'Restaurant added');
            }
            handleClose();
        } catch (err: any) {
            toast.error(err?.message || (isRtl ? 'حدث خطأ' : 'An error occurred'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (r: Restaurant) => {
        try {
            await updateRestaurant(r.id, { active: !r.active });
            toast.success(r.active
                ? (isRtl ? 'تم إيقاف المطعم' : 'Restaurant deactivated')
                : (isRtl ? 'تم تفعيل المطعم' : 'Restaurant activated'));
        } catch (err: any) {
            toast.error(err?.message || (isRtl ? 'حدث خطأ' : 'An error occurred'));
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteRestaurant(id);
            toast.success(isRtl ? 'تم حذف المطعم' : 'Restaurant deleted');
            setDeleteConfirmId(null);
        } catch (err: any) {
            toast.error(err?.message || (isRtl ? 'حدث خطأ' : 'An error occurred'));
        }
    };

    return (
        <div className="p-4 md:p-6 h-full overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
                        <Store size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">
                            {isRtl ? 'إدارة المطاعم' : 'Restaurants'}
                        </h1>
                        <p className="text-sm text-slate-500">
                            {isRtl ? `${restaurants.length} مطعم مسجّل` : `${restaurants.length} registered`}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleNew}
                    className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl font-bold transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    {isRtl ? 'مطعم جديد' : 'New Restaurant'}
                </button>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex justify-center items-center py-20 text-slate-400">
                    <Loader2 size={32} className="animate-spin" />
                </div>
            )}

            {/* Empty */}
            {!isLoading && restaurants.length === 0 && (
                <div className="text-center py-20">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Store size={36} className="text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-600 mb-1">
                        {isRtl ? 'لا توجد مطاعم بعد' : 'No restaurants yet'}
                    </h3>
                    <p className="text-slate-400 text-sm mb-6">
                        {isRtl ? 'أضف مطعمك الأول للبدء' : 'Add your first restaurant to get started'}
                    </p>
                    <button
                        onClick={handleNew}
                        className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-colors"
                    >
                        <Plus size={18} />
                        {isRtl ? 'أضف مطعم' : 'Add Restaurant'}
                    </button>
                </div>
            )}

            {/* Restaurants Grid */}
            {!isLoading && restaurants.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {restaurants.map((r) => (
                        <div
                            key={r.id}
                            className={cn(
                                "bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200",
                                r.active ? "border-slate-200" : "border-slate-200 opacity-70"
                            )}
                        >
                            {/* Color Strip */}
                            <div
                                className="h-2 w-full"
                                style={{ background: `linear-gradient(to right, ${r.theme?.primaryColor || '#e63946'}, ${r.theme?.secondaryColor || '#ffd700'})` }}
                            />

                            <div className="p-4">
                                {/* Restaurant Header */}
                                <div className="flex items-start gap-3 mb-4">
                                    <div
                                        className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border-2"
                                        style={{ borderColor: r.theme?.primaryColor || '#e63946' + '33' }}
                                    >
                                        {r.logo ? (
                                            <img src={r.logo} alt={r.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div
                                                className="w-full h-full flex items-center justify-center text-2xl font-black text-white"
                                                style={{ background: r.theme?.primaryColor || '#e63946' }}
                                            >
                                                {r.name?.charAt(0) || '?'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-800 text-lg leading-tight truncate">{r.name}</h3>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            {r.active ? (
                                                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                    <CheckCircle size={12} />
                                                    {isRtl ? 'مفعّل' : 'Active'}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                    <XCircle size={12} />
                                                    {isRtl ? 'موقف' : 'Inactive'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Link Display */}
                                <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-200">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <Globe size={14} className="shrink-0 text-brand-500" />
                                        <span className="text-xs font-mono truncate flex-1 text-slate-600">
                                            /r/{r.id}
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <button
                                        onClick={() => handleCopyLink(r.id)}
                                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100 font-bold text-sm transition-colors"
                                    >
                                        <Copy size={15} />
                                        {isRtl ? 'نسخ الرابط' : 'Copy Link'}
                                    </button>
                                    <button
                                        onClick={() => handleOpenLink(r.id)}
                                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-sm transition-colors"
                                    >
                                        <ExternalLink size={15} />
                                        {isRtl ? 'فتح المنيو' : 'Open Menu'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => handleToggleActive(r)}
                                        className={cn(
                                            "flex items-center justify-center gap-1 py-2 rounded-xl font-bold text-xs transition-colors",
                                            r.active
                                                ? "bg-red-50 text-red-600 hover:bg-red-100"
                                                : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                        )}
                                    >
                                        {r.active ? <XCircle size={14} /> : <CheckCircle size={14} />}
                                        {r.active ? (isRtl ? 'إيقاف' : 'Disable') : (isRtl ? 'تفعيل' : 'Enable')}
                                    </button>
                                    <button
                                        onClick={() => handleEdit(r)}
                                        className="flex items-center justify-center gap-1 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs transition-colors"
                                    >
                                        <Pencil size={14} />
                                        {isRtl ? 'تعديل' : 'Edit'}
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirmId(r.id)}
                                        className="flex items-center justify-center gap-1 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs transition-colors"
                                    >
                                        <Trash2 size={14} />
                                        {isRtl ? 'حذف' : 'Delete'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingId
                                    ? (isRtl ? 'تعديل المطعم' : 'Edit Restaurant')
                                    : (isRtl ? 'إضافة مطعم جديد' : 'Add New Restaurant')}
                            </h2>
                            <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                    {isRtl ? 'اسم المطعم *' : 'Restaurant Name *'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder={isRtl ? 'مثال: مطعم الشيف' : 'e.g. Chef Restaurant'}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none transition-all"
                                />
                            </div>

                            {/* Logo */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                    {isRtl ? 'رابط اللوجو (اختياري)' : 'Logo URL (optional)'}
                                </label>
                                <input
                                    type="url"
                                    value={form.logo}
                                    onChange={(e) => setForm(f => ({ ...f, logo: e.target.value }))}
                                    placeholder="https://example.com/logo.png"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none transition-all text-left"
                                    dir="ltr"
                                />
                                {form.logo && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <img
                                            src={form.logo}
                                            alt="preview"
                                            className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                        <span className="text-xs text-slate-400">{isRtl ? 'معاينة اللوجو' : 'Logo preview'}</span>
                                    </div>
                                )}
                            </div>

                            {/* Theme Colors */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                        {isRtl ? 'اللون الأساسي' : 'Primary Color'}
                                    </label>
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                        <input
                                            type="color"
                                            value={form.theme.primaryColor}
                                            onChange={(e) => setForm(f => ({ ...f, theme: { ...f.theme, primaryColor: e.target.value } }))}
                                            className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                                        />
                                        <span className="text-xs font-mono text-slate-600">{form.theme.primaryColor}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                        {isRtl ? 'اللون الثانوي' : 'Secondary Color'}
                                    </label>
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                        <input
                                            type="color"
                                            value={form.theme.secondaryColor}
                                            onChange={(e) => setForm(f => ({ ...f, theme: { ...f.theme, secondaryColor: e.target.value } }))}
                                            className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                                        />
                                        <span className="text-xs font-mono text-slate-600">{form.theme.secondaryColor}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Color Preview */}
                            <div
                                className="h-3 w-full rounded-full"
                                style={{ background: `linear-gradient(to right, ${form.theme.primaryColor}, ${form.theme.secondaryColor})` }}
                            />

                            {/* Active Toggle */}
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-sm font-bold text-slate-700">
                                    {isRtl ? 'حالة المطعم' : 'Restaurant Status'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm transition-colors",
                                        form.active
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-slate-200 text-slate-600"
                                    )}
                                >
                                    {form.active ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                    {form.active ? (isRtl ? 'مفعّل' : 'Active') : (isRtl ? 'موقف' : 'Inactive')}
                                </button>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                {isSaving ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Save size={18} />
                                )}
                                {isSaving
                                    ? (isRtl ? 'جاري الحفظ...' : 'Saving...')
                                    : (editingId ? (isRtl ? 'حفظ التعديلات' : 'Save Changes') : (isRtl ? 'إضافة المطعم' : 'Add Restaurant'))}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={28} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">
                            {isRtl ? 'تأكيد الحذف' : 'Confirm Delete'}
                        </h3>
                        <p className="text-slate-500 text-sm mb-6">
                            {isRtl
                                ? 'هل أنت متأكد من حذف هذا المطعم؟ لا يمكن التراجع.'
                                : 'Are you sure you want to delete this restaurant? This cannot be undone.'}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
                            >
                                {isRtl ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirmId)}
                                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors"
                            >
                                {isRtl ? 'حذف' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
