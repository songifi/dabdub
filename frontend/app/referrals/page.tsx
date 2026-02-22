"use client";

import {
    Users,
    ArrowLeft,
    Copy,
    Share2,
    QrCode,
    MessageSquare,
    Twitter,
    Mail,
    ChevronRight,
    TrendingUp,
    Gift
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { StatusBar } from "@/app/shared/StatusBar";
import { BottomNav } from "@/app/shared/BottomNav";
import { useState } from "react";

export default function ReferralPage() {
    const [copied, setCopied] = useState(false);
    const referralCode = "DABDUB-JET-99";

    const handleCopy = () => {
        navigator.clipboard.writeText(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const stats = [
        { label: "Total Referrals", value: "12", icon: <Users size={18} className="text-blue-500" /> },
        { label: "Pending", value: "3", icon: <TrendingUp size={18} className="text-orange-500" /> },
        { label: "Earned", value: "12,000", icon: <Gift size={18} className="text-[#1B7339]" /> },
    ];

    return (
        <main className="w-full bg-[#141414] min-h-screen flex flex-col pb-24">
            <StatusBar />

            {/* Header */}
            <div className="w-full px-6 py-4 flex items-center justify-between">
                <Link href="/profile" className="p-2 rounded-full bg-[#FFFFFF14] text-white">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-white font-bold text-lg">Refer & Earn</h1>
                <div className="w-9" /> {/* Spacer */}
            </div>

            {/* Hero Section */}
            <div className="mt-6 px-6 text-center">
                <div className="inline-block p-4 bg-[#1B7339]/10 rounded-full mb-4">
                    <Users size={40} className="text-[#1B7339]" />
                </div>
                <h2 className="text-2xl font-black text-white">Invite Your Friends</h2>
                <p className="text-gray-400 text-sm mt-2 max-w-[280px] mx-auto">
                    Share your code and get <span className="text-[#1B7339] font-bold">1,000 points</span> for every successfully verified friend.
                </p>
            </div>

            {/* QR Code & Code Section */}
            <div className="mx-6 mt-10 p-8 rounded-3xl bg-[#FFFFFF08] border border-white/5 flex flex-col items-center">
                <div className="bg-white p-4 rounded-3xl mb-8 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                    <div className="relative w-48 h-48">
                        <Image src="/qr-code.jpg" alt="Referral QR Code" fill className="object-contain" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-white p-1 rounded-lg">
                                <Image src="/cheese.png" alt="Logo" width={32} height={32} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full space-y-4">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center block">Your Referral Code</label>
                    <div className="relative">
                        <div className="w-full bg-[#FFFFFF05] border-2 border-dashed border-[#1B7339]/30 rounded-2xl p-4 text-center">
                            <span className="text-white text-xl font-black tracking-widest">{referralCode}</span>
                        </div>
                        <button
                            onClick={handleCopy}
                            className={`absolute top-1/2 -translate-y-1/2 right-2 p-3 rounded-xl transition-all ${copied ? 'bg-[#1B7339] text-white' : 'bg-[#FFFFFF14] text-gray-400'}`}
                        >
                            <Copy size={18} />
                        </button>
                        {copied && (
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#1B7339] text-white text-[10px] font-black px-3 py-1 rounded-full animate-bounce">
                                COPIED!
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Share Actions */}
            <div className="mt-8 px-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Quick Share</h3>
                <div className="flex justify-between gap-4">
                    <button className="flex-1 bg-[#25D366]/10 p-4 rounded-2xl flex flex-col items-center gap-2 border border-[#25D366]/20">
                        <MessageSquare size={20} className="text-[#25D366]" />
                        <span className="text-white text-[10px] font-bold uppercase">WhatsApp</span>
                    </button>
                    <button className="flex-1 bg-[#1DA1F2]/10 p-4 rounded-2xl flex flex-col items-center gap-2 border border-[#1DA1F2]/20">
                        <Twitter size={20} className="text-[#1DA1F2]" />
                        <span className="text-white text-[10px] font-bold uppercase">Twitter</span>
                    </button>
                    <button className="flex-1 bg-[#FFFFFF08] p-4 rounded-2xl flex flex-col items-center gap-2 border border-white/5">
                        <Share2 size={20} className="text-white" />
                        <span className="text-white text-[10px] font-bold uppercase">More</span>
                    </button>
                </div>
            </div>

            {/* Stats Section */}
            <div className="mt-10 px-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Referral Stats</h3>
                <div className="grid grid-cols-3 gap-4">
                    {stats.map((stat, idx) => (
                        <div key={idx} className="bg-[#FFFFFF05] p-4 rounded-2xl border border-white/5 text-center">
                            <div className="flex justify-center mb-2 opacity-50">{stat.icon}</div>
                            <p className="text-white font-black text-lg">{stat.value}</p>
                            <p className="text-[8px] text-gray-600 font-bold uppercase mt-1 leading-tight">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Activity Mini-List */}
            <div className="mt-10 px-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold text-sm">Recent Referrals</h3>
                    <ChevronRight size={16} className="text-gray-600" />
                </div>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden">
                                <Image src="/woman.jpg" alt="Sarah" width={32} height={32} />
                            </div>
                            <div>
                                <p className="text-white text-xs font-bold">Sarah Chen</p>
                                <p className="text-[10px] text-gray-500">2 hours ago</p>
                            </div>
                        </div>
                        <span className="text-[#1B7339] font-black text-xs">+1,000</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden">
                                <Image src="/man2.jpg" alt="Mike" width={32} height={32} />
                            </div>
                            <div>
                                <p className="text-white text-xs font-bold">Michael K.</p>
                                <p className="text-[10px] text-gray-500">Yesterday</p>
                            </div>
                        </div>
                        <span className="text-orange-500 font-black text-xs">Pending</span>
                    </div>
                </div>
            </div>

            <BottomNav />
        </main>
    );
}
