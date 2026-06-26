import {
  Customer,
  ServiceJob,
  InventoryItem,
  Staff,
  WhatsAppTemplate,
  JobStatus,
  SubscriptionDetail,
  SubscriptionPlan
} from "../types";

// Default storage locations
export const DEFAULT_LOCATIONS = [
  "Shelf A",
  "Rack B",
  "Store Room",
  "Repair Table",
  "Delivery Area"
];

export const DEFAULT_SERVICE_LOCATIONS = [
  "Received Shelf A",
  "Repair Desk B",
  "Under Testing Row",
  "Ready for Delivery",
  "Quality Testing Bay"
];

export const DEFAULT_STOCK_LOCATIONS = [
  "Main Store Room",
  "Warehouse Rack A",
  "Bulk Cabinet C",
  "Spare Box 3",
  "Transit Shelf"
];

export const DEFAULT_PAYMENT_METHODS = [
  "Cash",
  "Credit / Debit Card",
  "Bank Transfer (ACH / SEPA / SWIFT / Wire)",
  "PayPal / Stripe Link",
  "UPI / QR Code",
  "Venmo / Apple Pay / Google Pay"
];

// Default technicians/staff
export const DEFAULT_STAFF: Staff[] = [
  { id: "S1", name: "Vijay Naik", role: "Senior Technician", status: "Active" },
  { id: "S2", name: "Anand Kumar", role: "Technician", status: "Active" },
  { id: "S3", name: "Rohan Dev", role: "Helper", status: "Active" },
  { id: "S4", name: "Suresh Patil", role: "Manager", status: "Active" },
  { id: "S5", name: "Deepa Nair", role: "Receptionist", status: "Active" }
];

// Default WhatsApp status templates
export const DEFAULT_WA_TEMPLATES: WhatsAppTemplate[] = [
  {
    status: "Received",
    template: `*Inventory Service Update* ☁

Dear {{customerName}}, your Job *{{jobNo}}* has been *Received* successfully on {{date}}.

*Device Details:*
{{deviceBlock}}

*Grand Total:* ₹{{grandTotal}}
*Status:* {{status}}

We will start inspection soon and share updates of any material replacement required. Thank you!`
  },
  {
    status: "Under Inspection",
    template: `*Inventory Service Update* 🔍

Dear {{customerName}}, the devices under Job *{{jobNo}}* are currently *Under Inspection*.

*Details:*
{{deviceBlock}}

*Status:* {{status}}
We will log any material replacements if needed shortly.`
  },
  {
    status: "Repairing",
    template: `*Inventory Service Update* 🛠

Dear {{customerName}}, our technicians have started *Repairing* your devices under Job *{{jobNo}}*.

*Details:*
{{deviceBlock}}

*Status:* {{status}}`
  },
  {
    status: "Waiting for Parts",
    template: `*Inventory Service Update* ⏳

Dear {{customerName}}, the repair of your devices under Job *{{jobNo}}* is *Waiting for Parts*. 

*Details:*
{{deviceBlock}}

*Status:* {{status}}
We will update you as soon as parts are received.`
  },
  {
    status: "Completed",
    template: `*Inventory Service Update* ✅

Dear {{customerName}}, good news! The repair for Job *{{jobNo}}* is *Completed* and ready for pickup!

*Device Summary:*
{{deviceBlock}}

*Total Payable:* ₹{{grandTotal}}
*Status:* {{status}}

Please visit our store to collect your items.`
  },
  {
    status: "Delivered",
    template: `*Inventory Service Update* 📦

Dear {{customerName}}, your Job *{{jobNo}}* has been marked as *Delivered*.

*Final Devices:*
{{deviceBlock}}

*Total Paid:* ₹{{grandTotal}}
*Status:* {{status}}

Thank you for trusting Inventory Service for your Service and Stock equipment. Have a great day!`
  }
];

// Fallback helper to interact with window.storage
const isBrowser = typeof window !== "undefined";

export const getCloudItem = async (key: string): Promise<string | null> => {
  if (!isBrowser) return null;

  // 1. In production or development host container, attempt to fetch from server-side database
  try {
    const res = await fetch(`/api/db/${encodeURIComponent(key)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.value !== null) {
        // Keep in sync locally
        try {
          localStorage.setItem(key, data.value);
        } catch (_) {}
        return data.value;
      }
    }
  } catch (err) {
    console.warn("Backend server not reached for getCloudItem, using fallback cache:", err);
  }

  // 2. Fallback to storage component sandbox context
  try {
    const storageObj = (window as any).storage;
    if (storageObj && typeof storageObj.getItem === "function") {
      const response = storageObj.getItem(key, { shared: true });
      if (response instanceof Promise) {
        return await response;
      } else if (response !== undefined) {
        return response;
      }
    }
  } catch (err) {
    console.warn("window.storage.getItem failed, falling back to localStorage", err);
  }

  // LocalStorage fallback
  try {
    return localStorage.getItem(key);
  } catch (err) {
    return null;
  }
};

export const setCloudItem = async (key: string, value: string): Promise<void> => {
  if (!isBrowser) return;

  // 1. LocalStorage write for instant read-backs and tab sync helper
  try {
    localStorage.setItem(key, value);
    window.dispatchEvent(new Event("storage_sync"));
  } catch (err) {
    console.warn("localStorage.setItem failed", err);
  }

  // 2. Save directly to Express backend database
  try {
    await fetch(`/api/db/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ value })
    });
  } catch (err) {
    console.warn("Backend server write failed, state saved offline in local storage cache:", err);
  }

  // 3. Write to window.storage sandbox wrapper
  try {
    const storageObj = (window as any).storage;
    if (storageObj && typeof storageObj.setItem === "function") {
      const p = storageObj.setItem(key, value, { shared: true });
      if (p instanceof Promise) {
        await p;
      }
    }
  } catch (err) {
    console.warn("window.storage.setItem failed", err);
  }
};

/**
 * Load all databases or initialize with default structure
 */
export interface AppData {
  customers: Customer[];
  services: ServiceJob[];
  inventory: InventoryItem[];
  serviceLocations: string[];
  stockLocations: string[];
  paymentMethods: string[];
  technicians: Staff[];
  users: any[];
  activeSession: any | null;
  jobCounter: number;
  waTemplates: WhatsAppTemplate[];
  subscription: SubscriptionDetail;
}

export const loadAllData = async (forceCloudQuery = false): Promise<AppData> => {
  let custRaw: string | null = null;
  let servRaw: string | null = null;
  let invRaw: string | null = null;
  let serviceLocRaw: string | null = null;
  let stockLocRaw: string | null = null;
  let payMethodsRaw: string | null = null;
  let techRaw: string | null = null;
  let usersRaw: string | null = null;
  let sessRaw: string | null = null;
  let counterRaw: string | null = null;
  let waRaw: string | null = null;
  let subRaw: string | null = null;

  try {
    const res = await fetch("/api/db-batch");
    if (res.ok) {
      const batch = await res.json();
      if (batch && batch.success && batch.data) {
        const dbData = batch.data;
        custRaw = dbData["inventory_service_customers"] || null;
        servRaw = dbData["inventory_service_services"] || null;
        invRaw = dbData["inventory_service_inventory"] || null;
        serviceLocRaw = dbData["inventory_service_service_locations"] || null;
        stockLocRaw = dbData["inventory_service_stock_locations"] || null;
        payMethodsRaw = dbData["inventory_service_payment_methods"] || null;
        techRaw = dbData["inventory_service_technicians"] || null;
        usersRaw = dbData["inventory_service_users"] || null;
        counterRaw = dbData["inventory_service_job_counter"] || null;
        waRaw = dbData["inventory_service_wa_templates"] || null;
        subRaw = dbData["inventory_service_subscription"] || null;

        // Keep local cache in sync
        Object.entries(dbData).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            try {
              localStorage.setItem(key, val as string);
            } catch (_) {}
          }
        });
      }
    }
  } catch (err) {
    console.warn("Batch load failed, falling back to sequential:", err);
  }

  sessRaw = typeof window !== "undefined" ? localStorage.getItem("inventory_service_session_v2") : null;

  // Fallback to sequential individual gets if batch fetched nothing
  if (!custRaw && !servRaw && !invRaw) {
    const [
      fallbackCust,
      fallbackServ,
      fallbackInv,
      fallbackServiceLoc,
      fallbackStockLoc,
      fallbackPayMethods,
      fallbackTech,
      fallbackUsers,
      fallbackCounter,
      fallbackWa,
      fallbackSub
    ] = await Promise.all([
      getCloudItem("inventory_service_customers"),
      getCloudItem("inventory_service_services"),
      getCloudItem("inventory_service_inventory"),
      getCloudItem("inventory_service_service_locations"),
      getCloudItem("inventory_service_stock_locations"),
      getCloudItem("inventory_service_payment_methods"),
      getCloudItem("inventory_service_technicians"),
      getCloudItem("inventory_service_users"),
      getCloudItem("inventory_service_job_counter"),
      getCloudItem("inventory_service_wa_templates"),
      getCloudItem("inventory_service_subscription")
    ]);
    custRaw = fallbackCust;
    servRaw = fallbackServ;
    invRaw = fallbackInv;
    serviceLocRaw = fallbackServiceLoc;
    stockLocRaw = fallbackStockLoc;
    payMethodsRaw = fallbackPayMethods;
    techRaw = fallbackTech;
    usersRaw = fallbackUsers;
    counterRaw = fallbackCounter;
    waRaw = fallbackWa;
    subRaw = fallbackSub;
  }

  const parsedCustomers = custRaw ? JSON.parse(custRaw) : [];
  const parsedServices = servRaw ? JSON.parse(servRaw) : [];
  const parsedInventory = invRaw ? JSON.parse(invRaw) : [];
  const serviceLocations = serviceLocRaw ? JSON.parse(serviceLocRaw) : DEFAULT_SERVICE_LOCATIONS;
  const stockLocations = stockLocRaw ? JSON.parse(stockLocRaw) : DEFAULT_STOCK_LOCATIONS;
  const paymentMethods = payMethodsRaw ? JSON.parse(payMethodsRaw) : DEFAULT_PAYMENT_METHODS;
  const technicians = techRaw ? JSON.parse(techRaw) : DEFAULT_STAFF;
  const users = usersRaw ? JSON.parse(usersRaw) : [];
  const activeSession = sessRaw ? JSON.parse(sessRaw) : null;
  const jobCounter = counterRaw ? parseInt(counterRaw, 10) : 0;
  const waTemplates = waRaw ? JSON.parse(waRaw) : DEFAULT_WA_TEMPLATES;

  let customers = parsedCustomers;
  let services = parsedServices;
  let inventory = parsedInventory;

  // Prioritize direct query data from real cloud Firestore collections if authenticated and requested
  try {
    const fb = await import("./firebase");
    const { collection, getDocs } = await import("firebase/firestore");
    if (fb.auth.currentUser && forceCloudQuery) {
      const [custSnap, servSnap, invSnap] = await Promise.all([
        getDocs(collection(fb.db, "customers")),
        getDocs(collection(fb.db, "service_jobs")),
        getDocs(collection(fb.db, "inventory"))
      ]);

      if (!custSnap.empty) {
        customers = custSnap.docs.map(doc => doc.data()) as Customer[];
      }
      if (!servSnap.empty) {
        services = servSnap.docs.map(doc => doc.data()) as ServiceJob[];
      }
      if (!invSnap.empty) {
        inventory = invSnap.docs.map(doc => doc.data()) as InventoryItem[];
      }
    }
  } catch (err) {
    console.warn("Firestore cloud collection fetch deferred or offline, fallback to flat cache:", err);
  }

  // Initialize fresh subscription if none exists: 15 days free Premium trial plan!
  const defaultSub: SubscriptionDetail = {
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
  };
  const parsedSub: any = subRaw ? JSON.parse(subRaw) : defaultSub;
  
  // Backward compatibility migration: Map legacy paid tiers "Growth" and "Enterprise" to "Premium"
  if (parsedSub) {
    if (parsedSub.plan === "Growth" || parsedSub.plan === "Enterprise") {
      parsedSub.plan = "Premium";
    } else if (parsedSub.plan !== "Free" && parsedSub.plan !== "Premium") {
      parsedSub.plan = "Free";
    }
    // Also upgrade payment history items if any
    if (Array.isArray(parsedSub.paymentHistory)) {
      parsedSub.paymentHistory.forEach((p: any) => {
        if (p.plan === "Growth" || p.plan === "Enterprise") {
          p.plan = "Premium";
        }
      });
    }
  }
  const subscription: SubscriptionDetail = parsedSub;

  // Seeding disabled for Play Store production upload
  let seededCustomers = [...customers];
  let seededServices = [...services];
  let seededInventory = [...inventory];
  let seededCounter = jobCounter;

  if (!serviceLocRaw) {
    await setCloudItem("inventory_service_service_locations", JSON.stringify(serviceLocations));
  }
  if (!stockLocRaw) {
    await setCloudItem("inventory_service_stock_locations", JSON.stringify(stockLocations));
  }
  if (!payMethodsRaw) {
    await setCloudItem("inventory_service_payment_methods", JSON.stringify(paymentMethods));
  }
  if (!techRaw) {
    await setCloudItem("inventory_service_technicians", JSON.stringify(technicians));
  }
  if (!waRaw) {
    await setCloudItem("inventory_service_wa_templates", JSON.stringify(waTemplates));
  }
  if (!subRaw) {
    await setCloudItem("inventory_service_subscription", JSON.stringify(subscription));
  }

  return {
    customers: seededCustomers,
    services: seededServices,
    inventory: seededInventory,
    serviceLocations,
    stockLocations,
    paymentMethods,
    technicians,
    users,
    activeSession,
    jobCounter: seededCounter,
    waTemplates,
    subscription
  };
};

/**
 * Save data fields back to storage individually
 */
export const saveCustomers = async (customers: Customer[]): Promise<void> => {
  await setCloudItem("inventory_service_customers", JSON.stringify(customers));

  try {
    const fb = await import("./firebase");
    const { doc, setDoc, deleteDoc, getDocs, collection } = await import("firebase/firestore");
    if (fb.auth.currentUser) {
      for (const item of customers) {
        const cleanItem = {
          id: String(item.id),
          name: String(item.name),
          phone: String(item.phone),
          address: String(item.address || ""),
          notes: String(item.notes || ""),
          createdAt: String(item.createdAt || new Date().toISOString())
        };
        try {
          await setDoc(doc(fb.db, "customers", cleanItem.id), cleanItem);
        } catch (writeErr) {
          fb.handleFirestoreError(writeErr, fb.OperationType.WRITE, `customers/${cleanItem.id}`);
        }
      }

      // Sync deletes
      try {
        const snap = await getDocs(collection(fb.db, "customers"));
        const currentIds = customers.map(c => c.id);
        for (const d of snap.docs) {
          if (!currentIds.includes(d.id)) {
            await deleteDoc(doc(fb.db, "customers", d.id));
          }
        }
      } catch (logErr) {
        fb.handleFirestoreError(logErr, fb.OperationType.DELETE, "customers");
      }
    }
  } catch (err) {
    console.warn("Firestore customer synced offline/skipped:", err);
  }
};

export const saveServices = async (services: ServiceJob[]): Promise<void> => {
  await setCloudItem("inventory_service_services", JSON.stringify(services));

  try {
    const fb = await import("./firebase");
    const { doc, setDoc, deleteDoc, getDocs, collection } = await import("firebase/firestore");
    if (fb.auth.currentUser) {
      for (const item of services) {
        const cleanItem = {
          id: String(item.id),
          customerId: String(item.customerId),
          date: String(item.date || ""),
          items: Array.isArray(item.items) ? item.items.map(srvItem => ({
            id: String(srvItem.id),
            productName: String(srvItem.productName || ""),
            brand: String(srvItem.brand || ""),
            category: String(srvItem.category || ""),
            modelNo: String(srvItem.modelNo || ""),
            serialNo: String(srvItem.serialNo || ""),
            condition: String(srvItem.condition || ""),
            problemDescription: String(srvItem.problemDescription || ""),
            accessories: srvItem.accessories || {},
            serviceCharge: Number(srvItem.serviceCharge) || 0,
            spareCharge: Number(srvItem.spareCharge) || 0,
            discount: Number(srvItem.discount) || 0,
            total: Number(srvItem.total) || 0,
            technicianId: String(srvItem.technicianId || ""),
            status: String(srvItem.status || "Received"),
            statusHistory: Array.isArray(srvItem.statusHistory) ? srvItem.statusHistory.map(sh => ({
              status: String(sh.status),
              changedBy: String(sh.changedBy || ""),
              timestamp: String(sh.timestamp || new Date().toISOString())
            })) : [],
            currentLocation: String(srvItem.currentLocation || ""),
            locationHistory: Array.isArray(srvItem.locationHistory) ? srvItem.locationHistory.map(lh => ({
              location: String(lh.location),
              assignedBy: String(lh.assignedBy || ""),
              timestamp: String(lh.timestamp || new Date().toISOString())
            })) : [],
            replacements: Array.isArray(srvItem.replacements) ? srvItem.replacements.map(rep => ({
              id: String(rep.id),
              partName: String(rep.partName || ""),
              oldSerial: String(rep.oldSerial || ""),
              newSerial: String(rep.newSerial || ""),
              oldModel: String(rep.oldModel || ""),
              newModel: String(rep.newModel || ""),
              reason: String(rep.reason || ""),
              timestamp: String(rep.timestamp || new Date().toISOString())
            })) : []
          })) : [],
          waEnabled: Boolean(item.waEnabled),
          paymentStatus: String(item.paymentStatus || "Unpaid"),
          paymentMethod: String(item.paymentMethod || "UPI"),
          grandTotal: Number(item.grandTotal) || 0,
          paidAmount: Number(item.paidAmount) || 0,
          paidDate: String(item.paidDate || ""),
          createdAt: String(item.createdAt || new Date().toISOString()),
          paymentNotes: String(item.paymentNotes || "")
        };
        try {
          await setDoc(doc(fb.db, "service_jobs", cleanItem.id), cleanItem);
        } catch (writeErr) {
          fb.handleFirestoreError(writeErr, fb.OperationType.WRITE, `service_jobs/${cleanItem.id}`);
        }
      }

      // Sync deletes
      try {
        const snap = await getDocs(collection(fb.db, "service_jobs"));
        const currentIds = services.map(s => s.id);
        for (const d of snap.docs) {
          if (!currentIds.includes(d.id)) {
            await deleteDoc(doc(fb.db, "service_jobs", d.id));
          }
        }
      } catch (logErr) {
        fb.handleFirestoreError(logErr, fb.OperationType.DELETE, "service_jobs");
      }
    }
  } catch (err) {
    console.warn("Firestore service jobs synced offline/skipped:", err);
  }
};

export const saveInventory = async (inventory: InventoryItem[]): Promise<void> => {
  await setCloudItem("inventory_service_inventory", JSON.stringify(inventory));

  try {
    const fb = await import("./firebase");
    const { doc, setDoc, deleteDoc, getDocs, collection } = await import("firebase/firestore");
    if (fb.auth.currentUser) {
      for (const item of inventory) {
        const cleanItem = {
          id: String(item.id),
          brand: String(item.brand),
          category: String(item.category),
          modelNo: String(item.modelNo),
          serialNo: String(item.serialNo || ""),
          productName: String(item.productName),
          quantity: Math.floor(Number(item.quantity) || 0),
          minQuantity: Math.floor(Number(item.minQuantity) || 5),
          location: String(item.location || ""),
          purchaseDate: String(item.purchaseDate || ""),
          supplier: String(item.supplier || ""),
          status: String(item.status || "Active"),
          notes: String(item.notes || ""),
          history: Array.isArray(item.history) ? item.history.map(h => ({
            type: String(h.type) as "In" | "Out",
            quantity: Math.floor(Number(h.quantity) || 0),
            notes: String(h.notes || ""),
            timestamp: String(h.timestamp || new Date().toISOString()),
            user: String(h.user || "Operator")
          })) : [],
          createdAt: String(item.createdAt || new Date().toISOString())
        };
        try {
          await setDoc(doc(fb.db, "inventory", cleanItem.id), cleanItem);
        } catch (writeErr) {
          fb.handleFirestoreError(writeErr, fb.OperationType.WRITE, `inventory/${cleanItem.id}`);
        }
      }

      // Sync deletes
      try {
        const snap = await getDocs(collection(fb.db, "inventory"));
        const currentIds = inventory.map(i => i.id);
        for (const d of snap.docs) {
          if (!currentIds.includes(d.id)) {
            await deleteDoc(doc(fb.db, "inventory", d.id));
          }
        }
      } catch (logErr) {
        fb.handleFirestoreError(logErr, fb.OperationType.DELETE, "inventory");
      }
    }
  } catch (err) {
    console.warn("Firestore inventory synced offline/skipped:", err);
  }
};

export const saveServiceLocations = async (locations: string[]): Promise<void> => {
  await setCloudItem("inventory_service_service_locations", JSON.stringify(locations));
};

export const saveStockLocations = async (locations: string[]): Promise<void> => {
  await setCloudItem("inventory_service_stock_locations", JSON.stringify(locations));
};

export const saveLocations = async (locations: string[]): Promise<void> => {
  await setCloudItem("inventory_service_service_locations", JSON.stringify(locations));
};

export const saveTechnicians = async (technicians: Staff[]): Promise<void> => {
  await setCloudItem("inventory_service_technicians", JSON.stringify(technicians));
};

export const saveUsers = async (users: any[]): Promise<void> => {
  await setCloudItem("inventory_service_users", JSON.stringify(users));
};

export const saveSession = async (session: any | null): Promise<void> => {
  if (typeof window !== "undefined") {
    if (session) {
      localStorage.setItem("inventory_service_session_v2", JSON.stringify(session));
    } else {
      localStorage.removeItem("inventory_service_session_v2");
    }
  }
};

export const saveJobCounter = async (counter: number): Promise<void> => {
  await setCloudItem("inventory_service_job_counter", counter.toString());
};

export const saveWaTemplates = async (templates: WhatsAppTemplate[]): Promise<void> => {
  await setCloudItem("inventory_service_wa_templates", JSON.stringify(templates));
};

export const savePaymentMethods = async (methods: string[]): Promise<void> => {
  await setCloudItem("inventory_service_payment_methods", JSON.stringify(methods));
};

export const saveSubscription = async (sub: SubscriptionDetail): Promise<void> => {
  await setCloudItem("inventory_service_subscription", JSON.stringify(sub));
};
