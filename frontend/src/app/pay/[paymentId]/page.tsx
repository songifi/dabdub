'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { paymentsApi } from '@/lib/api';
import { formatUsd } from '@/lib/utils';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-8 h-8 text-yellow-500" />,
  confirmed: <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />,
  settling: <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />,
  settled: <CheckCircle className="w-8 h-8 text-green-500" />,
  failed: <XCircle className="w-8 h-8 text-red-500" />,
  expired: <XCircle className="w-8 h-8 text-gray-400" />,
};

export default function PayPage({ params }: { params: { paymentId: string } }) {
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    paymentsApi.getByReference(params.paymentId).then(({ data }) => setPayment(data)).finally(() => setLoading(false));

    const interval = setInterval(() => {
      paymentsApi.getByReference(params.paymentId).then(({ data }) => {
        setPayment(data);
        if (['settled', 'failed', 'expired'].includes(data.status)) clearInterval(interval);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [params.paymentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600">Payment not found</p>
        </div>
      </div>
    );
  }

  const stellarUri = `web+stellar:pay?destination=${payment.stellarDepositAddress}&amount=${payment.amountXlm}&memo=${payment.stellarMemo}&memo_type=text`;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="p-6 border-b border-gray-100 text-center">
          <p className="text-sm text-gray-500 font-medium">CheesePay</p>
          <h1 className="text-3xl font-bold mt-1">{formatUsd(payment.amountUsd)}</h1>
          {payment.description && <p className="text-sm text-gray-500 mt-1">{payment.description}</p>}
        </div>

        <div className="p-6">
          {payment.status === 'pending' ? (
            <>
              <div className="flex justify-center mb-4">
                <div className="bg-white p-3 rounded-xl border border-gray-200">
                  <QRCodeSVG value={stellarUri} size={180} />
                </div>
              </div>
              <p className="text-center text-xs text-gray-500 mb-4">
                Scan with a Stellar wallet app
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                <p className="font-semibold text-amber-800 mb-1">Important: Include memo</p>
                <code className="text-amber-900 font-bold text-sm">{payment.stellarMemo}</code>
                <p className="text-amber-700 mt-1">Payment will not be detected without the memo.</p>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="flex justify-center mb-3">{STATUS_ICONS[payment.status]}</div>
              <p className="font-semibold text-gray-900 capitalize">{payment.status}</p>
              <p className="text-sm text-gray-500 mt-1">
                {payment.status === 'settled' && 'Payment complete. Thank you!'}
                {payment.status === 'confirmed' && 'Payment detected. Processing settlement...'}
                {payment.status === 'settling' && 'Converting to fiat and transferring...'}
                {payment.status === 'failed' && 'Payment failed. Please contact the merchant.'}
                {payment.status === 'expired' && 'This payment request has expired.'}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-4 text-center text-xs text-gray-400">
          Ref: {payment.reference}
        </div>
      </div>
    </div>
  );
}
