import React from 'react';
import { Printer, X } from 'lucide-react';

import { CompanyInfo } from '../../types';

interface InvoicePrinterProps {
  customerName: string;
  date: string;
  service: string;
  amountKz: number;
  transactionId: string;
  companyInfo: CompanyInfo;
  onClose?: () => void;
}

const InvoicePrinter: React.FC<InvoicePrinterProps> = ({
  customerName,
  date,
  service,
  amountKz,
  transactionId,
  companyInfo,
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
      <div id="invoice-content" className="invoice-container w-full max-w-[600px] bg-white p-8 border border-slate-100 shadow-sm rounded-sm font-sans text-slate-800 print:m-0 print:p-[1cm] print:shadow-none print:border-none">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
          <div>
            <h1 className="text-xl font-black text-amber-600 uppercase tracking-tighter">{companyInfo.name}</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase">Padaria & Pastelaria</p>
            <div className="mt-3 text-xs text-slate-500">
              <p>{companyInfo.address}</p>
              <p>NIF: {companyInfo.nif}</p>
              <p>{companyInfo.contact}</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-light text-slate-300 uppercase tracking-widest mb-1">Fatura</h2>
            <p className="text-xs font-bold text-slate-700">ID: {transactionId}</p>
            <p className="text-xs text-slate-500">{new Date(date).toLocaleDateString('pt-AO')}</p>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-8">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Faturado Para:</h3>
          <p className="text-base font-bold text-slate-800">{customerName}</p>
          <p className="text-xs text-slate-500">Consumidor Final</p>
        </div>

        {/* Table */}
        <table className="w-full mb-8">
          <thead>
            <tr className="text-left border-b-2 border-slate-800">
              <th className="py-3 text-[10px] font-black uppercase tracking-wider">Descrição</th>
              <th className="py-3 text-right text-[10px] font-black uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-4">
                <p className="text-sm font-bold text-slate-800">{service}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Transação via MCX/Stripe</p>
              </td>
              <td className="py-4 text-right text-sm font-bold text-slate-800">
                {amountKz.toLocaleString()} Kz
              </td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-[240px] space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-bold uppercase">Subtotal</span>
              <span className="font-bold">{amountKz.toLocaleString()} Kz</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-bold uppercase">Imposto (0%)</span>
              <span className="font-bold">0 Kz</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t-2 border-slate-800">
              <span className="text-sm font-black uppercase tracking-tighter">Total Pago</span>
              <span className="text-xl font-black text-amber-600">{amountKz.toLocaleString()} Kz</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Obrigado pela sua preferência!
          </p>
          <p className="text-[9px] text-slate-300 mt-1 uppercase tracking-widest">
            {companyInfo.name} - Sistema de Gestão
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
            display: block !important;
          }
          body * {
            visibility: hidden !important;
          }
          #invoice-content, #invoice-content * {
            visibility: visible !important;
          }
          #invoice-content {
            position: relative !important;
            margin: 1cm auto !important;
            width: 140mm !important;
            padding: 1cm !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            z-index: 99999 !important;
            display: block !important;
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
