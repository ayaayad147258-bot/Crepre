/**
 * setup-restaurants.ts
 * =====================
 * سكريبت لإعداد بيانات المطاعم في Firebase Firestore تلقائياً.
 * 
 * الاستخدام:
 *   npx tsx scripts/setup-restaurants.ts
 * 
 * ما يفعله:
 *   - ينشئ collection "restaurants" في Firestore
 *   - يضيف مطعم Crepre مع ألوانه وبياناته
 *   - يضيف أقسام ومنتجات كـ subcollections خاصة بكل مطعم
 */

import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    doc,
    setDoc,
    collection,
    addDoc,
    getDocs,
    deleteDoc
} from 'firebase/firestore';

// ==========================================
// Firebase Config (same as the app)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBkieBAwbbRe6iDAs-kqD28L8D7qkfJD6k",
    authDomain: "crepree.firebaseapp.com",
    projectId: "crepree",
    storageBucket: "crepree.firebasestorage.app",
    messagingSenderId: "136152032204",
    appId: "1:136152032204:web:e28ccbfd225f44953a3369",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// Restaurant Definitions
// Add more restaurants here as needed!
// ==========================================
const restaurants = [
    {
        slug: 'crepre',  // This becomes the URL: /r/crepre
        info: {
            name: 'كريبري',
            logo: '',
            active: true,
            theme: {
                primaryColor: '#e84c3b',
                secondaryColor: '#ffd700',
            },
        },
        categories: [
            { name: 'كريب', name_ar: 'كريب', order: 1 },
            { name: 'مشروبات', name_ar: 'مشروبات', order: 2 },
            { name: 'حلويات', name_ar: 'حلويات', order: 3 },
        ],
        // Products are linked to categories by index (0 = first category, 1 = second, etc.)
        products: [
            { name: 'كريب نوتيلا', name_ar: 'كريب نوتيلا', price: 45, active: true, categoryIndex: 0 },
            { name: 'كريب فراولة', name_ar: 'كريب فراولة', price: 40, active: true, categoryIndex: 0 },
            { name: 'كريب فراخ', name_ar: 'كريب فراخ', price: 55, active: true, categoryIndex: 0 },
            { name: 'كريب مكس', name_ar: 'كريب مكس', price: 60, active: true, categoryIndex: 0 },
            { name: 'عصير برتقال', name_ar: 'عصير برتقال', price: 25, active: true, categoryIndex: 1 },
            { name: 'عصير مانجو', name_ar: 'عصير مانجو', price: 30, active: true, categoryIndex: 1 },
            { name: 'مياه معدنية', name_ar: 'مياه معدنية', price: 10, active: true, categoryIndex: 1 },
            { name: 'واتمير شوكلاتة', name_ar: 'واتمير شوكلاتة', price: 35, active: true, categoryIndex: 2 },
        ],
    },

    // ==========================================
    // أضف مطعم جديد هنا بنفس الشكل:
    // ==========================================
    // {
    //     slug: 'burger-kings',
    //     info: {
    //         name: 'برجر كينج',
    //         logo: '',
    //         active: true,
    //         theme: {
    //             primaryColor: '#D62300',
    //             secondaryColor: '#F5A623',
    //         },
    //     },
    //     categories: [
    //         { name: 'برجر', name_ar: 'برجر', order: 1 },
    //         { name: 'مشروبات', name_ar: 'مشروبات', order: 2 },
    //     ],
    //     products: [
    //         { name: 'بيج ماك', name_ar: 'بيج ماك', price: 85, active: true, categoryIndex: 0 },
    //         { name: 'كولا', name_ar: 'كولا', price: 20, active: true, categoryIndex: 1 },
    //     ],
    // },
];

// ==========================================
// Main Setup Function
// ==========================================
async function setupRestaurants() {
    console.log('🚀 بدء إعداد بيانات المطاعم في Firebase...\n');

    for (const restaurant of restaurants) {
        const { slug, info, categories, products } = restaurant;
        console.log(`📌 معالجة مطعم: ${info.name} (/${slug})`);

        // 1. Create/Update the restaurant document
        await setDoc(doc(db, 'restaurants', slug), info, { merge: true });
        console.log(`   ✅ تم حفظ بيانات المطعم`);

        // 2. Clear existing categories & products (to avoid duplicates on re-run)
        const existingCats = await getDocs(collection(db, 'restaurants', slug, 'categories'));
        const existingProds = await getDocs(collection(db, 'restaurants', slug, 'products'));

        for (const d of existingCats.docs) await deleteDoc(d.ref);
        for (const d of existingProds.docs) await deleteDoc(d.ref);
        console.log(`   🗑️  تم مسح البيانات القديمة`);

        // 3. Add categories and collect their IDs
        const categoryIds: string[] = [];
        for (const cat of categories) {
            const ref = await addDoc(collection(db, 'restaurants', slug, 'categories'), {
                ...cat,
                created_at: new Date().toISOString(),
            });
            categoryIds.push(ref.id);
        }
        console.log(`   📂 تم إضافة ${categories.length} قسم`);

        // 4. Add products, linking them to the correct category ID
        let productCount = 0;
        for (const product of products) {
            const { categoryIndex, ...productData } = product;
            const category_id = categoryIds[categoryIndex] || categoryIds[0];

            await addDoc(collection(db, 'restaurants', slug, 'products'), {
                ...productData,
                category_id,
                created_at: new Date().toISOString(),
            });
            productCount++;
        }
        console.log(`   🍔 تم إضافة ${productCount} منتج`);
        console.log(`   🔗 الرابط: /r/${slug}\n`);
    }

    console.log('✨ تم الانتهاء من إعداد جميع المطاعم بنجاح!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('الروابط المتاحة:');
    restaurants.forEach(r => {
        console.log(`  → http://localhost:5173/r/${r.slug}  (${r.info.name})`);
    });
}

// Run
setupRestaurants().then(() => process.exit(0)).catch((err) => {
    console.error('❌ حدث خطأ:', err);
    process.exit(1);
});
