import React, { useState, useEffect } from 'react';
import {
  Package,
  AlertTriangle,
  Plus,
  RefreshCw,
  TrendingDown,
  DollarSign,
  ChevronRight,
  Search,
  Trash2
} from 'lucide-react';
import { cn, formatCurrency } from '../utils';
import { motion } from 'framer-motion';
import {
  listenToCategories,
  listenToProducts,
  listenToInventory,
  listenToRecipes,
  addCategory,
  addProduct,
  updateProduct,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  addRecipe,
  deleteRecipe,
  deleteCategory,
  deleteProduct,
  deleteProductsByCategory,
  deleteProductsBatch
} from '../services/db';
import { db, storage } from '../lib/firebase';
import { collection, query, getDocs, doc, updateDoc, writeBatch, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Product, Category } from '../types';
import toast from 'react-hot-toast';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock_level: number;
  min_stock: number;
  unit_cost: number;
}

interface ProductCost {
  id: string;
  name: string;
  price: number;
  food_cost: number;
}

interface InventoryProps {
  isRtl: boolean;
}

interface ProductCostCardProps {
  product: ProductCost;
  isRtl: boolean;
  onUpdate: (id: string, cost: number) => void;
}

const ProductCostCard: React.FC<ProductCostCardProps> = ({ product, isRtl, onUpdate }) => {
  const [localCostStr, setLocalCostStr] = useState(product.food_cost.toString() || '0');

  useEffect(() => {
    setLocalCostStr(product.food_cost.toString() || '0');
  }, [product.food_cost]);

  const activeCost = parseFloat(localCostStr) || 0;
  const margin = product.price > 0 ? ((product.price - activeCost) / product.price) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-bold text-lg text-slate-800">{product.name}</h3>
        <span className={cn(
          "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
          margin > 70 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        )}>
          {margin.toFixed(0)}% Margin
        </span>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-slate-500 text-sm">{isRtl ? 'سعر البيع' : 'Selling Price'}</span>
          <span className="font-bold text-slate-800">{formatCurrency(product.price, isRtl)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 text-sm">{isRtl ? 'تكلفة الطعام' : 'Food Cost'}</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">{isRtl ? 'ج.م' : 'EGP'}</span>
            <input
              type="number" step="0.01"
              value={localCostStr}
              onChange={(e) => setLocalCostStr(e.target.value)}
              onBlur={(e) => {
                const val = parseFloat(e.target.value) || 0;
                if (val !== product.food_cost) {
                  onUpdate(product.id, val);
                }
              }}
              className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono font-bold text-brand-600 text-right"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-500 text-sm font-medium">{isRtl ? 'الربح لكل وحدة' : 'Profit per unit'}</span>
            <span className="font-bold text-emerald-600">{formatCurrency(product.price - activeCost, isRtl)}</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-brand-500 h-full"
              style={{ width: `${product.price > 0 ? (activeCost / product.price) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {isRtl ? 'نسبة التكلفة:' : 'Cost Ratio:'} {product.price > 0 ? ((activeCost / product.price) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export const Inventory: React.FC<InventoryProps> = ({ isRtl }) => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [productCosts, setProductCosts] = useState<ProductCost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'costs' | 'menu'>('stock');

  // Menu Bulk Management State
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [deleteSinceDate, setDeleteSinceDate] = useState<string>('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Form State
  const [newCatNameEn, setNewCatNameEn] = useState('');
  const [newCatNameAr, setNewCatNameAr] = useState('');
  const [newProdNameEn, setNewProdNameEn] = useState('');
  const [newProdNameAr, setNewProdNameAr] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdFoodCost, setNewProdFoodCost] = useState('');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdImageFile, setNewProdImageFile] = useState<File | null>(null);
  const [newProdCatId, setNewProdCatId] = useState('');

  // Sizes state
  const [newProdHasSizes, setNewProdHasSizes] = useState(false);
  const [newProdSizes, setNewProdSizes] = useState({ mini: '', medium: '', large: '', roll: '' });

  // Add Ingredient Form State
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('كجم');
  const [newIngMinStock, setNewIngMinStock] = useState('10');
  const [newIngUnitCost, setNewIngUnitCost] = useState('0');

  // Edit Product State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editProdNameEn, setEditProdNameEn] = useState('');
  const [editProdNameAr, setEditProdNameAr] = useState('');
  const [editProdPrice, setEditProdPrice] = useState('');
  const [editProdFoodCost, setEditProdFoodCost] = useState('');
  const [editProdImage, setEditProdImage] = useState('');
  const [editProdImageFile, setEditProdImageFile] = useState<File | null>(null);
  const [editProdCatId, setEditProdCatId] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [editProdHasSizes, setEditProdHasSizes] = useState(false);
  const [editProdSizes, setEditProdSizes] = useState({ mini: '', medium: '', large: '', roll: '' });

  const [recipes, setRecipes] = useState<any[]>([]); // To hold all recipes from API
  const [newProdRecipes, setNewProdRecipes] = useState<{ ingredient_id: string, quantity: number }[]>([]);
  const [editProdRecipes, setEditProdRecipes] = useState<{ ingredient_id: string, quantity: number }[]>([]);

  useEffect(() => {
    setLoading(true);

    const unsubCategories = listenToCategories(setCategories);
    const unsubProducts = listenToProducts(setProducts);
    const unsubInventory = listenToInventory(setIngredients);
    const unsubRecipes = listenToRecipes(setRecipes);

    // Initial load for complex derived views (like product costs) could be handled differently,
    // but we can compute costs directly from products and recipes now.
    setTimeout(() => setLoading(false), 500);

    return () => {
      unsubCategories();
      unsubProducts();
      unsubInventory();
      unsubRecipes();
    };
  }, []);

  // Compute product costs locally instead of relying on a dedicated API
  useEffect(() => {
    if (products.length > 0) {
      const costs = products.map(product => {
        let food_cost = product.food_cost || 0;

        // If not explicitly set, calculate from recipes and inventory
        if (food_cost === 0) {
          const productRecipes = recipes.filter(r => r.product_id === product.id.toString());
          food_cost = productRecipes.reduce((sum, recipe) => {
            const ingredient = ingredients.find(i => i.id.toString() === recipe.ingredient_id);
            return sum + (ingredient ? (ingredient.unit_cost * recipe.quantity) : 0);
          }, 0);
        }

        return {
          id: product.id,
          name: isRtl ? product.name_ar : product.name,
          price: product.price,
          food_cost: food_cost
        } as ProductCost;
      });
      setProductCosts(costs);
    }
  }, [products, ingredients, recipes, isRtl]);

  const handleUpdateIngredient = async (id: number | string, updates: Partial<Ingredient>) => {
    try {
      await updateInventoryItem(id.toString(), updates);
      toast.success(isRtl ? 'تم تحديث المكون' : 'Ingredient updated', { id: 'ing-update' });
    } catch (error) {
      console.error('Failed to update ingredient:', error);
      toast.error(isRtl ? 'فشل التحديث' : 'Update failed');
    }
  };

  const handleUpdateProductCost = async (id: number | string, food_cost: number) => {
    try {
      await updateProduct(id.toString(), { food_cost });
      toast.success(isRtl ? 'تم تحديث التكلفة' : 'Cost updated', { id: 'cost-update' });
    } catch (error) {
      console.error('Failed to update product cost:', error);
    }
  };

  const handleDeleteIngredient = async (id: number | string) => {
    if (!window.confirm(isRtl ? 'هل أنت متأكد من حذف هذا المكون؟ سيتم حذفه أيضاً من جميع الوصفات المرتبطة به.' : 'Are you sure you want to delete this ingredient? It will also be removed from any linked recipes.')) return;
    try {
      await deleteInventoryItem(id.toString());

      // Cleanup associated recipes
      const batch = writeBatch(db);
      const q = query(collection(db, 'recipes'), where('ingredient_id', '==', id.toString()));
      const snap = await getDocs(q);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast.success(isRtl ? 'تم الحذف' : 'Deleted successfully');
    } catch (error) {
      console.error('Failed to delete ingredient:', error);
      toast.error(isRtl ? 'فشل الحذف' : 'Delete failed');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNameEn || !newCatNameAr) return;
    try {
      await addCategory({ name: newCatNameEn, name_ar: newCatNameAr });
      setNewCatNameEn('');
      setNewCatNameAr('');
      toast.success(isRtl ? 'تم إضافة القسم بنجاح' : 'Category added successfully');
    } catch (error) {
      console.error('Failed to add category:', error);
      toast.error(isRtl ? 'حدث خطأ' : 'Error adding category');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdNameEn || !newProdNameAr || !newProdCatId) return;
    if (!newProdHasSizes && !newProdPrice) return;

    try {
      setIsUploading(true);
      let imageUrl = newProdImage;
      if (newProdImageFile) {
        const storageRef = ref(storage, `products/${Date.now()}_${newProdImageFile.name}`);
        const snapshot = await uploadBytesResumable(storageRef, newProdImageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      const sizesObj = newProdHasSizes ? {
        mini: parseFloat(newProdSizes.mini) || null,
        medium: parseFloat(newProdSizes.medium) || null,
        large: parseFloat(newProdSizes.large) || null,
        roll: parseFloat(newProdSizes.roll) || null,
      } : null;

      const prodRef = await addProduct({
        category_id: newProdCatId,
        name: newProdNameEn,
        name_ar: newProdNameAr,
        price: newProdHasSizes ? 0 : parseFloat(newProdPrice),
        food_cost: parseFloat(newProdFoodCost || "0"),
        image: imageUrl,
        active: true,
        sizes: sizesObj
      });

      // Add Recipes concurrently
      if (newProdRecipes.length > 0) {
        const batch = writeBatch(db);
        for (const r of newProdRecipes) {
          const rRef = doc(collection(db, 'recipes'));
          batch.set(rRef, {
            product_id: prodRef.id,
            ingredient_id: r.ingredient_id,
            quantity: r.quantity
          });
        }
        await batch.commit();
      }

      setNewProdNameEn('');
      setNewProdNameAr('');
      setNewProdPrice('');
      setNewProdFoodCost('');
      setNewProdImage('');
      setNewProdRecipes([]);
      setNewProdHasSizes(false);
      setNewProdSizes({ mini: '', medium: '', large: '', roll: '' });
      setNewProdImageFile(null);
      toast.success(isRtl ? 'تم إضافة المنتج بنجاح' : 'Product added successfully');
    } catch (error) {
      console.error('Failed to add product:', error);
      toast.error(isRtl ? 'حدث خطأ أثناء الإضافة' : 'Error adding product');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName) return;
    try {
      await addInventoryItem({
        name: newIngName,
        unit: newIngUnit,
        stock_level: 0,
        min_stock: parseFloat(newIngMinStock || "0"),
        unit_cost: parseFloat(newIngUnitCost || "0")
      });
      setNewIngName('');
      setNewIngUnit('كجم');
      setNewIngMinStock('10');
      setNewIngUnitCost('0');
      setShowAddIngredient(false);
      toast.success(isRtl ? 'تم الإضافة' : 'Added successfully');
    } catch (error) {
      console.error('Failed to add ingredient:', error);
      toast.error(isRtl ? 'فشل الإضافة' : 'Add failed');
    }
  };

  const handleEditProductClick = (product: Product) => {
    setEditingProduct(product);
    setEditProdNameEn(product.name);
    setEditProdNameAr(product.name_ar || '');
    setEditProdPrice(product.price.toString());
    setEditProdFoodCost(product.food_cost?.toString() || '0');
    setEditProdImage(product.image || '');
    setEditProdImageFile(null);
    setEditProdCatId(product.category_id.toString());

    setEditProdHasSizes(!!product.sizes);
    setEditProdSizes({
      mini: product.sizes?.mini?.toString() || '',
      medium: product.sizes?.medium?.toString() || '',
      large: product.sizes?.large?.toString() || '',
      roll: product.sizes?.roll?.toString() || ''
    });

    const prodRecipes = recipes.filter(r => r.product_id === product.id.toString()).map(r => ({
      ingredient_id: r.ingredient_id,
      quantity: r.quantity
    }));
    setEditProdRecipes(prodRecipes);
  };

  const handleEditProductSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      setIsUploading(true);
      let imageUrl = editProdImage;
      if (editProdImageFile) {
        const storageRef = ref(storage, `products/${Date.now()}_${editProdImageFile.name}`);
        const snapshot = await uploadBytesResumable(storageRef, editProdImageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      const sizesObj = editProdHasSizes ? {
        mini: parseFloat(editProdSizes.mini) || null,
        medium: parseFloat(editProdSizes.medium) || null,
        large: parseFloat(editProdSizes.large) || null,
        roll: parseFloat(editProdSizes.roll) || null,
      } : null; // use null to clear it if switching back

      await updateProduct(editingProduct.id.toString(), {
        category_id: editProdCatId,
        name: editProdNameEn,
        name_ar: editProdNameAr,
        price: editProdHasSizes ? 0 : parseFloat(editProdPrice),
        food_cost: parseFloat(editProdFoodCost || "0"),
        image: imageUrl,
        sizes: sizesObj
      });

      // Update recipes: Delete all old ones for this product, then batch write new ones
      const batch = writeBatch(db);
      const q = query(collection(db, 'recipes'), where('product_id', '==', editingProduct.id.toString()));
      const snap = await getDocs(q);
      snap.forEach(d => batch.delete(d.ref));

      for (const r of editProdRecipes) {
        const rRef = doc(collection(db, 'recipes'));
        batch.set(rRef, {
          product_id: editingProduct.id.toString(),
          ingredient_id: r.ingredient_id,
          quantity: r.quantity
        });
      }
      await batch.commit();

      setEditingProduct(null);
      toast.success(isRtl ? 'تم حفظ التعديلات بنجاح' : 'Changes saved successfully');
    } catch (error) {
      console.error('Failed to edit product:', error);
      toast.error(isRtl ? 'حدث خطأ أثناء الحفظ' : 'Error saving changes');
    } finally {
      setIsUploading(false);
    }
  };

  // Bulk Menu Management Action Handlers
  const handleDeleteCategoryWithProducts = async (catId: string) => {
    if (!window.confirm(isRtl ? 'هل أنت متأكد من حذف هذا القسم وجميع منتجاته؟' : 'Are you sure you want to delete this category and all its products?')) {
      return;
    }
    try {
      setBulkActionLoading(true);
      await deleteCategory(catId);
      await deleteProductsByCategory(catId);
      toast.success(isRtl ? 'تم حذف القسم بنجاح' : 'Category deleted successfully');
    } catch (err) {
      console.error(err);
      toast.error(isRtl ? 'حدث خطأ أثناء الحذف' : 'Error deleting category');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSelectAllProducts = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProducts(filteredProducts.map(p => p.id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleDeleteSelectedProducts = async () => {
    if (selectedProducts.length === 0) return;
    if (!window.confirm(isRtl ? `هل أنت متأكد من حذف ${selectedProducts.length} منتجات؟` : `Are you sure you want to delete ${selectedProducts.length} products?`)) {
      return;
    }

    try {
      setBulkActionLoading(true);
      await deleteProductsBatch(selectedProducts);
      setSelectedProducts([]);
      toast.success(isRtl ? 'تم الحذف بنجاح' : 'Deleted successfully');
    } catch (err) {
      console.error('Batch delete error:', err);
      toast.error(isRtl ? 'حدث خطأ في الحذف' : 'Delete error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleClearEntireMenu = async () => {
    const confirmMessage = isRtl
      ? 'تحذير خطير: هل أنت متأكد تماماً من مسح المنيو بالكامل (جميع الأقسام والمنتجات)؟ لا يمكن التراجع عن هذا الإجراء!'
      : 'DANGER: Are you absolutely sure you want to clear the entire menu (all categories and products)? This cannot be undone!';

    if (!window.confirm(confirmMessage)) return;

    try {
      setBulkActionLoading(true);

      const allProductIds = products.map(p => p.id);
      if (allProductIds.length > 0) {
        // Delete all products
        const maxBatchSize = 500;
        for (let i = 0; i < allProductIds.length; i += maxBatchSize) {
          await deleteProductsBatch(allProductIds.slice(i, i + maxBatchSize));
        }
      }

      // Delete all categories directly one by one
      for (const cat of categories) {
        await deleteCategory(cat.id.toString());
      }

      setSelectedProducts([]);
      toast.success(isRtl ? 'تم مسح المنيو بالكامل' : 'Entire menu cleared successfully');
    } catch (err) {
      console.error('Clear menu error:', err);
      toast.error(isRtl ? 'حدث خطأ أثناء مسح المنيو' : 'Error clearing menu');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleDeleteSinceDate = async () => {
    if (!deleteSinceDate) {
      alert(isRtl ? 'يرجى تحديد وقت أولاً' : 'Please select a date and time first');
      return;
    }

    const selectedTimeStr = new Date(deleteSinceDate).toISOString();

    // Find products added after this time
    const productsToDelete = products.filter(p => p.created_at && p.created_at >= selectedTimeStr).map(p => p.id);
    const categoriesToDelete = categories.filter(c => c.created_at && c.created_at >= selectedTimeStr).map(c => c.id.toString());

    if (productsToDelete.length === 0 && categoriesToDelete.length === 0) {
      alert(isRtl ? 'لم يتم العثور على أية إضافات بعد هذا الوقت.' : 'No items found added after this time.');
      return;
    }

    const msg = isRtl
      ? `سيتم حذف ${categoriesToDelete.length} قسم و ${productsToDelete.length} منتج تمت إضافتهم بعد ${new Date(deleteSinceDate).toLocaleString()}. هل أنت متأكد؟`
      : `This will delete ${categoriesToDelete.length} categories and ${productsToDelete.length} products added after ${new Date(deleteSinceDate).toLocaleString()}. Are you sure?`;

    if (!window.confirm(msg)) return;

    try {
      setBulkActionLoading(true);
      if (productsToDelete.length > 0) {
        const maxBatchSize = 500;
        for (let i = 0; i < productsToDelete.length; i += maxBatchSize) {
          await deleteProductsBatch(productsToDelete.slice(i, i + maxBatchSize));
        }
      }
      for (const catId of categoriesToDelete) {
        await deleteCategory(catId);
      }
      setSelectedProducts([]);
      toast.success(isRtl ? 'تم الحذف بنجاح' : 'Deleted successfully');
    } catch (err) {
      console.error('Delete since error:', err);
      toast.error(isRtl ? 'حدث خطأ' : 'An error occurred');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const lowStockItems = ingredients.filter(i => i.stock_level <= i.min_stock);
  const filteredIngredients = ingredients.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
    (p.name_ar && p.name_ar.includes(menuSearchQuery))
  );

  return (
    <div className="p-8 bg-slate-50 h-full overflow-y-auto">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            {isRtl ? 'إدارة المخزون' : 'Inventory Management'}
          </h1>
          <p className="text-slate-500">
            {isRtl ? 'تتبع المكونات والتكاليف ومستويات المخزون' : 'Track ingredients, costs, and stock levels'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { }}
            className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all"
          >
            <RefreshCw size={20} className={cn(loading && "animate-spin")} />
          </button>
          <button onClick={() => setShowAddIngredient(!showAddIngredient)} className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg">
            <Plus size={20} />
            {isRtl ? 'إضافة مكون' : 'Add Ingredient'}
          </button>
        </div>
      </header>

      {showAddIngredient && (
        <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-brand-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-slate-800">{isRtl ? 'إضافة مكون جديد' : 'Add New Ingredient'}</h3>
            <button onClick={() => setShowAddIngredient(false)} className="text-slate-400 hover:text-slate-600 font-bold">
              ✕
            </button>
          </div>
          <form onSubmit={handleAddIngredient} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">{isRtl ? 'اسم المكون' : 'Ingredient Name'}</label>
              <input type="text" required value={newIngName} onChange={(e) => setNewIngName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">{isRtl ? 'الوحدة' : 'Unit'}</label>
              <select required value={newIngUnit} onChange={(e) => setNewIngUnit(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 appearance-none">
                <option value="بالقطعة">{isRtl ? 'بالقطعة' : 'Piece'}</option>
                <option value="كجم">{isRtl ? 'كجم' : 'kg'}</option>
                <option value="جم">{isRtl ? 'جم' : 'g'}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">{isRtl ? 'تكلفة الوحدة' : 'Unit Cost'}</label>
              <input type="number" step="0.01" required value={newIngUnitCost} onChange={(e) => setNewIngUnitCost(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
            </div>
            <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-md hover:bg-emerald-700 transition-colors">
              {isRtl ? 'حفظ المكون' : 'Save'}
            </button>
          </form>
        </div>
      )}

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4">
          <div className="bg-amber-500 p-2 rounded-lg text-white">
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-amber-800">
              {isRtl ? 'تنبيه: مخزون منخفض' : 'Low Stock Alert'}
            </h3>
            <p className="text-amber-700 text-sm">
              {isRtl
                ? `هناك ${lowStockItems.length} مكونات وصلت للحد الأدنى للمخزون.`
                : `There are ${lowStockItems.length} items currently at or below minimum stock levels.`}
            </p>
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
              {lowStockItems.map(item => (
                <span key={item.id} className="bg-white px-3 py-1 rounded-full text-xs font-bold text-amber-600 border border-amber-200 whitespace-nowrap">
                  {item.name}: {item.stock_level} {item.unit}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-200 p-1 rounded-xl w-fit mb-8">
        <button
          onClick={() => setActiveTab('stock')}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'stock' ? "bg-white text-brand-600 shadow-sm" : "text-slate-600 hover:text-slate-800"
          )}
        >
          {isRtl ? 'المخزون' : 'Stock Levels'}
        </button>
        <button
          onClick={() => setActiveTab('costs')}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'costs' ? "bg-white text-brand-600 shadow-sm" : "text-slate-600 hover:text-slate-800"
          )}
        >
          {isRtl ? 'التكاليف' : 'Food Costs'}
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'menu' ? "bg-white text-brand-600 shadow-sm" : "text-slate-600 hover:text-slate-800"
          )}
        >
          {isRtl ? 'إدارة المنيو' : 'Menu Management'}
        </button>
      </div>

      {activeTab === 'stock' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder={isRtl ? 'البحث عن مكون...' : 'Search ingredients...'}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">{isRtl ? 'المكون' : 'Ingredient'}</th>
                <th className="px-6 py-4 font-bold">{isRtl ? 'المخزون الحالي' : 'Current Stock'}</th>
                <th className="px-6 py-4 font-bold">{isRtl ? 'الحد الأدنى' : 'Min Stock'}</th>
                <th className="px-6 py-4 font-bold">{isRtl ? 'تكلفة الوحدة' : 'Unit Cost'}</th>
                <th className="px-6 py-4 font-bold text-right">{isRtl ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredIngredients.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        item.stock_level <= item.min_stock ? "bg-amber-100 text-amber-600" : "bg-brand-50 text-brand-600"
                      )}>
                        <Package size={20} />
                      </div>
                      <input
                        type="text"
                        defaultValue={item.name}
                        onBlur={(e) => {
                          if (e.target.value && e.target.value !== item.name) {
                            handleUpdateIngredient(item.id, { name: e.target.value });
                          }
                        }}
                        className="font-bold text-slate-700 bg-transparent border-none focus:ring-1 focus:ring-brand-500 rounded px-1 -ml-1"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue={item.stock_level}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val !== item.stock_level) {
                            handleUpdateIngredient(item.id, { stock_level: val });
                          }
                        }}
                        className={cn(
                          "w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono font-bold",
                          item.stock_level <= item.min_stock ? "text-amber-600" : "text-slate-600"
                        )}
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => handleUpdateIngredient(item.id, { unit: e.target.value })}
                        className="text-xs text-slate-500 bg-transparent border-none focus:ring-0 cursor-pointer"
                      >
                        <option value="بالقطعة">{isRtl ? 'بالقطعة' : 'Piece'}</option>
                        <option value="كجم">{isRtl ? 'كجم' : 'kg'}</option>
                        <option value="جم">{isRtl ? 'جم' : 'g'}</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-medium">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue={item.min_stock}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val !== item.min_stock) {
                            handleUpdateIngredient(item.id, { min_stock: val });
                          }
                        }}
                        className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                      />
                      <span className="text-xs text-slate-400">{item.unit}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs">{isRtl ? 'ج.م' : 'EGP'}</span>
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={item.unit_cost}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val !== item.unit_cost) {
                            handleUpdateIngredient(item.id, { unit_cost: val });
                          }
                        }}
                        className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-3">
                      <button
                        onClick={() => handleUpdateIngredient(item.id, { stock_level: item.stock_level + 10 })}
                        className="text-brand-600 hover:text-brand-700 font-bold text-sm bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {isRtl ? 'إضافة مخزون' : 'Restock'}
                      </button>
                      <button
                        onClick={() => handleDeleteIngredient(item.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                        title={isRtl ? 'حذف المكون' : 'Delete Ingredient'}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'costs' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {productCosts.map((product) => (
            <ProductCostCard
              key={product.id}
              product={product}
              isRtl={isRtl}
              onUpdate={handleUpdateProductCost}
            />
          ))}
        </div>
      ) : activeTab === 'menu' ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Add Category Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-lg text-slate-800 mb-6">{isRtl ? 'إضافة قسم جديد' : 'Add New Category'}</h3>
              <form onSubmit={handleAddCategory} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">{isRtl ? 'اسم القسم (إنجليزي)' : 'Category Name (EN)'}</label>
                  <input
                    type="text" required
                    value={newCatNameEn} onChange={(e) => setNewCatNameEn(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    placeholder="e.g. Salads"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">{isRtl ? 'اسم القسم (عربي)' : 'Category Name (AR)'}</label>
                  <input
                    type="text" required
                    value={newCatNameAr} onChange={(e) => setNewCatNameAr(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    placeholder="مثال: سلطات"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold shadow-md hover:bg-brand-700 transition-colors">
                  {isRtl ? 'حفظ القسم' : 'Save Category'}
                </button>
              </form>
            </div>

            {/* Current Categories List */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-lg text-slate-800 mb-6">{isRtl ? 'الأقسام الحالية' : 'Current Categories'}</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {categories.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-colors group">
                    <div>
                      <h4 className="font-bold text-slate-700">{isRtl ? cat.name_ar : cat.name}</h4>
                      <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{isRtl ? cat.name : cat.name_ar}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteCategoryWithProducts(cat.id.toString())}
                      disabled={bulkActionLoading}
                      className="text-slate-400 hover:text-red-500 bg-white p-2 rounded-lg shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                      title={isRtl ? 'حذف القسم وكل منتجاته' : 'Delete category and all its products'}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-4">{isRtl ? 'لا توجد أقسام' : 'No categories found'}</p>
                )}
              </div>
            </div>

            {/* Add Product Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-lg text-slate-800 mb-6">{isRtl ? 'إضافة منتج جديد' : 'Add New Product'}</h3>
              <form onSubmit={handleAddProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">{isRtl ? 'القسم' : 'Category'}</label>
                    <select
                      required
                      value={newProdCatId} onChange={(e) => setNewProdCatId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="" disabled>{isRtl ? 'اختر القسم' : 'Select Category'}</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{isRtl ? c.name_ar : c.name}</option>)}
                    </select>
                  </div>
                  {!newProdHasSizes && (
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-2">{isRtl ? 'السعر الافتراضي' : 'Default Price'}</label>
                      <input
                        type="number" step="0.01" required={!newProdHasSizes}
                        value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">{isRtl ? 'تكلفة المنتج' : 'Product Cost'}</label>
                    <input
                      type="number" step="0.01"
                      value={newProdFoodCost} onChange={(e) => setNewProdFoodCost(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Has Sizes Checkbox & Price Inputs */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      id="has-sizes"
                      checked={newProdHasSizes}
                      onChange={(e) => setNewProdHasSizes(e.target.checked)}
                      className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500"
                    />
                    <label htmlFor="has-sizes" className="font-bold text-slate-700 cursor-pointer">
                      {isRtl ? 'هذا المنتج له مقاسات (صغير، وسط، كبير)؟' : 'Does this product have sizes (Mini, Medium, Large)?'}
                    </label>
                  </div>

                  {newProdHasSizes && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">{isRtl ? 'سعر الصغير (Mini)' : 'Mini Price'}</label>
                        <input
                          type="number" step="0.01"
                          value={newProdSizes.mini} onChange={(e) => setNewProdSizes({ ...newProdSizes, mini: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/20"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">{isRtl ? 'سعر الوسط (Medium)' : 'Medium Price'}</label>
                        <input
                          type="number" step="0.01"
                          value={newProdSizes.medium} onChange={(e) => setNewProdSizes({ ...newProdSizes, medium: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/20"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">{isRtl ? 'سعر الكبير (Large)' : 'Large Price'}</label>
                        <input
                          type="number" step="0.01"
                          value={newProdSizes.large} onChange={(e) => setNewProdSizes({ ...newProdSizes, large: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/20"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">{isRtl ? 'سعر الرول (Roll)' : 'Roll Price'}</label>
                        <input
                          type="number" step="0.01"
                          value={newProdSizes.roll} onChange={(e) => setNewProdSizes({ ...newProdSizes, roll: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/20"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">{isRtl ? 'الاسم (إنجليزي)' : 'Name (EN)'}</label>
                    <input
                      type="text" required
                      value={newProdNameEn} onChange={(e) => setNewProdNameEn(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">{isRtl ? 'الاسم (عربي)' : 'Name (AR)'}</label>
                    <input
                      type="text" required
                      value={newProdNameAr} onChange={(e) => setNewProdNameAr(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-slate-700">{isRtl ? 'مكونات الوصفة' : 'Recipe Ingredients'}</h4>
                    <button
                      type="button"
                      onClick={() => setNewProdRecipes([...newProdRecipes, { ingredient_id: ingredients[0]?.id || '', quantity: 1 }])}
                      className="text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100"
                    >
                      {isRtl ? '+ إضافة مكون' : '+ Add Ingredient'}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {newProdRecipes.map((recipe, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20"
                          value={recipe.ingredient_id}
                          onChange={(e) => {
                            const updated = [...newProdRecipes];
                            updated[idx].ingredient_id = e.target.value;
                            setNewProdRecipes(updated);
                          }}
                        >
                          <option value="0" disabled>{isRtl ? 'اختر المكون' : 'Select Ingredient'}</option>
                          {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
                        </select>
                        <input
                          type="number" step="0.01" min="0" placeholder={isRtl ? 'الكمية' : 'Qty'}
                          className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20"
                          value={recipe.quantity}
                          onChange={(e) => {
                            const updated = [...newProdRecipes];
                            updated[idx].quantity = parseFloat(e.target.value) || 0;
                            setNewProdRecipes(updated);
                          }}
                        />
                        <button type="button" onClick={() => setNewProdRecipes(newProdRecipes.filter((_, i) => i !== idx))} className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100">✕</button>
                      </div>
                    ))}
                    {newProdRecipes.length === 0 && <p className="text-xs text-slate-400 italic text-center p-2">{isRtl ? 'لا يوجد مكونات مضافة' : 'No ingredients added'}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">{isRtl ? 'صورة المنتج (رابط أو ملف)' : 'Product Image (URL or File)'}</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={newProdImage} onChange={(e) => setNewProdImage(e.target.value)}
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-sm"
                      placeholder="https://..."
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setNewProdImageFile(e.target.files[0]);
                          setNewProdImage(''); // Clear URL if file selected
                        }
                      }}
                      className="sm:max-w-[200px] text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                    />
                  </div>
                </div>

                <button disabled={isUploading} type="submit" className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold shadow-md hover:bg-brand-700 transition-colors disabled:opacity-50">
                  {isUploading ? (isRtl ? 'جاري الرفع...' : 'Uploading...') : (isRtl ? 'حفظ المنتج' : 'Save Product')}
                </button>
              </form>
            </div>
          </div>

          {/* Current Menu List */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-8">
            <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h3 className="font-bold text-lg text-slate-800">{isRtl ? 'عناصر المنيو الحالية' : 'Current Menu Items'}</h3>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder={isRtl ? 'البحث عن منتج...' : 'Search products...'}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={menuSearchQuery}
                    onChange={(e) => setMenuSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Bulk Actions Toolbar */}
            <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 border border-slate-200 rounded-lg shrink-0">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                    onChange={handleSelectAllProducts}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm font-bold text-slate-700">{isRtl ? 'تحديد الكل' : 'Select All'}</span>
                </label>
                {selectedProducts.length > 0 && (
                  <button
                    onClick={handleDeleteSelectedProducts}
                    disabled={bulkActionLoading}
                    className="text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    {isRtl ? `حذف المحدد (${selectedProducts.length})` : `Delete Selected (${selectedProducts.length})`}
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-lg flex-1 lg:flex-none">
                  <span className="text-xs font-bold text-slate-500 px-2 shrink-0">{isRtl ? 'حذف الإضافات منذ:' : 'Delete added since:'}</span>
                  <input
                    type="datetime-local"
                    value={deleteSinceDate}
                    onChange={(e) => setDeleteSinceDate(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border-none rounded text-xs focus:ring-0 text-slate-700 font-mono"
                  />
                  <button
                    onClick={handleDeleteSinceDate}
                    disabled={bulkActionLoading || !deleteSinceDate}
                    className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded disabled:opacity-50 transition-colors shrink-0"
                    title={isRtl ? 'حذف' : 'Delete'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <button
                  onClick={handleClearEntireMenu}
                  disabled={bulkActionLoading}
                  className="w-full sm:w-auto text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-50 shrink-0"
                >
                  {isRtl ? 'مسح المنيو بالكامل' : 'Clear Entire Menu'}
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map(product => {
                const category = categories.find(c => c.id === product.category_id);

                if (editingProduct?.id === product.id) {
                  return (
                    <div key={`edit-${product.id}`} className="col-span-full md:col-span-2 lg:col-span-4 bg-slate-50 p-6 rounded-2xl border border-brand-200 shadow-sm">
                      <form onSubmit={handleEditProductSave} className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-bold text-brand-700 text-lg">{isRtl ? 'تعديل المنتج' : 'Edit Product'}</h4>
                          <button type="button" onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">✕ Cancel</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <select required value={editProdCatId} onChange={e => setEditProdCatId(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                              {categories.map(c => <option key={c.id} value={c.id}>{isRtl ? c.name_ar : c.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <input required type="number" step="0.01" value={editProdPrice} onChange={e => setEditProdPrice(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" placeholder={isRtl ? "السعر" : "Price"} />
                          </div>
                          <div>
                            <input type="number" step="0.01" value={editProdFoodCost} onChange={e => setEditProdFoodCost(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" placeholder={isRtl ? "تكلفة الطعام" : "Food Cost"} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input required type="text" value={editProdNameEn} onChange={e => setEditProdNameEn(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" placeholder="Name (EN)" />
                          <input required type="text" value={editProdNameAr} onChange={e => setEditProdNameAr(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" placeholder={isRtl ? 'الاسم (عربي)' : "Name (AR)"} />
                        </div>

                        <div className="border border-slate-200 rounded-xl p-4 bg-white">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-700 text-sm">{isRtl ? 'مكونات الوصفة' : 'Recipe Ingredients'}</h4>
                            <button
                              type="button"
                              onClick={() => setEditProdRecipes([...editProdRecipes, { ingredient_id: ingredients[0]?.id || '', quantity: 1 }])}
                              className="text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100"
                            >
                              {isRtl ? '+ إضافة مكون' : '+ Add Ingredient'}
                            </button>
                          </div>
                          <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {editProdRecipes.map((recipe, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <select
                                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20"
                                  value={recipe.ingredient_id}
                                  onChange={(e) => {
                                    const updated = [...editProdRecipes];
                                    updated[idx].ingredient_id = e.target.value;
                                    setEditProdRecipes(updated);
                                  }}
                                >
                                  <option value="0" disabled>{isRtl ? 'اختر المكون' : 'Select Ingredient'}</option>
                                  {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
                                </select>
                                <input
                                  type="number" step="0.01" min="0" placeholder={isRtl ? 'الكمية' : 'Qty'}
                                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20"
                                  value={recipe.quantity}
                                  onChange={(e) => {
                                    const updated = [...editProdRecipes];
                                    updated[idx].quantity = parseFloat(e.target.value) || 0;
                                    setEditProdRecipes(updated);
                                  }}
                                />
                                <button type="button" onClick={() => setEditProdRecipes(editProdRecipes.filter((_, i) => i !== idx))} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-lg">✕</button>
                              </div>
                            ))}
                            {editProdRecipes.length === 0 && <p className="text-xs text-slate-400 italic text-center p-2">{isRtl ? 'لا يوجد مكونات مضافة' : 'No ingredients added'}</p>}
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                          <div className="flex items-center gap-3 mb-4">
                            <input
                              type="checkbox"
                              id={`edit-has-sizes-${product.id}`}
                              checked={editProdHasSizes}
                              onChange={(e) => setEditProdHasSizes(e.target.checked)}
                              className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500"
                            />
                            <label htmlFor={`edit-has-sizes-${product.id}`} className="font-bold text-slate-700 cursor-pointer">
                              {isRtl ? 'أضف أسعار للمقاسات' : 'Add Size Prices'}
                            </label>
                          </div>

                          {editProdHasSizes && (
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{isRtl ? 'صغير' : 'Mini'}</label>
                                <input
                                  type="number" step="0.01"
                                  value={editProdSizes.mini} onChange={(e) => setEditProdSizes({ ...editProdSizes, mini: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/20"
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{isRtl ? 'وسط' : 'Medium'}</label>
                                <input
                                  type="number" step="0.01"
                                  value={editProdSizes.medium} onChange={(e) => setEditProdSizes({ ...editProdSizes, medium: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/20"
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{isRtl ? 'كبير' : 'Large'}</label>
                                <input
                                  type="number" step="0.01"
                                  value={editProdSizes.large} onChange={(e) => setEditProdSizes({ ...editProdSizes, large: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/20"
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{isRtl ? 'رول' : 'Roll'}</label>
                                <input
                                  type="number" step="0.01"
                                  value={editProdSizes.roll} onChange={(e) => setEditProdSizes({ ...editProdSizes, roll: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/20"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 pt-2 border-t border-slate-200 mt-2">
                          <div className="flex-1 flex flex-col sm:flex-row gap-2">
                            <input type="url" value={editProdImage} onChange={e => setEditProdImage(e.target.value)} className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" placeholder={isRtl ? 'رابط الصورة' : "Image URL"} />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  setEditProdImageFile(e.target.files[0]);
                                  setEditProdImage('');
                                }
                              }}
                              className="text-sm file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                            />
                          </div>
                          <button disabled={isUploading} type="submit" className="px-8 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-md disabled:opacity-50">
                            {isUploading ? (isRtl ? 'جاري الرفع...' : 'Uploading...') : (isRtl ? 'حفظ التعديلات' : 'Save Changes')}
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                }

                return (
                  <div key={product.id} className="flex gap-4 p-4 border border-slate-100 rounded-xl items-center hover:bg-slate-50 transition-colors group relative">
                    <div className="absolute top-2 right-2 z-10">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts([...selectedProducts, product.id]);
                          } else {
                            setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                          }
                        }}
                        className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer shadow-sm"
                      />
                    </div>
                    <img src={product.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop"} alt={product.name} className="w-16 h-16 rounded-lg object-cover bg-slate-100 shrink-0" />
                    <div className="flex-1 min-w-0 pr-6">
                      <p className="text-xs font-bold text-brand-600 uppercase mb-1">{isRtl ? category?.name_ar : category?.name}</p>
                      <h4 className="font-bold text-slate-800 truncate text-sm">{isRtl ? product.name_ar : product.name}</h4>
                      <p className="text-slate-500 font-mono mt-1 text-sm">{formatCurrency(product.price, isRtl)}</p>
                    </div>
                    <button onClick={() => handleEditProductClick(product)} className="opacity-0 group-hover:opacity-100 p-2 text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition-all text-xs font-bold shrink-0">
                      {isRtl ? 'تعديل' : 'Edit'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
