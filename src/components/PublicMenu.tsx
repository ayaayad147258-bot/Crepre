import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Send, Gift, MapPin, Phone, User, Store } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { Category, Product, OrderItem } from '../types';
import { cn } from '../utils';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { listenToCategories, listenToProducts, listenToStoreSettings, listenToRestaurantCategories, listenToRestaurantProducts } from '../services/db';

interface PublicMenuProps {
    restaurantName?: string;
    restaurantLogo?: string;
    restaurantId?: string;  // If provided, reads menu from restaurant subcollection
    theme?: { primaryColor: string; secondaryColor: string };
    currency?: string;
}

export const PublicMenu: React.FC<PublicMenuProps> = ({ restaurantName: propName, restaurantLogo: propLogo, restaurantId, theme: propTheme }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [cart, setCart] = useState<OrderItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Customer Form
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerWhatsapp, setCustomerWhatsapp] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerBirthday, setCustomerBirthday] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderComplete, setOrderComplete] = useState(false);

    // Store info (from Firestore so it works on any device)
    // If props are provided (from multi-tenant route), use them; otherwise fetch from Firestore
    const [storeSettings, setStoreSettings] = useState<{ name?: string; logo?: string; currency?: string }>({});
    const restaurantName = propName || storeSettings.name || 'مطعمنا';
    const restaurantLogo = propLogo !== undefined ? propLogo : (storeSettings.logo || '');
    const currency = storeSettings.currency || 'EGP';

    // Apply theme from props if provided
    useEffect(() => {
        if (propTheme) {
            document.documentElement.style.setProperty('--color-primary', propTheme.primaryColor);
            document.documentElement.style.setProperty('--color-secondary', propTheme.secondaryColor);
        }
    }, [propTheme]);

    useEffect(() => {
        let unsubSettings: (() => void) | undefined;
        if (restaurantId) {
            unsubSettings = listenToStoreSettings(restaurantId, (data) => {
                setStoreSettings(data);
            });
        }

        let unsubCats: () => void;
        let unsubProds: () => void;

        if (restaurantId) {
            // Multi-tenant: read from restaurant's own subcollection
            unsubCats = listenToRestaurantCategories(restaurantId, (cats) => {
                setCategories(cats);
            });
            unsubProds = listenToRestaurantProducts(restaurantId, (prods) => {
                setProducts(prods.filter(p => p.active !== false));
                setIsLoading(false);
            });
        } else {
            // Legacy: Global collections for /menu route - these need a default ID or handle differently
            // In a multi-tenant app, /menu without an ID is ambiguous. 
            // We'll keep it as a fallback but suggest using /:restaurantId
            unsubCats = () => { };
            unsubProds = () => { };
            setIsLoading(false);
        }

        return () => {
            unsubSettings?.();
            unsubCats();
            unsubProds();
        };
    }, [propName, restaurantId]);

    const getPrice = (p: Product, size?: 'mini' | 'medium' | 'large' | 'roll') => {
        if (size && p.sizes && p.sizes[size]) return p.sizes[size];
        return p.price || 0;
    };

    const getProductImage = (p: Product) => {
        if (p.image && typeof p.image === 'string' && p.image.startsWith('http')) {
            return p.image;
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name_ar || p.name)}&background=random&color=fff&size=200`;
    };

    const addToCart = (product: Product, size?: 'mini' | 'medium' | 'large' | 'roll') => {
        setCart(prev => {
            const price = getPrice(product, size);
            const existing = prev.find(item => item.product_id === product.id && item.selectedSize === size);
            if (existing) {
                return prev.map(item =>
                    item.product_id === product.id && item.selectedSize === size
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }

            const category = categories.find(c => c.id.toString() === product.category_id.toString());
            const categoryName = category ? (category.name_ar || category.name) : undefined;

            return [...prev, {
                product_id: product.id,
                name: product.name_ar || product.name,
                category_name: categoryName,
                price,
                quantity: 1,
                selectedSize: size
            }];
        });
        toast.success('تمت الإضافة للسلة');
    };

    const updateQuantity = (index: number, delta: number) => {
        setCart(prev => {
            const newCart = [...prev];
            newCart[index].quantity += delta;
            if (newCart[index].quantity <= 0) {
                newCart.splice(index, 1);
            }
            return newCart;
        });
    };

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleSubmitOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (cart.length === 0) return toast.error('السلة فارغة!');
        if (!customerName || !customerPhone || !customerAddress) {
            return toast.error('يرجى ملء البيانات الأساسية (الاسم، الهاتف، العنوان)');
        }

        setIsSubmitting(true);
        try {
            // Clean cart items - Firebase rejects undefined values
            const cleanItems = cart.map(item => {
                const cleaned: any = {
                    product_id: item.product_id?.toString() || '',
                    name: item.name || '',
                    price: Number(item.price) || 0,
                    quantity: Number(item.quantity) || 1,
                };
                if (item.category_name) cleaned.category_name = item.category_name;
                if (item.selectedSize) cleaned.selectedSize = item.selectedSize;
                return cleaned;
            });

            // Build customer object - skip empty optional fields
            const customerData: any = {
                name: customerName,
                phone: customerPhone,
                address: customerAddress,
            };
            if (customerWhatsapp) customerData.whatsapp = customerWhatsapp;
            if (customerBirthday) customerData.birthday = customerBirthday;

            // 1. Create Online Order in the correct collection
            const newOrder: any = {
                type: 'delivery',
                status: 'pending_online',
                customer: customerData,
                items: cleanItems,
                total_amount: total,
                created_at: new Date().toISOString(),
                created_at_server: serverTimestamp(),
            };

            const ordersCol = restaurantId
                ? collection(db, 'restaurants', restaurantId, 'online_orders')
                : collection(db, 'online_orders');

            await addDoc(ordersCol, newOrder);

            // 2. Save/Update Customer internally for marketing
            const phoneId = customerPhone.replace(/\D/g, '');
            if (phoneId) {
                const custData: any = {
                    name: customerName,
                    phone: customerPhone,
                    address: customerAddress,
                    last_order_date: new Date().toISOString(),
                };
                if (customerWhatsapp) custData.whatsapp = customerWhatsapp;
                else custData.whatsapp = customerPhone;
                if (customerBirthday) custData.birthday = customerBirthday;

                const customerDoc = restaurantId
                    ? doc(db, 'restaurants', restaurantId, 'customers', phoneId)
                    : doc(db, 'customers', phoneId);

                await setDoc(customerDoc, custData, { merge: true });
            }

            setCart([]);
            setOrderComplete(true);
            toast.success('تم إرسال طلبك بنجاح!');
        } catch (err: any) {
            console.error('Order submission error:', err?.code, err?.message, err);
            toast.error(`حدث خطأ: ${err?.message || 'يرجى المحاولة مرة أخرى'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (orderComplete) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-arabic" dir="rtl">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check size={48} />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800 mb-4">شكراً لطلبك!</h2>
                    <p className="text-slate-600 mb-8">
                        تم استلام طلبك بنجاح. سيتم التواصل معك قريباً لتأكيد الطلب.
                    </p>
                    <button
                        onClick={() => { setOrderComplete(false); setIsCartOpen(false); }}
                        className="w-full py-4 rounded-xl font-bold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                    >
                        العودة للمنيو
                    </button>
                </div>
                <Toaster position="top-center" />
            </div>
        );
    }

    const filteredProducts = activeCategory === 'all'
        ? products
        : products.filter(p => p.category_id.toString() === activeCategory.toString());

    return (
        <div className="min-h-screen bg-slate-50 font-arabic pb-24" dir="rtl">
            {/* Header */}
            <header className="bg-white sticky top-0 z-40 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {restaurantLogo ? (
                            <img src={restaurantLogo} alt="Logo" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                            <div className="w-10 h-10 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center">
                                <Store size={24} />
                            </div>
                        )}
                        <h1 className="text-xl font-bold text-slate-800">{restaurantName}</h1>
                    </div>
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ShoppingCart size={24} />
                        {cart.length > 0 && (
                            <span className="absolute top-0 right-0 w-5 h-5 bg-brand-600 text-white text-xs font-bold flex items-center justify-center rounded-full transform translate-x-1/4 -translate-y-1/4">
                                {cart.reduce((sum, item) => sum + item.quantity, 0)}
                            </span>
                        )}
                    </button>
                </div>

                {/* Categories */}
                <div className="w-full overflow-x-auto pb-4 px-4 scrollbar-hide">
                    <div className="flex gap-2 max-w-4xl mx-auto">
                        <button
                            onClick={() => setActiveCategory('all')}
                            className={cn(
                                "px-6 py-2.5 rounded-full whitespace-nowrap font-bold transition-all duration-300 border flex items-center gap-2",
                                activeCategory === 'all'
                                    ? "bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-500/30 scale-105"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-brand-200"
                            )}
                        >
                            📦 الكل
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id.toString())}
                                className={cn(
                                    "px-6 py-2.5 rounded-full whitespace-nowrap font-bold transition-all duration-300 border flex items-center gap-2",
                                    activeCategory === cat.id.toString()
                                        ? "bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-500/30 scale-105"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-brand-200"
                                )}
                            >
                                {cat.name_ar || cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Products Grid */}
            <main className="max-w-4xl mx-auto p-4 pt-6">
                {isLoading ? (
                    <div className="flex justify-center items-center py-20 text-slate-400">
                        جاري تحميل المنيو...
                    </div>
                ) : (
                    <motion.div
                        layout
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        <AnimatePresence mode='popLayout'>
                            {filteredProducts.map(product => {
                                const hasSizes = !!product.sizes && Object.keys(product.sizes).length > 0;
                                return (
                                    <motion.div
                                        key={product.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                        transition={{ duration: 0.3 }}
                                        className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                    >
                                        <div className="aspect-video w-full bg-slate-100 relative overflow-hidden">
                                            <img
                                                src={getProductImage(product)}
                                                alt={product.name_ar || product.name}
                                                className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                                            />
                                        </div>
                                        <div className="p-5">
                                            <h3 className="font-bold text-lg text-slate-800 mb-1">{product.name_ar || product.name}</h3>

                                            {!hasSizes ? (
                                                <div className="flex justify-between items-center mt-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-2xl font-black text-brand-600">
                                                            {product.price.toFixed(2)}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{currency}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => addToCart(product)}
                                                        className="h-12 w-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center hover:bg-brand-600 hover:text-white transition-all duration-300 shadow-sm active:scale-95"
                                                    >
                                                        <Plus size={24} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="mt-4 space-y-3">
                                                    {Object.entries(product.sizes || {}).map(([size, price]) => (
                                                        price ? (
                                                            <div key={size} className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl border border-slate-100 hover:border-brand-100 transition-colors">
                                                                <span className="text-sm font-bold text-slate-600">
                                                                    {size === 'mini' ? 'ميني' : size === 'medium' ? 'وسط' : size === 'large' ? 'كبير' : 'رول'}
                                                                </span>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="font-black text-brand-600">
                                                                        {Number(price).toFixed(2)} <span className="text-[9px] font-normal opacity-70 uppercase">{currency}</span>
                                                                    </span>
                                                                    <button
                                                                        onClick={() => addToCart(product, size as any)}
                                                                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-brand-600 hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-all shadow-sm active:scale-90"
                                                                    >
                                                                        <Plus size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : null
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </motion.div>
                )}
            </main>

            {/* Floating Cart Button (Mobile) */}
            {cart.length > 0 && !isCartOpen && (
                <div className="fixed bottom-6 left-0 right-0 px-4 z-30 md:hidden">
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="w-full bg-brand-600 text-white rounded-2xl p-4 flex justify-between items-center shadow-lg font-bold"
                    >
                        <div className="flex items-center gap-2">
                            <span className="bg-white/20 w-8 h-8 flex items-center justify-center rounded-full text-sm">
                                {cart.reduce((sum, item) => sum + item.quantity, 0)}
                            </span>
                            <span>معاينة الطلب</span>
                        </div>
                        <span>{total.toFixed(2)}</span>
                    </button>
                </div>
            )}

            {/* Cart Modal */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <ShoppingCart size={24} className="text-brand-600" />
                                سلة المشتريات
                            </h2>
                            <button
                                onClick={() => setIsCartOpen(false)}
                                className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
                                title="إغلاق"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                            {cart.length === 0 ? (
                                <div className="text-center text-slate-400 py-10">
                                    <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>السلة فارغة</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {cart.map((item, idx) => (
                                        <div key={`${item.product_id}-${item.selectedSize}`} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                                            <div>
                                                <h4 className="font-bold text-slate-800">{item.name}</h4>
                                                <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                                    {item.selectedSize && <span>الحجم: {item.selectedSize === 'mini' ? 'ميني' : item.selectedSize === 'medium' ? 'وسط' : item.selectedSize === 'large' ? 'كبير' : 'رول'}</span>}
                                                    <span className="font-bold text-brand-600">{item.price.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1 border border-slate-100">
                                                <button
                                                    onClick={() => updateQuantity(idx, -1)}
                                                    className="w-8 h-8 bg-white rounded flex items-center justify-center text-slate-600 hover:text-red-500 shadow-sm"
                                                >
                                                    <Minus size={16} />
                                                </button>
                                                <span className="font-bold w-4 text-center">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(idx, 1)}
                                                    className="w-8 h-8 bg-white rounded flex items-center justify-center text-brand-600 shadow-sm"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="bg-white p-5 text-brand-600 rounded-2xl border border-brand-100 mt-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
                                                <Gift size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800">لتكون من المحظوظين! 🎉</h4>
                                                <p className="text-xs text-slate-500 mt-0.5">أدخل تاريخ ميلادك للحصول على هدايا وعروض خاصة</p>
                                            </div>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSubmitOrder} className="bg-white p-6 rounded-2xl border border-slate-200 mt-6 space-y-4">
                                        <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">بيانات التوصيل</h3>

                                        <div className="relative">
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                                                <User size={18} />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                placeholder="الاسم بالكامل"
                                                className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                                                value={customerName}
                                                onChange={e => setCustomerName(e.target.value)}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="relative">
                                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                                                    <Phone size={18} />
                                                </div>
                                                <input
                                                    type="tel"
                                                    required
                                                    placeholder="رقم الهاتف"
                                                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-left"
                                                    dir="ltr"
                                                    value={customerPhone}
                                                    onChange={e => setCustomerPhone(e.target.value)}
                                                />
                                            </div>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                                                    WA
                                                </div>
                                                <input
                                                    type="tel"
                                                    placeholder="رقم الواتساب"
                                                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-left"
                                                    dir="ltr"
                                                    value={customerWhatsapp}
                                                    onChange={e => setCustomerWhatsapp(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <div className="absolute top-3 right-0 pr-3 flex items-start pointer-events-none text-slate-400">
                                                <MapPin size={18} />
                                            </div>
                                            <textarea
                                                required
                                                placeholder="العنوان بالتفصيل"
                                                className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all h-24 resize-none"
                                                value={customerAddress}
                                                onChange={e => setCustomerAddress(e.target.value)}
                                            />
                                        </div>

                                        <div className="relative">
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-brand-400">
                                                <Gift size={18} />
                                            </div>
                                            <input
                                                type="date"
                                                className="w-full pl-4 pr-10 py-3 bg-brand-50 border border-brand-200 text-brand-800 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                                                value={customerBirthday}
                                                onChange={e => setCustomerBirthday(e.target.value)}
                                            />
                                            <div className="text-[10px] text-brand-600 mt-1 px-1">تاريخ الميلاد (اختياري)</div>
                                        </div>

                                    </form>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-white border-t border-slate-200 z-10">
                            <div className="flex justify-between items-center mb-4 text-lg">
                                <span className="text-slate-600 font-bold">الإجمالي:</span>
                                <span className="font-black text-2xl hover-text">{total.toFixed(2)}</span>
                            </div>
                            <button
                                onClick={handleSubmitOrder}
                                disabled={cart.length === 0 || isSubmitting}
                                className="w-full py-4 bg-brand-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSubmitting ? 'جاري الإرسال...' : (
                                    <>
                                        <Send size={20} />
                                        إرسال الطلب الآن
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <Toaster position="top-center" />

            {/* Footer */}
            <footer className="text-center py-6 mt-4">
                <p className="text-xs text-slate-400">
                    مدعوم بواسطة{' '}
                    <span className="font-bold text-slate-500">⚡ Smart Food</span>
                </p>
            </footer>
        </div>
    );
};

// Check icon component for success overlay
const Check = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);
