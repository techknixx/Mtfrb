import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  Download, 
  Upload, 
  Trash2, 
  Edit3, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Key, 
  ShieldCheck, 
  UserCheck, 
  Phone, 
  MapPin, 
  Calendar, 
  Clock, 
  Filter, 
  X, 
  RefreshCw,
  HardDrive,
  FileSpreadsheet,
  BadgeAlert,
  Car,
  Check,
  Building2,
  Share2,
  Info,
  Shield,
  QrCode,
  Motorbike,
  Mail,
  ClipboardCheck,
  CreditCard,
  Camera,
  ZoomIn,
  ExternalLink,
  Layers,
  XCircle
} from 'lucide-react';
import { 
  TricycleFranchiseRecord, 
  UserAccount, 
  FranchiseType, 
  getFranchiseTypeLabel,
  TricycleInspectionChecklist,
  PaymentRecord
} from '../types';
import { 
  loadFranchiseRecords, 
  addFranchiseRecord, 
  updateFranchiseRecord, 
  deleteFranchiseRecord,
  exportFranchiseDatabase,
  exportFranchiseRecordsAsCsv,
  loadUsers,
  isBodyNumberInspectionPassed,
  loadAllInspectionsList,
  deleteInspectionChecklist,
  exportInspectionsDatabase,
  exportInspectionsCsv,
  fetchInspectionsFromServer,
  loadAllPaymentsList,
  deletePaymentRecord,
  fetchPaymentsFromServer,
  canAccessPaymentsDatabase
} from '../utils/storage';
import { PhysicalInspectionDataModal } from './PhysicalInspectionDataModal';
import { InspectionDatabaseSection } from './InspectionDatabaseSection';
import { PaymentDatabaseSection } from './PaymentDatabaseSection';
import { MasterProfileAttachmentsSection } from './MasterProfileAttachmentsSection';
import { MTFRB_LOGO } from '../assets/logo';

interface InformationPageProps {
  currentUser: UserAccount | null;
  onRequireLogin?: () => void;
  onNavigateToCounter?: (counterId: number) => void;
}

export const InformationPage: React.FC<InformationPageProps> = ({
  currentUser,
  onRequireLogin,
  onNavigateToCounter,
}) => {
  const [records, setRecords] = useState<TricycleFranchiseRecord[]>(() => loadFranchiseRecords());
  const [usersList] = useState<UserAccount[]>(() => loadUsers());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedToda, setSelectedToda] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [viewRecord, setViewRecord] = useState<TricycleFranchiseRecord | null>(null);
  const [viewingInspectionBody, setViewingInspectionBody] = useState<string | null>(null);
  const [mockCertificateRecord, setMockCertificateRecord] = useState<TricycleFranchiseRecord | null>(null);
  const [showPrintMenu, setShowPrintMenu] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<TricycleFranchiseRecord | null>(null);
  const [deleteConfirmBodyNumber, setDeleteConfirmBodyNumber] = useState<string | null>(null);
  const [printRecord, setPrintRecord] = useState<TricycleFranchiseRecord | null>(null);

  // Dedicated Database Switcher state (Franchise Master Registry, Inspection Checklists, Payments DB)
  const [activeDatabaseTab, setActiveDatabaseTab] = useState<'franchise' | 'inspection' | 'payments'>('franchise');
  
  // Access control: Payments & Collection Database can only be accessed by admin and payments accounts
  const hasPaymentAccess = useMemo(() => {
    return canAccessPaymentsDatabase(currentUser);
  }, [currentUser]);

  // Ensure unauthorized users cannot remain on or access the payments tab
  useEffect(() => {
    if (!hasPaymentAccess && activeDatabaseTab === 'payments') {
      setActiveDatabaseTab('franchise');
    }
  }, [hasPaymentAccess, activeDatabaseTab]);
  const [inspectionsList, setInspectionsList] = useState<TricycleInspectionChecklist[]>(() => loadAllInspectionsList());
  const [paymentsList, setPaymentsList] = useState<PaymentRecord[]>(() => loadAllPaymentsList());
  const [isSyncingPayments, setIsSyncingPayments] = useState<boolean>(false);
  const [inspectionSearchQuery, setInspectionSearchQuery] = useState<string>('');
  const [inspectionStatusFilter, setInspectionStatusFilter] = useState<'ALL' | 'PASSED' | 'FAILED' | 'WITH_PHOTOS'>('ALL');
  const [inspectionTodaFilter, setInspectionTodaFilter] = useState<string>('ALL');
  const [deleteInspectionConfirm, setDeleteInspectionConfirm] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string; bodyNumber: string; slotName: string } | null>(null);
  const [isSyncingInspections, setIsSyncingInspections] = useState<boolean>(false);

  // Form State for Add / Edit
  const [formData, setFormData] = useState<Partial<TricycleFranchiseRecord>>({
    bodyNumber: '',
    operatorName: '',
    contactNumber: '',
    address: '',
    barangay: 'Poblacion',
    driverName: '',
    licenseNumber: '',
    emergencyContact: '',
    make: 'Kawasaki Barako II',
    motorNumber: '',
    chassisNumber: '',
    plateNumber: '',
    colorScheme: 'Blue / Yellow',
    franchiseType: 'RENEWAL',
    permitNumber: '',
    dateGranted: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: 'ACTIVE',
    todaName: 'Castillejos Poblacion TODA',
    routeZone: 'Zone 1 - Town Center to Barangays',
    remarks: 'Compliant with municipal safety inspection and exhaust guidelines.',
    registeredByOfficer: currentUser?.fullName || 'Municipal Administrator',
  });
  const [formError, setFormError] = useState<string>('');

  // Sync when storage changes or realtime event fires
  useEffect(() => {
    const handleSync = () => {
      setRecords(loadFranchiseRecords());
      setInspectionsList(loadAllInspectionsList());
      setPaymentsList(loadAllPaymentsList());
    };

    // Background non-destructive sync with server
    fetchPaymentsFromServer().then((merged) => {
      if (merged) setPaymentsList(loadAllPaymentsList());
    });
    fetchInspectionsFromServer().then((merged) => {
      if (merged) setInspectionsList(loadAllInspectionsList());
    });

    window.addEventListener('franchise_registry_updated', handleSync);
    window.addEventListener('mtfrb_franchise_registry_updated', handleSync);
    window.addEventListener('mtfrb_inspections_db_synced', handleSync);
    window.addEventListener('mtfrb_inspection_saved', handleSync);
    window.addEventListener('mtfrb_inspection_deleted', handleSync);
    window.addEventListener('mtfrb_payments_db_synced', handleSync);
    window.addEventListener('mtfrb_payment_updated', handleSync);
    window.addEventListener('mtfrb_payment_deleted', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('franchise_registry_updated', handleSync);
      window.removeEventListener('mtfrb_franchise_registry_updated', handleSync);
      window.removeEventListener('mtfrb_inspections_db_synced', handleSync);
      window.removeEventListener('mtfrb_inspection_saved', handleSync);
      window.removeEventListener('mtfrb_inspection_deleted', handleSync);
      window.removeEventListener('mtfrb_payments_db_synced', handleSync);
      window.removeEventListener('mtfrb_payment_updated', handleSync);
      window.removeEventListener('mtfrb_payment_deleted', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Distinct TODA list
  const todasList = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.todaName) set.add(r.todaName);
    });
    return Array.from(set).sort();
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return records.filter(record => {
      const matchQuery = 
        !query ||
        record.bodyNumber.toLowerCase().includes(query) ||
        record.operatorName.toLowerCase().includes(query) ||
        (record.driverName && record.driverName.toLowerCase().includes(query)) ||
        (record.plateNumber && record.plateNumber.toLowerCase().includes(query)) ||
        (record.permitNumber && record.permitNumber.toLowerCase().includes(query)) ||
        (record.todaName && record.todaName.toLowerCase().includes(query)) ||
        (record.barangay && record.barangay.toLowerCase().includes(query)) ||
        ((record.emailAddress || record.email) && (record.emailAddress || record.email)!.toLowerCase().includes(query));

      const matchToda = selectedToda === 'ALL' || record.todaName === selectedToda;
      const matchStatus = selectedStatus === 'ALL' || record.status === selectedStatus;

      return matchQuery && matchToda && matchStatus;
    });
  }, [records, searchQuery, selectedToda, selectedStatus]);

  // Summary Metrics for Franchise Registry
  const stats = useMemo(() => {
    const total = records.length;
    const active = records.filter(r => r.status === 'ACTIVE').length;
    const pending = records.filter(r => r.status === 'PENDING').length;
    const expired = records.filter(r => r.status === 'EXPIRED').length;
    return { total, active, pending, expired };
  }, [records]);

  // Filtered Inspections for Inspection Database Tab
  const filteredInspections = useMemo(() => {
    const q = inspectionSearchQuery.trim().toLowerCase();
    return inspectionsList.filter(item => {
      const f = item.connectedFranchise;
      const matchQuery =
        !q ||
        item.bodyNumber.toLowerCase().includes(q) ||
        (item.operatorName && item.operatorName.toLowerCase().includes(q)) ||
        (f?.operatorName && f.operatorName.toLowerCase().includes(q)) ||
        (item.driverName && item.driverName.toLowerCase().includes(q)) ||
        (f?.driverName && f.driverName.toLowerCase().includes(q)) ||
        (item.inspectorName && item.inspectorName.toLowerCase().includes(q)) ||
        (item.plateNumber && item.plateNumber.toLowerCase().includes(q)) ||
        (f?.plateNumber && f.plateNumber.toLowerCase().includes(q)) ||
        (f?.todaName && f.todaName.toLowerCase().includes(q)) ||
        (item.remarks && item.remarks.toLowerCase().includes(q));

      const matchStatus =
        inspectionStatusFilter === 'ALL' ||
        (inspectionStatusFilter === 'PASSED' && item.status === 'PASSED') ||
        (inspectionStatusFilter === 'FAILED' && item.status === 'FAILED') ||
        (inspectionStatusFilter === 'WITH_PHOTOS' && Boolean(item.frontImage || item.oppositeSideImage || item.backImage || item.motorSideImage));

      const matchToda =
        inspectionTodaFilter === 'ALL' ||
        (f?.todaName === inspectionTodaFilter || f?.todaAssociation === inspectionTodaFilter);

      return matchQuery && matchStatus && matchToda;
    });
  }, [inspectionsList, inspectionSearchQuery, inspectionStatusFilter, inspectionTodaFilter]);

  // Summary Metrics for Inspection Database
  const inspectionStats = useMemo(() => {
    const total = inspectionsList.length;
    const passed = inspectionsList.filter(i => i.status === 'PASSED').length;
    const failed = inspectionsList.filter(i => i.status === 'FAILED').length;
    const withPhotos = inspectionsList.filter(i => i.frontImage || i.oppositeSideImage || i.backImage || i.motorSideImage).length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { total, passed, failed, withPhotos, passRate };
  }, [inspectionsList]);

  const handleOpenAdd = () => {
    setFormError('');
    setFormData({
      bodyNumber: '',
      operatorName: '',
      contactNumber: '',
      emailAddress: '',
      address: '',
      barangay: 'Poblacion',
      driverName: '',
      licenseNumber: '',
      emergencyContact: '',
      make: 'Kawasaki Barako II',
      motorNumber: '',
      chassisNumber: '',
      plateNumber: '',
      colorScheme: 'Blue / Yellow',
      franchiseType: 'RENEWAL',
      permitNumber: `MTFRB-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      dateGranted: new Date().toISOString().slice(0, 10),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'ACTIVE',
      todaName: todasList[0] || 'Castillejos Poblacion TODA',
      routeZone: 'Zone 1 - Town Center to Barangays',
      remarks: 'Compliant with municipal safety inspection.',
      registeredByOfficer: currentUser?.fullName || 'Municipal Administrator',
      // Extended regulatory fields
      oldBodyNumber: '',
      oldBodyNo: '',
      caseNumber: '',
      caseNo: '',
      orNumber: '',
      orNo: '',
      crNumber: '',
      crNo: '',
      taxCertificateNumber: '',
      taxCertNo: '',
      taxCertificateAddress: 'Castillejos, Zambales',
      taxCertAddress: 'Castillejos, Zambales',
      taxCertificateDate: new Date().toISOString().slice(0, 10),
      taxCertDate: new Date().toISOString().slice(0, 10),
      // Attachments
      barangayClearanceAttachment: undefined,
      zoneClearanceAttachment: undefined,
      officialReceiptLtoAttachment: undefined,
      certificateOfRegistrationLtoAttachment: undefined,
      taxCertificateCedulaAttachment: undefined,
      driversLicenseAttachment: undefined,
      mtfrbIdAttachment: undefined,
      businessPermitAttachment: undefined,
      birthCertificateAttachment: undefined,
      marriageCertificateAttachment: undefined,
      deedOfSaleAttachment: undefined,
      attachments: {},
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (rec: TricycleFranchiseRecord) => {
    setFormError('');
    setEditingRecord(rec);
    const cleanBody = String(rec.bodyNumber || '').replace(/^#+/, '').trim();
    setFormData({
      ...rec,
      bodyNumber: cleanBody,
      operatorName: rec.operatorName || '',
      contactNumber: rec.contactNumber || '',
      emailAddress: rec.emailAddress || rec.email || '',
      address: rec.address || '',
      barangay: rec.barangay || 'Poblacion',
      driverName: rec.driverName || rec.operatorName || '',
      licenseNumber: rec.licenseNumber || rec.driverLicenseNumber || '',
      emergencyContact: rec.emergencyContact || rec.emergencyContactPhone || '',
      make: rec.make || rec.makeModel || 'Kawasaki Barako II',
      motorNumber: rec.motorNumber || rec.engineNumber || '',
      chassisNumber: rec.chassisNumber || '',
      plateNumber: rec.plateNumber || '',
      colorScheme: rec.colorScheme || rec.color || 'Blue / Yellow',
      franchiseType: rec.franchiseType || 'RENEWAL',
      permitNumber: rec.permitNumber || rec.franchiseNumber || `MTFRB-2026-${cleanBody}`,
      dateGranted: rec.dateGranted || rec.dateIssued || new Date().toISOString().slice(0, 10),
      validUntil: rec.validUntil || rec.expiryDate || '',
      status: (rec.status || rec.franchiseStatus || 'ACTIVE').toUpperCase(),
      todaName: rec.todaName || rec.todaAssociation || todasList[0] || 'Castillejos Poblacion TODA',
      routeZone: rec.routeZone || rec.zone || 'Zone 1',
      remarks: rec.remarks || rec.notes || '',
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
      attachments: rec.attachments || {},
    });
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanBody = (formData.bodyNumber || '').replace(/^#+/, '').trim().toUpperCase();
    if (!cleanBody) {
      setFormError('Body Number is mandatory.');
      return;
    }

    if (!formData.operatorName?.trim()) {
      setFormError('Operator Name is required.');
      return;
    }

    // Check Body Number uniqueness
    const exists = records.some(r => r.bodyNumber.replace(/^#+/, '').trim().toUpperCase() === cleanBody);
    if (exists) {
      setFormError(`Conflict: Body Number "${cleanBody}" is already registered.`);
      return;
    }

    try {
      const newRec: TricycleFranchiseRecord = {
        bodyNumber: cleanBody,
        operatorName: formData.operatorName.trim(),
        contactNumber: formData.contactNumber?.trim() || 'N/A',
        emailAddress: formData.emailAddress?.trim() || '',
        email: formData.emailAddress?.trim() || '',
        address: formData.address?.trim() || 'Castillejos, Zambales',
        barangay: formData.barangay || 'Poblacion',
        driverName: formData.driverName?.trim() || formData.operatorName.trim(),
        licenseNumber: formData.licenseNumber?.trim() || 'N/A',
        emergencyContact: formData.emergencyContact?.trim() || '',
        make: formData.make || 'Motorcycle with Sidecar',
        motorNumber: formData.motorNumber?.trim() || 'ENG-' + cleanBody,
        chassisNumber: formData.chassisNumber?.trim() || 'CHS-' + cleanBody,
        plateNumber: formData.plateNumber?.trim() || 'TC-' + cleanBody,
        colorScheme: formData.colorScheme || 'Blue/Yellow',
        franchiseType: formData.franchiseType || 'RENEWAL',
        permitNumber: formData.permitNumber?.trim() || `MTFRB-2026-${cleanBody}`,
        dateGranted: formData.dateGranted || new Date().toISOString().slice(0, 10),
        validUntil: formData.validUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: formData.status || 'ACTIVE',
        todaName: formData.todaName || 'Castillejos Poblacion TODA',
        routeZone: formData.routeZone || 'Zone 1',
        remarks: formData.remarks?.trim() || '',
        registeredByOfficer: currentUser?.fullName || 'Municipal Staff',
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
        attachments: formData.attachments || {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      addFranchiseRecord(newRec);
      setRecords(loadFranchiseRecords());
      setIsAddModalOpen(false);
      showToast('success', `Franchise Record with Body Number ${cleanBody} successfully registered!`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save record.');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setFormError('');

    if (!formData.operatorName?.trim()) {
      setFormError('Operator Name cannot be empty.');
      return;
    }

    try {
      const cleanBody = String(editingRecord.bodyNumber || '').replace(/^#+/, '').trim();
      updateFranchiseRecord(cleanBody, {
        ...formData,
        operatorName: formData.operatorName.trim(),
        driverName: formData.driverName?.trim() || '',
        contactNumber: formData.contactNumber?.trim() || '',
        emailAddress: formData.emailAddress?.trim() || '',
        email: formData.emailAddress?.trim() || '',
        address: formData.address?.trim() || '',
        barangay: formData.barangay || '',
        licenseNumber: formData.licenseNumber?.trim() || '',
        emergencyContact: formData.emergencyContact?.trim() || '',
        make: formData.make || '',
        motorNumber: formData.motorNumber?.trim() || '',
        chassisNumber: formData.chassisNumber?.trim() || '',
        plateNumber: formData.plateNumber?.trim() || '',
        colorScheme: formData.colorScheme || '',
        franchiseType: formData.franchiseType,
        permitNumber: formData.permitNumber?.trim() || '',
        dateGranted: formData.dateGranted || '',
        validUntil: formData.validUntil || '',
        status: formData.status || 'ACTIVE',
        todaName: formData.todaName || '',
        routeZone: formData.routeZone || '',
        remarks: formData.remarks?.trim() || '',
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
        attachments: formData.attachments || {},
        updatedAt: Date.now(),
      });

      setRecords(loadFranchiseRecords());
      setEditingRecord(null);
      showToast('success', `Record for Body Number ${cleanBody} updated.`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update record.');
    }
  };

  const handleDeleteRecord = (bodyNum: string) => {
    try {
      const cleanBody = String(bodyNum || '').replace(/^#+/, '').trim();
      const updated = deleteFranchiseRecord(cleanBody);
      setRecords(updated);
      setDeleteConfirmBodyNumber(null);
      showToast('success', `Franchise Record for Body Number ${cleanBody} permanently removed.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete record.');
      setDeleteConfirmBodyNumber(null);
    }
  };

  const handleExportJson = () => {
    try {
      const filename = exportFranchiseDatabase();
      showToast('success', `Franchise Database exported: ${filename}`);
    } catch (err: any) {
      showToast('error', 'Export failed: ' + (err.message || 'Error'));
    }
  };

  const handleExportCsv = () => {
    try {
      const filename = exportFranchiseRecordsAsCsv();
      showToast('success', `CSV records exported: ${filename}`);
    } catch (err: any) {
      showToast('error', 'CSV Export failed: ' + (err.message || 'Error'));
    }
  };

  const handleExportInspectionJson = () => {
    try {
      const filename = exportInspectionsDatabase();
      showToast('success', `Inspection Database exported: ${filename}`);
    } catch (err: any) {
      showToast('error', 'Export failed: ' + (err.message || 'Error'));
    }
  };

  const handleExportInspectionCsv = () => {
    try {
      const filename = exportInspectionsCsv();
      showToast('success', `Inspection CSV exported: ${filename}`);
    } catch (err: any) {
      showToast('error', 'CSV Export failed: ' + (err.message || 'Error'));
    }
  };

  const handleDeleteInspectionItem = async (bodyNumber: string) => {
    try {
      deleteInspectionChecklist(bodyNumber);
      setInspectionsList(loadAllInspectionsList());
      setRecords(loadFranchiseRecords());
      setDeleteInspectionConfirm(null);
      showToast('success', `Inspection record for Body #${bodyNumber} permanently removed from database.`);
      
      try {
        await fetch(`/api/inspections/${encodeURIComponent(bodyNumber)}`, { method: 'DELETE' });
      } catch {}
    } catch (err: any) {
      showToast('error', 'Failed to delete inspection: ' + (err.message || 'Error'));
      setDeleteInspectionConfirm(null);
    }
  };

  const handleSyncServerInspections = async () => {
    setIsSyncingInspections(true);
    try {
      await fetchInspectionsFromServer();
      setInspectionsList(loadAllInspectionsList());
      showToast('success', 'Inspection database synchronized with server backend.');
    } catch (err: any) {
      showToast('error', 'Sync failed: ' + (err.message || 'Error'));
    } finally {
      setIsSyncingInspections(false);
    }
  };

  const handleDeletePaymentItem = async (bodyNumber: string) => {
    try {
      deletePaymentRecord(bodyNumber);
      setPaymentsList(loadAllPaymentsList());
      setRecords(loadFranchiseRecords());
      showToast('success', `Payment record for Body #${bodyNumber} removed.`);
      try {
        await fetch(`/api/payments/${encodeURIComponent(bodyNumber)}`, { method: 'DELETE' });
      } catch {}
    } catch (err: any) {
      showToast('error', 'Failed to delete payment: ' + (err.message || 'Error'));
    }
  };

  const handleSyncServerPayments = async () => {
    setIsSyncingPayments(true);
    try {
      await fetchPaymentsFromServer();
      setPaymentsList(loadAllPaymentsList());
      showToast('success', 'Payment database synchronized with server.');
    } catch (err: any) {
      showToast('error', 'Sync failed: ' + (err.message || 'Error'));
    } finally {
      setIsSyncingPayments(false);
    }
  };

  const handlePrint = (rec: TricycleFranchiseRecord) => {
    setMockCertificateRecord(rec);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold border animate-in slide-in-from-bottom-2 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-900 text-emerald-100 border-emerald-700' 
            : 'bg-rose-900 text-rose-100 border-rose-700'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-75 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner Header - Uniform Admin & Profile Gradient Style */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-2xl text-white p-6 sm:p-8 shadow-lg border border-teal-800/60 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-teal-800/80 border-2 border-amber-400/80 text-amber-300 flex items-center justify-center shrink-0 shadow-md">
            <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900">
                Municipal Master Registry
              </span>
              <span className="text-xs text-teal-200 font-semibold">
                MTFRB CASTILLEJOS | PORTAL
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1 text-white">
              Tricycle Franchise Information & Records
            </h1>
            <p className="text-xs sm:text-sm text-teal-100 max-w-xl mt-1">
              Comprehensive database of registered operators, authorized drivers, vehicle specifications, and franchise permits in Castillejos, Zambales.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10 w-full md:w-auto">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-slate-900" />
            <span>Register Franchise</span>
          </button>

          {/* Print Options Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPrintMenu(!showPrintMenu)}
              className="px-3.5 py-2.5 bg-slate-900/80 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-700 shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="Print Options: Official Franchise Certificate or Master Registry"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Print Options</span>
            </button>
            {showPrintMenu && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 text-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowPrintMenu(false);
                    const rec = filteredRecords[0] || records[0];
                    if (rec) handlePrint(rec);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-teal-700 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900">Print Franchise Certificate</div>
                    <div className="text-[10px] text-slate-500">
                      {filteredRecords[0] ? `Body Number ${filteredRecords[0].bodyNumber}` : 'Official Certificate Form'}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrintMenu(false);
                    window.print();
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 flex items-center gap-2.5 border-t border-slate-100 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-teal-700 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900">Print Registry Roster</div>
                    <div className="text-[10px] text-slate-500">Print current filtered records table</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportJson}
            className="px-3.5 py-2.5 bg-teal-800/90 hover:bg-teal-700 text-white text-xs font-bold rounded-xl border border-teal-600/50 shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            title="Download complete franchise registry database as JSON"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>Download DB</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-600/50 shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            title="Export franchise records as CSV spreadsheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Database Switcher Navigation Tabs - Separated Inspection Checklist DB & Main Franchise Registry & Payments DB */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap">
          <button
            type="button"
            onClick={() => setActiveDatabaseTab('franchise')}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeDatabaseTab === 'franchise'
                ? 'bg-white text-teal-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4 text-teal-700" />
            <span>Franchise Master Registry</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeDatabaseTab === 'franchise' ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {records.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDatabaseTab('inspection')}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeDatabaseTab === 'inspection'
                ? 'bg-white text-teal-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 text-amber-600" />
            <span>Inspection Checklist Database</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeDatabaseTab === 'inspection' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {inspectionsList.length}
            </span>
          </button>

          {/* Tab 3: Separated Payments Database (Strictly restricted to Admin and Payments accounts) */}
          {hasPaymentAccess && (
            <button
              type="button"
              onClick={() => setActiveDatabaseTab('payments')}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeDatabaseTab === 'payments'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Payments & Collections Database</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeDatabaseTab === 'payments' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {paymentsList.length}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 px-2">
          <HardDrive className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-600">
            {activeDatabaseTab === 'franchise'
              ? 'Main Franchise Database • Connected via Body #'
              : activeDatabaseTab === 'inspection'
              ? 'Separated Inspection Database • Full Checklists & 4-Angle Photos'
              : hasPaymentAccess
              ? 'Separated Payments Database • Connected via Body # & OR Number'
              : 'Main Franchise Database • Connected via Body #'}
          </span>
        </div>
      </div>

      {/* Conditionally Render: Franchise Master Registry OR Dedicated Inspection Database */}
      {activeDatabaseTab === 'franchise' ? (
        <>
          {/* Metrics Ribbon */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Body Numbers
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {stats.total}
            </div>
            <div className="text-[10px] text-teal-700 font-semibold mt-0.5">
              Registered Municipal Fleet
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Active Franchises
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {stats.active}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
              Certified & Valid Permitted
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pending Renewal / Inspection
            </div>
            <div className="text-2xl font-black text-amber-700 mt-1">
              {stats.pending}
            </div>
            <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
              Processing in Counter Desks
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              TODA Associations
            </div>
            <div className="text-2xl font-black text-indigo-700 mt-1">
              {todasList.length}
            </div>
            <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
              Active Municipal Routes
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Primary Key Search Box */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Body Number, Operator, Driver, Plate..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden font-medium text-slate-900"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
              <Filter className="w-3.5 h-3.5 text-teal-600" />
              <span className="font-semibold text-slate-600">TODA:</span>
              <select
                value={selectedToda}
                onChange={(e) => setSelectedToda(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-hidden cursor-pointer"
              >
                <option value="ALL">All TODAs ({records.length})</option>
                {todasList.map(toda => (
                  <option key={toda} value={toda}>{toda}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
              <span className="font-semibold text-slate-600">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-hidden cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PENDING">PENDING</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="REVOKED">REVOKED</option>
              </select>
            </div>

            {(searchQuery || selectedToda !== 'ALL' || selectedStatus !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedToda('ALL');
                  setSelectedStatus('ALL');
                }}
                className="text-xs text-teal-700 hover:text-teal-900 font-bold px-2 py-1 underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>Franchise Master Records</span>
              <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                {filteredRecords.length} records shown
              </span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Each registered tricycle is uniquely identified by its <strong>Body Number</strong>.
            </p>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active
            </span>
            <span className="flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending
            </span>
            <span className="flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Expired
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4">Body Number</th>
                <th className="py-3 px-4">Operator / Owner</th>
                <th className="py-3 px-4">Driver & License</th>
                <th className="py-3 px-4">Tricycle Specifications</th>
                <th className="py-3 px-4">TODA & Zone</th>
                <th className="py-3 px-4">Status & Validity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">No franchise records found</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try adjusting your search query or TODA filter</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isExpired = new Date(record.validUntil).getTime() < Date.now();
                  const statusBg = 
                    record.status === 'ACTIVE' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                      : record.status === 'PENDING'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200';

                  return (
                    <tr key={record.bodyNumber} className="hover:bg-slate-50/80 transition-colors">
                      {/* Body Number */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-900 to-slate-900 text-amber-300 font-mono font-black text-sm flex items-center justify-center shadow-xs border border-teal-700 shrink-0">
                            {record.bodyNumber}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 text-xs flex items-center gap-1">
                              <span>Body {record.bodyNumber}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Operator Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {record.operatorName}
                        </div>
                        {(record.emailAddress || record.email) && (
                          <div className="text-[11px] text-teal-700 font-medium flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-teal-600 shrink-0" />
                            <span className="truncate max-w-[170px]">{record.emailAddress || record.email}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{record.contactNumber}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Brgy. {record.barangay}</span>
                        </div>
                      </td>

                      {/* Driver & License Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span>{record.driverName || record.operatorName}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          Lic: {record.licenseNumber || 'On Record'}
                        </div>
                      </td>

                      {/* Tricycle Specs */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-slate-500" />
                          <span>{record.make}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          Plate: <span className="font-bold text-slate-700">{record.plateNumber}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Motor: {record.motorNumber}
                        </div>
                      </td>

                      {/* TODA & Zone */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-xs">
                          {record.todaName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {record.routeZone}
                        </div>
                      </td>

                      {/* Status & Validity */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${statusBg}`}>
                          {record.status}
                        </span>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Valid: {record.validUntil}</span>
                        </div>
                        {isExpired && (
                          <span className="text-[9px] font-bold text-rose-600">
                            Overdue Renewal
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View All Details Modal */}
                          <button
                            type="button"
                            onClick={() => setViewRecord(record)}
                            className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                            title="View Complete Information"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Connected Physical Inspection Checklist & Photos */}
                          {(() => {
                            const isPassed = isBodyNumberInspectionPassed(record.bodyNumber);
                            const insp = inspectionsList.find(
                              (i) => i.bodyNumber?.toUpperCase() === record.bodyNumber?.toUpperCase()
                            );
                            const hasPhotos = insp && Boolean(insp.frontImage || insp.oppositeSideImage || insp.backImage || insp.motorSideImage);

                            return (
                              <button
                                type="button"
                                onClick={() => setViewingInspectionBody(record.bodyNumber)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                  isPassed
                                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800'
                                    : insp?.status === 'FAILED'
                                    ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-800'
                                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                }`}
                                title={`Body #${record.bodyNumber}: ${
                                  isPassed 
                                    ? 'Inspection Passed & Roadworthy' 
                                    : insp?.status === 'FAILED' 
                                    ? 'Inspection Failed / Non-compliant' 
                                    : 'Inspection Checklist'
                                } • Click to view checklist & photos`}
                              >
                                <ClipboardCheck className="w-4 h-4" />
                                {hasPhotos && (
                                  <Camera className="w-3 h-3 text-teal-600" />
                                )}
                              </button>
                            );
                          })()}

                          {/* Print Certificate */}
                          <button
                            type="button"
                            onClick={() => setMockCertificateRecord(record)}
                            className="p-1.5 text-slate-500 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                            title="Print Official Franchise Certificate"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(record)}
                            className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Franchise Record"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Delete Record */}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmBodyNumber(record.bodyNumber)}
                            className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Record"
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
    </>
  ) : activeDatabaseTab === 'inspection' ? (
    <InspectionDatabaseSection
      inspectionsList={inspectionsList}
      franchiseRecords={records}
      todasList={todasList}
      onViewInspection={(bodyNumber) => setViewingInspectionBody(bodyNumber)}
      onNavigateToCounter={onNavigateToCounter}
      onDeleteInspection={(bodyNumber) => handleDeleteInspectionItem(bodyNumber)}
      onExportJson={handleExportInspectionJson}
      onExportCsv={handleExportInspectionCsv}
      onSyncServer={handleSyncServerInspections}
      isSyncing={isSyncingInspections}
      onShowToast={showToast}
    />
  ) : hasPaymentAccess ? (
    <PaymentDatabaseSection
      paymentsList={paymentsList}
      franchiseRecords={records}
      onViewRecord={(record) => setViewRecord(record)}
      onDeletePayment={(bodyNumber) => handleDeletePaymentItem(bodyNumber)}
      onSyncServer={handleSyncServerPayments}
      isSyncing={isSyncingPayments}
      onShowToast={showToast}
    />
  ) : null}

      {/* MODAL 1: View Full Record Details - Responsive to All Screen Sizes */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-900 to-slate-900 text-amber-300 font-mono font-black text-base sm:text-lg flex items-center justify-center shadow-md border border-teal-700 shrink-0">
                  {viewRecord.bodyNumber}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">
                      Franchise Master Profile {viewRecord.bodyNumber}
                    </h3>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                    Permit No: <strong className="font-mono text-slate-800">{viewRecord.permitNumber}</strong> • {viewRecord.todaName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewRecord(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Container for perfect mobile/tablet viewport responsiveness */}
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
                    <span className="font-bold text-slate-900 text-sm break-words">{viewRecord.operatorName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Contact Mobile:</span>
                    <span className="font-mono font-bold text-slate-800">{viewRecord.contactNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Email Address (Notifications & Certificate):</span>
                    <span className="font-mono font-bold text-teal-800 break-all">{viewRecord.emailAddress || viewRecord.email || 'None on record'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Registered Barangay:</span>
                    <span className="font-semibold text-slate-800">Brgy. {viewRecord.barangay}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Complete Residential Address:</span>
                    <span className="text-slate-800 break-words">{viewRecord.address}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Driver & Licensing Details */}
              <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Authorized Driver & Licensing Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Authorized Driver Name:</span>
                    <span className="font-bold text-slate-900 break-words">{viewRecord.driverName || viewRecord.operatorName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Driver's License Number:</span>
                    <span className="font-mono font-bold text-slate-800">{viewRecord.licenseNumber || 'Not Stated'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Emergency Contact Person:</span>
                    <span className="text-slate-800 break-words">{viewRecord.emergencyContact || 'Same as Operator'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Associated TODA Association:</span>
                    <span className="font-bold text-indigo-900 break-words">{viewRecord.todaName}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Vehicle Particulars */}
              <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-2 flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-amber-600" />
                  <span>Tricycle Mechanical & Registration Specifications</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Make / Model:</span>
                    <span className="font-bold text-slate-900 break-words">{viewRecord.make}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Plate Number:</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 inline-block">
                      {viewRecord.plateNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Color Scheme:</span>
                    <span className="font-semibold text-slate-800">{viewRecord.colorScheme}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Motor / Engine No.:</span>
                    <span className="font-mono text-slate-700 break-all">{viewRecord.motorNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Chassis No.:</span>
                    <span className="font-mono text-slate-700 break-all">{viewRecord.chassisNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Designated Route Zone:</span>
                    <span className="font-semibold text-slate-800">{viewRecord.routeZone}</span>
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
                      viewRecord.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {viewRecord.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Date Granted:</span>
                    <span className="font-mono text-slate-800">{viewRecord.dateGranted}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Valid Until:</span>
                    <span className="font-mono font-bold text-slate-900">{viewRecord.validUntil}</span>
                  </div>
                  <div className="sm:col-span-3">
                    <span className="text-slate-400 block text-[11px]">Regulatory Remarks:</span>
                    <span className="text-slate-700 italic">{viewRecord.remarks || 'None'}</span>
                  </div>
                </div>
              </div>

              {/* Section 4.5: Official Regulatory, LTO & Tax Certificates */}
              <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <span>Official Regulatory, LTO & Tax Identification</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Old Body No.:</span>
                    <span className="font-mono font-bold text-slate-800">{viewRecord.oldBodyNumber || viewRecord.oldBodyNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Case No.:</span>
                    <span className="font-mono font-bold text-slate-800">{viewRecord.caseNumber || viewRecord.caseNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">O.R No. (LTO):</span>
                    <span className="font-mono font-bold text-slate-800">{viewRecord.orNumber || viewRecord.orNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">C.R No. (LTO):</span>
                    <span className="font-mono font-bold text-slate-800">{viewRecord.crNumber || viewRecord.crNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Tax Cert. No. (Cedula):</span>
                    <span className="font-mono font-bold text-slate-800">{viewRecord.taxCertificateNumber || viewRecord.taxCertNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Tax Cert. Date:</span>
                    <span className="font-mono text-slate-800">{viewRecord.taxCertificateDate || viewRecord.taxCertDate || 'N/A'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block text-[11px]">Tax Cert. Address:</span>
                    <span className="text-slate-800 truncate block">{viewRecord.taxCertificateAddress || viewRecord.taxCertAddress || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Master Profile Attachments */}
              <MasterProfileAttachmentsSection
                record={viewRecord}
                isEditable={false}
              />

              {/* Section 5: Connected Physical Inspection Database Record */}
              <div className="p-3.5 sm:p-4 bg-teal-50/70 rounded-xl border border-teal-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-teal-900 mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-teal-700" />
                    <span>Connected Physical Inspection Checklist (Separated DB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setViewRecord(null);
                      setViewingInspectionBody(viewRecord.bodyNumber);
                    }}
                    className="text-xs text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>View Inspection Details & Photos</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                {(() => {
                  const insp = inspectionsList.find(
                    (i) => i.bodyNumber?.toUpperCase() === viewRecord.bodyNumber?.toUpperCase()
                  );
                  const isPassed = isBodyNumberInspectionPassed(viewRecord.bodyNumber);

                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-slate-700">
                        <div>
                          <span className="text-slate-500 block text-[11px]">Inspection Status:</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isPassed ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {isPassed ? 'PASSED & ROADWORTHY' : insp?.status === 'FAILED' ? 'FAILED' : 'PENDING INSPECTION'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Inspector Officer:</span>
                          <span className="font-semibold text-slate-800">{insp?.inspectorName || viewRecord.inspectorName || 'Carmela Dizon'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Inspection Date:</span>
                          <span className="font-mono text-slate-800">{insp?.inspectionDate || viewRecord.inspectionDate || 'N/A'}</span>
                        </div>
                      </div>

                      {insp && (insp.frontImage || insp.oppositeSideImage || insp.backImage || insp.motorSideImage) && (
                        <div className="pt-2 border-t border-teal-200/70">
                          <div className="text-[11px] font-bold text-teal-900 mb-1.5 flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5 text-teal-700" />
                            <span>Saved 4-Angle Inspection Photos (Server & Local Storage)</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { label: 'Front View', url: insp.frontImage },
                              { label: 'Side View', url: insp.oppositeSideImage },
                              { label: 'Back View', url: insp.backImage },
                              { label: 'Motor View', url: insp.motorSideImage },
                            ].map((p, idx) => (
                              <div key={idx} className="rounded-lg border border-teal-200 bg-white p-1 text-center">
                                {p.url ? (
                                  <img
                                    src={p.url}
                                    alt={p.label}
                                    className="w-full h-14 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => {
                                      setViewRecord(null);
                                      setViewingInspectionBody(viewRecord.bodyNumber);
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-14 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400">
                                    No Photo
                                  </div>
                                )}
                                <span className="text-[9px] font-bold text-slate-600 block mt-1 truncate">{p.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-200 shrink-0">
              <span className="text-[11px] text-slate-400 text-center sm:text-left">
                Body Number: <strong className="font-mono text-slate-700">{viewRecord.bodyNumber}</strong>
              </span>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMockCertificateRecord(viewRecord)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                  title="Print Official Franchise Certificate"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-700" />
                  <span>Print Certificate</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleOpenEdit(viewRecord);
                    setViewRecord(null);
                  }}
                  className="px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Record</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add New Franchise Record */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Register New Tricycle Franchise Record
                  </h3>
                  <p className="text-xs text-slate-500">
                    Body Number is mandatory and unique in the database.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2 my-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAdd} className="space-y-4 text-xs overflow-y-auto pr-1 py-2">
              {/* Body Number Input Field */}
              <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-300/80">
                <label className="block text-xs font-black text-amber-900 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-700" />
                  <span>Body Number *</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.bodyNumber}
                  onChange={(e) => setFormData({ ...formData, bodyNumber: e.target.value })}
                  placeholder="e.g. 042, 118, 205 (Must be unique)"
                  className="w-full px-3 py-2 text-sm font-mono font-black bg-white border border-amber-400 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 outline-hidden uppercase"
                />
                <p className="text-[10px] text-amber-800 mt-1 font-medium">
                  This Body Number uniquely identifies all municipal documents, inspection tickets, and license badges.
                </p>
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
                    placeholder="Full Legal Name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Mobile Number *</label>
                  <input
                    type="text"
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    placeholder="0917-XXXX-XXX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address (For Certificate & Notifications)</label>
                  <input
                    type="email"
                    value={formData.emailAddress || ''}
                    onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
                    placeholder="client@example.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Barangay</label>
                  <select
                    value={formData.barangay}
                    onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 outline-hidden cursor-pointer"
                  >
                    <option value="Poblacion">Poblacion</option>
                    <option value="San Juan">San Juan</option>
                    <option value="Del Pilar">Del Pilar</option>
                    <option value="Nagbunga">Nagbunga</option>
                    <option value="San Nicolas">San Nicolas</option>
                    <option value="San Pablo">San Pablo</option>
                    <option value="Magsaysay">Magsaysay</option>
                    <option value="Santa Maria">Santa Maria</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street / Sitio"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                  />
                </div>
              </div>

              {/* Driver & Vehicle */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Authorized Driver</label>
                  <input
                    type="text"
                    value={formData.driverName}
                    onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                    placeholder="Driver's Full Name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Driver License No.</label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    placeholder="N01-XX-XXXXXX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Plate Number</label>
                  <input
                    type="text"
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
                    placeholder="e.g. TC-8921"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 outline-hidden uppercase"
                  />
                </div>
              </div>

              {/* TODA & Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">TODA Association</label>
                  <input
                    type="text"
                    value={formData.todaName}
                    onChange={(e) => setFormData({ ...formData, todaName: e.target.value })}
                    placeholder="TODA Name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Motorcycle Make</label>
                  <input
                    type="text"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    placeholder="e.g. Kawasaki Barako II"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Color Scheme</label>
                  <input
                    type="text"
                    value={formData.colorScheme}
                    onChange={(e) => setFormData({ ...formData, colorScheme: e.target.value })}
                    placeholder="Blue / Yellow"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                  />
                </div>
              </div>

              {/* Franchise Status & Expiry */}
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

              {/* Master Profile Attachments (11 Upload slots) */}
              <MasterProfileAttachmentsSection
                record={formData as TricycleFranchiseRecord}
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

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 text-amber-300" />
                  <span>Save Franchise Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Record */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Edit Franchise Record {editingRecord.bodyNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Body Number remains fixed as the unique entity identifier.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2 my-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs overflow-y-auto pr-1 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Operator Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.operatorName}
                    onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address (For Certificate & Notifications)</label>
                  <input
                    type="email"
                    value={formData.emailAddress || ''}
                    onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
                    placeholder="client@example.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Authorized Driver</label>
                  <input
                    type="text"
                    value={formData.driverName}
                    onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Driver License No.</label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">TODA Association</label>
                  <input
                    type="text"
                    value={formData.todaName}
                    onChange={(e) => setFormData({ ...formData, todaName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Plate Number</label>
                  <input
                    type="text"
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono uppercase outline-hidden"
                  />
                </div>

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
                    <option value="REVOKED">REVOKED</option>
                  </select>
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

              {/* Master Profile Attachments (11 Upload slots) */}
              <MasterProfileAttachmentsSection
                record={formData as TricycleFranchiseRecord}
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

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Update Franchise</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Confirmation */}
      {deleteConfirmBodyNumber && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Delete Franchise {deleteConfirmBodyNumber}?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will permanently remove the record for Body Number <strong>{deleteConfirmBodyNumber}</strong> from the database.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmBodyNumber(null)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRecord(deleteConfirmBodyNumber)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Interactive Mock Certificate for Franchise Information & Records */}
      {mockCertificateRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
          <div className="max-w-3xl w-full my-auto flex flex-col space-y-3">
            {/* Top Toolbar */}
            <div className="bg-slate-900/90 text-white px-4 py-2.5 rounded-xl flex items-center justify-between shadow-lg border border-slate-700">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Official Printable Franchise Certificate
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {mockCertificateRecord.bodyNumber}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  <span>Print Certificate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMockCertificateRecord(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* The Certificate Frame - Targets #printable-certificate for 100% Crisp Print Output */}
            <div
              id="printable-certificate"
              className="bg-gradient-to-b from-amber-50/90 via-white to-amber-50/70 border-4 border-slate-900 p-5 sm:p-8 rounded-2xl shadow-2xl relative text-slate-900 overflow-hidden print:p-6 print:border-3 print:border-slate-900 print:rounded-none print:shadow-none"
            >
              {/* Ornate Inner Double Border */}
              <div className="border-2 border-dashed border-amber-700/60 p-4 sm:p-6 rounded-xl space-y-5 relative">
                {/* Subtle Background Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none">
                  <img src={MTFRB_LOGO} alt="Seal Watermark" className="w-96 h-96 object-contain" />
                </div>

                {/* Certificate Header */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b-2 border-slate-900 pb-4 text-center sm:text-left">
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

                  <div className="text-center sm:text-right shrink-0">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Body Number</div>
                    <div className="text-xl sm:text-2xl font-mono font-black bg-slate-900 text-amber-300 px-3.5 py-1 rounded-lg shadow-xs mt-0.5">
                      {mockCertificateRecord.bodyNumber}
                    </div>
                    <div className="text-[10px] font-mono font-semibold text-slate-600 mt-1">
                      Permit: {mockCertificateRecord.permitNumber}
                    </div>
                  </div>
                </div>

                {/* Title Banner */}
                <div className="text-center py-2">
                  <div className="inline-block px-4 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest mb-1.5 shadow-2xs">
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
                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-300/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Franchise Holder / Operator:</span>
                    <span className="text-sm font-black text-slate-900 uppercase">{mockCertificateRecord.operatorName}</span>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {mockCertificateRecord.address}, Brgy. {mockCertificateRecord.barangay}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      Mobile: {mockCertificateRecord.contactNumber}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Authorized Driver & Association:</span>
                    <span className="text-sm font-bold text-slate-900">
                      {mockCertificateRecord.driverName || mockCertificateRecord.operatorName}
                    </span>
                    <div className="text-[11px] font-bold text-teal-800 mt-0.5">
                      {mockCertificateRecord.todaName}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      License No: <span className="font-mono font-semibold">{mockCertificateRecord.licenseNumber || 'Verified'}</span> • Zone: {mockCertificateRecord.routeZone}
                    </div>
                  </div>
                </div>

                {/* Vehicle Specifications Grid */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-amber-600" />
                    <span>Registered Vehicle Mechanical Specifications</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-300 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Make / Model</span>
                      <span className="font-bold text-slate-900">{mockCertificateRecord.make}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Plate Number</span>
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block">
                        {mockCertificateRecord.plateNumber}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Color Scheme</span>
                      <span className="font-semibold text-slate-800">{mockCertificateRecord.colorScheme}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Motor / Engine No.</span>
                      <span className="font-mono text-slate-700">{mockCertificateRecord.motorNumber}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Chassis No.</span>
                      <span className="font-mono text-slate-700">{mockCertificateRecord.chassisNumber}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Franchise Type</span>
                      <span className="font-bold text-teal-800">{mockCertificateRecord.franchiseType}</span>
                    </div>
                  </div>
                </div>

                {/* Validity Period & Seal Banner */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-teal-900 text-white rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-300 shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-teal-200">Municipal Validity Period</div>
                      <div className="font-mono font-bold text-amber-300 text-xs sm:text-sm">
                        {mockCertificateRecord.dateGranted} to {mockCertificateRecord.validUntil}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-teal-200">
                      STATUS: <strong className="text-emerald-300 uppercase">{mockCertificateRecord.status}</strong>
                    </span>
                    <div className="p-1 bg-white rounded border border-slate-200">
                      <QrCode className="w-5 h-5 text-slate-900" />
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="pt-4 grid grid-cols-2 gap-6 text-center text-xs">
                  <div className="space-y-1">
                    <div className="h-10 flex items-end justify-center">
                      <span className="font-serif italic text-slate-500 text-sm">Hon. Municipal Mayor</span>
                    </div>
                    <div className="w-40 sm:w-48 mx-auto border-b-2 border-slate-900"></div>
                    <div className="font-bold text-slate-900 uppercase text-xs">HON. MUNICIPAL MAYOR</div>
                    <div className="text-[10px] text-slate-500 font-semibold">Municipal Chief Executive</div>
                  </div>

                  <div className="space-y-1">
                    <div className="h-10 flex items-end justify-center">
                      <span className="font-serif italic text-slate-500 text-sm">Kevin Salonga</span>
                    </div>
                    <div className="w-40 sm:w-48 mx-auto border-b-2 border-slate-900"></div>
                    <div className="font-bold text-slate-900 uppercase text-xs">KEVIN SALONGA</div>
                    <div className="text-[10px] text-slate-500 font-semibold">MTFRB Board Chairman</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Footer (Screen Only) */}
            <div className="flex items-center justify-between px-1 print:hidden">
              <span className="text-[11px] text-slate-400">
                Official Municipal Archive Document • Castillejos, Zambales
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMockCertificateRecord(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  <span>Print Certificate</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Physical Inspection Data Modal */}
      {viewingInspectionBody && (
        <PhysicalInspectionDataModal
          bodyNumber={viewingInspectionBody}
          isOpen={Boolean(viewingInspectionBody)}
          onClose={() => setViewingInspectionBody(null)}
          onDeleteInspection={(bodyNum) => {
            handleDeleteInspectionItem(bodyNum);
            setViewingInspectionBody(null);
          }}
          onSyncServer={handleSyncServerInspections}
        />
      )}
    </div>
  );
};
