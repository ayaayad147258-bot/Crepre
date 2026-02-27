import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    where,
    getDocs,
    limit,
    getDoc,
    setDoc,
    writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Category, Product, Order, Customer, Driver } from '../types';

// ==========================================
// CATEGORIES
// ==========================================
export const listenToCategories = (callback: (data: Category[]) => void) => {
    const q = query(collection(db, 'categories'));
    return onSnapshot(q, (snapshot) => {
        const categories: Category[] = [];
        snapshot.forEach((doc) => {
            categories.push({ id: doc.id, ...doc.data() } as unknown as Category);
        });
        callback(categories);
    });
};

export const addCategory = async (data: any) => {
    return await addDoc(collection(db, 'categories'), {
        ...data,
        created_at: new Date().toISOString()
    });
};

export const updateCategory = async (id: string, data: any) => {
    return await updateDoc(doc(db, 'categories', id), data);
};

export const deleteCategory = async (id: string) => {
    return await deleteDoc(doc(db, 'categories', id));
};

// ==========================================
// PRODUCTS
// ==========================================
export const listenToProducts = (callback: (data: Product[]) => void) => {
    const q = query(collection(db, 'products'));
    return onSnapshot(q, (snapshot) => {
        const products: Product[] = [];
        snapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() } as unknown as Product);
        });
        callback(products);
    });
};

export const addProduct = async (data: any) => {
    return await addDoc(collection(db, 'products'), {
        ...data,
        created_at: new Date().toISOString()
    });
};

export const updateProduct = async (id: string, data: any) => {
    return await updateDoc(doc(db, 'products', id), data);
};

export const deleteProduct = async (id: string) => {
    return await deleteDoc(doc(db, 'products', id));
};

export const deleteProductsByCategory = async (categoryId: string) => {
    const q = query(collection(db, 'products'), where('category_id', '==', categoryId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((productDoc) => {
        batch.delete(productDoc.ref);
    });
    return await batch.commit();
};

export const deleteProductsBatch = async (productIds: string[]) => {
    const batch = writeBatch(db);
    productIds.forEach((id) => {
        batch.delete(doc(db, 'products', id));
    });
    return await batch.commit();
};

// ==========================================
// INVENTORY
// ==========================================
export const listenToInventory = (callback: (data: any[]) => void) => {
    const q = query(collection(db, 'inventory'));
    return onSnapshot(q, (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
        });
        callback(items);
    });
};

export const addInventoryItem = async (data: any) => {
    return await addDoc(collection(db, 'inventory'), data);
};

export const updateInventoryItem = async (id: string, data: any) => {
    return await updateDoc(doc(db, 'inventory', id), data);
};

export const deleteInventoryItem = async (id: string) => {
    return await deleteDoc(doc(db, 'inventory', id));
};

// ==========================================
// RECIPES
// ==========================================
export const listenToRecipes = (callback: (data: any[]) => void) => {
    const q = query(collection(db, 'recipes'));
    return onSnapshot(q, (snapshot) => {
        const recipes: any[] = [];
        snapshot.forEach((doc) => {
            recipes.push({ id: doc.id, ...doc.data() });
        });
        callback(recipes);
    });
};

export const addRecipe = async (data: any) => {
    return await addDoc(collection(db, 'recipes'), data);
};

export const deleteRecipe = async (id: string) => {
    return await deleteDoc(doc(db, 'recipes', id));
};

// ==========================================
// CUSTOMERS
// ==========================================
export const listenToCustomers = (callback: (data: Customer[]) => void) => {
    const q = query(collection(db, 'customers'));
    return onSnapshot(q, (snapshot) => {
        const customers: Customer[] = [];
        snapshot.forEach((doc) => {
            customers.push({ id: doc.id, ...doc.data() } as unknown as Customer);
        });
        callback(customers);
    });
};

export const addCustomer = async (data: Omit<Customer, 'id' | 'created_at'>) => {
    return await addDoc(collection(db, 'customers'), {
        ...data,
        created_at: new Date().toISOString()
    });
};

export const updateCustomer = async (id: string, data: Partial<Customer>) => {
    return await updateDoc(doc(db, 'customers', id), data);
};

export const deleteCustomer = async (id: string) => {
    return await deleteDoc(doc(db, 'customers', id));
};

// ==========================================
// DRIVERS
// ==========================================
export const listenToDrivers = (callback: (data: Driver[]) => void) => {
    const q = query(collection(db, 'drivers'));
    return onSnapshot(q, (snapshot) => {
        const drivers: Driver[] = [];
        snapshot.forEach((doc) => {
            drivers.push({ id: doc.id, ...doc.data() } as unknown as Driver);
        });
        callback(drivers);
    });
};

export const addDriver = async (data: Omit<Driver, 'id'>) => {
    return await addDoc(collection(db, 'drivers'), {
        ...data,
        status: 'available',
        current_deliveries: 0,
        completed_deliveries: 0,
        total_cash_collected: 0,
        created_at: new Date().toISOString()
    });
};

export const updateDriver = async (id: string, data: Partial<Driver>) => {
    return await updateDoc(doc(db, 'drivers', id), data);
};

export const deleteDriver = async (id: string) => {
    return await deleteDoc(doc(db, 'drivers', id));
};

// ==========================================
// ORDERS
// ==========================================
export const listenToOrders = (callback: (data: any[]) => void) => {
    const q = query(collection(db, 'orders'), orderBy('created_at', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const orders: any[] = [];
        snapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        callback(orders);
    });
};

export const addOrder = async (orderData: any) => {
    // 1. Get the start of today
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // 2. Query for all orders today to find the highest daily_id
    // We avoid orderBy('daily_id') here to prevent Firebase missing index errors
    const q = query(
        collection(db, 'orders'),
        where('created_at', '>=', startOfToday)
    );

    let nextDailyId = 1;

    try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            let maxId = 0;
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.daily_id && typeof data.daily_id === 'number') {
                    if (data.daily_id > maxId) {
                        maxId = data.daily_id;
                    }
                }
            });
            nextDailyId = maxId + 1;
        }
    } catch (e) {
        console.error("Error fetching last daily order ID", e);
    }

    const docRef = await addDoc(collection(db, 'orders'), {
        ...orderData,
        daily_id: nextDailyId,
        created_at: new Date().toISOString(),
    });

    // --- Deduct Inventory based on items and recipes ---
    if (orderData.items && Array.isArray(orderData.items)) {
        try {
            const batch = writeBatch(db);
            const inventoryToDeduct = new Map<string, number>();

            // Aggregate ingredient deduction requirements
            for (const item of orderData.items) {
                if (!item.product_id) continue;

                const productIdStr = item.product_id.toString();
                const itemQty = Number(item.quantity) || 1;

                const rq = query(collection(db, 'recipes'), where('product_id', '==', productIdStr));
                const rSnap = await getDocs(rq);

                rSnap.forEach(recipeDoc => {
                    const rData = recipeDoc.data();
                    if (rData.ingredient_id) {
                        const ingId = rData.ingredient_id.toString();
                        const reqQty = (Number(rData.quantity) || 0) * itemQty;
                        inventoryToDeduct.set(ingId, (inventoryToDeduct.get(ingId) || 0) + reqQty);
                    }
                });
            }

            // Apply deductions to inventory
            let hasUpdates = false;
            for (const [ingId, qtyToDeduct] of inventoryToDeduct.entries()) {
                if (qtyToDeduct <= 0) continue;

                const ingRef = doc(db, 'inventory', ingId);
                const ingSnap = await getDoc(ingRef);
                if (ingSnap.exists()) {
                    const currentStock = Number(ingSnap.data().stock_level) || 0;
                    batch.update(ingRef, { stock_level: currentStock - qtyToDeduct });
                    hasUpdates = true;
                }
            }

            if (hasUpdates) {
                await batch.commit();
            }
        } catch (err) {
            console.error("Failed to deduct inventory on order creation:", err);
            // Non-blocking error, order is still placed
        }
    }

    return { id: docRef.id, daily_id: nextDailyId };
};

export const updateOrderStatus = async (id: string, status: string, driver_id?: string) => {
    // If the order is being marked as served or cancelled, and it has a driver_id, free up the driver
    if ((status === 'served' || status === 'cancelled') && driver_id) {
        await updateDriver(driver_id, { status: 'available' });
    }
    return await updateDoc(doc(db, 'orders', id), { status });
};

export const updateOrderAsDispacthed = async (id: string, driver_id: string, status: string) => {
    return await updateDoc(doc(db, 'orders', id), { driver_id, status });
};

export const updateOrderDriver = async (id: string, driver_id: string) => {
    return await updateDoc(doc(db, 'orders', id), { driver_id });
};

export const markOrderAsPaid = async (id: string) => {
    return await updateDoc(doc(db, 'orders', id), { is_paid: true });
};

// ==========================================
// EXPENSES
// ==========================================
export const listenToExpenses = (callback: (data: any[]) => void) => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const expenses: any[] = [];
        snapshot.forEach((doc) => {
            expenses.push({ id: doc.id, ...doc.data() });
        });
        callback(expenses);
    });
};

export const addExpense = async (data: Omit<import('../types').Expense, 'id'>) => {
    return await addDoc(collection(db, 'expenses'), {
        ...data,
    });
};

export const deleteExpense = async (id: string) => {
    return await deleteDoc(doc(db, 'expenses', id));
};

// ==========================================
// STORE SETTINGS (for Public Menu sync)
// ==========================================
export const saveStoreSettings = async (data: { name?: string; logo?: string;[key: string]: any }) => {
    return await setDoc(doc(db, 'settings', 'store'), data, { merge: true });
};

export const listenToStoreSettings = (callback: (data: any) => void) => {
    return onSnapshot(doc(db, 'settings', 'store'), (snap) => {
        callback(snap.exists() ? snap.data() : {});
    });
};
