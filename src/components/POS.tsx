import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Plus, Minus, Trash2, Banknote, CreditCard, History, User, Truck } from 'lucide-react';
import { Product, Category, OrderItem } from '../types';
import { cn, formatCurrency } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { OrderHistory } from './OrderHistory';
import { Invoice } from './Invoice';
import { generateWhatsAppLink, getInvoiceMessage, sendWhatsAppBackgroundMessage } from '../utils/whatsapp';
import { listenToCategories, listenToProducts, addOrder, addCustomer, listenToCustomers, listenToDrivers, updateDriver } from '../services/db';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface POSProps {
  isRtl: boolean;
}

export const POS: React.FC<POSProps> = ({ isRtl }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | string | null>(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway' | 'delivery'>('dine-in');
  const [tableNumber, setTableNumber] = useState('');

  // Customer details for delivery
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [existingCustomers, setExistingCustomers] = useState<any[]>([]);

  // Delivery Drivers
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [showHistory, setShowHistory] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [printedOrderId, setPrintedOrderId] = useState<number | null>(null);

  // Size Selection Modal
  const [sizeModalProduct, setSizeModalProduct] = useState<Product | null>(null);

  useEffect(() => {
    const unsubCategories = listenToCategories((data) => {
      setCategories(data);
      setActiveCategory(current => {
        if (data.length > 0 && !current) return data[0].id;
        return current;
      });
    });

    const unsubProducts = listenToProducts(setProducts);
    const unsubCustomers = listenToCustomers(setExistingCustomers);
    const unsubDrivers = listenToDrivers((data) => {
      // Only show drivers that are 'available' to grab new orders
      setAvailableDrivers(data.filter(d => d.status === 'available'));
    });

    return () => {
      unsubCategories();
      unsubProducts();
      unsubCustomers();
      unsubDrivers();
    };
  }, []);

  const addToCart = (product: Product, selectedSize?: 'mini' | 'medium' | 'large' | 'roll') => {
    if (product.sizes && !selectedSize) {
      setSizeModalProduct(product);
      return;
    }

    setCart(prev => {
      let price = product.price;
      let nameStr = isRtl ? (product.name_ar || product.name) : product.name;

      if (selectedSize && product.sizes) {
        price = product.sizes[selectedSize] || product.price;
        const sizeLabel = isRtl
          ? (selectedSize === 'mini' ? 'صغير' : selectedSize === 'medium' ? 'وسط' : selectedSize === 'large' ? 'كبير' : 'رول')
          : (selectedSize === 'mini' ? 'Mini' : selectedSize === 'medium' ? 'Medium' : selectedSize === 'large' ? 'Large' : 'Roll');
        nameStr += ` (${sizeLabel})`;
      }

      const existing = prev.find(item => item.product_id === product.id && item.selectedSize === selectedSize);
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id && item.selectedSize === selectedSize
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      const category = categories.find(c => c.id.toString() === product.category_id.toString());
      const categoryName = category ? (isRtl ? category.name_ar : category.name) : undefined;

      return [...prev, {
        product_id: product.id,
        name: nameStr,
        category_name: categoryName,
        quantity: 1,
        price: price,
        selectedSize: selectedSize
      }];
    });

    setSizeModalProduct(null);

    // Open cart on mobile when item added
    if (window.innerWidth < 1024) {
      setIsCartOpen(true);
    }
  };

  const updateQuantity = (productId: string | number, selectedSize: 'mini' | 'medium' | 'large' | 'roll' | undefined, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product_id === productId && item.selectedSize === selectedSize) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const storedTaxRate = localStorage.getItem('pos_tax_rate');
  const taxRate = storedTaxRate !== null ? Number(storedTaxRate) : 15;
  const tax = total * (taxRate / 100);
  const grandTotal = total + tax + (orderType === 'delivery' ? deliveryFee : 0);

  const handleOrderTypeChange = (type: 'dine-in' | 'takeaway' | 'delivery') => {
    setOrderType(type);
    if (type !== 'delivery') {
      setDeliveryFee(0);
    }
  };
  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;

    if ((orderType === 'delivery' || orderType === 'takeaway') && (!customerName || !customerPhone)) {
      alert(isRtl ? 'يرجى إدخال اسم العميل ورقم الهاتف' : 'Please enter customer name and phone');
      return;
    }

    try {
      let customerData: any = null;

      if (orderType === 'delivery' || orderType === 'takeaway') {
        const existing = existingCustomers.find(c => c.phone === customerPhone);
        if (existing) {
          customerData = { id: existing.id, name: existing.name, phone: existing.phone, address: existing.address || customerAddress };
        } else {
          // Create new customer
          const docRef = await addCustomer({
            name: customerName,
            phone: customerPhone,
            address: orderType === 'delivery' ? customerAddress : '',
            whatsapp: customerPhone, // Default WhatsApp to the inserted phone
          });
          customerData = { id: docRef.id, name: customerName, phone: customerPhone, address: orderType === 'delivery' ? customerAddress : '' };
        }
      }

      const payload: any = {
        type: orderType,
        items: cart.map(item => {
          const itemPayload = { ...item };
          if (itemPayload.selectedSize === undefined) {
            delete itemPayload.selectedSize;
          }
          return itemPayload;
        }),
        total_amount: grandTotal,
        payment_method: paymentMethod,
        status: 'pending' // Initial status
      };

      if (orderType === 'dine-in' && tableNumber) {
        payload.table_number = tableNumber;
      }

      if (orderType === 'delivery' || orderType === 'takeaway') {
        payload.customer = customerData;
      }

      if (orderType === 'delivery') {
        payload.delivery_fee = deliveryFee || 0;
        if (selectedDriverId) {
          payload.driver_id = selectedDriverId;
        }
      }

      const orderResult = await addOrder(payload);
      setPrintedOrderId(orderResult.daily_id);

      // Update the selected driver status to busy
      if (orderType === 'delivery' && selectedDriverId) {
        await updateDriver(selectedDriverId, { status: 'busy' });
      }

      // Auto-print the invoice
      setTimeout(() => {
        window.print();

        // If delivery, open WhatsApp automatically
        if (orderType === 'delivery' && customerData) {
          const template = localStorage.getItem('pos_wa_msg_delivery')
            || 'مرحباً {name}،\nشكراً لطلبك من مطعمنا!\nالإجمالي: {total}\nنتمنى لك وجبة شهية 🍔';
          const waMessage = template
            .replace(/{name}/g, customerData.name || '')
            .replace(/{phone}/g, customerData.phone || '')
            .replace(/{order_id}/g, '')
            .replace(/{total}/g, grandTotal.toFixed(2));

          // Send background WhatsApp confirmation instead of opening the app
          sendWhatsAppBackgroundMessage(customerData.whatsapp || customerData.phone, waMessage);
        }
      }, 100);

      // Clear the cart after a short delay so the print dialogue captures it
      setTimeout(() => {
        setCart([]);
        setTableNumber('');
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
        setSelectedDriverId('');
        setDeliveryFee(0);
        setPrintedOrderId(null);
        alert(isRtl ? 'تم إرسال الطلب بنجاح' : 'Order submitted successfully');
      }, 500);
    } catch (err) {
      console.error('Failed to submit order:', err);
      alert(isRtl ? 'حدث خطأ أثناء إرسال الطلب' : 'Error submitting order');
    }
  };

  const handleReorder = async (orderId: string) => {
    try {
      const docRef = doc(db, 'orders', orderId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const orderData = docSnap.data();
        const items = orderData.items || [];

        const newItems: OrderItem[] = items.map((item: any) => ({
          product_id: item.product_id,
          name: item.name,
          category_name: item.category_name,
          quantity: item.quantity,
          price: item.price,
          selectedSize: item.selectedSize
        }));

        setCart(newItems);
        setShowHistory(false);
      }
    } catch (err) {
      console.error('Failed to reorder:', err);
    }
  };

  const filteredProducts = products.filter(p =>
    (activeCategory === null || String(p.category_id) === String(activeCategory)) &&
    (
      (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.name_ar && p.name_ar.includes(searchQuery))
    )
  );

  return (
    <div className="flex h-full w-full overflow-hidden relative">
      {/* Main Menu Area */}
      <div className="flex-1 flex flex-col bg-slate-50 p-4 md:p-6 pb-20 md:pb-6 overflow-hidden w-full lg:w-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 md:mb-8">
          <div className="relative flex-1 w-full md:max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500" size={20} />
            <input
              type="text"
              placeholder={isRtl ? 'البحث عن منتج...' : 'Search products...'}
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 hover:border-brand-300 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-lg text-lg font-medium text-slate-800 placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar items-center">
            <button
              onClick={() => setShowHistory(true)}
              className="px-4 py-2 text-slate-400 hover:text-brand-600 transition-colors bg-white rounded-xl border border-slate-200 shadow-sm shrink-0"
              title={isRtl ? 'السجل' : 'History'}
            >
              <History size={20} />
            </button>
            <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
              {['dine-in', 'takeaway', 'delivery'].map((type) => (
                <button
                  key={type}
                  onClick={() => handleOrderTypeChange(type as any)}
                  className={cn(
                    "px-4 md:px-5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                    orderType === type
                      ? "bg-brand-600 text-white shadow-md"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <span className="font-bold">
                    {isRtl ? (type === 'dine-in' ? 'داخل' : type === 'takeaway' ? 'تيك اوي' : 'دليفري') : type.charAt(0).toUpperCase() + type.slice(1)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Categories */}
        <div className="flex gap-2 mb-6 md:mb-8 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "px-6 py-2.5 rounded-full whitespace-nowrap text-sm font-bold transition-all border",
              activeCategory === null
                ? "bg-brand-600 text-white border-brand-600 shadow-md"
                : "bg-white text-slate-600 border-slate-200 hover:border-brand-300"
            )}
          >
            {isRtl ? 'الكل' : 'All Items'}
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-6 py-2.5 rounded-full whitespace-nowrap text-sm font-bold transition-all border",
                activeCategory === cat.id
                  ? "bg-brand-600 text-white border-brand-600 shadow-md"
                  : "bg-white text-slate-600 border-slate-200 hover:border-brand-300"
              )}
            >
              {isRtl ? cat.name_ar : cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 pb-2 pr-1 md:pr-2 custom-scrollbar content-start">
          <AnimatePresence>
            {filteredProducts.map(product => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white p-3 md:p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col items-center text-center gap-3 relative h-auto"
              >
                {/* Image Section */}
                <div className="w-20 h-20 md:w-28 md:h-28 shrink-0 rounded-xl overflow-hidden bg-slate-50 relative border border-slate-100">
                  <img
                    src={product.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop"}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Details Section */}
                <div className="flex-1 min-w-0 flex flex-col w-full">
                  <h3 className="font-bold text-slate-800 text-sm md:text-base mb-2 line-clamp-2">{isRtl ? product.name_ar : product.name}</h3>
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                    {product.sizes ? (
                      <span className="text-brand-600 font-bold text-[11px] md:text-xs bg-brand-50 px-2 py-1 rounded-lg">
                        {isRtl ? 'اختر المقاس' : 'Select Size'}
                      </span>
                    ) : (
                      <span className="text-slate-600 font-bold text-sm md:text-base bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">{formatCurrency(product.price, isRtl)}</span>
                    )}
                    <div className="bg-brand-50 text-brand-600 w-8 h-8 flex items-center justify-center rounded-xl opacity-0 xl:opacity-100 group-hover:opacity-100 transition-all transform hover:scale-110 hover:bg-brand-100">
                      <Plus size={18} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Cart Panel Overlay for Mobile */}
      {isCartOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      {/* Cart Panel */}
      <div className={cn(
        "bg-white border-l border-slate-200 flex flex-col shadow-2xl z-50",
        "fixed inset-y-0 right-0 w-full max-w-[400px] lg:max-w-none lg:w-[380px] xl:w-[420px] lg:static lg:transform-none transition-transform duration-300 ease-in-out",
        isCartOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
        isRtl && "left-0 right-auto border-l-0 border-r"
      )}>
        <div className="p-4 md:p-8 border-b border-slate-50 flex-shrink-0">
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{isRtl ? 'الطلب الحالي' : 'Current Order'}</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                {isRtl ? 'فرع العاشر من رمضان' : '10th of Ramadan Branch'}
                {tableNumber && ` ${isRtl ? '- طاولة' : '- Table'} ${tableNumber}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCart([])}
                className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
              >
                <Trash2 size={20} />
              </button>
              <button
                onClick={() => setIsCartOpen(false)}
                className="lg:hidden w-10 h-10 flex items-center justify-center bg-brand-50 text-brand-600 rounded-xl"
              >
                <Minus size={20} />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            {orderType === 'dine-in' && (
              <div className="flex-1 flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
                <User size={18} className="text-slate-400" />
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-sm font-bold w-full placeholder:text-slate-300"
                  placeholder={isRtl ? 'رقم الطاولة' : 'Table #'}
                />
              </div>
            )}

            {(orderType === 'delivery' || orderType === 'takeaway') && (
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                    <User size={16} className="text-slate-400" />
                    <input
                      type="text"
                      list="customer-phones"
                      value={customerPhone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomerPhone(val);
                        const existing = existingCustomers.find(c => c.phone === val);
                        if (existing) {
                          setCustomerName(existing.name);
                          if (orderType === 'delivery') {
                            setCustomerAddress(existing.address || '');
                          }
                        }
                      }}
                      className="bg-transparent border-none focus:ring-0 text-sm font-bold w-full placeholder:text-slate-300 text-left"
                      dir="ltr"
                      placeholder={isRtl ? 'رقم الهاتف (للبحث)' : 'Phone Number (Search)'}
                    />
                    <datalist id="customer-phones">
                      {existingCustomers.map(c => <option key={c.id} value={c.phone}>{c.name}</option>)}
                    </datalist>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-sm font-bold w-full placeholder:text-slate-300"
                      placeholder={isRtl ? 'اسم العميل' : 'Customer Name'}
                    />
                  </div>

                  {orderType === 'delivery' && (
                    <>
                      <div className="flex items-center gap-3 pt-1 border-t border-slate-200 mt-2 pb-2">
                        <input
                          type="text"
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          className="bg-transparent border-none focus:ring-0 text-sm font-bold w-full placeholder:text-slate-300"
                          placeholder={isRtl ? 'العنوان وتفاصيل التوصيل' : 'Address & Delivery Details'}
                        />
                      </div>
                      <div className="flex items-center gap-3 pt-1 border-b border-slate-200 pb-2">
                        <Truck size={16} className="text-slate-400" />
                        <select
                          value={selectedDriverId}
                          onChange={(e) => setSelectedDriverId(e.target.value)}
                          className="bg-transparent border-none focus:ring-0 text-sm font-bold w-full text-slate-700"
                        >
                          <option value="">{isRtl ? 'اختر طيار التوصيل (اختياري)' : 'Select Delivery Driver (Optional)'}</option>
                          {availableDrivers.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-sm font-bold text-slate-400 w-24">{isRtl ? 'رسوم التوصيل' : 'Delivery Fee'}</span>
                        <input
                          type="number"
                          min="0"
                          value={deliveryFee || ''}
                          onChange={(e) => setDeliveryFee(Number(e.target.value))}
                          className="bg-transparent border-none focus:ring-0 text-sm font-bold w-full placeholder:text-slate-300"
                          placeholder="0.00"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          <AnimatePresence initial={false}>
            {cart.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 py-20"
              >
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center">
                  <ShoppingCart size={40} strokeWidth={1.5} />
                </div>
                <p className="font-bold text-sm tracking-wide">{isRtl ? 'السلة فارغة حالياً' : 'Your cart is empty'}</p>
              </motion.div>
            ) : (
              cart.map(item => (
                <motion.div
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  key={item.product_id}
                  className="flex justify-between items-center group"
                >
                  <div className="flex-1 pr-4">
                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-brand-600 transition-colors">{item.name}</h4>
                    <p className="text-xs font-black text-slate-400 mt-1">{formatCurrency(item.price, isRtl)}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.selectedSize, -1)}
                      className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-red-500 transition-all"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-black text-slate-700 min-w-[32px] text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product_id, item.selectedSize, 1)}
                      className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-brand-600 transition-all"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 md:p-8 bg-slate-50/50 backdrop-blur-md border-t border-slate-100 flex-shrink-0 space-y-3 md:space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-slate-500 text-sm font-medium">
              <span>{isRtl ? 'المجموع الفرعي' : 'Subtotal'}</span>
              <span className="font-mono">{formatCurrency(total, isRtl)}</span>
            </div>
            <div className="flex justify-between text-slate-500 text-sm font-medium">
              <span>{isRtl ? `الضريبة (${taxRate}%)` : `Tax (${taxRate}%)`}</span>
              <span className="font-mono">{formatCurrency(tax, isRtl)}</span>
            </div>

            {orderType === 'delivery' && deliveryFee > 0 && (
              <div className="flex justify-between items-center text-sm font-bold text-slate-500 pb-2">
                <span>{isRtl ? 'رسوم التوصيل' : 'Delivery Fee'}</span>
                <span>{formatCurrency(deliveryFee, isRtl)}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-xl md:text-2xl font-black text-brand-600 pt-2 border-t-2 border-brand-100 border-dashed">
              <span className="tracking-tight">{isRtl ? 'الإجمالي' : 'Total'}</span>
              <span className="font-mono text-brand-600">{formatCurrency(grandTotal, isRtl)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                paymentMethod === 'cash'
                  ? "bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-500/20"
                  : "bg-white border-slate-100 text-slate-400 hover:border-brand-200"
              )}
            >
              <Banknote size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">{isRtl ? 'كاش' : 'Cash'}</span>
            </button>
            <button
              onClick={() => setPaymentMethod('card')}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                paymentMethod === 'card'
                  ? "bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-500/20"
                  : "bg-white border-slate-100 text-slate-400 hover:border-brand-200"
              )}
            >
              <CreditCard size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">{isRtl ? 'بطاقة' : 'Card'}</span>
            </button>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              disabled={cart.length === 0}
              onClick={() => {
                setTimeout(() => {
                  window.print();
                }, 100);
              }}
              className="flex-1 bg-white border-2 border-brand-600 text-brand-600 py-4 md:py-5 rounded-[2rem] font-black text-sm md:text-lg shadow-xl shadow-brand-500/10 hover:bg-brand-50 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all uppercase tracking-widest hidden md:block"
            >
              {isRtl ? 'طباعة الفاتورة' : 'Print Invoice'}
            </button>
            <button
              disabled={cart.length === 0}
              onClick={handleSubmitOrder}
              className="flex-[2] bg-brand-600 text-white py-4 md:py-5 rounded-[2rem] font-black text-sm md:text-lg shadow-xl shadow-brand-500/30 hover:bg-brand-700 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 transition-all uppercase tracking-widest"
            >
              {isRtl ? 'إرسال للمطبخ' : 'Send to Kitchen'}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Cart Toggle for Mobile */}
      <button
        onClick={() => setIsCartOpen(true)}
        className="lg:hidden fixed bottom-[90px] md:bottom-24 right-4 md:right-8 bg-brand-600 text-white p-4 rounded-full shadow-lg shadow-brand-500/30 flex items-center justify-center z-30 transform hover:scale-105 transition-all"
      >
        <div className="relative">
          <ShoppingCart size={24} />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
              {cart.length}
            </span>
          )}
        </div>
      </button>

      <AnimatePresence>
        {showHistory && (
          <OrderHistory
            isRtl={isRtl}
            onClose={() => setShowHistory(false)}
            onReorder={handleReorder}
          />
        )}
      </AnimatePresence>

      {/* Size Selection Modal */}
      <AnimatePresence>
        {sizeModalProduct && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSizeModalProduct(null); }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-sm"
            >
              <div className="bg-brand-50 p-6 text-center border-b border-brand-100 relative">
                <h3 className="font-black text-brand-900 text-xl">
                  {isRtl ? sizeModalProduct.name_ar || sizeModalProduct.name : sizeModalProduct.name}
                </h3>
                <p className="text-brand-600 text-sm mt-1">{isRtl ? 'يرجى اختيار المقاس' : 'Please select a size'}</p>
              </div>
              <div className="p-6 space-y-3">
                {sizeModalProduct.sizes?.mini && (
                  <button
                    onClick={() => addToCart(sizeModalProduct, 'mini')}
                    className="w-full flex justify-between items-center p-4 rounded-xl border-2 border-slate-100 hover:border-brand-500 hover:bg-brand-50 transition-all group"
                  >
                    <span className="font-bold text-slate-700 group-hover:text-brand-700">{isRtl ? 'صغير (Mini)' : 'Mini'}</span>
                    <span className="font-black text-brand-600">{formatCurrency(sizeModalProduct.sizes.mini, isRtl)}</span>
                  </button>
                )}
                {sizeModalProduct.sizes?.medium && (
                  <button
                    onClick={() => addToCart(sizeModalProduct, 'medium')}
                    className="w-full flex justify-between items-center p-4 rounded-xl border-2 border-slate-100 hover:border-brand-500 hover:bg-brand-50 transition-all group"
                  >
                    <span className="font-bold text-slate-700 group-hover:text-brand-700">{isRtl ? 'وسط (Medium)' : 'Medium'}</span>
                    <span className="font-black text-brand-600">{formatCurrency(sizeModalProduct.sizes.medium, isRtl)}</span>
                  </button>
                )}
                {sizeModalProduct.sizes?.large && (
                  <button
                    onClick={() => addToCart(sizeModalProduct, 'large')}
                    className="w-full flex justify-between items-center p-4 rounded-xl border-2 border-slate-100 hover:border-brand-500 hover:bg-brand-50 transition-all group"
                  >
                    <span className="font-bold text-slate-700 group-hover:text-brand-700">{isRtl ? 'كبير (Large)' : 'Large'}</span>
                    <span className="font-black text-brand-600">{formatCurrency(sizeModalProduct.sizes.large, isRtl)}</span>
                  </button>
                )}
                {sizeModalProduct.sizes?.roll && (
                  <button
                    onClick={() => addToCart(sizeModalProduct, 'roll')}
                    className="w-full flex justify-between items-center p-4 rounded-xl border-2 border-slate-100 hover:border-brand-500 hover:bg-brand-50 transition-all group"
                  >
                    <span className="font-bold text-slate-700 group-hover:text-brand-700">{isRtl ? 'رول (Roll)' : 'Roll'}</span>
                    <span className="font-black text-brand-600">{formatCurrency(sizeModalProduct.sizes.roll, isRtl)}</span>
                  </button>
                )}
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={() => setSizeModalProduct(null)}
                  className="w-full py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Invoice for Printing */}
      <Invoice
        cart={cart}
        total={total}
        tax={tax}
        deliveryFee={orderType === 'delivery' ? deliveryFee : 0}
        grandTotal={grandTotal}
        orderType={orderType}
        tableNumber={tableNumber}
        paymentMethod={paymentMethod}
        orderId={printedOrderId || undefined}
        customer={customerName ? { name: customerName, phone: customerPhone, address: customerAddress } : undefined}
        isRtl={isRtl}
      />
    </div>
  );
};
