/**
 * Inventory Service Types & Interfaces
 */

export type UserRole = "Owner" | "Manager" | "Technician" | "Staff" | "Receptionist" | "Senior Technician" | "Helper" | "Driver";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

export interface Customer {
  id: string; // e.g. "CUST-1001"
  name: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
}

export type JobStatus =
  | "Received"
  | "Under Inspection"
  | "Repairing"
  | "Waiting for Parts"
  | "Completed"
  | "Delivered";

export type AccessoryKey =
  | "Adapter"
  | "dvr"
  | "nvr"
  | "HDD"
  | "WiFi"
  | "sim camera"
  | "Power Supply"
  | "Memory Card";

export interface ReplacementLog {
  id: string;
  partName: string;
  oldSerial: string;
  newSerial: string;
  oldModel: string;
  newModel: string;
  reason: string;
  timestamp: string;
}

export interface StatusHistory {
  status: JobStatus;
  changedBy: string;
  timestamp: string;
}

export interface LocationHistory {
  location: string;
  assignedBy: string;
  timestamp: string;
}

export interface ServiceItem {
  id: string; // e.g. "INVSRV-2026-0001-A"
  productName: string;
  brand: string;
  category: string;
  modelNo: string;
  serialNo: string;
  condition: string;
  problemDescription: string;
  accessories: Record<AccessoryKey, boolean>;
  serviceCharge: number;
  spareCharge: number;
  discount: number;
  total: number;
  technicianId: string; // References Staff/Technician id
  status: JobStatus;
  statusHistory: StatusHistory[];
  currentLocation: string;
  locationHistory: LocationHistory[];
  replacements: ReplacementLog[];
  isBurnt?: boolean;
  burntDetails?: string;
  isProductReplaced?: boolean;
  replacementModelNo?: string;
  replacementSerialNo?: string;
  replacementDate?: string;
  replacementReason?: string;
}

export type PaymentStatus = "Unpaid" | "Partial" | "Paid";
export type PaymentMethod = string;

export interface ServiceJob {
  id: string; // jobNo e.g. "INVSRV-2026-0001"
  customerId: string; // References Customer id
  date: string;
  items: ServiceItem[];
  waEnabled: boolean; // WhatsApp notifications toggle
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  grandTotal: number;
  paidAmount: number;
  paidDate?: string;
  createdAt: string;
  paymentNotes?: string; // Cheque numbers, cash drawer codes, or credit terms
}

export interface InventoryItem {
  id: string;
  brand: string;
  category: string;
  modelNo: string;
  serialNo: string;
  productName: string;
  quantity: number;
  minQuantity: number; // e.g., default 5 for alerts
  location: string;
  purchaseDate?: string;
  supplier?: string;
  status?: string;
  notes?: string;
  history: {
    type: "In" | "Out";
    quantity: number;
    notes: string;
    timestamp: string;
    user: string;
  }[];
  createdAt: string;
}

export interface Staff {
  id: string;
  name: string;
  role: "Technician" | "Senior Technician" | "Manager" | "Helper" | "Driver" | "Receptionist";
  status: "Active" | "Inactive";
  loginId?: string;
  password?: string;
}

export interface WhatsAppTemplate {
  status: JobStatus;
  template: string;
}

export type SubscriptionPlan = "Free" | "Premium";

export interface SubscriptionPayment {
  id: string;
  date: string;
  amount: number;
  plan: SubscriptionPlan;
  paymentMethod: string;
  transactionId: string;
}

export interface SubscriptionDetail {
  plan: SubscriptionPlan;
  status: "Active" | "Expired" | "Trial";
  startDate: string;
  expiryDate: string;
  paymentHistory: SubscriptionPayment[];
}

export const PLAN_LIMITS = {
  Free: {
    customers: 999999,
    services: 999999,
    inventory: 999999,
    label: "Full-Access Operational Plan"
  },
  Premium: {
    customers: 999999,
    services: 999999,
    inventory: 999999,
    label: "Full-Access Operational Plan"
  }
};


