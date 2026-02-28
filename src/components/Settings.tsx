import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Globe, CreditCard, Bell, Shield, Database, Save, Plus, Trash2, User, Key, Check, Bot, Upload, Users, Share2, Copy, MessageCircle } from 'lucide-react';
import { cn } from '../utils';
import toast from 'react-hot-toast';
import { db } from '../lib/firebase';
import { addCategory, addProduct, saveStoreSettings, listenToRestaurantUsers, addRestaurantUser, updateRestaurantUser, deleteRestaurantUser } from '../services/db';
import { parseMenuFile } from '../utils/ai';
import { testWhatsAppConnection } from '../utils/whatsapp';
import { useRestaurantId, useRestaurantSettings } from '../context/RestaurantContext';

interface SettingsProps {
  isRtl: boolean;
}

export const Settings: React.FC<SettingsProps> = ({ isRtl }) => {
  const restaurantId = useRestaurantId();
  const storeSettings = useRestaurantSettings();
  const [activeTab, setActiveTab] = useState('general');

  // Local state initialized from context settings
  const [restaurantName, setRestaurantName] = useState(storeSettings.name || 'Dineify');
  const [restaurantLogo, setRestaurantLogo] = useState(storeSettings.logo || '');
  const [currency, setCurrency] = useState(storeSettings.currency || 'EGP');
  const [branchName, setBranchName] = useState(storeSettings.branch || 'الفرع الرئيسي');
  const [taxRate, setTaxRate] = useState(storeSettings.tax_rate !== undefined ? Number(storeSettings.tax_rate) : 15);
  const [paymentMethod, setPaymentMethod] = useState(storeSettings.payment_method || 'cash');

  // Notifications
  const [notifyOrder, setNotifyOrder] = useState(storeSettings.notify_order !== false);
  const [notifyStock, setNotifyStock] = useState(storeSettings.notify_stock !== false);

  // AI & WhatsApp
  const [geminiApiKey, setGeminiApiKey] = useState(storeSettings.gemini_api_key || '');
  const [waApiUrl, setWaApiUrl] = useState(storeSettings.whatsapp_api_url || '');
  const [waApiToken, setWaApiToken] = useState(storeSettings.whatsapp_api_token || '');
  const [waSimulate, setWaSimulate] = useState(storeSettings.whatsapp_simulate !== false);
  const [waTestPhone, setWaTestPhone] = useState('');
  const [waTestSending, setWaTestSending] = useState(false);
  const [waMsgOnlineConfirm, setWaMsgOnlineConfirm] = useState(storeSettings.wa_msg_online || 'مرحباً {name}،\nتم تأكيد طلبك بنجاح وهو الآن قيد التجهيز في المطبخ! 👨‍🍳\nرقم الطلب: {order_id}');
  const [waMsgDelivery, setWaMsgDelivery] = useState(storeSettings.wa_msg_delivery || 'مرحباً {name}،\nشكراً لطلبك من مطعمنا!\nالإجمالي: {total}\nنتمنى لك وجبة شهية 🍔');
  const [waMsgDispatch, setWaMsgDispatch] = useState(storeSettings.wa_msg_dispatch || 'مرحباً {name}،\nتم تجهيز طلبك وخرج مع الدليفري 🚚\nاسم الطيار: {driver}\nشكراً لاختيارك لنا! ❤️');

  const [isSaving, setIsSaving] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Sync state when context settings change (e.g. after first load)
  useEffect(() => {
    if (storeSettings && Object.keys(storeSettings).length > 0) {
      setRestaurantName(storeSettings.name || 'Dineify');
      setRestaurantLogo(storeSettings.logo || '');
      setCurrency(storeSettings.currency || 'EGP');
      setBranchName(storeSettings.branch || 'الفرع الرئيسي');
      setTaxRate(storeSettings.tax_rate !== undefined ? Number(storeSettings.tax_rate) : 15);
      setPaymentMethod(storeSettings.payment_method || 'cash');
      setNotifyOrder(storeSettings.notify_order !== false);
      setNotifyStock(storeSettings.notify_stock !== false);
      setGeminiApiKey(storeSettings.gemini_api_key || '');
      setWaApiUrl(storeSettings.whatsapp_api_url || '');
      setWaApiToken(storeSettings.whatsapp_api_token || '');
      setWaSimulate(storeSettings.whatsapp_simulate !== false);
      setWaMsgOnlineConfirm(storeSettings.wa_msg_online || 'مرحباً {name}،\nتم تأكيد طلبك بنجاح وهو الآن قيد التجهيز في المطبخ! 👨‍🍳\nرقم الطلب: {order_id}');
      setWaMsgDelivery(storeSettings.wa_msg_delivery || 'مرحباً {name}،\nشكراً لطلبك من مطعمنا!\nالإجمالي: {total}\nنتمنى لك وجبة شهية 🍔');
      setWaMsgDispatch(storeSettings.wa_msg_dispatch || 'مرحباً {name}،\nتم تجهيز طلبك وخرج مع الدليفري 🚚\nاسم الطيار: {driver}\nشكراً لاختيارك لنا! ❤️');
    }
  }, [storeSettings]);

  // User Management State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'cashier', permissions: [] as string[] });
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'users') {
      const unsub = listenToRestaurantUsers(restaurantId, (users) => {
        setUsersList(users);
        setUsersLoading(false);
      });
      setUsersLoading(true);
      return () => unsub();
    }
  }, [activeTab, restaurantId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveStoreSettings(restaurantId, {
        name: restaurantName,
        logo: restaurantLogo,
        branch: branchName,
        currency,
        tax_rate: taxRate,
        payment_method: paymentMethod,
        notify_order: notifyOrder,
        notify_stock: notifyStock,
        gemini_api_key: geminiApiKey,
        whatsapp_api_url: waApiUrl,
        whatsapp_api_token: waApiToken,
        whatsapp_simulate: waSimulate,
        wa_msg_online: waMsgOnlineConfirm,
        wa_msg_delivery: waMsgDelivery,
        wa_msg_dispatch: waMsgDispatch,
      });

      // Update page title
      document.title = restaurantName || 'Smart Food';
      toast.success(isRtl ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully');
    } catch (err) {
      console.error(err);
      toast.error(isRtl ? 'فشل في حفظ الإعدادات' : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const availablePermissions = [
    { id: 'pos', ar: 'نقطة البيع', en: 'POS' },
    { id: 'online_orders', ar: 'طلبات الأونلاين', en: 'Online Orders' },
    { id: 'kds', ar: 'المطبخ', en: 'KDS' },
    { id: 'dashboard', ar: 'لوحة التحكم', en: 'Dashboard' },
    { id: 'inventory', ar: 'المخزون', en: 'Inventory' },
    { id: 'customers', ar: 'العملاء', en: 'Customers' },
    { id: 'drivers', ar: 'الطيارين', en: 'Drivers' },
    { id: 'expenses', ar: 'المصروفات', en: 'Expenses' },
    { id: 'reports', ar: 'التقارير', en: 'Reports' },
    { id: 'settings', ar: 'الإعدادات', en: 'Settings' }
  ];

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;
    try {
      await addRestaurantUser(restaurantId, newUser);
      setNewUser({ username: '', password: '', role: 'cashier', permissions: [] });
      toast.success(isRtl ? 'تم إضافة الموظف بنجاح' : 'Staff added successfully');
    } catch (err) {
      console.error(err);
      toast.error(isRtl ? 'فشل في إضافة الموظف' : 'Failed to add staff');
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (!confirm(isRtl ? 'هل أنت متأكد من حذف هذا الموظف؟' : 'Are you sure you want to delete this staff member?')) return;
    try {
      await deleteRestaurantUser(restaurantId, id);
      toast.success(isRtl ? 'تم الحذف بنجاح' : 'Staff deleted successfully');
    } catch (err) {
      console.error(err);
      toast.error(isRtl ? 'حدث خطأ أثناء الحذف' : 'Failed to delete staff');
    }
  };

  const handleUpdateRole = async (id: string, newRole: string) => {
    try {
      await updateRestaurantUser(restaurantId, id, { role: newRole });
      toast.success(isRtl ? 'تم التحديث بنجاح' : 'Updated successfully');
    } catch (err) {
      console.error(err);
      toast.error(isRtl ? 'حدث خطأ في التحديث' : 'Failed to update');
    }
  };

  const handleUpdatePermissions = async (id: string, currentPermissions: string[], permissionToToggle: string) => {
    try {
      const permissions = currentPermissions || [];
      const newPermissions = permissions.includes(permissionToToggle)
        ? permissions.filter(p => p !== permissionToToggle)
        : [...permissions, permissionToToggle];

      await updateRestaurantUser(restaurantId, id, { permissions: newPermissions });
    } catch (err) {
      console.error(err);
      toast.error(isRtl ? 'حدث خطأ في التحديث' : 'Failed to update user permissions');
    }
  };

  return (
    <div className="p-8 bg-slate-50 h-full overflow-y-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <SettingsIcon size={32} className="text-brand-600" />
          {isRtl ? 'الإعدادات العامة' : 'General Settings'}
        </h1>
        <p className="text-slate-500 mt-2">
          {isRtl ? 'تخصيص النظام وتغيير العملة وإعدادات الضرائب' : 'Customize system, change currency, and tax settings'}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-2">
          {[
            { id: 'general', icon: Globe, label: isRtl ? 'الإعدادات العامة' : 'General' },
            { id: 'payment', icon: CreditCard, label: isRtl ? 'الدفع والعملة' : 'Payment & Currency' },
            { id: 'notifications', icon: Bell, label: isRtl ? 'التنبيهات' : 'Notifications' },
            { id: 'users', icon: Users, label: isRtl ? 'الموظفين والصلاحيات' : 'Staff & Permissions' },
            { id: 'online_menu', icon: Share2, label: isRtl ? 'مشاركة المنيو' : 'Share Menu' },
            { id: 'whatsapp', icon: MessageCircle, label: isRtl ? 'ربط الواتساب' : 'WhatsApp Link' },
            { id: 'ai', icon: Bot, label: isRtl ? 'الذكاء الاصطناعي' : 'AI Features' },
            { id: 'firebase', icon: Database, label: isRtl ? 'ربط Firebase' : 'Firebase Integration' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
                activeTab === item.id ? "bg-brand-600 text-white shadow-lg" : "bg-white text-slate-600 hover:bg-slate-100"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Main Settings Content */}
        <div className="lg:col-span-2 space-y-6">

          {activeTab === 'general' && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-50 pb-4">
                {isRtl ? 'إعدادات المتجر' : 'Store Settings'}
              </h3>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">{isRtl ? 'اسم المطعم' : 'Restaurant Name'}</label>
                    <input
                      type="text"
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">{isRtl ? 'شعار المطعم (لوجو)' : 'Restaurant Logo'}</label>
                    <div className="flex gap-4 items-center">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="logo-upload"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 200 * 1024) { // Limit to 200KB for localStorage compatibility
                              alert(isRtl ? 'حجم الصورة كبير جداً. يجب أن يكون أقل من 200 كيلوبايت.' : 'File too large. Please use an image under 200KB.');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setRestaurantLogo(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label
                        htmlFor="logo-upload"
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 text-center font-bold text-slate-600 transition-colors"
                      >
                        {isRtl ? 'اختر صورة من الجهاز' : 'Choose Logo'}
                      </label>
                      {restaurantLogo && (
                        <div className="relative w-12 h-12 bg-slate-100 rounded-lg p-1 border border-slate-200 flex-shrink-0">
                          <img src={restaurantLogo} alt="Logo preview" className="w-full h-full object-contain rounded" />
                          <button
                            onClick={() => setRestaurantLogo('')}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                            title={isRtl ? 'إزالة' : 'Remove'}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">{isRtl ? 'اسم الفرع' : 'Branch Name'}</label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">{isRtl ? 'نسبة الضريبة (%)' : 'Tax Rate (%)'}</label>
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payment' && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-50 pb-4">
                {isRtl ? 'الدفع والعملة' : 'Payment & Currency'}
              </h3>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">{isRtl ? 'العملة الافتراضية' : 'Default Currency'}</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="EGP">{isRtl ? 'جنيه مصري (EGP)' : 'Egyptian Pound (EGP)'}</option>
                      <option value="USD">{isRtl ? 'دولار أمريكي (USD)' : 'US Dollar (USD)'}</option>
                      <option value="SAR">{isRtl ? 'ريال سعودي (SAR)' : 'Saudi Riyal (SAR)'}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">{isRtl ? 'طريقة الدفع الافتراضية' : 'Default Payment Method'}</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="cash">{isRtl ? 'نقدي (كاش)' : 'Cash'}</option>
                      <option value="card">{isRtl ? 'بطاقة ائتمان' : 'Credit Card'}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-50 pb-4">
                {isRtl ? 'إعدادات التنبيهات' : 'Notifications Settings'}
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <Bell className="text-slate-400" size={20} />
                    <div>
                      <h4 className="font-bold text-slate-700">{isRtl ? 'صوت طلب جديد' : 'New Order Sound'}</h4>
                      <p className="text-xs text-slate-500">{isRtl ? 'تشغيل صوت عند وصول طلب جديد للمطبخ' : 'Play sound when a new order arrives'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotifyOrder(!notifyOrder)}
                    className={cn("w-12 h-6 rounded-full relative transition-colors", notifyOrder ? "bg-brand-600" : "bg-slate-300")}
                  >
                    <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform", notifyOrder ? (isRtl ? "left-1" : "right-1") : (isRtl ? "right-1" : "left-1"))} />
                  </button>
                </div>

                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <Bell className="text-slate-400" size={20} />
                    <div>
                      <h4 className="font-bold text-slate-700">{isRtl ? 'تنبيه نقص المخزون' : 'Low Stock Alert'}</h4>
                      <p className="text-xs text-slate-500">{isRtl ? 'تنبيه عند اقتراب نفاذ مكون من المخزون' : 'Alert when an ingredient is running low'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotifyStock(!notifyStock)}
                    className={cn("w-12 h-6 rounded-full relative transition-colors", notifyStock ? "bg-brand-600" : "bg-slate-300")}
                  >
                    <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform", notifyStock ? (isRtl ? "left-1" : "right-1") : (isRtl ? "right-1" : "left-1"))} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-50 pb-4">
                {isRtl ? 'الموظفين والصلاحيات' : 'Staff & Permissions'}
              </h3>

              <form onSubmit={handleAddUser} className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-4">{isRtl ? 'إضافة موظف جديد' : 'Add New Staff'}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <input
                      type="text"
                      placeholder={isRtl ? 'اسم المستخدم' : 'Username'}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      placeholder={isRtl ? 'كلمة المرور' : 'Password'}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder={isRtl ? 'المسمى الوظيفي (مثال: كاشير، محاسب)' : 'Role Name (e.g. Cashier)'}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <h5 className="font-bold text-sm text-slate-600 mb-3">{isRtl ? 'الصلاحيات (الصفحات المسموح برؤيتها)' : 'Permissions (Allowed Pages)'}</h5>
                  <div className="flex flex-wrap gap-3">
                    {availablePermissions.map(perm => {
                      const isChecked = newUser.permissions.includes(perm.id);
                      return (
                        <label key={perm.id} className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm font-bold",
                          isChecked ? "bg-brand-50 border-brand-200 text-brand-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={isChecked}
                            onChange={() => {
                              const newPerms = isChecked
                                ? newUser.permissions.filter(p => p !== perm.id)
                                : [...newUser.permissions, perm.id];
                              setNewUser({ ...newUser, permissions: newPerms });
                            }}
                          />
                          <div className={cn("w-4 h-4 rounded flex items-center justify-center border", isChecked ? "bg-brand-600 border-brand-600 text-white" : "border-slate-300")}>
                            {isChecked && <Check size={12} />}
                          </div>
                          {isRtl ? perm.ar : perm.en}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button type="submit" className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors flex items-center gap-2">
                  <Plus size={20} />
                  {isRtl ? 'إضافة الموظف' : 'Add Staff'}
                </button>
              </form>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-700 mb-4">{isRtl ? 'الموظفين الحاليين' : 'Current Staff'}</h4>
                {usersLoading ? (
                  <div className="text-center text-slate-400 py-4">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>
                ) : (
                  usersList.map(user => (
                    <div key={user.id} className="p-4 border border-slate-200 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-4 items-center">
                          <div className="w-12 h-12 bg-white text-brand-600 rounded-full flex items-center justify-center shadow-sm">
                            <User size={24} />
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-800 text-lg">{user.username}</h5>
                            <input
                              type="text"
                              value={user.role}
                              onChange={(e) => {
                                // Local state update trick wouldn't work easily here without tracking state, 
                                // so updating onBlur is better. Let's handle it via key press and blur instead of on change.
                              }}
                              className={cn(
                                "text-xs font-bold px-2 py-1 mt-1 rounded border-none outline-none focus:ring-1 focus:ring-brand-400 w-32",
                                user.role === 'admin' || user.role === 'مدير' || user.role === 'مدير أساسي'
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                              )}
                              placeholder={isRtl ? "المسمى الوظيفي" : "Role"}
                              defaultValue={user.role}
                              onBlur={(e) => {
                                if (e.target.value !== user.role) handleUpdateRole(user.id, e.target.value);
                              }}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="text-red-500 hover:bg-red-100 p-2.5 bg-white rounded-xl shadow-sm transition-colors"
                          title={isRtl ? 'حذف الموظف' : 'Delete staff'}
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>

                      <div className="pt-4 border-t border-slate-200">
                        <h6 className="text-xs font-bold text-slate-500 mb-2">{isRtl ? 'تعديل صلاحيات الوصول:' : 'Edit Access Permissions:'}</h6>
                        <div className="flex flex-wrap gap-2">
                          {availablePermissions.map(perm => {
                            const isChecked = (user.permissions || []).includes(perm.id);
                            return (
                              <button
                                key={perm.id}
                                onClick={() => handleUpdatePermissions(user.id, user.permissions, perm.id)}
                                className={cn(
                                  "px-3 py-1.5 rounded-md text-xs font-bold transition-colors border",
                                  isChecked
                                    ? "bg-brand-100 text-brand-700 border-brand-200 hover:bg-brand-200"
                                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                                )}
                              >
                                {isRtl ? perm.ar : perm.en}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {usersList.length === 0 && !usersLoading && (
                  <div className="text-center text-slate-400 py-4">
                    {isRtl ? 'لا يوجد موظفين' : 'No staff found'}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'online_menu' && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-50 pb-4">
                {isRtl ? 'مشاركة المنيو الإلكتروني' : 'Share Online Menu'}
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                {isRtl
                  ? 'قم بنسخ هذا الرابط ومشاركته مع عملائك (على واتساب أو السوشيال ميديا) ليمكنهم تصفح المنيو وطلب الأوردارات مباشرة.'
                  : 'Copy this link and share it with your customers (on WhatsApp or Social Media) so they can view the menu and order directly.'}
              </p>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <label className="text-sm font-bold text-slate-600 block mb-2">
                  {isRtl ? 'رابط المنيو الخاص بك' : 'Your Menu Link'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/menu`}
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-mono text-sm focus:outline-none"
                    dir="ltr"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/menu`);
                      toast.success(isRtl ? 'تم نسخ الرابط بنجاح!' : 'Link copied successfully!');
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-sm"
                  >
                    <Copy size={20} />
                    {isRtl ? 'نسخ الرابط' : 'Copy Link'}
                  </button>
                </div>
              </div>

              <div className="mt-8 flex justify-center">
                <div className="p-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-center max-w-sm w-full">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/menu`)}`}
                    alt="Menu QR Code"
                    className="mx-auto mb-4 w-40 h-40 rounded-xl"
                  />
                  <p className="text-sm font-bold text-brand-600">
                    {isRtl ? 'رمز الاستجابة السريعة (QR Code)' : 'QR Code'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isRtl ? 'يمكنك طباعته ووضعه على الطاولات' : 'You can print this and place it on tables'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-50 pb-4 flex items-center gap-3">
                <MessageCircle className="text-green-600" size={28} />
                {isRtl ? 'ربط الواتساب (UltraMsg)' : 'WhatsApp Link (UltraMsg)'}
              </h3>

              {/* Step-by-step guide */}
              <div className="p-5 bg-green-50 border border-green-200 rounded-2xl mb-6">
                <p className="text-sm font-bold text-green-800 mb-3">
                  {isRtl ? '📋 خطوات الربط (مرة واحدة فقط):' : '📋 Setup Steps (one-time only):'}
                </p>
                <ol className="text-xs text-green-700 leading-relaxed space-y-2 list-decimal pr-5 pl-5" dir={isRtl ? 'rtl' : 'ltr'}>
                  <li>{isRtl ? 'ادخل على موقع UltraMsg.com وسجل حساب مجاني.' : 'Go to UltraMsg.com and create a free account.'}</li>
                  <li>{isRtl ? 'أنشئ "Instance" جديدة ، ثم امسح كود الـ QR من تطبيق واتساب على جوالك (مثل واتساب ويب).' : 'Create a new "Instance", then scan the QR code from WhatsApp on your phone (like WhatsApp Web).'}</li>
                  <li>{isRtl ? 'انسخ رابط الـ API (يبدو هكذا: https://api.ultramsg.com/instanceXXXXX/messages/chat).' : 'Copy the API URL (looks like: https://api.ultramsg.com/instanceXXXXX/messages/chat).'}</li>
                  <li>{isRtl ? 'انسخ الـ Token من لوحة التحكم.' : 'Copy the Token from the dashboard.'}</li>
                  <li>{isRtl ? 'الصق الرابط والتوكن في الحقول بالأسفل واضغط "حفظ التغييرات".' : 'Paste the URL and Token below, then click "Save Changes".'}</li>
                </ol>
                <a href="https://ultramsg.com" target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-xs font-bold text-green-800 bg-green-100 border border-green-300 px-4 py-2 rounded-xl hover:bg-green-200 transition-colors">
                  {isRtl ? '🔗 افتح موقع UltraMsg' : '🔗 Open UltraMsg Website'}
                </a>
              </div>

              <div className="space-y-6">
                {/* Simulation Toggle */}
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="text-brand-600" size={24} />
                    <div>
                      <h4 className="font-bold text-slate-700">{isRtl ? 'وضع المحاكاة (للتجربة بدون ربط)' : 'Simulation Mode (Test without linking)'}</h4>
                      <p className="text-xs text-slate-500">{isRtl ? 'عند التفعيل: رسائل التأكيد تظهر كإشعار فقط ولا ترسل فعلياً للعميل.' : 'When on: confirmations show as notification only, not sent to customer.'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setWaSimulate(!waSimulate)}
                    className={cn("w-12 h-6 rounded-full relative transition-colors", waSimulate ? "bg-brand-600" : "bg-slate-300")}
                  >
                    <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform", waSimulate ? (isRtl ? "left-1" : "right-1") : (isRtl ? "right-1" : "left-1"))} />
                  </button>
                </div>

                {/* API Fields */}
                {!waSimulate && (
                  <div className="space-y-4 p-6 border border-green-100 rounded-2xl bg-green-50/30 shadow-sm">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600">{isRtl ? 'رابط API (من لوحة تحكم UltraMsg)' : 'API URL (from UltraMsg dashboard)'}</label>
                      <input
                        type="url"
                        value={waApiUrl}
                        onChange={(e) => setWaApiUrl(e.target.value)}
                        placeholder="https://api.ultramsg.com/instanceXXXXX/messages/chat"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 font-mono text-sm"
                        dir="ltr"
                      />
                      <p className="text-[11px] text-slate-400">{isRtl ? 'مثال: https://api.ultramsg.com/instance12345/messages/chat' : 'Example: https://api.ultramsg.com/instance12345/messages/chat'}</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600">{isRtl ? 'التوكن (Token) من UltraMsg' : 'Token from UltraMsg'}</label>
                      <input
                        type="password"
                        value={waApiToken}
                        onChange={(e) => setWaApiToken(e.target.value)}
                        placeholder="xxxxxxxxxxxxxxxxxxxx"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 font-mono text-sm"
                        dir="ltr"
                      />
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mt-2">
                      <p className="text-xs text-amber-700 font-bold">
                        {isRtl
                          ? '⚠️ تأكد أن رقم الواتساب مربوط (QR Code ممسوح) في لوحة تحكم UltraMsg قبل الحفظ.'
                          : '⚠️ Make sure your WhatsApp number is linked (QR Code scanned) in UltraMsg dashboard before saving.'}
                      </p>
                    </div>

                    {/* Test Connection */}
                    <div className="pt-4 mt-4 border-t border-green-200">
                      <h4 className="font-bold text-slate-700 mb-3">{isRtl ? '🧪 إرسال رسالة تجريبية' : '🧪 Send Test Message'}</h4>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={waTestPhone}
                          onChange={(e) => setWaTestPhone(e.target.value)}
                          placeholder={isRtl ? 'أدخل رقم واتساب للتجربة (مثل 01012345678)' : 'Enter WhatsApp number to test'}
                          className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 font-mono text-sm"
                          dir="ltr"
                        />
                        <button
                          onClick={async () => {
                            if (!waTestPhone) {
                              toast.error(isRtl ? 'أدخل رقم للتجربة أولاً' : 'Enter a phone number first');
                              return;
                            }
                            setWaTestSending(true);
                            await testWhatsAppConnection(waTestPhone, {
                              apiUrl: waApiUrl,
                              apiToken: waApiToken
                            });
                            setWaTestSending(false);
                          }}
                          disabled={waTestSending || !waTestPhone}
                          className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                        >
                          {waTestSending ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <MessageCircle size={18} />
                          )}
                          {isRtl ? 'إرسال تجربة' : 'Send Test'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Templates */}
              <div className="mt-8 bg-white p-6 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-lg text-slate-800 mb-2">{isRtl ? '✉️ قوالب الرسائل' : '✉️ Message Templates'}</h4>
                <p className="text-xs text-slate-500 mb-4">
                  {isRtl
                    ? 'يمكنك تعديل نص الرسائل المرسلة للعملاء. استخدم المتغيرات التالية وسيتم استبدالها تلقائياً:'
                    : 'Edit the messages sent to customers. Use these variables and they will be replaced automatically:'}
                </p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {['{name}', '{phone}', '{order_id}', '{total}', '{driver}'].map(v => (
                    <span key={v} className="bg-brand-50 text-brand-700 px-3 py-1 rounded-lg text-xs font-bold font-mono border border-brand-100">
                      {v} = {isRtl
                        ? (v === '{name}' ? 'اسم العميل' : v === '{phone}' ? 'رقم الهاتف' : v === '{order_id}' ? 'رقم الطلب' : v === '{total}' ? 'الإجمالي' : 'اسم الطيار')
                        : (v === '{name}' ? 'Customer Name' : v === '{phone}' ? 'Phone' : v === '{order_id}' ? 'Order ID' : v === '{total}' ? 'Total' : 'Driver Name')}
                    </span>
                  ))}
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">
                      {isRtl ? '📦 رسالة تأكيد الطلب الأونلاين' : '📦 Online Order Confirmation Message'}
                    </label>
                    <textarea
                      value={waMsgOnlineConfirm}
                      onChange={(e) => setWaMsgOnlineConfirm(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-sm leading-relaxed resize-none"
                      dir={isRtl ? 'rtl' : 'ltr'}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">
                      {isRtl ? '🚚 رسالة تأكيد طلب الدليفري' : '🚚 Delivery Confirmation Message'}
                    </label>
                    <textarea
                      value={waMsgDelivery}
                      onChange={(e) => setWaMsgDelivery(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-sm leading-relaxed resize-none"
                      dir={isRtl ? 'rtl' : 'ltr'}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">
                      {isRtl ? '🚚 رسالة خروج الطلب مع الطيار' : '🚚 Order Dispatched with Driver'}
                    </label>
                    <textarea
                      value={waMsgDispatch}
                      onChange={(e) => setWaMsgDispatch(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-sm leading-relaxed resize-none"
                      dir={isRtl ? 'rtl' : 'ltr'}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-50 pb-4">
                {isRtl ? 'الذكاء الاصطناعي (Gemini)' : 'Artificial Intelligence (Gemini)'}
              </h3>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-600">{isRtl ? 'مفتاح واجهة برمجة التطبيقات (API Key)' : 'API Key'}</label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                  <p className="text-xs text-slate-500">{isRtl ? 'احصل على مفتاح Gemini من Google AI Studio لاستخدام ميزات الذكاء الاصطناعي.' : 'Get a Gemini API key from Google AI Studio to use AI features.'}</p>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <h4 className="font-bold text-lg text-slate-700 mb-4">{isRtl ? 'رفع المنيو تلقائياً' : 'Auto-Upload Menu'}</h4>
                  <p className="text-sm text-slate-500 mb-4">
                    {isRtl
                      ? 'قم برفع صورة المنيو أو ملف نصي، وسيقوم الذكاء الاصطناعي باستخراج الأقسام والمنتجات وتسجيلها تلقائياً.'
                      : 'Upload a menu image or text file, and the AI will extract categories and products automatically.'}
                  </p>

                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      id="menu-upload"
                      className="hidden"
                      accept="image/*, application/pdf, text/plain"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!geminiApiKey) {
                          alert(isRtl ? 'يرجى إدخال مفتاح API أولاً' : 'Please enter API Key first');
                          return;
                        }

                        setIsParsing(true);
                        try {
                          // parseMenuFile returns ParsedCategory[] - array of categories each with nested products
                          const parsedData = await parseMenuFile(geminiApiKey, file);
                          let categoryCount = 0;
                          let productCount = 0;

                          for (const cat of parsedData) {
                            const catRef = await addCategory(restaurantId, { name: cat.name, name_ar: cat.name_ar || cat.name, sort_order: 0, active: true });
                            categoryCount++;

                            for (const prod of cat.products) {
                              const productData: any = {
                                category_id: catRef.id,
                                name: prod.name,
                                name_ar: prod.name_ar || prod.name,
                                price: prod.price || 0,
                                cost: 0,
                                active: true,
                                stock_tracking: false
                              };

                              if (prod.image_query) {
                                try {
                                  const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&generator=search&gsrsearch=${encodeURIComponent(prod.image_query)}&gsrlimit=1&pithumbsize=400&origin=*`);
                                  const wikiData = await wikiRes.json();
                                  if (wikiData.query && wikiData.query.pages) {
                                    const pages = wikiData.query.pages;
                                    const firstPageId = Object.keys(pages)[0];
                                    if (pages[firstPageId].thumbnail?.source) {
                                      productData.image = pages[firstPageId].thumbnail.source;
                                    } else {
                                      productData.image = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop';
                                    }
                                  } else {
                                    productData.image = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop';
                                  }
                                } catch (e) {
                                  productData.image = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop';
                                }
                              }

                              if (prod.sizes) productData.sizes = prod.sizes;
                              await addProduct(restaurantId, productData);
                              productCount++;
                            }
                          }

                          alert(isRtl ? `تم استخراج ${categoryCount} أقسام و ${productCount} منتجات بنجاح` : `Successfully extracted ${categoryCount} categories and ${productCount} products`);
                        } catch (err) {
                          console.error(err);
                          alert(isRtl ? 'فشل استخراج المنيو. يرجى المحاولة مرة أخرى بمفتاح صحيح وصورة واضحة.' : 'Failed to parse menu. Please try again with a valid key and clear image.');
                        } finally {
                          setIsParsing(false);
                          e.target.value = '';
                        }

                      }}
                    />
                    <label
                      htmlFor="menu-upload"
                      className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all cursor-pointer",
                        isParsing
                          ? "bg-slate-100 text-slate-400 pointer-events-none"
                          : "bg-brand-50 text-brand-600 hover:bg-brand-100 border border-brand-200"
                      )}
                    >
                      {isParsing ? (
                        <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload size={20} />
                      )}
                      {isParsing
                        ? (isRtl ? 'جاري الاستخراج...' : 'Parsing...')
                        : (isRtl ? 'اختر ملف المنيو' : 'Choose Menu File')}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'firebase' && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-50 pb-4">
                {isRtl ? 'ربط Firebase' : 'Firebase Integration'}
              </h3>
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-4 items-start mb-6">
                <Database className="text-emerald-600 mt-1" size={24} />
                <div>
                  <p className="text-sm text-emerald-800 font-bold">{isRtl ? 'حالة الاتصال: متصل' : 'Connection Status: Connected'}</p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {isRtl ? 'تم ربط النظام بنجاح مع Firebase (crepree)' : 'System successfully linked with Firebase (crepree)'}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <span className="text-sm font-bold text-slate-600">{isRtl ? 'مزامنة البيانات تلقائياً' : 'Auto-sync data'}</span>
                  <div className="w-12 h-6 bg-brand-600 rounded-full relative cursor-pointer">
                    <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform", isRtl ? "left-1" : "right-1")} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Only show Save button outside of Firebase tab since it has its own logic */}
          {activeTab !== 'firebase' && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-8 py-4 bg-brand-600 text-white rounded-[2rem] font-black shadow-xl shadow-brand-500/30 hover:bg-brand-700 hover:-translate-y-1 transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={20} />
                )}
                {isRtl ? 'حفظ التغييرات' : 'Save Changes'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
