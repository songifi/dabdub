"use client"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  ArrowLeft,
  QrCode,
  Search,
  User,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Mock data
const recentRecipients = [
  { id: 1, name: "Alice Johnson", username: "@alicej", avatar: "/woman.jpg" },
  { id: 2, name: "Bob Smith", username: "@bobsmith", avatar: "/man1.jpg" },
  { id: 3, name: "Charlie Brown", username: "@charlieb", avatar: "/man2.jpg" },
];

const contacts = [
  {
    id: 1,
    name: "David Wilson",
    phone: "+1234567890",
    isDabDubUser: true,
    avatar: "/man1.jpg",
  },
  {
    id: 2,
    name: "Eva Green",
    email: "eva@example.com",
    isDabDubUser: false,
    avatar: "/woman.jpg",
  },
  {
    id: 3,
    name: "Frank Miller",
    username: "@frankm",
    isDabDubUser: true,
    avatar: "/man2.jpg",
  },
];

export default function SendMoney() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  return (
    <main className="w-full bg-[#141414] flex flex-col items-center min-h-[100vh]">
      <div className="flex flex-col items-center w-[98%] py-[1rem] gap-[1rem]">
        {/* Header */}
        <div className="w-full flex items-center justify-start">
          <Link href="/dashboard" className="text-white">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-white font-bold text-xl ml-4">Send Money</h1>
        </div>

        {/* Search Bar */}
        <div className="w-full relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search username, phone, email, or address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim()) {
                router.push(
                  `/send-money/recipient?q=${encodeURIComponent(searchQuery)}`,
                );
              }
            }}
            className="w-full bg-[#FFFFFF14] border border-[#FFFFFF0A] rounded-full px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-[#1B7339]"
          />
        </div>

        {/* Recent Recipients */}
        <div className="w-full">
          <h2 className="text-white font-bold text-lg mb-4">
            Recent Recipients
          </h2>
          <Carousel className="w-full">
            <CarouselContent>
              {recentRecipients.map((recipient) => (
                <CarouselItem key={recipient.id} className="basis-1/3">
                  <div
                    onClick={() =>
                      router.push(
                        `/send-money/recipient?recipient=${encodeURIComponent(JSON.stringify({ type: "dabdub", ...recipient }))}`,
                      )
                    }
                    className="flex flex-col items-center p-2 bg-[#FFFFFF14] rounded-lg cursor-pointer hover:bg-[#FFFFFF24] transition-colors"
                  >
                    <Image
                      src={recipient.avatar}
                      alt={recipient.name}
                      width={50}
                      height={50}
                      className="rounded-full"
                    />
                    <p className="text-white text-sm mt-2 text-center">
                      {recipient.name}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {recipient.username}
                    </p>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>

        {/* Contacts */}
        <div className="w-full">
          <h2 className="text-white font-bold text-lg mb-4">Contacts</h2>
          <div className="space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() =>
                  router.push(
                    `/send-money/recipient?recipient=${encodeURIComponent(JSON.stringify({ type: contact.isDabDubUser ? "dabdub" : "contact", ...contact }))}`,
                  )
                }
                className="flex items-center justify-between bg-[#FFFFFF14] border border-[#FFFFFF0A] rounded-lg p-4 cursor-pointer hover:bg-[#FFFFFF24] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Image
                    src={contact.avatar}
                    alt={contact.name}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                  <div>
                    <p className="text-white font-medium">{contact.name}</p>
                    <div className="flex items-center gap-1 text-gray-400 text-sm">
                      {contact.phone && (
                        <>
                          <Phone size={14} /> {contact.phone}
                        </>
                      )}
                      {contact.email && (
                        <>
                          <Mail size={14} /> {contact.email}
                        </>
                      )}
                      {contact.username && (
                        <>
                          <User size={14} /> {contact.username}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {contact.isDabDubUser && (
                  <div className="bg-[#1B7339] text-white text-xs px-2 py-1 rounded-full">
                    DabDub
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* QR Scanner Button */}
        <Link href="/scan-qr-code" className="w-full">
          <button className="w-full bg-[#1B7339] text-white py-4 rounded-lg flex items-center justify-center gap-2 font-bold text-lg">
            <QrCode size={24} />
            Scan QR Code
          </button>
        </Link>
      </div>
    </main>
  );
}
