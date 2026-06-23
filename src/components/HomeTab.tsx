import { useMemo } from "react";
import { ServiceJob, InventoryItem, Customer } from "../types";
import {
  Wrench,
  Package,
  Users,
  TrendingUp,
  Plus,
  Search,
  PackageOpen,
  ClipboardList,
  AlertTriangle
} from "lucide-react";
import { formatCurrency } from "../utils/helpers";

interface HomeTabProps {
  currentUser: any;
  services: ServiceJob[];
  inventory: InventoryItem[];
  customers: Customer[];
  onNavigateTab: (tab: "home" | "customers" | "services" | "stock" | "more") => void;
  onOpenModal: (modal: string) => void;
  showToast: (msg: string) => void;
}

export default function HomeTab({
  currentUser,
  services,
  inventory,
  customers,
  onNavigateTab,
  onOpenModal,
  showToast
}: HomeTabProps) {
  // Memoized stats calculation
  const stats = useMemo(() => {
    let totalJobs = services.length;
    let totalItems = 0;
    let pendingItemsCount = 0;
    let totalUnpaidRevenue = 0;

    services.forEach(job => {
      totalItems += job.items.length;
      
      // Calculate unpaid/partial balances
      if (job.paymentStatus !== "Paid") {
        const balance = job.grandTotal - (job.paidAmount || 0);
        totalUnpaidRevenue += Math.max(0, balance);
      }

      job.items.forEach(item => {
        if (
          item.status === "Received" ||
          item.status === "Under Inspection" ||
          item.status === "Repairing" ||
          item.status === "Waiting for Parts"
        ) {
          pendingItemsCount++;
        }
      });
    });

    const lowStockItems = inventory.filter(item => item.quantity < 5);

    return {
      totalJobs,
      totalItems,
      pendingItemsCount,
      totalUnpaidRevenue,
      lowStockCount: lowStockItems.length,
      lowStockItems
    };
  }, [services, inventory]);

  // Aggregate item statuses for the custom bar chart
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Received: 0,
      "Under Inspection": 0,
      Repairing: 0,
      "Waiting for Parts": 0,
      Completed: 0,
      Delivered: 0
    };

    services.forEach(job => {
      job.items.forEach(item => {
        if (counts[item.status] !== undefined) {
          counts[item.status]++;
        }
      });
    });

    return counts;
  }, [services]);

  const statusColors: Record<string, string> = {
    Received: "bg-blue-500",
    "Under Inspection": "bg-purple-500",
    Repairing: "bg-amber-500",
    "Waiting for Parts": "bg-rose-500",
    Completed: "bg-emerald-500",
    Delivered: "bg-gray-400"
  };

  const statusBorderColors: Record<string, string> = {
    Received: "border-blue-500/20",
    "Under Inspection": "border-purple-500/20",
    Repairing: "border-amber-500/20",
    "Waiting for Parts": "border-rose-500/20",
    Completed: "border-emerald-500/20",
    Delivered: "border-gray-500/20"
  };

  const totalItemsCountForChart = (Object.values(statusCounts) as number[]).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 bg-[#f8fafc] dark:bg-stone-950 transition-colors duration-200 pb-20 select-none">
      
      {/* Welcome & Role Card */}
      <div className="bg-gradient-to-br from-[#059669] to-[#2563eb] rounded-3xl p-5 text-white relative overflow-hidden shadow-lg select-none">
        <div className="relative z-10 flex flex-col justify-between h-full">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Workspace Active</span>
              <h1 className="text-2xl font-black mt-1 leading-none tracking-tighter truncate max-w-[200px]">
                {currentUser ? currentUser.name : "Team InvService"}
              </h1>
            </div>
            <span className="bg-white/10 text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-md border border-white/10 shrink-0">
              {currentUser ? currentUser.role : "Staff"}
            </span>
          </div>
          
          <div className="mt-8 flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold opacity-80 tracking-widest">Service & Stock Intelligence</span>
              <span className="text-[11px] font-semibold opacity-70 truncate max-w-[170px]">
                {currentUser ? currentUser.email : "system@invservice.com"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black font-mono leading-none">{stats.pendingItemsCount}</span>
              <span className="block text-[8px] font-extrabold uppercase tracking-widest opacity-70">Active Tasks</span>
            </div>
          </div>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
      </div>

      {/* Numerical Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Card 1: Pending Reps */}
        <div 
          onClick={() => onNavigateTab("services")}
          className="bg-white dark:bg-stone-900 border border-slate-100 dark:border-stone-800 p-4 rounded-3xl text-left shadow-sm cursor-pointer hover:border-[#059669]/40 hover:shadow transition-all active:scale-95 group relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <span className="text-[#059669] dark:text-emerald-400 p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
              <Wrench className="w-4.5 h-4.5" />
            </span>
            {stats.pendingItemsCount > 0 && (
              <span className="text-[8px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                Active
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-stone-100 tracking-tighter mt-4">
            {stats.pendingItemsCount}
          </div>
          <p className="text-[9px] uppercase font-black text-slate-400 dark:text-stone-300 tracking-wider mt-0.5">
            Pending Devices
          </p>
        </div>

        {/* Card 2: Low Stock */}
        <div 
          onClick={() => onNavigateTab("stock")}
          className="bg-white dark:bg-stone-900 border border-slate-100 dark:border-stone-800 p-4 rounded-3xl text-left shadow-sm cursor-pointer hover:border-[#059669]/40 hover:shadow transition-all active:scale-95 group relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <span className="text-[#2563eb] p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-2xl">
              <Package className="w-4.5 h-4.5" />
            </span>
            {stats.lowStockCount > 0 && (
              <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Alert
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-stone-100 tracking-tighter mt-4">
            {stats.lowStockCount}
          </div>
          <p className="text-[9px] uppercase font-black text-slate-400 dark:text-stone-300 tracking-wider mt-0.5">
            Low stock alerts
          </p>
        </div>

        {/* Card 3: Total Service Tickets */}
        <div 
          onClick={() => onNavigateTab("services")}
          className="bg-white dark:bg-stone-900 border border-slate-100 dark:border-stone-800 p-4 rounded-3xl text-left shadow-sm cursor-pointer hover:border-[#059669]/40 hover:shadow transition-all active:scale-95 group relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <span className="text-purple-600 p-2.5 bg-purple-50 dark:bg-purple-500/10 rounded-2xl">
              <ClipboardList className="w-4.5 h-4.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-stone-100 tracking-tighter mt-4">
            {stats.totalJobs}
          </div>
          <p className="text-[9px] uppercase font-black text-slate-400 dark:text-stone-300 tracking-wider mt-0.5">
            Total Tickets
          </p>
        </div>

        {/* Card 4: Receivable Payments */}
        <div 
          onClick={() => onNavigateTab("more")}
          className="bg-white dark:bg-stone-900 border border-slate-100 dark:border-stone-800 p-4 rounded-3xl text-left shadow-sm cursor-pointer hover:border-[#059669]/40 hover:shadow transition-all active:scale-95 group relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <span className="text-amber-600 p-2.5 bg-amber-50 dark:bg-amber-500/10 rounded-2xl">
              <TrendingUp className="w-4.5 h-4.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-stone-100 tracking-tighter mt-4 truncate">
            {formatCurrency(stats.totalUnpaidRevenue)}
          </div>
          <p className="text-[9px] uppercase font-black text-slate-400 dark:text-stone-300 tracking-wider mt-0.5">
            Owed Balance
          </p>
        </div>
      </div>

      {/* Quick Interactive Button Rails */}
      <div className="space-y-1.5 pt-1">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
          Quick Access Actions
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => onOpenModal("newCustomer")}
            className="flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#059669] to-[#2563eb] flex items-center justify-center text-white shadow-md relative overflow-hidden active:scale-90 hover:scale-105 transition-all">
              <Plus className="w-5 h-5 relative z-10" />
              <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-white/10 rounded-full blur-lg"></div>
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-stone-300 tracking-tighter uppercase mt-0.5">New Client</span>
          </button>
          
          <button
            onClick={() => onOpenModal("newJob")}
            className="flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#059669] to-[#2563eb] flex items-center justify-center text-white shadow-md relative overflow-hidden active:scale-90 hover:scale-105 transition-all">
              <Plus className="w-5 h-5 relative z-10" />
              <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-white/10 rounded-full blur-lg"></div>
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-stone-300 tracking-tighter uppercase mt-0.5">Create Job</span>
          </button>

          <button
            onClick={() => onOpenModal("addStock")}
            className="flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#059669] to-[#2563eb] flex items-center justify-center text-white shadow-md relative overflow-hidden active:scale-90 hover:scale-105 transition-all">
              <Plus className="w-5 h-5 relative z-10" />
              <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-white/10 rounded-full blur-lg"></div>
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-stone-300 tracking-tighter uppercase mt-0.5">Add Stock</span>
          </button>
        </div>
      </div>

      {/* Interactive Status Distribution Bar Chart */}
      <div className="p-5 bg-white dark:bg-stone-900 border border-slate-100 dark:border-stone-800 rounded-3xl shadow-sm">
        <h3 className="text-xs font-bold text-slate-800 dark:text-stone-100 mb-1 leading-tight">
          Workflow Allocation
        </h3>
        <p className="text-[10px] text-slate-400 dark:text-stone-400 font-medium mb-3.5">
          Status summary counts. Tapping navigates to Services ledger.
        </p>

        {/* Custom Grid Layout representing a simple bar chart */}
        <div className="space-y-3">
          {Object.entries(statusCounts).map(([status, rawCount]) => {
            const count = rawCount as number;
            const pct = Math.round((count / totalItemsCountForChart) * 100);
            return (
              <div 
                key={status} 
                onClick={() => onNavigateTab("services")}
                className="flex items-center gap-3 cursor-pointer group"
              >
                {/* Status name */}
                <span className="w-24 text-[10px] font-bold text-slate-500 dark:text-stone-400 truncate group-hover:text-emerald-500 transition-colors">
                  {status}
                </span>

                {/* Progress scale */}
                <div className="flex-1 bg-slate-50 dark:bg-stone-800/80 h-2 rounded-full overflow-hidden relative">
                  <div 
                    className={`${statusColors[status] || "bg-slate-400"} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${count > 0 ? Math.max(8, pct) : 0}%` }}
                  ></div>
                </div>

                {/* Quantitative digits */}
                <span className="w-8 text-right text-xs font-extrabold font-mono text-slate-700 dark:text-stone-300">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Critical Stock Threshold Alerts Table */}
      {stats.lowStockCount > 0 ? (
        <div className="p-4 bg-rose-500/10 border border-rose-100 dark:border-rose-950/40 rounded-3xl">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 mb-2.5">
            <AlertTriangle className="w-4 h-4 animate-bounce shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">
              Critical Low Stock Alert
            </span>
          </div>

          <div className="space-y-2 max-h-[160px] overflow-y-auto">
            {stats.lowStockItems.map((item, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between p-3 bg-white/80 dark:bg-stone-900/60 rounded-2xl border border-rose-200/20 hover:border-emerald-500/20 transition-all shadow-sm"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[11px] font-bold text-slate-800 dark:text-stone-200 truncate">
                    {item.productName}
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 dark:text-stone-500 uppercase mt-0.5 truncate">
                    Mod: {item.modelNo} | Loc: {item.location}
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-black px-2 mt-0.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">
                    Qty: {item.quantity}
                  </span>
                  <button
                    onClick={() => onOpenModal("addStock")}
                    className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all active:scale-90"
                    title="Procure Items"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 p-3.5 bg-[#f0fdf4] dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-950/30 rounded-3xl text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
          <PackageOpen className="w-4 h-4 text-emerald-600" />
          <span>All Warehouses stocked properly. No alarms!</span>
        </div>
      )}

    </div>
  );
}
