import { Ticket, ServiceCounter, DEFAULT_COUNTERS, FranchiseZone } from '../types';

/**
 * Generates an array of unique random body numbers within the requested range (inclusive).
 */
export function generateUniqueBodyNumbers(count: number, min = 1000, max = 4000): string[] {
  const selected = new Set<number>();
  while (selected.size < count) {
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    selected.add(num);
  }
  return Array.from(selected).map(String);
}

/**
 * Generates the official 50-item Waiting List Demo Queue Database for MTFRB Castillejos,
 * along with 4 active service desk tickets for testing and lobby presentation.
 * All demo users use tricycle body numbers (randomized from 1000 to 4000) as their ticket numbers.
 * This is ONLY loaded when the "Reset Demo Queue Sequence" button is clicked.
 */
export function generateDemoQueue50Database(): {
  tickets: Ticket[];
  counters: ServiceCounter[];
  lastSequences: {
    newSeq: number;
    renewSeq: number;
    cmSeq: number;
    odSeq: number;
  };
} {
  const now = Date.now();

  // Generate 54 unique random body numbers in the 1000-4000 range:
  // 4 for active service counters + 50 for waiting queue list
  const uniqueBodyNumbers = generateUniqueBodyNumbers(54, 1000, 4000);

  // 4 Active Tickets for Frontline Counters (using body numbers as ticket numbers)
  const activeTickets: Ticket[] = [
    {
      id: 'demo-act-1',
      ticketNumber: uniqueBodyNumbers[0],
      franchiseType: 'NEW',
      priorityLevel: 'REGULAR',
      applicantName: 'Danilo S. Santos',
      bodyNumber: uniqueBodyNumbers[0],
      classification: 'Operator',
      zone: 'Zone 1',
      status: 'SERVING',
      assignedCounter: 1,
      assignedOfficer: 'Danilo Magsaysay',
      createdAt: now - 35 * 60 * 1000,
      calledAt: now - 15 * 60 * 1000,
      servedAt: now - 12 * 60 * 1000,
      verifiedDocuments: ['doc-valid-id', 'doc-brgy-clearance', 'doc-cedula'],
      callCount: 1,
    },
    {
      id: 'demo-act-2',
      ticketNumber: uniqueBodyNumbers[1],
      franchiseType: 'RENEWAL',
      priorityLevel: 'REGULAR',
      applicantName: 'Roberto G. Dela Rosa',
      bodyNumber: uniqueBodyNumbers[1],
      franchiseNumber: `FN-2023-${uniqueBodyNumbers[1]}`,
      classification: 'Operator',
      zone: 'Zone 2',
      status: 'CALLING', // Spotlighted on Lobby TV
      assignedCounter: 2,
      assignedOfficer: 'Roberto Garcia',
      createdAt: now - 28 * 60 * 1000,
      calledAt: now - 2 * 60 * 1000,
      verifiedDocuments: ['doc-valid-id', 'doc-cr-or'],
      callCount: 2,
    },
    {
      id: 'demo-act-3',
      ticketNumber: uniqueBodyNumbers[2],
      franchiseType: 'RENEWAL',
      priorityLevel: 'PRIORITY',
      priorityReason: 'Senior Citizen',
      applicantName: 'Maria Elena V. Cruz',
      bodyNumber: uniqueBodyNumbers[2],
      franchiseNumber: `FN-2022-${uniqueBodyNumbers[2]}`,
      classification: 'Operator',
      zone: 'Zone 3',
      status: 'SERVING',
      assignedCounter: 3,
      assignedOfficer: 'Maria Elena Ramos',
      createdAt: now - 30 * 60 * 1000,
      calledAt: now - 10 * 60 * 1000,
      servedAt: now - 8 * 60 * 1000,
      verifiedDocuments: ['doc-valid-id', 'doc-senior-id', 'doc-cr-or'],
      callCount: 1,
    },
    {
      id: 'demo-act-4',
      ticketNumber: uniqueBodyNumbers[3],
      franchiseType: 'CHANGE_MOTOR',
      priorityLevel: 'REGULAR',
      applicantName: 'Jose P. Bautista',
      bodyNumber: uniqueBodyNumbers[3],
      franchiseNumber: `FN-2021-${uniqueBodyNumbers[3]}`,
      classification: 'Driver',
      zone: 'Zone 4',
      status: 'SERVING',
      assignedCounter: 4,
      assignedOfficer: 'Eduardo Bautista',
      createdAt: now - 25 * 60 * 1000,
      calledAt: now - 8 * 60 * 1000,
      servedAt: now - 5 * 60 * 1000,
      verifiedDocuments: ['doc-valid-id', 'doc-sales-invoice-engine'],
      callCount: 1,
    },
  ];

  // 50 Waiting List Applicants Data
  // 13 NEW Franchise, 18 Franchise RENEWAL, 10 CHANGE MOTOR, 9 ORDER FOR DROPPING = 50 WAITING LIST
  const waitingApplicantsRaw: Array<{
    seq: number;
    type: 'NEW' | 'RENEWAL' | 'CHANGE_MOTOR' | 'DROPPING';
    prefix: string;
    isPriority: boolean;
    prioReason?: 'Senior Citizen' | 'Person with Disability (PWD)' | 'Pregnant' | 'Solo Parent with Infant';
    name: string;
    zone: FranchiseZone;
    classification: 'Operator' | 'Driver';
    minsAgo: number;
  }> = [
    // 13 NEW Franchise
    { seq: 105, type: 'NEW', prefix: 'N', isPriority: false, name: 'Juan C. Dela Cruz', zone: 'Zone 1', classification: 'Operator', minsAgo: 50 },
    { seq: 106, type: 'NEW', prefix: 'N', isPriority: false, name: 'Eduardo Ramos', zone: 'Zone 2', classification: 'Driver', minsAgo: 48 },
    { seq: 107, type: 'NEW', prefix: 'N', isPriority: true, prioReason: 'Senior Citizen', name: 'Antonio V. Santos', zone: 'Zone 3', classification: 'Operator', minsAgo: 46 },
    { seq: 108, type: 'NEW', prefix: 'N', isPriority: false, name: 'Ramon S. Reyes', zone: 'Zone 1', classification: 'Operator', minsAgo: 44 },
    { seq: 109, type: 'NEW', prefix: 'N', isPriority: false, name: 'Fernando D. Ramos', zone: 'Zone 4', classification: 'Driver', minsAgo: 42 },
    { seq: 110, type: 'NEW', prefix: 'N', isPriority: false, name: 'Danilo L. Diaz', zone: 'Zone 2', classification: 'Operator', minsAgo: 40 },
    { seq: 111, type: 'NEW', prefix: 'N', isPriority: false, name: 'Ricardo J. Fernandez', zone: 'Zone 5', classification: 'Driver', minsAgo: 38 },
    { seq: 112, type: 'NEW', prefix: 'N', isPriority: false, name: 'Ernesto B. Mendoza', zone: 'Zone 6', classification: 'Operator', minsAgo: 36 },
    { seq: 113, type: 'NEW', prefix: 'N', isPriority: true, prioReason: 'Person with Disability (PWD)', name: 'Jaime T. Castro', zone: 'Zone 3', classification: 'Operator', minsAgo: 34 },
    { seq: 114, type: 'NEW', prefix: 'N', isPriority: false, name: 'Rodolfo G. Morales', zone: 'Zone 1', classification: 'Driver', minsAgo: 32 },
    { seq: 115, type: 'NEW', prefix: 'N', isPriority: false, name: 'Pedro K. Villanueva', zone: 'Zone 4', classification: 'Operator', minsAgo: 30 },
    { seq: 116, type: 'NEW', prefix: 'N', isPriority: false, name: 'Alfredo N. Gutierrez', zone: 'Zone 2', classification: 'Operator', minsAgo: 28 },
    { seq: 117, type: 'NEW', prefix: 'N', isPriority: false, name: 'Manuel R. Pascual', zone: 'Zone 5', classification: 'Driver', minsAgo: 26 },

    // 18 RENEWAL Franchise
    { seq: 205, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Benjamin E. Mercado', zone: 'Zone 1', classification: 'Operator', minsAgo: 49 },
    { seq: 206, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Rolando S. Aguilar', zone: 'Zone 2', classification: 'Operator', minsAgo: 47 },
    { seq: 207, type: 'RENEWAL', prefix: 'R', isPriority: true, prioReason: 'Senior Citizen', name: 'Mario T. Navarro', zone: 'Zone 3', classification: 'Driver', minsAgo: 45 },
    { seq: 208, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Cesar D. Salazar', zone: 'Zone 4', classification: 'Operator', minsAgo: 43 },
    { seq: 209, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Dante M. Soriano', zone: 'Zone 1', classification: 'Operator', minsAgo: 41 },
    { seq: 210, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Gerardo B. Corpuz', zone: 'Zone 5', classification: 'Driver', minsAgo: 39 },
    { seq: 211, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Salvador A. Castillo', zone: 'Zone 6', classification: 'Operator', minsAgo: 37 },
    { seq: 212, type: 'RENEWAL', prefix: 'R', isPriority: true, prioReason: 'Pregnant', name: 'Rogelio P. Rivera', zone: 'Zone 2', classification: 'Operator', minsAgo: 35 },
    { seq: 213, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Edwin L. Tolentino', zone: 'Zone 3', classification: 'Driver', minsAgo: 33 },
    { seq: 214, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Carlos V. Manalo', zone: 'Zone 4', classification: 'Operator', minsAgo: 31 },
    { seq: 215, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Danilo M. De Leon', zone: 'Zone 1', classification: 'Operator', minsAgo: 29 },
    { seq: 216, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Ruben J. Alcantara', zone: 'Zone 5', classification: 'Driver', minsAgo: 27 },
    { seq: 217, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Gregorio S. Valenzuela', zone: 'Zone 2', classification: 'Operator', minsAgo: 25 },
    { seq: 218, type: 'RENEWAL', prefix: 'R', isPriority: true, prioReason: 'Senior Citizen', name: 'Noel F. Ocampo', zone: 'Zone 6', classification: 'Operator', minsAgo: 23 },
    { seq: 219, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Joel C. Esguerra', zone: 'Zone 3', classification: 'Driver', minsAgo: 21 },
    { seq: 220, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Renato B. Evangelista', zone: 'Zone 1', classification: 'Operator', minsAgo: 19 },
    { seq: 221, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Nestor M. Quizon', zone: 'Zone 4', classification: 'Operator', minsAgo: 17 },
    { seq: 222, type: 'RENEWAL', prefix: 'R', isPriority: false, name: 'Wilfredo G. Macapagal', zone: 'Zone 2', classification: 'Driver', minsAgo: 15 },

    // 10 CHANGE MOTOR
    { seq: 305, type: 'CHANGE_MOTOR', prefix: 'CM', isPriority: false, name: 'Victor L. Domingo', zone: 'Zone 1', classification: 'Operator', minsAgo: 45 },
    { seq: 306, type: 'CHANGE_MOTOR', prefix: 'CM', isPriority: false, name: 'Armando P. Galang', zone: 'Zone 3', classification: 'Driver', minsAgo: 41 },
    { seq: 307, type: 'CHANGE_MOTOR', prefix: 'CM', isPriority: false, name: 'Ronnie D. Pineda', zone: 'Zone 2', classification: 'Operator', minsAgo: 38 },
    { seq: 308, type: 'CHANGE_MOTOR', prefix: 'CM', isPriority: true, prioReason: 'Person with Disability (PWD)', name: 'Alex S. Miranda', zone: 'Zone 4', classification: 'Operator', minsAgo: 34 },
    { seq: 309, type: 'CHANGE_MOTOR', prefix: 'CM', isPriority: false, name: 'Rommel T. David', zone: 'Zone 5', classification: 'Driver', minsAgo: 30 },
    { seq: 310, type: 'CHANGE_MOTOR', prefix: 'CM', isPriority: false, name: 'Dennis C. Angeles', zone: 'Zone 6', classification: 'Operator', minsAgo: 26 },
    { seq: 311, type: 'CHANGE_MOTOR', prefix: 'CM', isPriority: false, name: 'Jerry B. Samson', zone: 'Zone 1', classification: 'Operator', minsAgo: 22 },
    { seq: 312, type: 'CHANGE_MOTOR', prefix: 'CM', isPriority: false, name: 'Allan R. Feliciano', zone: 'Zone 2', classification: 'Driver', minsAgo: 18 },
    { seq: 313, type: 'CHANGE_MOTOR', prefix: 'CM', isPriority: false, name: 'Christopher M. Dizon', zone: 'Zone 3', classification: 'Operator', minsAgo: 14 },
    { seq: 314, type: 'CHANGE_MOTOR', prefix: 'CM', isPriority: false, name: 'Marlon V. Cortez', zone: 'Zone 4', classification: 'Operator', minsAgo: 10 },

    // 9 ORDER FOR DROPPING
    { seq: 405, type: 'DROPPING', prefix: 'OD', isPriority: false, name: 'Reynaldo J. Mallari', zone: 'Zone 1', classification: 'Operator', minsAgo: 42 },
    { seq: 406, type: 'DROPPING', prefix: 'OD', isPriority: false, name: 'Jimmy S. Guinto', zone: 'Zone 2', classification: 'Driver', minsAgo: 37 },
    { seq: 407, type: 'DROPPING', prefix: 'OD', isPriority: false, name: 'Jeffrey B. Balagtas', zone: 'Zone 3', classification: 'Operator', minsAgo: 33 },
    { seq: 408, type: 'DROPPING', prefix: 'OD', isPriority: true, prioReason: 'Senior Citizen', name: 'Norman C. Manalang', zone: 'Zone 5', classification: 'Operator', minsAgo: 29 },
    { seq: 409, type: 'DROPPING', prefix: 'OD', isPriority: false, name: 'Arnel D. Pingol', zone: 'Zone 4', classification: 'Driver', minsAgo: 24 },
    { seq: 410, type: 'DROPPING', prefix: 'OD', isPriority: false, name: 'Roderick T. Lacson', zone: 'Zone 6', classification: 'Operator', minsAgo: 20 },
    { seq: 411, type: 'DROPPING', prefix: 'OD', isPriority: false, name: 'Gilbert M. Canlas', zone: 'Zone 1', classification: 'Operator', minsAgo: 16 },
    { seq: 412, type: 'DROPPING', prefix: 'OD', isPriority: false, name: 'Michael V. Buan', zone: 'Zone 2', classification: 'Driver', minsAgo: 12 },
    { seq: 413, type: 'DROPPING', prefix: 'OD', isPriority: false, name: 'Crisanto E. Macaspac', zone: 'Zone 3', classification: 'Operator', minsAgo: 8 },
  ];

  // Map to Ticket objects using randomized body number (1000-4000) as ticket number
  // Realistic municipal distribution: distribute applicants across pipeline counters 1-8
  const waitingTickets: Ticket[] = waitingApplicantsRaw.map((raw, idx) => {
    const bodyNo = uniqueBodyNumbers[4 + idx];
    let counterId = 1;
    if (idx < 15) counterId = 1; // Assessment / Receiving (15 waiting)
    else if (idx < 25) counterId = 2; // Records Verification (10 waiting)
    else if (idx < 35) counterId = 3; // Physical Inspection Station (10 waiting)
    else if (idx < 43) counterId = 4; // Payment / Cashier (8 waiting)
    else if (idx < 46) counterId = 5; // Processing / Approval (3 waiting)
    else if (idx < 48) counterId = 6; // Encoding & Stickers (2 waiting)
    else if (idx === 48) counterId = 7; // Final Review (1 waiting)
    else counterId = 8; // Releasing (1 waiting)

    return {
      id: `demo-wait-${idx + 1}`,
      ticketNumber: bodyNo,
      franchiseType: raw.type,
      priorityLevel: raw.isPriority ? 'PRIORITY' : 'REGULAR',
      priorityReason: raw.prioReason,
      applicantName: raw.name,
      bodyNumber: bodyNo,
      franchiseNumber: raw.type !== 'NEW' ? `FN-2023-${bodyNo}` : undefined,
      classification: raw.classification,
      zone: raw.zone,
      status: 'WAITING',
      assignedCounter: counterId,
      createdAt: now - raw.minsAgo * 60 * 1000,
      verifiedDocuments: [],
      callCount: 0,
    };
  });

  // Verify total waiting is exactly 50
  // 13 + 18 + 10 + 9 = 50
  const allTickets = [...activeTickets, ...waitingTickets];

  // Configure counters with active tickets
  const counters: ServiceCounter[] = DEFAULT_COUNTERS.map((c) => {
    if (c.id === 1) {
      return { ...c, currentTicketId: 'demo-act-1', status: 'BUSY' as const };
    }
    if (c.id === 2) {
      return { ...c, currentTicketId: 'demo-act-2', status: 'BUSY' as const };
    }
    if (c.id === 3) {
      return { ...c, currentTicketId: 'demo-act-3', status: 'BUSY' as const };
    }
    if (c.id === 4) {
      return { ...c, currentTicketId: 'demo-act-4', status: 'BUSY' as const };
    }
    return { ...c, currentTicketId: null, status: 'OPEN' as const };
  });

  return {
    tickets: allTickets,
    counters,
    lastSequences: {
      newSeq: 117,
      renewSeq: 222,
      cmSeq: 314,
      odSeq: 413,
    },
  };
}
