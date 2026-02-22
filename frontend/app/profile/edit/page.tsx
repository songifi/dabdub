"use client";

import { useState } from "react";
import { ArrowLeft, Camera, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { StatusBar } from "@/app/shared/StatusBar";
import { useRouter } from "next/navigation";

export default function EditProfilePage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: "John Doe",
        bio: "Digital nomad & crypto enthusiast. Building the future of finance with DabDub. 🚀",
        email: "john.doe@example.com",
        phone: "+234 812 345 6789"
    });

    const handleSave = () => {
        // In a real app, this would call an API
        console.log("Saving profile:", formData);
        router.push("/profile");
    };

    return (
        <main className="w-full bg-[#141414] min-h-screen flex flex-col pb-12">
            <StatusBar />

            {/* Header */}
            <div className="w-full px-6 py-4 flex items-center justify-between">
                <Link href="/profile" className="p-2 rounded-full bg-[#FFFFFF14] text-white">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-white font-bold text-lg">Edit Profile</h1>
                <button
                    onClick={handleSave}
                    className="p-2 rounded-full bg-[#1B7339] text-white"
                >
                    <Check size={20} />
                </button>
            </div>

            {/* Avatar Edit */}
            <div className="flex flex-col items-center mt-8">
                <div className="relative">
                    <div className="w-32 h-32 rounded-full border-4 border-[#1B7339] overflow-hidden">
                        <Image
                            src="/man1.jpg"
                            alt="Profile Avatar"
                            width={128}
                            height={128}
                            className="object-cover"
                        />
                    </div>
                    <button className="absolute bottom-0 right-0 p-3 bg-[#1B7339] text-white rounded-full border-4 border-[#141414] shadow-xl">
                        <Camera size={20} />
                    </button>
                </div>
                <p className="text-gray-400 text-xs mt-4 uppercase tracking-widest font-bold">Change Avatar</p>
            </div>

            {/* Form Fields */}
            <div className="mt-12 px-6 space-y-8">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Full Name</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-[#FFFFFF08] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-[#1B7339] transition-colors"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Bio</label>
                    <textarea
                        rows={4}
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        className="w-full bg-[#FFFFFF08] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-[#1B7339] transition-colors resize-none"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Email Address</label>
                    <input
                        type="email"
                        value={formData.email}
                        disabled
                        className="w-full bg-[#FFFFFF08] border border-white/5 rounded-2xl p-4 text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-[10px] text-gray-600 ml-1">Email cannot be changed once verified.</p>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Phone Number</label>
                    <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-[#FFFFFF08] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-[#1B7339] transition-colors"
                    />
                </div>
            </div>

            <div className="mt-12 px-6">
                <button
                    onClick={handleSave}
                    className="w-full bg-[#1B7339] text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-[#1B7339]/20 active:scale-[0.98] transition-all"
                >
                    Save Changes
                </button>
            </div>
        </main>
    );
}
