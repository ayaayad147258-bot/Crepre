import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { listenToStoreSettings } from '../services/db';

interface StoreSettings {
    name?: string;
    logo?: string;
    currency?: string;
    tax_rate?: number;
    branch?: string;
    [key: string]: any;
}

interface RestaurantContextType {
    restaurantId: string;
    settings: StoreSettings;
    loading: boolean;
}

const RestaurantContext = createContext<RestaurantContextType | null>(null);

export const RestaurantProvider: React.FC<{
    restaurantId: string;
    children: ReactNode;
}> = ({ restaurantId, children }) => {
    const [settings, setSettings] = useState<StoreSettings>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (restaurantId) {
            setLoading(true);
            const unsub = listenToStoreSettings(restaurantId, (data) => {
                setSettings(data);
                setLoading(false);
            });
            return () => unsub();
        }
    }, [restaurantId]);

    return (
        <RestaurantContext.Provider value={{ restaurantId, settings, loading }}>
            {!loading && children}
            {loading && (
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-100 border-t-brand-600"></div>
                </div>
            )}
        </RestaurantContext.Provider>
    );
};

export const useRestaurantId = (): string => {
    const ctx = useContext(RestaurantContext);
    if (!ctx) throw new Error('useRestaurantId must be used inside <RestaurantProvider>');
    return ctx.restaurantId;
};

export const useRestaurantSettings = (): StoreSettings => {
    const ctx = useContext(RestaurantContext);
    if (!ctx) throw new Error('useRestaurantSettings must be used inside <RestaurantProvider>');
    return ctx.settings;
};
