import React, { useState, useMemo, useEffect, useRef } from "react";
import QRScannerModal from "./QRScannerModal";
import {
  Customer,
  ServiceJob,
  ServiceItem,
  Staff,
  WhatsAppTemplate,
  JobStatus,
  AccessoryKey,
  ReplacementLog,
  PaymentStatus,
  PaymentMethod,
  SubscriptionDetail,
  PLAN_LIMITS
} from "../types";
import {
  Search,
  Plus,
  Hammer,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  ChevronDown,
  ChevronRight,
  User,
  Wrench,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
  X,
  PlusCircle,
  Trash2,
  Barcode,
  Save,
  MessageSquare,
  BadgeAlert,
  Building,
  CreditCard
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  generateQRUrl,
  compileWhatsAppMessage,
  getWhatsAppClickUrl,
  compileTrackingMessage
} from "../utils/helpers";

interface ServicesTabProps {
  services: ServiceJob[];
  customers: Customer[];
  technicians: Staff[];
  locations: string[];
  paymentMethods?: string[];
  waTemplates: WhatsAppTemplate[];
  currentUser: any;
  subscription?: SubscriptionDetail;
  onAddJob: (job: ServiceJob) => void;
  onUpdateJob: (job: ServiceJob) => void;
  onAddCustomLocation: (loc: string) => void;
  onAddCustomer: (data: Omit<Customer, "id" | "createdAt">) => Promise<Customer | undefined>;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export default function ServicesTab({
  services,
  customers,
  technicians,
  locations,
  paymentMethods = [],
  waTemplates,
  currentUser,
  subscription,
  onAddJob,
  onUpdateJob,
  onAddCustomLocation,
  onAddCustomer,
  showToast
}: ServicesTabProps) {
  // Query Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Jobs history sub-tab states
  const [activeJobsSubTab, setActiveJobsSubTab] = useState<"active" | "history">("active");
  const [jobsHistorySearch, setJobsHistorySearch] = useState("");
  const [jobsHistoryFilterType, setJobsHistoryFilterType] = useState<"All" | "status" | "location" | "replacement">("All");

  // Selection states
  const [selectedJob, setSelectedJob] = useState<ServiceJob | null>(null);

  // Compile full jobs audit feed
  const allJobsHistory = useMemo(() => {
    const events: {
      type: "status" | "location" | "replacement";
      jobId: string;
      itemId: string;
      customerName: string;
      brand: string;
      modelNo: string;
      title: string;
      detail: string;
      operator: string;
      timestamp: string;
      rawItem: ServiceItem;
      rawJob: ServiceJob;
    }[] = [];

    services.forEach(job => {
      const cust = customers.find(c => c.id === job.customerId);
      const cName = cust ? cust.name : "Walk-in Client";

      job.items.forEach(item => {
        // 1. Status history
        if (item.statusHistory) {
          item.statusHistory.forEach(sh => {
            events.push({
              type: "status",
              jobId: job.id,
              itemId: item.id,
              customerName: cName,
              brand: item.brand,
              modelNo: item.modelNo,
              title: `Status: ${sh.status}`,
              detail: `Device transitioned to "${sh.status}".`,
              operator: sh.changedBy || "Staff",
              timestamp: sh.timestamp,
              rawItem: item,
              rawJob: job
            });
          });
        }

        // 2. Location history
        if (item.locationHistory) {
          item.locationHistory.forEach(lh => {
            events.push({
              type: "location",
              jobId: job.id,
              itemId: item.id,
              customerName: cName,
              brand: item.brand,
              modelNo: item.modelNo,
              title: `Location: ${lh.location}`,
              detail: `Moved to physical bay "${lh.location}".`,
              operator: lh.assignedBy || "Staff",
              timestamp: lh.timestamp,
              rawItem: item,
              rawJob: job
            });
          });
        }

        // 3. Replacements history
        if (item.replacements) {
          item.replacements.forEach(rp => {
            events.push({
              type: "replacement",
              jobId: job.id,
              itemId: item.id,
              customerName: cName,
              brand: item.brand,
              modelNo: item.modelNo,
              title: `Replaced Part`,
              detail: `Swapped "${rp.partName}". Reason: ${rp.reason || "Replacement"}.`,
              operator: item.statusHistory?.[0]?.changedBy || "Technician",
              timestamp: rp.timestamp,
              rawItem: item,
              rawJob: job
            });
          });
        }
      });
    });

    // Sort by timestamp descending
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [services]);

  // Filter compiled history
  const filteredJobsHistory = useMemo(() => {
    return allJobsHistory.filter(ev => {
      // 1. Type filter
      if (jobsHistoryFilterType !== "All" && ev.type !== jobsHistoryFilterType) {
        return false;
      }

      // 2. Search search
      if (jobsHistorySearch.trim()) {
        const q = jobsHistorySearch.toLowerCase();
        const matchJobId = ev.jobId.toLowerCase().includes(q);
        const matchItemId = ev.itemId.toLowerCase().includes(q);
        const matchCust = ev.customerName.toLowerCase().includes(q);
        const matchBrand = ev.brand.toLowerCase().includes(q);
        const matchModel = ev.modelNo.toLowerCase().includes(q);
        const matchTitle = ev.title.toLowerCase().includes(q);
        const matchDetail = ev.detail.toLowerCase().includes(q);
        const matchOp = ev.operator.toLowerCase().includes(q);

        if (!matchJobId && !matchItemId && !matchCust && !matchBrand && !matchModel && !matchTitle && !matchDetail && !matchOp) {
          return false;
        }
      }

      return true;
    });
  }, [allJobsHistory, jobsHistorySearch, jobsHistoryFilterType]);
  const [selectedItem, setSelectedItem] = useState<ServiceItem | null>(null);

  // AI Diagnostic States
  const [isAnalyzingDI, setIsAnalyzingDI] = useState(false);
  const [aiDiagnosticData, setAiDiagnosticData] = useState<{
    possibleCauses: string[];
    diagnosticSteps: string[];
    estimatedHours: string;
    recommendedParts: string[];
    proActiveTips: string;
  } | null>(null);

  // Clear AI data when selected item changes
  useEffect(() => {
    setAiDiagnosticData(null);
  }, [selectedItem?.id]);

  const [merchantDetails, setMerchantDetails] = useState<any>(null);

  useEffect(() => {
    const loadMerchant = () => {
      try {
        const raw = localStorage.getItem("merchant_payout_details");
        if (raw) {
          setMerchantDetails(JSON.parse(raw));
        } else {
          setMerchantDetails(null);
        }
      } catch (err) {}
    };
    loadMerchant();
    
    window.addEventListener("storage_sync", loadMerchant);
    window.addEventListener("storage", loadMerchant);
    return () => {
      window.removeEventListener("storage_sync", loadMerchant);
      window.removeEventListener("storage", loadMerchant);
    };
  }, []);

  const handleRunAIDiagnosis = async () => {
    if (!selectedItem) return;
    setIsAnalyzingDI(true);
    setAiDiagnosticData(null);
    try {
      const response = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueDescription: `${selectedItem.productName} (${selectedItem.category}): ${selectedItem.problemDescription || "blurry picture / power issue"}. Brand: ${selectedItem.brand}`
        })
      });
      if (response.ok) {
        const data = await response.json();
        setAiDiagnosticData(data);
        showToast("AI diagnostics retrieved successfully", "success");
      } else {
        try {
          const err = await response.json();
          showToast(err.error || "AI diagnose failed", "error");
        } catch {
          showToast("AI diagnose failed", "error");
        }
      }
    } catch (err: any) {
      showToast(err.message || "Failed to analyze with AI", "error");
    } finally {
      setIsAnalyzingDI(false);
    }
  };

  // AI SMS/WhatsApp copy draft states
  const [isDraftingMsg, setIsDraftingMsg] = useState(false);
  const [draftedMsg, setDraftedMsg] = useState<string | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);

  const handleDraftAIUpdateMessage = async (customerName: string, jobNo: string, itemsDesc: string, status: string) => {
    setIsDraftingMsg(true);
    setDraftedMsg(null);
    setShowDraftModal(true);
    try {
      const response = await fetch("/api/ai/draft-msg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          jobNo,
          itemsDescription: itemsDesc,
          status
        })
      });
      if (response.ok) {
        const data = await response.json();
        setDraftedMsg(data.messageText);
        showToast("AI notification draft generated", "success");
      } else {
        try {
          const err = await response.json();
          showToast(err.error || "AI copywriting failed", "error");
        } catch {
          showToast("AI copywriting failed", "error");
        }
      }
    } catch (err: any) {
      showToast(err.message || "Failed to generate update draft", "error");
    } finally {
      setIsDraftingMsg(false);
    }
  };

  // New Job Builder States
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [selectedCustId, setSelectedCustId] = useState("");
  const [waEnabled, setWaEnabled] = useState(true);

  // Inline Client reference search & add states for showAddJobModal
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [showInlineAddCustomer, setShowInlineAddCustomer] = useState(false);
  const [inlineCustName, setInlineCustName] = useState("");
  const [inlineCustPhone, setInlineCustPhone] = useState("");
  const [inlineCustAddress, setInlineCustAddress] = useState("");
  const [inlineCustNotes, setInlineCustNotes] = useState("");
  const [newJobItems, setNewJobItems] = useState<Omit<ServiceItem, "id" | "statusHistory" | "locationHistory" | "replacements">[]>([]);

  // Individual Form builders for adding a single item inside the new job
  const [tempProdName, setTempProdName] = useState("");
  const [tempBrand, setTempBrand] = useState("");
  const [tempCategory, setTempCategory] = useState("Hardware Component");
  const [tempModelNo, setTempModelNo] = useState("");
  const [tempSerialNo, setTempSerialNo] = useState("");
  const [tempCondition, setTempCondition] = useState("");
  const [tempProblem, setTempProblem] = useState("");
  const [tempAccessories, setTempAccessories] = useState<Record<AccessoryKey, boolean>>({
    Adapter: false,
    dvr: false,
    nvr: false,
    HDD: false,
    WiFi: false,
    "sim camera": false,
    "Power Supply": false,
    "Memory Card": false
  });
  const [tempServiceCharge, setTempServiceCharge] = useState(0);
  const [tempSpareCharge, setTempSpareCharge] = useState(0);
  const [tempDiscount, setTempDiscount] = useState(0);
  const [tempTechId, setTempTechId] = useState("");
  const [tempLocation, setTempLocation] = useState("Shelf A");

  // Burnt & Whole replacement states for new item drafting
  const [tempIsBurnt, setTempIsBurnt] = useState(false);
  const [tempBurntDetails, setTempBurntDetails] = useState("");
  const [tempIsProductReplaced, setTempIsProductReplaced] = useState(false);
  const [tempReplacementModelNo, setTempReplacementModelNo] = useState("");
  const [tempReplacementSerialNo, setTempReplacementSerialNo] = useState("");
  const [tempReplacementReason, setTempReplacementReason] = useState("");

  // Sub-modals inside Item details
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [newCustomLocText, setNewCustomLocText] = useState("");

  const [showReplacementModal, setShowReplacementModal] = useState(false);

  // Replacement log fields
  const [repPartName, setRepPartName] = useState("");
  const [repOldSerial, setRepOldSerial] = useState("");
  const [repNewSerial, setRepNewSerial] = useState("");
  const [repOldModel, setRepOldModel] = useState("");
  const [repNewModel, setRepNewModel] = useState("");
  const [repReason, setRepReason] = useState("");
  const [repUpdateCardDetails, setRepUpdateCardDetails] = useState(true);

  // Synchronize active item's burnt/replacement state fields on switch
  const [editBurntDetails, setEditBurntDetails] = useState("");
  const [actNewModel, setActNewModel] = useState("");
  const [actNewSerial, setActNewSerial] = useState("");
  const [actReason, setActReason] = useState("");
  const [showActiveReplForm, setShowActiveReplForm] = useState(false);

  useEffect(() => {
    if (selectedItem) {
      setEditBurntDetails(selectedItem.burntDetails || "");
      setActNewModel(selectedItem.replacementModelNo || selectedItem.modelNo || "");
      setActNewSerial(selectedItem.replacementSerialNo || "");
      setActReason(selectedItem.replacementReason || "");
      setShowActiveReplForm(!!selectedItem.isProductReplaced);
    } else {
      setEditBurntDetails("");
      setActNewModel("");
      setActNewSerial("");
      setActReason("");
      setShowActiveReplForm(false);
    }
  }, [selectedItem?.id]);

  // Barcode Camera scanning simulated states
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerTargetForm, setScannerTargetForm] = useState<
    | "model"
    | "serial"
    | "repNewSerial"
    | "repNewModel"
    | "draftRepModel"
    | "draftRepSerial"
    | "actNewModel"
    | "actNewSerial"
    | null
  >(null);
  const [scannedTextInput, setScannedTextInput] = useState("");
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Helper categories
  const categoriesList = ["Hardware Component", "Spares Kit", "Motherboard", "Receiver Unit", "Controller Module", "PoE Network Switch", "Power Supply Unit", "Storage Drive", "Router & AP", "Networking Switch", "Security Lock", "Custom Circuit Board", "General Electronics"];

  // Filter service jobs
  const filteredJobs = useMemo(() => {
    return services.filter(job => {
      const cust = customers.find(c => c.id === job.customerId);
      const custName = cust ? cust.name.toLowerCase() : "";
      const custPhone = cust ? cust.phone.toLowerCase() : "";
      const jobNo = job.id.toLowerCase();

      // Check search match
      const matchesSearch =
        jobNo.includes(searchTerm.toLowerCase()) ||
        custName.includes(searchTerm.toLowerCase()) ||
        custPhone.includes(searchTerm.toLowerCase()) ||
        job.items.some(
          it =>
            it.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            it.serialNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            it.modelNo.toLowerCase().includes(searchTerm.toLowerCase())
        );

      // Check status match
      let matchesStatus = true;
      if (statusFilter !== "All") {
        matchesStatus = job.items.some(it => it.status === statusFilter);
      }

      return matchesSearch && matchesStatus;
    });
  }, [services, customers, searchTerm, statusFilter]);


  // Filter clients inside create job card dialog
  const filteredSearchCustomers = useMemo(() => {
    if (!clientSearchQuery.trim()) return customers;
    const q = clientSearchQuery.toLowerCase();
    return customers.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [customers, clientSearchQuery]);

  // Handler to register customer contact inline in job card creation modal
  const handleInlineCustomerSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!inlineCustName || !inlineCustPhone) {
      showToast("Name and Phone are required for safety", "error");
      return;
    }

    const created = await onAddCustomer({
      name: inlineCustName,
      phone: inlineCustPhone,
      address: inlineCustAddress,
      notes: inlineCustNotes
    });

    if (created) {
      setSelectedCustId(created.id);
      // Reset inputs & hide the nested form
      setInlineCustName("");
      setInlineCustPhone("");
      setInlineCustAddress("");
      setInlineCustNotes("");
      setShowInlineAddCustomer(false);
      setClientSearchQuery("");
      showToast(`User ${created.name} registered and selected. Ready!`, "success");
    }
  };

  // Handle auto-focus of physical barcode scans input
  useEffect(() => {
    if (showScannerModal && scannerInputRef.current) {
      setTimeout(() => scannerInputRef.current?.focus(), 150);
    }
  }, [showScannerModal]);

  // Function to create a job number
  const generateNewJobNumber = () => {
    const currentYear = new Date().getFullYear();
    const matchesThisYear = services.filter(s => s.id.startsWith(`INVSRV-${currentYear}`));
    const nextNum = matchesThisYear.length + 1;
    const formattedNum = String(nextNum).padStart(4, "0");
    return `INVSRV-${currentYear}-${formattedNum}`;
  };

  // Add Item to under-construction list
  const handleAddNewItemToJobDraft = () => {
    if (!tempProdName) {
      showToast("Device Product Name is required", "error");
      return;
    }

    const itemTotal = Number(tempServiceCharge) + Number(tempSpareCharge) - Number(tempDiscount);

    const draftItem: Omit<ServiceItem, "id" | "statusHistory" | "locationHistory" | "replacements"> = {
      productName: tempProdName,
      brand: tempBrand || "Generic",
      category: tempCategory,
      modelNo: (tempIsProductReplaced && tempReplacementModelNo.trim()) ? tempReplacementModelNo.trim() : (tempModelNo || "Unspecified"),
      serialNo: (tempIsProductReplaced && tempReplacementSerialNo.trim()) ? tempReplacementSerialNo.trim() : (tempSerialNo || "N/A"),
      condition: tempCondition || "Slight wear",
      problemDescription: tempProblem || "Under inspection request",
      accessories: { ...tempAccessories },
      serviceCharge: Number(tempServiceCharge),
      spareCharge: Number(tempSpareCharge),
      discount: Number(tempDiscount),
      total: Math.max(0, itemTotal),
      technicianId: tempTechId || "S1",
      status: "Received",
      currentLocation: tempLocation,
      isBurnt: tempIsBurnt,
      burntDetails: tempIsBurnt ? tempBurntDetails : "",
      isProductReplaced: tempIsProductReplaced,
      replacementModelNo: tempIsProductReplaced ? tempReplacementModelNo : "",
      replacementSerialNo: tempIsProductReplaced ? tempReplacementSerialNo : "",
      replacementDate: tempIsProductReplaced ? new Date().toISOString().split("T")[0] : "",
      replacementReason: tempIsProductReplaced ? tempReplacementReason : ""
    };

    setNewJobItems([...newJobItems, draftItem]);

    // Clear item inputs for next device
    setTempProdName("");
    setTempBrand("");
    setTempCategory("Hardware Component");
    setTempModelNo("");
    setTempSerialNo("");
    setTempCondition("");
    setTempProblem("");
    setTempAccessories({
      Adapter: false,
      dvr: false,
      nvr: false,
      HDD: false,
      WiFi: false,
      "sim camera": false,
      "Power Supply": false,
      "Memory Card": false
    });
    setTempServiceCharge(0);
    setTempSpareCharge(0);
    setTempDiscount(0);
    setTempIsBurnt(false);
    setTempBurntDetails("");
    setTempIsProductReplaced(false);
    setTempReplacementModelNo("");
    setTempReplacementSerialNo("");
    setTempReplacementReason("");
    showToast("Added item to list draft! You can add more.", "info");
  };

  // Remove Item from under-construction list
  const handleRemoveDraftItem = (index: number) => {
    const cp = [...newJobItems];
    cp.splice(index, 1);
    setNewJobItems(cp);
    showToast("Removed device from compilation.", "info");
  };

  // Submit master job creation
  const handleMasterJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustId) {
      showToast("Must select a Customer first", "error");
      return;
    }

    if (newJobItems.length === 0) {
      showToast("Add at least 1 device to compiled job details", "error");
      return;
    }

    if (subscription) {
      const activePlan = subscription.plan;
      const ticketLimit = PLAN_LIMITS[activePlan].services;
      if (services.length >= ticketLimit) {
        showToast(`Ticket limit hit! Your '${activePlan}' plan is capped at ${ticketLimit} service tickets. Upgrade plan in More tab.`, "error");
        return;
      }
    }

    const jobNo = generateNewJobNumber();
    const totalCost = newJobItems.reduce((acc, it) => acc + it.total, 0);

    const newJob: ServiceJob = {
      id: jobNo,
      customerId: selectedCustId,
      date: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
      waEnabled,
      paymentStatus: "Unpaid",
      paymentMethod: "UPI",
      grandTotal: totalCost,
      paidAmount: 0,
      items: newJobItems.map((draft, idx) => {
        const itemLetter = String.fromCharCode(65 + idx); // e.g. A, B, C
        const itemId = `${jobNo}-${itemLetter}`;
        const staffName = technicians.find(t => t.id === draft.technicianId)?.name || currentUser?.name || "System";

        return {
          ...draft,
          id: itemId,
          status: "Received",
          statusHistory: [
            {
              status: "Received",
              changedBy: staffName,
              timestamp: new Date().toISOString()
            }
          ],
          locationHistory: [
            {
              location: draft.currentLocation,
              assignedBy: staffName,
              timestamp: new Date().toISOString()
            }
          ],
          replacements: []
        };
      })
    };

    onAddJob(newJob);
    setShowAddJobModal(false);
    setSelectedCustId("");
    setNewJobItems([]);
    showToast(`Successfully created multi-device Service Job ${jobNo}!`, "success");

    // Auto trigger WhatsApp update link if enabled
    if (waEnabled) {
      const cust = customers.find(c => c.id === newJob.customerId);
      const defaultTemplate = waTemplates.find(t => t.status === "Received")?.template || "";
      if (cust && defaultTemplate) {
        const payloadMsg = compileWhatsAppMessage(defaultTemplate, cust, newJob);
        window.open(getWhatsAppClickUrl(cust.phone, payloadMsg), "_blank");
      }
    }
  };

  // Update Item details status
  const handleItemStatusChange = (newStatus: JobStatus) => {
    if (!selectedJob || !selectedItem) return;

    const opUser = currentUser?.name || "Vijay Naik";

    // Update individual item
    const updatedItem: ServiceItem = {
      ...selectedItem,
      status: newStatus,
      statusHistory: [
        ...selectedItem.statusHistory,
        {
          status: newStatus,
          changedBy: opUser,
          timestamp: new Date().toISOString()
        }
      ]
    };

    // Replace in job items array
    const updatedItems = selectedJob.items.map(it => (it.id === selectedItem.id ? updatedItem : it));

    const updatedJob: ServiceJob = {
      ...selectedJob,
      items: updatedItems
    };

    onUpdateJob(updatedJob);
    setSelectedItem(updatedItem);
    setSelectedJob(updatedJob);
    showToast(`Status shifted to ${newStatus} · Synced ☁`, "success");

    // Trigger auto WhatsApp message if active
    if (selectedJob.waEnabled) {
      const cust = customers.find(c => c.id === selectedJob.customerId);
      const matchedTemplateObj = waTemplates.find(t => t.status === newStatus);
      if (cust && matchedTemplateObj) {
        const msgText = compileWhatsAppMessage(matchedTemplateObj.template, cust, updatedJob, [updatedItem]);
        window.open(getWhatsAppClickUrl(cust.phone, msgText), "_blank");
      }
    }
  };

  // Update Item Location
  const handleItemLocationChange = (newLoc: string) => {
    if (!selectedJob || !selectedItem) return;

    const opUser = currentUser?.name || "Vijay Naik";

    const updatedItem: ServiceItem = {
      ...selectedItem,
      currentLocation: newLoc,
      locationHistory: [
        ...selectedItem.locationHistory,
        {
          location: newLoc,
          assignedBy: opUser,
          timestamp: new Date().toISOString()
        }
      ]
    };

    const updatedItems = selectedJob.items.map(it => (it.id === selectedItem.id ? updatedItem : it));

    const updatedJob: ServiceJob = {
      ...selectedJob,
      items: updatedItems
    };

    onUpdateJob(updatedJob);
    setSelectedItem(updatedItem);
    setSelectedJob(updatedJob);
    showToast(`Device moved to: ${newLoc} · Synced ☁`, "success");
  };

  // Update Single Item charge matrix variables
  const handleUpdateItemCharges = (serv: number, spare: number, disc: number) => {
    if (!selectedJob || !selectedItem) return;

    const sumTotal = Number(serv) + Number(spare) - Number(disc);
    const updatedItem: ServiceItem = {
      ...selectedItem,
      serviceCharge: Number(serv),
      spareCharge: Number(spare),
      discount: Number(disc),
      total: Math.max(0, sumTotal)
    };

    const updatedItems = selectedJob.items.map(it => (it.id === selectedItem.id ? updatedItem : it));

    // Recalculate job grand total
    const netGrandTotal = updatedItems.reduce((sum, item) => sum + item.total, 0);

    const updatedJob: ServiceJob = {
      ...selectedJob,
      items: updatedItems,
      grandTotal: netGrandTotal
    };

    onUpdateJob(updatedJob);
    setSelectedItem(updatedItem);
    setSelectedJob(updatedJob);
    showToast("Charges matrix reassessed and calculated.", "info");
  };

  // Log new replacement parts
  const handleReplacementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !selectedItem) return;
    if (!repPartName || !repNewSerial) {
      showToast("Part name and new Serial barcode are required", "error");
      return;
    }

    const newLog: ReplacementLog = {
      id: "RL-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      partName: repPartName,
      oldSerial: repOldSerial || "Unspecified",
      newSerial: repNewSerial,
      oldModel: repOldModel || "Unspecified",
      newModel: repNewModel || "Unspecified",
      reason: repReason || "Damaged/Worn components replacement",
      timestamp: new Date().toISOString()
    };

    // Decide if we should overwrite the master device serial & model card
    let finalItemCardModel = selectedItem.modelNo;
    let finalItemCardSerial = selectedItem.serialNo;

    if (repUpdateCardDetails) {
      if (repNewModel) finalItemCardModel = repNewModel;
      finalItemCardSerial = repNewSerial;
      showToast("Updated item's Master Serial details.", "info");
    }

    const updatedItem: ServiceItem = {
      ...selectedItem,
      modelNo: finalItemCardModel,
      serialNo: finalItemCardSerial,
      replacements: [...selectedItem.replacements, newLog]
    };

    const updatedItems = selectedJob.items.map(it => (it.id === selectedItem.id ? updatedItem : it));

    const updatedJob: ServiceJob = {
      ...selectedJob,
      items: updatedItems
    };

    onUpdateJob(updatedJob);
    setSelectedItem(updatedItem);
    setSelectedJob(updatedJob);
    setShowReplacementModal(false);

    // Clear fields
    setRepPartName("");
    setRepOldSerial("");
    setRepNewSerial("");
    setRepOldModel("");
    setRepNewModel("");
    setRepReason("");
    showToast("Material replacement audit logged successfully!", "success");

    // Optional notification update alert
    if (selectedJob.waEnabled) {
      const cust = customers.find(c => c.id === selectedJob.customerId);
      if (cust) {
        const replacementNote = `🛠 *Material Replacement Logged* on ${selectedItem.productName}: Replaced Part: ${newLog.partName} | Old Serial: ${newLog.oldSerial} | New Serial: ${newLog.newSerial}. Reason: ${newLog.reason}`;
        window.open(getWhatsAppClickUrl(cust.phone, replacementNote), "_blank");
      }
    }
  };

  // Assign Technician to item
  const handleItemAssigneeChange = (techId: string) => {
    if (!selectedJob || !selectedItem) return;

    const updatedItem: ServiceItem = {
      ...selectedItem,
      technicianId: techId
    };

    const updatedItems = selectedJob.items.map(it => (it.id === selectedItem.id ? updatedItem : it));

    const updatedJob: ServiceJob = {
      ...selectedJob,
      items: updatedItems
    };

    onUpdateJob(updatedJob);
    setSelectedItem(updatedItem);
    setSelectedJob(updatedJob);
    showToast("Technician assigned successfully.", "success");
  };

  // Update Burnt power-surge status for active service item
  const handleToggleBurntState = (isBurnt: boolean, details: string) => {
    if (!selectedJob || !selectedItem) return;

    const updatedItem: ServiceItem = {
      ...selectedItem,
      isBurnt,
      burntDetails: isBurnt ? details : ""
    };

    const updatedItems = selectedJob.items.map(it => (it.id === selectedItem.id ? updatedItem : it));

    const updatedJob: ServiceJob = {
      ...selectedJob,
      items: updatedItems
    };

    onUpdateJob(updatedJob);
    setSelectedItem(updatedItem);
    setSelectedJob(updatedJob);
    showToast(isBurnt ? "🔥 Burnt state flagged on active node" : "Burnt state cleared", "info");

    // Send WhatsApp notification for burnt state change
    if (selectedJob.waEnabled) {
      const cust = customers.find(c => c.id === selectedJob.customerId);
      if (cust) {
        const msg = isBurnt
          ? `🔥 *Burnt / Power Surge Damage Flagged* on your device ${updatedItem.productName} (S/N: ${updatedItem.serialNo}):\nDetails: ${details || "High voltage peak surge damage found near motherboard tracks."}`
          : `✅ *Burnt Damage Flag Cleared* on your device ${updatedItem.productName} (S/N: ${updatedItem.serialNo}). Your device status has been updated.`;
        window.open(getWhatsAppClickUrl(cust.phone, msg), "_blank");
      }
    }
  };

  // Log complete physical product swap / warranty replacement
  const handleProductReplacementUpdate = (
    isReplaced: boolean,
    newModel: string,
    newSerial: string,
    reason: string
  ) => {
    if (!selectedJob || !selectedItem) return;

    const updatedItem: ServiceItem = {
      ...selectedItem,
      isProductReplaced: isReplaced,
      replacementModelNo: isReplaced ? newModel : "",
      replacementSerialNo: isReplaced ? newSerial : "",
      replacementReason: isReplaced ? reason : "",
      replacementDate: isReplaced ? new Date().toISOString().split("T")[0] : "",
      // Auto-update master serial and model if we full product replaced it, for active tracking
      modelNo: isReplaced && newModel.trim() ? newModel.trim() : selectedItem.modelNo,
      serialNo: isReplaced && newSerial.trim() ? newSerial.trim() : selectedItem.serialNo
    };

    const updatedItems = selectedJob.items.map(it => (it.id === selectedItem.id ? updatedItem : it));

    const updatedJob: ServiceJob = {
      ...selectedJob,
      items: updatedItems
    };

    onUpdateJob(updatedJob);
    setSelectedItem(updatedItem);
    setSelectedJob(updatedJob);
    showToast(isReplaced ? "🔄 Product replacement registered on active card" : "Product replacement details reverted", "success");

    // Send WhatsApp notification for whole-product swap / replacement
    if (selectedJob.waEnabled) {
      const cust = customers.find(c => c.id === selectedJob.customerId);
      if (cust) {
        const msg = isReplaced
          ? `🔄 *Warranty Product Swap/Replacement Registered* on your device ${selectedItem.productName}:\n• New Model: ${newModel || selectedItem.modelNo}\n• New Serial No: ${newSerial}\n• Reason: ${reason || "Damaged parent block, warranty issued swap unit"}\n• Issued Date: ${new Date().toISOString().split("T")[0]}`
          : `ℹ️ *Replacement Unit Details Reset/Reverted* on your device ${selectedItem.productName}. Please check with our service representative.`;
        window.open(getWhatsAppClickUrl(cust.phone, msg), "_blank");
      }
    }
  };

  // Submit overall Billing adjustment
  const handleJobBillingUpdate = (payStatus: PaymentStatus, payMethod: PaymentMethod, paidAmt: number, payNotes?: string) => {
    if (!selectedJob) return;

    const updatedJob: ServiceJob = {
      ...selectedJob,
      paymentStatus: payStatus,
      paymentMethod: payMethod,
      paidAmount: Number(paidAmt),
      paidDate: payStatus === "Paid" ? new Date().toISOString() : selectedJob.paidDate,
      paymentNotes: payNotes !== undefined ? payNotes : selectedJob.paymentNotes
    };

    onUpdateJob(updatedJob);
    setSelectedJob(updatedJob);
    showToast("Overall billing logs refreshed successfully · Synced ☁", "success");
  };

  // Real scan text parsing
  const handleTriggerRealScan = (scannedValue: string) => {
    let value = scannedValue.trim();
    if (!value) {
      showToast("Scan field is empty", "error");
      return;
    }

    // Decode QR/Barcode prefixes if present
    if (value.includes("INVSRV-MODEL:")) {
      value = value.substring(value.indexOf("INVSRV-MODEL:") + "INVSRV-MODEL:".length);
    } else if (value.includes("INVSRV-SERIAL:")) {
      value = value.substring(value.indexOf("INVSRV-SERIAL:") + "INVSRV-SERIAL:".length);
    } else if (value.includes("INVSRV-CUSTOMER:")) {
      value = value.substring(value.indexOf("INVSRV-CUSTOMER:") + "INVSRV-CUSTOMER:".length);
    } else if (value.includes("INVSRV-JOBCARD:")) {
      value = value.substring(value.indexOf("INVSRV-JOBCARD:") + "INVSRV-JOBCARD:".length);
    } else if (value.includes("INVSRV-LOCATION:")) {
      value = value.substring(value.indexOf("INVSRV-LOCATION:") + "INVSRV-LOCATION:".length);
    }

    if (scannerTargetForm === "model") {
      setTempModelNo(value);
      showToast(`🔑 Scanned Model No: ${value}`, "success");
    } else if (scannerTargetForm === "serial") {
      setTempSerialNo(value);
      showToast(`🔑 Scanned Serial No: ${value}`, "success");
    } else if (scannerTargetForm === "repNewSerial") {
      setRepNewSerial(value);
      showToast(`🔑 Scanned Replacement Serial: ${value}`, "success");
    } else if (scannerTargetForm === "repNewModel") {
      setRepNewModel(value);
      showToast(`🔑 Scanned Replacement Model: ${value}`, "success");
    } else if (scannerTargetForm === "draftRepModel") {
      setTempReplacementModelNo(value);
      showToast(`🔑 Scanned Draft Replacement Model: ${value}`, "success");
    } else if (scannerTargetForm === "draftRepSerial") {
      setTempReplacementSerialNo(value);
      showToast(`🔑 Scanned Draft Replacement Serial: ${value}`, "success");
    } else if (scannerTargetForm === "actNewModel") {
      setActNewModel(value);
      showToast(`🔑 Scanned Active Replacement Model: ${value}`, "success");
    } else if (scannerTargetForm === "actNewSerial") {
      setActNewSerial(value);
      showToast(`🔑 Scanned Active Replacement Serial: ${value}`, "success");
    } else if (scannerTargetForm === "servicesSearch") {
      setSearchTerm(value);
      showToast(`🔍 Services filtered by: ${value}`, "success");
    } else if (scannerTargetForm === "clientSearch") {
      setClientSearchQuery(value);
      setShowInlineAddCustomer(false);
      showToast(`🔍 Selecting client matching: ${value}`, "success");
    }

    setScannedTextInput("");
    setShowScannerModal(false);
    setScannerTargetForm(null);
  };

  const statusColors: Record<JobStatus, string> = {
    Received: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 border border-blue-500/20",
    "Under Inspection": "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400 border border-purple-500/20",
    Repairing: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-500/20",
    "Waiting for Parts": "bg-rose-100 text-rose-805 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-500/20",
    Completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-500/20",
    Delivered: "bg-gray-100 text-gray-800 dark:bg-stone-800 dark:text-stone-400 border border-stone-700/50"
  };

  // Add custom storage locations to stack
  const handleAddNewCustomLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomLocText.trim()) return;

    onAddCustomLocation(newCustomLocText.trim());
    setTempLocation(newCustomLocText.trim());
    setNewCustomLocText("");
    setShowAddLocationModal(false);
    showToast(`Added custom storage location node: ${newCustomLocText.trim()}`, "success");
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50 dark:bg-stone-950 transition-colors duration-200 pb-20 select-none">
      
      {/* Sub-Tab Selector for Jobs and History Log */}
      <div className="flex bg-slate-100/80 dark:bg-stone-900/60 p-1 rounded-2xl gap-1" id="jobs-sub-tabs">
        <button
          type="button"
          onClick={() => setActiveJobsSubTab("active")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black tracking-wide transition-all select-none cursor-pointer ${
            activeJobsSubTab === "active"
              ? "bg-white dark:bg-stone-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-gray-500 hover:text-gray-800 dark:hover:text-stone-300"
          }`}
        >
          <Hammer className="w-3.5 h-3.5" />
          <span>Active Jobs & Tickets</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveJobsSubTab("history")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black tracking-wide transition-all select-none cursor-pointer ${
            activeJobsSubTab === "history"
              ? "bg-white dark:bg-stone-800 text-amber-600 dark:text-amber-400 shadow-sm"
              : "text-gray-500 hover:text-gray-800 dark:hover:text-stone-300"
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Jobs Audit History Log</span>
        </button>
      </div>

      {activeJobsSubTab === "active" ? (
        <>
          {/* Search and Advanced Filters */}
          <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 dark:text-stone-500" />
            <input
              type="text"
              placeholder="Search by JobNo, Brand, Client, S/N..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-xl pl-9.5 pr-10 py-2.5 focus:outline-none focus:border-emerald-500 text-gray-800 dark:text-stone-200"
            />
            <button
              type="button"
              onClick={() => {
                setScannedTextInput("");
                setScannerTargetForm("servicesSearch");
                setShowScannerModal(true);
              }}
              className="absolute right-3 top-2.5 p-0.5 text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
              title="Scan Barcode / QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowAddJobModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold p-2.5 rounded-xl flex items-center gap-1 text-xs cursor-pointer shadow-sm transition-all whitespace-nowrap"
            id="btn-trigger-new-job"
          >
            <Plus className="w-4 h-4" />
            <span>New Job</span>
          </button>
        </div>

        {/* Tab Status Filter Badges Scrolling Rail */}
        <div className="flex gap-1.5 overflow-x-auto py-1 whitespace-nowrap no-scrollbar select-none">
          {["All", "Received", "Under Inspection", "Repairing", "Waiting for Parts", "Completed", "Delivered"].map(st => {
            const isSelected = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`text-[10px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                  isSelected
                    ? "bg-slate-800 dark:bg-stone-200 text-white dark:text-stone-950 border-slate-800 dark:border-stone-200 shadow-sm font-black"
                    : "bg-white dark:bg-stone-900 text-gray-500 dark:text-stone-400 border-gray-100 dark:border-stone-800/80 hover:bg-gray-50 dark:hover:bg-stone-800"
                }`}
              >
                {st}
              </button>
            );
          })}
        </div>
      </div>

      {/* Services List Grid */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="text-center p-10 bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800/80 rounded-2xl shadow-sm">
            <Hammer className="w-8 h-8 text-gray-300 dark:text-stone-700 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-gray-700 dark:text-stone-300">No Service Jobs Located</h4>
            <p className="text-[10px] text-gray-400 mt-1">
              Add a multi-tem job card to allocate repairs to workers.
            </p>
          </div>
        ) : (
          filteredJobs.map(job => {
            const cust = customers.find(c => c.id === job.customerId);
            return (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 p-4 rounded-xl text-left shadow-sm hover:border-emerald-500/25 dark:hover:border-emerald-500/10 cursor-pointer hover:shadow-md transition-all relative overflow-hidden"
              >
                {/* Visual Accent */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-blue-500"></div>

                <div className="flex justify-between items-start pl-1">
                  <div>
                    <span className="text-[9px] font-mono font-black uppercase tracking-wider bg-slate-100 dark:bg-stone-800 text-gray-500 dark:text-stone-400 px-2 py-0.5 rounded">
                      ID: {job.id}
                    </span>
                    <h3 className="text-sm font-extrabold text-gray-800 dark:text-stone-100 mt-2">
                      {cust ? cust.name : "Unknown Customer"}
                    </h3>
                    <p className="text-[10px] text-gray-400 dark:text-stone-500 font-medium">
                      Scheduled: {formatDate(job.date)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-stone-800 text-gray-700 dark:text-stone-300">
                      {job.items.length} items
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                      job.paymentStatus === "Paid"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
                        : job.paymentStatus === "Partial"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-400"
                    }`}>
                      {job.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Listing item categories inside card */}
                <div className="mt-3.5 space-y-1.5 pl-1.5 border-l border-gray-100 dark:border-stone-800/80">
                  {job.items.map((it, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px] text-gray-600 dark:text-stone-300 font-medium select-none">
                      <span className="truncate max-w-[200px]">
                        • {it.productName} <span className="font-mono text-gray-400">({it.brand})</span>
                      </span>
                      <span className="uppercase text-[8px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400">
                        {it.status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Reactive Burnt/Replacement Badges */}
                {(job.items.some(it => it.isBurnt) || job.items.some(it => it.isProductReplaced)) && (
                  <div className="flex gap-1.5 flex-wrap pl-1.5 mt-2">
                    {job.items.some(it => it.isBurnt) && (
                      <span className="text-[8px] font-black tracking-wider uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2   py-0.5 rounded border border-rose-500/15 flex items-center gap-0.5">
                        🔥 Burnt Damage Flagged
                      </span>
                    )}
                    {job.items.some(it => it.isProductReplaced) && (
                      <span className="text-[8px] font-black tracking-wider uppercase bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/15 flex items-center gap-0.5">
                        🔄 Unit Swapped / Replaced
                      </span>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t border-dashed border-gray-100 dark:border-stone-800 mt-4 text-[11px] text-gray-500 dark:text-stone-400 pl-1 select-none">
                  <span className="font-semibold">Grand Total:</span>
                  <span className="font-black text-xs text-gray-800 dark:text-stone-100">
                    {formatCurrency(job.grandTotal)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
        </>
      ) : (
        <div className="space-y-4" id="jobs-history-ledger-container">
          {/* Quick Header stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 p-3 rounded-2xl text-left shadow-xs">
              <span className="text-[10px] text-gray-400 dark:text-stone-500 font-bold block uppercase">Total Events</span>
              <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono mt-1 block">
                {allJobsHistory.length} actions
              </span>
            </div>
            <div className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 p-3 rounded-2xl text-left shadow-xs">
              <span className="text-[10px] text-gray-400 dark:text-stone-500 font-bold block uppercase">Status Updates</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1 block">
                {allJobsHistory.filter(e => e.type === "status").length} changes
              </span>
            </div>
            <div className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 p-3 rounded-2xl text-left shadow-xs">
              <span className="text-[10px] text-gray-400 dark:text-stone-500 font-bold block uppercase">Part Swaps</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1 block">
                {allJobsHistory.filter(e => e.type === "replacement").length} parts
              </span>
            </div>
          </div>

          {/* Search and filters */}
          <div className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 p-4 rounded-3xl space-y-3 shadow-xs">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 dark:text-stone-500" />
              <input
                type="text"
                placeholder="Search jobs audit log by JobNo, Client, Operator, Part..."
                value={jobsHistorySearch}
                onChange={e => setJobsHistorySearch(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-stone-850 border border-gray-100 dark:border-stone-800/80 rounded-xl pl-9.5 pr-4 py-2.5 focus:outline-none focus:border-amber-500 text-gray-800 dark:text-stone-200"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto py-1 items-center select-none no-scrollbar">
              <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider mr-1 shrink-0">Filter Type:</span>
              <button
                type="button"
                onClick={() => setJobsHistoryFilterType("All")}
                className={`px-2.5 py-1 text-[9px] font-extrabold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                  jobsHistoryFilterType === "All"
                    ? "bg-amber-600 border-amber-600 text-white"
                    : "bg-slate-50 dark:bg-stone-850 border-gray-100 dark:border-stone-800 text-gray-500 dark:text-stone-400 hover:text-gray-800"
                }`}
              >
                All Events
              </button>
              <button
                type="button"
                onClick={() => setJobsHistoryFilterType("status")}
                className={`px-2.5 py-1 text-[9px] font-extrabold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                  jobsHistoryFilterType === "status"
                    ? "bg-amber-600 border-amber-600 text-white"
                    : "bg-slate-50 dark:bg-stone-850 border-gray-100 dark:border-stone-800 text-gray-500 dark:text-stone-400 hover:text-gray-800"
                }`}
              >
                Status Changes ⚙️
              </button>
              <button
                type="button"
                onClick={() => setJobsHistoryFilterType("location")}
                className={`px-2.5 py-1 text-[9px] font-extrabold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                  jobsHistoryFilterType === "location"
                    ? "bg-amber-600 border-amber-600 text-white"
                    : "bg-slate-50 dark:bg-stone-850 border-gray-100 dark:border-stone-800 text-gray-500 dark:text-stone-400 hover:text-gray-800"
                }`}
              >
                Location Shifts 📍
              </button>
              <button
                type="button"
                onClick={() => setJobsHistoryFilterType("replacement")}
                className={`px-2.5 py-1 text-[9px] font-extrabold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                  jobsHistoryFilterType === "replacement"
                    ? "bg-amber-600 border-amber-600 text-white"
                    : "bg-slate-50 dark:bg-stone-850 border-gray-100 dark:border-stone-800 text-gray-500 dark:text-stone-400 hover:text-gray-800"
                }`}
              >
                Spare Part Swaps 🔧
              </button>
            </div>
          </div>

          {/* History Event Feed */}
          <div className="space-y-3">
            {filteredJobsHistory.length === 0 ? (
              <div className="text-center p-10 bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-2xl shadow-sm">
                <Clock className="w-8 h-8 text-gray-300 dark:text-stone-700 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-gray-700 dark:text-stone-300">No Audit Events Located</h4>
                <p className="text-[10px] text-gray-400 mt-1">
                  Adjust search or filter parameters to locate service logs.
                </p>
              </div>
            ) : (
              filteredJobsHistory.map((ev, index) => {
                const isStatus = ev.type === "status";
                const isLoc = ev.type === "location";

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedJob(ev.rawJob)}
                    className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 p-4 rounded-xl text-left shadow-sm hover:border-amber-500/25 dark:hover:border-amber-500/10 cursor-pointer hover:shadow-md transition-all relative overflow-hidden"
                  >
                    {/* Visual Accent */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                      isStatus 
                        ? "bg-emerald-500" 
                        : isLoc 
                          ? "bg-blue-500" 
                          : "bg-indigo-500"
                    }`}></div>

                    <div className="flex justify-between items-start pl-1 gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-mono font-black uppercase tracking-wider bg-slate-100 dark:bg-stone-800 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded">
                            Ticket #{ev.jobId}
                          </span>
                          <span className="text-[9px] font-mono font-black uppercase tracking-wider bg-slate-100 dark:bg-stone-800 text-gray-500 dark:text-stone-400 px-2 py-0.5 rounded">
                            Item {ev.itemId}
                          </span>
                          <span className="text-[9px] font-semibold text-gray-400">
                            by {ev.operator}
                          </span>
                        </div>

                        <h4 className="text-xs font-black text-gray-800 dark:text-stone-100 mt-2 truncate">
                          {ev.title}
                        </h4>
                        <p className="text-[10px] text-gray-500 dark:text-stone-400 mt-1 leading-relaxed">
                          {ev.detail}
                        </p>
                        <p className="text-[9px] text-gray-400 mt-1 font-medium italic">
                          Client: {ev.customerName} • Device: {ev.brand} {ev.modelNo}
                        </p>
                      </div>

                      <div className="flex flex-col items-end shrink-0 select-none">
                        <span className="text-[9px] font-mono text-gray-400 dark:text-stone-500">
                          {new Date(ev.timestamp).toLocaleDateString()}
                        </span>
                        <span className="text-[8px] font-mono text-gray-400 dark:text-stone-500">
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="mt-2 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-stone-800 text-gray-600 dark:text-stone-300">
                          {ev.type}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Slide-Up Bottom Sheet Modal: Job Full Details and item workflow actions */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-3xl border-t border-slate-200/50 dark:border-stone-800 max-h-[90vh] overflow-y-auto flex flex-col animate-slide-up select-none">
            
            {/* Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900 z-10 select-none">
              <div>
                <span className="text-[9px] font-mono font-black tracking-widest uppercase bg-slate-100 dark:bg-stone-800 px-2 py-0.5 rounded text-gray-500">
                  Service Ticket Detail Manager
                </span>
                <h3 className="text-base font-black text-gray-800 dark:text-stone-100 mt-1">
                  Ticket #{selectedJob.id}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedJob(null);
                  setSelectedItem(null);
                }}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-gray-500 active:scale-90 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 flex-1 select-none">
              
              {/* Client Info Summary Card with WhatsApp toggle */}
              <div className="p-4 bg-slate-50 dark:bg-stone-800/40 rounded-2xl border border-gray-100 dark:border-stone-800 space-y-3.5">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-[10px] uppercase font-black text-gray-400 tracking-wider">
                      Client Contact Info
                    </h4>
                    <p className="text-sm font-black text-gray-800 dark:text-stone-200 mt-0.5">
                      {customers.find(c => c.id === selectedJob.customerId)?.name || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5 select-all">
                      {customers.find(c => c.id === selectedJob.customerId)?.phone || "-"}
                    </p>
                  </div>

                  {/* QR code button printing utility for Entire JobCard */}
                  <div className="flex flex-col items-center">
                    <img
                      src={generateQRUrl(`INVSRV-JOBCARD:${selectedJob.id}`, "80x88")}
                      alt="Job QR"
                      className="w-16 h-16 pointer-events-none"
                    />
                    <span className="text-[8px] font-bold text-gray-400 mt-1 uppercase">
                      Job QR Code
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-stone-800 select-none">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-stone-300">
                      Auto WhatsApp Syncing
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedJob.waEnabled}
                      onChange={e => {
                        const updated = { ...selectedJob, waEnabled: e.target.checked };
                        onUpdateJob(updated);
                        setSelectedJob(updated);
                        showToast(`WhatsApp auto notifications: ${e.target.checked ? "Activated" : "Deactivated"}`, "info");
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-250 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {/* Customer Live Status Link Share */}
                <div className="pt-2 border-t border-gray-100 dark:border-stone-800 space-y-2">
                  <button
                    onClick={() => {
                      const cust = customers.find(c => c.id === selectedJob.customerId);
                      if (cust) {
                        const appUrl = window.location.origin + window.location.pathname;
                        const msgText = compileTrackingMessage(cust, selectedJob, appUrl);
                        window.open(getWhatsAppClickUrl(cust.phone, msgText), "_blank");
                        showToast("Compiled live tracking data & opened WhatsApp link!", "success");
                      } else {
                        showToast("Cannot locate client contact info!", "error");
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-97 transition-all text-white py-2 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs cursor-pointer select-none"
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span>Share Status Tracking Link</span>
                  </button>

                  <button
                    onClick={() => {
                      const cust = customers.find(c => c.id === selectedJob.customerId);
                      if (cust) {
                        const itemsStr = selectedJob.items.map(it => `${it.productName} (${it.status})`).join(", ");
                        const statusSummary = selectedJob.items.map(it => it.status).join(" / ");
                        handleDraftAIUpdateMessage(cust.name, selectedJob.id, itemsStr, statusSummary);
                      } else {
                        showToast("Cannot locate client contact info!", "error");
                      }
                    }}
                    disabled={isDraftingMsg}
                    className="w-full bg-indigo-650 hover:bg-indigo-700 disabled:bg-indigo-400 active:scale-97 transition-all text-white py-2 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs cursor-pointer select-none"
                  >
                    <span>✨ Draft AI WhatsApp Update</span>
                  </button>
                </div>
              </div>

              {/* Collapsible / Selectable Individual Devices Selector */}
              <div className="space-y-3.5">
                <div className="flex justify-between items-center bg-gray-50 dark:bg-stone-800/30 p-2.5 rounded-xl border border-gray-100 dark:border-stone-800">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-stone-200 uppercase tracking-wider">
                    Select Device to repair / inspect ({selectedJob.items.length})
                  </h4>
                  <Wrench className="w-4 h-4 text-emerald-500" />
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-[140px] overflow-y-auto pr-1">
                  {selectedJob.items.map((item, idx) => {
                    const isCur = selectedItem?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`p-3 rounded-xl border text-left shadow-xs transition-all active:scale-98 flex items-center justify-between ${
                          isCur
                            ? "bg-slate-800 dark:bg-stone-100 text-white dark:text-stone-950 border-slate-800 dark:border-stone-100 font-extrabold"
                            : "bg-white dark:bg-stone-900 text-gray-700 dark:text-stone-300 border-gray-100 dark:border-stone-800/80 hover:border-emerald-500/20"
                        }`}
                        id={`job-item-trigger-${item.id}`}
                      >
                        <div>
                          <div className="text-xs font-bold truncate max-w-[190px]">
                            {idx + 1}. {item.productName}
                          </div>
                          <div className="text-[9px] font-semibold opacity-75 mt-0.5 truncate max-w-[200px]">
                            M/N: {item.modelNo} | S/N: {item.serialNo}
                          </div>
                        </div>

                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase ${
                          isCur 
                            ? "bg-white/10 text-white border border-white/20"
                            : "bg-slate-100 dark:bg-stone-800 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {item.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Display Active Work State & Controls ONLY if an individual item is selected */}
              {selectedItem ? (
                <div className="p-4 bg-slate-50 dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-2xl space-y-4 shadow-sm relative">
                  
                  {/* Item Description Header */}
                  <div className="flex justify-between items-start gap-1">
                    <div>
                      <span className="text-[8px] font-mono font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                        Active Repair workflow node
                      </span>
                      <h4 className="text-sm font-black text-gray-800 dark:text-stone-100 mt-1">
                        {selectedItem.productName}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-medium">
                        Brand: {selectedItem.brand} | Category: {selectedItem.category}
                      </p>
                    </div>

                    <span className={`text-[9px] font-black px-2 py-0.5 rounded ${statusColors[selectedItem.status]}`}>
                      {selectedItem.status}
                    </span>
                  </div>

                  {/* Codes summary with print QR triggers */}
                  <div className="grid grid-cols-2 gap-2 bg-white dark:bg-stone-800/40 p-2.5 rounded-xl border border-gray-100 dark:border-stone-800">
                    <div>
                      <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest">
                        Model Number QR
                      </span>
                      <span className="text-[10px] font-mono font-extrabold text-blue-600 dark:text-blue-400 uppercase truncate block">
                        {selectedItem.modelNo}
                      </span>
                      <a
                        href={generateQRUrl(`INVSRV-MODEL:${selectedItem.modelNo}`)}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        className="inline-flex items-center gap-0.5 text-[8px] text-emerald-500 font-bold uppercase mt-1 hover:underline"
                      >
                        <QrCode className="w-2 h-2" /> Print Model QR
                      </a>
                    </div>

                    <div>
                      <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest">
                        Serial Number QR/Bar
                      </span>
                      <span className="text-[10px] font-mono font-extrabold text-blue-600 dark:text-blue-400 uppercase truncate block select-all">
                        {selectedItem.serialNo}
                      </span>
                      <a
                        href={generateQRUrl(`INVSRV-SERIAL:${selectedItem.serialNo}`)}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        className="inline-flex items-center gap-0.5 text-[8px] text-emerald-500 font-bold uppercase mt-1 hover:underline"
                      >
                        <QrCode className="w-2 h-2" /> Print S/N QR
                      </a>
                    </div>
                  </div>

                  {/* Problem & Condition Notes */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-stone-400 font-medium">
                    <div className="p-2.5 bg-white dark:bg-stone-800/50 rounded-xl border border-gray-100 dark:border-stone-800/80">
                      <span className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-0.5">
                        Physical Condition
                      </span>
                      {selectedItem.condition || "Slight dust layer"}
                    </div>
                    
                    <div className="p-2.5 bg-white dark:bg-stone-800/50 rounded-xl border border-gray-100 dark:border-stone-800/80">
                      <span className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-0.5">
                        Defects Reported
                      </span>
                      {selectedItem.problemDescription || "Needs testing check"}
                    </div>
                  </div>

                  {/* Gemini AI Troubleshooting Assistant */}
                  <div className="bg-indigo-500/5 dark:bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-3 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                        ✨ Gemini AI Diagnostic Lab
                      </span>
                      <button
                        onClick={handleRunAIDiagnosis}
                        disabled={isAnalyzingDI}
                        className="text-[9px] font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-450 px-2 py-1 rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        {isAnalyzingDI ? "Analyzing..." : "⚡ Diagnose Device"}
                      </button>
                    </div>

                    {isAnalyzingDI && (
                      <div className="space-y-2 py-2 text-center">
                        <div className="w-5 h-5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto"></div>
                        <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 animate-pulse">
                          Querying repair schemas, auditing component diagnostics...
                        </p>
                      </div>
                    )}

                    {aiDiagnosticData && (
                      <div className="space-y-3.5 text-left border-t border-indigo-500/10 pt-2.5 transition-all">
                        {/* Causes */}
                        <div>
                          <span className="block text-[8px] font-black text-rose-500 uppercase tracking-wider mb-1">
                            Likely Causes
                          </span>
                          <ul className="space-y-0.5">
                            {aiDiagnosticData.possibleCauses.map((cause, idx) => (
                              <li key={idx} className="text-[10px] text-gray-700 dark:text-stone-300 flex items-start gap-1">
                                <span className="text-rose-500">•</span>
                                <span>{cause}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Steps */}
                        <div>
                          <span className="block text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
                            Diagnostic Procedures
                          </span>
                          <ol className="space-y-1 list-decimal list-inside text-[10px] text-gray-700 dark:text-stone-300 leading-tight">
                            {aiDiagnosticData.diagnosticSteps.map((step, idx) => (
                              <li key={idx}>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {/* Parts & Time */}
                        <div className="grid grid-cols-2 gap-2 bg-white dark:bg-stone-800/40 p-2 rounded-xl border border-indigo-550/5">
                          <div>
                            <span className="block text-[8px] font-black text-gray-450 uppercase tracking-wider">
                              Est. Hours
                            </span>
                            <span className="text-[10px] font-black text-indigo-650 dark:text-indigo-400">
                              {aiDiagnosticData.estimatedHours}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[8px] font-black text-gray-450 uppercase tracking-wider">
                              Suggested Spares
                            </span>
                            <span className="text-[10px] font-black text-gray-700 dark:text-stone-300 truncate block">
                              {aiDiagnosticData.recommendedParts.join(", ")}
                            </span>
                          </div>
                        </div>

                        {/* Pro Tip */}
                        <div className="p-2.5 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                          <span className="block text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-0.5">
                            💡 Tech Pro-Tip
                          </span>
                          <p className="text-[10px] text-gray-650 dark:text-stone-300 italic">
                            "{aiDiagnosticData.proActiveTips}"
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Timeline Workflow update */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Change Status (Saves node log)
                    </label>

                    <div className="grid grid-cols-3 gap-1">
                      {["Received", "Under Inspection", "Repairing", "Waiting for Parts", "Completed", "Delivered"].map(st => {
                        const isCur = selectedItem.status === st;
                        return (
                          <button
                            key={st}
                            onClick={() => handleItemStatusChange(st as JobStatus)}
                            className={`text-[9px] font-bold py-1.5 rounded uppercase border transition-all active:scale-95 ${
                              isCur
                                ? "bg-slate-800 dark:bg-stone-200 text-white dark:text-stone-900 border-slate-800 dark:border-stone-200 font-extrabold shadow-xs"
                                : "bg-white dark:bg-stone-800 text-gray-500 dark:text-stone-400 border-gray-200 dark:border-stone-700 hover:bg-gray-50"
                            }`}
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Assignee / Technician update */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                      Assign Employee / Tech
                    </label>
                    <select
                      value={selectedItem.technicianId}
                      onChange={e => handleItemAssigneeChange(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-200 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {technicians.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Location tracking System */}
                  <div className="space-y-2 bg-white dark:bg-stone-800/40 p-3 rounded-2xl border border-gray-100 dark:border-stone-800">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Item Physical Rack Location
                      </label>
                      <button
                        onClick={() => setShowAddLocationModal(true)}
                        className="text-[9px] text-blue-500 font-bold uppercase flex items-center gap-0.5 hover:underline"
                      >
                        + Create Spot
                      </button>
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto py-1 no-scrollbar whitespace-nowrap">
                      {locations.map(loc => {
                        const isCurLoc = selectedItem.currentLocation === loc;
                        return (
                          <button
                            key={loc}
                            onClick={() => handleItemLocationChange(loc)}
                            className={`text-[9px] font-bold px-2.5 py-1.5 rounded uppercase border transition-all active:scale-95 shrink-0 ${
                              isCurLoc
                                ? "bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-600 shadow-xs"
                                : "bg-white dark:bg-stone-800 text-gray-500 dark:text-stone-400 border-gray-200 dark:border-stone-700"
                            }`}
                          >
                            📍 {loc}
                          </button>
                        );
                      })}
                    </div>

                    {/* QR code printing for active location sticker */}
                    <div className="pt-2 border-t border-gray-100 dark:border-stone-800/50 flex justify-between items-center">
                      <span className="text-[9px] font-medium text-gray-400">
                        Current spot: <strong className="text-gray-700 dark:text-stone-300">{selectedItem.currentLocation}</strong>
                      </span>
                      <a
                        href={generateQRUrl(`INVSRV-LOCATION:${selectedItem.currentLocation}`)}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        className="text-[9px] text-blue-500 font-bold uppercase flex items-center gap-0.5 hover:underline"
                      >
                        <QrCode className="w-2.5 h-2.5" /> Print Tag Qr
                      </a>
                    </div>
                  </div>

                  {/* Individual Item charges ledger adjustment */}
                  <div className="space-y-2 bg-white dark:bg-stone-800/40 p-3 rounded-2xl border border-gray-100 dark:border-stone-800">
                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest">
                      Cost Details Ledger (Item)
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[8px] text-gray-400 uppercase font-black">Fees</span>
                        <input
                          type="number"
                          value={selectedItem.serviceCharge}
                          onChange={e => handleUpdateItemCharges(Number(e.target.value), selectedItem.spareCharge, selectedItem.discount)}
                          className="w-full text-xs font-mono bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-300 border border-gray-200 dark:border-stone-700 rounded-lg px-2 py-1 focus:outline-none"
                        />
                      </div>

                      <div>
                        <span className="text-[8px] text-gray-400 uppercase font-black">Materials</span>
                        <input
                          type="number"
                          value={selectedItem.spareCharge}
                          onChange={e => handleUpdateItemCharges(selectedItem.serviceCharge, Number(e.target.value), selectedItem.discount)}
                          className="w-full text-xs font-mono bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-300 border border-gray-200 dark:border-stone-700 rounded-lg px-2 py-1 focus:outline-none"
                        />
                      </div>

                      <div>
                        <span className="text-[8px] text-gray-400 uppercase font-black">Discount</span>
                        <input
                          type="number"
                          value={selectedItem.discount}
                          onChange={e => handleUpdateItemCharges(selectedItem.serviceCharge, selectedItem.spareCharge, Number(e.target.value))}
                          className="w-full text-xs font-mono bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-300 border border-gray-200 dark:border-stone-700 rounded-lg px-2 py-1 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 dark:border-stone-800 flex justify-between items-center text-xs font-bold text-gray-800 dark:text-stone-200">
                      <span>Total Net Charge:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(selectedItem.total)}
                      </span>
                    </div>
                  </div>

                  {/* Material Replacements module triggers */}
                  <div className="space-y-3 bg-white dark:bg-stone-800/40 p-3 rounded-2xl border border-gray-100 dark:border-stone-800">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest uppercase">
                        Replacing Parts and spares
                      </label>
                      <button
                        onClick={() => setShowReplacementModal(true)}
                        className="text-[9px] bg-blue-500 hover:bg-blue-600 text-white font-black px-2.5 py-1 rounded"
                      >
                        + Log Spare
                      </button>
                    </div>

                    {selectedItem.replacements.length === 0 ? (
                      <p className="text-[10px] text-gray-400 italic">
                        No materials or electronic parts swapped inside this product card yet.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-[110px] overflow-y-auto">
                        {selectedItem.replacements.map((rep, idx) => (
                          <div
                            key={idx}
                            className="p-2 border border-blue-500/10 bg-slate-50 dark:bg-stone-900 rounded-xl text-left text-[11px] text-gray-700 dark:text-stone-300"
                          >
                            <div className="flex justify-between items-start font-bold">
                              <span>{rep.partName}</span>
                              <span className="text-[9px] font-mono text-gray-400">
                                {formatDateTime(rep.timestamp)}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-gray-500 mt-0.5 space-y-0.5">
                              <div>• Old S/N: {rep.oldSerial} &rarr; New S/N: {rep.newSerial}</div>
                              <div>• Reason: {rep.reason}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Burnt Problem & Unit Replacement Dashboard Section */}
                  <div className="space-y-3 p-3 bg-rose-500/5 dark:bg-stone-800/40 rounded-2xl border border-rose-500/10 dark:border-stone-800">
                    <div className="flex justify-between items-center pb-1 border-b border-gray-150 dark:border-stone-800">
                      <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1">
                        🔥 Burnt / Surge Damage & Unit Replacement
                      </span>
                    </div>

                    {/* BURNT PROBLEM SETTINGS */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">
                          Surge Burn Status
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleBurntState(true, editBurntDetails || "Blown components")}
                            className={`text-[9px] font-bold px-2 py-1 rounded transition-all cursor-pointer ${
                              selectedItem.isBurnt
                                ? "bg-red-600 text-white font-extrabold shadow-xs animate-pulse"
                                : "bg-slate-100 dark:bg-stone-800 text-gray-500 hover:bg-rose-50 dark:hover:bg-red-950/20"
                            }`}
                          >
                            🔥 Yes, Burnt
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditBurntDetails("");
                              handleToggleBurntState(false, "");
                            }}
                            className={`text-[9px] font-bold px-2 py-1 rounded transition-all cursor-pointer ${
                              !selectedItem.isBurnt
                                ? "bg-slate-700 dark:bg-stone-200 text-white dark:text-stone-900 font-extrabold"
                                : "bg-slate-100 dark:bg-stone-800 text-gray-500 hover:bg-slate-200 dark:hover:bg-stone-700"
                            }`}
                          >
                            No Burn
                          </button>
                        </div>
                      </div>

                      {selectedItem.isBurnt && (
                        <div className="pt-1.5 space-y-1.5 bg-rose-500/10 dark:bg-rose-950/10 p-2.5 rounded-xl border border-rose-500/15 animate-fade-in">
                          <div>
                            <span className="block text-[8px] font-black text-rose-500 dark:text-red-400 uppercase tracking-wider mb-1">
                              Repair Ledger burnt description:
                            </span>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                placeholder="Describe burnt tracks / blew IC chips..."
                                value={editBurntDetails}
                                onChange={e => setEditBurntDetails(e.target.value)}
                                className="flex-1 text-xs bg-white dark:bg-stone-805 text-gray-800 dark:text-stone-100 border border-rose-200 dark:border-stone-700 rounded-lg px-2.5 py-1 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleToggleBurntState(true, editBurntDetails)}
                                className="bg-red-650 hover:bg-red-700 text-white font-bold text-[10px] px-2.5 rounded-lg shrink-0 transition"
                              >
                                Save Note
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* WHOLE PRODUCT SWAP / REPLACEMENT */}
                    <div className="pt-2.5 border-t border-dashed border-gray-150 dark:border-stone-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">
                          Whole-Device Swap
                        </span>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                          selectedItem.isProductReplaced
                            ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200"
                            : "bg-slate-100 dark:bg-stone-800 text-gray-400"
                        }`}>
                          {selectedItem.isProductReplaced ? "Unit Replaced" : "No Replacement"}
                        </span>
                      </div>

                      {selectedItem.isProductReplaced ? (
                        <div className="p-2.5 bg-indigo-500/5 dark:bg-indigo-900/10 border border-indigo-500/10 rounded-xl space-y-1 text-xs">
                          <p className="font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                            <span>🔄 Replacement Unit Issued</span>
                            <span className="text-[9px] font-mono text-gray-400 font-normal">
                              ({selectedItem.replacementDate})
                            </span>
                          </p>
                          <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-gray-550 dark:text-stone-400">
                            <div>• New Model: <span className="font-bold text-gray-800 dark:text-stone-200">{selectedItem.replacementModelNo}</span></div>
                            <div>• New S/N: <span className="font-bold text-gray-800 dark:text-stone-200">{selectedItem.replacementSerialNo}</span></div>
                          </div>
                          {selectedItem.replacementReason && (
                            <p className="text-[10px] text-gray-500 mt-1">
                              <strong>Reason:</strong> {selectedItem.replacementReason}
                            </p>
                          )}
                          <div className="pt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                handleProductReplacementUpdate(false, "", "", "");
                                setShowActiveReplForm(false);
                              }}
                              className="text-[9px] text-red-500 hover:text-red-650 font-bold bg-white dark:bg-stone-800 hover:bg-rose-50 dark:hover:bg-rose-950/15 border border-red-200 dark:border-stone-700 px-2 py-1 rounded transition-all cursor-pointer"
                            >
                              Revert Unit Swap
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {!showActiveReplForm ? (
                            <button
                              type="button"
                              onClick={() => setShowActiveReplForm(true)}
                              className="w-full text-left py-1.5 px-2.5 text-[9px] bg-indigo-50 hover:bg-indigo-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-indigo-650 dark:text-indigo-400 font-bold rounded-lg border border-indigo-100 dark:border-stone-700 flex justify-between items-center transition"
                            >
                              <span>+ Swap with New/Warranty Replacement Device Unit</span>
                              <span>&rarr;</span>
                            </button>
                          ) : (
                            <div className="p-3 bg-indigo-500/5 dark:bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 tracking-wider uppercase animate-pulse">
                                  Issue Replacement Unit Form (Product Swap)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowActiveReplForm(false)}
                                  className="text-[9px] text-gray-400 hover:text-gray-600 hover:underline cursor-pointer font-bold"
                                >
                                  Cancel
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[8px] text-gray-400 dark:text-stone-400 font-bold uppercase mb-0.5 flex justify-between">
                                    <span>New Model No</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setScannerTargetForm("actNewModel");
                                        setShowScannerModal(true);
                                      }}
                                      className="text-[8px] text-blue-500 font-bold uppercase flex items-center gap-0.5 transition hover:underline"
                                    >
                                      <Barcode className="w-2 h-2" /> Scan
                                    </button>
                                  </label>
                                  <input
                                    type="text"
                                    value={actNewModel}
                                    onChange={e => setActNewModel(e.target.value)}
                                    className="w-full text-xs font-mono bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-250 dark:border-stone-700 rounded px-1.5 py-1"
                                    placeholder="Matching model..."
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-gray-400 dark:text-stone-400 font-bold uppercase mb-0.5 flex justify-between">
                                    <span>New Serial No *</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setScannerTargetForm("actNewSerial");
                                        setShowScannerModal(true);
                                      }}
                                      className="text-[8px] text-blue-500 font-bold uppercase flex items-center gap-0.5 transition hover:underline"
                                    >
                                      <Barcode className="w-2 h-2" /> Scan
                                    </button>
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={actNewSerial}
                                    onChange={e => setActNewSerial(e.target.value)}
                                    className="w-full text-xs font-mono bg-white dark:bg-stone-800 text-gray-805 dark:text-stone-100 border border-gray-250 dark:border-stone-700 rounded px-1.5 py-1"
                                    placeholder="Required barcode/SN..."
                                  />
                                </div>
                              </div>

                              <div>
                                  <label className="block text-[8px] text-gray-400 dark:text-stone-400 font-bold uppercase mb-0.5">
                                  Replacement Swap Reason / Notes
                                </label>
                                <input
                                  type="text"
                                  value={actReason}
                                  onChange={e => setActReason(e.target.value)}
                                  className="w-full text-xs bg-white dark:bg-stone-800 text-gray-805 dark:text-stone-100 border border-gray-250 dark:border-stone-700 rounded px-1.5 py-1"
                                  placeholder="Burnt on-board components, issued new unit..."
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (!actNewSerial.trim()) {
                                    showToast("New matching Serial Number is required.", "error");
                                    return;
                                  }
                                  handleProductReplacementUpdate(
                                    true,
                                    actNewModel,
                                    actNewSerial,
                                    actReason || "Warranty issued swap unit"
                                  );
                                }}
                                className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-[11px] py-1.5 rounded transition cursor-pointer shadow-xs active:scale-98"
                              >
                                Save & Register Whole Unit Swapped
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Work Timeline Logs History and Audit Rails */}
                  <div className="space-y-2.5">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Workflow Timeline Log Auditting
                    </label>

                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                      {selectedItem.statusHistory.slice().reverse().map((hist, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 text-[11px] text-gray-600 dark:text-stone-400"
                        >
                          <span className="text-gray-300 dark:text-stone-700 font-bold">•</span>
                          <div className="flex-1">
                            <span className="font-extrabold text-gray-700 dark:text-stone-300 capitalize">
                              {hist.status}
                            </span>
                            <p className="text-[9px] text-gray-400 flex justify-between mt-0.5">
                              <span>By: {hist.changedBy}</span>
                              <span>{formatDateTime(hist.timestamp)}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-8 text-center bg-gray-50 dark:bg-stone-800 rounded-2xl border border-dashed border-gray-200 dark:border-stone-800">
                  <BadgeAlert className="w-8 h-8 text-gray-300 dark:text-stone-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-600 dark:text-stone-400">
                    Select a device camera from the grid or compile list above to trigger inspection states.
                  </p>
                </div>
              )}

              {/* Master Billing / overall Ticket settlement */}
              <div className="p-4 bg-slate-50 dark:bg-stone-800/40 rounded-2xl border border-gray-150 dark:border-stone-800/80 space-y-3">
                <label className="block text-xs font-bold text-gray-800 dark:text-stone-200 uppercase tracking-wider">
                  Overall Job Invoice Ledger (All Devices)
                </label>

                <div className="grid grid-cols-2 gap-3 select-none">
                  <div>
                    <span className="block text-[9px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1">
                      Billing Status
                    </span>
                    <select
                      value={selectedJob.paymentStatus}
                      onChange={e => handleJobBillingUpdate(e.target.value as PaymentStatus, selectedJob.paymentMethod, selectedJob.paidAmount)}
                      className="w-full text-xs font-bold bg-white dark:bg-stone-900 border border-gray-200 dark:border-stone-700 text-gray-800 dark:text-stone-200 rounded-lg py-2 px-1 focus:outline-none"
                    >
                      <option value="Unpaid">Unpaid</option>
                      <option value="Partial">Partial</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>

                  <div>
                    <span className="block text-[9px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1">
                      Payment Channels
                    </span>
                    <select
                      value={selectedJob.paymentMethod}
                      onChange={e => handleJobBillingUpdate(selectedJob.paymentStatus, e.target.value as PaymentMethod, selectedJob.paidAmount)}
                      className="w-full text-xs font-bold bg-white dark:bg-stone-900 border border-gray-200 dark:border-stone-700 text-gray-800 dark:text-stone-200 rounded-lg py-2 px-1 focus:outline-none"
                    >
                      {(paymentMethods.length > 0 ? paymentMethods : ["UPI", "Card", "Bank Transfer", "Online"]).map(method => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <span className="block text-[9px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1">
                    Amount Received / Collected *
                  </span>
                  <input
                    type="number"
                    value={selectedJob.paidAmount}
                    onChange={e => handleJobBillingUpdate(selectedJob.paymentStatus, selectedJob.paymentMethod, Number(e.target.value))}
                    className="w-full text-xs font-mono bg-white dark:bg-stone-900 border border-gray-200 dark:border-stone-700 rounded-lg px-3 py-2 text-gray-800 dark:text-stone-100 focus:outline-none shadow-xs"
                  />
                </div>

                {/* Sub totals */}
                <div className="border-t border-dashed border-gray-200 dark:border-stone-800 pt-3 flex flex-col space-y-1 text-xs select-none">
                  <div className="flex justify-between text-gray-500">
                    <span>Compiled Cost:</span>
                    <span>{formatCurrency(selectedJob.grandTotal)}</span>
                  </div>

                  <div className="flex justify-between text-gray-500">
                    <span>Collected:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      -{formatCurrency(selectedJob.paidAmount)}
                    </span>
                  </div>

                  <div className="flex justify-between font-extrabold text-gray-800 dark:text-stone-100 text-sm border-t border-gray-100 dark:border-stone-800 pt-1.5 pb-2">
                    <span>Remaining Settlement balance:</span>
                    <span className="text-rose-600 dark:text-rose-400">
                      {formatCurrency(Math.max(0, selectedJob.grandTotal - selectedJob.paidAmount))}
                    </span>
                  </div>

                  {merchantDetails && (selectedJob.paymentMethod === "UPI" || selectedJob.paymentMethod === "Bank Transfer" || selectedJob.paymentMethod === "Online" || selectedJob.paymentMethod?.includes("UPI") || selectedJob.paymentMethod?.includes("Bank")) && (
                    <div className="mt-3 p-3 bg-indigo-50/70 dark:bg-stone-900 border border-indigo-100 dark:border-stone-800 rounded-xl space-y-2 text-left">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-[10px] uppercase font-black tracking-wider text-indigo-700 dark:text-indigo-400">
                          Direct Store Settlement Accounts
                        </span>
                      </div>
                      
                      {merchantDetails.merchantName && (
                        <div className="text-[10px] text-gray-500 dark:text-stone-400 font-medium leading-none">
                          Merchant: <span className="font-extrabold text-gray-800 dark:text-stone-200">{merchantDetails.merchantName}</span>
                        </div>
                      )}

                      {merchantDetails.merchantUpi && (
                        <div className="flex justify-between items-center bg-white dark:bg-black/40 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-stone-800 font-mono text-[10px]">
                          <span className="text-gray-700 dark:text-stone-300">Account / Link ID: <span className="font-black text-indigo-600 dark:text-indigo-400">{merchantDetails.merchantUpi}</span></span>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                navigator.clipboard.writeText(merchantDetails.merchantUpi);
                                showToast("Registered account handle details copied successfully! 📋", "success");
                              } catch (_) {
                                showToast(`ID: ${merchantDetails.merchantUpi}`, "info");
                              }
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 dark:bg-stone-850 dark:hover:bg-stone-800 text-indigo-600 dark:text-indigo-400 text-[8px] tracking-wider uppercase font-black px-2 py-1 rounded cursor-pointer border-none"
                          >
                            Copy ID
                          </button>
                        </div>
                      )}

                      {merchantDetails.merchantAccountNo && (
                        <div className="bg-white dark:bg-black/40 p-2 rounded-lg border border-gray-200 dark:border-stone-800 font-mono text-[9.5px] space-y-1">
                          <div className="text-gray-500 dark:text-stone-400 text-[8px] uppercase tracking-wider font-bold">Bank Transfer Option</div>
                          <div className="text-gray-700 dark:text-stone-300">Bank Name: <span className="font-bold text-gray-900 dark:text-stone-100">{merchantDetails.merchantBankName || "Registered Bank"}</span></div>
                          <div className="text-gray-700 dark:text-stone-300 flex justify-between items-center">
                            <span>A/C No: <span className="font-bold text-gray-900 dark:text-stone-100">{merchantDetails.merchantAccountNo}</span></span>
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  navigator.clipboard.writeText(merchantDetails.merchantAccountNo);
                                  showToast("Bank Account Number copied! 📋", "success");
                                } catch (_) {
                                  showToast(`A/C: ${merchantDetails.merchantAccountNo}`, "info");
                                }
                              }}
                              className="text-[8px] font-black uppercase text-indigo-600 dark:text-indigo-400 cursor-pointer border-none bg-transparent hover:underline"
                            >
                              Copy
                            </button>
                          </div>
                          {merchantDetails.merchantIfsc && (
                            <div className="text-gray-700 dark:text-stone-300">Transit / SWIFT Code: <span className="font-bold text-gray-900 dark:text-stone-100">{merchantDetails.merchantIfsc}</span></div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Sheet Modal: Create New Job (Multi item support) */}
      {showAddJobModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-3xl border-t border-slate-200/50 dark:border-stone-800 max-h-[85vh] overflow-y-auto flex flex-col animate-slide-up select-none">
            
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900 z-10">
              <div className="flex items-center gap-1.5">
                <PlusCircle className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-black text-gray-800 dark:text-stone-100">
                  Compile Multi-Device Job Card
                </h3>
              </div>
              <button
                onClick={() => setShowAddJobModal(false)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-stone-800 text-gray-500 dark:text-stone-400 active:scale-90 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleMasterJobSubmit} className="p-5 space-y-4">
              
              {/* Customer Searchable Selector and Registration inline */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Reference Client Contact *
                </label>

                {selectedCustId ? (
                  /* Display Selected Client details */
                  <div className="p-3 bg-emerald-50 dark:bg-stone-800/80 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[8px] font-mono font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                          {selectedCustId}
                        </span>
                        <p className="text-xs font-black text-gray-800 dark:text-stone-100 mt-1.5">
                          {customers.find(c => c.id === selectedCustId)?.name}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-stone-400 font-semibold font-mono mt-0.5">
                          Phone: {customers.find(c => c.id === selectedCustId)?.phone}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCustId("")}
                        className="p-1.5 rounded-full bg-slate-100 hover:bg-rose-500/10 hover:text-rose-600 dark:bg-stone-700 dark:hover:bg-rose-500/20 text-gray-400 transition-all cursor-pointer"
                        title="Clear and Search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Search client or add client panel */
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search clients by name, phone..."
                          value={clientSearchQuery}
                          onChange={e => {
                            setClientSearchQuery(e.target.value);
                            setShowInlineAddCustomer(false); // contract add-form if searching
                          }}
                          className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-805 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl pl-8 pr-9 py-2.5 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setScannedTextInput("");
                            setScannerTargetForm("clientSearch");
                            setShowScannerModal(true);
                          }}
                          className="absolute right-2.5 top-2.5 p-0.5 text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                          title="Scan Barcode / QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {!showInlineAddCustomer && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowInlineAddCustomer(true);
                            setClientSearchQuery("");
                          }}
                          className="bg-emerald-55 text-emerald-800 hover:bg-emerald-100 dark:bg-stone-800 dark:text-emerald-400 font-bold px-3 py-2.5 rounded-xl text-xs border border-emerald-100 dark:border-stone-700 transition"
                        >
                          + Register
                        </button>
                      )}
                    </div>

                    {/* Show search result matches autocomplete listing */}
                    {clientSearchQuery.trim() && (
                      <div className="max-h-[140px] overflow-y-auto border border-gray-100 dark:border-stone-800 rounded-xl bg-white dark:bg-stone-900 divide-y divide-gray-100 dark:divide-stone-800/50 shadow-sm">
                        {filteredSearchCustomers.length === 0 ? (
                          <div className="p-3 text-center text-xs text-gray-400">
                            No clients match. Click '+ Register' to create.
                          </div>
                        ) : (
                          filteredSearchCustomers.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustId(c.id);
                                setClientSearchQuery("");
                              }}
                              className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-stone-800/80 transition text-xs flex justify-between items-center"
                            >
                              <div>
                                <p className="font-bold text-gray-800 dark:text-stone-200">{c.name}</p>
                                <p className="text-[10px] text-gray-500 font-mono mt-0.5">{c.phone}</p>
                              </div>
                              <span className="text-[9px] font-mono text-gray-400 dark:text-stone-400 bg-slate-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">
                                {c.id}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {/* Standard selector dropdown fallback layout for convenience */}
                    {!clientSearchQuery.trim() && !showInlineAddCustomer && (
                      <select
                        value={selectedCustId}
                        onChange={e => setSelectedCustId(e.target.value)}
                        className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">-- Or Select from Customer Roster --</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone})
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Inline Registration Form (collapsible element) */}
                    {showInlineAddCustomer && (
                      <div className="p-3.5 bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-3 animate-slide-up">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                            Register Customer Inline
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowInlineAddCustomer(false)}
                            className="text-xs text-gray-400 hover:text-gray-600 hover:underline cursor-pointer font-bold"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[8px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1.5">
                              Full Name *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Ramesh Hegde"
                              value={inlineCustName}
                              onChange={e => setInlineCustName(e.target.value)}
                              className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-lg px-2.5 py-2 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[8px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1.5">
                              Phone/Contact *
                            </label>
                            <input
                              type="tel"
                              required
                              placeholder="e.g. +91 908..."
                              value={inlineCustPhone}
                              onChange={e => setInlineCustPhone(e.target.value)}
                              className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-lg px-2.5 py-2 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[8px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1.5">
                            Site Address
                          </label>
                          <input
                            type="text"
                            placeholder="Site/office address location details..."
                            value={inlineCustAddress}
                            onChange={e => setInlineCustAddress(e.target.value)}
                            className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-lg px-2.5 py-2 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[8px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1.5">
                            CRM Ledger Notes
                          </label>
                          <input
                            type="text"
                            placeholder="Any special terms/notes..."
                            value={inlineCustNotes}
                            onChange={e => setInlineCustNotes(e.target.value)}
                            className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-lg px-2.5 py-2 focus:outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleInlineCustomerSubmit}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2 rounded-lg cursor-pointer transition active:scale-98 shadow-sm flex items-center justify-center gap-1"
                        >
                          <span>Confirm and Select Client</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Toggle overall WhatsApp triggers */}
              <div className="flex justify-between items-center bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                  Trigger WhatsApp Status Msg
                </span>
                <input
                  type="checkbox"
                  checked={waEnabled}
                  onChange={e => setWaEnabled(e.target.checked)}
                  className="rounded text-emerald-500"
                />
              </div>

              {/* Already Added items compiled draft */}
              {newJobItems.length > 0 && (
                <div className="space-y-2">
                  <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Compiled Devices draft ({newJobItems.length})
                  </span>

                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                    {newJobItems.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-stone-800 rounded-xl border border-gray-200/50"
                      >
                        <div>
                          <div className="text-xs font-bold text-gray-800 dark:text-stone-200">
                            {idx + 1}. {it.productName}
                          </div>
                          <div className="text-[9px] text-gray-400 mt-0.5 uppercase font-mono">
                            Mod: {it.modelNo} | S/N: {it.serialNo}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDraftItem(idx)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Item fields sub-form */}
              <div className="p-3.5 bg-slate-50 dark:bg-stone-800/60 rounded-2xl border border-gray-150 dark:border-stone-800/80 space-y-3.5">
                <span className="block text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200/50 pb-1.5">
                  📥 Insert Device Specs
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wide">
                      Device Prod.Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CP Plus Dome Camera"
                      value={tempProdName}
                      onChange={e => setTempProdName(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-lg px-2 py-1.5 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wide">
                      Brand / Manufacturer
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CP Plus"
                      value={tempBrand}
                      onChange={e => setTempBrand(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-lg px-2 py-1.5 focus:outline-none"
                    />
                  </div>
                </div>



                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wide flex justify-between">
                      <span>Model No</span>
                      <button
                        type="button"
                        onClick={() => {
                          setScannerTargetForm("model");
                          setShowScannerModal(true);
                        }}
                        className="text-[9px] text-blue-500 font-bold uppercase flex items-center gap-0.5"
                      >
                        <Barcode className="w-2.5 h-2.5" /> Scan
                      </button>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DS-2CD"
                      value={tempModelNo}
                      onChange={e => setTempModelNo(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-lg px-2 py-1.5 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wide flex justify-between">
                      <span>Serial No</span>
                      <button
                        type="button"
                        onClick={() => {
                          setScannerTargetForm("serial");
                          setShowScannerModal(true);
                        }}
                        className="text-[9px] text-blue-500 font-bold uppercase flex items-center gap-0.5"
                      >
                        <Barcode className="w-2.5 h-2.5" /> Scan
                      </button>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HK99381..."
                      value={tempSerialNo}
                      onChange={e => setTempSerialNo(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-lg px-2 py-1.5 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wide">
                      Physical Condition Description
                    </label>
                    <input
                      type="text"
                      placeholder="Lens dirty"
                      value={tempCondition}
                      onChange={e => setTempCondition(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-250 dark:border-stone-700 rounded-lg px-2 py-1.5 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wide">
                      Problem reported
                    </label>
                    <input
                      type="text"
                      placeholder="No power output"
                      value={tempProblem}
                      onChange={e => setTempProblem(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-250 dark:border-stone-700 rounded-lg px-2 py-1.5 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Burnt Problem Indicators */}
                <div className="bg-red-500/5 dark:bg-red-500/10 p-2.5 rounded-xl border border-red-500/10 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={tempIsBurnt}
                      onChange={e => setTempIsBurnt(e.target.checked)}
                      className="rounded text-rose-500 bg-white dark:bg-stone-800 scale-100"
                    />
                    <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
                      🔥 Burnt Problem / Power Surge Damage
                    </span>
                  </label>

                  {tempIsBurnt && (
                    <div>
                      <label className="block text-[8px] font-bold text-rose-500 uppercase tracking-wide mb-1">
                        Burnt damage description / repair feasibility
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Blown PCB tracks near power IC. Needs manual jumper wire or component swap."
                        value={tempBurntDetails}
                        onChange={e => setTempBurntDetails(e.target.value)}
                        className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-red-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-500"
                      />
                    </div>
                  )}
                </div>

                {/* Whole-device product replacement / swap drafting */}
                <div className="bg-indigo-500/5 dark:bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/10 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={tempIsProductReplaced}
                      onChange={e => setTempIsProductReplaced(e.target.checked)}
                      className="rounded text-indigo-500 bg-white dark:bg-stone-800 scale-100"
                    />
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                      🔄 Product Swapped / Replaced Inline
                    </span>
                  </label>

                  {tempIsProductReplaced && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-bold text-indigo-500 uppercase tracking-wide mb-0.5 flex justify-between">
                            <span>New Model No</span>
                            <button
                              type="button"
                              onClick={() => {
                                setScannerTargetForm("draftRepModel");
                                setShowScannerModal(true);
                              }}
                              className="text-[8px] text-blue-500 font-bold uppercase flex items-center gap-0.5"
                            >
                              <Barcode className="w-2 h-2" /> Scan
                            </button>
                          </label>
                          <input
                            type="text"
                            placeholder="Same or newer model"
                            value={tempReplacementModelNo}
                            onChange={e => setTempReplacementModelNo(e.target.value)}
                            className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-indigo-200 dark:border-stone-700 rounded-lg px-2 py-1.5 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-bold text-indigo-500 uppercase tracking-wide mb-0.5 flex justify-between">
                            <span>New Serial SN *</span>
                            <button
                              type="button"
                              onClick={() => {
                                setScannerTargetForm("draftRepSerial");
                                setShowScannerModal(true);
                              }}
                              className="text-[8px] text-blue-500 font-bold uppercase flex items-center gap-0.5"
                            >
                              <Barcode className="w-2 h-2" /> Scan
                            </button>
                          </label>
                          <input
                            type="text"
                            placeholder="Scanned new barcode SN"
                            value={tempReplacementSerialNo}
                            onChange={e => setTempReplacementSerialNo(e.target.value)}
                            className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-indigo-200 dark:border-stone-700 rounded-lg px-2 py-1.5 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[8px] font-bold text-indigo-500 uppercase tracking-wide mb-0.5">
                          Replacement reason / warranty notes
                        </label>
                        <input
                          type="text"
                          placeholder="Irreparable burnt chip, swap done under warranty terms"
                          value={tempReplacementReason}
                          onChange={e => setTempReplacementReason(e.target.value)}
                          className="w-full text-xs bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-indigo-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Initial costs matrix and spot */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[8px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-wide">
                      Service Fee
                    </label>
                    <input
                      type="number"
                      value={tempServiceCharge}
                      onChange={e => setTempServiceCharge(Number(e.target.value))}
                      className="w-full text-xs bg-white dark:bg-stone-800 border border-gray-200 dark:border-stone-700 text-gray-800 dark:text-stone-100 rounded-lg px-2.5 py-1.5 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[8px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-wide">
                      Assign Staff
                    </label>
                    <select
                      value={tempTechId}
                      onChange={e => setTempTechId(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-stone-800 border border-gray-200 dark:border-stone-700 text-gray-800 dark:text-stone-100 rounded-lg px-2 py-1.5 focus:outline-none"
                    >
                      <option value="">Vijay (default)</option>
                      {technicians.map(t => (
                        <option key={t.id} value={t.id}>{t.name.split(" ")[0]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[8px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-wide">
                      Spot Spot
                    </label>
                    <select
                      value={tempLocation}
                      onChange={e => setTempLocation(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-stone-800 border border-gray-200 dark:border-stone-700 text-gray-800 dark:text-stone-100 rounded-lg px-2 py-1.5 focus:outline-none"
                    >
                      {locations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddNewItemToJobDraft}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10px] py-2 rounded-lg transition-all active:scale-95 text-center flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Draft and Add device to card list</span>
                </button>
              </div>

              {/* Master Actions footer */}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-750 text-white font-black text-xs py-3.5 rounded-xl text-center select-none shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!selectedCustId || newJobItems.length === 0}
                id="btn-confirm-master-job"
              >
                Compile and Create Ticket ({newJobItems.length} Devices)
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sub-Modal Sheet: Add custom Location Spot */}
      {showAddLocationModal && (
        <div className="fixed inset-0 z-55 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-gray-100 dark:border-stone-800 select-none animate-slide-up">
            <div className="p-4 border-b border-gray-100 dark:border-stone-800 flex justify-between items-center">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-stone-200">
                Create new Spot Node
              </h4>
              <button
                onClick={() => setShowAddLocationModal(false)}
                className="p-1.5 rounded-full text-gray-400 hover:bg-slate-50 dark:hover:bg-stone-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewCustomLocation} className="p-4 space-y-3">
              <input
                type="text"
                required
                placeholder="e.g. Cabinet Row D, Table 3"
                value={newCustomLocText}
                onChange={e => setNewCustomLocText(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-stone-800 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="w-full bg-emerald-600 text-white font-bold text-xs py-2.5 rounded-xl hover:bg-emerald-700 transition-all cursor-pointer"
              >
                Save Spot
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Spares / Parts replacement Audit Modal */}
      {showReplacementModal && (
        <div className="fixed inset-0 z-55 bg-black/60 backdrop-blur-xs flex items-end justify-center select-none">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-3xl border-t border-slate-200/50 dark:border-stone-800 max-h-[85vh] overflow-y-auto flex flex-col animate-slide-up">
            
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900 z-10">
              <div className="flex items-center gap-1.5">
                <Wrench className="w-5 h-5 text-blue-500 animate-spin" />
                <h3 className="text-sm font-black text-gray-800 dark:text-stone-100 uppercase">
                  Log Replacement Part
                </h3>
              </div>
              <button
                onClick={() => setShowReplacementModal(false)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-250 dark:bg-stone-800 text-gray-500 active:scale-90 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReplacementSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Part Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CMOS Controller IC, 2TB Hard Disk"
                  value={repPartName}
                  onChange={e => setRepPartName(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Old Serial (N/A if None)
                  </label>
                  <input
                    type="text"
                    placeholder="Worn out S/N"
                    value={repOldSerial}
                    onChange={e => setRepOldSerial(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-stone-800 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex justify-between">
                    <span>New Serial *</span>
                    <button
                      type="button"
                      onClick={() => {
                        setScannerTargetForm("repNewSerial");
                        setShowScannerModal(true);
                      }}
                      className="text-[9px] text-blue-500 font-bold uppercase flex items-center gap-0.5"
                    >
                      Scan
                    </button>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Laser scan bar/S/N"
                    value={repNewSerial}
                    onChange={e => setRepNewSerial(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-stone-800 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Old Model No
                  </label>
                  <input
                    type="text"
                    placeholder="Old chip spec"
                    value={repOldModel}
                    onChange={e => setRepOldModel(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-stone-800 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex justify-between">
                    <span>New Model No</span>
                    <button
                      type="button"
                      onClick={() => {
                        setScannerTargetForm("repNewModel");
                        setShowScannerModal(true);
                      }}
                      className="text-[9px] text-blue-500 font-bold uppercase flex items-center gap-0.5"
                    >
                      Scan
                    </button>
                  </label>
                  <input
                    type="text"
                    placeholder="New spot spec"
                    value={repNewModel}
                    onChange={e => setRepNewModel(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-stone-800 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Reason for parts replacement
                </label>
                <textarea
                  placeholder="e.g. Burned resistor channels, tracking bad storage sectors..."
                  rows={2}
                  value={repReason}
                  onChange={e => setRepReason(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none"
                />
              </div>

              {/* Toggle to update master job card serials automatically */}
              <div className="flex justify-between items-center bg-blue-500/5 p-3 rounded-xl border border-blue-500/10">
                <div>
                  <span className="block text-xs font-bold text-blue-900 dark:text-blue-400">
                    Auto update JobCard specs
                  </span>
                  <span className="text-[9px] text-gray-400">
                    Overwrites the primary serial with this new one
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={repUpdateCardDetails}
                  onChange={e => setRepUpdateCardDetails(e.target.checked)}
                  className="rounded text-blue-500 scale-105"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-750 text-white font-black text-xs py-3.5 rounded-xl shadow-md cursor-pointer"
              >
                Log Material Replacement
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Live camera QRScannerModal sheet overlay */}
      <QRScannerModal
        isOpen={showScannerModal}
        onClose={() => {
          setShowScannerModal(false);
          setScannerTargetForm(null);
        }}
        onScanSuccess={handleTriggerRealScan}
        title={`Scanning: ${scannerTargetForm ? scannerTargetForm.toUpperCase() : "Code"}`}
        placeholder="Or type manual code/ID..."
      />

      {/* AI Draft Copy message modal popup */}
      {showDraftModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl relative space-y-3.5">
            <button
              onClick={() => {
                setShowDraftModal(false);
                setDraftedMsg(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-stone-700 dark:hover:text-stone-250 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="p-1 px-2.5 rounded-full bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 text-[8px] font-black uppercase tracking-widest">
                Gemini AI Messaging Desk
              </span>
              <h3 className="text-sm font-black text-gray-900 dark:text-white mt-1.5 uppercase">
                Customer Update Draft
              </h3>
            </div>

            {isDraftingMsg ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-5 h-5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto"></div>
                <p className="text-[10px] font-bold text-indigo-605 dark:text-indigo-400 animate-pulse">
                  Drafting customized status notifications with elegant tone guidelines...
                </p>
              </div>
            ) : draftedMsg ? (
              <div className="space-y-3 text-left">
                <textarea
                  readOnly
                  rows={8}
                  value={draftedMsg}
                  className="w-full text-xs font-mono p-3 bg-stone-50 dark:bg-stone-950 border border-stone-250 dark:border-stone-800/80 rounded-2xl text-gray-805 dark:text-stone-200 focus:outline-none"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(draftedMsg);
                      showToast("Draft copied to clipboard!", "success");
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] py-2.5 rounded-xl transition-all cursor-pointer shadow-xs uppercase tracking-wider"
                  >
                    Copy Text Spares
                  </button>
                  <button
                    onClick={() => {
                      const cust = customers.find(c => c.id === selectedJob?.customerId);
                      if (cust) {
                        window.open(getWhatsAppClickUrl(cust.phone, draftedMsg), "_blank");
                        showToast("Opened WhatsApp Link!", "success");
                      }
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-2.5 rounded-xl transition-all cursor-pointer shadow-xs uppercase tracking-wider"
                  >
                    Send Spares
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-500">Failed to auto-draft text details.</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
