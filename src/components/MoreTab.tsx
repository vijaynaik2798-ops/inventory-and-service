import React, { useState, useMemo, useEffect } from "react";
import { Staff, WhatsAppTemplate, Customer, ServiceJob, InventoryItem } from "../types";
import {
  Users,
  MapPin,
  Settings,
  MessageSquare,
  FileCheck,
  Undo2,
  HardDrive,
  Download,
  Info,
  LogOut,
  X,
  Plus,
  Barcode,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  QrCode,
  DollarSign,
  Pencil,
  Trash2,
  Check,
  RefreshCw,
  CloudLightning,
  UserCheck
} from "lucide-react";
import {
  initGoogleAuth,
  googleSignIn,
  googleSignOut,
  uploadBackupToDrive,
  downloadBackupFromDrive,
  getAccessToken,
  findBackupFile
} from "../utils/googleDrive";

import {
  convertCustomersToCSV,
  convertJobsToCSV,
  convertInventoryToCSV,
  triggerCSVDownload,
  formatCurrency,
  generateQRUrl
} from "../utils/helpers";
import { DEFAULT_LOCATIONS, DEFAULT_STAFF, DEFAULT_WA_TEMPLATES } from "../utils/storage";

interface MoreTabProps {
  technicians: Staff[];
  locations: string[];
  waTemplates: WhatsAppTemplate[];
  customers: Customer[];
  services: ServiceJob[];
  inventory: InventoryItem[];
  currentUser: any;
  onUpdateTechnicians: (staff: Staff[]) => void;
  onUpdateLocations: (locs: string[]) => void;
  onUpdateWaTemplates: (temps: WhatsAppTemplate[]) => void;
  onLogout: () => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export default function MoreTab({
  technicians,
  locations,
  waTemplates,
  customers,
  services,
  inventory,
  currentUser,
  onUpdateTechnicians,
  onUpdateLocations,
  onUpdateWaTemplates,
  onLogout,
  showToast
}: MoreTabProps) {
  // Navigation inside More tab via collapsible sections
  const [activeSection, setActiveSection] = useState<"none" | "staff" | "locations" | "wa" | "reports" | "drive">("none");

  // Staff States
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState<Staff["role"]>("Technician");
  const [staffLoginId, setStaffLoginId] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // Location States
  const [showAddLoc, setShowAddLoc] = useState(false);
  const [locText, setLocText] = useState("");
  const [editingLocIndex, setEditingLocIndex] = useState<number | null>(null);
  const [editingLocText, setEditingLocText] = useState("");
  const [deletingLocIndex, setDeletingLocIndex] = useState<number | null>(null);
  const [deletingTechId, setDeletingTechId] = useState<string | null>(null);

  // WhatsApp Templates States
  const [selectedTemplateStatus, setSelectedTemplateStatus] = useState<WhatsAppTemplate["status"]>("Received");
  const [templateText, setTemplateText] = useState("");

  // Day-to-day custom business report range states
  const [reportPreset, setReportPreset] = useState<"today" | "yesterday" | "last7" | "custom">("today");
  const [reportStartDate, setReportStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Google Drive Real Integration States
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isBackupRestoring, setIsBackupRestoring] = useState(false);
  const [isBackupPushing, setIsBackupPushing] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => {
    return localStorage.getItem("drive_auto_backup_enabled") !== "false";
  });
  const [lastGdSync, setLastGdSync] = useState(() => {
    return localStorage.getItem("inventory_service_gd_last_sync_time") || "Never Synced";
  });

  // Track Google authentication changes
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );

    // Listen to background sync date updates
    const handleSyncEvent = (e: Event) => {
      const updatedTime = (e as CustomEvent).detail;
      if (updatedTime) {
        setLastGdSync(updatedTime);
      }
    };
    window.addEventListener("gd_backup_synced", handleSyncEvent);

    return () => {
      unsubscribe();
      window.removeEventListener("gd_backup_synced", handleSyncEvent);
    };
  }, []);

  // Calculate high level Business Statistics
  const stats = useMemo(() => {
    let totalRevenuePaid = 0;
    let pendingPayments = 0;
    
    services.forEach(job => {
      totalRevenuePaid += job.paidAmount || 0;
      if (job.paymentStatus !== "Paid") {
        pendingPayments += Math.max(0, job.grandTotal - (job.paidAmount || 0));
      }
    });

    const totalStockVal = inventory.reduce((acc, item) => acc + item.quantity, 0);

    return {
      revenuePaid: totalRevenuePaid,
      pendingCollection: pendingPayments,
      jobsCount: services.length,
      clientsCount: customers.length,
      stockItemsCount: totalStockVal
    };
  }, [services, customers, inventory]);

  // Load active template on status selector change
  useMemo(() => {
    const matched = waTemplates.find(t => t.status === selectedTemplateStatus);
    if (matched) {
      setTemplateText(matched.template);
    }
  }, [selectedTemplateStatus, waTemplates]);

  // Handler: Add staff
  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isOwner = currentUser?.role === "Owner";
    if (!isOwner) {
      showToast("Access Denied: Only Business Owners can register new workers.", "error");
      return;
    }
    if (!staffName.trim()) return;

    const formattedLoginId = staffLoginId.trim().toLowerCase();
    if (!formattedLoginId) {
      showToast("Login ID is required for secure staff credentials.", "error");
      return;
    }
    if (!staffPassword.trim()) {
      showToast("Password is required.", "error");
      return;
    }

    // Check for unique Login ID
    const alreadyTaken = technicians.some(
      t => (t.loginId && t.loginId.toLowerCase() === formattedLoginId) ||
           t.id.toLowerCase() === formattedLoginId
    );
    if (alreadyTaken) {
      showToast("This Login ID is already assigned to another worker.", "error");
      return;
    }

    const newStaff: Staff = {
      id: "STF_" + Math.random().toString(36).substr(2, 5).toUpperCase(),
      name: staffName.trim(),
      role: staffRole,
      status: "Active",
      loginId: formattedLoginId,
      password: staffPassword.trim()
    };

    const nextStaffList = [...technicians, newStaff];
    onUpdateTechnicians(nextStaffList);
    setStaffName("");
    setStaffLoginId("");
    setStaffPassword("");
    setShowAddStaffModal(false);
    showToast(`Registered employee: ${newStaff.name}! Unique ID: ${newStaff.id}`, "success");
  };

  // Handler: Add physical location spot
  const handleAddLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locText.trim()) return;

    const formattedLoc = locText.trim();
    if (locations.includes(formattedLoc)) {
      showToast("Location node already exists", "error");
      return;
    }

    const nextLocs = [...locations, formattedLoc];
    onUpdateLocations(nextLocs);
    setLocText("");
    setShowAddLoc(false);
    showToast(`Registered spot: ${formattedLoc}`, "success");
  };

  // Handler: Save edited physical location spot name
  const handleSaveEdit = (idx: number) => {
    const trimmed = editingLocText.trim();
    if (!trimmed) {
      showToast("Location name cannot be empty", "error");
      return;
    }
    const currentName = locations[idx];
    if (trimmed !== currentName && locations.includes(trimmed)) {
      showToast("Location name already exists", "error");
      return;
    }
    const nextLocs = [...locations];
    nextLocs[idx] = trimmed;
    onUpdateLocations(nextLocs);
    setEditingLocIndex(null);
    showToast("Location renamed successfully", "success");
  };

  // Handler: Save custom WA templates
  const handleSaveWhatsAppTemplate = () => {
    const updated = waTemplates.map(t => {
      if (t.status === selectedTemplateStatus) {
        return { ...t, template: templateText };
      }
      return t;
    });

    onUpdateWaTemplates(updated);
    showToast("WhatsApp status template modified successfully!", "success");
  };

  // Handler: Reset default template
  const handleResetWaTemplateToDefault = () => {
    const originalDefault = DEFAULT_WA_TEMPLATES.find(t => t.status === selectedTemplateStatus);
    if (originalDefault) {
      setTemplateText(originalDefault.template);
      showToast("Template reset to original defaults.", "info");
    }
  };

  // Handler: Calculate filtered jobs based on day-to-day picker choices
  const filteredJobsForExport = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    
    const getYesterdayStr = () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    };
    const yesterdayStr = getYesterdayStr();

    const getLast7DaysStr = () => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().split("T")[0];
    };
    const last7Str = getLast7DaysStr();

    return services.filter(job => {
      // job.date is formatted as YYYY-MM-DD or standard ISO date representation
      const jobDateStr = job.date || job.createdAt?.split("T")[0];
      if (!jobDateStr) return false;

      // Ensure clean string format
      const jobDateOnly = jobDateStr.trim().split(" ")[0];

      if (reportPreset === "today") {
        return jobDateOnly === todayStr;
      } else if (reportPreset === "yesterday") {
        return jobDateOnly === yesterdayStr;
      } else if (reportPreset === "last7") {
        return jobDateOnly >= last7Str && jobDateOnly <= todayStr;
      } else if (reportPreset === "custom") {
        return jobDateOnly >= reportStartDate && jobDateOnly <= reportEndDate;
      }
      return true;
    });
  }, [services, reportPreset, reportStartDate, reportEndDate]);

  const handleExportFilteredJobs = () => {
    if (filteredJobsForExport.length === 0) {
      showToast("No active service jobs match the selected date threshold.", "error");
      return;
    }
    const csv = convertJobsToCSV(filteredJobsForExport, customers);
    const rangeLabel = reportPreset === "custom" 
      ? `custom_${reportStartDate}_to_${reportEndDate}` 
      : `day_to_day_${reportPreset}`;
    triggerCSVDownload(csv, `InvService_DayToDay_${rangeLabel}_${new Date().toISOString().split("T")[0]}.csv`);
    showToast(`Successfully downloaded day-to-day ledger containing ${filteredJobsForExport.length} matches!`, "success");
  };

  // Handler: Trigger reports CSV downloads
  const handleExportClients = () => {
    const csv = convertCustomersToCSV(customers);
    triggerCSVDownload(csv, `InvService_Clients_${new Date().toISOString().split("T")[0]}.csv`);
    showToast("Clients spreadsheet CSV downloaded successfully!", "success");
  };

  const handleExportJobs = () => {
    const csv = convertJobsToCSV(services, customers);
    triggerCSVDownload(csv, `InvService_ServiceJobs_${new Date().toISOString().split("T")[0]}.csv`);
    showToast("Jobs history spreadsheet CSV downloaded successfully!", "success");
  };

  const handleExportInventory = () => {
    const csv = convertInventoryToCSV(inventory);
    triggerCSVDownload(csv, `InvService_InventoryStock_${new Date().toISOString().split("T")[0]}.csv`);
    showToast("Inventory index spreadsheet CSV downloaded successfully!", "success");
  };

  // Google Drive Real Action Handlers
  const handleGoogleSignIn = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        showToast("Successfully linked your owner Google Drive! ☁", "success");
      }
    } catch (err) {
      showToast("Google connection initiation failed.", "error");
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await googleSignOut();
      showToast("Google Drive session disconnected successfully.", "info");
    } catch (err) {
      showToast("Sign out failed.", "error");
    }
  };

  const handleManualBackupGD = async () => {
    const token = googleToken || getAccessToken();
    if (!token) {
      showToast("Please authenticate with Google to start backing up.", "error");
      return;
    }

    setIsBackupPushing(true);
    try {
      const storageObj = (window as any).storage;
      let targetJobCounter = 0;
      if (storageObj) {
        const counterVal = await storageObj.getItem("inventory_service_job_counter", { shared: true });
        if (counterVal) targetJobCounter = parseInt(counterVal, 10);
      } else {
        const counterVal = localStorage.getItem("inventory_service_job_counter");
        if (counterVal) targetJobCounter = parseInt(counterVal, 10);
      }

      const payload = {
        customers,
        services,
        inventory,
        locations,
        technicians,
        waTemplates,
        jobCounter: targetJobCounter
      };

      const meta = await uploadBackupToDrive(token, payload);
      const nowStr = new Date(meta.modifiedTime).toLocaleString("en-IN");
      localStorage.setItem("inventory_service_gd_last_sync_time", nowStr);
      setLastGdSync(nowStr);
      showToast("Database safely backed up to your Google Drive! ☁", "success");
    } catch (err: any) {
      console.error(err);
      showToast(`Drive upload failed: ${err.message || err}`, "error");
    } finally {
      setIsBackupPushing(false);
    }
  };

  const handleRestoreGD = async () => {
    const token = googleToken || getAccessToken();
    if (!token) {
      showToast("Connect Google Account to perform recovery tasks.", "error");
      return;
    }

    const confirmed = window.confirm(
      "⚠ WARNING: Restoring from Google Drive will COMPLETELY replace your current clients, service jobs, WhatsApp templates, and stock catalogs with the version stored in the cloud. This cannot be undone. Are you sure you want to proceed?"
    );
    if (!confirmed) return;

    setIsBackupRestoring(true);
    try {
      // Find the backup file on Drive first
      const fileMeta = await findBackupFile(token);
      if (!fileMeta) {
        showToast("No active backup found on your active Google Drive account.", "error");
        return;
      }

      // Download payload
      const restored = await downloadBackupFromDrive(token, fileMeta.id);
      if (!restored) {
        throw new Error("Empty backup payload returned.");
      }

      // Overwrite storage
      const storageObj = (window as any).storage;
      const saveState = async (key: string, list: any) => {
        if (list) {
          localStorage.setItem(key, JSON.stringify(list));
          if (storageObj && typeof storageObj.setItem === "function") {
            await storageObj.setItem(key, JSON.stringify(list), { shared: true });
          }
        }
      };

      await saveState("inventory_service_customers", restored.customers);
      await saveState("inventory_service_services", restored.services);
      await saveState("inventory_service_inventory", restored.inventory);
      await saveState("inventory_service_locations", restored.locations);
      await saveState("inventory_service_technicians", restored.technicians);
      await saveState("inventory_service_wa_templates", restored.waTemplates);

      if (restored.jobCounter !== undefined) {
        localStorage.setItem("inventory_service_job_counter", restored.jobCounter.toString());
        if (storageObj && typeof storageObj.setItem === "function") {
          await storageObj.setItem("inventory_service_job_counter", restored.jobCounter.toString(), { shared: true });
        }
      }

      showToast("App database restored! Reloading application workspace...", "success");
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err: any) {
      console.error(err);
      showToast(`Database restore failed: ${err.message || err}`, "error");
    } finally {
      setIsBackupRestoring(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50 dark:bg-stone-950 transition-colors duration-200 pb-20 select-none">
      
      {/* Quick Business Overview Report summary cards */}
      <div className="p-5 bg-white dark:bg-stone-900 border border-slate-100 dark:border-stone-800 rounded-3xl shadow-sm text-left select-none">
        <h3 className="text-[10px] font-black uppercase text-slate-400 dark:text-white tracking-widest flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
          <span>Business Statistics Summary</span>
        </h3>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <span className="text-[9px] text-slate-400 dark:text-stone-300 block font-black uppercase tracking-wider">Amount Received</span>
            <span className="text-base font-black text-[#059669] dark:text-white">
              {formatCurrency(stats.revenuePaid)}
            </span>
          </div>

          <div>
            <span className="text-[9px] text-slate-400 dark:text-stone-300 block font-black uppercase tracking-wider">Pending Collection</span>
            <span className="text-base font-black text-rose-600 dark:text-white">
              {formatCurrency(stats.pendingCollection)}
            </span>
          </div>

          <div className="border-t border-slate-100 dark:border-stone-800/80 pt-3.5 col-span-2 grid grid-cols-3 gap-2 text-[9px] uppercase tracking-wider text-slate-500 dark:text-white font-extrabold select-none">
            <div>Clients: <strong className="text-slate-800 dark:text-white">{stats.clientsCount}</strong></div>
            <div>Tickets: <strong className="text-slate-800 dark:text-white">{stats.jobsCount}</strong></div>
            <div>Stocks: <strong className="text-slate-800 dark:text-white">{stats.stockItemsCount}</strong></div>
          </div>
        </div>
      </div>

      {/* Accordion Settings Rails */}
      <div className="space-y-3">
        
        {/* Module 1: Staff Manager */}
        <div className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={() => setActiveSection(activeSection === "staff" ? "none" : "staff")}
            className="w-full flex items-center justify-between p-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-700 dark:text-stone-200 outline-none hover:bg-slate-50 dark:hover:bg-stone-800"
          >
            <span className="flex items-center gap-2">
              <Users className="w-4.5 h-4.5 text-emerald-500" />
              Staff & Technician Database
            </span>
            {activeSection === "staff" ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {activeSection === "staff" && (
            <div className="p-4 border-t border-gray-100 dark:border-stone-800 space-y-3 text-left animate-slide-up">
              {currentUser?.role !== "Owner" && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800/30 p-2.5 rounded-xl text-[10px] text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
                  ⚠️ <strong>Owner Access Only:</strong> You are currently signed in as a <strong>{currentUser?.role || "Staff"}</strong>. Only the Business Owner can register new workers or dismiss active technicians.
                </div>
              )}

              <div className="flex justify-between items-center bg-gray-50 dark:bg-stone-800/40 p-2.5 rounded-lg border border-gray-100 dark:border-stone-800">
                <span className="text-[10px] uppercase font-bold text-gray-500">
                  Registered Workers ({technicians.length})
                </span>
                <button
                  onClick={() => {
                    if (currentUser?.role !== "Owner") {
                      showToast("Access Denied: Only Business Owners can register new workers.", "error");
                      return;
                    }
                    setShowAddStaffModal(true);
                  }}
                  className={`text-[9px] font-black px-2.5 py-1 rounded transition-all transition-colors cursor-pointer ${
                    currentUser?.role === "Owner"
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 text-white"
                      : "bg-gray-200 dark:bg-stone-800 text-gray-400 dark:text-stone-500 cursor-not-allowed"
                  }`}
                >
                  {currentUser?.role !== "Owner" && "🔒 "} + Add Worker
                </button>
              </div>

              <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                {technicians.map(tech => {
                  const activeAssigned = services.filter(j => j.items.some(it => it.technicianId === tech.id && it.status !== "Completed" && it.status !== "Delivered")).length;
                  const isOwner = currentUser?.role === "Owner";
                  return (
                    <div
                      key={tech.id}
                      className="p-2.5 bg-slate-50 dark:bg-stone-900/60 rounded-xl border border-gray-200/50 flex justify-between items-center"
                    >
                      <div>
                        <div className="text-xs font-bold text-gray-800 dark:text-stone-200">
                          {tech.name}
                        </div>
                        <span className="text-[9px] font-semibold text-gray-400 capitalize block">
                          Role: {tech.role} | ID: {tech.id}
                        </span>
                        {isOwner && tech.loginId && (
                          <div className="mt-1 flex flex-col gap-0.5 bg-emerald-500/5 dark:bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/10 max-w-[200px]">
                            <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-400">
                              🔓 Login: <span className="font-mono text-gray-700 dark:text-stone-300 select-all font-bold">{tech.loginId}</span>
                            </span>
                            <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                              🔑 Pass: 
                              <span className="font-mono text-gray-700 dark:text-stone-300 select-all bg-emerald-100 dark:bg-emerald-950/40 px-1 rounded font-bold">
                                {tech.password || "password"}
                              </span>
                            </span>
                          </div>
                        )}
                        {isOwner && !tech.loginId && (
                          <button
                            onClick={() => {
                              const base = tech.name.trim().toLowerCase().replace(/\s+/g, ".");
                              const updatedTechs = technicians.map(t => {
                                if (t.id === tech.id) {
                                  return { ...t, loginId: base, password: "password" };
                                }
                                return t;
                              });
                              onUpdateTechnicians(updatedTechs);
                              showToast(`Created default credentials for ${tech.name}! ID: ${base}, Pass: password`, "success");
                            }}
                            className="mt-1 text-[8.5px] font-black text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-0.5 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded cursor-pointer transition border border-rose-100 dark:border-rose-900/30 w-fit"
                          >
                            ⚙ Generate Login Credentials
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400">
                          {activeAssigned} active
                        </span>
                        
                        {deletingTechId === tech.id ? (
                          <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-500/10 p-1 px-1.5 rounded-lg border border-rose-200 dark:border-rose-900/30 animate-pulse">
                            <span className="text-[8px] font-black uppercase text-rose-600 dark:text-rose-400 select-none">Delete?</span>
                            <button
                              onClick={() => {
                                const updatedTechs = technicians.filter(t => t.id !== tech.id);
                                onUpdateTechnicians(updatedTechs);
                                showToast(`Removed worker ${tech.name}`, "info");
                                setDeletingTechId(null);
                              }}
                              className="p-0.5 rounded bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
                              title="Yes, remove"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setDeletingTechId(null)}
                              className="p-0.5 rounded bg-gray-200 dark:bg-stone-800 text-gray-600 dark:text-stone-300 hover:bg-gray-300 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              if (!isOwner) {
                                showToast("Access Denied: Only Business Owners can remove staff.", "error");
                                return;
                              }
                              setDeletingTechId(tech.id);
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isOwner
                                ? "text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                                : "text-gray-300 dark:text-stone-700 cursor-not-allowed"
                            }`}
                            title={isOwner ? `Remove ${tech.name}` : "Owner-only access"}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Module 2: Locations Manager */}
        <div className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={() => setActiveSection(activeSection === "locations" ? "none" : "locations")}
            className="w-full flex items-center justify-between p-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-700 dark:text-stone-200 outline-none hover:bg-slate-50 dark:hover:bg-stone-800"
          >
            <span className="flex items-center gap-2">
              <MapPin className="w-4.5 h-4.5 text-blue-500" />
              Physical Locations & Spots
            </span>
            {activeSection === "locations" ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {activeSection === "locations" && (
            <div className="p-4 border-t border-gray-100 dark:border-stone-800 space-y-3 text-left animate-slide-up">
              <div className="flex justify-between items-center bg-gray-50 dark:bg-stone-800/40 p-2.5 rounded-lg border border-gray-100 dark:border-stone-800">
                <span className="text-[9px] uppercase font-bold text-gray-500">
                  Custom Location Spots ({locations.length})
                </span>
                <button
                  onClick={() => setShowAddLoc(true)}
                  className="text-[9px] bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black px-2.5 py-1 rounded shadow-xs"
                >
                  + Add Location Spot
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto">
                {locations.map((loc, idx) => (
                  editingLocIndex === idx ? (
                    <div
                      key={idx}
                      className="p-1 px-1.5 bg-white dark:bg-stone-900 border border-emerald-500 rounded-xl flex items-center justify-between gap-1"
                    >
                      <input
                        type="text"
                        value={editingLocText}
                        onChange={e => setEditingLocText(e.target.value)}
                        className="text-[11px] font-bold bg-transparent border-none text-gray-800 dark:text-stone-100 focus:outline-none w-full pl-1 py-1 font-sans"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveEdit(idx);
                          } else if (e.key === "Escape") {
                            setEditingLocIndex(null);
                          }
                        }}
                      />
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => handleSaveEdit(idx)}
                          className="p-1 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg cursor-pointer transition-colors"
                          title="Save Changes"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingLocIndex(null)}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-stone-800 rounded-lg cursor-pointer transition-colors"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={idx}
                      className="p-2 bg-slate-50 dark:bg-stone-900 border border-gray-150 rounded-xl flex items-center justify-between gap-1 animate-fade-in"
                    >
                      <span className="text-[11px] font-bold text-gray-750 dark:text-stone-250 truncate block max-w-[140px]" title={loc}>
                        📍 {loc}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditingLocIndex(idx);
                            setEditingLocText(loc);
                          }}
                          className="p-1 text-gray-400 hover:text-emerald-500 hover:bg-white dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                          title="Edit Location Spot"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <a
                          href={generateQRUrl(`INVSRV-LOCATION:${loc}`)}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          className="p-1 text-blue-500 hover:text-blue-700 hover:bg-white dark:hover:bg-stone-800 rounded-lg transition-colors"
                          title="Print Sticker QR"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </a>
                        {deletingLocIndex === idx ? (
                          <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-500/10 p-0.5 px-1.5 rounded-lg border border-rose-200 dark:border-rose-900/30 animate-pulse">
                            <span className="text-[8px] font-black uppercase text-rose-600 dark:text-rose-400 select-none">Delete?</span>
                            <button
                              onClick={() => {
                                const nextLocs = locations.filter((_, i) => i !== idx);
                                onUpdateLocations(nextLocs);
                                showToast(`Deleted location spot: ${loc}`, "info");
                                setDeletingLocIndex(null);
                              }}
                              className="p-0.5 rounded bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
                              title="Confirm delete"
                            >
                              <Check className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={() => setDeletingLocIndex(null)}
                              className="p-0.5 rounded bg-gray-200 dark:bg-stone-800 text-gray-600 dark:text-stone-300 hover:bg-gray-300 default-colors cursor-pointer"
                              title="Cancel delete"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setDeletingLocIndex(idx);
                              setEditingLocIndex(null); // Cancel editing if deleting
                            }}
                            className="p-1 text-gray-400 hover:text-rose-500 hover:bg-white dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                            title="Remove Location Spot"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Module 3: WhatsApp Templates Editor */}
        <div className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={() => setActiveSection(activeSection === "wa" ? "none" : "wa")}
            className="w-full flex items-center justify-between p-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-700 dark:text-stone-200 outline-none hover:bg-slate-50 dark:hover:bg-stone-800"
            id="wa-editor-section-btn"
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="w-4.5 h-4.5 text-purple-500" />
              WhatsApp Message Template Editor
            </span>
            {activeSection === "wa" ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {activeSection === "wa" && (
            <div className="p-4 border-t border-gray-100 dark:border-stone-800 space-y-3 text-left animate-slide-up">
              <div>
                <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  Status trigger workflow node
                </label>
                <select
                  value={selectedTemplateStatus}
                  onChange={e => setSelectedTemplateStatus(e.target.value as WhatsAppTemplate["status"])}
                  className="w-full text-xs font-bold p-2.5 bg-slate-50 dark:bg-black border border-gray-200 dark:border-stone-800 text-gray-800 dark:text-stone-100 rounded-xl"
                >
                  <option value="Received">Received</option>
                  <option value="Under Inspection">Under Inspection</option>
                  <option value="Repairing">Repairing</option>
                  <option value="Waiting for Parts">Waiting for Parts</option>
                  <option value="Completed">Completed</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>

              <div>
                <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex justify-between">
                  <span>Template String String</span>
                  <button
                    onClick={handleResetWaTemplateToDefault}
                    className="text-[8px] font-extrabold text-blue-500 uppercase flex items-center gap-0.5 hover:underline cursor-pointer"
                  >
                    <Undo2 className="w-2.5 h-2.5" /> Restore Default
                  </button>
                </label>
                
                <textarea
                  rows={6}
                  value={templateText}
                  onChange={e => setTemplateText(e.target.value)}
                  className="w-full text-xs font-mono p-3 bg-slate-50 dark:bg-black text-gray-800 dark:text-white border border-gray-200 dark:border-stone-800 rounded-xl focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Variable description tags */}
              <div className="bg-slate-50 dark:bg-black border border-gray-150 dark:border-stone-800 p-2.5 rounded-xl text-[9px] text-gray-500 dark:text-stone-400 select-none font-medium">
                <span className="block font-black text-gray-400 uppercase mb-1">Available variables placeholder</span>
                <span className="font-mono text-blue-500 dark:text-emerald-400 select-all block mb-0.5">
                  {"{{customerName}} | {{jobNo}} | {{date}} | {{deviceBlock}} | {{grandTotal}} | {{status}}"}
                </span>
                Replace exact snippets including double curly braces.
              </div>

              <button
                onClick={handleSaveWhatsAppTemplate}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white font-black text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
                id="btn-save-wa-template"
              >
                <FileCheck className="w-4 h-4" />
                Confirm and Save Template
              </button>
            </div>
          )}
        </div>

        {/* Module 4: Reports, Invoices & CSV Downloads */}
        <div className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={() => setActiveSection(activeSection === "reports" ? "none" : "reports")}
            className="w-full flex items-center justify-between p-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-700 dark:text-stone-200 outline-none hover:bg-slate-50 dark:hover:bg-stone-800"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4.5 h-4.5 text-amber-500" />
              Exports and Spreadsheet Reports
            </span>
            {activeSection === "reports" ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {activeSection === "reports" && (
            <div className="p-4 border-t border-gray-100 dark:border-stone-800 space-y-3.5 text-left animate-slide-up select-none">
              
              {/* Day-to-Day Custom Range Export Filter */}
              <div className="p-3 bg-emerald-50/50 dark:bg-stone-950 border border-emerald-100 dark:border-stone-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-400 tracking-wider">
                    📈 Day-to-Day Ledger Export
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    {filteredJobsForExport.length} matches found
                  </span>
                </div>

                {/* Fast Select Presets */}
                <div className="grid grid-cols-4 gap-1.5">
                  {(["today", "yesterday", "last7", "custom"] as const).map(preset => {
                    const label = preset === "today" ? "Today"
                                : preset === "yesterday" ? "Yesterday"
                                : preset === "last7" ? "7 Days"
                                : "Custom";
                    const isSelected = reportPreset === preset;
                    return (
                      <button
                        key={preset}
                        onClick={() => setReportPreset(preset)}
                        className={`text-[9px] font-bold py-1 px-2 rounded-lg text-center cursor-pointer transition-all border ${
                          isSelected
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-sm font-black"
                            : "bg-white dark:bg-stone-900 border-gray-200 dark:border-stone-800 text-gray-700 dark:text-stone-300 hover:border-emerald-500 dark:hover:border-emerald-400"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Date Inputs */}
                {reportPreset === "custom" && (
                  <div className="grid grid-cols-2 gap-2 pt-1 animate-fade-in">
                    <div>
                      <span className="text-[8px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest block mb-1">
                        Start Date
                      </span>
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={e => setReportStartDate(e.target.value)}
                        className="w-full text-[10px] font-bold p-1.5 rounded-lg border border-gray-200 dark:border-stone-800 bg-white dark:bg-black text-gray-800 dark:text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest block mb-1">
                        End Date
                      </span>
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={e => setReportEndDate(e.target.value)}
                        className="w-full text-[10px] font-bold p-1.5 rounded-lg border border-gray-200 dark:border-stone-800 bg-white dark:bg-black text-gray-800 dark:text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

                {/* Submit Action Button */}
                <button
                  onClick={handleExportFilteredJobs}
                  className="w-full flex items-center justify-center gap-1.5 p-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-750 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm transition-all active:scale-98"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Day-to-Day Ledger (.CSV)</span>
                </button>
              </div>

              {/* Separator / Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-150 dark:border-stone-800"></div>
                <span className="flex-shrink mx-2 text-[8px] text-gray-400 dark:text-stone-500 font-extrabold uppercase tracking-widest">
                  Bulk Database Download
                </span>
                <div className="flex-grow border-t border-gray-150 dark:border-stone-800"></div>
              </div>

              <p className="text-[10px] text-gray-400 dark:text-stone-400 font-medium font-sans">
                Trigger local download of clean CSV files containing complete system catalogs.
              </p>

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={handleExportClients}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-black border border-gray-200/50 dark:border-stone-800 hover:border-emerald-500 rounded-xl transition-all font-bold text-xs cursor-pointer"
                >
                  <span className="text-gray-800 dark:text-white">Download Clients Directory (.CSV)</span>
                  <Download className="w-4 h-4 text-emerald-500 dark:text-emerald-400 text-right" />
                </button>

                <button
                  onClick={handleExportJobs}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-black border border-gray-200/50 dark:border-stone-800 hover:border-emerald-500 rounded-xl transition-all font-bold text-xs cursor-pointer"
                >
                  <span className="text-gray-800 dark:text-white">Download Service Jobs Ledger (.CSV)</span>
                  <Download className="w-4 h-4 text-emerald-500 dark:text-emerald-400 text-right" />
                </button>

                <button
                  onClick={handleExportInventory}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-black border border-gray-200/50 dark:border-stone-800 hover:border-emerald-500 rounded-xl transition-all font-bold text-xs cursor-pointer"
                >
                  <span className="text-gray-800 dark:text-white">Download Stock Catalog Index (.CSV)</span>
                  <Download className="w-4 h-4 text-emerald-500 dark:text-emerald-400 text-right" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Module 5: Google Drive Cloud Backup & Recovery Integration */}
        <div className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={() => setActiveSection(activeSection === "drive" ? "none" : "drive")}
            className="w-full flex items-center justify-between p-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-700 dark:text-stone-200 outline-none hover:bg-slate-50 dark:hover:bg-stone-800 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <HardDrive className="w-4.5 h-4.5 text-blue-500" />
              Google Drive Cloud Backup
            </span>
            {activeSection === "drive" ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {activeSection === "drive" && (
            <div className="p-4 border-t border-gray-100 dark:border-stone-800 space-y-3.5 text-left animate-slide-up select-none font-sans">
              
              {/* Check if the logged-in worker role is "Owner" */}
              {currentUser?.role !== "Owner" ? (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/15 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 font-bold flex gap-2">
                  <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    🔒 Enterprise Google Drive cloud backups are restricted exclusively to the primary Owner of the business workspace.
                  </span>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/15 rounded-xl text-[10px] text-blue-700 dark:text-blue-400 font-bold flex gap-2">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>
                      Sync your entire database with your personal Google Drive in real-time. All modifications can auto-synchronize in the background securely.
                    </span>
                  </div>

                  {/* Google Authenticator Section */}
                  {!googleUser ? (
                    <div className="space-y-2">
                      <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">
                        Google Cloud Linkage
                      </span>
                      <p className="text-[10px] text-gray-500 dark:text-stone-400 leading-normal">
                        To enable automated cloud backups, hook your primary Google Account workspace:
                      </p>
                      
                      <button
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center p-2.5 bg-white dark:bg-black border border-gray-200 dark:border-stone-800 hover:border-blue-500 rounded-xl transition-all shadow-xs cursor-pointer text-xs font-black text-gray-800 dark:text-white"
                      >
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 mr-2">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        </svg>
                        <span>Sign in with Google</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 dark:bg-black border border-gray-100 dark:border-stone-800 rounded-xl space-y-1.5 relative">
                        <div className="flex items-center justify-between">
                          <span className="text-[7.5px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Linked Drive Active
                          </span>
                          <button
                            onClick={handleGoogleSignOut}
                            className="text-[9px] font-black text-rose-500 hover:text-rose-600 transition-all cursor-pointer"
                          >
                            Disconnect
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {googleUser.photoURL ? (
                            <img
                              src={googleUser.photoURL}
                              referrerPolicy="no-referrer"
                              alt="Avatar"
                              className="w-5 h-5 rounded-full"
                            />
                          ) : (
                            <UserCheck className="w-4 h-4 text-gray-500" />
                          )}
                          <span className="text-[10px] font-bold text-gray-700 dark:text-stone-300 truncate">
                            {googleUser.email}
                          </span>
                        </div>
                      </div>

                      {/* Auto-Backup Switch Controller */}
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-black border border-gray-150 dark:border-stone-800 rounded-xl">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-extrabold text-gray-800 dark:text-white block">
                            Google Drive Auto-Backup
                          </span>
                          <span className="text-[8.5px] text-gray-400 dark:text-stone-400 leading-tight block">
                            Background syncs changes instantly to Google Drive
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            const nextState = !autoBackupEnabled;
                            setAutoBackupEnabled(nextState);
                            localStorage.setItem("drive_auto_backup_enabled", String(nextState));
                            showToast(nextState ? "Google Drive auto-backup activated! ☁" : "Auto-backup disabled.", nextState ? "success" : "info");
                          }}
                          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                            autoBackupEnabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-stone-800"
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full bg-white shadow-xs absolute top-0.5 transition-transform ${
                              autoBackupEnabled ? "right-1" : "left-1"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="bg-slate-50 dark:bg-stone-800/40 p-2.5 rounded-xl border border-gray-100 dark:border-stone-800 text-[10px] text-gray-500 dark:text-stone-400 flex justify-between select-none">
                        <span>Last Dynamic Cloud Sync:</span>
                        <strong className="text-gray-700 dark:text-stone-250 font-mono">{lastGdSync}</strong>
                      </div>

                      {/* Manual Push Button */}
                      <button
                        onClick={handleManualBackupGD}
                        disabled={isBackupPushing || isBackupRestoring}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-extrabold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all hover:brightness-110 cursor-pointer disabled:opacity-50"
                      >
                        {isBackupPushing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Uploading Cloud State...</span>
                          </>
                        ) : (
                          <>
                            <HardDrive className="w-4 h-4" />
                            <span>Backup All Databases to Drive</span>
                          </>
                        )}
                      </button>

                      {/* Restore recovery button */}
                      <button
                        onClick={handleRestoreGD}
                        disabled={isBackupPushing || isBackupRestoring}
                        className="w-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-extrabold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isBackupRestoring ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                            <span>Restoring from Cloud...</span>
                          </>
                        ) : (
                          <>
                            <CloudLightning className="w-4 h-4 text-blue-500" />
                            <span>Restore Database from Google Drive</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Logout Session overlay */}
      <button
        onClick={() => {
          onLogout();
          showToast("Session expired safely.", "info");
        }}
        className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-stone-900 hover:dark:bg-stone-800 text-rose-600 hover:text-rose-700 font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all outline-none cursor-pointer"
        id="btn-more-logout"
      >
        <LogOut className="w-4 h-4" />
        <span>Safely Exit Inventory Service Workspace (Logout)</span>
      </button>

      {/* Slide-Up Bottom Sheet Modal: Add Staff Worker */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-3xl border-t border-slate-200/50 dark:border-stone-800 max-h-[85vh] overflow-y-auto flex flex-col animate-slide-up">
            
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900 z-10">
              <h3 className="text-base font-black text-gray-800 dark:text-stone-100">
                Register New Worker
              </h3>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-stone-800 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="p-5 space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1">
                  Worker Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Dev"
                  value={staffName}
                  onChange={e => setStaffName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-stone-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1 text-left">
                  Staff Role Node
                </label>
                <select
                  value={staffRole}
                  onChange={e => setStaffRole(e.target.value as Staff["role"])}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl py-2.5 focus:outline-none"
                >
                  <option value="Technician">Technician</option>
                  <option value="Senior Technician">Senior Technician</option>
                  <option value="Manager">Manager</option>
                  <option value="Helper">Helper</option>
                  <option value="Driver">Driver</option>
                  <option value="Receptionist">Receptionist</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest">
                    Worker Login ID *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (staffName.trim()) {
                        const base = staffName.trim().toLowerCase().replace(/\s+/g, ".");
                        const randomSuffix = Math.floor(100 + Math.random() * 900);
                        setStaffLoginId(`${base}.${randomSuffix}`);
                        showToast(`Suggested ID: ${base}.${randomSuffix}`, "info");
                      } else {
                        showToast("Please enter the worker's name first", "info");
                      }
                    }}
                    className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer bg-slate-100 dark:bg-stone-800 px-1.5 py-0.5 rounded transition"
                  >
                    ⚡ Suggest ID
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. ramesh.dev"
                  value={staffLoginId}
                  onChange={e => setStaffLoginId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-stone-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl focus:outline-none"
                />
                <span className="text-[8px] font-semibold text-gray-400 mt-1 block tracking-tight">
                  Staff can login with this Login ID or their generated system STF ID.
                </span>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest">
                    Strong Password *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const chars = "abcdefgijkmnopqrstwxyzABCDEFGHJKLMNPQRSTWXYZ23456789!@#$";
                        let randPass = "";
                        for (let i = 0; i < 8; i++) {
                          randPass += chars.charAt(Math.floor(Math.random() * chars.length));
                        }
                        setStaffPassword(randPass);
                        setShowStaffPassword(true);
                        showToast(`Generated: ${randPass}`, "success");
                      }}
                      className="text-[9px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer bg-slate-100 dark:bg-stone-800 px-1.5 py-0.5 rounded transition"
                    >
                      🔑 Generate Strong
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="text-[9px] font-bold text-gray-500 hover:text-gray-650 cursor-pointer bg-slate-100 dark:bg-stone-800 px-1.5 py-0.5 rounded transition"
                    >
                      {showStaffPassword ? "👁 Hide" : "👁 Show"}
                    </button>
                  </div>
                </div>
                <input
                  type={showStaffPassword ? "text" : "password"}
                  required
                  placeholder="Enter a strong password"
                  value={staffPassword}
                  onChange={e => setStaffPassword(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-stone-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl focus:outline-none font-mono"
                />
              </div>

              <div className="p-2.5 bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-1">
                <span className="block text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  ⚠️ Security Policy Notes
                </span>
                <span className="block text-[8.5px] font-medium text-gray-500 dark:text-stone-400">
                  Worker credentials must contain secure characters. Keep this credentials sheet safe.
                </span>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-black text-xs py-3 rounded-xl shadow-xs"
              >
                Register Employee
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Slide-Up Bottom Sheet Modal: Add Custom Location Node */}
      {showAddLoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-3xl border-t border-slate-200/50 dark:border-stone-800 max-h-[85vh] overflow-y-auto flex flex-col animate-slide-up">
            
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900 z-10">
              <h3 className="text-base font-black text-gray-800 dark:text-stone-100">
                Register Storage Location Spot
              </h3>
              <button
                onClick={() => setShowAddLoc(false)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-stone-800 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddLocationSubmit} className="p-5 space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1">
                  Spot Title / Shelf node *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cabinet Row C-5"
                  value={locText}
                  onChange={e => setLocText(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-stone-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black text-xs py-3 rounded-xl shadow-xs"
              >
                Register Spot Node
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
