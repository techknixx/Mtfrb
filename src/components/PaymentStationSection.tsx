import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Printer,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Calculator,
  RotateCcw,
  Hash,
  ShieldCheck,
  Building2,
  User,
  History,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  Ticket,
  TricycleFranchiseRecord,
  PaymentRecord,
  PaymentFeeItem,
  getFranchiseTypeLabel,
} from '../types';
import {
  getPaymentRecordByBodyNumber,
  savePaymentRecord,
  deletePaymentRecord,
  loadAllPaymentsList,
  loadMunicipalFeesCatalog,
  fetchMunicipalFeesFromServer,
} from '../utils/storage';
import { MTFRB_LOGO } from '../assets/logo';

interface PaymentStationSectionProps {
  currentTicket: Ticket;
  matchingFranchiseRecord: TricycleFranchiseRecord | null;
  cashierOfficerName: string;
  counterId: number;
  onPaymentSaved?: (payment: PaymentRecord) => void;
  onNavigateToRecords?: () => void;
}

export const PaymentStationSection: React.FC<PaymentStationSectionProps> = ({
  currentTicket,
  matchingFranchiseRecord,
  cashierOfficerName,
  counterId,
  onPaymentSaved,
  onNavigateToRecords,
}) => {
  // Resolve unified body number connected to main database
  const bodyNumber = useMemo(() => {
    const raw = (
      currentTicket.bodyNumber ||
      currentTicket.plateOrUnitNumber ||
      matchingFranchiseRecord?.bodyNumber ||
      currentTicket.ticketNumber.replace(/^[A-Z]+-?/i, '')
    ).replace(/^#+/, '').trim().toUpperCase();
    return raw;
  }, [currentTicket, matchingFranchiseRecord]);

  // Form states
  const [orNumber, setOrNumber] = useState<string>('');
  const [selectedFeeIds, setSelectedFeeIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'GCASH' | 'CHECK'>('CASH');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showPrintReceiptModal, setShowPrintReceiptModal] = useState<boolean>(false);
  const [activePaymentRecord, setActivePaymentRecord] = useState<PaymentRecord | null>(null);
  const [feesCatalog, setFeesCatalog] = useState<PaymentFeeItem[]>(() => loadMunicipalFeesCatalog());

  // Keep fees catalog in sync with updates from Admin Page or server
  useEffect(() => {
    fetchMunicipalFeesFromServer().then((serverFees) => {
      if (serverFees && serverFees.length > 0) {
        setFeesCatalog(serverFees);
      }
    });

    const handleFeesUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<PaymentFeeItem[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setFeesCatalog(customEvent.detail);
      } else {
        setFeesCatalog(loadMunicipalFeesCatalog());
      }
    };

    window.addEventListener('mtfrb_fees_catalog_updated', handleFeesUpdated);
    return () => {
      window.removeEventListener('mtfrb_fees_catalog_updated', handleFeesUpdated);
    };
  }, []);

  // Load existing payment record if this body number already has one in the separate payment database
  useEffect(() => {
    if (bodyNumber) {
      const existing = getPaymentRecordByBodyNumber(bodyNumber);
      if (existing) {
        setActivePaymentRecord(existing);
        setOrNumber(existing.orNumber || '');
        setSelectedFeeIds(existing.selectedFeeIds || []);
        if (existing.amountPaid) setAmountPaid(String(existing.amountPaid));
        if (existing.paymentMethod) setPaymentMethod(existing.paymentMethod);
        if (existing.remarks) setRemarks(existing.remarks);
      } else {
        // Municipal fee Checklist are all UNCHECKED by default for new payment sessions
        setActivePaymentRecord(null);
        setSelectedFeeIds([]);
        // Official Receipt Number is Blank by default
        setOrNumber('');
        setAmountPaid('');
        setRemarks('');
      }
    }
  }, [bodyNumber, currentTicket.franchiseType]);

  // Fee calculation using dynamic fees catalog
  const selectedFees = useMemo(() => {
    return feesCatalog.filter((f) => selectedFeeIds.includes(f.id));
  }, [feesCatalog, selectedFeeIds]);

  const totalAmount = useMemo(() => {
    return selectedFees.reduce((sum, item) => sum + item.amount, 0);
  }, [selectedFees]);

  const numericPaid = parseFloat(amountPaid) || 0;
  const changeDue = numericPaid > totalAmount ? numericPaid - totalAmount : 0;

  // Toggle fee checkbox
  const handleToggleFee = (feeId: string) => {
    if (selectedFeeIds.includes(feeId)) {
      setSelectedFeeIds(selectedFeeIds.filter((id) => id !== feeId));
    } else {
      setSelectedFeeIds([...selectedFeeIds, feeId]);
    }
  };

  // Select all or deselect all
  const handleSelectAllFees = () => {
    setSelectedFeeIds(feesCatalog.map((f) => f.id));
  };

  const handleDeselectAllFees = () => {
    setSelectedFeeIds([]);
  };

  // Save payment to dedicated database connected to main DB by bodyNumber
  const handleSavePayment = (autoPrint: boolean = false) => {
    if (!orNumber.trim()) {
      setErrorMessage('Official Receipt (OR) Number is required.');
      return;
    }
    if (selectedFeeIds.length === 0) {
      setErrorMessage('Please check at least one fee from the schedule.');
      return;
    }

    setErrorMessage('');
    const breakdown = selectedFees.map((f) => ({
      id: f.id,
      name: f.name,
      amount: f.amount,
    }));

    const payment: PaymentRecord = {
      id: activePaymentRecord?.id || `PAY-${Date.now()}-${bodyNumber}`,
      bodyNumber: bodyNumber,
      orNumber: orNumber.trim().toUpperCase(),
      ticketNumber: currentTicket.ticketNumber,
      applicantName: currentTicket.applicantName,
      payerName: matchingFranchiseRecord?.operatorName || currentTicket.applicantName,
      selectedFeeIds: selectedFeeIds,
      feeBreakdown: breakdown,
      totalAmount: totalAmount,
      amountPaid: numericPaid || totalAmount,
      change: changeDue,
      paymentMethod: paymentMethod,
      remarks: remarks.trim(),
      cashierName: cashierOfficerName,
      counterId: counterId,
      createdAt: activePaymentRecord?.createdAt || Date.now(),
      paidAt: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };

    savePaymentRecord(payment);
    setActivePaymentRecord(payment);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);

    if (onPaymentSaved) {
      onPaymentSaved(payment);
    }

    if (autoPrint) {
      setShowPrintReceiptModal(true);
      setTimeout(() => {
        window.print();
      }, 300);
    }
  };

  const handleDirectPrint = () => {
    if (!activePaymentRecord) {
      handleSavePayment(true);
    } else {
      setShowPrintReceiptModal(true);
      setTimeout(() => {
        window.print();
      }, 300);
    }
  };

  return (
    <div className="space-y-4">
      {/* Station Title & Link to Main Database */}
      <div className="p-4 bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-2xl text-white shadow-md border border-teal-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-700/70 border border-teal-500/50 rounded-xl text-amber-300">
            <DollarSign className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                Payments Station
              </span>
              <span className="text-xs font-mono font-bold text-teal-200">
                Body #{bodyNumber || 'N/A'}
              </span>
              {activePaymentRecord && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                  Payment Recorded (OR #{activePaymentRecord.orNumber})
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
              Official Municipal Fee Collection & Cashiering
            </h3>
            <p className="text-xs text-teal-100">
              Connected to Master Franchise Registry by Body Number • Records saved to Payments Database
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDirectPrint}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-xs transition-all cursor-pointer"
            title="Print Official Dot Matrix Receipt"
          >
            <Printer className="w-4 h-4 text-slate-950" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>

      {/* Main Database Linked Identity Banner */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-teal-100 text-teal-800 rounded-lg">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">
                Applicant: {currentTicket.applicantName}
              </span>
              <span className="text-slate-500">•</span>
              <span className="font-mono font-bold text-teal-800">
                Body #{bodyNumber}
              </span>
              <span className="px-1.5 py-0.2 bg-teal-50 text-teal-700 border border-teal-200 rounded text-[10px] font-semibold">
                {getFranchiseTypeLabel(currentTicket.franchiseType)}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap items-center gap-2">
              <span>TODA: {matchingFranchiseRecord?.todaName || matchingFranchiseRecord?.todaAssociation || 'Castillejos Central'}</span>
              <span>•</span>
              <span>Plate: {matchingFranchiseRecord?.plateNumber || 'Pending'}</span>
              {matchingFranchiseRecord?.inspectionPassed && (
                <>
                  <span>•</span>
                  <span className="text-emerald-700 font-semibold inline-flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" /> Inspection Passed
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {matchingFranchiseRecord && onNavigateToRecords && (
          <button
            type="button"
            onClick={onNavigateToRecords}
            className="text-xs text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>View Master Record</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Alert Messages */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">
            Payment successfully saved to database! OR #{orNumber} linked to Body #{bodyNumber}.
          </span>
        </div>
      )}

      {/* Grid: Left Column (OR & Fee Checkboxes) | Right Column (Summary & Calculation) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: OR Number and Fee Schedule Checkboxes */}
        <div className="lg:col-span-7 space-y-4">
          {/* OR Number Input Card */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="payment-or-number" className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                Official Receipt (OR) Number <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Form General 25-A</span>
            </div>
            <div className="relative">
              <Hash className="w-4 h-4 text-teal-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="payment-or-number"
                type="text"
                value={orNumber}
                onChange={(e) => setOrNumber(e.target.value.toUpperCase())}
                placeholder="e.g. OR-2026-0042 or 892401"
                className="w-full pl-9 pr-3 py-2.5 text-sm font-mono font-black text-slate-900 bg-white border-2 border-teal-500/60 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-600 outline-hidden placeholder:font-normal placeholder:text-slate-400"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Input the stamped municipal Official Receipt series number issued for this applicant.
            </p>
          </div>

          {/* Fee Schedule Checklist */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                  Municipal Fee Schedule Checklist
                </h4>
                <p className="text-[11px] text-slate-500">
                  Select all applicable fees to compute total assessment.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllFees}
                  className="text-xs text-teal-700 hover:text-teal-900 font-semibold underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllFees}
                  className="text-xs text-slate-500 hover:text-slate-700 font-semibold underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="p-3 divide-y divide-slate-100">
              {feesCatalog.map((fee) => {
                const isChecked = selectedFeeIds.includes(fee.id);
                return (
                  <label
                    key={fee.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-teal-50/60 text-slate-900 font-medium'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleFee(fee.id)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800">
                          {fee.name}
                        </span>
                        {fee.description && (
                          <p className="text-[10px] text-slate-500">
                            {fee.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-xs text-teal-950">
                      ₱{fee.amount.toFixed(2)}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Running Total, Cashier Details & Receipt Actions */}
        <div className="lg:col-span-5 space-y-4">
          {/* Running Total & Tendered Cash Card */}
          <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white rounded-2xl border border-slate-700 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Payment Assessment
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-800 text-teal-200">
                {selectedFees.length} fee{selectedFees.length !== 1 ? 's' : ''} selected
              </span>
            </div>

            {/* Total Display */}
            <div>
              <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                Total Amount Due
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-amber-400 mt-1">
                ₱{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Selected Fee Breakdown List */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-xs space-y-1.5 max-h-40 overflow-y-auto">
              {selectedFees.length === 0 ? (
                <div className="text-slate-500 text-center py-2 text-[11px]">
                  No fees selected. Check items on the schedule.
                </div>
              ) : (
                selectedFees.map((f) => (
                  <div key={f.id} className="flex justify-between items-center text-slate-300 text-[11px]">
                    <span className="truncate pr-2">{f.name}</span>
                    <span className="font-mono text-amber-300 shrink-0">₱{f.amount.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>

            {/* Payment Method & Amount Tendered */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-3 gap-2">
                {(['CASH', 'GCASH', 'CHECK'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-1.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                      paymentMethod === method
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-2xs'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Amount Tendered / Paid (₱)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={`e.g. ${totalAmount.toFixed(2)}`}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-amber-400 outline-hidden"
                />
              </div>

              {numericPaid > 0 && (
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Change Due:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    ₱{changeDue.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => handleSavePayment(false)}
                className="flex-1 py-2.5 px-3 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Payment</span>
              </button>

              <button
                type="button"
                onClick={() => handleSavePayment(true)}
                className="flex-1 py-2.5 px-3 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                title="Save and directly open printer dialog formatted for dot matrix receipt"
              >
                <Printer className="w-4 h-4 text-slate-950" />
                <span>Save & Print</span>
              </button>
            </div>
          </div>

          {/* Cashier Metadata Card */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5 shadow-2xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Cashier Officer:</span>
              <span className="font-bold text-slate-800">{cashierOfficerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Station Counter:</span>
              <span className="font-bold text-teal-800">Counter {counterId} (Payments)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Transaction Date:</span>
              <span className="font-mono text-slate-700">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          DOT MATRIX PRINTABLE RECEIPT (Formatted strictly for 76mm/80mm dot matrix)
          Visible on screen when preview modal is toggled, and always printable
          via @media print #printable-payment-receipt in index.css
         ========================================================================= */}
      {showPrintReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto print:p-0">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-300 overflow-hidden print:border-none print:shadow-none animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-xs">Official Dot Matrix Receipt Preview</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintReceiptModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Printable Receipt Container */}
            <div className="p-4 bg-slate-100 flex justify-center print:p-0 print:bg-white">
              <div
                id="printable-payment-receipt"
                className="w-full max-w-[320px] bg-white p-4 border border-dashed border-slate-300 shadow-xs text-black font-mono text-[11px] leading-tight print:border-none print:shadow-none print:p-1"
                style={{
                  fontFamily: '"Courier New", Courier, monospace',
                }}
              >
                {/* Municipal Header */}
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

                {/* Receipt Metadata */}
                <div className="py-2 border-b border-dashed border-black space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>OR NUMBER:</span>
                    <span className="font-bold text-xs">{orNumber || activePaymentRecord?.orNumber || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DATE & TIME:</span>
                    <span>{activePaymentRecord?.paidAt || new Date().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>BODY NUMBER:</span>
                    <span className="font-bold text-xs">#{bodyNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TICKET NO:</span>
                    <span>{currentTicket.ticketNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PAYOR:</span>
                    <span className="font-bold truncate max-w-[170px]">{currentTicket.applicantName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>FRANCHISE TYPE:</span>
                    <span>{getFranchiseTypeLabel(currentTicket.franchiseType)}</span>
                  </div>
                </div>

                {/* Items & Fees Schedule */}
                <div className="py-2 border-b border-dashed border-black">
                  <div className="flex justify-between font-bold border-b border-dotted border-black pb-1 mb-1 text-[10px]">
                    <span>PARTICULARS</span>
                    <span>AMOUNT (PHP)</span>
                  </div>
                  <div className="space-y-1">
                    {selectedFees.map((fee) => (
                      <div key={fee.id} className="flex justify-between items-center text-[10px]">
                        <span className="truncate pr-1">{fee.name.toUpperCase()}</span>
                        <span className="font-bold shrink-0">{fee.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals and Tender */}
                <div className="py-2 border-b border-dashed border-black space-y-1 text-[11px]">
                  <div className="flex justify-between font-bold text-xs">
                    <span>TOTAL AMOUNT:</span>
                    <span>PHP {totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>PAYMENT METHOD:</span>
                    <span>{paymentMethod}</span>
                  </div>
                  {numericPaid > 0 && (
                    <>
                      <div className="flex justify-between text-[10px]">
                        <span>AMOUNT TENDERED:</span>
                        <span>PHP {numericPaid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>CHANGE DUE:</span>
                        <span>PHP {changeDue.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer Signatures */}
                <div className="pt-2 text-center text-[9px] space-y-2">
                  <div className="text-left mt-2">
                    <div>COLLECTING OFFICER:</div>
                    <div className="font-bold text-[10px] mt-0.5">{cashierOfficerName.toUpperCase()}</div>
                    <div className="text-[9px]">Counter {counterId} • Castillejos MTFRB</div>
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

            {/* Modal Controls */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 print:hidden">
              <button
                type="button"
                onClick={() => setShowPrintReceiptModal(false)}
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
