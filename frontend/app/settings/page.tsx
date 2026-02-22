"use client";

import {
    Settings,
    Shield,
    Bell,
    Eye,
    Globe,
    Moon,
    DollarSign,
    ChevronRight,
    ArrowLeft,
    Smartphone,
    Fingerprint,
    Lock,
    Mail,
    SmartphoneIcon
} from "lucide-react";
import Link from "next/link";
import { StatusBar } from "@/app/shared/StatusBar";
import { useState } from "react";

export default function SettingsPage() {
    const [notifications, setNotifications] = useState({
        push: true,
        email: false,
        marketing: true
    });

    const [appearance, setAppearance] = useState({
        darkMode: true,
        currency: "USD",
        language: "English"
    });

    return (
        <main className="w-full bg-[#141414] min-h-screen flex flex-col pb-12">
            <StatusBar />

            {/* Header */}
            <div className="w-full px-6 py-4 flex items-center justify-between">
                <Link href="/profile" className="p-2 rounded-full bg-[#FFFFFF14] text-white">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-white font-bold text-lg">Settings</h1>
                <div className="w-9" /> {/* Spacer */}
            </div>

            {/* Security Section */}
            <div className="mt-8 px-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Security & Privacy</h3>
                <div className="bg-[#FFFFFF08] rounded-2xl overflow-hidden border border-white/5">
                    <Link href="/settings/password" className="p-4 flex items-center justify-between border-b border-white/5 hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-white/5 text-purple-500">
                                <Lock size={18} />
                            </div>
                            <span className="text-white text-sm font-medium">Change Password</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-600" />
                    </Link>
                    <div className="p-4 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-white/5 text-[#1B7339]">
                                <Smartphone size={18} />
                            </div>
                            <span className="text-white text-sm font-medium">Two-Factor Auth (2FA)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#1B7339] font-black uppercase">On</span>
                            <ChevronRight size={18} className="text-gray-600" />
                        </div>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-white/5 text-blue-500">
                                <Fingerprint size={18} />
                            </div>
                            <span className="text-white text-sm font-medium">Biometric Login</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked />
                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B7339]"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Notifications Section */}
            <div className="mt-8 px-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Notifications</h3>
                <div className="bg-[#FFFFFF08] rounded-2xl overflow-hidden border border-white/5">
                    <div className="p-4 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-white/5 text-orange-500">
                                <SmartphoneIcon size={18} />
                            </div>
                            <span className="text-white text-sm font-medium">Push Notifications</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={notifications.push}
                                onChange={() => setNotifications({ ...notifications, push: !notifications.push })}
                            />
                            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B7339]"></div>
                        </label>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-white/5 text-yellow-500">
                                <Mail size={18} />
                            </div>
                            <span className="text-white text-sm font-medium">Email Marketing</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={notifications.marketing}
                                onChange={() => setNotifications({ ...notifications, marketing: !notifications.marketing })}
                            />
                            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B7339]"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* App Preferences */}
            <div className="mt-8 px-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">App Preferences</h3>
                <div className="bg-[#FFFFFF08] rounded-2xl overflow-hidden border border-white/5">
                    <div className="p-4 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-white/5 text-[#1B7339]">
                                <Globe size={18} />
                            </div>
                            <span className="text-white text-sm font-medium">Language</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 uppercase font-bold">{appearance.language}</span>
                            <ChevronRight size={18} className="text-gray-600" />
                        </div>
                    </div>
                    <div className="p-4 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-white/5 text-yellow-500">
                                <DollarSign size={18} />
                            </div>
                            <span className="text-white text-sm font-medium">Secondary Currency</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 uppercase font-bold">{appearance.currency}</span>
                            <ChevronRight size={18} className="text-gray-600" />
                        </div>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-white/5 text-indigo-500">
                                <Moon size={18} />
                            </div>
                            <span className="text-white text-sm font-medium">Dark Mode</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={appearance.darkMode}
                                onChange={() => setAppearance({ ...appearance, darkMode: !appearance.darkMode })}
                            />
                            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B7339]"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="mt-12 px-6">
                <button className="w-full bg-red-500/10 border border-red-500/20 text-red-500 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-red-500/20 transition-colors">
                    Delete Account
                </button>
                <p className="text-[10px] text-gray-600 text-center mt-4">
                    This action is permanent and cannot be undone. All your data and points will be lost.
                </p>
            </div>
        </main>
    );
}
