"use client";

import {
    Star,
    ArrowLeft,
    TrendingUp,
    History,
    Gift,
    Trophy,
    ChevronRight,
    Clock,
    CheckCircle2,
    ArrowUpRight,
    Plus
} from "lucide-react";
import Link from "next/link";
import { StatusBar } from "@/app/shared/StatusBar";
import { BottomNav } from "@/app/shared/BottomNav";

export default function LoyaltyPage() {
    const pointsHistory = [
        { id: 1, type: "Earned", description: "Daily Login bonus", points: 5, date: "Today, 08:30 AM", status: "Completed" },
        { id: 2, type: "Earned", description: "Deposit via USDC", points: 50, date: "Yesterday, 04:15 PM", status: "Completed" },
        { id: 3, type: "Referral", description: "Referral bonus (Sarah)", points: 1000, date: "22 Feb 2026", status: "Completed" },
        { id: 4, type: "Earned", description: "KYC Completion", points: 1000, date: "21 Feb 2026", status: "Completed" },
        { id: 5, type: "Spent", description: "Gift Card Redemption", points: -500, date: "20 Feb 2026", status: "Completed" },
    ];

    const rewards = [
        { id: 1, title: "$5 Cashback", cost: 500, icon: <TrendingUp className="text-green-500" /> },
        { id: 2, title: "Zero Fee Week", cost: 1500, icon: <Clock className="text-orange-500" /> },
        { id: 3, title: "Premium Theme", cost: 200, icon: <Plus className="text-blue-500" /> },
        { id: 4, title: "Mystery Box", cost: 3000, icon: <Gift className="text-purple-500" /> },
    ];

    return (
        <main className="w-full bg-[#141414] min-h-screen flex flex-col pb-24">

            {/* Header */}
            <div className="w-full px-6 py-4 flex items-center justify-between">
                <Link href="/profile" className="p-2 rounded-full bg-[#FFFFFF14] text-white">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-white font-bold text-lg">Loyalty Rewards</h1>
                <Link href="/loyalty/leaderboard" className="p-2 rounded-full bg-[#1B7339] text-white">
                    <Trophy size={20} />
                </Link>
            </div>

            {/* Points Summary */}
            <div className="flex flex-col items-center mt-6 px-6">
                <div className="p-4 bg-[#1B7339]/10 rounded-full border border-[#1B7339]/30">
                    <Star className="text-[#1B7339]" size={32} fill="currentColor" />
                </div>
                <div className="text-center mt-4">
                    <h2 className="text-4xl font-black text-white">1,250</h2>
                    <p className="text-[#1B7339] font-bold text-sm tracking-widest uppercase">Available Points</p>
                </div>
            </div>

            {/* Tier Progress */}
            <div className="mx-6 mt-8 p-6 bg-[#FFFFFF08] rounded-3xl border border-white/5">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-black font-black text-xs">S</div>
                        <span className="text-white font-bold">Silver Tier</span>
                    </div>
                    <span className="text-gray-500 text-xs font-medium">750 PTS TO GOLD</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-[#1B7339] rounded-full" style={{ width: '62.5%' }} />
                </div>
                <div className="flex justify-between text-[10px] text-gray-600 font-bold uppercase tracking-tighter">
                    <span>Bronze (0)</span>
                    <span>Silver (500)</span>
                    <span>Gold (2000)</span>
                    <span>Platinum (5000)</span>
                </div>
            </div>

            {/* Rewards Catalog */}
            <div className="mt-10 px-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white font-bold text-lg">Rewards Catalog</h3>
                    <span className="text-[#1B7339] text-xs font-bold uppercase underline">See All</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {rewards.map((reward) => (
                        <div key={reward.id} className="bg-[#FFFFFF08] p-4 rounded-3xl border border-white/5 flex flex-col gap-4 relative overflow-hidden group">
                            <div className="p-3 rounded-2xl bg-[#FFFFFF05] w-fit">
                                {reward.icon}
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm">{reward.title}</h4>
                                <div className="flex items-center gap-1 mt-1">
                                    <Star size={10} className="text-[#1B7339]" fill="currentColor" />
                                    <span className="text-[#1B7339] text-xs font-black">{reward.cost} PTS</span>
                                </div>
                            </div>
                            <button className="w-full bg-[#FFFFFF14] py-2 rounded-xl text-xs font-bold text-white group-hover:bg-[#1B7339] transition-colors">
                                Redeem
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Points History */}
            <div className="mt-10 px-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white font-bold text-lg">Points History</h3>
                    <History size={18} className="text-gray-500" />
                </div>
                <div className="space-y-4">
                    {pointsHistory.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4 bg-[#FFFFFF05] rounded-2xl border border-white/5">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${item.points > 0 ? 'bg-[#1B7339]/10 text-[#1B7339]' : 'bg-red-500/10 text-red-500'}`}>
                                    {item.points > 0 ? <Plus size={16} /> : <TrendingUp size={16} className="rotate-180" />}
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm">{item.description}</h4>
                                    <p className="text-[10px] text-gray-500 mt-0.5">{item.date}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`font-black text-sm ${item.points > 0 ? 'text-[#1B7339]' : 'text-red-500'}`}>
                                    {item.points > 0 ? '+' : ''}{item.points}
                                </p>
                                <div className="flex items-center gap-1 justify-end mt-1">
                                    <CheckCircle2 size={10} className="text-[#1B7339]" />
                                    <span className="text-[8px] text-gray-600 font-bold uppercase">Success</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <BottomNav />
        </main>
    );
}
