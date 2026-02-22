"use client";

import {
    Trophy,
    ArrowLeft,
    Search,
    TrendingUp,
    Medal,
    ChevronRight,
    Star
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { StatusBar } from "@/app/shared/StatusBar";
import { BottomNav } from "@/app/shared/BottomNav";

export default function LeaderboardPage() {
    const topUsers = [
        { id: 1, name: "Alex Rivers", points: 15420, rank: 1, avatar: "/man1.jpg", trend: "up" },
        { id: 2, name: "Sarah Chen", points: 12850, rank: 2, avatar: "/woman.jpg", trend: "down" },
        { id: 3, name: "Michael K.", points: 11200, rank: 3, avatar: "/man2.jpg", trend: "up" },
    ];

    const otherUsers = [
        { id: 4, name: "David Miller", points: 9800, rank: 4, avatar: "/man1.jpg" },
        { id: 5, name: "Emma Wilson", points: 8500, rank: 5, avatar: "/woman.jpg" },
        { id: 6, name: "John Doe (You)", points: 8250, rank: 6, avatar: "/man1.jpg", isMe: true },
        { id: 7, name: "Olivia Brown", points: 7900, rank: 7, avatar: "/woman.jpg" },
        { id: 8, name: "Robert Fox", points: 7200, rank: 8, avatar: "/man2.jpg" },
        { id: 9, name: "Sophie Taylor", points: 6800, rank: 9, avatar: "/woman.jpg" },
        { id: 10, name: "James Bond", points: 6500, rank: 10, avatar: "/man1.jpg" },
    ];

    return (
        <main className="w-full bg-[#141414] min-h-screen flex flex-col pb-24">
            <StatusBar />

            {/* Header */}
            <div className="w-full px-6 py-4 flex items-center justify-between">
                <Link href="/loyalty" className="p-2 rounded-full bg-[#FFFFFF14] text-white">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-white font-bold text-lg">Leaderboard</h1>
                <button className="p-2 rounded-full bg-[#FFFFFF14] text-white">
                    <Search size={20} />
                </button>
            </div>

            {/* Top 3 Podium */}
            <div className="flex justify-center items-end gap-2 mt-10 px-6 h-64 border-b border-white/5 pb-8">
                {/* Rank 2 */}
                <div className="flex flex-col items-center flex-1">
                    <div className="relative mb-2">
                        <div className="w-16 h-16 rounded-full border-2 border-slate-400 p-1">
                            <div className="w-full h-full rounded-full overflow-hidden">
                                <Image src={topUsers[1].avatar} alt={topUsers[1].name} width={64} height={64} className="object-cover" />
                            </div>
                        </div>
                        <div className="absolute -bottom-2 -right-1 bg-slate-400 text-black w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-[#141414]">2</div>
                    </div>
                    <span className="text-white font-bold text-xs text-center truncate w-full">{topUsers[1].name.split(' ')[0]}</span>
                    <div className="mt-2 w-full bg-slate-400/20 h-24 rounded-t-2xl flex flex-col items-center justify-center">
                        <span className="text-slate-400 font-black text-xs">{topUsers[1].points}</span>
                    </div>
                </div>

                {/* Rank 1 */}
                <div className="flex flex-col items-center flex-1">
                    <div className="relative mb-4">
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 animate-bounce">
                            <Medal size={32} className="text-[#FED05C]" fill="currentColor" />
                        </div>
                        <div className="w-20 h-20 rounded-full border-4 border-[#FED05C] p-1 shadow-[0_0_20px_rgba(254,208,92,0.3)]">
                            <div className="w-full h-full rounded-full overflow-hidden">
                                <Image src={topUsers[0].avatar} alt={topUsers[0].name} width={80} height={80} className="object-cover" />
                            </div>
                        </div>
                        <div className="absolute -bottom-2 -right-1 bg-[#FED05C] text-black w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ring-4 ring-[#141414]">1</div>
                    </div>
                    <span className="text-white font-bold text-sm text-center truncate w-full">{topUsers[0].name.split(' ')[0]}</span>
                    <div className="mt-2 w-full bg-[#FED05C]/20 h-32 rounded-t-2xl flex flex-col items-center justify-center border-t-2 border-[#FED05C]/50">
                        <span className="text-[#FED05C] font-black text-sm">{topUsers[0].points}</span>
                    </div>
                </div>

                {/* Rank 3 */}
                <div className="flex flex-col items-center flex-1">
                    <div className="relative mb-2">
                        <div className="w-16 h-16 rounded-full border-2 border-orange-500 p-1">
                            <div className="w-full h-full rounded-full overflow-hidden">
                                <Image src={topUsers[2].avatar} alt={topUsers[2].name} width={64} height={64} className="object-cover" />
                            </div>
                        </div>
                        <div className="absolute -bottom-2 -right-1 bg-orange-500 text-black w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-[#141414]">3</div>
                    </div>
                    <span className="text-white font-bold text-xs text-center truncate w-full">{topUsers[2].name.split(' ')[0]}</span>
                    <div className="mt-2 w-full bg-orange-500/20 h-20 rounded-t-2xl flex flex-col items-center justify-center">
                        <span className="text-orange-500 font-black text-xs">{topUsers[2].points}</span>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="mt-4 px-6 flex-1">
                <div className="space-y-4">
                    {otherUsers.map((user) => (
                        <div
                            key={user.id}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${user.isMe ? 'bg-[#1B7339]/10 border-[#1B7339] shadow-[0_0_15px_rgba(27,115,57,0.1)]' : 'bg-[#FFFFFF05] border-white/5'}`}
                        >
                            <div className="flex items-center gap-4">
                                <span className={`w-6 font-black text-center ${user.isMe ? 'text-[#1B7339]' : 'text-gray-600'}`}>
                                    {user.rank}
                                </span>
                                <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10">
                                    <Image src={user.avatar} alt={user.name} width={40} height={40} className="object-cover" />
                                </div>
                                <div>
                                    <h4 className={`font-bold text-sm ${user.isMe ? 'text-white' : 'text-gray-300'}`}>
                                        {user.name}
                                    </h4>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <Star size={10} className="text-[#1B7339]" fill="currentColor" />
                                        <span className="text-[10px] text-gray-500 font-bold">{user.points} PTS</span>
                                    </div>
                                </div>
                            </div>
                            {user.isMe && (
                                <div className="bg-[#1B7339] text-[#FFFCEE] text-[8px] font-black px-2 py-1 rounded-full uppercase">
                                    Current Rank
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <BottomNav />
        </main>
    );
}
