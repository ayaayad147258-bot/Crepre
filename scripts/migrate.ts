import Database from 'better-sqlite3';
import { doc, setDoc } from 'firebase/firestore';
import { db as firestore } from '../src/lib/firebase.js'; // Ensure correct import

console.log("Starting Data Migration to Firebase...");

// Connect to local SQLite DB
const db = new Database('pos.db');

async function migrateData() {
    try {
        // Migrate Categories
        console.log("Migrating Categories...");
        const categories = db.prepare('SELECT * FROM categories').all() as any[];
        for (const cat of categories) {
            // Use the existing sqlite ID as the document ID in Firebase for consistency
            await setDoc(doc(firestore, "categories", cat.id.toString()), {
                name: cat.name,
                name_ar: cat.name_ar
            });
        }
        console.log(`✅ Migrated ${categories.length} categories.`);

        // Migrate Products
        console.log("Migrating Products...");
        const products = db.prepare('SELECT * FROM products').all() as any[];
        for (const prod of products) {
            await setDoc(doc(firestore, "products", prod.id.toString()), {
                category_id: prod.category_id.toString(), // Store as string reference
                name: prod.name,
                name_ar: prod.name_ar,
                price: prod.price,
                food_cost: prod.food_cost || 0,
                image: prod.image
            });
        }
        console.log(`✅ Migrated ${products.length} products.`);

        // Migrate Inventory
        console.log("Migrating Inventory...");
        const inventory = db.prepare('SELECT * FROM inventory').all() as any[];
        for (const item of inventory) {
            await setDoc(doc(firestore, "inventory", item.id.toString()), {
                name: item.name,
                unit: item.unit,
                stock_level: item.stock_level,
                min_stock: item.min_stock,
                unit_cost: item.unit_cost
            });
        }
        console.log(`✅ Migrated ${inventory.length} inventory items.`);

        // Migrate Recipes
        console.log("Migrating Recipes...");
        const recipes = db.prepare('SELECT * FROM recipes').all() as any[];
        for (const recipe of recipes) {
            await setDoc(doc(firestore, "recipes", recipe.id.toString()), {
                product_id: recipe.product_id.toString(),
                ingredient_id: recipe.ingredient_id.toString(),
                quantity: recipe.quantity
            });
        }
        console.log(`✅ Migrated ${recipes.length} recipes.`);

        console.log("🎉 All data migrated successfully!");
        process.exit(0);

    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}

migrateData();
