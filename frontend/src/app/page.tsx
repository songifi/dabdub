import Link from 'next/link';
import { ArrowRight, Zap, Shield, Globe, QrCode } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-xl text-brand-600">CheesePay</span>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">
              Login
            </Link>
            <Link href="/auth/register" className="btn-primary text-sm">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6 border border-brand-200">
          <Zap className="w-4 h-4" />
          Powered by Stellar Network
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Accept crypto,<br />receive fiat — instantly
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          CheesePay bridges Web3 payments with traditional banking. Merchants receive NGN/USD settlements
          while customers pay with USDC on Stellar.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/auth/register" className="btn-primary flex items-center gap-2 text-base px-6 py-3">
            Start accepting payments <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/waitlist" className="btn-secondary text-base px-6 py-3">
            Join waitlist
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">Why CheesePay?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: QrCode,
                title: 'QR Code Payments',
                desc: 'Customers scan and pay with any Stellar wallet. No crypto knowledge needed for merchants.',
              },
              {
                icon: Zap,
                title: 'Instant Settlement',
                desc: 'Stellar confirms in ~5s. Fiat hits your bank account automatically.',
              },
              {
                icon: Shield,
                title: 'Non-Custodial',
                desc: 'Your keys, your funds. We monitor the blockchain, you hold the wallet.',
              },
              {
                icon: Globe,
                title: 'Cross-Border',
                desc: 'Accept global payments, settle in local currency. Perfect for emerging markets.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-6">
                <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-brand-600" />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
        <p className="text-gray-500 text-center mb-12">Three steps to your first settlement</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Create payment', desc: 'Enter amount in USD. We generate a QR code with your Stellar deposit address.' },
            { step: '02', title: 'Customer pays', desc: 'Customer scans QR, sends USDC or XLM from their Stellar wallet. Confirmed in seconds.' },
            { step: '03', title: 'Receive fiat', desc: 'We detect the payment, convert to fiat, and transfer to your bank account automatically.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-12 h-12 bg-brand-500 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4">
                {step}
              </div>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-gray-500 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-500">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-brand-100 mb-8">Join merchants accepting crypto payments today</p>
          <Link href="/auth/register" className="bg-white text-brand-600 font-semibold px-8 py-3 rounded-lg hover:bg-brand-50 transition-colors inline-flex items-center gap-2">
            Create free account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        © 2025 CheesePay. Built with Stellar.
      </footer>
    </div>
  );
}
