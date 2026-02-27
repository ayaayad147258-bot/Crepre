import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Receipt, DollarSign, Search } from 'lucide-react';
import { listenToExpenses, addExpense, deleteExpense } from '../services/db';
import { formatCurrency, cn } from '../utils';
import { Expense, User } from '../types';
import toast from 'react-hot-toast';

interface ExpensesProps {
    isRtl: boolean;
    user: User;
}

export const Expenses: React.FC<ExpensesProps> = ({ isRtl, user }) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const unsub = listenToExpenses(setExpenses);
        return () => unsub();
    }, []);

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !reason) {
            toast.error(isRtl ? 'يرجى إدخال المبلغ والسبب' : 'Please enter amount and reason');
            return;
        }

        try {
            await addExpense({
                amount: parseFloat(amount),
                reason,
                date: new Date().toISOString(),
            });
            toast.success(isRtl ? 'تم إضافة المصروف بنجاح' : 'Expense added successfully');
            setIsAdding(false);
            setAmount('');
            setReason('');
        } catch (error) {
            console.error('Error adding expense:', error);
            toast.error(isRtl ? 'حدث خطأ أثناء إضافة المصروف' : 'Error adding expense');
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (window.confirm(isRtl ? 'هل أنت متأكد من حذف هذا المصروف؟' : 'Are you sure you want to delete this expense?')) {
            try {
                await deleteExpense(id);
                toast.success(isRtl ? 'تم الحذف بنجاح' : 'Deleted successfully');
            } catch (error) {
                console.error('Error deleting expense:', error);
                toast.error(isRtl ? 'حدث خطأ أثناء الحذف' : 'Error deleting expense');
            }
        }
    };

    const filteredExpenses = expenses.filter(exp =>
        exp.reason.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 bg-slate-50 h-full overflow-y-auto">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">
                        {isRtl ? 'المصروفات' : 'Expenses'}
                    </h1>
                    <p className="text-slate-500">
                        {isRtl ? 'إدارة المصروفات اليومية' : 'Manage daily expenses'}
                    </p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all shadow-sm"
                >
                    <Plus size={20} />
                    {isRtl ? 'إضافة مصروف' : 'Add Expense'}
                </button>
            </header>

            {isAdding && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8 max-w-2xl">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Receipt size={20} className="text-brand-500" />
                        {isRtl ? 'تفاصيل المصروف الجديد' : 'New Expense Details'}
                    </h2>
                    <form onSubmit={handleAddExpense} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">
                                    {isRtl ? 'المبلغ' : 'Amount'}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 flex items-center pointer-events-none px-3 text-slate-400">
                                        <DollarSign size={18} />
                                    </div>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className={cn(
                                            "w-full py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all",
                                            isRtl ? "pr-10" : "pl-10"
                                        )}
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">
                                    {isRtl ? 'سبب المصروف' : 'Reason'}
                                </label>
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                                    placeholder={isRtl ? 'مثال: فواتير كهرباء، مشتريات...' : 'e.g., Electricity bill, supplies...'}
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                type="button"
                                onClick={() => setIsAdding(false)}
                                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                            >
                                {isRtl ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all"
                            >
                                {isRtl ? 'حفظ المصروف' : 'Save Expense'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Calendar size={18} className="text-brand-500" />
                        {isRtl ? 'سجل المصروفات' : 'Expense History'}
                    </h3>
                    <div className="relative w-64">
                        <input
                            type="text"
                            placeholder={isRtl ? 'بحث...' : 'Search...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={cn(
                                "w-full py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all",
                                isRtl ? "pr-10 pl-4" : "pl-10 pr-4"
                            )}
                        />
                        <Search className={cn("absolute top-1/2 -translate-y-1/2 text-slate-400", isRtl ? "right-3" : "left-3")} size={16} />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50">
                            <tr className="text-slate-500 text-sm">
                                <th className="p-4 font-bold">{isRtl ? 'التاريخ' : 'Date'}</th>
                                <th className="p-4 font-bold">{isRtl ? 'السبب' : 'Reason'}</th>
                                <th className="p-4 font-bold">{isRtl ? 'المبلغ' : 'Amount'}</th>
                                <th className="p-4 font-bold text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-500">
                                        {isRtl ? 'لا توجد مصروفات مسجلة' : 'No expenses recorded'}
                                    </td>
                                </tr>
                            ) : (
                                filteredExpenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 text-sm text-slate-600">
                                            {new Date(expense.date).toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="p-4 text-sm font-medium text-slate-800">{expense.reason}</td>
                                        <td className="p-4 text-sm font-bold text-red-500">
                                            {formatCurrency(expense.amount, isRtl)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => handleDeleteExpense(expense.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title={isRtl ? 'حذف' : 'Delete'}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
