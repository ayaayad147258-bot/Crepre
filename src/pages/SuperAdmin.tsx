import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getFirestore, collection, getDocs, addDoc, deleteDoc,
    doc, onSnapshot, setDoc
} from 'firebase/firestore';
import { Store, Plus, Trash2, Users, Eye, EyeOff, Copy, Check, LogIn, AlertTriangle, ChefHat } from 'lucide-react';

// ---- Firebase (direct config so it works independently) ----
const firebaseConfig = {
    apiKey: "AIzaSyBkieBAwbbRe6iDAs-kqD28L8D7qkfJD6k",
    authDomain: "crepree.firebaseapp.com",
    projectId: "crepree",
    storageBucket: "crepree.firebasestorage.app",
    messagingSenderId: "136152032204",
    appId: "1:136152032204:web:e28ccbfd225f44953a3369",
};
const app = initializeApp(firebaseConfig, 'superadmin');
const db = getFirestore(app);

// ---- Super Admin Password (change this) ----
const SUPER_ADMIN_PASSWORD = 'superadmin2025';

// ---- ID generator ----
function makeRestaurantId(name: string) {
    const slug = name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 25);
    return `${slug}-${Date.now().toString(36)}`;
}

interface Restaurant {
    id: string;
    name: string;
    name_en: string;
    created_at: string;
    active: boolean;
}

interface RestaurantUser {
    id: string;
    username: string;
    password: string;
    role: string;
}

export const SuperAdmin: React.FC = () => {
    const [authed, setAuthed] = useState(false);
    const [passInput, setPassInput] = useState('');
    const [passError, setPassError] = useState(false);

    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [loading, setLoading] = useState(false);

    // New restaurant form
    const [showForm, setShowForm] = useState(false);
    const [nameAr, setNameAr] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [adminUser, setAdminUser] = useState('');
    const [adminPass, setAdminPass] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState<{ id: string; name: string; username: string; password: string } | null>(null);

    // Users modal
    const [viewingRestaurant, setViewingRestaurant] = useState<Restaurant | null>(null);
    const [restaurantUsers, setRestaurantUsers] = useState<RestaurantUser[]>([]);
    const [copiedId, setCopiedId] = useState('');

    // ---- Load restaurants ----
    useEffect(() => {
        if (!authed) return;
        setLoading(true);
        const unsub = onSnapshot(collection(db, 'restaurants'), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Restaurant[];
            data.sort((a, b) => b.created_at?.localeCompare(a.created_at || '') || 0);
            setRestaurants(data);
            setLoading(false);
        });
        return () => unsub();
    }, [authed]);

    // ---- Login ----
    const handleLogin = () => {
        if (passInput === SUPER_ADMIN_PASSWORD) {
            setAuthed(true);
            setPassError(false);
        } else {
            setPassError(true);
        }
    };

    // ---- Create restaurant ----
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nameAr || !adminUser || !adminPass) return;
        setCreating(true);
        try {
            const restaurantId = makeRestaurantId(nameEn || nameAr);

            // Create restaurant doc
            await setDoc(doc(db, 'restaurants', restaurantId), {
                name: nameAr,
                name_en: nameEn || nameAr,
                created_at: new Date().toISOString(),
                active: true,
            });

            // Create admin user
            await addDoc(collection(db, 'restaurants', restaurantId, 'users'), {
                username: adminUser,
                password: adminPass,
                role: 'admin',
                restaurantId,
                permissions: ['pos', 'kds', 'inventory', 'reports', 'customers', 'drivers', 'expenses', 'settings'],
                created_at: new Date().toISOString(),
            });

            setCreated({ id: restaurantId, name: nameAr, username: adminUser, password: adminPass });
            setNameAr(''); setNameEn(''); setAdminUser(''); setAdminPass('');
            setShowForm(false);
        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء الإنشاء');
        } finally {
            setCreating(false);
        }
    };

    // ---- Delete restaurant ----
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`هل أنت متأكد من حذف مطعم "${name}"؟ هذا لن يحذف البيانات الفرعية.`)) return;
        await deleteDoc(doc(db, 'restaurants', id));
    };

    // ---- View users ----
    const handleViewUsers = async (restaurant: Restaurant) => {
        setViewingRestaurant(restaurant);
        const snap = await getDocs(collection(db, 'restaurants', restaurant.id, 'users'));
        setRestaurantUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as RestaurantUser[]);
    };

    // ---- Copy to clipboard ----
    const copyText = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(key);
        setTimeout(() => setCopiedId(''), 2000);
    };

    // ===================================================
    // RENDER: Login Screen
    // ===================================================
    if (!authed) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 w-full max-w-sm shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-purple-400/30">
                            <ChefHat className="text-purple-300" size={32} />
                        </div>
                        <h1 className="text-2xl font-black text-white">Super Admin</h1>
                        <p className="text-slate-400 text-sm mt-1">لوحة التحكم الرئيسية</p>
                    </div>
                    <div className="space-y-4">
                        <div className="relative">
                            <input
                                type="password"
                                value={passInput}
                                onChange={e => setPassInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                placeholder="كلمة المرور"
                                className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${passError ? 'border-red-400 focus:ring-red-400/30' : 'border-white/20 focus:ring-purple-500/40'}`}
                            />
                            {passError && (
                                <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                                    <AlertTriangle size={12} /> كلمة المرور غلط
                                </p>
                            )}
                        </div>
                        <button
                            onClick={handleLogin}
                            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <LogIn size={18} /> دخول
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ===================================================
    // RENDER: Main Dashboard
    // ===================================================
    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                            <ChefHat size={20} />
                        </div>
                        <div>
                            <h1 className="font-black text-lg">Super Admin Panel</h1>
                            <p className="text-slate-400 text-xs">إدارة المطاعم</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-all text-sm"
                    >
                        <Plus size={18} /> إضافة مطعم جديد
                    </button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Success Card */}
                {created && (
                    <div className="mb-6 bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-black text-emerald-300 text-lg">✅ تم إنشاء المطعم بنجاح!</h3>
                                <p className="text-emerald-400/70 text-sm">احتفظ بهذه البيانات وابعتها لصاحب المطعم</p>
                            </div>
                            <button onClick={() => setCreated(null)} className="text-slate-500 hover:text-white transition-colors">✕</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: '🏠 اسم المطعم', value: created.name },
                                { label: '🆔 Restaurant ID', value: created.id },
                                { label: '👤 المستخدم', value: created.username },
                                { label: '🔑 كلمة المرور', value: created.password },
                            ].map(item => (
                                <div key={item.label} className="bg-white/5 rounded-xl p-3 flex justify-between items-center">
                                    <div>
                                        <p className="text-slate-400 text-xs">{item.label}</p>
                                        <p className="font-mono font-bold text-sm text-white">{item.value}</p>
                                    </div>
                                    <button
                                        onClick={() => copyText(item.value, item.label)}
                                        className="p-1.5 text-slate-400 hover:text-emerald-300 transition-colors"
                                    >
                                        {copiedId === item.label ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-5">
                        <p className="text-slate-400 text-sm">إجمالي المطاعم</p>
                        <p className="text-4xl font-black text-white mt-1">{restaurants.length}</p>
                    </div>
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-5">
                        <p className="text-slate-400 text-sm">مطاعم نشطة</p>
                        <p className="text-4xl font-black text-emerald-400 mt-1">{restaurants.filter(r => r.active).length}</p>
                    </div>
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-5">
                        <p className="text-slate-400 text-sm">آخر إضافة</p>
                        <p className="text-sm font-bold text-slate-300 mt-2">
                            {restaurants[0] ? new Date(restaurants[0].created_at).toLocaleDateString('ar-EG') : '—'}
                        </p>
                    </div>
                </div>

                {/* Restaurants Table */}
                <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-white/10">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <Store size={20} className="text-purple-400" /> قائمة المطاعم
                        </h2>
                    </div>
                    {loading ? (
                        <div className="p-12 text-center text-slate-500">جاري التحميل...</div>
                    ) : restaurants.length === 0 ? (
                        <div className="p-12 text-center">
                            <Store size={48} className="mx-auto text-slate-700 mb-3" />
                            <p className="text-slate-500">لا يوجد مطاعم حتى الآن</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {restaurants.map(r => (
                                <div key={r.id} className="p-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center border border-purple-500/20">
                                            <Store size={18} className="text-purple-400" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{r.name}</p>
                                            <p className="text-slate-500 text-xs font-mono">{r.id}</p>
                                            <p className="text-slate-600 text-xs">{new Date(r.created_at).toLocaleDateString('ar-EG')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${r.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {r.active ? 'نشط' : 'موقوف'}
                                        </span>
                                        <button
                                            onClick={() => handleViewUsers(r)}
                                            className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl transition-all"
                                            title="عرض المستخدمين"
                                        >
                                            <Users size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(r.id, r.name)}
                                            className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-all"
                                            title="حذف"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Restaurant Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="font-black text-lg">🏪 إضافة مطعم جديد</h2>
                            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-bold text-slate-400 mb-2 block">اسم المطعم (بالعربي) *</label>
                                <input required value={nameAr} onChange={e => setNameAr(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-white"
                                    placeholder="مطعم السلطان" />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-slate-400 mb-2 block">اسم المطعم (بالإنجليزي للـ ID)</label>
                                <input value={nameEn} onChange={e => setNameEn(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-white"
                                    placeholder="sultan" />
                            </div>
                            <div className="border-t border-white/10 pt-4">
                                <p className="text-xs text-slate-500 mb-3">بيانات الأدمن (صاحب المطعم)</p>
                                <div className="space-y-3">
                                    <input required value={adminUser} onChange={e => setAdminUser(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-white"
                                        placeholder="👤 اسم المستخدم" />
                                    <div className="relative">
                                        <input required type={showPass ? 'text' : 'password'} value={adminPass} onChange={e => setAdminPass(e.target.value)}
                                            className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-white"
                                            placeholder="🔑 كلمة المرور" />
                                        <button type="button" onClick={() => setShowPass(!showPass)}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" disabled={creating}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                                {creating ? 'جاري الإنشاء...' : <><Plus size={18} /> إنشاء المطعم</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Users Modal */}
            {viewingRestaurant && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="font-black text-lg">👥 موظفو {viewingRestaurant.name}</h2>
                            <button onClick={() => setViewingRestaurant(null)} className="text-slate-500 hover:text-white">✕</button>
                        </div>
                        <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
                            {restaurantUsers.length === 0 ? (
                                <p className="text-slate-500 text-center py-4">لا يوجد موظفين</p>
                            ) : restaurantUsers.map(u => (
                                <div key={u.id} className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-white">{u.username}</p>
                                        <p className="text-slate-400 text-xs">{u.role === 'admin' ? '👑 أدمن' : '💼 كاشير'}</p>
                                    </div>
                                    <span className="font-mono text-slate-400 text-sm bg-white/5 px-3 py-1 rounded-lg">{u.password}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
