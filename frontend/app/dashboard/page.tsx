import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  ArrowDownLeft,
  Check,
  ChevronRight,
  CircleX,
  Dot,
  Eye,
  Headset,
  Home,
  Hourglass,
  Link as LinkIcon,
  MessageCircle,
  Mic,
  MoveDown,
  MoveDownLeft,
  MoveUp,
  MoveUpRight,
  Paperclip,
  QrCode,
  Send,
  Share2,
  Smile,
  Star,
  X,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import Link from "next/link";
import Image from "next/image";

const avatars = [
  { src: "/man1.jpg", alt: "User 1" },
  { src: "/man2.jpg", alt: "User 2" },
  { src: "/woman.jpg", alt: "User 3" },
  { src: "/cheese.png", alt: "Cheese Logo" },
];

export default function Dashboard() {
  return (
    <main className="w-full bg-[#141414] flex flex-col items-center min-h-[100vh]">
      <div className="flex flex-col items-center w-[98%] py-[1rem] gap-[1rem] ">
        <div className="w-full flex justify-start">
          <div className="w-[90%]  flex items-center justify-between">
            <Link href="/profile" className="flex items-center justify-between gap-[.2rem] bg-[#FFFCEE] rounded-full px-[.5rem] py-[.25rem] hover:opacity-80 transition-opacity">
              <div className="p-[.25rem] flex items-center justify-center rounded-full text-[#1B7339] text-xs bg-[#C3F1D3] border border-[#1B7339] ">
                <h3>JD</h3>
              </div>
              <h3 className="font-bold text-base">John Doe</h3>
            </Link>
            <Link href="/loyalty" className="flex items-center gap-[.2rem] text-base font-bold text-[#ffffff] hover:text-[#FED05C] transition-colors">
              <Star className="text-[#FED05C] stroke-current" />
              <h3>Points</h3>
            </Link>
          </div>
        </div>
        <div
          className=" w-full flex flex-col justify-start items-center mb-[0.5rem] min-h-[150px] py-[1rem] bg-cover bg-center rounded-md  gap-[7rem]"
          style={{ backgroundImage: "url('/cheese.jpg')" }}
        >
          <div className="flex flex-col w-[90%]">
            <h3 className="font-normal text-[#222222]">SPOT BALANCE</h3>
            <div className="flex items-center gap-[.5rem] font-bold text-xl">
              <h3>$333,444</h3>
              <Eye className="text-[#141414] stroke-current" />
            </div>
            <div className="grid grid-cols-2 gap-[1rem] mt-[2rem] text-[#303030] font-bold">
              <Link
                href="/add-money"
                className="w-full rounded-full flex justify-center gap-[0.5rem]  bg-[#FFFFFF14] border border-[#FFFFFF] px-[0.5rem] py-[0.25rem] hover:bg-[#FFFFFF24] transition-colors"
              >
                <MoveDown />
                <h3>Add</h3>
              </Link>
              <div className="w-full rounded-full flex gap-[0.5rem]  bg-[#FFFFFF14] border border-[#FFFFFF] px-[0.5rem] py-[0.25rem] justify-center">
                <MoveUp />
                <h3>Withdraw</h3>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full grid grid-cols-2 gap-[1rem]  text-[#FFFFFF]  text-base font-bold">
          <Link
            href="/send-money"
            className="w-full rounded-full flex justify-center gap-[0.5rem]  bg-[#1B7339]    py-[0.5rem]"
          >
            <MoveUpRight />
            <h3>Send</h3>
          </Link>
          <Drawer>
            <DrawerTrigger>
              <div className="w-full rounded-full flex gap-[0.5rem]  bg-[#1B7339] py-[.5rem] justify-center">
                <MoveDownLeft />
                <h3>Request</h3>
              </div>
            </DrawerTrigger>
            <DrawerContent>
              <div className="w-full bg-[#FFFCEE] flex flex-col items-center overflow-y-auto  ">
                <div className="flex flex-col items-center justify-center w-[90%] gap-[1rem]">
                  <div className="w-full max-w-[390px] rounded-[32px]  p-8  flex flex-col items-center">
                    <div className="relative w-full aspect-square border-2 border-black rounded-[24px] p-6 flex items-center justify-center">
                      <div className="relative w-full h-full">
                        <Image
                          src="/qr-code.jpg"
                          alt="QR Code"
                          fill
                          className="object-contain"
                        />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20%] aspect-square bg-white p-1 rounded-lg shadow-md border border-gray-100 flex items-center justify-center">
                          <img
                            src="/cheese.png"
                            alt="Logo"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-full max-w-[390px] bg-white rounded-sm p-6 border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-[#1B7339] p-3 rounded-full text-white">
                          <LinkIcon size={24} />
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium text-sm">
                            Requested via Link
                          </p>
                          <h2 className="text-2xl font-bold">₦7,550.00</h2>
                        </div>
                      </div>
                      <span className="bg-[#FEF9C3] text-[#713F12] px-3 py-1 rounded-full text-xs font-bold uppercase">
                        Pending
                      </span>
                    </div>

                    {/* Progress Bar Area */}
                    <div className="flex justify-between text-sm font-semibold mb-2">
                      <span>₦0 contributed</span>
                      <span>₦7,550.00 remaining</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-[#1B7339] w-[5%] h-full rounded-full" />
                    </div>
                  </div>
                  <div className="w-full max-w-[390px] bg-white rounded-sm p-5 border border-gray-100">
                    <p className="text-gray-400 text-sm font-medium">Created</p>
                    <p className="text-xl font-bold">January 6, 2026 - 11:38</p>
                  </div>

                  <div className="w-full max-w-[390px] relative mt-2">
                    <div className="absolute inset-0 bg-black translate-y-1.5 translate-x-0.5 rounded-sm" />

                    <button className="relative w-full bg-[#1B7339] text-white py-4 rounded-sm flex items-center justify-center gap-2 font-bold text-lg active:translate-y-1 transition-transform">
                      <Share2 size={24} />
                      Share Link
                    </button>
                  </div>
                  <div className="w-full max-w-[390px] relative mt-2">
                    <div className="absolute inset-0 bg-black translate-y-1.5 translate-x-0.5 rounded-sm" />

                    <button className="relative w-full bg-[#ffffff] py-4 rounded-sm flex items-center justify-center gap-2 font-bold text-lg active:translate-y-1 transition-transform text-black border border-black">
                      <CircleX size={24} />
                      Cancel
                    </button>
                  </div>

                  <h3 className="underline text-[#595959] font-medium">
                    Issues with this transaction?
                  </h3>
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
        <div className="w-full flex items-center justify-center">
          <Carousel className="w-full flex flex-col">
            <CarouselContent className="mb-6">
              <CarouselItem>
                {" "}
                <div className="w-full flex bg-[#ffffff] py-[.5rem] justify-between px-[.5rem] rounded-md">
                  <Star className="text-[#FED05C] stroke-current" />
                  <div className="flex flex-col w-[88%] gap-[.4rem]">
                    <div className="w-full flex items-center justify-between">
                      <h3>Invite Friends. Get cashback</h3>
                      <X />
                    </div>
                    <p className="text-[#595959]">
                      Your Friend’s Activity earns you badges, perks & rewards.
                    </p>
                  </div>
                </div>
              </CarouselItem>
              <CarouselItem>...</CarouselItem>
              <CarouselItem>...</CarouselItem>
            </CarouselContent>
            {/* <div className=" bg-[pink] flex justify-center items-center gap-2">
              <CarouselPrevious className="!static bg-red-700" />
              <CarouselNext className="!static bg-red-700" />
            </div> */}
          </Carousel>
        </div>
        <div className="w-full flex flex-col items-center justify-center gap-[.5rem]">
          <div className="w-full flex items-center justify-between font-bold text-base text-[#FFFCEE] mb-[.5rem] ">
            <h3>Activity</h3>
            <ChevronRight />
          </div>
          <div className="w-full flex flex-col gap-[.5rem] items-center justify-center">
            <div className="w-full flex justify-between items-center text-white border border-[#FFFFFF0A] rounded-md px-[1rem] py-[.5rem]">
              <div className="flex gap-[.5rem] items-start  ">
                <div className="px-[1rem] py-[1rem] rounded-full bg-[#1B7339]">
                  <LinkIcon />
                </div>
                <div className="flex flex-col gap-[.5rem] items-start">
                  <h3>Requested via Link</h3>
                  <div className="flex justify-start items-center gap-[.25rem] ">
                    <ArrowDownLeft size={20} />
                    <h3 className="text-sm">Request</h3>
                    <div className="p-[.25rem] bg-[#FFF0AF] rounded-full text-[#000000]">
                      <Hourglass size={10} />
                    </div>
                  </div>
                </div>
              </div>
              <h3>$7356</h3>
            </div>
            <div className="w-full flex justify-between items-center text-white border border-[#FFFFFF0A] rounded-md px-[1rem] py-[.5rem]">
              <div className="flex gap-[.5rem] items-start  ">
                <div className="px-[1rem] py-[1rem] rounded-full bg-[#1B7339]">
                  <Star className="text-[#FED05C] stroke-current" />
                </div>
                <div className="flex flex-col gap-[.5rem] items-start">
                  <h3>Requested via Link</h3>
                  <div className="flex justify-start items-center gap-[.25rem] ">
                    {/* <ArrowDownLeft size={20} /> */}
                    <h3 className="text-sm">Cashback</h3>
                    <div className="p-[.25rem] bg-[#B8D4C2] rounded-full text-[#000000]">
                      <Check size={10} />
                    </div>
                  </div>
                </div>
              </div>
              <h3>$7356</h3>
            </div>
            <div className="w-full flex justify-between items-center text-white border border-[#FFFFFF0A] rounded-md px-[1rem] py-[.5rem]">
              <div className="flex gap-[.5rem] items-start  ">
                <div className="px-[1rem] py-[1rem] rounded-full bg-[#1B7339]">
                  <LinkIcon />
                </div>
                <div className="flex flex-col gap-[.5rem] items-start">
                  <h3>Requested via Link</h3>
                  <div className="flex justify-start items-center gap-[.25rem] ">
                    <ArrowDownLeft size={20} />
                    <h3 className="text-sm">Request</h3>
                    <div className="p-[.25rem] bg-[#FFF0AF] rounded-full text-[#000000]">
                      <Hourglass size={10} />
                    </div>
                  </div>
                </div>
              </div>
              <h3>$7356</h3>
            </div>
            <div className="w-full flex justify-between items-center text-white border border-[#FFFFFF0A] rounded-md px-[1rem] py-[.5rem]">
              <div className="flex gap-[.5rem] items-start  ">
                <div className="px-[1rem] py-[1rem] rounded-full bg-[#1B7339]">
                  <LinkIcon />
                </div>
                <div className="flex flex-col gap-[.5rem] items-start">
                  <h3>Requested via Link</h3>
                  <div className="flex justify-start items-center gap-[.25rem] ">
                    <ArrowDownLeft size={20} />
                    <h3 className="text-sm">Request</h3>
                    <div className="p-[.25rem] bg-[#FFF0AF] rounded-full text-[#000000]">
                      <Hourglass size={10} />
                    </div>
                  </div>
                </div>
              </div>
              <h3>$7356</h3>
            </div>
            <div className="w-full flex justify-between items-center text-white border border-[#FFFFFF0A] rounded-md px-[1rem] py-[.5rem]">
              <div className="flex gap-[.5rem] items-start  ">
                <div className="px-[1rem] py-[1rem] rounded-full bg-[#1B7339]">
                  <LinkIcon />
                </div>
                <div className="flex flex-col gap-[.5rem] items-start">
                  <h3>Requested via Link</h3>
                  <div className="flex justify-start items-center gap-[.25rem] ">
                    <ArrowDownLeft size={20} />
                    <h3 className="text-sm">Request</h3>
                    <div className="p-[.25rem] bg-[#FFF0AF] rounded-full text-[#000000]">
                      <Hourglass size={10} />
                    </div>
                  </div>
                </div>
              </div>
              <h3>$7356</h3>
            </div>
            <div className="w-full flex justify-between items-center text-white border border-[#FFFFFF0A] rounded-md px-[1rem] py-[.5rem]">
              <div className="flex gap-[.5rem] items-start  ">
                <div className="px-[1rem] py-[1rem] rounded-full bg-[#1B7339]">
                  <LinkIcon />
                </div>
                <div className="flex flex-col gap-[.5rem] items-start">
                  <h3>Requested via Link</h3>
                  <div className="flex justify-start items-center gap-[.25rem] ">
                    <ArrowDownLeft size={20} />
                    <h3 className="text-sm">Request</h3>
                    <div className="p-[.25rem] bg-[#FFF0AF] rounded-full text-[#000000]">
                      <Hourglass size={10} />
                    </div>
                  </div>
                </div>
              </div>
              <h3>$7356</h3>
            </div>
            <div className="w-full flex justify-between items-center text-white border border-[#FFFFFF0A] rounded-md px-[1rem] py-[.5rem]">
              <div className="flex gap-[.5rem] items-start  ">
                <div className="px-[1rem] py-[1rem] rounded-full bg-[#1B7339]">
                  <LinkIcon />
                </div>
                <div className="flex flex-col gap-[.5rem] items-start">
                  <h3>Requested via Link</h3>
                  <div className="flex justify-start items-center gap-[.25rem] ">
                    <ArrowDownLeft size={20} />
                    <h3 className="text-sm">Request</h3>
                    <div className="p-[.25rem] bg-[#FFF0AF] rounded-full text-[#000000]">
                      <Hourglass size={10} />
                    </div>
                  </div>
                </div>
              </div>
              <h3>$7356</h3>
            </div>
          </div>
        </div>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#747474] backdrop-blur-md pb-safe rounded-4xl">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {/* Home Link */}
          <button className="flex flex-col items-center justify-center flex-1 text-[#1B7339]">
            <Home size={22} />
            <span className="text-[10px] mt-1 font-medium">Home</span>
          </button>

          {/* QR CODE */}
          <Link
            href="/scan-qr-code"
            className="flex items-center justify-center flex-1 -mt-10"
          >
            <div className="bg-[#1B7339] p-3 rounded-full shadow-lg text-white ">
              <QrCode size={28} />
            </div>
          </Link>

          {/* SUPPPORT */}
          <button className="flex flex-col items-center justify-center flex-1 text-[#747474]">
            <Drawer>
              <DrawerTrigger>
                <Headset size={22} />
                <span className="text-[10px] mt-1 font-medium">Support</span>
              </DrawerTrigger>
              <DrawerContent>
                <div className="w-full bg-[#FFFCEE] flex flex-col items-center overflow-y-auto max-h-[90vh]">
                  <div className="w-full bg-[#0F3F1F] flex flex-col items-center py-[1rem] gap-[.5rem] text-[#FFFFFF]">
                    <div className="flex items-center gap-[.2rem] px-[1rem] py-[.5rem] rounded-full bg-[#2121217A]  font-bold">
                      <MessageCircle size={15} />
                      <h3>Chat</h3>
                    </div>
                    <div className="flex -space-x-5">
                      {avatars.map((avatar, index) => (
                        <div
                          key={index}
                          className="relative h-15 w-15 overflow-hidden rounded-full ring-4 ring-[#0F3F1F]"
                        >
                          <Image
                            src={avatar.src}
                            alt={avatar.alt}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                    <h3 className="font-bold ">Chat with Support</h3>
                    <div className="flex justify-center items-center  ">
                      <Dot
                        className="text-[#1B7339] stroke-current"
                        size={30}
                      />
                      <h3 className="font-normal">Support is online</h3>
                    </div>
                  </div>
                  <div className="flex flex-col pt-[2rem] ">
                    <div className="w-full flex items-start justify-end gap-3 p-4 bg-[#F9F8F0]">
                      {/* 1. Avatar Container */}
                      <div className="relative w-[10%] max-w-[48px] aspect-square">
                        <Image
                          src="/cheese.png" // Replace with your cheese icon path
                          alt="Cheese Support"
                          fill
                          className="object-contain"
                        />
                      </div>

                      {/* 2. Content Area (Responsive Width) */}
                      <div className="w-[85%] sm:w-[70%] lg:w-[50%]">
                        <h3 className="text-[#4A4A4A] font-semibold mb-1 ml-1">
                          Cheese
                        </h3>

                        {/* 3. The Green Bubble */}
                        <div className="bg-[#1B7339] text-white p-4 rounded-2xl rounded-tl-none shadow-sm">
                          <p className="text-sm md:text-base leading-relaxed">
                            Hey there! We&apos;re experiencing unusually high
                            volumes and our responses might take a bit longer
                            than usual. To help us with your issue as fast as we
                            can, please provide as many details as you can:
                          </p>

                          <ul className="list-disc ml-5 mt-3 space-y-1 text-sm md:text-base">
                            <li>
                              What were you trying to do? (Which route, which
                              payment etc.)
                            </li>
                            <li>Screenshot, error description etc.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="fixed bottom-0 left-0 w-full bg-[#F9F8F0] border-t border-gray-200 p-4">
                      <div className="max-w-4xl mx-auto">
                        {/* Input Field Area */}
                        <div className="flex items-center justify-between mb-4">
                          <input
                            type="text"
                            placeholder="Compose your message..."
                            className="w-[85%] bg-transparent border-none focus:ring-0 text-lg text-gray-500 placeholder-gray-400"
                          />
                          <button className="bg-[#1B7339] p-2 rounded-sm  text-white hover:bg-green-800 transition-colors">
                            <Send size={20} />
                          </button>
                        </div>

                        {/* Footer Icons and Branding */}
                        <div className="flex items-center justify-between">
                          <div className="flex gap-4 text-gray-400">
                            <Smile
                              className="cursor-pointer hover:text-gray-600"
                              size={24}
                            />
                            <Paperclip
                              className="cursor-pointer hover:text-gray-600"
                              size={24}
                            />
                            <Mic
                              className="cursor-pointer hover:text-gray-600"
                              size={24}
                            />
                          </div>

                          <div className="flex items-center gap-1 text-gray-400 text-sm">
                            <span>We run on</span>
                            <span className="font-semibold flex items-center gap-1">
                              <div className="w-4 h-4 border border-gray-400 rounded-sm" />{" "}
                              crisp
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          </button>
        </div>
      </nav>
    </main>
  );
}
