import { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
import BottomNav, { TabType } from "./components/BottomNav";
import AuthScreen from "./components/AuthScreen";
import HomeTab from "./components/HomeTab";
import CustomersTab from "./components/CustomersTab";
import ServicesTab from "./components/ServicesTab";
import StockTab from "./components/StockTab";
import MoreTab from "./components/MoreTab";
import CustomerTrackingPortal from "./components/CustomerTrackingPortal";

import {
  Customer,
  ServiceJob,
  InventoryItem,
  Staff,
  WhatsAppTemplate,
  User,
  JobStatus,
  SubscriptionDetail,
  SubscriptionPlan
} from "./types";
import {
  loadAllData,
  saveCustomers,
  saveServices,
  saveInventory,
  saveServiceLocations,
  saveStockLocations,
  saveTechnicians,
  saveSession,
  saveWaTemplates,
  getCloudItem,
  saveJobCounter,
  savePaymentMethods,
  saveSubscription
} from "./utils/storage";

import {
  getAccessToken,
  uploadBackupToDrive
} from "./utils/googleDrive";


export default function App() {
  // Sync states
  const [syncStatus, setSyncStatus] = useState<"live" | "syncing" | "offline">("syncing");

  // Authentication session
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const rawVal = localStorage.getItem("inventory_service_session_v2");
    if (rawVal) {
      try {
        return JSON.parse(rawVal);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [users, setUsers] = useState<any[]>([]);

  // Listen to authentic Firebase Auth state changes
  useEffect(() => {
    let unsubscribe: any = null;
    import("./utils/firebase").then(m => {
      unsubscribe = m.auth.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const { doc, getDoc, getDocFromCache } = await import("firebase/firestore");
            let userSnap;
            try {
              userSnap = await getDoc(doc(m.db, "users", firebaseUser.uid));
            } catch (getErr: any) {
              const message = getErr?.message || "";
              if (message.includes("offline") || message.includes("unavailable") || getErr?.code === "unavailable") {
                try {
                  userSnap = await getDocFromCache(doc(m.db, "users", firebaseUser.uid));
                } catch (cacheErr) {
                  console.warn("Could not retrieve user profile from offline firestore cache", cacheErr);
                }
              } else {
                throw getErr;
              }
            }
            
            if (userSnap && userSnap.exists()) {
              const fData = userSnap.data();
              if (fData.status === "active") {
                const loggedUser = {
                  id: firebaseUser.uid,
                  name: fData.name || firebaseUser.displayName || "Operator",
                  role: fData.role || "Staff",
                  email: firebaseUser.email || ""
                };
                setCurrentUser(loggedUser);
                // Also sync local storage session
                import("./utils/storage").then(s => s.saveSession(loggedUser));
              } else {
                m.auth.signOut();
                setCurrentUser(null);
              }
            } else {
              // If snap is missing or doesn't exist, try local session storage fallback to avoid locking user out offline
              const sessRaw = localStorage.getItem("inventory_service_session_v2");
              if (sessRaw) {
                try {
                  const cachedSession = JSON.parse(sessRaw);
                  if (cachedSession && cachedSession.id === firebaseUser.uid) {
                    setCurrentUser(cachedSession);
                  }
                } catch (err) {
                  console.warn("Parsing cached session failed", err);
                }
              }
            }
          } catch (e: any) {
            const errMsg = e?.message || "";
            if (errMsg.includes("offline") || errMsg.includes("unavailable") || e?.code === "unavailable") {
              console.warn("Failed to load user profile in auth callback (client is offline, falling back gracefully to device state)", e);
              const sessRaw = localStorage.getItem("inventory_service_session_v2");
              if (sessRaw) {
                try {
                  const cachedSession = JSON.parse(sessRaw);
                  if (cachedSession && cachedSession.id === firebaseUser.uid) {
                    setCurrentUser(cachedSession);
                  }
                } catch (jsonErr) {
                  console.warn("Failed to parse cached session from offline fallback", jsonErr);
                }
              }
            } else {
              console.error("Failed to load user profile in auth callback", e);
            }
          }
        } else {
          // If no firebaseUser, check if there is an active local session before forcing null
          const rawVal = localStorage.getItem("inventory_service_session_v2");
          if (!rawVal) {
            setCurrentUser(null);
          }
        }
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Requirements: Inactivity auto-logout trigger (10 minutes)
  useEffect(() => {
    if (!currentUser) return;

    let timeoutId: number;
    const INACTIVITY_TIME = 10 * 60 * 1000; 

    const resetInactivityTimer = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        handleLogout();
        showToast("Session expired automatically due to safety timeout constraints.", "info");
      }, INACTIVITY_TIME);
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];
    events.forEach(name => {
      window.addEventListener(name, resetInactivityTimer, { passive: true });
    });

    resetInactivityTimer();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      events.forEach(name => {
        window.removeEventListener(name, resetInactivityTimer);
      });
    };
  }, [currentUser]);

  // Navigation tab
  const [currentTab, setCurrentTab] = useState<TabType>("home");

  // Dynamic ERP Databases
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<ServiceJob[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [serviceLocations, setServiceLocations] = useState<string[]>([]);
  const [stockLocations, setStockLocations] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionDetail>({
    plan: "Premium",
    status: "Active",
    startDate: new Date().toISOString().split("T")[0],
    expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    paymentHistory: [
      {
        id: "TRIAL-" + Math.random().toString(36).substring(2, 11).toUpperCase(),
        date: new Date().toISOString().split("T")[0],
        amount: 0,
        plan: "Premium",
        paymentMethod: "Free Trial Integration",
        transactionId: "TRIAL-INIT"
      }
    ]
  });
  const [technicians, setTechnicians] = useState<Staff[]>([]);
  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplate[]>([]);

  // Modal actions triggers passed between screens
  const [triggeredModal, setTriggeredModal] = useState<string | null>(null);

  // Public Tracking Page State (by query parameter)
  const [trackingJobId, setTrackingJobId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("track") || params.get("job") || params.get("jobNo") || null;
  });

  // Load item by URL query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemIdParam = params.get("itemId") || params.get("item");
    if (itemIdParam && currentUser) {
      setCurrentTab("stock");
      // Give some time for StockTab to mount, and set a custom trigger
      setTriggeredModal(`viewItem:${itemIdParam}`);
      // Remove query parameters from URL to avoid loop or messy reload
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [currentUser]);

  // Theme settings
  const [dark, setDark] = useState(() => {
    return localStorage.getItem("inventory_service_theme") === "dark";
  });

  // Client-facing toasts notification bar
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Sync dark class on documentElement & body elements
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
      localStorage.setItem("inventory_service_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
      localStorage.setItem("inventory_service_theme", "light");
    }
  }, [dark]);

  // Unified load function for pulling background cloud syncs
  const syncWithCloudStorage = async (silently = false) => {
    if (!silently) setSyncStatus("syncing");
    try {
      const data = await loadAllData(!silently);
      setCustomers(data.customers);
      setServices(data.services);
      setInventory(data.inventory);
      setServiceLocations(data.serviceLocations);
      setStockLocations(data.stockLocations);
      setPaymentMethods(data.paymentMethods);
      setSubscription(data.subscription);
      setTechnicians(data.technicians);
      setUsers(data.users);
      setWaTemplates(data.waTemplates);

      setSyncStatus("live");
      if (!silently) showToast("Live Sync Complete · Synced ☁", "success");
    } catch (e) {
      console.error("Cloud synchronisation failed", e);
      setSyncStatus("offline");
      if (!silently) showToast("Syncing failed! Working with offline cache.", "error");
    }
  };

  // Periodic Auto-refresh syncing routine (every 20 seconds as requested)
  useEffect(() => {
    syncWithCloudStorage(false);

    const interval = window.setInterval(() => {
      syncWithCloudStorage(true);
    }, 20000);

    return () => window.clearInterval(interval);
  }, []);

  // Google Drive Cloud Auto-Backup System (every 30 seconds)
  const backupStateRef = useRef({
    customers,
    services,
    inventory,
    serviceLocations,
    stockLocations,
    paymentMethods,
    technicians,
    users,
    waTemplates,
    currentUser,
    syncStatus
  });

  useEffect(() => {
    backupStateRef.current = {
      customers,
      services,
      inventory,
      serviceLocations,
      stockLocations,
      paymentMethods,
      technicians,
      users,
      waTemplates,
      currentUser,
      syncStatus
    };
  }, [customers, services, inventory, serviceLocations, stockLocations, paymentMethods, technicians, users, waTemplates, currentUser, syncStatus]);

  useEffect(() => {
    const backupInterval = setInterval(async () => {
      const {
        customers,
        services,
        inventory,
        serviceLocations,
        stockLocations,
        paymentMethods,
        technicians,
        users,
        waTemplates,
        currentUser,
        syncStatus
      } = backupStateRef.current;

      if (syncStatus !== "live") return;
      if (currentUser?.role !== "Owner") return;
      if (localStorage.getItem("drive_auto_backup_enabled") === "false") return;

      const token = getAccessToken();
      if (!token) return;

      try {
        const jobsCounterRaw = await getCloudItem("inventory_service_job_counter");
        const jobsCounter = jobsCounterRaw ? parseInt(jobsCounterRaw, 10) : 0;

        const payload = {
          customers,
          services,
          inventory,
          serviceLocations,
          stockLocations,
          paymentMethods,
          technicians,
          users,
          waTemplates,
          jobCounter: jobsCounter
        };

        const meta = await uploadBackupToDrive(token, payload);
        const nowStr = new Date(meta.modifiedTime).toLocaleString("en-IN");
        localStorage.setItem("inventory_service_gd_last_sync_time", nowStr);
        
        // Notify MoreTab if mounted
        window.dispatchEvent(new CustomEvent("gd_backup_synced", { detail: nowStr }));
        console.log("Background Google Drive Cloud auto-backup completed: ", nowStr);
      } catch (err) {
        console.error("Auto backup failed silently in background:", err);
      }
    }, 30000); // Exactly 30 seconds

    return () => clearInterval(backupInterval);
  }, []);

  // Sync local changes to cloud safely
  const handleAddCustomer = async (fields: Omit<Customer, "id" | "createdAt">): Promise<Customer | undefined> => {
    try {
      const newCust: Customer = {
        ...fields,
        id: `CUST-${1000 + customers.length + 1}`,
        createdAt: new Date().toISOString()
      };
      const expandedList = [...customers, newCust];
      setCustomers(expandedList);
      await saveCustomers(expandedList);
      showToast(`User ${fields.name} enrolled · Synced ☁`, "success");
      return newCust;
    } catch (e) {
      showToast("Enrollment failed on network sync.", "error");
      return undefined;
    }
  };

  const handleEditCustomer = async (updated: Customer) => {
    try {
      const updatedList = customers.map(c => (c.id === updated.id ? updated : c));
      setCustomers(updatedList);
      await saveCustomers(updatedList);
      showToast("Customer contact details updated · Synced ☁", "success");
    } catch (e) {
      showToast("Updates failed on cloud saving.", "error");
    }
  };

  const handleAddJob = async (job: ServiceJob) => {
    try {
      const expandedList = [job, ...services];
      setServices(expandedList);
      await saveServices(expandedList);
      showToast(`Job ticket ${job.id} dispatched · Synced ☁`, "success");
    } catch (e) {
      showToast("Dispatched failed on cloud saving.", "error");
    }
  };

  const handleUpdateJob = async (job: ServiceJob) => {
    try {
      const updatedList = services.map(s => (s.id === job.id ? job : s));
      setServices(updatedList);
      await saveServices(updatedList);
      showToast("Workflow timelines audited · Synced ☁", "success");
    } catch (e) {
      showToast("Workflow saving failed on server.", "error");
    }
  };

  const handleAddInventoryItem = async (fields: Omit<InventoryItem, "id" | "history" | "createdAt">) => {
    try {
      const newItem: InventoryItem = {
        ...fields,
        id: `INV-${1000 + inventory.length + 1}`,
        createdAt: new Date().toISOString(),
        history: [
          {
            type: "In",
            quantity: fields.quantity,
            notes: "Opening batch registration",
            timestamp: new Date().toISOString(),
            user: currentUser?.name || "System"
          }
        ]
      };
      const expandedList = [...inventory, newItem];
      setInventory(expandedList);
      await saveInventory(expandedList);
      showToast(`Item ${fields.productName} registered · Synced ☁`, "success");
    } catch (e) {
      showToast("Spare parts saving failed on server.", "error");
    }
  };

  const handleUpdateInventoryItem = async (item: InventoryItem) => {
    try {
      const updatedList = inventory.map(it => (it.id === item.id ? item : it));
      setInventory(updatedList);
      await saveInventory(updatedList);
    } catch (e) {
      showToast("Inventory transaction sync failed.", "error");
    }
  };

  const handleAddCustomServiceLocation = async (loc: string) => {
    try {
      const expandedList = [...serviceLocations, loc];
      setServiceLocations(expandedList);
      await saveServiceLocations(expandedList);
    } catch (e) {
      showToast("Service location sync failed.", "error");
    }
  };

  const handleUpdateServiceLocations = async (locs: string[]) => {
    try {
      setServiceLocations(locs);
      await saveServiceLocations(locs);
      showToast("Service spots sync completed · Synced ☁", "success");
    } catch (e) {
      showToast("Service spots saving failed.", "error");
    }
  };

  const handleUpdateStockLocations = async (locs: string[]) => {
    try {
      setStockLocations(locs);
      await saveStockLocations(locs);
      showToast("Stock spots sync completed · Synced ☁", "success");
    } catch (e) {
      showToast("Stock spots saving failed.", "error");
    }
  };

  const handleUpdatePaymentMethods = async (methods: string[]) => {
    try {
      setPaymentMethods(methods);
      await savePaymentMethods(methods);
      showToast("Payment options updated successfully · Synced ☁", "success");
    } catch (e) {
      showToast("Payment options saving failed.", "error");
    }
  };

  const handleUpdateSubscription = async (sub: SubscriptionDetail) => {
    try {
      setSubscription(sub);
      await saveSubscription(sub);
    } catch (e) {
      showToast("Subscription saving failed.", "error");
    }
  };

  const handleAddCustomStockLocation = async (loc: string) => {
    try {
      const expandedList = [...stockLocations, loc];
      setStockLocations(expandedList);
      await saveStockLocations(expandedList);
    } catch (e) {
      showToast("Stock location sync failed.", "error");
    }
  };

  const handleResetAllData = async () => {
    try {
      setCustomers([]);
      setServices([]);
      setInventory([]);
      await saveCustomers([]);
      await saveServices([]);
      await saveInventory([]);
      await saveJobCounter(0);
    } catch (e) {
      console.error("Failed to wipe databases on storage level", e);
    }
  };

  const handleUpdateTechnicians = async (techs: Staff[]) => {
    try {
      setTechnicians(techs);
      await saveTechnicians(techs);
      showToast("Technical rosters synced · Synced ☁", "success");
    } catch (e) {
      showToast("Rosters saving failed.", "error");
    }
  };

  const handleUpdateWaTemplates = async (temps: WhatsAppTemplate[]) => {
    try {
      setWaTemplates(temps);
      await saveWaTemplates(temps);
    } catch (e) {
      showToast("Templates sync failed.", "error");
    }
  };

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    await saveSession(user);
    setCurrentTab("home");
  };

  const handleLogout = async () => {
    try {
      const fb = await import("./utils/firebase");
      await fb.auth.signOut();
    } catch (e) {
      console.error("Sign-out callback error:", e);
    }
    setCurrentUser(null);
    await saveSession(null);
    showToast("Successfully logged out.", "success");
  };

  const pendingCount = services.reduce((acc, job) => {
    return (
      acc +
      job.items.filter(
        item =>
          item.status !== "Completed" && item.status !== "Delivered"
      ).length
    );
  }, 0);

  const lowStockCount = inventory.filter(item => item.quantity < 5).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 transition-colors duration-200 flex flex-col items-center justify-center p-0 md:p-4 select-none w-full">
      
      {trackingJobId ? (
        <div className="w-full min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col animate-fade-in">
          <CustomerTrackingPortal
            services={services}
            customers={customers}
            initialJobId={trackingJobId}
            onClose={() => {
              setTrackingJobId(null);
              window.history.replaceState({}, document.title, window.location.pathname);
            }}
          />
        </div>
      ) : (
        /* Sleek Smartphone Simulated Frame Wrap */
        <div className="w-full max-w-[400px] h-screen md:h-[720px] bg-white dark:bg-stone-900 md:rounded-[40px] shadow-2xl md:border-[8px] border-slate-100 dark:border-stone-800 md:border-slate-800 dark:md:border-stone-800 flex flex-col overflow-hidden relative">
          
          {/* Render User Authenticity Check Screen */}
          {!currentUser ? (
          <div className="flex-1 flex flex-col select-none overflow-y-auto">
            {/* Simple logo header for the auth page */}
            <div className="px-4 py-4 border-b border-gray-100 dark:border-stone-850/40 sticky top-0 bg-white/95 dark:bg-stone-950 backdrop-blur-md flex justify-between items-center z-10">
              <span className="text-xs font-bold tracking-tight text-indigo-650 dark:text-indigo-400 font-sans uppercase">Stockivo Suite</span>
              <button 
                onClick={() => setDark(!dark)}
                className="p-1 px-1.5 rounded-lg border border-gray-100 text-gray-400 text-xs font-bold"
              >
                {dark ? "☀️ Light" : "🌙 Dark"}
              </button>
            </div>
            
            <AuthScreen
              users={users}
              technicians={technicians}
              onLoginSuccess={handleLoginSuccess}
              onRegisterUser={async newUser => {
                const updatedList = [...users, newUser];
                setUsers(updatedList);
                // Save synced users listing
                loadAllData().then(async () => {
                  const storageObj = (window as any).storage;
                  if (storageObj) {
                    await storageObj.setItem("inventory_service_users", JSON.stringify(updatedList), { shared: true });
                  }
                });
              }}
              showToast={showToast}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col select-none overflow-hidden relative">
            
            {/* Header Module */}
            <Header
              currentUser={currentUser}
              syncStatus={syncStatus}
              onRefresh={() => syncWithCloudStorage(false)}
              dark={dark}
              setDark={setDark}
            />

            {/* Active view component router */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
              {currentTab === "home" && (
                <HomeTab
                  currentUser={currentUser}
                  services={services}
                  inventory={inventory}
                  customers={customers}
                  onNavigateTab={setCurrentTab}
                  onOpenModal={setTriggeredModal}
                  showToast={msg => showToast(msg, "info")}
                />
              )}

              {currentTab === "customers" && (
                <CustomersTab
                  customers={customers}
                  services={services}
                  currentUser={currentUser}
                  subscription={subscription}
                  onAddCustomer={handleAddCustomer}
                  onEditCustomer={handleEditCustomer}
                  showToast={showToast}
                  onOpenNewJobForCust={cust => {
                    // Navigate to services tab and trigger job modal
                    setCurrentTab("services");
                    // Delay slightly to trigger DOM render
                    setTimeout(() => setTriggeredModal(`newJobForCust:${cust.id}`), 100);
                  }}
                />
              )}

              {currentTab === "services" && (
                <ServicesTab
                  services={services}
                  customers={customers}
                  technicians={technicians}
                  locations={serviceLocations}
                  paymentMethods={paymentMethods}
                  waTemplates={waTemplates}
                  currentUser={currentUser}
                  subscription={subscription}
                  onAddJob={handleAddJob}
                  onUpdateJob={handleUpdateJob}
                  onAddCustomLocation={handleAddCustomServiceLocation}
                  onAddCustomer={handleAddCustomer}
                  showToast={showToast}
                />
              )}

              {currentTab === "stock" && (
                <StockTab
                  inventory={inventory}
                  currentUser={currentUser}
                  subscription={subscription}
                  onAddInventoryItem={handleAddInventoryItem}
                  onUpdateInventoryItem={handleUpdateInventoryItem}
                  locations={stockLocations}
                  onAddCustomLocation={handleAddCustomStockLocation}
                  showToast={showToast}
                  triggeredModal={triggeredModal}
                  setTriggeredModal={setTriggeredModal}
                />
              )}

              {currentTab === "more" && (
                <MoreTab
                  technicians={technicians}
                  serviceLocations={serviceLocations}
                  stockLocations={stockLocations}
                  paymentMethods={paymentMethods}
                  waTemplates={waTemplates}
                  customers={customers}
                  services={services}
                  inventory={inventory}
                  currentUser={currentUser}
                  subscription={subscription}
                  onUpdateSubscription={handleUpdateSubscription}
                  onUpdateTechnicians={handleUpdateTechnicians}
                  onUpdateServiceLocations={handleUpdateServiceLocations}
                  onUpdateStockLocations={handleUpdateStockLocations}
                  onUpdatePaymentMethods={handleUpdatePaymentMethods}
                  onUpdateWaTemplates={handleUpdateWaTemplates}
                  onLogout={handleLogout}
                  showToast={showToast}
                  onResetAllData={handleResetAllData}
                />
              )}
            </div>

            {/* Bottom sticky tab-bar */}
            <BottomNav
              currentTab={currentTab}
              setCurrentTab={setCurrentTab}
              pendingJobsCount={pendingCount}
              lowStockCount={lowStockCount}
            />
          </div>
        )}

        {/* Global Toast Alert banner */}
        {toast && (
          <div className="absolute top-[4.5rem] inset-x-4 z-50 pointer-events-none select-none flex justify-center animate-slide-up">
            <div className={`p-3 px-4 rounded-xl shadow-lg border text-xs font-semibold tracking-wide flex items-center justify-between text-white pointer-events-auto ${
              toast.type === "success"
                ? "bg-slate-900 border-emerald-500/20 text-emerald-400"
                : toast.type === "error"
                ? "bg-rose-650 tracking-wider text-rose-100 border-rose-700/50"
                : "bg-slate-800 border-slate-700 text-slate-350"
            }`}>
              <span>{toast.message}</span>
            </div>
          </div>
        )}

      </div>
      )}

      {/* Bridge Trigger for passing modal actions between home stats shortcuts and sub modals */}
      <AppShortcutBridge
        triggeredModal={triggeredModal}
        setTriggeredModal={setTriggeredModal}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
      />
    </div>
  );
}

/**
 * Custom micro controller to trigger modals across decoupled tabs
 */
interface BridgeProps {
  triggeredModal: string | null;
  setTriggeredModal: (val: string | null) => void;
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
}

function AppShortcutBridge({ triggeredModal, setTriggeredModal, currentTab, setCurrentTab }: BridgeProps) {
  useEffect(() => {
    if (!triggeredModal) return;

    // Detect if we want to open Client Add modal
    if (triggeredModal === "newCustomer" && currentTab === "customers") {
      const btn = document.getElementById("btn-add-customer");
      if (btn) btn.click();
      setTriggeredModal(null);
    } else if (triggeredModal === "newCustomer" && currentTab !== "customers") {
      // Must first switch tabs, wait for render, then trigger will catch organically
      setCurrentTab("customers");
    }

    // Detect if we want to add Stock model
    if (triggeredModal === "addStock" && currentTab === "stock") {
      const btn = document.getElementById("btn-stock-add");
      if (btn) btn.click();
      setTriggeredModal(null);
    } else if (triggeredModal === "addStock" && currentTab !== "stock") {
      setCurrentTab("stock");
    }

    // Detect if we want to trigger a generic new Job
    if (triggeredModal === "newJob" && currentTab === "services") {
      const btn = document.getElementById("btn-trigger-new-job");
      if (btn) btn.click();
      setTriggeredModal(null);
    } else if (triggeredModal === "newJob" && currentTab !== "services") {
      setCurrentTab("services");
    }

    // Detect if we want to prefill a new job card for an exact customer
    if (triggeredModal.startsWith("newJobForCust:") && currentTab === "services") {
      const cId = triggeredModal.split(":")[1];
      const btn = document.getElementById("btn-trigger-new-job");
      if (btn) {
        btn.click();
        // Wait for modal transition then select customer
        setTimeout(() => {
          const select = document.querySelector("select[required]") as HTMLSelectElement;
          if (select) {
            select.value = cId;
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, 150);
      }
      setTriggeredModal(null);
    } else if (triggeredModal.startsWith("newJobForCust:") && currentTab !== "services") {
      setCurrentTab("services");
    }
  }, [triggeredModal, currentTab, setCurrentTab]);

  return null;
}
