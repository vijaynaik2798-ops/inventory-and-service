import React, { useState, useMemo } from "react";
import QRScannerModal from "./QRScannerModal";
import { Customer, ServiceJob, SubscriptionDetail, PLAN_LIMITS } from "../types";
import {
  Search,
  Plus,
  UserPlus,
  Phone,
  MapPin,
  ClipboardList,
  Edit,
  ExternalLink,
  MessageSquare,
  QrCode,
  Barcode,
  X,
  FileCheck
} from "lucide-react";
import { generateQRUrl, getWhatsAppClickUrl, formatCurrency } from "../utils/helpers";

interface CustomersTabProps {
  customers: Customer[];
  services: ServiceJob[];
  currentUser: any;
  subscription?: SubscriptionDetail;
  onAddCustomer: (data: Omit<Customer, "id" | "createdAt">) => void;
  onEditCustomer: (customer: Customer) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
  onOpenNewJobForCust: (customer: Customer) => void;
}

export default function CustomersTab({
  customers,
  services,
  currentUser,
  subscription,
  onAddCustomer,
  onEditCustomer,
  showToast,
  onOpenNewJobForCust
}: CustomersTabProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Scanner states
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannedTextInput, setScannedTextInput] = useState("");
  const scannerInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (showScannerModal && scannerInputRef.current) {
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 150);
    }
  }, [showScannerModal]);

  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  
  // Modals for add & edit
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Customer | null>(null);
  
  // Add form fields
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Edit form fields
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(
      c =>
        c.name.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term) ||
        c.id.toLowerCase().includes(term)
    );
  }, [customers, searchTerm]);

  // Aggregate past service tickets per customer
  const getCustomerStats = (customerId: string) => {
    const custJobs = services.filter(j => j.customerId === customerId);
    let totalSpent = 0;
    let totalOwed = 0;
    let pendingRepairs = 0;

    custJobs.forEach(job => {
      totalSpent += job.grandTotal;
      if (job.paymentStatus !== "Paid") {
        totalOwed += Math.max(0, job.grandTotal - (job.paidAmount || 0));
      }
      job.items.forEach(item => {
        if (
          item.status !== "Completed" &&
          item.status !== "Delivered"
        ) {
          pendingRepairs++;
        }
      });
    });

    return {
      jobsCount: custJobs.length,
      totalSpent,
      totalOwed,
      pendingRepairs,
      jobs: custJobs
    };
  };

  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) {
      showToast("Name and Phone are required", "error");
      return;
    }

    if (subscription) {
      const activePlan = subscription.plan;
      const clientLimit = PLAN_LIMITS[activePlan].customers;
      if (customers.length >= clientLimit) {
        showToast(`Client limit hit! Your '${activePlan}' plan is capped at ${clientLimit} clients. Upgrade plan in More tab.`, "error");
        return;
      }
    }

    onAddCustomer({
      name: newName,
      phone: newPhone,
      address: newAddress,
      notes: newNotes
    });

    // Clear form
    setNewName("");
    setNewPhone("");
    setNewAddress("");
    setNewNotes("");
    setShowAddModal(false);
  };

  const handleEditCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    if (!editName || !editPhone) {
      showToast("Name and Phone are required for safety", "error");
      return;
    }

    onEditCustomer({
      ...showEditModal,
      name: editName,
      phone: editPhone,
      address: editAddress,
      notes: editNotes
    });

    // If details modal was viewing this customer, update it!
    if (selectedCust?.id === showEditModal.id) {
      setSelectedCust({
        ...selectedCust,
        name: editName,
        phone: editPhone,
        address: editAddress,
        notes: editNotes
      });
    }

    setShowEditModal(null);
  };

  const triggerEditModalOpen = (cust: Customer) => {
    setEditName(cust.name);
    setEditPhone(cust.phone);
    setEditAddress(cust.address);
    setEditNotes(cust.notes);
    setShowEditModal(cust);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50 dark:bg-stone-950 transition-colors duration-200 pb-20">
      
      {/* Search and Action Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 dark:text-stone-500" />
          <input
            type="text"
            placeholder="Search matching clients, phones, ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-xl pl-9.5 pr-10 py-2.5 focus:outline-none focus:border-emerald-500 text-gray-800 dark:text-stone-200"
          />
          <button
            type="button"
            onClick={() => {
              setScannedTextInput("");
              setShowScannerModal(true);
            }}
            className="absolute right-3 top-2.5 p-0.5 text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
            title="Scan Barcode / QR Code"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold p-2.5 rounded-xl flex items-center gap-1 text-xs cursor-pointer shadow-sm transition-all whitespace-nowrap"
          id="btn-add-customer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </div>

      {/* Customer Record List */}
      <div className="space-y-2.5">
        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800/80 rounded-2xl">
            <UserPlus className="w-8 h-8 text-gray-300 dark:text-stone-700 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-gray-700 dark:text-stone-300">No Customers Detected</h4>
            <p className="text-[10px] text-gray-400 mt-1">
              Add a new customer contacts profile to compile service logs.
            </p>
          </div>
        ) : (
          filteredCustomers.map(cust => {
            const stats = getCustomerStats(cust.id);
            return (
              <div
                key={cust.id}
                onClick={() => setSelectedCust(cust)}
                className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800/80 p-3.5 rounded-xl text-left shadow-sm hover:border-emerald-500/20 dark:hover:border-emerald-500/10 cursor-pointer hover:shadow-md transition-all active:scale-99"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-slate-100 dark:bg-stone-800 px-2 py-0.5 rounded text-gray-500 dark:text-stone-400">
                      {cust.id}
                    </span>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-stone-100 mt-1.5 hover:text-emerald-600 dark:hover:text-emerald-400">
                      {cust.name}
                    </h3>
                  </div>

                  {stats.pendingRepairs > 0 && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 animate-pulse">
                      {stats.pendingRepairs} ACTIVE
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-stone-400 font-medium mt-2">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-gray-400" />
                    {cust.phone}
                  </span>
                  
                  {cust.address && (
                    <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      {cust.address}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center bg-slate-50 dark:bg-stone-900/60 rounded-lg p-2 mt-3 border border-gray-100/50 dark:border-stone-800/50">
                  <div className="flex gap-4 text-[10px] text-gray-500 dark:text-stone-400">
                    <div>
                      Jobs: <span className="font-bold text-gray-800 dark:text-stone-200">{stats.jobsCount}</span>
                    </div>
                    <div>
                      Owed: <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(stats.totalOwed)}</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                    View Ledger &rarr;
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Customer Full Profile Detail Modal Sheet */}
      {selectedCust && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-3xl border-t border-slate-200/50 dark:border-stone-800 max-h-[85vh] overflow-y-auto flex flex-col animate-slide-up">
            
            {/* Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900 z-10">
              <div>
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-slate-100 dark:bg-stone-800 px-2 py-0.5 rounded text-gray-500 dark:text-stone-400">
                  Customer Ledger Details
                </span>
                <h3 className="text-base font-black text-gray-800 dark:text-stone-100 mt-1">
                  {selectedCust.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCust(null)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-gray-500 dark:text-stone-400 active:scale-90 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 flex-1 select-none">
              
              {/* Profile Card & Dual Controls */}
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-stone-300 font-medium">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-bold select-all">{selectedCust.phone}</span>
                    <a
                      href={`tel:${selectedCust.phone}`}
                      className="text-[10px] text-blue-500 underline font-semibold flex items-center gap-0.5"
                    >
                      Call <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  {selectedCust.address && (
                    <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-stone-300 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                      <span>{selectedCust.address}</span>
                    </div>
                  )}

                  {selectedCust.notes && (
                    <div className="p-2.5 bg-slate-50 dark:bg-stone-800/40 rounded-xl border border-gray-100 dark:border-stone-800 text-[11px] text-gray-500 dark:text-stone-400 italic">
                      Notes: {selectedCust.notes}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => triggerEditModalOpen(selectedCust)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 border border-gray-200 dark:border-stone-700 hover:border-emerald-500 rounded-lg font-bold text-gray-600 dark:text-stone-300 bg-white hover:bg-emerald-500/5 dark:bg-stone-900"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Customer</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        const compiledText = `Hello, ${selectedCust.name}! This is Inventory Service Centre.`;
                        window.open(getWhatsAppClickUrl(selectedCust.phone, compiledText), "_blank");
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 border border-emerald-500/20 hover:border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg font-bold"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp Info</span>
                    </button>
                  </div>
                </div>

                {/* Client unique QR Card */}
                <div className="flex flex-col items-center bg-slate-50 dark:bg-stone-800/60 p-2.5 rounded-2xl border border-gray-100 dark:border-stone-800 shrink-0">
                  <div className="p-1 bg-white rounded-lg">
                    <img
                      src={generateQRUrl(`INVSRV-CUSTOMER:${selectedCust.id}`, "100x100")}
                      alt="Customer Qr"
                      className="w-20 h-20"
                      referrerPolicy="referrer"
                    />
                  </div>
                  <span className="text-[8px] font-mono font-bold text-gray-400 dark:text-stone-500 uppercase mt-1.5 flex items-center gap-0.5">
                    <QrCode className="w-2 h-2" />
                    Cust QR Code
                  </span>
                </div>
              </div>

              {/* Service Job History */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-stone-200 uppercase tracking-wider flex items-center gap-1">
                    <ClipboardList className="w-4 h-4 text-emerald-500" />
                    <span>Customer History & Ledger</span>
                  </h4>
                  
                  <button
                    onClick={() => {
                      onOpenNewJobForCust(selectedCust);
                      setSelectedCust(null);
                    }}
                    className="text-[10px] bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 text-white font-black px-3 py-1 rounded shadow-xs"
                  >
                    + NEW WORKFLOW
                  </button>
                </div>

                {getCustomerStats(selectedCust.id).jobs.length === 0 ? (
                  <div className="p-5 text-center bg-slate-50 dark:bg-stone-800/30 border border-dashed border-gray-200 dark:border-stone-800 rounded-xl">
                    <p className="text-[10px] text-gray-400">
                      No service jobs registered to this customer yet. Just click + NEW WORKFLOW to schedule.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {getCustomerStats(selectedCust.id).jobs.map(job => (
                      <div
                        key={job.id}
                        className="p-3 bg-slate-50 dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-xl flex flex-col space-y-2 text-left"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black font-mono text-gray-700 dark:text-stone-200">
                            {job.id}
                          </span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                            job.paymentStatus === "Paid"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
                              : job.paymentStatus === "Partial"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-400"
                          }`}>
                            {job.paymentStatus}
                          </span>
                        </div>

                        {/* Item list inside */}
                        <div className="space-y-1">
                          {job.items.map((it, i) => (
                            <div key={i} className="text-[11px] text-gray-600 dark:text-stone-300 font-medium flex justify-between">
                              <span className="truncate max-w-[200px]">
                                {it.productName} ({it.brand})
                              </span>
                              <span className="font-mono text-gray-400">{it.status}</span>
                            </div>
                          ))}
                        </div>

                        <div className="border-t border-dashed border-gray-200 dark:border-stone-800/80 pt-2 flex justify-between items-center text-[10px] text-gray-500 dark:text-stone-400">
                          <span>Date: {job.date}</span>
                          <span className="font-bold text-gray-700 dark:text-stone-300">
                            Total: {formatCurrency(job.grandTotal)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-Up Bottom Sheet Modal: Add Customer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-3xl border-t border-slate-200/50 dark:border-stone-800 max-h-[85vh] overflow-y-auto flex flex-col animate-slide-up select-none">
            
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900 z-10">
              <div className="flex items-center gap-1.5">
                <UserPlus className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-black text-gray-800 dark:text-stone-100">
                  Register New Client
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-250 dark:bg-stone-800 text-gray-500 dark:text-stone-400 active:scale-90 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomerSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Client Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Hegde"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Mobile Number / Contact *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 91823 XXXXX"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>



              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Customer Site Address
                </label>
                <textarea
                  placeholder="Site location details..."
                  rows={2}
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Internal Ledger Notes / CRM Details
                </label>
                <textarea
                  placeholder="Preferable service terms..."
                  rows={2}
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-750 text-white font-black text-xs py-3.5 rounded-xl shadow-md cursor-pointer active:scale-98 transition-all flex items-center justify-center gap-1.5"
                id="btn-confirm-add-customer"
              >
                <FileCheck className="w-4 h-4" />
                Confirm Client Entry
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Slide-Up Bottom Sheet Modal: Edit Customer */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-3xl border-t border-slate-200/50 dark:border-stone-800 max-h-[85vh] overflow-y-auto flex flex-col animate-slide-up select-none">
            
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900 z-10">
              <div className="flex items-center gap-1.5">
                <Edit className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-black text-gray-800 dark:text-stone-100">
                  Update Client Profile
                </h3>
              </div>
              <button
                onClick={() => setShowEditModal(null)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-250 dark:bg-stone-800 text-gray-500 dark:text-stone-400 active:scale-90 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditCustomerSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Client ID (Read Only)
                </label>
                <input
                  type="text"
                  disabled
                  value={showEditModal.id}
                  className="w-full text-xs bg-gray-100 dark:bg-stone-800 border-none text-gray-500 rounded-xl px-3.5 py-3 cursor-not-allowed font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Client Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Mobile Number / Contact *
                </label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>



              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Customer Site Address
                </label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={e => setEditAddress(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Internal Ledger Notes / CRM Details
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 text-white font-black text-xs py-3.5 rounded-xl shadow-md cursor-pointer active:scale-98 transition-all flex items-center justify-center gap-1.5"
                id="btn-confirm-edit-customer"
              >
                <FileCheck className="w-4 h-4" />
                Confirm Profile Updates
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Live QRScannerModal sheet overlay */}
      <QRScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScanSuccess={(decodedText) => {
          let cleanText = decodedText.trim();
          if (cleanText.includes("INVSRV-CUSTOMER:")) {
            cleanText = cleanText.substring(cleanText.indexOf("INVSRV-CUSTOMER:") + "INVSRV-CUSTOMER:".length);
          }
          setSearchTerm(cleanText);
          showToast(`🔍 Scanned code/query: ${cleanText}`, "success");
        }}
        title="Scan Customer ID sticker"
        placeholder="Or type customer ID/name..."
      />

    </div>
  );
}
