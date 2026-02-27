import React from 'react';
import { Utensils } from 'lucide-react';
import { cn, formatCurrency } from '../utils';

interface InvoiceProps {
    cart: any[];
    total: number;
    tax: number;
    deliveryFee?: number;
    grandTotal: number;
    orderType: string;
    tableNumber: string;
    paymentMethod: string;
    orderId?: number | string;
    isRtl: boolean;
    htmlId?: string;
    customer?: { name: string; phone?: string; address?: string };
}

export const Invoice: React.FC<InvoiceProps> = ({
    cart,
    total,
    tax,
    deliveryFee = 0,
    grandTotal,
    orderType,
    tableNumber,
    paymentMethod,
    orderId,
    isRtl,
    htmlId,
    customer
}) => {
    const branchName = localStorage.getItem('pos_branch_name') || 'الفرع الرئيسي';
    const restaurantName = localStorage.getItem('pos_restaurant_name') || 'Dineify';
    const restaurantLogo = localStorage.getItem('pos_restaurant_logo') || '';
    const taxRateStr = localStorage.getItem('pos_tax_rate');
    const taxRate = taxRateStr !== null ? Number(taxRateStr) : 15;
    const date = new Date().toLocaleString(isRtl ? 'ar-EG' : 'en-US');

    return (
        <div id={htmlId} className={cn(htmlId ? "absolute top-0 left-0 -z-[9999] pointer-events-none bg-white" : "invoice-print", "p-4 w-[72mm] mx-auto text-black bg-white")} dir={isRtl ? "rtl" : "ltr"}>
            <div className="text-center mb-6">
                {restaurantLogo ? (
                    <img src={restaurantLogo} alt="Restaurant Logo" crossOrigin="anonymous" className="mx-auto h-16 w-auto mb-2 object-contain grayscale" />
                ) : (
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Utensils size={24} className="text-slate-800" />
                    </div>
                )}

                <h1 className="text-2xl font-black mb-1">{restaurantName}</h1>
                <p className="text-sm font-bold text-gray-700">{branchName}</p>
                <p className="text-xs text-gray-500 mt-1">{isRtl ? 'نظام إدارة المطاعم' : 'Restaurant POS'}</p>
                <div className="border-b-2 border-dashed border-gray-300 my-4" />

                <div className="flex justify-between text-xs mb-1">
                    <span>{isRtl ? 'التاريخ:' : 'Date:'}</span>
                    <span>{date}</span>
                </div>
                {orderId && (
                    <div className="flex justify-between text-xs mb-1">
                        <span>{isRtl ? 'رقم الطلب:' : 'Order #:'}</span>
                        <span className="font-bold">{orderId}</span>
                    </div>
                )}
                <div className="flex justify-between text-xs mb-1">
                    <span>{isRtl ? 'النوع:' : 'Type:'}</span>
                    <span className="font-bold">
                        {isRtl
                            ? (orderType === 'dine-in' ? 'داخل المطعم' : orderType === 'takeaway' ? 'تيك أوي' : 'دليفري')
                            : orderType.charAt(0).toUpperCase() + orderType.slice(1)}
                    </span>
                </div>
                {orderType === 'dine-in' && tableNumber && (
                    <div className="flex justify-between text-xs mb-1">
                        <span>{isRtl ? 'رقم الطاولة:' : 'Table #:'}</span>
                        <span className="font-bold">{tableNumber}</span>
                    </div>
                )}
                {customer && (
                    <div className="flex flex-col text-xs mt-2 pt-2 border-t-2 border-dashed border-gray-300">
                        <div className="flex justify-between mb-1">
                            <span>{isRtl ? 'العميل:' : 'Customer:'}</span>
                            <span className="font-bold">{customer.name}</span>
                        </div>
                        {customer.phone && (
                            <div className="flex justify-between mb-1">
                                <span>{isRtl ? 'الهاتف:' : 'Phone:'}</span>
                                <span>{customer.phone}</span>
                            </div>
                        )}
                        {customer.address && (
                            <div className="flex flex-col text-start mt-1">
                                <span>{isRtl ? 'العنوان:' : 'Address:'}</span>
                                <span className="font-bold whitespace-pre-wrap mt-0.5 text-[11px] leading-tight">{customer.address}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="border-b-2 border-dashed border-gray-300 mb-4" />

            <table className="w-full text-sm mb-4">
                <thead>
                    <tr className="border-b border-gray-200">
                        <th className="text-start py-1">{isRtl ? 'الصنف' : 'Item'}</th>
                        <th className="text-center py-1">{isRtl ? 'الكمية' : 'Qty'}</th>
                        <th className="text-end py-1">{isRtl ? 'السعر' : 'Price'}</th>
                    </tr>
                </thead>
                <tbody>
                    {cart.map((item, idx) => (
                        <tr key={idx}>
                            <td className="py-1 text-xs truncate max-w-[40mm]">{item.name}</td>
                            <td className="text-center py-1 text-xs">{item.quantity}</td>
                            <td className="text-end py-1 text-xs">{formatCurrency(item.price * item.quantity, isRtl)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="border-b-2 border-dashed border-gray-300 mb-4" />

            <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                    <span>{isRtl ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                    <span>{formatCurrency(total, isRtl)}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-1">
                    <span className="text-slate-500 font-bold">{isRtl ? `الضريبة (${taxRate}%)` : `Tax (${taxRate}%)`}</span>
                    <span>{formatCurrency(tax, isRtl)}</span>
                </div>

                {deliveryFee > 0 && (
                    <div className="flex justify-between items-center bg-slate-50 p-1">
                        <span className="text-slate-500 font-bold">{isRtl ? 'رسوم التوصيل' : 'Delivery Fee'}</span>
                        <span>{formatCurrency(deliveryFee, isRtl)}</span>
                    </div>
                )}

                <div className="flex justify-between items-center font-black text-lg pt-2 border-t-2 border-slate-200 mt-2">
                    <span>{isRtl ? 'الإجمالي:' : 'Total:'}</span>
                    <span>{formatCurrency(grandTotal, isRtl)}</span>
                </div>
            </div>

            <div className="border-b-2 border-dashed border-gray-300 my-4" />

            <div className="text-center text-xs space-y-1">
                <p>{isRtl ? 'طريقة الدفع:' : 'Payment Method:'} {paymentMethod === 'cash' ? (isRtl ? 'نقدي' : 'Cash') : (isRtl ? 'بطاقة' : 'Card')}</p>
                <p className="mt-4 font-bold">{isRtl ? 'شكراً لزيارتكم!' : 'Thank you for your visit!'}</p>
            </div>

        </div>
    );
};
