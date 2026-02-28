import React, { useState } from 'react';
import { ChefHat, Lock, User, ArrowRight } from 'lucide-react';
import { cn } from '../utils';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface LoginProps {
    isRtl: boolean;
    onLogin: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ isRtl, onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // Multi-tenant login: search across all restaurants' users
            // Each user doc has a `restaurantId` field so we know which restaurant they belong to
            // We query the top-level `restaurants` collection, then search sub-collection users
            // For simplicity + performance: we store restaurantId inside user docs and use collectionGroup query
            const { collectionGroup } = await import('firebase/firestore');
            const q = query(
                collectionGroup(db, 'users'),
                where('username', '==', username),
                where('password', '==', password)
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                const userData = userDoc.data();
                // restaurantId comes from the user's data field OR from the parent doc path
                // Path: restaurants/{restaurantId}/users/{userId}
                const pathSegments = userDoc.ref.path.split('/');
                // pathSegments: ['restaurants', '{restaurantId}', 'users', '{userId}']
                const restaurantId = userData.restaurantId || pathSegments[1];
                const user = { id: userDoc.id, ...userData, restaurantId };
                onLogin(user);
            } else {
                setError(isRtl ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError(isRtl ? 'حدث خطأ في الاتصال بقاعدة البيانات' : 'Database connection error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn(
            "min-h-screen w-full flex bg-slate-50",
            isRtl ? "font-arabic" : "font-sans"
        )} dir={isRtl ? "rtl" : "ltr"}>
            {/* Left side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white shadow-2xl z-10">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center">
                        <div className="w-20 h-20 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-100">
                            <ChefHat size={40} className="text-brand-600" />
                        </div>
                        <h1 className="text-4xl font-black text-slate-800 tracking-tight">
                            {isRtl ? 'مرحباً بعودتك' : 'Welcome Back'}
                        </h1>
                        <p className="text-slate-500 mt-3 font-medium">
                            {isRtl ? 'تسجيل الدخول لنظام إدارة المطعم' : 'Login to restaurant management system'}
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6 mt-12 text-left" dir={isRtl ? "rtl" : "ltr"}>
                        {error && (
                            <div className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-bold animate-pulse text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 block text-start">{isRtl ? 'اسم المستخدم' : 'Username'}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 flex items-center px-4 pointer-events-none transition-colors group-focus-within:text-brand-600 text-slate-400">
                                    <User size={20} />
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className={cn(
                                        "w-full py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all font-medium",
                                        isRtl ? "pl-4 pr-12" : "pl-12 pr-4"
                                    )}
                                    placeholder={isRtl ? 'أدخل اسم المستخدم' : 'Enter username'}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 block text-start">{isRtl ? 'كلمة المرور' : 'Password'}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 flex items-center px-4 pointer-events-none transition-colors group-focus-within:text-brand-600 text-slate-400">
                                    <Lock size={20} />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={cn(
                                        "w-full py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all font-medium tracking-widest",
                                        isRtl ? "pl-4 pr-12" : "pl-12 pr-4"
                                    )}
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white p-4 rounded-xl font-black shadow-xl shadow-brand-500/30 transition-all hover:-translate-y-1 disabled:opacity-70 disabled:hover:translate-y-0 disabled:cursor-not-allowed mt-8 text-lg"
                        >
                            {isLoading ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isRtl ? 'تسجيل الدخول' : 'Sign In'}
                                    <ArrowRight size={20} className={cn("transition-transform group-hover:translate-x-1", isRtl && "rotate-180")} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-slate-400">
                        <span>⚡ Powered by Smart Food</span>
                        <span>v2.0.0</span>
                    </div>
                </div>
            </div>

            {/* Right side - Branding/Image */}
            <div className="hidden lg:flex w-1/2 bg-brand-900 relative overflow-hidden items-end p-12">
                <div className="absolute inset-0 opacity-10">
                    <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                    </svg>
                </div>

                <div className="relative z-10 w-full max-w-lg mb-20 text-white">
                    <div className="bg-brand-800/50 backdrop-blur-md border border-brand-700/50 p-8 rounded-3xl shadow-2xl">
                        <h2 className="text-3xl font-black mb-4 leading-tight">
                            {isRtl ? 'نظام إدارة مطاعم متكامل' : 'Complete Restaurant Management System'}
                        </h2>
                        <p className="text-brand-100 text-lg leading-relaxed opacity-90">
                            {isRtl
                                ? 'نقطة بيع، شاشة مطبخ، تقارير مباشرة، وإدارة مخزون. كل ما تحتاجه لإدارة مطعمك بكفاءة عالية في مكان واحد.'
                                : 'POS, Kitchen Display, Live Reports, and Inventory Management. Everything you need to run your restaurant efficiently in one place.'}
                        </p>

                        <div className="flex gap-4 mt-8">
                            <div className="flex items-center gap-2 bg-brand-700/50 px-4 py-2 rounded-lg text-sm font-bold text-brand-50">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                {isRtl ? 'سريع' : 'Fast'}
                            </div>
                            <div className="flex items-center gap-2 bg-brand-700/50 px-4 py-2 rounded-lg text-sm font-bold text-brand-50">
                                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                {isRtl ? 'آمن' : 'Secure'}
                            </div>
                            <div className="flex items-center gap-2 bg-brand-700/50 px-4 py-2 rounded-lg text-sm font-bold text-brand-50">
                                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                                {isRtl ? 'سحابي' : 'Cloud'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-20 right-20 w-64 h-64 bg-brand-500 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />
                <div className="absolute bottom-20 left-20 w-64 h-64 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
            </div>
        </div>
    );
};
