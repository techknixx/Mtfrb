import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Search,
  Download,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Printer,
  Calendar,
  Building2,
  Filter,
  ExternalLink,
  Hash,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Layers,
} from 'lucide-react';
import { PaymentRecord, TricycleFranchiseRecord } from '../types';
import { exportPaymentsAsCsv } from '../utils/storage';

interface PaymentDatabaseSectionProps {
  paymentsList: PaymentRecord[];
  franchiseRecords: TricycleFranchiseRecord[];
  onViewRecord?: (record: TricycleFranchiseRecord) => void;
  onDeletePayment: (bodyNumber: string) => void;
  onSyncServer?: () => Promise<void> | void;
  isSyncing?: boolean;
  onShowToast: (type: 'success' | 'error', text: string) => void;
  onPrintReceipt?: (payment: PaymentRecord) => void;
}

export const PaymentDatabaseSection: React.FC<PaymentDatabaseSectionProps> = ({
  paymentsList,
  franchiseRecords,
  onViewRecord,
  onDeletePayment,
  onSyncServer,
  isSyncing = false,
  onShowToast,
  onPrintReceipt,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [deleteConfirmBody, setDeleteConfirmBody] = useState<string | null>(null);
  const [activeReceiptModal, setActiveReceiptModal] = useState<PaymentRecord | null>(null);

  // Map franchise records by body number for quick lookup
  const franchiseMap = useMemo(() => {
    const map = new Map<string, TricycleFranchiseRecord>();
    franchiseRecords.forEach((r) => {
      const clean = r.bodyNumber.replace(/^#+/, '').trim().toUpperCase();
      map.set(clean, r);
    });
    return map;
  }, [franchiseRecords]);

  // Filtered Payments List
  const filteredPayments = useMemo(() => {
    return paymentsList.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        p.bodyNumber.toLowerCase().includes(q) ||
        p.orNumber.toLowerCase().includes(q) ||
        p.applicantName.toLowerCase().includes(q) ||
        (p.payerName && p.payerName.toLowerCase().includes(q)) ||
        (p.cashierName && p.cashierName.toLowerCase().includes(q)) ||
        (p.ticketNumber && p.ticketNumber.toLowerCase().includes(q));

      const matchMethod =
        methodFilter === 'ALL' || (p.paymentMethod || 'CASH') === methodFilter;

      return matchQuery && matchMethod;
    });
  }, [paymentsList, searchQuery, methodFilter]);

  // Summary Metrics
  const totalRevenue = useMemo(() => {
    return paymentsList.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  }, [paymentsList]);

  const totalTransactions = paymentsList.length;

  const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Handle Export CSV
  const handleExportCsv = () => {
    try {
      const filename = exportPaymentsAsCsv(filteredPayments);
      onShowToast('success', `Exported ${filteredPayments.length} payment records as ${filename}`);
    } catch (err) {
      onShowToast('error', 'Failed to export payments CSV spreadsheet.');
    }
  };

  // Handle Export JSON
  const handleExportJson = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(paymentsList, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `MTFRB_Payments_Database_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      onShowToast('success', 'Downloaded complete payments database backup.');
    } catch (err) {
      onShowToast('error', 'Failed to download JSON database.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Revenue Collected
            </div>
            <div className="text-2xl sm:text-3xl font-black text-teal-900 mt-1 font-mono">
              ₱{totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-teal-700 mt-0.5 font-semibold flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Official Municipal Collections
            </div>
          </div>
          <div className="p-3 bg-teal-50 text-teal-800 rounded-xl border border-teal-100">
            <DollarSign className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Recorded Transactions
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 font-mono">
              {totalTransactions}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Connected by Body # to Registry
            </div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
            <CreditCard className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Avg Collection / Unit
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-1 font-mono">
              ₱{averageTransaction.toFixed(2)}
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5 font-medium">
              Standard Fees Assessed
            </div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
            <Hash className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filter, Refresh, Export */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Body #, OR #, Applicant, Payer, or Cashier..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden"
          />
        </div>

        {/* Payment Method Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:ring-2 focus:ring-teal-500 outline-hidden cursor-pointer"
          >
            <option value="ALL">All Methods</option>
            <option value="CASH">Cash</option>
            <option value="GCASH">GCash</option>
            <option value="CHECK">Check</option>
          </select>

          {/* Sync / Refresh */}
          {onSyncServer && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => onSyncServer()}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Sync payments from server database"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-teal-600' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          )}

          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExportJson}
            className="p-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Download payments database as JSON"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">JSON</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Export payments spreadsheet as CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                <th className="py-3.5 px-4">Body Number</th>
                <th className="py-3.5 px-4">Official Receipt (OR) #</th>
                <th className="py-3.5 px-4">Applicant / Payor</th>
                <th className="py-3.5 px-4">Fees Assessed</th>
                <th className="py-3.5 px-4 text-right">Total (PHP)</th>
                <th className="py-3.5 px-4">Method</th>
                <th className="py-3.5 px-4">Cashier</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <DollarSign className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                    <div className="font-semibold text-sm text-slate-600">No Payment Records Found</div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Payments processed at Station 4 will appear here automatically connected by Body Number.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                  const franchise = franchiseMap.get(payment.bodyNumber);
                  return (
                    <tr key={payment.id || payment.bodyNumber} className="hover:bg-slate-50/60 transition-colors">
                      {/* Body Number */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-teal-900 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                            #{payment.bodyNumber}
                          </span>
                          {franchise && onViewRecord && (
                            <button
                              type="button"
                              onClick={() => onViewRecord(franchise)}
                              className="text-slate-400 hover:text-teal-700 cursor-pointer p-0.5"
                              title="View Master Franchise Record"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* OR Number */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-xs text-slate-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                          {payment.orNumber}
                        </div>
                        {payment.ticketNumber && (
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            Ticket: {payment.ticketNumber}
                          </div>
                        )}
                      </td>

                      {/* Applicant / Payor */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{payment.applicantName}</div>
                        {payment.payerName && payment.payerName !== payment.applicantName && (
                          <div className="text-[10px] text-slate-500">Payor: {payment.payerName}</div>
                        )}
                        {franchise?.todaName && (
                          <div className="text-[10px] text-teal-700 font-semibold">{franchise.todaName}</div>
                        )}
                      </td>

                      {/* Fees Assessed */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {(payment.feeBreakdown || []).slice(0, 3).map((f) => (
                            <span
                              key={f.id}
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium"
                            >
                              {f.name}
                            </span>
                          ))}
                          {(payment.feeBreakdown || []).length > 3 && (
                            <span className="px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-[10px] font-bold">
                              +{(payment.feeBreakdown || []).length - 3} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-4 text-right font-mono font-black text-sm text-teal-950">
                        ₱{payment.totalAmount.toFixed(2)}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {payment.paymentMethod || 'CASH'}
                        </span>
                      </td>

                      {/* Cashier */}
                      <td className="py-3 px-4 text-slate-600 font-medium text-[11px]">
                        {payment.cashierName || 'Cashier Officer'}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                        {payment.paidAt || new Date(payment.createdAt).toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Print Dot Matrix Receipt */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReceiptModal(payment);
                              if (onPrintReceipt) onPrintReceipt(payment);
                            }}
                            className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Print Dot Matrix Official Receipt"
                          >
                            <Printer className="w-4 h-4 text-slate-700" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmBody(payment.bodyNumber)}
                            className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Payment Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmBody && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Delete Payment Record?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove the payment record for Body #{deleteConfirmBody}? This will also remove the OR link.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmBody(null)}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeletePayment(deleteConfirmBody);
                  setDeleteConfirmBody(null);
                  onShowToast('success', `Payment record for Body #${deleteConfirmBody} deleted.`);
                }}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Dot Matrix Receipt Modal Preview */}
      {activeReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto print:p-0">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-300 overflow-hidden print:border-none print:shadow-none animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-xs">Official Dot Matrix Receipt Preview</h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceiptModal(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-100 flex justify-center print:p-0 print:bg-white">
              <div
                id="printable-payment-receipt"
                className="w-full max-w-[320px] bg-white p-4 border border-dashed border-slate-300 shadow-xs text-black font-mono text-[11px] leading-tight print:border-none print:shadow-none print:p-1"
                style={{ fontFamily: '"Courier New", Courier, monospace' }}
              >
                <div className="text-center pb-2 border-b border-dashed border-black">
                  <div className="font-bold text-xs">REPUBLIC OF THE PHILIPPINES</div>
                  <div className="font-bold text-xs">MUNICIPALITY OF CASTILLEJOS</div>
                  <div className="text-[10px]">PROVINCE OF ZAMBALES</div>
                  <div className="text-[10px] font-bold mt-1">OFFICE OF THE MUNICIPAL TREASURER</div>
                  <div className="text-[10px]">MUNICIPAL TRICYCLE FRANCHISING BOARD</div>
                  <div className="font-bold text-xs mt-1.5 border border-black py-0.5">
                    OFFICIAL RECEIPT (OR)
                  </div>
                </div>

                <div className="py-2 border-b border-dashed border-black space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>OR NUMBER:</span>
                    <span className="font-bold text-xs">{activeReceiptModal.orNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DATE & TIME:</span>
                    <span>{activeReceiptModal.paidAt || new Date(activeReceiptModal.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>BODY NUMBER:</span>
                    <span className="font-bold text-xs">#{activeReceiptModal.bodyNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TICKET NO:</span>
                    <span>{activeReceiptModal.ticketNumber || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PAYOR:</span>
                    <span className="font-bold truncate max-w-[170px]">{activeReceiptModal.applicantName}</span>
                  </div>
                </div>

                <div className="py-2 border-b border-dashed border-black">
                  <div className="flex justify-between font-bold border-b border-dotted border-black pb-1 mb-1 text-[10px]">
                    <span>PARTICULARS</span>
                    <span>AMOUNT (PHP)</span>
                  </div>
                  <div className="space-y-1">
                    {(activeReceiptModal.feeBreakdown || []).map((fee) => (
                      <div key={fee.id} className="flex justify-between items-center text-[10px]">
                        <span className="truncate pr-1">{fee.name.toUpperCase()}</span>
                        <span className="font-bold shrink-0">{fee.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="py-2 border-b border-dashed border-black space-y-1 text-[11px]">
                  <div className="flex justify-between font-bold text-xs">
                    <span>TOTAL AMOUNT:</span>
                    <span>PHP {activeReceiptModal.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>PAYMENT METHOD:</span>
                    <span>{activeReceiptModal.paymentMethod || 'CASH'}</span>
                  </div>
                  {(activeReceiptModal.amountPaid || 0) > 0 && (
                    <>
                      <div className="flex justify-between text-[10px]">
                        <span>AMOUNT TENDERED:</span>
                        <span>PHP {(activeReceiptModal.amountPaid || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>CHANGE DUE:</span>
                        <span>PHP {(activeReceiptModal.change || 0).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-2 text-center text-[9px] space-y-2">
                  <div className="text-left mt-2">
                    <div>COLLECTING OFFICER:</div>
                    <div className="font-bold text-[10px] mt-0.5">{(activeReceiptModal.cashierName || 'Cashier Officer').toUpperCase()}</div>
                    <div className="text-[9px]">Counter 4 • Castillejos MTFRB</div>
                  </div>
                  <div className="border-t border-dotted border-black pt-1 italic text-[9px]">
                    Thank you for supporting the Municipality of Castillejos!
                  </div>
                  <div className="text-[8px] text-slate-500">
                    * Computer Generated Dot Matrix Receipt *
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 print:hidden">
              <button
                type="button"
                onClick={() => setActiveReceiptModal(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Send to Printer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
