



























import React, { useState, useEffect } from 'react';
import { User as UserIcon, Shield, Plus, Trash2 } from 'lucide-react';
import { cn } from '../utils';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import toast from 'react-hot-toast';

interface UsersProps {
    isRtl: boolean;
}

export const Users: React.FC<UsersProps> = ({ isRtl }) => {
    const [users, setUsers] = useState<any[]>([]);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'cashier' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const querySnapshot = await getDocs(collection(db, 'users'));
            const usersData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(usersData);
        } catch (err) {
            console.error(err);
            toast.error(isRtl ? 'فشل في تحميل المستخدمين' : 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUser.username || !newUser.password) return;
        try {
            await addDoc(collection(db, 'users'), newUser);
            setNewUser({ username: '', password: '', role: 'cashier' });
            fetchUsers();
            toast.success(isRtl ? 'تم إضافة المستخدم بنجاح' : 'User added successfully');
        } catch (err) {
            console.error(err);
            toast.error(isRtl ? 'فشل في إضافة المستخدم' : 'Failed to add user');
        }
    };

    const handleDeleteUser = async (id: string, username: string) => {
        if (username === 'admin') {
            toast.error(isRtl ? 'لا يمكن حذف حساب المدير الأساسي' : 'Cannot delete the main admin account');
            return;
        }
        if (!confirm(isRtl ? 'هل أنت متأكد من حذف هذا المستخدم؟' : 'Are you sure you want to delete this user?')) return;
        try {
            await deleteDoc(doc(db, 'users', id));
            fetchUsers();
            toast.success(isRtl ? 'تم الحذف بنجاح' : 'User deleted successfully');
        } catch (err) {
            console.error(err);
            toast.error(isRtl ? 'حدث خطأ أثناء الحذف' : 'Failed to delete user');
        }
    };

    const handleUpdateRole = async (id: string, newRole: string) => {
        try {
            await updateDoc(doc(db, 'users', id), { role: newRole });
            fetchUsers();
            toast.success(isRtl ? 'تم تحديث الصلاحية بنجاح' : 'Role updated successfully');
        } catch (err) {
            console.error(err);
            toast.error(isRtl ? 'حدث خطأ أثناء تحديث الصلاحية' : 'Failed to update role');
        }
    };

    return (
        <div className="p-8 bg-slate-50 h-full overflow-y-auto w-full">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                    <Shield size={32} className="text-brand-600" />
                    {isRtl ? 'إدارة المستخدمين والأمان' : 'Users & Security'}
                </h1>
                <p className="text-slate-500 mt-2">
                    {isRtl ? 'إضافة ومسح مستخدمين وتحديد صلاحياتهم' : 'Add and remove users, and manage permissions'}
                </p>
            </header>

            <div className="max-w-4xl space-y-8">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <form onSubmit={handleAddUser} className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-4">{isRtl ? 'إضافة مستخدم جديد' : 'Add New User'}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <input
                                    type="text"
                                    placeholder={isRtl ? 'اسم المستخدم' : 'Username'}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20"
                                    value={newUser.username}
                                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <input
                                    type="password"
                                    placeholder={isRtl ? 'كلمة المرور' : 'Password'}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <select
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20"
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                >
                                    <option value="admin">{isRtl ? 'مدير' : 'Admin'}</option>
                                    <option value="cashier">{isRtl ? 'كاشير' : 'Cashier'}</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit" className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors flex items-center gap-2">
                            <Plus size={20} />
                            {isRtl ? 'إضافة المستخدم' : 'Add User'}
                        </button>
                    </form>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-700 mb-4">{isRtl ? 'المستخدمين الحاليين' : 'Current Users'}</h4>
                        {loading ? (
                            <div className="text-center text-slate-400 py-4">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>
                        ) : (
                            users.map(user => (
                                <div key={user.id} className="flex justify-between items-center p-4 border border-slate-200 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-12 h-12 bg-white text-brand-600 rounded-full flex items-center justify-center shadow-sm">
                                            <UserIcon size={24} />
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-slate-800 text-lg">{user.username}</h5>
                                            <p className={cn(
                                                "text-xs uppercase font-bold px-2 py-0.5 mt-1 rounded inline-block",
                                                user.role === 'admin' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                                            )}>
                                                {isRtl ? (user.role === 'admin' ? 'مدير' : 'كاشير') : user.role}
                                            </p>
                                        </div>
                                    </div>
                                    {user.username !== 'admin' ? (
                                        <div className="flex items-center gap-3">
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                                                className={cn(
                                                    "px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-500/20 cursor-pointer",
                                                    user.role === 'admin' ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                                                )}
                                            >
                                                <option value="admin">{isRtl ? 'مدير' : 'Admin'}</option>
                                                <option value="cashier">{isRtl ? 'كاشير' : 'Cashier'}</option>
                                            </select>
                                            <button
                                                onClick={() => handleDeleteUser(user.id, user.username)}
                                                className="text-red-500 hover:bg-red-100 p-2.5 bg-white rounded-xl shadow-sm transition-colors"
                                                title={isRtl ? 'حذف المستخدم' : 'Delete user'}
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-xs text-slate-400 font-medium px-3 italic">
                                                {isRtl ? 'أساسي' : 'Primary'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}

                        {users.length === 0 && !loading && (
                            <div className="text-center text-slate-400 py-4">
                                {isRtl ? 'لا يوجد مستخدمين' : 'No users found'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
