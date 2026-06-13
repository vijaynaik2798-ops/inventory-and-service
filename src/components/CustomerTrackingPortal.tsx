import React, { useState } from "react";
import { Customer, ServiceJob, JobStatus } from "../types";
import { 
  Search, 
  Wrench, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Flame, 
  RefreshCw, 
  Phone,
  Calendar,
  X,
  ChevronRight,
  ShieldCheck,
  Check
} from "lucide-react";
import { formatCurrency, formatDate } from "../utils/helpers";

interface CustomerTrackingPortalProps {
  services: ServiceJob[];
  customers: Customer[];
  initialJobId: string | null;
  onClose: () => void;
}

export default function CustomerTrackingPortal({
  services,
  customers,
  initialJobId,
  onClose
}: CustomerTrackingPortalProps) {
  const [searchJobId, setSearchJobId] = useState(initialJobId || "");
  const [activeTrackId, setActiveTrackId] = useState<string | null>(initialJobId);

  const cleanSearchId = (activeTrackId || "").trim().toUpperCase();
  const matchedJob = services.find(s => s.id.toUpperCase() === cleanSearchId);
  const customerObj = matchedJob ? customers.find(c => c.id === matchedJob.customerId) : null;

  // Handle Search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchJobId.trim()) {
      setActiveTrackId(searchJobId.trim());
    }
  };

  // Status mapping to badge CSS
  const getStatusBadgeStyles = (status: JobStatus) => {
    switch (status) {
      case "Delivered":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15";
      case "Completed":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/15";
      case "Waiting for Parts":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/15";
      case "Repairing":
        return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15";
      case "Under Inspection":
        return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-450 border border-cyan-500/15";
      case "Received":
      default:
        return "bg-stone-500/10 text-stone-600 dark:text-stone-400 border border-stone-500/15";
    }
  };

  // Helper status steps for visual tracker
  const statusOrder: JobStatus[] = [
    "Received",
    "Under Inspection",
    "Repairing",
    "Waiting for Parts",
    "Completed",
    "Delivered"
  ];

  const getStatusStepIndex = (status: JobStatus) => {
    return statusOrder.indexOf(status);
  };

  // Count items pending/delivered
  const totalItems = matchedJob?.items.length || 0;
  const completedItems = matchedJob?.items.filter(it => it.status === "Completed" || it.status === "Delivered").length || 0;
  const activePendingItems = matchedJob?.items.filter(it => it.status !== "Completed" && it.status !== "Delivered") || [];

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 font-sans text-gray-800 dark:text-stone-100 flex flex-col selection:bg-blue-500/10">
      
      {/* Visual Header Grid Panel */}
      <header className="bg-white dark:bg-stone-900 border-b border-gray-150 dark:border-stone-850 px-4 md:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md animate-pulse">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase text-gray-900 dark:text-white tracking-widest leading-none">
              Client Status Tracker
            </h1>
            <p className="text-[10px] text-gray-400 dark:text-stone-400 font-medium tracking-tight mt-1">
              Durable CCTV & Electronic Assets Portal
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex items-center gap-1.5 p-1.5 px-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-xs font-black text-gray-650 dark:text-stone-300 rounded-xl transition-all cursor-pointer select-none"
        >
          <X className="w-3.5 h-3.5" />
          <span>Exit Portal</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 md:p-6 space-y-5">
        
        {/* Search Job status input card */}
        <div className="bg-white dark:bg-stone-900 border border-gray-150 dark:border-stone-850 rounded-2xl p-4 shadow-xs">
          <form onSubmit={handleSearch} className="space-y-3">
            <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">
              Search Device Job Status
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 dark:text-stone-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Enter Job Card Ticket ID (e.g. INVSRV-2026-0001)"
                  value={searchJobId}
                  onChange={e => setSearchJobId(e.target.value)}
                  className="w-full text-xs pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-stone-850 border border-gray-200 dark:border-stone-805 rounded-xl font-bold uppercase placeholder-gray-400 dark:placeholder-stone-500 focus:outline-none focus:border-blue-500 text-gray-800 dark:text-white transition-all"
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-4 rounded-xl shadow-xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>Find Job</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>

        {/* Loading Spinner or Active Card */}
        {!cleanSearchId ? (
          <div className="py-12 text-center space-y-3 animate-fade-in">
            <ShieldCheck className="w-12 h-12 text-gray-300 dark:text-stone-700 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-black text-gray-500 dark:text-stone-400 uppercase tracking-wide">
                Live Server Status Link Active
              </h3>
              <p className="text-xs text-gray-400 dark:text-stone-500 max-w-xs mx-auto">
                Please enter your Ticket ID above or open a direct status tracking link shared via WhatsApp to audit progress.
              </p>
            </div>
          </div>
        ) : !matchedJob ? (
          <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 text-center space-y-4 animate-fade-in">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
            <div className="space-y-1">
              <h3 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                No Record Found
              </h3>
              <p className="text-xs text-gray-500 dark:text-stone-400 max-w-xs mx-auto leading-relaxed">
                We couldn't locate any active service ticket matching <span className="font-semibold text-gray-700 dark:text-stone-300 font-mono">"{cleanSearchId}"</span>. Please check for spelling typos in the ticket number or reach out to Customer Support.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 animate-slide-up">
            
            {/* Header statistics block */}
            <div className="bg-white dark:bg-stone-900 border border-gray-150 dark:border-stone-850 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <span className="text-[8px] font-mono font-black uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                    Ticket Identified
                  </span>
                  <h2 className="text-lg font-black text-gray-800 dark:text-white pt-1">
                    #{matchedJob.id}
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest block leading-none">
                    Job Created Date
                  </span>
                  <span className="text-xs font-bold text-gray-700 dark:text-stone-300 font-mono mt-1 block">
                    {formatDate(matchedJob.date)}
                  </span>
                </div>
              </div>

              {/* Secure Customer Verification Card */}
              <div className="p-3.5 bg-slate-50 dark:bg-stone-850/50 rounded-xl border border-gray-100 dark:border-stone-800 flex items-center justify-between">
                <div>
                  <span className="text-[7.5px] font-black uppercase text-gray-400 tracking-widest block">
                    Verified Customer
                  </span>
                  <p className="text-xs font-black text-gray-800 dark:text-stone-200 mt-0.5">
                    {customerObj ? customerObj.name : "Valued Client"}
                  </p>
                </div>
                {customerObj?.phone && (
                  <div className="flex items-center gap-1 bg-white dark:bg-stone-900 border border-gray-150 dark:border-stone-800 p-1.5 px-3 rounded-lg text-[10px] font-bold text-gray-500 dark:text-stone-400 font-mono select-all">
                    <Phone className="w-3 h-3 text-blue-500" />
                    <span>{customerObj.phone}</span>
                  </div>
                )}
              </div>

              {/* Completion Progress percentage bar */}
              <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-stone-800">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-extrabold text-gray-500 dark:text-stone-400 uppercase tracking-wider">
                    Execution status overview
                  </span>
                  <span className="font-black text-blue-600 dark:text-blue-400 font-mono">
                    {completedItems} of {totalItems} Items Restored
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-stone-800 overflow-hidden relative">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-1000 rounded-full"
                    style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* List of pending items overview section */}
            {activePendingItems.length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                    <Clock className="w-4 h-4 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                  </div>
                  <h3 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    Pending Materials Log ({activePendingItems.length})
                  </h3>
                </div>
                
                <div className="divide-y divide-amber-500/10">
                  {activePendingItems.map((item, index) => (
                    <div key={item.id} className="py-2 text-[11px] first:pt-0 last:pb-0 flex justify-between items-center font-medium">
                      <span className="text-gray-700 dark:text-stone-300">
                        • {item.productName} ({item.brand})
                      </span>
                      <span className="font-mono text-[9px] font-black bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded leading-none">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed individual Material/Devices listings */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                Asset & Component Breakdown ({totalItems})
              </h3>

              {matchedJob.items.map((item) => {
                const currentStepIdx = getStatusStepIndex(item.status);
                
                return (
                  <div 
                    key={item.id} 
                    className="bg-white dark:bg-stone-900 border border-gray-150 dark:border-stone-850 rounded-2xl overflow-hidden shadow-xs"
                  >
                    
                    {/* Item identifier banner */}
                    <div className="bg-slate-50 dark:bg-stone-850/60 p-4 border-b border-gray-150 dark:border-stone-850/65 flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="text-[8px] font-black font-mono bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-1.5 py-0.5 rounded uppercase mr-1">
                          Item ID: {item.id.split("-").pop()}
                        </span>
                        <h4 className="text-sm font-black text-gray-800 dark:text-white pt-1">
                          {item.productName}
                        </h4>
                        <p className="text-[10px] text-gray-550 dark:text-stone-400 font-medium">
                          Brand: <strong className="text-gray-700 dark:text-stone-300">{item.brand}</strong> | Model: <strong className="text-gray-700 dark:text-stone-300">{item.modelNo || "-"}</strong>
                        </p>
                      </div>

                      <span className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase leading-tight ${getStatusBadgeStyles(item.status)}`}>
                        {item.status}
                      </span>
                    </div>

                    {/* Stepper tracking container */}
                    <div className="p-4 md:p-5 space-y-5">
                      
                      {/* Horizontal progress indicators */}
                      <div className="relative pt-2">
                        <div className="absolute top-[21px] left-3 right-3 h-0.5 bg-slate-100 dark:bg-stone-800 z-0">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-700" 
                            style={{ 
                              width: `${
                                currentStepIdx === 0 ? 0 :
                                currentStepIdx === 1 ? 25 :
                                currentStepIdx === 2 ? 50 : 
                                currentStepIdx === 3 ? 60 : 
                                currentStepIdx === 4 ? 85 : 100
                              }%` 
                            }}
                          />
                        </div>

                        <div className="flex justify-between relative z-10">
                          {/* Step 1: Received */}
                          <div className="flex flex-col items-center">
                            <div className={`w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-colors ${
                              currentStepIdx >= 0
                                ? "bg-blue-500 text-white border-blue-500 scale-110 shadow-xs" 
                                : "bg-white dark:bg-stone-900 text-gray-300 dark:text-stone-700 border-gray-200 dark:border-stone-800"
                            }`}>
                              {currentStepIdx > 0 ? <Check className="w-3.5 h-3.5" /> : "1"}
                            </div>
                            <span className="text-[7.5px] font-black uppercase tracking-wider text-gray-400 dark:text-stone-500 mt-1.5">
                              Received
                            </span>
                          </div>

                          {/* Step 2: Under Inspection */}
                          <div className="flex flex-col items-center">
                            <div className={`w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-colors ${
                              currentStepIdx >= 1
                                ? "bg-blue-500 text-white border-blue-500 scale-110 shadow-xs" 
                                : "bg-white dark:bg-stone-900 text-gray-300 dark:text-stone-700 border-gray-200 dark:border-stone-800"
                            }`}>
                              {currentStepIdx > 1 ? <Check className="w-3.5 h-3.5" /> : "2"}
                            </div>
                            <span className="text-[7.5px] font-black uppercase tracking-wider text-gray-400 dark:text-stone-500 mt-1.5">
                              Inspected
                            </span>
                          </div>

                          {/* Step 3: Repairing */}
                          <div className="flex flex-col items-center">
                            <div className={`w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-colors ${
                              currentStepIdx >= 2
                                ? "bg-blue-600 text-white border-blue-600 scale-110 shadow-xs" 
                                : "bg-white dark:bg-stone-900 text-gray-300 dark:text-stone-700 border-gray-200 dark:border-stone-800"
                            }`}>
                              {currentStepIdx > 4 ? <Check className="w-3.5 h-3.5" /> : "3"}
                            </div>
                            <span className="text-[7.5px] font-black uppercase tracking-wider text-gray-400 dark:text-stone-500 mt-1.5">
                              Repairing
                            </span>
                          </div>

                          {/* Step 4: Completed */}
                          <div className="flex flex-col items-center">
                            <div className={`w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-colors ${
                              currentStepIdx >= 4
                                ? "bg-emerald-500 text-white border-emerald-500 scale-110 shadow-xs" 
                                : "bg-white dark:bg-stone-900 text-gray-300 dark:text-stone-700 border-gray-200 dark:border-stone-800"
                            }`}>
                              {currentStepIdx > 4 ? <Check className="w-3.5 h-3.5" /> : "4"}
                            </div>
                            <span className="text-[7.5px] font-black uppercase tracking-wider text-gray-400 dark:text-stone-500 mt-1.5">
                              Done
                            </span>
                          </div>

                          {/* Step 5: Delivered */}
                          <div className="flex flex-col items-center">
                            <div className={`w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-colors ${
                              currentStepIdx >= 5
                                ? "bg-emerald-600 text-white border-emerald-600 scale-110 shadow-xs" 
                                : "bg-white dark:bg-stone-900 text-gray-300 dark:text-stone-700 border-gray-200 dark:border-stone-800"
                            }`}>
                              {currentStepIdx >= 5 ? <Check className="w-3.5 h-3.5" /> : "5"}
                            </div>
                            <span className="text-[7.5px] font-black uppercase tracking-wider text-gray-400 dark:text-stone-500 mt-1.5">
                              Delivered
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Diagnostic/Warning Details if active */}
                      <div className="space-y-2.5">
                        
                        {/* Serial Identifier */}
                        {item.serialNo && (
                          <div className="text-[10px] text-gray-500 dark:text-stone-400 flex justify-between select-all leading-tight font-mono">
                            <span>Component S/N ID:</span>
                            <strong className="text-gray-700 dark:text-stone-300 tracking-wider">
                              {item.serialNo}
                            </strong>
                          </div>
                        )}

                        {/* Problem Description */}
                        {item.problemDescription && (
                          <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl border border-gray-100 dark:border-stone-805/50 text-[10px] leading-relaxed text-gray-600 dark:text-stone-300">
                            <span className="block text-[7.5px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
                              Stated Malfunction
                            </span>
                            {item.problemDescription}
                          </div>
                        )}

                        {/* Waiting for Parts Notice Block */}
                        {item.status === "Waiting for Parts" && (
                          <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-[10px] text-amber-800 dark:text-amber-400 font-bold flex gap-2 animate-pulse leading-relaxed">
                            <AlertTriangle className="w-4 h-4 text-amber-550 shrink-0" />
                            <div>
                              <strong className="block text-amber-900 dark:text-amber-300 text-[11px]">🔧 Ordered Spare Materials</strong>
                              Our diagnosis requires replacement microcomponents. We have ordered parts from our supplier network. Work will resume immediately upon delivery.
                            </div>
                          </div>
                        )}

                        {/* Burnt Damage notices */}
                        {item.isBurnt && (
                          <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl text-[10px] text-rose-800 dark:text-rose-400 font-bold flex gap-2 leading-relaxed">
                            <Flame className="w-4 h-4 text-rose-500 shrink-0" />
                            <div>
                              <strong className="block text-rose-900 dark:text-rose-300 text-[11px]">🔥 Microcircuity Surge/Burnt Track Detected</strong>
                              {item.burntDetails || "Surge / Voltage leak damaged key PCB pathways. Expert high-precision manual repair in progress."}
                            </div>
                          </div>
                        )}

                        {/* Product swaps / replacements */}
                        {item.isProductReplaced && (
                          <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[10px] text-indigo-800 dark:text-indigo-455 font-bold flex gap-2 leading-relaxed">
                            <RefreshCw className="w-4 h-4 text-indigo-500 shrink-0" />
                            <div>
                              <strong className="block text-indigo-900 dark:text-indigo-400 text-[11px]">🔄 Full Unit Replaced / Swapped</strong>
                              This equipment has been swapped with a fresh replacement unit:
                              <div className="grid grid-cols-2 gap-1.5 mt-1.5 p-1.5 bg-white dark:bg-stone-900 border border-indigo-500/10 rounded-lg text-[9px] font-mono select-all">
                                <div>Model No: <strong className="text-gray-700 dark:text-stone-300">{item.replacementModelNo || item.modelNo}</strong></div>
                                <div>Serial No: <strong className="text-gray-700 dark:text-stone-300">{item.replacementSerialNo}</strong></div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>

            {/* Verification Footer Assurance */}
            <div className="text-center py-5 space-y-1">
              <p className="text-[9px] font-bold text-gray-400 dark:text-stone-500 uppercase tracking-widest flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-550" />
                <span>Secure End-To-End Enterprise Logistics</span>
              </p>
              <p className="text-[8.5px] text-gray-400 dark:text-stone-600 max-w-xs mx-auto leading-relaxed">
                Statuses update in real-time. For manual modifications or inquiries regarding spares billing, please coordinate with our support team.
              </p>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
