import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { POS } from './components/POS';
import { KDS } from './components/KDS';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { Customers } from './components/Customers';
import { Drivers } from './components/Drivers';
import { Expenses } from './components/Expenses';
import { Login } from './components/Login';
import { Users } from './components/Users';
import { PublicMenu } from './components/PublicMenu';
import { OnlineOrders } from './components/OnlineOrders';
import { User } from './types';
import { cn, checkAccess } from './utils';
import { Toaster } from 'react-hot-toast';

export default function App() {
  const [activeTab, setActiveTab] = useState('pos');
  const [isRtl, setIsRtl] = useState(true);

  // Authentication State
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('pos_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = isRtl ? 'ar' : 'en';
  }, [isRtl]);

  // Dynamic page title from restaurant name in settings
  useEffect(() => {
    const updateTitle = () => {
      const restaurantName = localStorage.getItem('pos_restaurant_name');
      document.title = restaurantName ? restaurantName : 'Smart Food';
    };
    updateTitle();
    window.addEventListener('storage', updateTitle);
    return () => window.removeEventListener('storage', updateTitle);
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('pos_user', JSON.stringify(loggedInUser));

    // Default tab based on role
    if (loggedInUser.role === 'admin') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('pos');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('pos_user');
  };

  if (window.location.pathname === '/menu') {
    return <PublicMenu />;
  }

  if (!user) {
    return <Login isRtl={isRtl} onLogin={handleLogin} />;
  }

  return (
    <div className="w-full h-[100dvh] overflow-auto bg-slate-100">
      <div className={cn(
        "flex flex-col md:flex-row min-w-[1280px] h-full overflow-hidden",
        isRtl ? "font-arabic" : "font-sans"
      )} dir={isRtl ? "rtl" : "ltr"}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isRtl={isRtl}
          setIsRtl={setIsRtl}
          user={user}
          onLogout={handleLogout}
        />

        <main className="flex-1 h-full overflow-y-auto overflow-x-hidden relative">
          <div className="w-full h-full min-h-[600px] md:min-h-[750px] flex flex-col">
            {activeTab === 'pos' && checkAccess(user, 'pos', ['admin', 'cashier']) && <POS isRtl={isRtl} />}
            {activeTab === 'online_orders' && checkAccess(user, 'online_orders', ['admin', 'cashier']) && <OnlineOrders isRtl={isRtl} />}
            {activeTab === 'kds' && checkAccess(user, 'kds', ['admin', 'cashier']) && <KDS isRtl={isRtl} />}
            {activeTab === 'dashboard' && checkAccess(user, 'dashboard', ['admin']) && <Dashboard isRtl={isRtl} />}
            {activeTab === 'inventory' && checkAccess(user, 'inventory', ['admin']) && <Inventory isRtl={isRtl} />}
            {activeTab === 'customers' && checkAccess(user, 'customers', ['admin']) && <Customers isRtl={isRtl} />}
            {activeTab === 'drivers' && checkAccess(user, 'drivers', ['admin']) && <Drivers isRtl={isRtl} />}
            {activeTab === 'expenses' && checkAccess(user, 'expenses', ['admin', 'cashier']) && <Expenses isRtl={isRtl} user={user} />}
            {activeTab === 'reports' && checkAccess(user, 'reports', ['admin']) && <Reports isRtl={isRtl} />}
            {activeTab === 'settings' && checkAccess(user, 'settings', ['admin']) && <Settings isRtl={isRtl} />}
          </div>
        </main>
        <Toaster position="top-center" />
      </div>
    </div>
  );
}
