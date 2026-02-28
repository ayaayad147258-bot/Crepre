/**
 * ===================================================
 *  🍽️  سكريبت إضافة مطعم جديد للنظام
 * ===================================================
 * 
 * الاستخدام:
 *   node add-restaurant.mjs
 *
 * سيسألك عن:
 *   - اسم المطعم
 *   - اسم المستخدم (Admin)
 *   - كلمة المرور (Admin)
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

// ========= Firebase Config =========
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

// ========= Helper =========
function generateId(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .substring(0, 30) + "-" + Date.now().toString(36);
}

// ========= Main =========
async function main() {
    const rl = readline.createInterface({ input, output });

    console.log("\n🍽️  ========================================");
    console.log("    إضافة مطعم جديد للنظام");
    console.log("==========================================\n");

    const restaurantName = await rl.question("📝 اسم المطعم: ");
    const restaurantNameEn = await rl.question("📝 اسم المطعم (إنجليزي للرابط): ");
    const adminUsername = await rl.question("👤 اسم المستخدم للأدمن: ");
    const adminPassword = await rl.question("🔑 كلمة المرور للأدمن: ");

    rl.close();

    if (!restaurantName || !adminUsername || !adminPassword) {
        console.error("\n❌ جميع الحقول مطلوبة!");
        process.exit(1);
    }

    const restaurantId = generateId(restaurantNameEn || restaurantName);

    console.log(`\n⏳ جاري إنشاء المطعم: "${restaurantName}" (ID: ${restaurantId})`);

    try {
        // 1. Create restaurant document
        await setDoc(doc(db, "restaurants", restaurantId), {
            name: restaurantName,
            name_en: restaurantNameEn || restaurantName,
            created_at: new Date().toISOString(),
            active: true,
        });
        console.log("  ✅ تم إنشاء المطعم في قاعدة البيانات");

        // 2. Create admin user inside restaurant
        await addDoc(collection(db, "restaurants", restaurantId, "users"), {
            username: adminUsername,
            password: adminPassword,
            role: "admin",
            restaurantId: restaurantId,
            permissions: ["pos", "kds", "inventory", "reports", "customers", "drivers", "expenses", "settings"],
            created_at: new Date().toISOString(),
        });
        console.log("  ✅ تم إنشاء المستخدم الأدمن");

        console.log("\n🎉 ========================================");
        console.log("   تم إنشاء المطعم بنجاح!");
        console.log("==========================================");
        console.log(`\n  📋 تفاصيل المطعم:`);
        console.log(`     🆔 Restaurant ID : ${restaurantId}`);
        console.log(`     🏠 اسم المطعم    : ${restaurantName}`);
        console.log(`     👤 المستخدم      : ${adminUsername}`);
        console.log(`     🔑 كلمة المرور   : ${adminPassword}`);
        console.log("\n  ✨ يمكن لصاحب المطعم الآن تسجيل الدخول بهذه البيانات\n");

    } catch (err) {
        console.error("\n❌ حدث خطأ:", err.message);
        process.exit(1);
    }

    process.exit(0);
}

main();
