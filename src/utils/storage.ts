import {
  Customer,
  ServiceJob,
  InventoryItem,
  Staff,
  WhatsAppTemplate,
  JobStatus
} from "../types";

// Default storage locations
export const DEFAULT_LOCATIONS = [
  "Shelf A",
  "Rack B",
  "Store Room",
  "Repair Table",
  "Delivery Area"
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

Thank you for trusting Inventory Service for your CCTV & security electronics. Have a great day!`
  }
];

// Fallback helper to interact with window.storage
const isBrowser = typeof window !== "undefined";

export const getCloudItem = async (key: string): Promise<string | null> => {
  if (!isBrowser) return null;
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
  // Write to window.storage
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

  // LocalStorage write for instant read-backs and tab sync helper
  try {
    localStorage.setItem(key, value);
    window.dispatchEvent(new Event("storage_sync"));
  } catch (err) {
    console.warn("localStorage.setItem failed", err);
  }
};

/**
 * Load all databases or initialize with default structure
 */
export interface AppData {
  customers: Customer[];
  services: ServiceJob[];
  inventory: InventoryItem[];
  locations: string[];
  technicians: Staff[];
  users: any[];
  activeSession: any | null;
  jobCounter: number;
  waTemplates: WhatsAppTemplate[];
}

export const loadAllData = async (): Promise<AppData> => {
  const [
    custRaw,
    servRaw,
    invRaw,
    locRaw,
    techRaw,
    usersRaw,
    sessRaw,
    counterRaw,
    waRaw
  ] = await Promise.all([
    getCloudItem("inventory_service_customers"),
    getCloudItem("inventory_service_services"),
    getCloudItem("inventory_service_inventory"),
    getCloudItem("inventory_service_locations"),
    getCloudItem("inventory_service_technicians"),
    getCloudItem("inventory_service_users"),
    getCloudItem("inventory_service_session_v2"),
    getCloudItem("inventory_service_job_counter"),
    getCloudItem("inventory_service_wa_templates")
  ]);

  const customers = custRaw ? JSON.parse(custRaw) : [];
  const services = servRaw ? JSON.parse(servRaw) : [];
  const inventory = invRaw ? JSON.parse(invRaw) : [];
  const locations = locRaw ? JSON.parse(locRaw) : DEFAULT_LOCATIONS;
  const technicians = techRaw ? JSON.parse(techRaw) : DEFAULT_STAFF;
  const users = usersRaw ? JSON.parse(usersRaw) : [];
  const activeSession = sessRaw ? JSON.parse(sessRaw) : null;
  const jobCounter = counterRaw ? parseInt(counterRaw, 10) : 0;
  const waTemplates = waRaw ? JSON.parse(waRaw) : DEFAULT_WA_TEMPLATES;

  // Let's seed initial mock data if empty (for beautiful immediate load)
  let seededCustomers = [...customers];
  let seededServices = [...services];
  let seededInventory = [...inventory];
  let seededCounter = jobCounter;

  if (customers.length === 0 && services.length === 0) {
    // Let's seed 1 default customer
    const sampleCust: Customer = {
      id: "CUST-1001",
      name: "Ramesh Sharma",
      phone: "+919876543210",
      address: "First Cross Road, Near Central Library, Bangalore 560001",
      notes: "Preferred customer, CCTV system maintenance contract holder.",
      createdAt: new Date().toISOString()
    };
    seededCustomers.push(sampleCust);

    // Let's seed 1 service job with 2 devices
    seededCounter = 1;
    const sampleJob: ServiceJob = {
      id: "INVSRV-2026-0001",
      customerId: "CUST-1001",
      date: "2026-06-07",
      createdAt: new Date().toISOString(),
      waEnabled: true,
      paymentStatus: "Partial",
      paymentMethod: "UPI",
      grandTotal: 1750,
      paidAmount: 500,
      items: [
        {
          id: "INVSRV-2026-0001-A",
          productName: "Dahua IP Camera 4MP",
          brand: "Dahua",
          category: "CCTV Dome Camera",
          modelNo: "DS-2CD2143G0-I",
          serialNo: "HK883719042",
          condition: "Lens dirty, power cuts off after 5 mins",
          problemDescription: "Power board failure and needs lens clean",
          accessories: {
            Adapter: false,
            dvr: false,
            nvr: false,
            HDD: false,
            WiFi: false,
            "sim camera": false,
            "Power Supply": true,
            "Memory Card": true
          },
          serviceCharge: 450,
          spareCharge: 350,
          discount: 50,
          total: 750,
          technicianId: "S1", // Vijay Naik
          status: "Repairing",
          statusHistory: [
            { status: "Received", changedBy: "Vijay Naik", timestamp: "2026-06-07T09:00:00Z" },
            { status: "Under Inspection", changedBy: "Vijay Naik", timestamp: "2026-06-07T10:00:00Z" },
            { status: "Repairing", changedBy: "Vijay Naik", timestamp: "2026-06-07T11:30:00Z" }
          ],
          currentLocation: "Repair Table",
          locationHistory: [
            { location: "Shelf A", assignedBy: "Vijay Naik", timestamp: "2026-06-07T09:05:00Z" },
            { location: "Repair Table", assignedBy: "Vijay Naik", timestamp: "2026-06-07T11:40:00Z" }
          ],
          replacements: [
            {
              id: "REP-1",
              partName: "Power Regulator IC",
              oldSerial: "78M05-391",
              newSerial: "78M05-88A",
              oldModel: "Regulator IC v1",
              newModel: "Regulator IC Premium",
              reason: "Damaged due to voltage spike",
              timestamp: "2026-06-07T11:45:00Z"
            }
          ]
        },
        {
          id: "INVSRV-2026-0001-B",
          productName: "D-Link 8-Port PoE Switch",
          brand: "D-Link",
          category: "Networking Switch",
          modelNo: "DES-1008P",
          serialNo: "DL617293112",
          condition: "Port 3 and 4 not giving power",
          problemDescription: "PoE controller chip replacement",
          accessories: {
            Adapter: true,
            dvr: false,
            nvr: false,
            HDD: false,
            WiFi: false,
            "sim camera": false,
            "Power Supply": false,
            "Memory Card": false
          },
          serviceCharge: 600,
          spareCharge: 400,
          discount: 0,
          total: 1000,
          technicianId: "S2", // Anand Kumar
          status: "Under Inspection",
          statusHistory: [
            { status: "Received", changedBy: "Deepa Nair", timestamp: "2026-06-07T09:10:00Z" },
            { status: "Under Inspection", changedBy: "Anand Kumar", timestamp: "2026-06-07T10:15:00Z" }
          ],
          currentLocation: "Shelf A",
          locationHistory: [
            { location: "Shelf A", assignedBy: "Deepa Nair", timestamp: "2026-06-07T09:15:00Z" }
          ],
          replacements: []
        }
      ]
    };
    seededServices.push(sampleJob);
  }

  if (inventory.length === 0) {
    // Seed some inventory items
    seededInventory = [
      {
        id: "INV-1001",
        brand: "Dahua",
        category: "CCTV Bullet Camera",
        modelNo: "DS-2CE16D0T-IR",
        serialNo: "DH192837482",
        productName: "Dahua 2MP Outdoor Bullet Camera",
        quantity: 12,
        minQuantity: 5,
        location: "Store Room",
        createdAt: new Date().toISOString(),
        history: [{ type: "In", quantity: 12, notes: "Initial setup stock", timestamp: new Date().toISOString(), user: "Suresh Patil" }]
      },
      {
        id: "INV-1002",
        brand: "CP Plus",
        category: "DVR Receiver",
        modelNo: "CP-UVR-0801E1",
        serialNo: "CP992837119",
        productName: "CP Plus 8-Channel UVR",
        quantity: 3, // Trigger low stock alert!
        minQuantity: 5,
        location: "Warehouse B",
        createdAt: new Date().toISOString(),
        history: [{ type: "In", quantity: 3, notes: "Leftover stock", timestamp: new Date().toISOString(), user: "Suresh Patil" }]
      },
      {
        id: "INV-1003",
        brand: "Seagate",
        category: "Hard Disk Drive",
        modelNo: "ST2000VX015",
        serialNo: "SG663819021",
        productName: "Seagate SkyHawk 2TB Surveillance HDD",
        quantity: 8,
        minQuantity: 5,
        location: "Store Room",
        createdAt: new Date().toISOString(),
        history: [{ type: "In", quantity: 8, notes: "Purchased on contract", timestamp: new Date().toISOString(), user: "Suresh Patil" }]
      }
    ];
  }

  // Save seeded if empty
  if (customers.length === 0 && services.length === 0) {
    await setCloudItem("inventory_service_customers", JSON.stringify(seededCustomers));
    await setCloudItem("inventory_service_services", JSON.stringify(seededServices));
    await setCloudItem("inventory_service_job_counter", seededCounter.toString());
  }
  if (inventory.length === 0) {
    await setCloudItem("inventory_service_inventory", JSON.stringify(seededInventory));
  }
  if (!locRaw) {
    await setCloudItem("inventory_service_locations", JSON.stringify(locations));
  }
  if (!techRaw) {
    await setCloudItem("inventory_service_technicians", JSON.stringify(technicians));
  }
  if (!waRaw) {
    await setCloudItem("inventory_service_wa_templates", JSON.stringify(waTemplates));
  }

  return {
    customers: seededCustomers,
    services: seededServices,
    inventory: seededInventory,
    locations,
    technicians,
    users,
    activeSession,
    jobCounter: seededCounter,
    waTemplates
  };
};

/**
 * Save data fields back to storage individually
 */
export const saveCustomers = async (customers: Customer[]): Promise<void> => {
  await setCloudItem("inventory_service_customers", JSON.stringify(customers));
};

export const saveServices = async (services: ServiceJob[]): Promise<void> => {
  await setCloudItem("inventory_service_services", JSON.stringify(services));
};

export const saveInventory = async (inventory: InventoryItem[]): Promise<void> => {
  await setCloudItem("inventory_service_inventory", JSON.stringify(inventory));
};

export const saveLocations = async (locations: string[]): Promise<void> => {
  await setCloudItem("inventory_service_locations", JSON.stringify(locations));
};

export const saveTechnicians = async (technicians: Staff[]): Promise<void> => {
  await setCloudItem("inventory_service_technicians", JSON.stringify(technicians));
};

export const saveUsers = async (users: any[]): Promise<void> => {
  await setCloudItem("inventory_service_users", JSON.stringify(users));
};

export const saveSession = async (session: any | null): Promise<void> => {
  await setCloudItem("inventory_service_session_v2", JSON.stringify(session));
};

export const saveJobCounter = async (counter: number): Promise<void> => {
  await setCloudItem("inventory_service_job_counter", counter.toString());
};

export const saveWaTemplates = async (templates: WhatsAppTemplate[]): Promise<void> => {
  await setCloudItem("inventory_service_wa_templates", JSON.stringify(templates));
};
