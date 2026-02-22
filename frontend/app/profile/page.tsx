"use client";

import {
    User,
    Settings,
    Shield,
    Users,
    HelpCircle,
    LogOut,
    ChevronRight,
    Wallet,
    CreditCard,
    Lock,
    Star,
    CheckCircle2,
    Phone,
    Mail,
    ArrowLeft
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { StatusBar } from "@/app/shared/StatusBar";
import { BottomNav } from "@/app/shared/BottomNav";
import { useState, useEffect } from "react";

export default function ProfilePage() {
    const [points, setPoints] = useState(1250);
    const [animatedPoints, setAnimatedPoints] = useState(0);

    useEffect(() => {
        const duration = 1000;
        const start = 0;
        const end = points;
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.floor(progress * (end - start) + start);
            setAnimatedPoints(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [points]);

    const menuItems = [
        { icon: <Settings size={20} />, label: "Settings", href: "/settings", color: "text-blue-500" },
        { icon: <Shield size={20} />, label: "Security", href: "/settings/security", color: "text-purple-500" },
        { icon: <Users size={20} />, label: "Referrals", href: "/referrals", color: "text-orange-500" },
        { icon: <HelpCircle size={20} />, label: "Help & Support", href: "/support", color: "text-green-500" },
        { icon: <LogOut size={20} />, label: "Logout", href: "/logout", color: "text-red-500" },
    ];

    const quickSettings = [
        { icon: <Wallet size={20} />, label: "Wallets" },
        { icon: <CreditCard size={20} />, label: "Payments" },
        { icon: <Lock size={20} />, label: "Privacy" },
    ];

    return (
        <main className="w-full bg-[#141414] min-h-screen flex flex-col pb-24">

            {/* Header */}
            <div className="w-full px-6 py-4 flex items-center justify-between">
                <Link href="/dashboard" className="p-2 rounded-full bg-[#FFFFFF14] text-white">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-white font-bold text-lg">My Profile</h1>
                <Link href="/profile/edit" className="text-[#1B7339] font-semibold">
                    Edit
                </Link>
            </div>

            {/* Profile Header */}
            <div className="flex flex-col items-center mt-6 px-6">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-[#1B7339] overflow-hidden">
                        <Image
                            src="/man1.jpg"
                            alt="Profile Avatar"
                            width={96}
                            height={96}
                            className="object-cover"
                        />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-[#1B7339] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                        Silver
                    </div>
                </div>
                <h2 className="text-white text-2xl font-bold mt-4">John Doe</h2>
                <p className="text-gray-400 text-sm">@johndoe_dabdub</p>
            </div>

            {/* Points Card */}
            <div className="mx-6 mt-8 p-6 rounded-3xl bg-gradient-to-br from-[#1B7339] to-[#0F3F1F] text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Star size={120} />
                </div>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-medium opacity-80 uppercase tracking-widest">Loyalty Points</span>
                        <Link href="/loyalty" className="text-xs bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                            View History
                        </Link>
                    </div>
                    <div className="flex items-baseline gap-2 mb-6">
                        <span className="text-5xl font-black">{animatedPoints.toLocaleString()}</span>
                        <span className="text-xl opacity-60">PTS</span>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                            <span>SILVER TIER</span>
                            <span>750 / 2,000 PTS TO GOLD</span>
                        </div>
                        <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full transition-all duration-1000 ease-out"
                                style={{ width: '62.5%' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Account Info */}
            <div className="mt-8 px-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Account Information</h3>
                <div className="bg-[#FFFFFF08] rounded-2xl overflow-hidden">
                    <div className="p-4 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/5 text-gray-400">
                                <Mail size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Email Address</p>
                                <p className="text-white text-sm font-medium">john.doe@example.com</p>
                            </div>
                        </div>
                        <CheckCircle2 size={16} className="text-[#1B7339]" />
                    </div>
                    <div className="p-4 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/5 text-gray-400">
                                <Phone size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Phone Number</p>
                                <p className="text-white text-sm font-medium">+234 812 345 6789</p>
                            </div>
                        </div>
                        <CheckCircle2 size={16} className="text-[#1B7339]" />
                    </div>
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/5 text-gray-400">
                                <Shield size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">KYC Status</p>
                                <p className="text-[#1B7339] text-sm font-bold uppercase">Verified</p>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-gray-600" />
                    </div>
                </div>
            </div>

            {/* Quick Settings */}
            <div className="mt-8 px-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Quick Settings</h3>
                <div className="flex justify-between gap-4">
                    {quickSettings.map((item, idx) => (
                        <button key={idx} className="flex-1 bg-[#FFFFFF08] p-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-[#FFFFFF12] transition-colors">
                            <div className="p-3 rounded-full bg-[#1B7339]/10 text-[#1B7339]">
                                {item.icon}
                            </div>
                            <span className="text-white text-xs font-medium">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Menu Options */}
            <div className="mt-8 px-6">
                <div className="bg-[#FFFFFF08] rounded-2xl overflow-hidden">
                    {menuItems.map((item, idx) => (
                        <Link
                            key={idx}
                            href={item.href}
                            className={`p-4 flex items-center justify-between hover:bg-white/5 transition-colors ${idx !== menuItems.length - 1 ? 'border-b border-white/5' : ''}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg bg-white/5 ${item.color}`}>
                                    {item.icon}
                                </div>
                                <span className="text-white font-medium">{item.label}</span>
                            </div>
                            <ChevronRight size={18} className="text-gray-600" />
                        </Link>
                    ))}
                </div>
            </div>

            <BottomNav />
        </main>
    );
}
