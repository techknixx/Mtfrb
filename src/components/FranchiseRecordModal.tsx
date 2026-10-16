import React, { useState } from 'react';
import {
  X,
  UserCheck,
  Phone,
  MapPin,
  Car,
  FileText,
  Calendar,
  ShieldCheck,
  Printer,
  Edit3,
  Check,
  AlertCircle,
  QrCode,
  Key,
} from 'lucide-react';
import { TricycleFranchiseRecord, DocumentAttachment } from '../types';
import { updateFranchiseRecord } from '../utils/storage';
import { MasterProfileAttachmentsSection } from './MasterProfileAttachmentsSection';

const MTFRB_LOGO = 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=150&auto=format&fit=crop&q=80';

export interface FranchiseRecordModalProps {
  record: TricycleFranchiseRecord;
  onClose: () => void;
  allowEdit?: boolean;
  stationName?: string;
  onRecordUpdated?: (updatedRecord: TricycleFranchiseRecord) => void;
  initialMode?: 'view' | 'edit' | 'print';
}

// Helper to normalize any record into safe, guaranteed non-undefined strings with both alias sets populated
function normalizeRecord(rec: TricycleFranchiseRecord): TricycleFranchiseRecord {
  const cleanBody = String(rec.bodyNumber || '').replace(/^#+/, '').trim();
  return {
    ...rec,
    bodyNumber: cleanBody,
    operatorName: rec.operatorName || '',
    contactNumber: rec.contactNumber || '',
    address: rec.address || '',
    barangay: rec.barangay || (rec.address ? rec.address.split(',')[0].replace(/brgy\.?/i, '').trim() : ''),
    driverName: rec.driverName || rec.operatorName || '',
    licenseNumber: rec.licenseNumber || rec.driverLicenseNumber || '',
    driverLicenseNumber: rec.driverLicenseNumber || rec.licenseNumber || '',
    emergencyContact: rec.emergencyContact || rec.emergencyContactPhone || rec.emergencyContactName || '',
    todaName: rec.todaName || rec.todaAssociation || '',
    todaAssociation: rec.todaAssociation || rec.todaName || '',
    make: rec.make || rec.makeModel || '',
    makeModel: rec.makeModel || rec.make || '',
    plateNumber: rec.plateNumber || '',
    motorNumber: rec.motorNumber || rec.engineNumber || '',
    engineNumber: rec.engineNumber || rec.motorNumber || '',
    chassisNumber: rec.chassisNumber || '',
    colorScheme: rec.colorScheme || rec.color || '',
    color: rec.color || rec.colorScheme || '',
    routeZone: rec.routeZone || rec.zone || 'Zone 1',
    zone: (rec.zone || rec.routeZone || 'Zone 1') as any,
    status: (rec.status || rec.franchiseStatus || 'ACTIVE').toUpperCase(),
    franchiseStatus: (rec.franchiseStatus || rec.status || 'ACTIVE').toUpperCase() as any,
    dateGranted: rec.dateGranted || rec.dateIssued || new Date().toISOString().split('T')[0],
    dateIssued: rec.dateIssued || rec.dateGranted || new Date().toISOString().split('T')[0],
    validUntil: rec.validUntil || rec.expiryDate || '',
    expiryDate: rec.expiryDate || rec.validUntil || '',
    remarks: rec.remarks || rec.notes || '',
    notes: rec.notes || rec.remarks || '',
    permitNumber: rec.permitNumber || rec.franchiseNumber || `MTFRB-2026-${cleanBody}`,
    // Extended regulatory fields
    oldBodyNumber: rec.oldBodyNumber || rec.oldBodyNo || '',
    oldBodyNo: rec.oldBodyNo || rec.oldBodyNumber || '',
    caseNumber: rec.caseNumber || rec.caseNo || '',
    caseNo: rec.caseNo || rec.caseNumber || '',
    orNumber: rec.orNumber || rec.orNo || '',
    orNo: rec.orNo || rec.orNumber || '',
    crNumber: rec.crNumber || rec.crNo || '',
    crNo: rec.crNo || rec.crNumber || '',
    taxCertificateNumber: rec.taxCertificateNumber || rec.taxCertNo || '',
    taxCertNo: rec.taxCertNo || rec.taxCertificateNumber || '',
    taxCertificateAddress: rec.taxCertificateAddress || rec.taxCertAddress || '',
    taxCertAddress: rec.taxCertAddress || rec.taxCertificateAddress || '',
    taxCertificateDate: rec.taxCertificateDate || rec.taxCertDate || '',
    taxCertDate: rec.taxCertDate || rec.taxCertificateDate || '',
    // Attachments
    barangayClearanceAttachment: rec.barangayClearanceAttachment,
    zoneClearanceAttachment: rec.zoneClearanceAttachment,
    officialReceiptLtoAttachment: rec.officialReceiptLtoAttachment,
    certificateOfRegistrationLtoAttachment: rec.certificateOfRegistrationLtoAttachment,
    taxCertificateCedulaAttachment: rec.taxCertificateCedulaAttachment,
    driversLicenseAttachment: rec.driversLicenseAttachment,
    mtfrbIdAttachment: rec.mtfrbIdAttachment,
    businessPermitAttachment: rec.businessPermitAttachment,
    birthCertificateAttachment: rec.birthCertificateAttachment,
    marriageCertificateAttachment: rec.marriageCertificateAttachment,
    deedOfSaleAttachment: rec.deedOfSaleAttachment,
    attachments: rec.attachments,
  };
}

export const FranchiseRecordModal: React.FC<FranchiseRecordModalProps> = ({
  record: initialRecord,
  onClose,
  allowEdit = false,
  stationName,
  onRecordUpdated,
  initialMode = 'view',
}) => {
  const [currentRecord, setCurrentRecord] = useState<TricycleFranchiseRecord>(() => normalizeRecord(initialRecord));
  const [isEditing, setIsEditing] = useState<boolean>(initialMode === 'edit');
  const [showPrintCertificate, setShowPrintCertificate] = useState<boolean>(initialMode === 'print');
  const [formData, setFormData] = useState<TricycleFranchiseRecord>(() => normalizeRecord(initialRecord));
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  const handleStartEdit = () => {
    setFormData(normalizeRecord(currentRecord));
    setFormError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData(normalizeRecord(currentRecord));
    setFormError(null);
    setIsEditing(false);
  };

  const handleSaveEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    const cleanOperator = (formData.operatorName || currentRecord.operatorName || 'Registered Operator').trim();
    const cleanContact = (formData.contactNumber || currentRecord.contactNumber || 'N/A').trim();

    try {
      const cleanBody = String(currentRecord.bodyNumber || '').replace(/^#+/, '').trim();
      const updated = updateFranchiseRecord(cleanBody, {
        operatorName: cleanOperator,
        contactNumber: cleanContact,
        address: (formData.address || '').trim(),
        barangay: (formData.barangay || '').trim(),
        driverName: (formData.driverName || '').trim(),
        licenseNumber: (formData.licenseNumber || '').trim(),
        driverLicenseNumber: (formData.licenseNumber || '').trim(),
        emergencyContact: (formData.emergencyContact || '').trim(),
        todaName: (formData.todaName || '').trim(),
        todaAssociation: (formData.todaName || '').trim(),
        make: (formData.make || '').trim(),
        makeModel: (formData.make || '').trim(),
        plateNumber: (formData.plateNumber || '').trim().toUpperCase(),
        motorNumber: (formData.motorNumber || '').trim().toUpperCase(),
        engineNumber: (formData.motorNumber || '').trim().toUpperCase(),
        chassisNumber: (formData.chassisNumber || '').trim().toUpperCase(),
        colorScheme: (formData.colorScheme || '').trim(),
        color: (formData.colorScheme || '').trim(),
        routeZone: (formData.routeZone || '').trim(),
        zone: (formData.routeZone || 'Zone 1') as any,
        status: (formData.status || 'ACTIVE').toUpperCase(),
        franchiseStatus: (formData.status || 'ACTIVE').toUpperCase() as any,
        dateGranted: formData.dateGranted || '',
        dateIssued: formData.dateGranted || '',
        validUntil: formData.validUntil || '',
        expiryDate: formData.validUntil || '',
        remarks: (formData.remarks || '').trim(),
        notes: (formData.remarks || '').trim(),
        // Extended regulatory fields
        oldBodyNumber: (formData.oldBodyNumber || formData.oldBodyNo || '').trim(),
        oldBodyNo: (formData.oldBodyNumber || formData.oldBodyNo || '').trim(),
        caseNumber: (formData.caseNumber || formData.caseNo || '').trim(),
        caseNo: (formData.caseNumber || formData.caseNo || '').trim(),
        orNumber: (formData.orNumber || formData.orNo || '').trim(),
        orNo: (formData.orNumber || formData.orNo || '').trim(),
        crNumber: (formData.crNumber || formData.crNo || '').trim(),
        crNo: (formData.crNumber || formData.crNo || '').trim(),
        taxCertificateNumber: (formData.taxCertificateNumber || formData.taxCertNo || '').trim(),
        taxCertNo: (formData.taxCertificateNumber || formData.taxCertNo || '').trim(),
        taxCertificateAddress: (formData.taxCertificateAddress || formData.taxCertAddress || '').trim(),
        taxCertAddress: (formData.taxCertificateAddress || formData.taxCertAddress || '').trim(),
        taxCertificateDate: formData.taxCertificateDate || formData.taxCertDate || '',
        taxCertDate: formData.taxCertificateDate || formData.taxCertDate || '',
        // Attachments
        barangayClearanceAttachment: formData.barangayClearanceAttachment,
        zoneClearanceAttachment: formData.zoneClearanceAttachment,
        officialReceiptLtoAttachment: formData.officialReceiptLtoAttachment,
        certificateOfRegistrationLtoAttachment: formData.certificateOfRegistrationLtoAttachment,
        taxCertificateCedulaAttachment: formData.taxCertificateCedulaAttachment,
        driversLicenseAttachment: formData.driversLicenseAttachment,
        mtfrbIdAttachment: formData.mtfrbIdAttachment,
        businessPermitAttachment: formData.businessPermitAttachment,
        birthCertificateAttachment: formData.birthCertificateAttachment,
        marriageCertificateAttachment: formData.marriageCertificateAttachment,
        deedOfSaleAttachment: formData.deedOfSaleAttachment,
        attachments: formData.attachments,
        updatedAt: Date.now(),
      });

      const normalized = normalizeRecord(updated);
      setCurrentRecord(normalized);
      setFormData(normalized);
      setIsEditing(false);
      setSaveSuccessNotice(`Franchise Record ${normalized.bodyNumber} verified and saved successfully.`);
      setTimeout(() => setSaveSuccessNotice(null), 4000);
      onRecordUpdated?.(normalized);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to update franchise record.');
    }
  };

  const handlePrintNow = () => {
    setShowPrintCertificate(true);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <>
      {/* Main Details & Edit Modal Dialog */}
      <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto print:hidden">
        <div className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-900 to-slate-900 text-amber-300 font-mono font-black text-base sm:text-lg flex items-center justify-center shadow-md border border-teal-700 shrink-0">
                {currentRecord.bodyNumber}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">
                    {isEditing ? `Edit Franchise Record ${currentRecord.bodyNumber}` : `Franchise Master Profile ${currentRecord.bodyNumber}`}
                  </h3>
                  {stationName && (
                    <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-300">
                      {stationName}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                  Permit No: <strong className="font-mono text-slate-800">{currentRecord.permitNumber}</strong> • {currentRecord.todaName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Close Dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success Notification Banner */}
          {saveSuccessNotice && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 shrink-0 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessNotice}</span>
            </div>
          )}

          {/* Error Notice */}
          {formError && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2 shrink-0 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Body Content: Either View Mode or Edit Mode */}
          {!isEditing ? (
            <div className="overflow-y-auto pr-1 py-3 space-y-3 sm:space-y-4 text-xs">
              {/* Section 1: Operator / Owner Details */}
              <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-teal-800 mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-teal-600" />
                  <span>Franchise Operator (Owner) Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Full Legal Name:</span>
                    <span className="font-bold text-slate-900 text-sm break-words">{currentRecord.operatorName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Contact Mobile:</span>
                    <span className="font-mono font-bold text-slate-800 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {currentRecord.contactNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Registered Barangay:</span>
                    <span className="font-semibold text-slate-800">Brgy. {currentRecord.barangay}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Complete Address:</span>
                    <span className="font-medium text-slate-700 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="break-words">{currentRecord.address}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Authorized Driver & Licensing Details */}
              <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-teal-800 mb-2 flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-teal-600" />
                  <span>Authorized Driver & Licensing Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Authorized Driver Name:</span>
                    <span className="font-bold text-slate-800">{currentRecord.driverName || currentRecord.operatorName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Driver's License No.:</span>
                    <span className="font-mono font-semibold text-slate-800">{currentRecord.licenseNumber || 'Verified on Record'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Associated TODA:</span>
                    <span className="font-bold text-teal-800">{currentRecord.todaName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Emergency Contact Person:</span>
                    <span className="font-medium text-slate-700">{currentRecord.emergencyContact || 'None Listed'}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Tricycle Mechanical & Registration Specifications */}
              <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-teal-800 mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <span>Tricycle Mechanical & Registration Specifications</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Make / Model:</span>
                    <span className="font-bold text-slate-900">{currentRecord.make}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Plate Number:</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-300 inline-block">
                      {currentRecord.plateNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Color Scheme:</span>
                    <span className="font-semibold text-slate-800">{currentRecord.colorScheme}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Motor / Engine No.:</span>
                    <span className="font-mono text-slate-700 break-all">{currentRecord.motorNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Chassis No.:</span>
                    <span className="font-mono text-slate-700 break-all">{currentRecord.chassisNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Designated Route Zone:</span>
                    <span className="font-semibold text-slate-800">{currentRecord.routeZone}</span>
                  </div>
                </div>
              </div>

              {/* Section 4: Franchise Validity & Audit Trail */}
              <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  <span>Municipal Franchise Validity & Officer Verification</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Permit Status:</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                      currentRecord.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {currentRecord.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Date Granted:</span>
                    <span className="font-mono text-slate-800">{currentRecord.dateGranted}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Valid Until:</span>
                    <span className="font-mono font-bold text-slate-900">{currentRecord.validUntil}</span>
                  </div>
                  <div className="sm:col-span-3">
                    <span className="text-slate-400 block text-[11px]">Regulatory Remarks:</span>
                    <span className="text-slate-700 italic">{currentRecord.remarks || 'None'}</span>
                  </div>
                </div>
              </div>

              {/* Section 5: Official Regulatory, LTO & Tax Certificates */}
              <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <span>Official Regulatory, LTO & Tax Identification</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Old Body No.:</span>
                    <span className="font-mono font-bold text-slate-800">{currentRecord.oldBodyNumber || currentRecord.oldBodyNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Case No.:</span>
                    <span className="font-mono font-bold text-slate-800">{currentRecord.caseNumber || currentRecord.caseNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">O.R No. (LTO):</span>
                    <span className="font-mono font-bold text-slate-800">{currentRecord.orNumber || currentRecord.orNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">C.R No. (LTO):</span>
                    <span className="font-mono font-bold text-slate-800">{currentRecord.crNumber || currentRecord.crNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Tax Cert. No. (Cedula):</span>
                    <span className="font-mono font-bold text-slate-800">{currentRecord.taxCertificateNumber || currentRecord.taxCertNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Tax Cert. Date:</span>
                    <span className="font-mono text-slate-800">{currentRecord.taxCertificateDate || currentRecord.taxCertDate || 'N/A'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block text-[11px]">Tax Cert. Address:</span>
                    <span className="text-slate-800 truncate block">{currentRecord.taxCertificateAddress || currentRecord.taxCertAddress || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Section 6: Master Profile Attachments (Clearances, Licenses & IDs) */}
              <MasterProfileAttachmentsSection
                record={currentRecord}
                isEditable={false}
              />
            </div>
          ) : (
            /* EDIT FORM MODE (Verification Station or Admin Edit) */
            <form onSubmit={handleSaveEdit} className="overflow-y-auto pr-1 py-3 space-y-4 text-xs">
              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-teal-950 text-[11px]">
                <strong>Verification & Encoding Correction:</strong> Body Number <span className="font-mono font-bold">{currentRecord.bodyNumber}</span>. Review and correct any verified municipal data below.
              </div>

              {/* Operator Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Operator (Owner) Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.operatorName}
                    onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Registered Barangay</label>
                  <input
                    type="text"
                    value={formData.barangay}
                    onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Driver & TODA */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Authorized Driver Name</label>
                  <input
                    type="text"
                    value={formData.driverName}
                    onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Driver License No.</label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">TODA Association</label>
                  <input
                    type="text"
                    value={formData.todaName}
                    onChange={(e) => setFormData({ ...formData, todaName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-teal-900 outline-hidden"
                  />
                </div>
              </div>

              {/* Vehicle Specifications */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Make / Model</label>
                  <input
                    type="text"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Plate Number</label>
                  <input
                    type="text"
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Color Scheme</label>
                  <input
                    type="text"
                    value={formData.colorScheme}
                    onChange={(e) => setFormData({ ...formData, colorScheme: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Motor / Engine No.</label>
                  <input
                    type="text"
                    value={formData.motorNumber}
                    onChange={(e) => setFormData({ ...formData, motorNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Chassis No.</label>
                  <input
                    type="text"
                    value={formData.chassisNumber}
                    onChange={(e) => setFormData({ ...formData, chassisNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Route Zone</label>
                  <input
                    type="text"
                    value={formData.routeZone}
                    onChange={(e) => setFormData({ ...formData, routeZone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                  />
                </div>
              </div>

              {/* Franchise Status & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Franchise Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 outline-hidden cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING">PENDING</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date Granted</label>
                  <input
                    type="date"
                    value={formData.dateGranted}
                    onChange={(e) => setFormData({ ...formData, dateGranted: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold text-slate-700 mb-1">Regulatory Remarks / Verification Notes</label>
                  <input
                    type="text"
                    value={formData.remarks || ''}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="e.g. Verified by Verification Officer, physical documents match registry."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                  />
                </div>
              </div>

              {/* Extended Regulatory & Tax Information */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-700" />
                  <span>Official Regulatory & Tax Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1 text-[11px]">Old Body No.</label>
                    <input
                      type="text"
                      value={formData.oldBodyNumber || formData.oldBodyNo || ''}
                      onChange={(e) => setFormData({ ...formData, oldBodyNumber: e.target.value, oldBodyNo: e.target.value })}
                      placeholder="e.g. 038"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1 text-[11px]">Case No.</label>
                    <input
                      type="text"
                      value={formData.caseNumber || formData.caseNo || ''}
                      onChange={(e) => setFormData({ ...formData, caseNumber: e.target.value, caseNo: e.target.value })}
                      placeholder="e.g. 2024-C-014"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1 text-[11px]">Official Receipt (LTO O.R) No.</label>
                    <input
                      type="text"
                      value={formData.orNumber || formData.orNo || ''}
                      onChange={(e) => setFormData({ ...formData, orNumber: e.target.value, orNo: e.target.value })}
                      placeholder="e.g. OR-8910234"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1 text-[11px]">Cert. of Registration (LTO C.R) No.</label>
                    <input
                      type="text"
                      value={formData.crNumber || formData.crNo || ''}
                      onChange={(e) => setFormData({ ...formData, crNumber: e.target.value, crNo: e.target.value })}
                      placeholder="e.g. CR-901248"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1 text-[11px]">Tax Certificate (Cedula) No.</label>
                    <input
                      type="text"
                      value={formData.taxCertificateNumber || formData.taxCertNo || ''}
                      onChange={(e) => setFormData({ ...formData, taxCertificateNumber: e.target.value, taxCertNo: e.target.value })}
                      placeholder="e.g. CCI2024-88492"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1 text-[11px]">Tax Certificate Date</label>
                    <input
                      type="date"
                      value={formData.taxCertificateDate || formData.taxCertDate || ''}
                      onChange={(e) => setFormData({ ...formData, taxCertificateDate: e.target.value, taxCertDate: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-600 mb-1 text-[11px]">Tax Certificate Address</label>
                    <input
                      type="text"
                      value={formData.taxCertificateAddress || formData.taxCertAddress || ''}
                      onChange={(e) => setFormData({ ...formData, taxCertificateAddress: e.target.value, taxCertAddress: e.target.value })}
                      placeholder="City/Municipality where cedula was issued"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Master Profile Attachments Section */}
              <MasterProfileAttachmentsSection
                record={formData}
                isEditable={true}
                onUpdateAttachment={(field, att) => {
                  setFormData((prev) => ({
                    ...prev,
                    [field]: att || undefined,
                    attachments: {
                      ...(prev.attachments || {}),
                      [field]: att || undefined,
                    },
                  }));
                }}
              />

              {/* Action Buttons for Edit */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 text-amber-300" />
                  <span>Save Verified Data</span>
                </button>
              </div>
            </form>
          )}

          {/* Modal Footer (When in View Mode) */}
          {!isEditing && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-200 shrink-0">
              <span className="text-[11px] text-slate-400 text-center sm:text-left">
                Body Number: <strong className="font-mono text-slate-700">{currentRecord.bodyNumber}</strong>
              </span>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {/* Printable Certificate (Uses ONLY Printer Icon) */}
                <button
                  type="button"
                  onClick={handlePrintNow}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Print Official Franchise Registration Certificate"
                >
                  <Printer className="w-4 h-4 text-slate-700" />
                  <span>Print Certificate</span>
                </button>

                {/* Edit Button (Available on Verification Station or when allowEdit is true) */}
                {allowEdit && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    title="Edit & Verify Records"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-300" />
                    <span>Edit Record</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Printable Certificate Modal & Print Container */}
      {showPrintCertificate && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[96vh] flex flex-col overflow-y-auto space-y-4 print:p-0 print:border-none print:shadow-none print:max-w-none print:max-h-none print:my-0">
            
            {/* Top Preview Bar (Screen Only) */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 print:hidden shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-teal-700" />
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Official Franchise Certificate Print Preview
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Formatted for official municipal letterhead / A4 certificate paper
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-black rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4 text-amber-300" />
                  <span>Print Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintCertificate(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* The Certificate Frame - Targets #printable-certificate for 100% Crisp Print Quality */}
            <div
              id="printable-certificate"
              className="bg-gradient-to-b from-amber-50/90 via-white to-amber-50/70 border-4 border-slate-900 p-5 sm:p-8 rounded-2xl shadow-2xl relative text-slate-900 overflow-hidden print:p-6 print:border-3 print:border-slate-900 print:rounded-none print:shadow-none"
            >
              {/* Ornate Inner Double Border */}
              <div className="border-2 border-dashed border-amber-700/60 p-4 sm:p-6 rounded-xl space-y-5 relative print:p-4 print:space-y-4">
                {/* Subtle Background Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none print:opacity-[0.03]">
                  <img src={MTFRB_LOGO} alt="Seal Watermark" className="w-96 h-96 object-contain" />
                </div>

                {/* Certificate Header */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b-2 border-slate-900 pb-4 text-center sm:text-left print:flex-row print:text-left">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={MTFRB_LOGO}
                      alt="Castillejos MTFRB Seal"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-md border-2 border-amber-600/80 shrink-0"
                    />
                    <div>
                      <div className="text-[10px] sm:text-xs uppercase font-extrabold tracking-widest text-slate-600">
                        Republic of the Philippines
                      </div>
                      <div className="text-[10px] sm:text-xs uppercase font-bold text-slate-700">
                        Province of Zambales • Municipality of Castillejos
                      </div>
                      <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 tracking-tight">
                        MUNICIPAL TRICYCLE FRANCHISING & REGULATORY BOARD
                      </div>
                      <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">
                        Office of the Municipal Mayor & Sangguniang Bayan
                      </div>
                    </div>
                  </div>

                  <div className="text-center sm:text-right shrink-0 print:text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Body Number</div>
                    <div className="text-xl sm:text-2xl font-mono font-black bg-slate-900 text-amber-300 px-3.5 py-1 rounded-lg shadow-xs mt-0.5 inline-block print:text-slate-950 print:bg-amber-200">
                      {currentRecord.bodyNumber}
                    </div>
                    <div className="text-[10px] font-mono font-semibold text-slate-600 mt-1">
                      Permit: {currentRecord.permitNumber}
                    </div>
                  </div>
                </div>

                {/* Title Banner */}
                <div className="text-center py-1.5">
                  <div className="inline-block px-4 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest mb-1 shadow-2xs">
                    Official Franchise Grant
                  </div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-black tracking-tight text-slate-950 uppercase">
                    Certificate of Public Convenience
                  </h2>
                  <p className="text-xs sm:text-sm font-serif italic text-slate-600 mt-0.5">
                    To Operate Motorized Tricycle-for-Hire Public Transportation Service
                  </p>
                </div>

                {/* Grant Statement */}
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed text-justify indent-6">
                  THIS CERTIFIES that, pursuant to the provisions of the Local Government Code and the Municipal Ordinances of Castillejos, Zambales, authority and regulatory clearance are hereby granted to:
                </p>

                {/* Operator Profile Block */}
                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-300/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs print:bg-white print:border-slate-400">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Franchise Holder / Operator:</span>
                    <span className="text-sm font-black text-slate-900 uppercase">{currentRecord.operatorName}</span>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {currentRecord.address}, Brgy. {currentRecord.barangay}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      Mobile: {currentRecord.contactNumber}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Authorized Driver & Association:</span>
                    <span className="text-sm font-bold text-slate-900">
                      {currentRecord.driverName || currentRecord.operatorName}
                    </span>
                    <div className="text-[11px] font-bold text-teal-800 mt-0.5">
                      {currentRecord.todaName}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      License No: <span className="font-mono font-semibold">{currentRecord.licenseNumber || 'Verified'}</span> • Zone: {currentRecord.routeZone}
                    </div>
                  </div>
                </div>

                {/* Vehicle Specifications Grid */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-amber-600" />
                    <span>Registered Vehicle Mechanical Specifications</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-300 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Make / Model</span>
                      <span className="font-bold text-slate-900">{currentRecord.make}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Plate Number</span>
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block">
                        {currentRecord.plateNumber}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Color Scheme</span>
                      <span className="font-semibold text-slate-800">{currentRecord.colorScheme}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Motor / Engine No.</span>
                      <span className="font-mono text-slate-700">{currentRecord.motorNumber}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Chassis No.</span>
                      <span className="font-mono text-slate-700">{currentRecord.chassisNumber}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Franchise Type</span>
                      <span className="font-bold text-teal-800">{currentRecord.franchiseType}</span>
                    </div>
                  </div>
                </div>

                {/* Validity Period & Seal Banner */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-teal-900 text-white rounded-xl text-xs print:bg-slate-900 print:text-white">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-300 shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-teal-200">Municipal Validity Period</div>
                      <div className="font-mono font-bold text-amber-300 text-xs sm:text-sm">
                        {currentRecord.dateGranted} to {currentRecord.validUntil}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-teal-200">
                      STATUS: <strong className="text-emerald-300 uppercase">{currentRecord.status}</strong>
                    </span>
                    <div className="p-1 bg-white rounded border border-slate-200">
                      <QrCode className="w-5 h-5 text-slate-900" />
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="pt-3 grid grid-cols-2 gap-6 text-center text-xs">
                  <div className="space-y-1">
                    <div className="h-8 flex items-end justify-center">
                      <span className="font-serif italic text-slate-500 text-xs">Hon. Municipal Mayor</span>
                    </div>
                    <div className="w-40 sm:w-48 mx-auto border-b-2 border-slate-900"></div>
                    <div className="font-bold text-slate-900 uppercase text-xs">HON. MUNICIPAL MAYOR</div>
                    <div className="text-[10px] text-slate-500 font-semibold">Municipal Chief Executive</div>
                  </div>

                  <div className="space-y-1">
                    <div className="h-8 flex items-end justify-center">
                      <span className="font-serif italic text-slate-500 text-xs">Kevin Salonga</span>
                    </div>
                    <div className="w-40 sm:w-48 mx-auto border-b-2 border-slate-900"></div>
                    <div className="font-bold text-slate-900 uppercase text-xs">KEVIN SALONGA</div>
                    <div className="text-[10px] text-slate-500 font-semibold">MTFRB Board Chairman</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Bar in Preview (Screen Only) */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 print:hidden shrink-0">
              <span className="text-xs text-slate-500">
                Body Number: <strong className="font-mono text-slate-800">{currentRecord.bodyNumber}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrintCertificate(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-black rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4 text-amber-300" />
                  <span>Print Certificate</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
