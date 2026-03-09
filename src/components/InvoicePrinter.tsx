import React from 'react';
import { Printer, X } from 'lucide-react';

interface InvoicePrinterProps {
  customerName: string;
  date: string;
  service: string;
  amountKz: number;
  transactionId: string;
  onClose?: () => void;
}

const InvoicePrinter: React.FC<InvoicePrinterProps> = ({
  customerName,
  date,
  service,
  amountKz,
  transactionId,
  onClose
}) => {
  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      {/* Invoice Area */}
      <div id="invoice-content" className="invoice-container w-full max-w-[800px] bg-white p-12 border border-slate-100 shadow-sm rounded-sm font-sans text-slate-800 print:m-0 print:p-[2cm] print:shadow-none print:border-none">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-8 mb-8">
          <div>
            <h1 className="text-2xl font-black text-amber-600 uppercase tracking-tighter">Madeira Master</h1>
            <p className="text-xs text-slate-500 font-bold uppercase">Padaria & Pastelaria</p>
            <div className="mt-4 text-sm text-slate-500">
              <p>Rua Principal, Luanda, Angola</p>
              <p>NIF: 5401234567</p>
              <p>+244 923 000 000</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-light text-slate-300 uppercase tracking-widest mb-2">Fatura</h2>
            <p className="text-sm font-bold text-slate-700">ID: {transactionId}</p>
            <p className="text-sm text-slate-500">{new Date(date).toLocaleDateString('pt-AO')}</p>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-12">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Faturado Para:</h3>
          <p className="text-lg font-bold text-slate-800">{customerName}</p>
          <p className="text-sm text-slate-500">Consumidor Final</p>
        </div>

        {/* Table */}
        <table className="w-full mb-12">
          <thead>
            <tr className="text-left border-b-2 border-slate-800">
              <th className="py-4 text-xs font-black uppercase tracking-wider">Descrição do Serviço/Produto</th>
              <th className="py-4 text-right text-xs font-black uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-6">
                <p className="font-bold text-slate-800">{service}</p>
                <p className="text-xs text-slate-400 mt-1">Transação via MCX/Stripe</p>
              </td>
              <td className="py-6 text-right font-bold text-slate-800">
                {amountKz.toLocaleString()} Kz
              </td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-[300px] space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-bold uppercase">Subtotal</span>
              <span className="font-bold">{amountKz.toLocaleString()} Kz</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-bold uppercase">Imposto (0%)</span>
              <span className="font-bold">0 Kz</span>
            </div>
            <div className="flex justify-between items-center pt-4 border-t-2 border-slate-800">
              <span className="text-lg font-black uppercase tracking-tighter">Total Pago</span>
              <span className="text-2xl font-black text-amber-600">{amountKz.toLocaleString()} Kz</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-20 pt-8 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 font-medium">
            Obrigado pela sua preferência! Esta fatura serve como comprovativo de pagamento.
          </p>
          <p className="text-[10px] text-slate-300 mt-2 uppercase tracking-widest">
            Madeira Master - Sistema de Gestão de Padaria
          </p>
        </div>
      </div>

      {/* Actions Area - Hidden during print */}
      <div className="no-print flex items-center gap-4">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-700 transition-all shadow-lg shadow-slate-200 active:scale-95"
        >
          <Printer size={20} />
          Imprimir Fatura
        </button>
        
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95"
          >
            <X size={20} />
            Fechar Fatura
          </button>
        )}
      </div>

      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          html, body, #root {
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          #invoice-content, #invoice-content * {
            visibility: visible !important;
          }
          #invoice-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 2cm !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            z-index: 99999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default InvoicePrinter;
