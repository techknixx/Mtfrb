export type FranchiseType = 'NEW' | 'RENEWAL' | 'CHANGE_MOTOR' | 'DROPPING';

export type PriorityLevel = 'REGULAR' | 'PRIORITY';

export type TicketStatus = 'WAITING' | 'CALLING' | 'SERVING' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';

export type FranchiseZone = 'Zone 1' | 'Zone 2' | 'Zone 3' | 'Zone 4' | 'Zone 5' | 'Zone 6';

export const FRANCHISE_ZONES: FranchiseZone[] = [
  'Zone 1',
  'Zone 2',
  'Zone 3',
  'Zone 4',
  'Zone 5',
  'Zone 6',
];

export type ApplicantClassification = 'Operator' | 'Driver';

export const CLASSIFICATIONS: ApplicantClassification[] = ['Operator', 'Driver'];

export interface RequiredDocument {
  id: string;
  name: string;
  description: string;
  mandatory: boolean;
}

export interface Ticket {
  id: string;
  ticketNumber: string; // e.g. N-101, R-201, CM-301, OD-401
  franchiseType: FranchiseType;
  priorityLevel: PriorityLevel;
  priorityReason?: 'Senior Citizen' | 'Person with Disability (PWD)' | 'Pregnant' | 'Solo Parent with Infant' | 'Other';
  applicantName: string;
  email?: string; // client email for electronic notifications and certificate delivery
  emailAddress?: string; // alias for email
  franchiseNumber?: string; // for renewal / change motor / dropping
  contactNumber?: string;
  bodyNumber?: string; // municipal body number (plate and unit ID removed)
  plateOrUnitNumber?: string; // legacy alias retained for backward compatibility
  classification: ApplicantClassification;
  businessOrTradeName?: string; // legacy support
  zone: FranchiseZone;
  serviceCategory?: string; // legacy support
  status: TicketStatus;
  createdAt: number;
  calledAt?: number;
  servedAt?: number;
  completedAt?: number;
  assignedCounter?: number;
  assignedOfficer?: string;
  verifiedDocuments: string[]; // document ids verified
  inspectionPassed?: boolean; // physical inspection certification status
  inspectionDate?: string;
  inspectorName?: string;
  inspectionChecklist?: TricycleInspectionChecklist;
  notes?: string;
  callCount: number;
}

export interface ServiceCounter {
  id: number;
  name: string;
  officerName: string;
  allowedTypes: FranchiseType[];
  allowPriorityOnly?: boolean;
  currentTicketId: string | null;
  status: 'OPEN' | 'BUSY' | 'ON_BREAK' | 'CLOSED';
}

export interface QueueStatistics {
  totalWaiting: number;
  totalServing: number;
  totalCompleted: number;
  totalNoShow: number;
  newCount: number;
  renewalCount: number;
  changeMotorCount?: number;
  droppingCount?: number;
  priorityCount: number;
  averageWaitMinutes: number;
  averageServiceMinutes: number;
}

export interface QueueAnnouncement {
  id: string;
  ticketId?: string;
  ticketNumber: string;
  bodyNumber?: string;
  counterId: number;
  counterName: string;
  officerName?: string;
  serviceType?: string;
  calledAt: number;
}

export interface TricycleInspectionChecklist {
  bodyNumber: string;
  inspectorName: string;
  inspectionDate: string;
  status: 'PASSED' | 'FAILED';

  // MOTOR & REMARKS
  headlight: 'Functional' | 'Non-Functional';
  signalLights: 'Functional' | 'Non-Functional';
  tailLight: 'Functional' | 'Non-Functional';
  horn: 'Functional' | 'Non-Functional';
  battery: 'Functional' | 'Non-Functional';
  backRideGuard: 'With' | 'Without';
  sideMirrors: 'With' | 'Without';
  muffler: 'Standard' | 'Modified';
  handle: 'Standard' | 'Modified';

  // TIRE SIZE / TYPE
  frontTire: 'Standard' | 'Sub-Standard';
  backTire: 'Standard' | 'Sub-Standard';
  sidecarTire: 'Standard' | 'Sub-Standard';
  wheelCover: 'With' | 'Without';

  // SIDE CAR & REMARKS
  sidecarReflector: 'With' | 'Without';
  backCarrier: 'With' | 'Without';
  backCover: 'With' | 'Without';
  trashCan: 'With' | 'Without';
  sidecarLight: 'Functional' | 'Non-Functional';
  sidecarType: 'Standard' | 'Sub-Standard' | 'Volvo';
  bodyNumberFront: boolean;
  bodyNumberBack: boolean;
  bodyNumberTop: boolean;
  fareMatrix: 'With' | 'Without';
  sidecarColor: 'Blue' | 'Red' | 'Yellow' | 'White' | 'Green' | 'Orange' | string;

  // SIZE (cm)
  sizeHeightCompliant: boolean; // (114 cm)
  sizeWidthCompliant: boolean;  // (73.60 cm)
  clearanceCompliant: boolean;  // (10.5 cm)

  // 4 MANDATORY INSPECTION PHOTOGRAPHS
  frontImage?: string;        // Front view (headlight, windshield, front body number)
  oppositeSideImage?: string; // Opposite side (passenger sidecar view)
  backImage?: string;         // Back view (tail/stop light, plate number, rear body number)
  motorSideImage?: string;    // Motor side view (engine stencil, muffler, side mirror)

  // Client & Vehicle Metadata
  operatorName?: string;
  driverName?: string;
  motorNumber?: string;
  chassisNumber?: string;
  makeModel?: string;
  plateNumber?: string;

  remarks?: string;
  verifiedAt?: number;
}

export function createDefaultInspectionChecklist(
  bodyNumber: string,
  inspectorName: string = 'Carmela Dizon',
  initialStatus: 'PASSED' | 'FAILED' = 'FAILED'
): TricycleInspectionChecklist {
  return {
    bodyNumber,
    inspectorName,
    inspectionDate: new Date().toISOString().slice(0, 10),
    status: initialStatus,
    headlight: 'Functional',
    signalLights: 'Functional',
    tailLight: 'Functional',
    horn: 'Functional',
    battery: 'Functional',
    backRideGuard: 'With',
    sideMirrors: 'With',
    muffler: 'Standard',
    handle: 'Standard',
    frontTire: 'Standard',
    backTire: 'Standard',
    sidecarTire: 'Standard',
    wheelCover: 'With',
    sidecarReflector: 'With',
    backCarrier: 'With',
    backCover: 'With',
    trashCan: 'With',
    sidecarLight: 'Functional',
    sidecarType: 'Standard',
    bodyNumberFront: true,
    bodyNumberBack: true,
    bodyNumberTop: true,
    fareMatrix: 'With',
    sidecarColor: 'Blue',
    sizeHeightCompliant: true,
    sizeWidthCompliant: true,
    clearanceCompliant: true,
    remarks: 'Compliant with MTFRB Castillejos roadworthiness standards.',
    verifiedAt: Date.now(),
  };
}

export const NEW_FRANCHISE_DOCUMENTS: RequiredDocument[] = [
  {
    id: 'doc_brgy_clearance',
    name: 'Barangay Clearance (1 Photocopy)',
    description: 'Valid Barangay Clearance from applicant locality of residence and operation',
    mandatory: true,
  },
  {
    id: 'doc_voters_id',
    name: "Voter's Certificate / Voter's ID (1 Photocopy)",
    description: "Official COMELEC Voter's Certification or active Voter's ID",
    mandatory: true,
  },
  {
    id: 'doc_cedula',
    name: 'Cedula (1 Photocopy)',
    description: 'Community Tax Certificate for the current calendar year',
    mandatory: true,
  },
  {
    id: 'doc_orcr_cert',
    name: 'OR/CR / Certification (1 Photocopy)',
    description: 'LTO Official Receipt & Certificate of Registration or Certification of Unit',
    mandatory: true,
  },
  {
    id: 'doc_orientation_cert',
    name: 'Orientation Certificate',
    description: 'MTFRB Driver and Operator Orientation Seminar Certificate',
    mandatory: true,
  },
  {
    id: 'doc_mtfrb_inspection',
    name: 'MTFRB Inspection Report',
    description: 'Official physical and roadworthiness motor tricycle inspection report',
    mandatory: true,
  },
  {
    id: 'doc_drivers_license',
    name: "Professional Driver's License with code A1, A2 (1 Photocopy)",
    description: "Valid Professional Driver's License of the Tricycle Driver with registration code A1, A2",
    mandatory: true,
  },
];

export const RENEWAL_FRANCHISE_DOCUMENTS: RequiredDocument[] = [
  {
    id: 'doc_brgy_clearance',
    name: 'Barangay Clearance (1 Photocopy)',
    description: 'Current Barangay Clearance from applicant residence and territory',
    mandatory: true,
  },
  {
    id: 'doc_cedula',
    name: 'Cedula (1 Photocopy)',
    description: 'Current Community Tax Certificate for the renewal year',
    mandatory: true,
  },
  {
    id: 'doc_orcr_2copies',
    name: 'OR/CR (2 Photocopy)',
    description: 'Two photocopies of valid LTO Official Receipt and Certificate of Registration',
    mandatory: true,
  },
  {
    id: 'doc_orientation_cert',
    name: 'Orientation Certificate',
    description: 'MTFRB Tricycle Driver/Operator Orientation Seminar Certificate',
    mandatory: true,
  },
  {
    id: 'doc_mtfrb_inspection',
    name: 'MTFRB Inspection Report',
    description: 'Current MTFRB physical vehicle roadworthiness inspection clearance',
    mandatory: true,
  },
  {
    id: 'doc_drivers_license',
    name: "Professional Driver's License with code A1, A2 (1 Photocopy)",
    description: "Valid Professional Driver's License of the designated Tricycle Driver with code A1, A2",
    mandatory: true,
  },
];

export const CHANGE_MOTOR_DOCUMENTS: RequiredDocument[] = [
  {
    id: 'doc_brgy_clearance',
    name: 'Barangay Clearance (1 Photocopy)',
    description: 'Current Barangay Clearance from applicant residence/zone',
    mandatory: true,
  },
  {
    id: 'doc_voters_id',
    name: "Voter's Certificate / Voter's ID (1 Photocopy)",
    description: "COMELEC Voter's ID or active Voter's Certification",
    mandatory: true,
  },
  {
    id: 'doc_cedula',
    name: 'Cedula (1 Photocopy)',
    description: 'Current Community Tax Certificate',
    mandatory: true,
  },
  {
    id: 'doc_old_orcr',
    name: 'Old OR/CR (1 Photocopy)',
    description: 'One photocopy of the previous engine / motorcycle OR/CR',
    mandatory: true,
  },
  {
    id: 'doc_new_orcr_cert',
    name: 'New OR/CR / Certification (2 Photocopy)',
    description: 'Two photocopies of New OR/CR or LTO / Dealer Certification of replacement engine',
    mandatory: true,
  },
  {
    id: 'doc_orientation_cert',
    name: 'Orientation Certificate',
    description: 'MTFRB Orientation Seminar Certificate of completion',
    mandatory: true,
  },
  {
    id: 'doc_mtfrb_inspection',
    name: 'MTFRB Inspection Report',
    description: 'Inspection report certifying engine stencil & vehicle roadworthiness',
    mandatory: true,
  },
  {
    id: 'doc_drivers_license',
    name: "Professional Driver's License with code A1, A2 (1 Photocopy)",
    description: "Valid Professional Driver's License of the Tricycle Driver with code A1, A2",
    mandatory: true,
  },
];

export const DROPPING_DOCUMENTS: RequiredDocument[] = [
  {
    id: 'doc_orcr',
    name: 'OR/CR',
    description: 'Valid or latest LTO Official Receipt and Certificate of Registration',
    mandatory: true,
  },
  {
    id: 'doc_cedula',
    name: 'Cedula',
    description: 'Community Tax Certificate of the franchise holder/owner',
    mandatory: true,
  },
];

export function getDocumentsForType(type: FranchiseType): RequiredDocument[] {
  switch (type) {
    case 'NEW':
      return NEW_FRANCHISE_DOCUMENTS;
    case 'RENEWAL':
      return RENEWAL_FRANCHISE_DOCUMENTS;
    case 'CHANGE_MOTOR':
      return CHANGE_MOTOR_DOCUMENTS;
    case 'DROPPING':
      return DROPPING_DOCUMENTS;
    default:
      return NEW_FRANCHISE_DOCUMENTS;
  }
}

export function getFranchiseTypeLabel(type: FranchiseType): string {
  switch (type) {
    case 'NEW':
      return 'New Franchise';
    case 'RENEWAL':
      return 'Renewal';
    case 'CHANGE_MOTOR':
      return 'Change Motor';
    case 'DROPPING':
      return 'Order for Dropping';
    default:
      return type;
  }
}

export const DEFAULT_COUNTERS: ServiceCounter[] = [
  {
    id: 1,
    name: 'Assessment',
    officerName: 'Maria Santos',
    allowedTypes: ['NEW', 'RENEWAL', 'CHANGE_MOTOR', 'DROPPING'],
    status: 'OPEN',
    currentTicketId: null,
  },
  {
    id: 2,
    name: 'Verification',
    officerName: 'Eduardo Reyes',
    allowedTypes: ['NEW', 'RENEWAL', 'CHANGE_MOTOR', 'DROPPING'],
    status: 'OPEN',
    currentTicketId: null,
  },
  {
    id: 3,
    name: 'Inspection',
    officerName: 'Carmela Dizon',
    allowedTypes: ['NEW', 'RENEWAL', 'CHANGE_MOTOR', 'DROPPING'],
    status: 'OPEN',
    currentTicketId: null,
  },
  {
    id: 4,
    name: 'Payment',
    officerName: 'Jayson Bautista',
    allowedTypes: ['NEW', 'RENEWAL', 'CHANGE_MOTOR', 'DROPPING'],
    status: 'OPEN',
    currentTicketId: null,
  },
  {
    id: 5,
    name: 'Scanning',
    officerName: 'Roberto Diaz',
    allowedTypes: ['NEW', 'RENEWAL', 'CHANGE_MOTOR', 'DROPPING'],
    status: 'OPEN',
    currentTicketId: null,
  },
  {
    id: 6,
    name: 'Encoding',
    officerName: 'Lorna Garcia',
    allowedTypes: ['NEW', 'RENEWAL', 'CHANGE_MOTOR', 'DROPPING'],
    status: 'OPEN',
    currentTicketId: null,
  },
  {
    id: 7,
    name: 'Affixing',
    officerName: 'Arnel Mendoza',
    allowedTypes: ['NEW', 'RENEWAL', 'CHANGE_MOTOR', 'DROPPING'],
    status: 'OPEN',
    currentTicketId: null,
  },
  {
    id: 8,
    name: 'Releasing',
    officerName: 'Teresa Ramos',
    allowedTypes: ['NEW', 'RENEWAL', 'CHANGE_MOTOR', 'DROPPING'],
    status: 'OPEN',
    currentTicketId: null,
  },
];

export type UserRole = 'ADMIN' | 'OFFICER';

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  password?: string;
  assignedCounter?: number;
  contactNumber?: string;
  designation?: string;
  isActive: boolean;
  createdAt: number;
}

export const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'user_admin',
    username: 'admin',
    fullName: 'Kevin Salonga',
    role: 'ADMIN',
    password: 'admin',
    assignedCounter: 1,
    designation: 'Board Chairman / Admin',
    isActive: true,
    createdAt: Date.now() - 30 * 24 * 3600 * 1000,
  },
  {
    id: 'user_officer1',
    username: 'msantos',
    fullName: 'Maria Santos',
    role: 'OFFICER',
    password: '123',
    assignedCounter: 1,
    designation: 'Assessment Officer',
    isActive: true,
    createdAt: Date.now() - 20 * 24 * 3600 * 1000,
  },
  {
    id: 'user_officer2',
    username: 'ereyes',
    fullName: 'Eduardo Reyes',
    role: 'OFFICER',
    password: '123',
    assignedCounter: 2,
    designation: 'Verification Officer',
    isActive: true,
    createdAt: Date.now() - 20 * 24 * 3600 * 1000,
  },
  {
    id: 'user_officer3',
    username: 'cdizon',
    fullName: 'Carmela Dizon',
    role: 'OFFICER',
    password: '123',
    assignedCounter: 3,
    designation: 'Inspection Officer',
    isActive: true,
    createdAt: Date.now() - 15 * 24 * 3600 * 1000,
  },
  {
    id: 'user_officer4',
    username: 'jbautista',
    fullName: 'Jayson Bautista',
    role: 'OFFICER',
    password: '123',
    assignedCounter: 4,
    designation: 'Payment Officer',
    isActive: true,
    createdAt: Date.now() - 10 * 24 * 3600 * 1000,
  },
  {
    id: 'user_officer5',
    username: 'rdiaz',
    fullName: 'Roberto Diaz',
    role: 'OFFICER',
    password: '123',
    assignedCounter: 5,
    designation: 'Scanning Officer',
    isActive: true,
    createdAt: Date.now() - 10 * 24 * 3600 * 1000,
  },
  {
    id: 'user_officer6',
    username: 'lgarcia',
    fullName: 'Lorna Garcia',
    role: 'OFFICER',
    password: '123',
    assignedCounter: 6,
    designation: 'Encoding Officer',
    isActive: true,
    createdAt: Date.now() - 8 * 24 * 3600 * 1000,
  },
  {
    id: 'user_officer7',
    username: 'amendoza',
    fullName: 'Arnel Mendoza',
    role: 'OFFICER',
    password: '123',
    assignedCounter: 7,
    designation: 'Affixing Officer',
    isActive: true,
    createdAt: Date.now() - 6 * 24 * 3600 * 1000,
  },
  {
    id: 'user_officer8',
    username: 'tramos',
    fullName: 'Teresa Ramos',
    role: 'OFFICER',
    password: '123',
    assignedCounter: 8,
    designation: 'Releasing Officer',
    isActive: true,
    createdAt: Date.now() - 5 * 24 * 3600 * 1000,
  },
];

export interface TerminalPasswords {
  kioskPassword: string;
  lobbyTvPassword: string;
}

export const DEFAULT_TERMINAL_PASSWORDS: TerminalPasswords = {
  kioskPassword: 'admin',
  lobbyTvPassword: 'admin',
};

export interface BackupNotificationLog {
  id: string;
  timestamp: number;
  recipients: string[];
  totalTickets: number;
  totalCounters: number;
  fileSizeKb: number;
  status: 'SUCCESS' | 'FAILED';
  source: 'AUTOMATIC_5MIN' | 'MANUAL' | 'TEST_EMAIL';
  message: string;
}

export type AppView = 'kiosk' | 'counter' | 'display' | 'analytics' | 'mobile_tracker' | 'admin' | 'login' | 'profile' | 'information';

export interface BackupConfig {
  autoBackupEnabled: boolean;
  intervalMinutes: number;
  lastBackupTime?: number;
  targetEmail: string; // 'waltermart0427@gmail.com'
  notificationEmails: string[];
  autoDownload: boolean;
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  autoBackupEnabled: true,
  intervalMinutes: 5,
  targetEmail: 'waltermart0427@gmail.com',
  notificationEmails: ['waltermart0427@gmail.com'],
  autoDownload: true,
};

// Document Attachment structure for Master Profile records
export interface DocumentAttachment {
  name: string;
  fileType: string;
  fileSize: number;
  dataUrl: string; // Base64 data URL for preview and download
  uploadedAt: number;
}

export interface AttachmentFieldConfig {
  key: string;
  field: keyof TricycleFranchiseRecord;
  label: string;
  category: 'Clearances & Permits' | 'LTO Motor Documents' | 'Identification & Tax' | 'Civil Registry & Legal';
  description: string;
}

export const MASTER_PROFILE_ATTACHMENT_CONFIGS: AttachmentFieldConfig[] = [
  {
    key: 'barangayClearance',
    field: 'barangayClearanceAttachment',
    label: 'Barangay Clearance',
    category: 'Clearances & Permits',
    description: 'Barangay Clearance certifying residence and local business standing',
  },
  {
    key: 'zoneClearance',
    field: 'zoneClearanceAttachment',
    label: 'Zone Clearance',
    category: 'Clearances & Permits',
    description: 'Zone / Route Clearance certifying assigned tricycle boundary adherence',
  },
  {
    key: 'officialReceiptLto',
    field: 'officialReceiptLtoAttachment',
    label: 'Official Receipt (LTO)',
    category: 'LTO Motor Documents',
    description: 'Land Transportation Office Official Receipt (O.R.)',
  },
  {
    key: 'certificateOfRegistrationLto',
    field: 'certificateOfRegistrationLtoAttachment',
    label: 'Certificate of Registration (LTO)',
    category: 'LTO Motor Documents',
    description: 'Land Transportation Office Certificate of Registration (C.R.)',
  },
  {
    key: 'taxCertificateCedula',
    field: 'taxCertificateCedulaAttachment',
    label: 'Tax Certificate (CEDULA)',
    category: 'Identification & Tax',
    description: 'Community Tax Certificate (Cedula) issued by Municipal Treasurer',
  },
  {
    key: 'driversLicense',
    field: 'driversLicenseAttachment',
    label: "Professional Driver's License",
    category: 'Identification & Tax',
    description: "LTO Professional Driver's License with official receipt",
  },
  {
    key: 'mtfrbId',
    field: 'mtfrbIdAttachment',
    label: 'MTFRB ID',
    category: 'Identification & Tax',
    description: 'MTFRB Operator / Driver Identification Card',
  },
  {
    key: 'businessPermit',
    field: 'businessPermitAttachment',
    label: 'Business Permit',
    category: 'Clearances & Permits',
    description: "Mayor's / Municipal Business Permit for tricycle operation",
  },
  {
    key: 'birthCertificate',
    field: 'birthCertificateAttachment',
    label: 'Birth Certificate',
    category: 'Civil Registry & Legal',
    description: 'PSA / Local Civil Registry Authenticated Birth Certificate',
  },
  {
    key: 'marriageCertificate',
    field: 'marriageCertificateAttachment',
    label: 'Marriage Certificate',
    category: 'Civil Registry & Legal',
    description: 'PSA / Local Civil Registry Marriage Certificate (if applicable)',
  },
  {
    key: 'deedOfSale',
    field: 'deedOfSaleAttachment',
    label: 'Deed of Sale',
    category: 'Civil Registry & Legal',
    description: 'Notarized Deed of Absolute Sale (for transferred units or change of motor)',
  },
];

// Tricycle Franchise Database Record with Body Number as PRIMARY KEY
export interface TricycleFranchiseRecord {
  bodyNumber: string; // PRIMARY KEY (Unique Municipal Identifier, e.g. "001", "042", "104")
  franchiseNumber?: string; // Official MTFRB Franchise Number (e.g. "MTFRB-2024-001")
  
  // User / Operator (Owner) Details
  operatorName: string;
  contactNumber?: string;
  emailAddress?: string;
  email?: string; // alias for emailAddress
  address?: string; // Barangay & Municipality (e.g. "Brgy. Del Pilar, Castillejos, Zambales")
  classification?: ApplicantClassification; // 'Operator' | 'Driver'
  dateOfBirth?: string;
  civilStatus?: 'Single' | 'Married' | 'Widowed' | 'Separated';
  emergencyContactName?: string;
  emergencyContactPhone?: string;

  // Designated Driver Details
  driverName?: string;
  driverLicenseNumber?: string;
  driverLicenseExpiry?: string;
  driverContactNumber?: string;
  driverAddress?: string;

  // Franchise Regulatory & Route Details
  franchiseType?: FranchiseType; // 'NEW' | 'RENEWAL' | 'CHANGE_MOTOR' | 'DROPPING'
  franchiseStatus?: 'ACTIVE' | 'FOR_RENEWAL' | 'EXPIRED' | 'SUSPENDED' | 'DROPPED';
  zone?: FranchiseZone; // 'Zone 1' through 'Zone 6'
  todaAssociation?: string; // e.g. "CASTODA - Castillejos Tricycle Operators & Drivers Association"
  dateIssued?: string; // YYYY-MM-DD
  expiryDate?: string; // YYYY-MM-DD

  // Motor Vehicle Specifications
  plateNumber?: string; // LTO Plate or MV File Number
  engineNumber?: string;
  chassisNumber?: string;
  makeModel?: string; // e.g. "Honda TMX 125", "Kawasaki Barako 175"
  yearModel?: string; // e.g. "2023"
  color?: string; // e.g. "Red / White"
  stickerNumber?: string; // Annual MTFRB Inspection Sticker Serial

  // Compliance & Inspection Records
  verifiedDocuments?: string[];
  inspectionPassed?: boolean;
  inspectionDate?: string;
  inspectorName?: string;
  inspectionChecklist?: TricycleInspectionChecklist;
  violationsHistory?: string[];
  notes?: string;

  // Master Profile Extended Regulatory & Legal Fields (User Request)
  oldBodyNumber?: string; // 1. Old Body No.
  oldBodyNo?: string;
  caseNumber?: string; // 2. Case No.
  caseNo?: string;
  orNumber?: string; // 3. O.R No. (Official Receipt)
  orNo?: string;
  latestPaymentDate?: string;
  latestPaymentAmount?: number;
  crNumber?: string; // 4. C.R No. (Certificate of Registration)
  crNo?: string;
  taxCertificateNumber?: string; // 5. Tax Certificate No. (Cedula)
  taxCertNo?: string;
  taxCertificateAddress?: string; // 6. Tax Certificate Address
  taxCertAddress?: string;
  taxCertificateDate?: string; // 7. Tax Certificate Date
  taxCertDate?: string;

  // Master Profile Document Attachments for Upload (User Request 8 - 18)
  barangayClearanceAttachment?: DocumentAttachment; // 8. Barangay Clearance
  zoneClearanceAttachment?: DocumentAttachment; // 9. Zone Clearance
  officialReceiptLtoAttachment?: DocumentAttachment; // 10. Official Receipt (LTO)
  certificateOfRegistrationLtoAttachment?: DocumentAttachment; // 11. Certificate of Registration (LTO)
  taxCertificateCedulaAttachment?: DocumentAttachment; // 12. Tax Certificate (CEDULA)
  driversLicenseAttachment?: DocumentAttachment; // 13. Professional Driver's License
  mtfrbIdAttachment?: DocumentAttachment; // 14. MTFRB ID
  businessPermitAttachment?: DocumentAttachment; // 15. Business Permit
  birthCertificateAttachment?: DocumentAttachment; // 16. Birth Certificate
  marriageCertificateAttachment?: DocumentAttachment; // 17. Marriage Certificate
  deedOfSaleAttachment?: DocumentAttachment; // 18. Deed of Sale
  attachments?: Record<string, DocumentAttachment>;

  // Flexible convenience aliases
  barangay?: string;
  make?: string;
  motorNumber?: string;
  colorScheme?: string;
  permitNumber?: string;
  dateGranted?: string;
  validUntil?: string;
  status?: string;
  todaName?: string;
  routeZone?: string;
  remarks?: string;
  registeredByOfficer?: string;
  emergencyContact?: string;
  licenseNumber?: string;

  // Audit Metadata
  createdAt: number;
  updatedAt: number;
  lastUpdatedBy?: string;
}

export const DEFAULT_FRANCHISE_RECORDS: TricycleFranchiseRecord[] = [
  {
    bodyNumber: '001',
    franchiseNumber: 'MTFRB-2024-0001',
    operatorName: 'Juan Dela Cruz',
    contactNumber: '0917-555-0101',
    emailAddress: 'juan.delacruz@gmail.com',
    address: 'Brgy. Del Pilar, Castillejos, Zambales',
    classification: 'Operator',
    dateOfBirth: '1978-05-14',
    civilStatus: 'Married',
    emergencyContactName: 'Maria Dela Cruz (Spouse)',
    emergencyContactPhone: '0918-555-0102',
    driverName: 'Juan Dela Cruz',
    driverLicenseNumber: 'D01-98-123456',
    driverLicenseExpiry: '2027-05-14',
    driverContactNumber: '0917-555-0101',
    driverAddress: 'Brgy. Del Pilar, Castillejos, Zambales',
    franchiseType: 'RENEWAL',
    franchiseStatus: 'ACTIVE',
    zone: 'Zone 1',
    todaAssociation: 'DELPTODA (Del Pilar Tricycle Operators & Drivers Association)',
    dateIssued: '2024-01-15',
    expiryDate: '2025-01-15',
    plateNumber: '1234-AB',
    engineNumber: 'TMX125E-9876543',
    chassisNumber: 'TMX125C-1234567',
    makeModel: 'Honda TMX 125 Alpha',
    yearModel: '2022',
    color: 'Red / White',
    stickerNumber: 'STK-2024-0001',
    oldBodyNumber: '001-A',
    caseNumber: 'CASE-2024-0001',
    orNumber: 'OR-89217823',
    crNumber: 'CR-10293847',
    taxCertificateNumber: 'CTC-2024-00129',
    taxCertificateAddress: 'Brgy. Del Pilar, Castillejos, Zambales',
    taxCertificateDate: '2024-01-08',
    verifiedDocuments: ['doc_brgy_clearance', 'doc_cedula', 'doc_orcr_2copies', 'doc_drivers_license'],
    inspectionPassed: true,
    inspectionDate: '2024-01-12',
    inspectorName: 'SPO1 R. Villanueva',
    violationsHistory: [],
    notes: 'Unit in pristine mechanical condition. Complete safety sidecar accessories.',
    createdAt: 1705276800000,
    updatedAt: 1705276800000,
    lastUpdatedBy: 'Admin Kevin Salonga',
  },
  {
    bodyNumber: '014',
    franchiseNumber: 'MTFRB-2024-0014',
    operatorName: 'Ramonito Santos',
    contactNumber: '0920-555-0214',
    emailAddress: 'ramon.santos@yahoo.com',
    address: 'Brgy. San Agustin, Castillejos, Zambales',
    classification: 'Operator',
    dateOfBirth: '1982-11-20',
    civilStatus: 'Married',
    emergencyContactName: 'Elena Santos',
    emergencyContactPhone: '0921-555-0215',
    driverName: 'Danilo Ramos',
    driverLicenseNumber: 'D02-05-654321',
    driverLicenseExpiry: '2026-11-20',
    driverContactNumber: '0922-555-0216',
    driverAddress: 'Brgy. San Agustin, Castillejos, Zambales',
    franchiseType: 'RENEWAL',
    franchiseStatus: 'ACTIVE',
    zone: 'Zone 2',
    todaAssociation: 'SANAGUSTODA (San Agustin TODA)',
    dateIssued: '2024-02-10',
    expiryDate: '2025-02-10',
    plateNumber: '5678-CD',
    engineNumber: 'BC175E-1122334',
    chassisNumber: 'BC175C-9988776',
    makeModel: 'Kawasaki Barako II 175',
    yearModel: '2021',
    color: 'Green / Black',
    stickerNumber: 'STK-2024-0014',
    oldBodyNumber: '014-OLD',
    caseNumber: 'CASE-2024-0014',
    orNumber: 'OR-67489211',
    crNumber: 'CR-90812345',
    taxCertificateNumber: 'CTC-2024-00561',
    taxCertificateAddress: 'Brgy. San Agustin, Castillejos, Zambales',
    taxCertificateDate: '2024-02-01',
    verifiedDocuments: ['doc_brgy_clearance', 'doc_cedula', 'doc_orcr_2copies'],
    inspectionPassed: true,
    inspectionDate: '2024-02-08',
    inspectorName: 'Insp. M. Bautista',
    violationsHistory: [],
    notes: 'Sidecar passenger grab bars and headlamp high-beam functional.',
    createdAt: 1707523200000,
    updatedAt: 1707523200000,
    lastUpdatedBy: 'Admin Kevin Salonga',
  },
  {
    bodyNumber: '042',
    franchiseNumber: 'MTFRB-2024-0042',
    operatorName: 'Eduardo M. Perez',
    contactNumber: '0919-555-0342',
    emailAddress: 'ed.perez77@gmail.com',
    address: 'Brgy. San Nicolas, Castillejos, Zambales',
    classification: 'Operator',
    dateOfBirth: '1975-03-08',
    civilStatus: 'Married',
    emergencyContactName: 'Lourdes Perez',
    emergencyContactPhone: '0919-555-0343',
    driverName: 'Eduardo M. Perez',
    driverLicenseNumber: 'D01-95-778899',
    driverLicenseExpiry: '2028-03-08',
    driverContactNumber: '0919-555-0342',
    driverAddress: 'Brgy. San Nicolas, Castillejos, Zambales',
    franchiseType: 'RENEWAL',
    franchiseStatus: 'FOR_RENEWAL',
    zone: 'Zone 3',
    todaAssociation: 'SANNICTODA (San Nicolas TODA)',
    dateIssued: '2023-10-18',
    expiryDate: '2024-10-18',
    plateNumber: '8910-EF',
    engineNumber: 'YTX125E-4455667',
    chassisNumber: 'YTX125C-7788990',
    makeModel: 'Yamaha YTX 125',
    yearModel: '2020',
    color: 'Blue / Silver',
    stickerNumber: 'STK-2023-0042',
    oldBodyNumber: '042-OLD',
    caseNumber: 'CASE-2023-0042',
    orNumber: 'OR-55441290',
    crNumber: 'CR-88771122',
    taxCertificateNumber: 'CTC-2023-00892',
    taxCertificateAddress: 'Brgy. San Nicolas, Castillejos, Zambales',
    taxCertificateDate: '2023-10-10',
    verifiedDocuments: ['doc_brgy_clearance', 'doc_cedula'],
    inspectionPassed: true,
    inspectionDate: '2023-10-15',
    inspectorName: 'SPO1 R. Villanueva',
    violationsHistory: ['2023-12-05: Minor route overrun - Warning issued and settled'],
    notes: 'Due for annual municipal franchise renewal. Queue ticket issued for evaluation.',
    createdAt: 1697587200000,
    updatedAt: 1709251200000,
    lastUpdatedBy: 'Insp. M. Bautista',
  },
  {
    bodyNumber: '088',
    franchiseNumber: 'MTFRB-2024-0088',
    operatorName: 'Rodrigo D. Castro',
    contactNumber: '0928-555-0488',
    address: 'Brgy. San Juan, Castillejos, Zambales',
    classification: 'Operator',
    dateOfBirth: '1988-08-19',
    civilStatus: 'Single',
    emergencyContactName: 'Gloria Castro (Mother)',
    emergencyContactPhone: '0928-555-0489',
    driverName: 'Rodrigo D. Castro',
    driverLicenseNumber: 'D03-08-334455',
    driverLicenseExpiry: '2027-08-19',
    driverContactNumber: '0928-555-0488',
    driverAddress: 'Brgy. San Juan, Castillejos, Zambales',
    franchiseType: 'NEW',
    franchiseStatus: 'ACTIVE',
    zone: 'Zone 4',
    todaAssociation: 'SANJUANTODA (San Juan TODA)',
    dateIssued: '2024-03-01',
    expiryDate: '2025-03-01',
    plateNumber: '3456-GH',
    engineNumber: 'GD110E-5566778',
    chassisNumber: 'GD110C-2233445',
    makeModel: 'Suzuki GD 110 HU',
    yearModel: '2023',
    color: 'Black / Yellow',
    stickerNumber: 'STK-2024-0088',
    oldBodyNumber: 'None (New Franchise)',
    caseNumber: 'CASE-2024-0088',
    orNumber: 'OR-99120034',
    crNumber: 'CR-55442211',
    taxCertificateNumber: 'CTC-2024-01204',
    taxCertificateAddress: 'Brgy. San Juan, Castillejos, Zambales',
    taxCertificateDate: '2024-02-25',
    verifiedDocuments: ['doc_brgy_clearance', 'doc_voters_id', 'doc_cedula', 'doc_orcr_cert', 'doc_orientation_cert', 'doc_mtfrb_inspection', 'doc_drivers_license'],
    inspectionPassed: true,
    inspectionDate: '2024-02-28',
    inspectorName: 'Insp. M. Bautista',
    violationsHistory: [],
    notes: 'New franchise grant approved by Municipal Sangguniang Bayan Resolution.',
    createdAt: 1709251200000,
    updatedAt: 1709251200000,
    lastUpdatedBy: 'Admin Kevin Salonga',
  },
  {
    bodyNumber: '104',
    franchiseNumber: 'MTFRB-2024-0104',
    operatorName: 'Benito C. Fernandez',
    contactNumber: '0917-555-0504',
    emailAddress: 'benito.fernandez@gmail.com',
    address: 'Brgy. Nagbunga, Castillejos, Zambales',
    classification: 'Operator',
    dateOfBirth: '1970-12-04',
    civilStatus: 'Married',
    emergencyContactName: 'Rosa Fernandez',
    emergencyContactPhone: '0917-555-0505',
    driverName: 'Benito C. Fernandez',
    driverLicenseNumber: 'D01-90-554433',
    driverLicenseExpiry: '2026-12-04',
    driverContactNumber: '0917-555-0504',
    driverAddress: 'Brgy. Nagbunga, Castillejos, Zambales',
    franchiseType: 'CHANGE_MOTOR',
    franchiseStatus: 'ACTIVE',
    zone: 'Zone 5',
    todaAssociation: 'NAGBUNGATODA (Nagbunga Tricycle Association)',
    dateIssued: '2024-04-12',
    expiryDate: '2025-04-12',
    plateNumber: '7890-IJ',
    engineNumber: 'TMX125E-3344112',
    chassisNumber: 'TMX125C-6677889',
    makeModel: 'Honda TMX 125 Alpha',
    yearModel: '2024',
    color: 'Red / Silver',
    stickerNumber: 'STK-2024-0104',
    oldBodyNumber: '104-CM',
    caseNumber: 'CASE-2024-0104',
    orNumber: 'OR-11229988',
    crNumber: 'CR-33447788',
    taxCertificateNumber: 'CTC-2024-01452',
    taxCertificateAddress: 'Brgy. Nagbunga, Castillejos, Zambales',
    taxCertificateDate: '2024-04-05',
    verifiedDocuments: ['doc_brgy_clearance', 'doc_cedula', 'doc_orcr_cert', 'doc_mtfrb_inspection'],
    inspectionPassed: true,
    inspectionDate: '2024-04-10',
    inspectorName: 'SPO1 R. Villanueva',
    violationsHistory: [],
    notes: 'Engine replacement from older unit approved. All chassis stamps inspected.',
    createdAt: 1712880000000,
    updatedAt: 1712880000000,
    lastUpdatedBy: 'Admin Kevin Salonga',
  },
  {
    bodyNumber: '128',
    franchiseNumber: 'MTFRB-2023-0128',
    operatorName: 'Carmelo G. Ramos',
    contactNumber: '0930-555-0628',
    address: 'Brgy. Balaybay, Castillejos, Zambales',
    classification: 'Operator',
    dateOfBirth: '1984-07-22',
    civilStatus: 'Married',
    emergencyContactName: 'Amparo Ramos',
    emergencyContactPhone: '0930-555-0629',
    driverName: 'Marlon Ramos',
    driverLicenseNumber: 'D02-06-887766',
    driverLicenseExpiry: '2027-07-22',
    driverContactNumber: '0930-555-0630',
    driverAddress: 'Brgy. Balaybay, Castillejos, Zambales',
    franchiseType: 'RENEWAL',
    franchiseStatus: 'EXPIRED',
    zone: 'Zone 6',
    todaAssociation: 'BALAYTODA (Balaybay TODA)',
    dateIssued: '2023-06-20',
    expiryDate: '2024-06-20',
    plateNumber: '2345-KL',
    engineNumber: 'BC175E-8899001',
    chassisNumber: 'BC175C-3344556',
    makeModel: 'Kawasaki Barako II 175',
    yearModel: '2019',
    color: 'Black / Silver',
    stickerNumber: 'STK-2023-0128',
    verifiedDocuments: ['doc_brgy_clearance'],
    inspectionPassed: false,
    violationsHistory: ['2024-07-10: Operating with expired franchise sticker - Impounded & notice served'],
    notes: 'Expired franchise. Pending submission of updated OR/CR and inspection clearance.',
    createdAt: 1687219200000,
    updatedAt: 1720569600000,
    lastUpdatedBy: 'Insp. M. Bautista',
  },
  {
    bodyNumber: '215',
    franchiseNumber: 'MTFRB-2024-0215',
    operatorName: 'Arlene V. Ocampo',
    contactNumber: '0945-555-0715',
    emailAddress: 'arlene.ocampo@gmail.com',
    address: 'Brgy. Del Pilar, Castillejos, Zambales',
    classification: 'Operator',
    dateOfBirth: '1980-09-12',
    civilStatus: 'Married',
    emergencyContactName: 'Nestor Ocampo',
    emergencyContactPhone: '0945-555-0716',
    driverName: 'Nestor Ocampo',
    driverLicenseNumber: 'D01-01-223344',
    driverLicenseExpiry: '2028-09-12',
    driverContactNumber: '0945-555-0716',
    driverAddress: 'Brgy. Del Pilar, Castillejos, Zambales',
    franchiseType: 'RENEWAL',
    franchiseStatus: 'ACTIVE',
    zone: 'Zone 1',
    todaAssociation: 'DELPTODA (Del Pilar Tricycle Operators & Drivers Association)',
    dateIssued: '2024-05-18',
    expiryDate: '2025-05-18',
    plateNumber: '6789-MN',
    engineNumber: 'TMX125E-5566112',
    chassisNumber: 'TMX125C-9900112',
    makeModel: 'Honda TMX 125 Alpha',
    yearModel: '2023',
    color: 'White / Blue',
    stickerNumber: 'STK-2024-0215',
    verifiedDocuments: ['doc_brgy_clearance', 'doc_cedula', 'doc_orcr_2copies', 'doc_drivers_license'],
    inspectionPassed: true,
    inspectionDate: '2024-05-16',
    inspectorName: 'SPO1 R. Villanueva',
    violationsHistory: [],
    notes: 'All documents updated and verified in municipal registry.',
    createdAt: 1715990400000,
    updatedAt: 1715990400000,
    lastUpdatedBy: 'Admin Kevin Salonga',
  },
  {
    bodyNumber: '309',
    franchiseNumber: 'MTFRB-2024-0309',
    operatorName: 'Sotero P. Manalo',
    contactNumber: '0918-555-0809',
    address: 'Brgy. San Agustin, Castillejos, Zambales',
    classification: 'Operator',
    dateOfBirth: '1965-02-25',
    civilStatus: 'Married',
    emergencyContactName: 'Felicidad Manalo',
    emergencyContactPhone: '0918-555-0810',
    driverName: 'Sotero P. Manalo',
    driverLicenseNumber: 'D01-85-112233',
    driverLicenseExpiry: '2026-02-25',
    driverContactNumber: '0918-555-0809',
    driverAddress: 'Brgy. San Agustin, Castillejos, Zambales',
    franchiseType: 'RENEWAL',
    franchiseStatus: 'ACTIVE',
    zone: 'Zone 2',
    todaAssociation: 'SANAGUSTODA (San Agustin TODA)',
    dateIssued: '2024-06-01',
    expiryDate: '2025-06-01',
    plateNumber: '4321-OP',
    engineNumber: 'BC175E-9900223',
    chassisNumber: 'BC175C-4455667',
    makeModel: 'Kawasaki Barako II 175',
    yearModel: '2022',
    color: 'Red / Black',
    stickerNumber: 'STK-2024-0309',
    verifiedDocuments: ['doc_brgy_clearance', 'doc_cedula', 'doc_orcr_2copies'],
    inspectionPassed: true,
    inspectionDate: '2024-05-30',
    inspectorName: 'Insp. M. Bautista',
    violationsHistory: [],
    notes: 'Senior citizen operator (Priority Lane entitled). Unit in excellent condition.',
    createdAt: 1717200000000,
    updatedAt: 1717200000000,
    lastUpdatedBy: 'Admin Kevin Salonga',
  },
];

// ---------------------------------------------------------------------------
// Payment Station Types & Fee Schedule (Connected by bodyNumber)
// ---------------------------------------------------------------------------

export interface PaymentFeeItem {
  id: string;
  name: string;
  amount: number;
  category?: 'franchise' | 'permit' | 'registration' | 'other';
  description?: string;
}

export const PAYMENT_FEES_CATALOG: PaymentFeeItem[] = [
  { id: 'fee_franchise_100', name: 'Franchise Fee', amount: 100.00, description: 'Standard Franchise Filing Fee' },
  { id: 'fee_secretaries_100', name: "Secretaries Fee", amount: 100.00, description: "Secretary Certification & Record Verification" },
  { id: 'fee_mayors_permit_500', name: "Mayor's Permit", amount: 500.00, description: "Municipal Executive Regulatory Clearance" },
  { id: 'fee_business_permit_150', name: 'Business Permit', amount: 150.00, description: 'Commercial Tricycle Operation License' },
  { id: 'fee_annual_reg_100', name: 'Annual Registration', amount: 100.00, description: 'Annual MTFRB Franchise Registration' },
  { id: 'fee_app_fee_30', name: 'Application Fee', amount: 30.00, description: 'MTFRB Form & Processing Docket' },
  { id: 'fee_franchise_1500', name: 'Franchise Fee', amount: 1500.00, description: 'New / Dropping & Substitution Franchise Grant' },
  { id: 'fee_capitalization_100', name: 'Capitalization', amount: 100.00, description: 'Municipal Transport Capitalization Assessment' },
  { id: 'fee_body_number_25', name: 'Body Number', amount: 25.00, description: 'Official Body Number Assignment & Plate Decal' },
];

export interface PaymentRecord {
  id: string;
  bodyNumber: string;
  orNumber: string;
  ticketNumber?: string;
  applicantName: string;
  payerName?: string;
  selectedFeeIds: string[];
  feeBreakdown: Array<{ id: string; name: string; amount: number }>;
  totalAmount: number;
  amountPaid?: number;
  change?: number;
  paymentMethod?: 'CASH' | 'GCASH' | 'CHECK';
  remarks?: string;
  cashierName: string;
  counterId?: number;
  createdAt: number;
  paidAt?: string;
}



