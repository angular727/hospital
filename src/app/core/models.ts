export interface Me {
  user: { id: string; name: string; isSuperAdmin: boolean; roleName?: string; isAdmin?: boolean; isDoctor?: boolean };
  hospital?: {
    id: string;
    name: string;
    code: string;
    logo?: string;
    phone?: string;
    address?: string;
    settings?: { currency: string; invoicePrefix: string; tagline?: string; printFooter?: string };
  };
  modules: string[];
  permissions: string[];
}

export interface Hospital {
  _id: string;
  name: string;
  code: string;
  phone?: string;
  address?: string;
  plan: string;
  status: 'active' | 'suspended';
  expiresAt?: string;
  enabledModules: string[];
  adminUsername?: string;
  hasStoredPassword?: boolean;
  createdAt: string;
}

export interface ModuleDef {
  key: string;
  name: string;
  core: boolean;
  actions: string[];
}

export interface Role {
  _id: string;
  name: string;
  permissions: string[];
  isAdmin: boolean;
}

export interface HospitalUser {
  _id: string;
  name: string;
  username: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  lastLogin?: string;
  isDoctor?: boolean;
  specialization?: string;
  qualification?: string;
  registrationNo?: string;
  consultationFee?: number;
  headerLines?: string;
  footerEn?: string;
  footerUr?: string;
  hasStoredPassword?: boolean;
  customAccess?: boolean;
  customPermissions?: string[];
  labId?: { _id: string; name: string } | null;
  receptionId?: { _id: string; name: string } | null;
  roleId: { _id: string; name: string; isAdmin: boolean } | null;
}

export interface PermissionGroup {
  key: string;
  name: string;
  actions: string[];
}

export interface Doctor {
  _id: string;
  name: string;
  specialization?: string;
  qualification?: string;
  registrationNo?: string;
  consultationFee?: number;
}

export interface PatientRef {
  _id: string;
  name: string;
  mrn: string;
  phone?: string;
  gender?: string;
  age?: number;
  dob?: string;
  address?: string;
  allergies?: string;
  chronicConditions?: string;
  bloodGroup?: string;
}

export interface Patient extends PatientRef {
  fatherName?: string;
  cnic?: string;
  city?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export type ApptStatus = 'scheduled' | 'waiting' | 'in-consultation' | 'completed' | 'cancelled' | 'no-show';

export interface Appointment {
  _id: string;
  patientId: PatientRef;
  doctorId: Doctor;
  date: string;
  time?: string;
  token: number;
  type: 'appointment' | 'walk-in';
  status: ApptStatus;
  reason?: string;
  visitId?: string;
}

export interface Vitals {
  bp?: string;
  pulse?: number | null;
  temperature?: number | null;
  weight?: number | null;
  height?: number | null;
  spo2?: number | null;
  sugar?: number | null;
}

// Populated references are loosely typed on purpose: list/history endpoints populate different fields.
export interface Visit {
  _id: string;
  visitNo: string;
  patientId: any;
  doctorId: any;
  appointmentId?: string;
  /** Set by the visits list when the visit has a prescription. */
  rxId?: string;
  cancelReason?: string;
  date: string;
  status: 'open' | 'completed' | 'cancelled';
  vitals?: Vitals;
  complaint?: string;
  history?: string;
  examination?: string;
  diagnosis?: string;
  notes?: string;
  followUpDate?: string;
}

export interface Medicine {
  _id: string;
  name: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface RxItem {
  /** Set while the row was filled from the medicine list; cleared when the doctor edits a detail by hand. */
  auto?: boolean;
  medicine: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface Prescription {
  _id: string;
  rxNo: string;
  visitId: any;
  patientId: any;
  doctorId: any;
  date: string;
  items: RxItem[];
  advice?: string;
  tests?: string;
}

export type BillItemType = 'consultation' | 'lab' | 'medicine' | 'bed' | 'procedure' | 'other';

export interface InvoiceItem {
  description: string;
  type?: BillItemType;
  qty: number;
  rate: number;
  amount?: number;
}

export interface Payment {
  _id: string;
  amount: number;
  method: string;
  type: 'payment' | 'refund';
  at: string;
  day: string;
  note?: string;
}

export interface Invoice {
  _id: string;
  invoiceNo: string;
  patientId: any;
  doctorId?: any;
  visitId?: any;
  day: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  balance: number;
  status: 'unpaid' | 'partial' | 'paid';
  payments: Payment[];
  notes?: string;
}

/** A visit from an earlier day that was never completed or cancelled. */
export interface UnfinishedVisit {
  _id: string;
  visitId: string;
  token?: number | null;
  date: string;
  reason?: string;
  vitals?: Vitals;
  patient: PatientRef;
  doctor: { _id: string; name: string };
}

export interface QueueItem {
  _id: string;
  token: number;
  status: ApptStatus;
  date: string;
  createdAt: string;
  reason?: string;
  patient: PatientRef;
  doctor: { _id: string; name: string };
  visitId?: string;
  vitals?: Vitals;
  invoice: { invoiceNo: string; total: number; paid: number; balance: number; status: 'unpaid' | 'partial' | 'paid' } | null;
  /** Lab orders of this visit and how many already have their report. */
  lab?: { orders: number; completed: number } | null;
}

export interface LabTest {
  _id: string;
  name: string;
  category?: string;
  price: number;
  unit?: string;
  normalRange?: string;
  isActive: boolean;
  labId?: { _id: string; name: string };
}

export interface LabFileInfo {
  _id: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface LabOrderItem {
  _id: string;
  name: string;
  price: number;
  unit?: string;
  normalRange?: string;
  result?: string;
  remarks?: string;
}

export interface LabOrder {
  _id: string;
  orderNo: string;
  day: string;
  status: 'ordered' | 'completed' | 'cancelled';
  labId?: { _id: string; name: string };
  patientId: PatientRef;
  doctorId?: { _id: string; name: string };
  visitId?: { _id: string; visitNo: string };
  invoiceId?: { _id: string; invoiceNo: string; status: string; total: number; paid: number; balance: number; subtotal?: number; voided?: boolean };
  items: LabOrderItem[];
  files?: LabFileInfo[];
  notes?: string;
  cancelReason?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Lab {
  _id: string;
  name: string;
  isActive: boolean;
}

export interface ReceptionDesk {
  _id: string;
  name: string;
  isActive: boolean;
  doctorIds: { _id: string; name: string; specialization?: string }[];
}

interface LabReportCounts {
  orders: number;
  tests: number;
  completed: number;
  pending: number;
  cancelled: number;
  billed: number;
  paid: number;
  due: number;
  received: number;
}

export interface LabReport {
  from: string;
  to: string;
  totals: LabReportCounts;
  byLab: (LabReportCounts & { labId: string; lab: string })[];
  byDay: { day: string; orders: number; tests: number; billed: number }[];
  topTests: { name: string; count: number; revenue: number }[];
  byDoctor: { doctor: string; orders: number; tests: number; billed: number }[];
}

export interface BedRow {
  _id: string;
  name: string;
  dailyCharge: number;
  isActive: boolean;
  occupied: { admissionId: string; admissionNo: string; patient?: string } | null;
}

export interface WardRow {
  _id: string;
  name: string;
  isActive: boolean;
  totalBeds: number;
  occupiedBeds: number;
  beds: BedRow[];
}

export interface AdmissionRow {
  _id: string;
  admissionNo: string;
  status: 'admitted' | 'discharged';
  day: string;
  daysStayed: number;
  wardName: string;
  bedName: string;
  bedRate: number;
  diagnosis?: string;
  notes?: string;
  patientId: PatientRef;
  doctorId: { _id: string; name: string };
  invoiceId?: { _id: string; invoiceNo: string; status: string; total: number; paid: number; balance: number };
  discharge?: { day: string; condition: string; summary?: string; days: number; bedCharge: number; otherCharges: number; total: number };
}

export interface AdmissionRound {
  _id: string;
  day: string;
  at: string;
  byName?: string;
  vitals?: Record<string, unknown>;
  notes?: string;
  medicines: { name: string; dose?: string; charge?: number }[];
}

export interface AdmissionDetail extends AdmissionRow {
  rounds: AdmissionRound[];
  billPreview: { days: number; bedRate: number; bedCharge: number; lines: { name: string; qty: number; rate: number }[]; otherCharges: number; total: number };
}

export interface EmergencyRow {
  _id: string;
  caseNo: string;
  day: string;
  arrivedAt: string;
  status: 'waiting' | 'in-treatment' | 'closed';
  triage: { level: 'red' | 'yellow' | 'green' };
  complaint?: string;
  arrival?: string;
  waitingMinutes: number;
  patientId: PatientRef;
  doctorId?: { _id: string; name: string };
  outcome?: { type?: string; referredTo?: string; summary?: string };
}

export interface EmergencyNote {
  _id: string;
  kind?: string;
  at: string;
  byName?: string;
  text?: string;
  vitals?: Record<string, unknown>;
  items: { name: string; dose?: string; type: string; charge?: number }[];
}

export interface EmergencyDetail extends Omit<EmergencyRow, 'outcome' | 'waitingMinutes'> {
  vitals?: Record<string, unknown>;
  notes: EmergencyNote[];
  outcome?: { type?: string; referredTo?: string; summary?: string; admissionId?: { _id: string; admissionNo: string; wardName: string; bedName: string } };
  invoiceId?: { _id: string; invoiceNo: string; status: string; total: number };
  billPreview: { lines: { description: string; qty: number; rate: number }[]; total: number };
}
