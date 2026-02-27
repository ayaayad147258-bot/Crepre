import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRestaurant } from '../hooks/useRestaurant';
import { PublicMenu } from '../components/PublicMenu';
import { NotFound } from './NotFound';

export const RestaurantMenuPage: React.FC = () => {
    const { restaurantId } = useParams<{ restaurantId: string }>();
    const state = useRestaurant(restaurantId);

    // Apply dynamic theme colors via CSS Variables
    useEffect(() => {
        if (state.status === 'found') {
            const { primaryColor, secondaryColor } = state.data.theme;
            document.documentElement.style.setProperty('--color-primary', primaryColor);
            document.documentElement.style.setProperty('--color-secondary', secondaryColor);
            // Update page title
            document.title = state.data.name;
        }
        return () => {
            // Restore defaults on unmount
            document.documentElement.style.removeProperty('--color-primary');
            document.documentElement.style.removeProperty('--color-secondary');
        };
    }, [state]);

    if (state.status === 'loading') {
        return (
            <div
                dir="rtl"
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    background: '#f8fafc',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
            >
                <div
                    style={{
                        width: '48px',
                        height: '48px',
                        border: '4px solid #e2e8f0',
                        borderTopColor: '#e63946',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                    }}
                />
                <p style={{ color: '#64748b', fontSize: '1rem' }}>جاري تحميل المطعم...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (state.status === 'not_found' || state.status === 'error') {
        return <NotFound />;
    }

    // Pass restaurant info to PublicMenu
    return (
        <PublicMenu
            restaurantName={state.data.name}
            restaurantLogo={state.data.logo}
            theme={state.data.theme}
        />
    );
};
