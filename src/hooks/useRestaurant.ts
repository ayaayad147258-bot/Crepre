import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface RestaurantTheme {
    primaryColor: string;
    secondaryColor: string;
}

export interface RestaurantData {
    name: string;
    logo: string;
    active: boolean;
    theme: RestaurantTheme;
}

type RestaurantState =
    | { status: 'loading' }
    | { status: 'found'; data: RestaurantData }
    | { status: 'not_found' }
    | { status: 'error'; message: string };

export function useRestaurant(restaurantId: string | undefined): RestaurantState {
    const [state, setState] = useState<RestaurantState>({ status: 'loading' });

    useEffect(() => {
        if (!restaurantId) {
            setState({ status: 'not_found' });
            return;
        }

        setState({ status: 'loading' });

        getDoc(doc(db, 'restaurants', restaurantId))
            .then((snap) => {
                if (!snap.exists()) {
                    setState({ status: 'not_found' });
                    return;
                }
                const data = snap.data() as RestaurantData;
                if (!data.active) {
                    setState({ status: 'not_found' });
                    return;
                }
                // Ensure theme defaults
                const fullData: RestaurantData = {
                    name: data.name || 'مطعمنا',
                    logo: data.logo || '',
                    active: true,
                    theme: {
                        primaryColor: data.theme?.primaryColor || '#e63946',
                        secondaryColor: data.theme?.secondaryColor || '#ffd700',
                    },
                };
                setState({ status: 'found', data: fullData });
            })
            .catch((err) => {
                console.error('useRestaurant error:', err);
                setState({ status: 'error', message: err.message });
            });
    }, [restaurantId]);

    return state;
}
