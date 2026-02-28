import React, { useState, useEffect } from 'react';
import { ShoppingBag, CheckCircle, XCircle, Clock, MapPin, Phone, User, Calendar } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { addOrder } from '../services/db';
import { db } from '../lib/firebase';
import { OnlineOrder } from '../types';
import { formatCurrency } from '../utils';
import { sendWhatsAppBackgroundMessage } from '../utils/whatsapp';
import toast from 'react-hot-toast';
import { useRestaurantId, useRestaurantSettings } from '../context/RestaurantContext';

interface OnlineOrdersProps {
    isRtl: boolean;
}

export const OnlineOrders: React.FC<OnlineOrdersProps> = ({ isRtl }) => {
    const restaurantId = useRestaurantId();
    const settings = useRestaurantSettings();
    const [orders, setOrders] = useState<OnlineOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Listen to online orders that are pending confirmation
        // Scoped to this restaurant's sub-collection
        const q = query(
            collection(db, 'restaurants', restaurantId, 'online_orders'),
            where('status', '==', 'pending_online')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const pendingOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as OnlineOrder[];

            // Sort in memory since we might not have a composite index right away
            pendingOrders.sort((a, b) => {
                const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return timeA - timeB; // Oldest first
            });

            setOrders(pendingOrders);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching online orders:', error);
            toast.error(isRtl ? 'حدث خطأ في تحميل الطلبات' : 'Error loading orders');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isRtl, restaurantId]);

    const handleAcceptOrder = async (orderId: string | number) => {
        try {
            const acceptedOrder = orders.find(o => o.id === orderId);

            if (acceptedOrder) {
                // Send to main POS/KDS pipeline so the kitchen sees it
                await addOrder(restaurantId, {
                    type: acceptedOrder.type || 'delivery',
                    items: acceptedOrder.items || [],
                    total_amount: acceptedOrder.total_amount || 0,
                    payment_method: 'cash',
                    status: 'pending', // Triggers the 'pending' status in the kitchen screen
                    customer: acceptedOrder.customer,
                    delivery_fee: 0, // Online orders are assumed not to have a dynamic fee right now
                });

                // Update in restaurant sub-collection
                await updateDoc(doc(db, 'restaurants', restaurantId, 'online_orders', orderId.toString()), {
                    status: 'accepted'
                });

                // Send confirmation WhatsApp message in the background
                if (acceptedOrder.customer) {
                    const customerPhone = acceptedOrder.customer.whatsapp || acceptedOrder.customer.phone;
                    if (customerPhone) {
                        const template = settings.wa_msg_online
                            || 'مرحباً {name}،\nتم تأكيد طلبك بنجاح وهو الآن قيد التجهيز في المطبخ! 👨‍🍳\nرقم الطلب: {order_id}';
                        const waMessage = template
                            .replace(/{name}/g, acceptedOrder.customer.name || '')
                            .replace(/{phone}/g, customerPhone)
                            .replace(/{order_id}/g, orderId.toString().slice(-4))
                            .replace(/{total}/g, formatCurrency(acceptedOrder.total_amount || 0, isRtl, settings.currency));

                        sendWhatsAppBackgroundMessage(customerPhone, waMessage, {
                            apiUrl: settings.whatsapp_api_url,
                            apiToken: settings.whatsapp_api_token,
                            isSimulated: settings.whatsapp_simulate
                        });
                    }
                }
            }

            toast.success(isRtl ? 'تم قبول الطلب وإرساله للمطبخ' : 'Order accepted and sent to kitchen');
        } catch (err) {
            console.error(err);
            toast.error(isRtl ? 'حدث خطأ' : 'An error occurred');
        }
    };

    const handleRejectOrder = async (orderId: string | number) => {
        if (!confirm(isRtl ? 'هل تريد بالتأكيد رفض هذا الطلب؟' : 'Are you sure you want to reject this order?')) return;
        try {
            await updateDoc(doc(db, 'restaurants', restaurantId, 'online_orders', orderId.toString()), {
                status: 'cancelled'
            });
            toast.success(isRtl ? 'تم رفض الطلب' : 'Order rejected');
        } catch (err) {
            console.error(err);
            toast.error(isRtl ? 'حدث خطأ' : 'An error occurred');
        }
    };

    const formatDate = (isoString?: string) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return new Intl.DateTimeFormat(isRtl ? 'ar-EG' : 'en-US', {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        }).format(d);
    };

    return (
        <div className="p-8 bg-slate-50 h-full overflow-y-auto w-full">
            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <ShoppingBag size={32} className="text-brand-600" />
                        {isRtl ? 'الطلبات الإلكترونية' : 'Online Orders'}
                    </h1>
                    <p className="text-slate-500 mt-2">
                        {isRtl ? 'مراجعة وتأكيد طلبات العملاء من المنيو الإلكتروني' : 'Review and confirm customer orders from the digital menu'}
                    </p>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 font-bold text-slate-700">
                    {orders.length} {isRtl ? 'طلبات بانتظار التأكيد' : 'Orders pending'}
                </div>
            </header>

            {loading ? (
                <div className="flex justify-center items-center h-64 text-slate-400">
                    {isRtl ? 'جاري التحميل...' : 'Loading...'}
                </div>
            ) : orders.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                    <ShoppingBag size={64} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-xl font-bold text-slate-600 mb-2">{isRtl ? 'لا يوجد طلبات جديدة' : 'No new orders'}</h3>
                    <p className="text-slate-400">{isRtl ? 'طلبات المنيو الإلكتروني ستظهر هنا فور وصولها' : 'Online menu orders will appear here'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {orders.map(order => (
                        <div key={order.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-brand-100 flex flex-col">
                            {/* Order Header */}
                            <div className="bg-brand-50 p-4 border-b border-brand-100 flex justify-between items-center">
                                <div className="flex items-center gap-2 text-brand-700 font-bold">
                                    <Clock size={18} />
                                    <span>{formatDate(order.created_at)}</span>
                                </div>
                                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
                                    {isRtl ? 'بانتظار التأكيد' : 'Pending'}
                                </span>
                            </div>

                            {/* Customer Details */}
                            <div className="p-5 border-b border-slate-100 space-y-3 bg-slate-50/50">
                                <div className="flex items-start gap-3">
                                    <User size={18} className="text-slate-400 mt-0.5" />
                                    <div>
                                        <span className="font-bold text-slate-800 focus:outline-none">{order.customer?.name}</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Phone size={18} className="text-slate-400 mt-0.5" />
                                    <div className="flex flex-col">
                                        <span className="text-slate-600 font-mono" dir="ltr">{order.customer?.phone}</span>
                                        {order.customer?.whatsapp && order.customer.whatsapp !== order.customer.phone && (
                                            <span className="text-green-600 text-xs mt-1 font-bold">WA: {order.customer.whatsapp}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <MapPin size={18} className="text-slate-400 mt-0.5" />
                                    <span className="text-slate-600 text-sm leading-relaxed">{order.customer?.address}</span>
                                </div>
                                {order.customer?.birthday && (
                                    <div className="flex items-start gap-3">
                                        <Calendar size={18} className="text-brand-400 mt-0.5" />
                                        <span className="text-brand-600 text-sm font-bold bg-brand-50 px-2 py-0.5 rounded">
                                            {isRtl ? 'ميلاد: ' : 'BD: '} {order.customer.birthday}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Order Items */}
                            <div className="p-5 flex-1">
                                <h4 className="font-bold text-slate-700 mb-3 text-sm">{isRtl ? 'تفاصيل الطلب' : 'Order Details'}</h4>
                                <ul className="space-y-3">
                                    {order.items.map((item, idx) => (
                                        <li key={idx} className="flex justify-between items-start text-sm">
                                            <div className="flex gap-2">
                                                <span className="font-bold text-slate-800">{item.quantity}x</span>
                                                <div className="flex flex-col">
                                                    <span className="text-slate-600">
                                                        {item.name} {item.category_name && <span className="text-slate-400 text-sm">({item.category_name})</span>}
                                                    </span>
                                                    {item.selectedSize && <span className="text-xs text-slate-400">{item.selectedSize}</span>}
                                                </div>
                                            </div>
                                            <span className="font-bold text-slate-700">{formatCurrency(item.price * item.quantity, isRtl, settings.currency)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Order Footer / Actions */}
                            <div className="p-5 bg-slate-50 border-t border-slate-100">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-slate-500 font-bold">{isRtl ? 'المجموع' : 'Total'}</span>
                                    <span className="text-2xl font-black text-brand-600">{formatCurrency(order.total_amount || 0, isRtl, settings.currency)}</span>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleAcceptOrder(order.id)}
                                        className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-700 transition-colors"
                                    >
                                        <CheckCircle size={20} />
                                        {isRtl ? 'تأكيد وإرسال للمطبخ' : 'Accept & Send KDS'}
                                    </button>
                                    <button
                                        onClick={() => handleRejectOrder(order.id)}
                                        className="w-14 bg-white text-red-500 border border-slate-200 rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors"
                                        title={isRtl ? 'رفض الطلب' : 'Reject Order'}
                                    >
                                        <XCircle size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
