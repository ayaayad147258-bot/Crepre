import { Customer } from '../types';
import { formatCurrency } from '../utils';
import toast from 'react-hot-toast';

// Strips non-numeric characters and ensures the number has a country code prefix with a +.
export const formatWhatsAppNumber = (phone: string, defaultPrefix = '20') => {
    const numeric = phone.replace(/\D/g, '');
    // Simple heuristic for Egyptian numbers (starts with 01)
    if (numeric.startsWith('01') && numeric.length === 11) {
        return `+${defaultPrefix}${numeric.substring(1)}`;
    }
    // If it already looks like it has a country code or we don't know, append +
    return numeric.startsWith('+') ? numeric : `+${numeric}`;
}

export const generateWhatsAppLink = (phone: string, message: string) => {
    // wa.me works best without the + sign
    const formattedPhone = formatWhatsAppNumber(phone).replace('+', '');
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
};

export const sendWhatsAppBackgroundMessage = async (
    phone: string,
    message: string,
    settingsOverride?: { apiUrl?: string; apiToken?: string; isSimulated?: boolean }
): Promise<boolean> => {
    const formattedPhone = formatWhatsAppNumber(phone);
    const apiUrl = settingsOverride?.apiUrl || localStorage.getItem('pos_whatsapp_api_url') || '';
    const apiToken = settingsOverride?.apiToken || localStorage.getItem('pos_whatsapp_api_token') || '';
    const isSimulated = settingsOverride?.isSimulated !== undefined
        ? settingsOverride.isSimulated
        : localStorage.getItem('pos_whatsapp_simulate') !== 'false';

    console.log('📱 WhatsApp Config:', { apiUrl: apiUrl ? '✅ Set' : '❌ Empty', apiToken: apiToken ? '✅ Set' : '❌ Empty', isSimulated, phone: formattedPhone });

    if (isSimulated || (!apiUrl || !apiToken)) {
        console.log(`✅ [Simulated WhatsApp] Message to ${formattedPhone}:\n${message}`);
        toast.success(`[محاكاة] تم تمثيل إرسال الرسالة لـ ${formattedPhone}`, { icon: '🧪' });
        return true;
    }

    try {
        const isUltraMsg = apiUrl.toLowerCase().includes('ultramsg');

        if (isUltraMsg) {
            let ultraUrl = apiUrl.replace(/\/+$/, '');
            if (!ultraUrl.endsWith('/messages/chat')) {
                if (ultraUrl.match(/\/instance\d+$/i) || !ultraUrl.includes('/messages/')) {
                    ultraUrl += '/messages/chat';
                }
            }

            const formData = new URLSearchParams();
            formData.append('token', apiToken);
            formData.append('to', formattedPhone);
            formData.append('body', message);

            const response = await fetch(ultraUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            });

            if (response.ok) {
                let data: any = {};
                try { data = await response.json(); } catch { /* ignore */ }
                const isFailed = data.error || data.sent === 'false' || data.sent === false;

                if (isFailed) {
                    const errorMsg = data.error || data.message || JSON.stringify(data);
                    toast.error(`⚠️ خطأ من UltraMsg: ${errorMsg}`);
                    return false;
                }

                toast.success(`✅ تم إرسال رسالة واتساب للعميل ${formattedPhone}`);
                return true;
            } else {
                toast.error(`❌ خطأ HTTP ${response.status} من UltraMsg`);
                return false;
            }
        } else {
            const queryParams = new URLSearchParams({ phone: formattedPhone, text: message, apikey: apiToken });
            const separator = apiUrl.includes('?') ? '&' : '?';
            await fetch(`${apiUrl}${separator}${queryParams.toString()}`, { method: 'GET', mode: 'no-cors' });
            toast.success(`✅ تم إرسال رسالة واتساب لـ ${formattedPhone}`);
            return true;
        }
    } catch (error: any) {
        toast.error(`❌ فشل إرسال الواتساب: ${error.message || 'خطأ غير معروف'}`);
        return false;
    }
};

export const testWhatsAppConnection = async (testPhone: string, settings?: { apiUrl: string; apiToken: string }): Promise<boolean> => {
    const apiUrl = settings?.apiUrl || localStorage.getItem('pos_whatsapp_api_url') || '';
    const apiToken = settings?.apiToken || localStorage.getItem('pos_whatsapp_api_token') || '';

    if (!apiUrl || !apiToken) {
        toast.error('⚠️ يرجى إدخال رابط API والتوكن أولاً');
        return false;
    }

    toast('جاري إرسال رسالة تجريبية...', { icon: '⏳' });
    return sendWhatsAppBackgroundMessage(testPhone, '✅ رسالة تجريبية من نظام المطعم - التوصيل يعمل بنجاح!', {
        apiUrl,
        apiToken,
        isSimulated: false
    });
};

export const getInvoiceMessage = (customer: Customer, orderDetails: any, isRtl: boolean) => {
    const greeting = isRtl ? `مرحباً ${customer.name}،` : `Hello ${customer.name},`;
    const thanks = isRtl ? `شكراً لطلبك من مطعمنا!` : `Thank you for your order!`;
    const totalLabel = isRtl ? `الإجمالي:` : `Total:`;

    return `${greeting}\n${thanks}\n\n${totalLabel} ${formatCurrency(orderDetails.total_amount, isRtl)}\n\n${isRtl ? 'نتمنى لك وجبة شهية 🍔' : 'Enjoy your meal! 🍔'}`;
};

export const getBirthdayMessage = (customer: Customer, isRtl: boolean) => {
    const greeting = isRtl ? `كل عام وأنت بخير يا ${customer.name}! 🎉` : `Happy Birthday ${customer.name}! 🎉`;
    const offer = isRtl ? `نتمنى لك يوماً سعيداً وندعوك للاحتفال معنا اليوم بخصم خاص لك بمناسبة عيد ميلادك! 🎂` : `We wish you a fantastic day. Come celebrate with us and enjoy a special birthday discount! 🎂`;

    return `${greeting}\n${offer}`;
};
