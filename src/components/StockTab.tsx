import React, { useState, useMemo } from "react";
import QRScannerModal from "./QRScannerModal";
import { InventoryItem, SubscriptionDetail, PLAN_LIMITS } from "../types";
import {
  Search,
  Plus,
  Package,
  QrCode,
  Barcode,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  ClipboardList,
  Filter,
  X,
  FileCheck,
  Share2,
  Download,
  Calendar,
  FileSpreadsheet,
  CheckSquare,
  Sliders,
  AlertOctagon,
  History
} from "lucide-react";
import { formatDateTime, generateQRUrl } from "../utils/helpers";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

interface StockTabProps {
  inventory: InventoryItem[];
  currentUser: any;
  subscription?: SubscriptionDetail;
  onAddInventoryItem: (item: Omit<InventoryItem, "id" | "history" | "createdAt">) => void;
  onUpdateInventoryItem: (item: InventoryItem) => void;
  locations?: string[];
  onAddCustomLocation?: (loc: string) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
  triggeredModal?: string | null;
  setTriggeredModal?: (val: string | null) => void;
}

export default function StockTab({
  inventory,
  currentUser,
  subscription,
  onAddInventoryItem,
  onUpdateInventoryItem,
  locations = ["Main Store Room", "Warehouse Rack A"],
  onAddCustomLocation,
  showToast,
  triggeredModal,
  setTriggeredModal
}: StockTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [isCustomLocInput, setIsCustomLocInput] = useState(false);

  // Scanner simulation states style
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerDestination, setScannerDestination] = useState<"search" | "addModel" | "addSerial">("search");
  const [scannedTextInput, setScannedTextInput] = useState("");
  const scannerInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (showScannerModal && scannerInputRef.current) {
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 150);
    }
  }, [showScannerModal]);

  // Selection states
  const [selectedStockItem, setSelectedStockItem] = useState<InventoryItem | null>(null);
  
  // Product Deep-link QR-code printable sticker card
  const [qrStickerItem, setQrStickerItem] = useState<InventoryItem | null>(null);

  // Deep-link handler for opening specific items
  React.useEffect(() => {
    if (triggeredModal && triggeredModal.startsWith("viewItem:") && setTriggeredModal) {
      const itemId = triggeredModal.split(":")[1];
      const found = inventory.find(item => item.id === itemId);
      if (found) {
        setSelectedStockItem(found);
        showToast(`📦 Item detected: Opened details for ${found.productName}`, "success");
      } else {
        showToast(`❌ Scanned product not found in active database: ${itemId}`, "error");
      }
      setTriggeredModal(null);
    }
  }, [triggeredModal, inventory, setTriggeredModal, showToast]);

  // Excel Sharing & Report states
  const [showExportModal, setShowExportModal] = useState(false);

  // Multi-select & custom column export states
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [exportScope, setExportScope] = useState<"all" | "selected">("all");
  const [exportColumns, setExportColumns] = useState<"all" | "simplified">("simplified");

  // Configurable critical stock status thresholds
  const [showThresholdConfig, setShowThresholdConfig] = useState(false);
  const [criticalThresholdType, setCriticalThresholdType] = useState<"percentage" | "absolute">(() => {
    return (localStorage.getItem("inventory_critical_threshold_type") as "percentage" | "absolute") || "percentage";
  });
  const [criticalThresholdValue, setCriticalThresholdValue] = useState<number>(() => {
    const cached = localStorage.getItem("inventory_critical_threshold_val");
    if (cached) return Number(cached);
    return 30; // Default: 30% of minQuantity or 2 items
  });

  // Watchers to update local storage
  React.useEffect(() => {
    localStorage.setItem("inventory_critical_threshold_type", criticalThresholdType);
    // Reset defaults when changing strategy to keep them realistic
    if (criticalThresholdType === "percentage") {
      const cachedPct = localStorage.getItem("inventory_critical_threshold_val_pct");
      setCriticalThresholdValue(cachedPct ? Number(cachedPct) : 30);
    } else {
      const cachedAbs = localStorage.getItem("inventory_critical_threshold_val_abs");
      setCriticalThresholdValue(cachedAbs ? Number(cachedAbs) : 2);
    }
  }, [criticalThresholdType]);

  React.useEffect(() => {
    localStorage.setItem("inventory_critical_threshold_val", criticalThresholdValue.toString());
    if (criticalThresholdType === "percentage") {
      localStorage.setItem("inventory_critical_threshold_val_pct", criticalThresholdValue.toString());
    } else {
      localStorage.setItem("inventory_critical_threshold_val_abs", criticalThresholdValue.toString());
    }
  }, [criticalThresholdValue, criticalThresholdType]);

  // Check if an item is critically low based on current config
  const checkIfCriticallyLow = React.useCallback((item: InventoryItem) => {
    if (item.quantity === 0) return true; // Zero is always critical
    if (criticalThresholdType === "percentage") {
      // Compare if current quantity is less than or equal to a percentage of minQuantity
      const criticalLimit = (item.minQuantity * criticalThresholdValue) / 100;
      return item.quantity <= Math.max(1, Math.floor(criticalLimit));
    } else {
      // Compare flat absolute count
      return item.quantity <= criticalThresholdValue;
    }
  }, [criticalThresholdType, criticalThresholdValue]);

  // Compute chart data: most frequently used items (Qty Out in last 30 days)
  const usageData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const dataMap: { [id: string]: { name: string; model: string; count: number; fullName: string } } = {};

    inventory.forEach(item => {
      let outQty = 0;
      if (item.history) {
        item.history.forEach(log => {
          if (log.type === "Out") {
            const logDate = new Date(log.timestamp);
            if (logDate >= cutoff) {
              outQty += log.quantity;
            }
          }
        });
      }

      if (outQty > 0) {
        const label = item.productName || "Unknown Item";
        dataMap[item.id] = {
          name: label.length > 18 ? label.slice(0, 18) + "..." : label,
          model: item.modelNo || "",
          count: outQty,
          fullName: `${item.brand ? item.brand + " " : ""}${item.productName}${item.modelNo ? " (" + item.modelNo + ")" : ""}`
        };
      }
    });

    return Object.values(dataMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // top 5 most frequently used items
  }, [inventory]);

  // Global In/Out Transaction History panel states
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyTxType, setHistoryTxType] = useState<"All" | "In" | "Out">("All");

  // Gather and sort all transactions from all inventory items
  const allTransactions = useMemo(() => {
    const result: {
      itemId: string;
      productName: string;
      brand: string;
      modelNo: string;
      type: "In" | "Out";
      quantity: number;
      notes: string;
      timestamp: string;
      user: string;
    }[] = [];

    inventory.forEach(item => {
      if (item.history) {
        item.history.forEach(log => {
          result.push({
            itemId: item.id,
            productName: item.productName,
            brand: item.brand,
            modelNo: item.modelNo,
            type: log.type,
            quantity: log.quantity,
            notes: log.notes,
            timestamp: log.timestamp,
            user: log.user
          });
        });
      }
    });

    // Sort by timestamp descending (newest first)
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [inventory]);

  // Filter global transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      // 1. Transaction Type filter
      if (historyTxType !== "All" && tx.type !== historyTxType) {
        return false;
      }

      // 2. Search query filter
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchProduct = tx.productName.toLowerCase().includes(q);
        const matchBrand = tx.brand.toLowerCase().includes(q);
        const matchNotes = tx.notes.toLowerCase().includes(q);
        const matchUser = tx.user.toLowerCase().includes(q);
        const matchId = tx.itemId.toLowerCase().includes(q);
        if (!matchProduct && !matchBrand && !matchNotes && !matchUser && !matchId) {
          return false;
        }
      }

      return true;
    });
  }, [allTransactions, historyTxType, historySearch]);

  React.useEffect(() => {
    if (showExportModal) {
      if (selectedItemIds.length > 0) {
        setExportScope("selected");
      } else {
        setExportScope("all");
      }
    }
  }, [showExportModal, selectedItemIds.length]);

  // AI Audit States
  const [isAuditingInventory, setIsAuditingInventory] = useState(false);
  const [aiAuditReport, setAiAuditReport] = useState<{
    criticalAlerts: string[];
    restockRecommendations: string[];
    strategicAdvice: string;
  } | null>(null);
  const [showAiAuditPanel, setShowAiAuditPanel] = useState(false);

  const [reportType, setReportType] = useState<"ledger" | "catalog">("catalog"); // default to catalog as requested by user focus
  const [dateMode, setDateMode] = useState<"single" | "range">("range");
  
  const todayYMD = useMemo(() => new Date().toISOString().substring(0, 10), []);
  const [singleDate, setSingleDate] = useState(todayYMD);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // 30 days default is much better
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState(todayYMD);

  // Compute matched items count dynamically
  const matchingCount = useMemo(() => {
    if (exportScope === "selected") {
      if (reportType === "catalog") {
        return selectedItemIds.length;
      } else {
        // count of history entries for selected items within date filter
        let count = 0;
        inventory.forEach(item => {
          if (selectedItemIds.includes(item.id)) {
            (item.history || []).forEach(log => {
              const logDate = log.timestamp ? log.timestamp.substring(0, 10) : "";
              if (dateMode === "single") {
                if (logDate === singleDate) count++;
              } else {
                if (logDate >= startDate && logDate <= endDate) count++;
              }
            });
          }
        });
        return count;
      }
    }

    let count = 0;
    if (reportType === "ledger") {
      inventory.forEach(item => {
        (item.history || []).forEach(log => {
          const logDate = log.timestamp ? log.timestamp.substring(0, 10) : "";
          if (dateMode === "single") {
            if (logDate === singleDate) count++;
          } else {
            if (logDate >= startDate && logDate <= endDate) count++;
          }
        });
      });
    } else {
      inventory.forEach(item => {
        const itemDate = item.createdAt ? item.createdAt.substring(0, 10) : "";
        if (dateMode === "single") {
          if (itemDate === singleDate) count++;
        } else {
          if (itemDate >= startDate && itemDate <= endDate) count++;
        }
      });
    }
    return count;
  }, [inventory, reportType, dateMode, singleDate, startDate, endDate, exportScope, selectedItemIds]);

  const generateCSVData = () => {
    const isLedger = reportType === "ledger";
    const rows: string[][] = [];
    
    if (exportColumns === "simplified") {
      if (isLedger) {
        rows.push([
          "Transaction Date & Time",
          "Model Spec",
          "Type (In/Out)",
          "Quantity Change",
          "Primary Spot / Location"
        ]);

        const itemsToProcess = exportScope === "selected"
          ? inventory.filter(item => selectedItemIds.includes(item.id))
          : inventory;

        itemsToProcess.forEach(item => {
          (item.history || []).forEach(log => {
            const logDate = log.timestamp ? log.timestamp.substring(0, 10) : "";
            const logTime = log.timestamp ? log.timestamp.substring(11, 19) : "";
            const logDateTime = `${logDate} ${logTime}`;
            
            let match = false;
            if (dateMode === "single") {
              match = logDate === singleDate;
            } else {
              match = logDate >= startDate && logDate <= endDate;
            }
            
            if (match) {
              rows.push([
                logDateTime,
                `${item.brand} ${item.modelNo} (${item.productName})`,
                log.type,
                log.quantity.toString(),
                item.location
              ]);
            }
          });
        });
      } else {
        // Catalog + Simplified columns (Exactly requested by user!)
        rows.push([
          "Model Spec",
          "Quantity",
          "Primary Spot"
        ]);

        const itemsToProcess = exportScope === "selected"
          ? inventory.filter(item => selectedItemIds.includes(item.id))
          : inventory.filter(item => {
              const itemDate = item.createdAt ? item.createdAt.substring(0, 10) : "";
              if (dateMode === "single") {
                return itemDate === singleDate;
              } else {
                return itemDate >= startDate && itemDate <= endDate;
              }
            });

        itemsToProcess.forEach(item => {
          rows.push([
            `${item.brand} ${item.modelNo} (${item.productName})`,
            item.quantity.toString(),
            item.location
          ]);
        });
      }
    } else {
      // All Columns (Original structures, but with exportScope filter applied!)
      if (isLedger) {
        rows.push([
          "Transaction Date", 
          "Transaction Time", 
          "Item ID", 
          "Category", 
          "Brand", 
          "Product Name", 
          "Model No", 
          "Serial No", 
          "Type (In/Out)", 
          "Quantity Change", 
          "Logged By", 
          "Notes"
        ]);
        
        const itemsToProcess = exportScope === "selected"
          ? inventory.filter(item => selectedItemIds.includes(item.id))
          : inventory;

        itemsToProcess.forEach(item => {
          (item.history || []).forEach(log => {
            const logDate = log.timestamp ? log.timestamp.substring(0, 10) : "";
            const logTime = log.timestamp ? log.timestamp.substring(11, 19) : "";
            
            let match = false;
            if (dateMode === "single") {
              match = logDate === singleDate;
            } else {
              match = logDate >= startDate && logDate <= endDate;
            }
            
            if (match) {
              rows.push([
                logDate,
                logTime,
                item.id,
                item.category,
                item.brand,
                item.productName,
                item.modelNo,
                item.serialNo,
                log.type,
                log.quantity.toString(),
                log.user,
                log.notes
              ]);
            }
          });
        });
      } else {
        rows.push([
          "Created Date", 
          "Item ID", 
          "Category", 
          "Brand", 
          "Product Name", 
          "Model No", 
          "Serial No", 
          "Stock Balance", 
          "Alert Threshold", 
          "Status Level", 
          "Spot Location"
        ]);
        
        const itemsToProcess = exportScope === "selected"
          ? inventory.filter(item => selectedItemIds.includes(item.id))
          : inventory.filter(item => {
              const itemDate = item.createdAt ? item.createdAt.substring(0, 10) : "";
              if (dateMode === "single") {
                return itemDate === singleDate;
              } else {
                return itemDate >= startDate && itemDate <= endDate;
              }
            });

        itemsToProcess.forEach(item => {
          const itemDate = item.createdAt ? item.createdAt.substring(0, 10) : "";
          const isLow = item.quantity < item.minQuantity;
          const statusLevel = isLow ? "LOW STOCK" : "ADEQUATE";
          rows.push([
            itemDate,
            item.id,
            item.category,
            item.brand,
            item.productName,
            item.modelNo,
            item.serialNo,
            item.quantity.toString(),
            item.minQuantity.toString(),
            statusLevel,
            item.location
          ]);
        });
      }
    }
    
    // Convert to Excel-compatible CSV with UTF-8 BOM
    const csvContent = "\uFEFF" + rows.map(e => e.map(cell => {
      const cleanVal = (cell || '').toString().replace(/"/g, '""');
      return `"${cleanVal}"`;
    }).join(",")).join("\n");
    
    return csvContent;
  };

  const handleDownloadExcel = () => {
    if (matchingCount === 0) {
      showToast("No stock records found for selected date scope!", "error");
      return;
    }
    try {
      const csv = generateCSVData();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const filename = `Stockivo_${reportType === "ledger" ? "LedgerLogs" : "StockSheet"}_${
        dateMode === "single" ? singleDate : `${startDate}_to_${endDate}`
      }.csv`;
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast(`Excel compatible download trigger for ${matchingCount} records!`, "success");
    } catch (err: any) {
      showToast("Download failed: " + err.message, "error");
    }
  };

  const handleShareReport = async () => {
    if (matchingCount === 0) {
      showToast("No stock records found to share!", "error");
      return;
    }
    
    const csv = generateCSVData();
    const filename = `Stockivo_${reportType === "ledger" ? "Ledger" : "Stock"}_${
      dateMode === "single" ? singleDate : `${startDate}_to_${endDate}`
    }.csv`;
    
    let sharedSuccessfully = false;

    if (navigator.share) {
      try {
        const file = new File([csv], filename, { type: "text/csv;charset=utf-8;" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Stockivo Excel Stock Report`,
            text: `Export of ${matchingCount} stock records (${dateMode === 'single' ? singleDate : 'day-to-day'}).`
          });
          showToast("Report spreadsheet shared successfully!", "success");
          sharedSuccessfully = true;
          return;
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          return;
        }
        // Silently swallow browser-level permission/sandbox restrictions to enable fallback gracefully
      }
    }
    
    if (!sharedSuccessfully) {
      try {
        await navigator.clipboard.writeText(csv);
        showToast("Web Share restricted in preview. Copied CSV data to clipboard instead!", "success");
      } catch (err: any) {
        showToast("Please use 'Download Excel Sheet' button to save the report directly!", "info");
      }
    }
  };

  const handleRunInventoryAudit = async () => {
    setIsAuditingInventory(true);
    setAiAuditReport(null);
    setShowAiAuditPanel(true);
    try {
      const response = await fetch("/api/ai/inventory-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory })
      });
      if (response.ok) {
        const data = await response.json();
        setAiAuditReport(data);
        showToast("AI supply chain audit completed", "success");
      } else {
        try {
          const err = await response.json();
          showToast(err.error || "AI stock analysis failed", "error");
        } catch {
          showToast("AI stock analysis failed", "error");
        }
      }
    } catch (err: any) {
      showToast(err.message || "Failed to audit inventory", "error");
    } finally {
      setIsAuditingInventory(false);
    }
  };

  // Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjModal, setShowAdjModal] = useState(false);

  // Add Item Fields
  const [addProd, setAddProd] = useState("");
  const [addBrand, setAddBrand] = useState("");
  const [addCat, setAddCat] = useState("Hardware Component");
  const [addModel, setAddModel] = useState("");
  const [addSerial, setAddSerial] = useState("");
  const [addQty, setAddQty] = useState(10);
  const [addMinQty, setAddMinQty] = useState(5);
  const [addLoc, setAddLoc] = useState("");

  React.useEffect(() => {
    if (locations && locations.length > 0 && !addLoc) {
      setAddLoc(locations[0]);
    }
  }, [locations, addLoc]);
  const [addPurchaseDate, setAddPurchaseDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [addSupplier, setAddSupplier] = useState("Siddhivinayak Spares India");
  const [addStatus, setAddStatus] = useState("In Stock");
  const [addNotes, setAddNotes] = useState("");

  // Adjust Stock Fields
  const [adjType, setAdjType] = useState<"In" | "Out">("In");
  const [adjQty, setAdjQty] = useState(1);
  const [adjNotes, setAdjNotes] = useState("");

  const categories = useMemo(() => {
    const list = new Set(inventory.map(item => item.category));
    return ["All", ...Array.from(list)];
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch =
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.modelNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.serialNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCat = categoryFilter === "All" || item.category === categoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [inventory, searchTerm, categoryFilter]);

  const handleAddNewProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addProd || !addModel || !addSerial) {
      showToast("Product name, Model can't be blank", "error");
      return;
    }

    if (subscription) {
      const activePlan = subscription.plan;
      const stockLimit = PLAN_LIMITS[activePlan].inventory;
      if (inventory.length >= stockLimit) {
        showToast(`Inventory limit hit! Your '${activePlan}' plan is capped at ${stockLimit} items. Upgrade plan in More tab.`, "error");
        return;
      }
    }

    onAddInventoryItem({
      productName: addProd,
      brand: addBrand || "Generic",
      category: addCat,
      modelNo: addModel,
      serialNo: addSerial,
      quantity: Number(addQty),
      minQuantity: Number(addMinQty),
      location: addLoc,
      purchaseDate: addPurchaseDate,
      supplier: addSupplier,
      status: addStatus,
      notes: addNotes
    });

    // Reset Form
    setAddProd("");
    setAddBrand("");
    setAddCat("Hardware Component");
    setAddModel("");
    setAddSerial("");
    setAddQty(10);
    setAddMinQty(5);
    setAddLoc("Store Room");
    setAddPurchaseDate(new Date().toISOString().substring(0, 10));
    setAddSupplier("Siddhivinayak Spares India");
    setAddStatus("In Stock");
    setAddNotes("");
    setShowAddModal(false);
  };

  const handleAdjustStockConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockItem) return;

    if (adjQty <= 0) {
      showToast("Quantity must be greater than zero", "error");
      return;
    }

    let nextQty = selectedStockItem.quantity;
    if (adjType === "In") {
      nextQty += adjQty;
    } else {
      if (nextQty < adjQty) {
        showToast("Cannot stock out more than active available quantity!", "error");
        return;
      }
      nextQty -= adjQty;
    }

    const opUser = currentUser?.name || "Suresh Patil";

    const updatedItem: InventoryItem = {
      ...selectedStockItem,
      quantity: nextQty,
      history: [
        ...selectedStockItem.history,
        {
          type: adjType,
          quantity: adjQty,
          notes: adjNotes || `${adjType === "In" ? "RestOCKED" : "Dispatched outwards"} spares`,
          timestamp: new Date().toISOString(),
          user: opUser
        }
      ]
    };

    onUpdateInventoryItem(updatedItem);
    setSelectedStockItem(updatedItem);
    setShowAdjModal(false);
    setAdjQty(1);
    setAdjNotes("");
    showToast(`Successfully registered Stock ${adjType} of ${adjQty} items.`, "success");
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50 dark:bg-stone-950 transition-colors duration-200 pb-20 select-none">
      
      {/* 30-Day Item Usage Visual Summary */}
      <div className="bg-white dark:bg-stone-900 border border-gray-105 dark:border-stone-800/80 p-4 rounded-3xl shadow-xs text-left" id="stock-visual-summary">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="p-1.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <TrendingDown className="w-4 h-4 shrink-0" />
            </span>
            <div>
              <h3 className="font-extrabold text-xs text-gray-800 dark:text-stone-200 tracking-tight leading-none">
                30-Day Usage Summary
              </h3>
              <p className="text-[10px] text-gray-400 dark:text-stone-500 mt-0.5 font-medium leading-none">
                Top spare parts outbound distribution logs
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-slate-100 dark:bg-stone-950 text-gray-500 px-2.5 py-1 rounded-xl font-black uppercase tracking-wider">
            Last 30 Days
          </span>
        </div>

        {usageData.length === 0 ? (
          <div className="py-7 text-center rounded-2xl bg-slate-50/50 dark:bg-stone-950/30 border border-dashed border-gray-150 dark:border-stone-850 flex flex-col items-center justify-center gap-1.5">
            <Package className="w-6 h-6 text-gray-350 dark:text-stone-600 shrink-0" />
            <p className="text-[11px] text-gray-400 dark:text-stone-500 italic">
              No stock outbound transactions found in the last 30 days.
            </p>
            <p className="text-[9px] text-gray-355 dark:text-stone-600 leading-none">
              Outbound usage displays dynamically when items are marked "Stock Out".
            </p>
          </div>
        ) : (
          <div className="w-full h-48 mt-1 text-slate-700 dark:text-stone-300">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usageData}
                margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:hidden opacity-40" />
                <CartesianGrid strokeDasharray="3 3" stroke="#292524" className="hidden dark:block opacity-40" />
                <XAxis
                  dataKey="name"
                  stroke="#888888"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  className="font-bold fill-gray-500 dark:fill-stone-400 font-sans"
                />
                <YAxis
                  stroke="#888888"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  className="font-medium fill-gray-400 dark:fill-stone-500 font-mono"
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(249, 115, 22, 0.05)" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-stone-900 border border-gray-150 dark:border-stone-800 p-2 rounded-xl shadow-md text-left text-[10px]">
                          <p className="font-extrabold text-gray-800 dark:text-stone-100 mb-0.5">
                            {data.fullName}
                          </p>
                          <p className="font-mono text-orange-600 dark:text-orange-400 font-bold">
                            Usage Count: <span className="text-sm font-black">{data.count}</span> units
                          </p>
                          {data.model && (
                            <p className="text-[9px] text-gray-400 dark:text-stone-500 font-medium">
                              Model: {data.model}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={45}
                >
                  {usageData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        index === 0
                          ? "#f97316"
                          : index === 1
                            ? "#fb923c"
                            : index === 2
                              ? "#fdba74"
                              : "#fed7aa"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Search and filters */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 dark:text-stone-500" />
            <input
              type="text"
              placeholder="Search products, Model, Serial, ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-xl pl-9.5 pr-10 py-2.5 focus:outline-none focus:border-emerald-500 text-gray-800 dark:text-stone-200"
            />
            <button
              type="button"
              onClick={() => {
                setScannedTextInput("");
                setScannerDestination("search");
                setShowScannerModal(true);
              }}
              className="absolute right-3 top-2.5 p-0.5 text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
              title="Scan Barcode / QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Button Row - Horizontally Scrollable ("Scroll Side") */}
        <div className="flex gap-2 overflow-x-auto py-1.5 items-center select-none no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold p-2.5 rounded-xl flex items-center gap-1 text-xs cursor-pointer shadow-sm transition-all whitespace-nowrap shrink-0"
            id="btn-stock-add"
          >
            <Plus className="w-4 h-4" />
            <span>Add Stock</span>
          </button>
          
          <button
            onClick={handleRunInventoryAudit}
            className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black p-2.5 rounded-xl flex items-center gap-1 text-xs cursor-pointer shadow-sm transition-all whitespace-nowrap shrink-0"
            id="btn-stock-ai-audit"
          >
            <span>✨ AI Audit</span>
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="bg-[#0f172a] dark:bg-stone-800 hover:bg-slate-900 dark:hover:bg-stone-700 active:scale-95 text-white font-black p-2.5 rounded-xl flex items-center gap-1 text-xs cursor-pointer shadow-sm transition-all whitespace-nowrap shrink-0"
            id="btn-stock-excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>📊 Excel Report</span>
          </button>

          <button
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) {
                setSelectedItemIds([]); // Reset selection when leaving select mode
              }
            }}
            className={`p-2.5 rounded-xl flex items-center gap-1 text-xs cursor-pointer shadow-sm transition-all whitespace-nowrap font-black active:scale-95 shrink-0 ${
              isSelectMode
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-slate-200 hover:bg-slate-300 dark:bg-stone-800 dark:hover:bg-stone-750 text-gray-800 dark:text-white"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>{isSelectMode ? "Cancel Select" : "☑ Select Spares"}</span>
          </button>

          <button
            onClick={() => setShowThresholdConfig(!showThresholdConfig)}
            className={`p-2.5 rounded-xl flex items-center gap-1 text-xs cursor-pointer shadow-sm transition-all whitespace-nowrap font-black active:scale-95 shrink-0 ${
              showThresholdConfig
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                : "bg-slate-200 hover:bg-slate-300 dark:bg-stone-800 dark:hover:bg-stone-750 text-gray-800 dark:text-white"
            }`}
            title="Configure Critical Low Thresholds"
          >
            <Sliders className="w-4 h-4" />
            <span>⚠️ Threshold UI</span>
          </button>

          <button
            onClick={() => {
              setShowHistoryPanel(!showHistoryPanel);
              if (!showHistoryPanel) {
                // Scroll to view if opened
                setShowThresholdConfig(false);
                setShowAiAuditPanel(false);
              }
            }}
            className={`p-2.5 rounded-xl flex items-center gap-1 text-xs cursor-pointer shadow-sm transition-all whitespace-nowrap font-black active:scale-95 shrink-0 ${
              showHistoryPanel
                ? "bg-amber-600 hover:bg-amber-750 text-white shadow-[0_0_12px_rgba(217,119,6,0.25)] animate-pulse"
                : "bg-slate-200 hover:bg-slate-300 dark:bg-stone-800 dark:hover:bg-stone-750 text-gray-800 dark:text-white"
            }`}
            title="Show complete item in and out transaction log history"
            id="btn-stock-ledger-history"
          >
            <History className="w-4 h-4 text-amber-500" />
            <span>📜 History</span>
          </button>
        </div>

        {/* Filter categories scrolling rail */}
        <div className="flex gap-1.5 overflow-x-auto py-1 items-center select-none no-scrollbar">
          <Filter className="w-3.5 h-3.5 text-gray-400 dark:text-stone-550 shrink-0" />
          {categories.map(cat => {
            const isSel = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-[9px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                  isSel
                    ? "bg-slate-800 dark:bg-stone-100 text-white dark:text-stone-900 border-slate-800 dark:border-stone-100 font-black shadow-xs"
                    : "bg-white dark:bg-stone-900 text-gray-500 dark:text-stone-400 border-gray-100 dark:border-stone-800/80 hover:bg-gray-50"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Configurable Threshold Settings panel */}
      {showThresholdConfig && (
        <div className="bg-white dark:bg-stone-900 border border-rose-200/80 dark:border-rose-950/50 p-4 rounded-3xl shadow-xs text-left relative overflow-hidden transition-all duration-300 animate-slide-down">
          <button
            onClick={() => setShowThresholdConfig(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer p-1 rounded-full hover:bg-slate-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2 mb-3">
            <span className="p-1 px-2.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
              <Sliders className="w-3 h-3 text-rose-500" /> Configurable Critical Low Stock Warning Threshold
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-stone-400">
                Threshold Strategy (Subset of Standard Low Warnings)
              </label>
              <div className="flex bg-slate-100 dark:bg-stone-950 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setCriticalThresholdType("percentage")}
                  className={`flex-1 text-[10px] font-black py-1.5 rounded-lg uppercase tracking-wider transition-all select-none cursor-pointer ${
                    criticalThresholdType === "percentage"
                      ? "bg-white dark:bg-stone-850 shadow-xs text-rose-600 dark:text-rose-400 font-extrabold"
                      : "text-gray-500 hover:text-gray-850 dark:hover:text-stone-200"
                  }`}
                >
                  % percentage limit
                </button>
                <button
                  type="button"
                  onClick={() => setCriticalThresholdType("absolute")}
                  className={`flex-1 text-[10px] font-black py-1.5 rounded-lg uppercase tracking-wider transition-all select-none cursor-pointer ${
                    criticalThresholdType === "absolute"
                      ? "bg-white dark:bg-stone-850 shadow-xs text-rose-600 dark:text-rose-400 font-extrabold"
                      : "text-gray-500 hover:text-gray-850 dark:hover:text-stone-200"
                  }`}
                >
                  # absolute count
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                <span className="text-gray-500 dark:text-stone-400">Warning Value:</span>
                <span className="text-rose-600 dark:text-rose-400 font-mono text-xs">
                  {criticalThresholdType === "percentage" ? `${criticalThresholdValue}% of min limit` : `${criticalThresholdValue} units or fewer`}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCriticalThresholdValue(Math.max(
                    criticalThresholdType === "percentage" ? 10 : 0, 
                    criticalThresholdValue - (criticalThresholdType === "percentage" ? 5 : 1)
                  ))}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-stone-950 dark:hover:bg-stone-850 select-none text-gray-700 dark:text-stone-200 flex items-center justify-center font-bold text-sm cursor-pointer border border-transparent dark:border-stone-800"
                >
                  -
                </button>
                
                <input
                  type="range"
                  min={criticalThresholdType === "percentage" ? 10 : 0}
                  max={criticalThresholdType === "percentage" ? 100 : 20}
                  step={criticalThresholdType === "percentage" ? 5 : 1}
                  value={criticalThresholdValue}
                  onChange={(e) => setCriticalThresholdValue(Number(e.target.value))}
                  className="flex-1 accent-rose-600 dark:accent-rose-500 cursor-pointer h-1 bg-gray-200 dark:bg-stone-950 rounded-lg appearance-none"
                />

                <button
                  type="button"
                  onClick={() => setCriticalThresholdValue(Math.min(
                    criticalThresholdType === "percentage" ? 100 : 20, 
                    criticalThresholdValue + (criticalThresholdType === "percentage" ? 5 : 1)
                  ))}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-stone-950 dark:hover:bg-stone-850 select-none text-gray-700 dark:text-stone-200 flex items-center justify-center font-bold text-sm cursor-pointer border border-transparent dark:border-stone-800"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 py-2 px-3.5 bg-rose-500/5 dark:bg-rose-500/5 rounded-2xl border border-rose-500/10 flex items-center justify-between text-[10px]">
            <div className="text-gray-500 dark:text-stone-400 flex items-center gap-1.5 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0"></span>
              <span>
                {criticalThresholdType === "percentage" 
                  ? `Highlighting items as "Critically Low" if count is ≤ ${criticalThresholdValue}% of each spare's custom base min limit.`
                  : `Highlighting items as "Critically Low" if absolute quantity is ≤ ${criticalThresholdValue} units.`
                }
              </span>
            </div>
            
            <span className="font-extrabold text-rose-600 bg-rose-100/60 dark:bg-rose-500/15 dark:text-rose-400 px-2 py-0.5 rounded-md font-mono text-[9px] shrink-0">
              {inventory.filter(checkIfCriticallyLow).length} critical
            </span>
          </div>

        </div>
      )}

      {/* Global In/Out Transaction Ledger panel */}
      {showHistoryPanel && (
        <div className="bg-white dark:bg-stone-900 border border-amber-500/30 dark:border-stone-850 p-4 rounded-3xl shadow-sm text-left relative overflow-hidden transition-all duration-300 animate-slide-down space-y-4">
          <button
            onClick={() => setShowHistoryPanel(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer p-1 rounded-full hover:bg-slate-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 rounded-full bg-amber-500/10 text-amber-605 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Global Stock Transaction Log (In & Out Feed)
              </span>
            </div>
            
            {/* Quick stats badges */}
            <div className="flex items-center gap-1.5 text-[9px] font-bold">
              <span className="bg-slate-100 dark:bg-stone-800 text-gray-600 dark:text-stone-300 px-2 py-1 rounded-lg">
                Total: {allTransactions.length} events
              </span>
              <span className="bg-emerald-500/10 text-emerald-605 dark:text-emerald-400 px-2 py-1 rounded-lg flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3 text-emerald-500" /> In: {allTransactions.filter(t => t.type === "In").length}
              </span>
              <span className="bg-rose-500/10 text-rose-605 dark:text-rose-450 px-2 py-1 rounded-lg flex items-center gap-0.5">
                <ArrowDownRight className="w-3 h-3 text-rose-500" /> Out: {allTransactions.filter(t => t.type === "Out").length}
              </span>
            </div>
          </div>

          {/* Search and filters within history */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Internal search */}
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search history by items name, brand, staff name, or reason..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-stone-950 border border-gray-150 dark:border-stone-800 rounded-xl pl-8.5 pr-14 py-1.5 focus:outline-none focus:border-amber-500 text-gray-800 dark:text-stone-200"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch("")}
                  className="absolute right-2 top-1.5 text-gray-450 hover:text-gray-700 dark:hover:text-stone-300 font-extrabold text-[9px] uppercase cursor-pointer bg-slate-100 dark:bg-stone-805 px-2 py-1 rounded"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Type buttons */}
            <div className="flex bg-slate-105 dark:bg-stone-950 p-1 rounded-xl gap-1 shrink-0">
              {(["All", "In", "Out"] as const).map(type => {
                const isActive = historyTxType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setHistoryTxType(type)}
                    className={`flex-1 text-[9.5px] uppercase font-black py-1 rounded-lg tracking-wider transition-all select-none cursor-pointer ${
                      isActive
                        ? "bg-white dark:bg-stone-850 shadow-xs text-amber-600 dark:text-amber-400"
                        : "text-gray-500 hover:text-gray-800 dark:hover:text-stone-200"
                    }`}
                  >
                    {type === "All" ? "All" : type === "In" ? "📥 In" : "📤 Out"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* List items feed container */}
          <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2 border-t border-gray-100 dark:border-stone-850 pt-2 shrink-0">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400 italic text-xs">
                {allTransactions.length === 0 
                  ? "No transactions have been recorded in the system yet." 
                  : "No transactions match your current search and type filters."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredTransactions.map((tx, i) => {
                  const itemInCatalog = inventory.find(item => item.id === tx.itemId);
                  return (
                    <div
                      key={i}
                      onClick={() => {
                        if (itemInCatalog) {
                          setSelectedStockItem(itemInCatalog);
                        } else {
                          showToast("This item is no longer available in the catalog.", "error");
                        }
                      }}
                      className="group p-2.5 border border-gray-100 dark:border-stone-850/65 bg-slate-50/50 dark:bg-stone-950/40 hover:bg-amber-100/5 dark:hover:bg-amber-950/10 hover:border-amber-300 dark:hover:border-amber-900/30 rounded-2xl flex items-start justify-between text-left transition-all duration-200 cursor-pointer text-xs"
                    >
                      <div className="space-y-1 min-w-0 pr-1.5 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-0.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            tx.type === "In" 
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-550/10" 
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-550/10"
                          }`}>
                            {tx.type === "In" ? "📥 Stock In" : "📤 Stock Out"}
                          </span>
                          
                          <span className={`text-[10px] font-black ${
                            tx.type === "In" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-450"
                          }`}>
                            {tx.type === "In" ? `+${tx.quantity}` : `-${tx.quantity}`} pcs
                          </span>

                          <span className="text-[9px] text-gray-400 dark:text-stone-500 font-mono">
                            {tx.brand}
                          </span>
                        </div>

                        {/* Product Title */}
                        <div className="font-extrabold text-gray-800 dark:text-stone-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 select-none block truncate text-[11px]">
                          {tx.productName}
                        </div>

                        {/* Notes justification */}
                        <div className="text-[10px] text-gray-500 dark:text-stone-400 leading-relaxed font-normal italic truncate">
                          "{tx.notes || "No reason specified"}"
                        </div>
                      </div>

                      {/* Right side info */}
                      <div className="text-[9px] text-gray-400 text-right shrink-0 flex flex-col justify-between h-full space-y-2 pl-1">
                        <div className="bg-slate-100 dark:bg-stone-850 text-gray-600 dark:text-stone-300 font-extrabold px-1.5 py-0.5 rounded text-[8px] self-end uppercase">
                          👤 {tx.user.split(" ")[0]}
                        </div>
                        <div className="font-mono text-gray-450 dark:text-stone-550 text-[8.5px]">
                          {formatDateTime(tx.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Supply Chain Auditor Panel */}
      {showAiAuditPanel && (
        <div className="bg-white dark:bg-stone-900 border border-indigo-150 dark:border-stone-800 p-4 rounded-3xl shadow-sm text-left relative overflow-hidden transition-all duration-300">
          <button
            onClick={() => setShowAiAuditPanel(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2 mb-3">
            <span className="p-1 px-2.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-widest">
              Gemini AI Supply Chain Auditor
            </span>
          </div>

          {isAuditingInventory ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-6 h-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto"></div>
              <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 animate-pulse">
                Analyzing spares stock levels, evaluating restock priorities, optimizing SKU values...
              </p>
            </div>
          ) : aiAuditReport ? (
            <div className="space-y-4">
              {/* Critical Alerts */}
              <div>
                <span className="block text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1.5">
                  ⚠️ Understock & Risk Warnings
                </span>
                {aiAuditReport.criticalAlerts.length === 0 ? (
                  <p className="text-[10px] text-gray-500">No critical alerts. Stock levels are healthy!</p>
                ) : (
                  <ul className="space-y-1">
                    {aiAuditReport.criticalAlerts.map((alert, i) => (
                      <li key={i} className="text-[10px] text-gray-700 dark:text-stone-300 flex items-start gap-1">
                        <span className="text-rose-500 font-extrabold text-[12px] leading-none select-none">•</span>
                        <span>{alert}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Restock Recommendations */}
              <div>
                <span className="block text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1.5">
                  🗳 Recommended Restocking Orders
                </span>
                <ul className="space-y-1">
                  {aiAuditReport.restockRecommendations.map((rec, i) => (
                    <li key={i} className="text-[10px] text-gray-700 dark:text-stone-300 flex items-start gap-1.5">
                      <span className="text-emerald-500 font-extrabold">✓</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Strategic Advice */}
              <div className="p-3 bg-indigo-500/5 dark:bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                <span className="block text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">
                  💡 Supply Chain Strategy Advice
                </span>
                <p className="text-[10px] text-gray-600 dark:text-stone-300 italic leading-relaxed">
                  "{aiAuditReport.strategicAdvice}"
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-gray-400">Failed to load optimization advice. Try again.</p>
          )}
        </div>
      )}

      {/* Selection Control Panel */}
      {isSelectMode && (
        <div className="bg-slate-100 dark:bg-stone-900/65 border border-slate-200 dark:border-stone-800 p-3 rounded-2xl flex flex-wrap gap-2.5 items-center justify-between animate-fade-in text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black">
              ☑ Select Scope ({selectedItemIds.length} / {filteredInventory.length} Spares)
            </span>
            {selectedItemIds.length > 0 && (
              <span className="text-[8.5px] bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded-md font-extrabold uppercase animate-pulse">
                Target Selected Spares for Excel
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 font-sans select-none">
            <button
              onClick={() => {
                const allIds = filteredInventory.map(item => item.id);
                setSelectedItemIds(allIds);
                showToast(`Selected all ${filteredInventory.length} items!`, "success");
              }}
              className="text-[9.5px] uppercase font-black text-blue-600 dark:text-blue-400 hover:underline px-1 py-0.5 cursor-pointer"
            >
              Select All
            </button>
            <span className="text-gray-300 dark:text-stone-700">|</span>
            <button
              onClick={() => {
                setSelectedItemIds([]);
                showToast("Deselected all items", "info");
              }}
              className="text-[9.5px] uppercase font-black text-gray-500 hover:underline px-1 py-0.5 cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Stock list items */}
      <div className="space-y-2.5">
        {filteredInventory.length === 0 ? (
          <div className="text-center p-10 bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800/80 rounded-2xl shadow-sm">
            <Package className="w-8 h-8 text-gray-300 dark:text-stone-700 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-gray-700 dark:text-stone-300">No Inventory Found</h4>
            <p className="text-[10px] text-gray-400 mt-1">
              Add products, camera sensors, cables, or HDDs to track count levels.
            </p>
          </div>
        ) : (
          filteredInventory.map(item => {
            const isLow = item.quantity < item.minQuantity;
            const isCritical = checkIfCriticallyLow(item);
            const isChecked = selectedItemIds.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isSelectMode) {
                    if (isChecked) {
                      setSelectedItemIds(selectedItemIds.filter(id => id !== item.id));
                    } else {
                      setSelectedItemIds([...selectedItemIds, item.id]);
                    }
                  } else {
                    setSelectedStockItem(item);
                  }
                }}
                className={`bg-white dark:bg-stone-900 border p-3.5 rounded-xl text-left shadow-sm cursor-pointer hover:shadow-md transition-all active:scale-99 flex justify-between items-center relative overflow-hidden ${
                  isChecked
                    ? "border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                    : isCritical
                      ? "border-rose-300 dark:border-rose-900/40 bg-rose-500/5 dark:bg-rose-950/10 hover:border-rose-400 dark:hover:border-rose-800 shadow-[0_0_12px_rgba(244,63,94,0.06)]"
                      : "border-gray-100 dark:border-stone-800/80 hover:border-emerald-500/20 dark:hover:border-emerald-500/10"
                }`}
              >
                {!isChecked && (
                  isCritical ? (
                    <div className="absolute top-0 right-0 left-0 h-[3px] bg-rose-600 animate-pulse"></div>
                  ) : isLow ? (
                    <div className="absolute top-0 right-0 left-0 h-[2px] bg-amber-500"></div>
                  ) : null
                )}

                <div className="flex items-center gap-3-5 flex-1 min-w-0">
                  {isSelectMode && (
                    <div className="flex items-center shrink-0 pr-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // event handled by parent card click
                        className="w-4.5 h-4.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-stone-700 focus:outline-none dark:bg-stone-800 cursor-pointer accent-emerald-600"
                      />
                    </div>
                  )}

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[8px] font-mono font-bold bg-slate-100 dark:bg-stone-800 px-1.5 rounded text-gray-400 dark:text-stone-400">
                        {item.id}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-blue-600 dark:text-blue-400">
                        {item.brand}
                      </span>
                    </div>

                    <h3 className="text-xs font-extrabold text-gray-800 dark:text-stone-100 line-clamp-1 max-w-[260px]">
                      {item.productName}
                    </h3>

                    <div className="text-[10px] font-mono font-medium text-gray-500 dark:text-stone-400 uppercase">
                      Mod: {item.modelNo} | Loc: {item.location}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 select-none">
                  {/* Generate printable QR deep-link button */}
                  {!isSelectMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setQrStickerItem(item);
                      }}
                      className="p-1.5 rounded-lg border border-gray-100 hover:border-gray-200 dark:border-stone-800 dark:hover:border-stone-750 bg-slate-50 hover:bg-slate-100 dark:bg-stone-850 dark:hover:bg-stone-800 text-gray-400 hover:text-indigo-650 dark:hover:text-indigo-400 active:scale-95 transition-all cursor-pointer"
                      title="Print direct-scan QR code"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full transition-all ${
                      isCritical
                        ? "bg-gradient-to-r from-rose-500 to-rose-700 text-white dark:from-rose-600 dark:to-rose-800 border border-rose-500/40 shadow-[0_0_8px_rgba(239,68,68,0.25)] animate-pulse"
                        : isLow
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-300/25 animate-pulse"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
                    }`}>
                      Qty: {item.quantity}
                    </span>

                    {isCritical ? (
                      <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-rose-700 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-500/15 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        <AlertOctagon className="w-2.5 h-2.5 text-rose-600 dark:text-rose-450 shrink-0" /> CRITICAL
                      </span>
                    ) : isLow ? (
                      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 px-1 py-0.5 rounded uppercase">
                        <AlertTriangle className="w-2.5 h-2.5" /> LOW
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Stock detail Modal sheet (dual QR viewer + transaction logs) */}
      {selectedStockItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center select-none">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-3xl border-t border-slate-200/50 dark:border-stone-800 max-h-[85vh] overflow-y-auto flex flex-col animate-slide-up">
            
            {/* Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900 z-10">
              <div>
                <span className="text-[9px] font-mono font-black uppercase tracking-widest bg-slate-100 dark:bg-stone-800 px-2 py-0.5 rounded text-gray-505">
                  ERP Stock ledger Card
                </span>
                <h3 className="text-base font-black text-gray-800 dark:text-stone-100 mt-1">
                  {selectedStockItem.productName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedStockItem(null)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-gray-500 active:scale-90"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 flex-1">
              
              {/* Dual QR code cards for Model and Serial codes */}
              <div className="space-y-2">
                <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest text-left">
                  Model & Serial Dual QR Codes (Click to print)
                </span>

                <div className="grid grid-cols-2 gap-3">
                  {/* Model QR */}
                  <div className="flex flex-col items-center bg-slate-50 dark:bg-stone-800/45 p-2.5 border border-gray-100 dark:border-stone-800 rounded-2xl">
                    <div className="p-1 bg-white rounded-lg select-all">
                      <img
                        src={generateQRUrl(`INVSRV-MODEL:${selectedStockItem.modelNo}`, "120x120")}
                        alt="Model QR"
                        className="w-24 h-24 pointer-events-none"
                      />
                    </div>
                    <span className="text-[8px] font-mono text-gray-400 font-bold uppercase mt-1">
                      Model QR sticker
                    </span>
                    <a
                      href={generateQRUrl(`INVSRV-MODEL:${selectedStockItem.modelNo}`)}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="text-[9px] text-blue-500 font-extrabold underline uppercase mt-0.5"
                    >
                      DS-MODEL (Print)
                    </a>
                  </div>

                  {/* Serial QR */}
                  <div className="flex flex-col items-center bg-slate-50 dark:bg-stone-800/45 p-2.5 border border-gray-100 dark:border-stone-800 rounded-2xl">
                    <div className="p-1 bg-white rounded-lg select-all">
                      <img
                        src={generateQRUrl(`INVSRV-SERIAL:${selectedStockItem.serialNo}`, "120x120")}
                        alt="Serial QR"
                        className="w-24 h-24 pointer-events-none"
                      />
                    </div>
                    <span className="text-[8px] font-mono text-gray-400 font-bold uppercase mt-1">
                      Serial S/N sticker
                    </span>
                    <a
                      href={generateQRUrl(`INVSRV-SERIAL:${selectedStockItem.serialNo}`)}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="text-[9px] text-blue-500 font-extrabold underline uppercase mt-0.5"
                    >
                      DS-SERIAL (Print)
                    </a>
                  </div>
                </div>
              </div>

              {/* Product Direct deep-link scan code sticker */}
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl p-3 border border-indigo-100/60 dark:border-indigo-900/40 text-left space-y-2 select-text">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider">
                      Direct Product Dispatch QR Code
                    </h4>
                    <p className="text-[9px] text-gray-500 dark:text-stone-450">
                      Scanning this QR opens details/edit page instantly
                    </p>
                  </div>
                  <button
                    onClick={() => setQrStickerItem(selectedStockItem)}
                    className="p-1 px-2 text-[9px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                  >
                    <QrCode className="w-3 h-3" /> Print
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-white rounded-xl border border-indigo-100 dark:border-indigo-950/40 shrink-0 select-none">
                    <img
                      src={generateQRUrl(`${window.location.origin}/?tab=stock&itemId=${selectedStockItem.id}`, "80x80")}
                      alt="Product Scan deep link QR"
                      className="w-14 h-14 object-contain pointer-events-none"
                    />
                  </div>
                  <div className="space-y-1 text-[10px]">
                    <div className="font-mono font-bold text-gray-700 dark:text-indigo-350">
                      ID: {selectedStockItem.id}
                    </div>
                    <div className="text-gray-500 dark:text-stone-400 max-w-[200px] truncate">
                      {window.location.origin}/?itemId={selectedStockItem.id}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/?tab=stock&itemId=${selectedStockItem.id}`);
                        showToast("📋 Deep link copied to clipboard!", "success");
                      }}
                      className="text-[9px] text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline"
                    >
                      Copy Link URL
                    </button>
                  </div>
                </div>
              </div>

              {/* Action grid (Adjust Stock Button) */}
              <button
                onClick={() => {
                  setAdjType("In");
                  setShowAdjModal(true);
                }}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 text-white font-black text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all outline-none"
              >
                <Plus className="w-4 h-4" />
                <span>Adjust Stock Levels (In/Out)</span>
              </button>

              {/* Log Ledger details */}
              <div className="p-3 bg-slate-50 dark:bg-stone-800/30 rounded-2xl border border-gray-100 dark:border-stone-800 text-xs font-semibold space-y-2 select-none text-left">
                <div className="flex justify-between">
                  <span className="text-gray-400">Manufacturer Brand:</span>
                  <span className="text-gray-800 dark:text-stone-200 uppercase">{selectedStockItem.brand}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Class Category:</span>
                  <span className="text-gray-800 dark:text-stone-200">{selectedStockItem.category}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Model Spec:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">{selectedStockItem.modelNo}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Primary Serial No:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">{selectedStockItem.serialNo}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Primary spot:</span>
                  <span className="text-orange-500 font-extrabold">📍 {selectedStockItem.location}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Purchase Date:</span>
                  <span className="text-gray-800 dark:text-stone-200">{selectedStockItem.purchaseDate || "N/A"}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Supplier:</span>
                  <span className="text-gray-800 dark:text-stone-200">{selectedStockItem.supplier || "N/A"}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Current Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    selectedStockItem.status === "Damaged"
                      ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
                      : selectedStockItem.status === "Out of Stock"
                      ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                      : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                  }`}>
                    {selectedStockItem.status || "In Stock"}
                  </span>
                </div>

                {selectedStockItem.notes && (
                  <div className="pt-2 border-t border-gray-100 dark:border-stone-850">
                    <span className="text-gray-400 block text-[10px] uppercase tracking-wider mb-0.5">Notes:</span>
                    <p className="text-[11px] text-gray-650 dark:text-stone-350 italic font-medium leading-relaxed">
                      {selectedStockItem.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* In/Out History list logs */}
              <div className="space-y-2.5">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Stock Transaction history logs</span>
                </label>

                {selectedStockItem.history.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic">
                    No transactions recorded on this item yet.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {selectedStockItem.history.slice().reverse().map((log, i) => (
                      <div
                        key={i}
                        className="p-2 border border-gray-150 dark:border-stone-800 bg-slate-50 dark:bg-stone-900 rounded-xl flex items-center justify-between text-[11px] text-left"
                      >
                        <div>
                          <div className="flex items-center gap-1">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                              log.type === "In" ? "bg-emerald-500" : "bg-rose-500"
                            }`}></span>
                            <span className="font-bold text-gray-750 dark:text-stone-250">
                              {log.type === "In" ? "Stock In (+)" : "Stock Out (-)"} - {log.quantity} units
                            </span>
                          </div>
                          <span className="text-[9px] text-gray-400 block mt-0.5">
                            Reason: {log.notes}
                          </span>
                        </div>

                        <div className="text-[9px] text-gray-400 text-right font-medium">
                          <div>By: {log.user.split(" ")[0]}</div>
                          <div>{formatDateTime(log.timestamp)}</div>
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

      {/* Sheet Modal: Add New Product into catalog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-3xl border-t border-slate-200/50 dark:border-stone-800 max-h-[85vh] overflow-y-auto flex flex-col animate-slide-up">
            
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900 z-10">
              <div className="flex items-center gap-1.5">
                <Package className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-black text-gray-800 dark:text-stone-100">
                  Register Catalog Product
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-stone-800 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewProductSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Device Brand / Manufacturer *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CP Plus, Honeywell, Bosch..."
                  value={addBrand}
                  onChange={e => setAddBrand(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-3 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-403 uppercase tracking-widest mb-1.5">
                  Product / Spare parts name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CP Plus 4MP IP Dome Camera"
                  value={addProd}
                  onChange={e => setAddProd(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-3 focus:outline-none focus:border-emerald-500"
                />
              </div>

               <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                    <span>Model Number *</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. DS-2CE16..."
                      value={addModel}
                      onChange={e => setAddModel(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl pl-3 pr-8.5 py-2.5 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setScannerDestination("addModel");
                        setShowScannerModal(true);
                      }}
                      className="absolute right-2 top-2 p-1 text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                      title="Scan Model QR/Barcode"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                    <span>Serial Number (S/N) *</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. HK-192..."
                      value={addSerial}
                      onChange={e => setAddSerial(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl pl-3 pr-8.5 py-2.5 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setScannerDestination("addSerial");
                        setShowScannerModal(true);
                      }}
                      className="absolute right-2 top-2 p-1 text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                      title="Scan Serial QR/Barcode"
                    >
                      <Barcode className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Opening Quantity *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={addQty}
                    onChange={e => setAddQty(Number(e.target.value))}
                    className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3 py-2.5 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Min Stock Alarm *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={addMinQty}
                    onChange={e => setAddMinQty(Number(e.target.value))}
                    className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3 py-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Broad Category
                  </label>
                  <select
                    value={addCat}
                    onChange={e => setAddCat(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-stone-800 border border-gray-200 text-gray-800 rounded-xl px-2.5 py-3"
                  >
                    <option value="Hardware Component">Hardware Component</option>
                    <option value="Spares Kit">Spares Kit</option>
                    <option value="Motherboard">Motherboard</option>
                    <option value="Receiver Unit">Receiver Unit</option>
                    <option value="Hard Disk Drive">Hard Disk Drive</option>
                    <option value="PoE Switch">PoE Switch</option>
                    <option value="WiFi Router">WiFi Router</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest">
                      Spot Location
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomLocInput(!isCustomLocInput);
                      }}
                      className="text-[9px] text-blue-500 font-bold uppercase hover:underline cursor-pointer"
                    >
                      {isCustomLocInput ? "Select List" : "+ Enter Custom"}
                    </button>
                  </div>
                  {isCustomLocInput ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rack A5..."
                        value={addLoc}
                        onChange={e => setAddLoc(e.target.value)}
                        className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3 py-2.5 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (addLoc.trim()) {
                            if (onAddCustomLocation) {
                              onAddCustomLocation(addLoc.trim());
                            }
                            setIsCustomLocInput(false);
                            showToast(`Saved spot to Stock List: ${addLoc.trim()}`, "success");
                          }
                        }}
                        className="bg-emerald-600 text-white font-bold px-2 py-1 text-[9px] rounded-lg hover:bg-emerald-700 shrink-0 cursor-pointer"
                        title="Save to stock locations list"
                      >
                        Keep Spot
                      </button>
                    </div>
                  ) : (
                    <select
                      value={addLoc}
                      onChange={e => setAddLoc(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3 py-2.5 focus:outline-none"
                    >
                      {locations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={addPurchaseDate}
                    onChange={e => setAddPurchaseDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-stone-800 border border-gray-200 text-gray-800 dark:text-stone-100 rounded-xl px-3 py-2.5 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Siddhivinayak Spares India"
                    value={addSupplier}
                    onChange={e => setAddSupplier(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-stone-800 border border-gray-200 text-gray-800 dark:text-stone-100 rounded-xl px-3 py-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Current Status *
                  </label>
                  <select
                    value={addStatus}
                    onChange={e => setAddStatus(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-stone-800 border border-gray-200 text-gray-800 dark:text-stone-100 rounded-xl px-2.5 py-3"
                  >
                    <option value="In Stock">In Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                    <option value="Damaged">Damaged</option>
                    <option value="In Service / Repairing">In Service / Repairing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Additional Notes
                </label>
                <textarea
                  placeholder="e.g. Bulk lot imported with 1-year local warranty."
                  value={addNotes}
                  onChange={e => setAddNotes(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 border border-gray-200 text-gray-800 dark:text-stone-100 rounded-xl px-3 py-2.5 focus:outline-none h-16 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-750 text-white font-black text-xs py-3.5 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                id="btn-stock-save-catalog"
              >
                <FileCheck className="w-4 h-4" />
                Confirm Catalog Entry
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Level Modal (In/Out) */}
      {showAdjModal && selectedStockItem && (
        <div className="fixed inset-0 z-55 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white dark:bg-stone-900 rounded-2xl shadow-xl p-5 border border-slate-100 dark:border-stone-800 animate-slide-up">
            
            <div className="flex justify-between items-center text-left pb-3 border-b border-gray-100 dark:border-stone-800">
              <h4 className="text-sm font-black text-gray-800 dark:text-stone-200 uppercase flex items-center gap-1.5">
                <span>Add / Dispatch Stock adjustment</span>
              </h4>
              <button
                onClick={() => setShowAdjModal(false)}
                className="text-gray-400 hover:text-gray-650"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleAdjustStockConfirm} className="pt-4 space-y-4 text-left">
              <div className="flex bg-slate-100 dark:bg-stone-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAdjType("In")}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                    adjType === "In"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 inline mr-1 pointer-events-none" />
                  Stock In (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjType("Out")}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                    adjType === "Out"
                      ? "bg-rose-500 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5 inline mr-1 pointer-events-none" />
                  Stock Out (-)
                </button>
              </div>

              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  Adjusting Quantity
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={adjQty}
                  onChange={e => setAdjQty(Number(e.target.value))}
                  className="w-full text-xs font-mono bg-slate-50 dark:bg-stone-800 border border-gray-250 dark:border-stone-750 px-3 py-2 text-gray-800 dark:text-stone-100 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 font-bold">
                  Adjustment Log description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly replenishment, dispatched to repair table ds..."
                  value={adjNotes}
                  onChange={e => setAdjNotes(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 border border-gray-250 dark:border-stone-750 px-3 py-2 text-gray-800 dark:text-stone-100 rounded-xl focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer"
              >
                Log Transaction
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
          
          // Check for URL deep-linked item QR code or explicit SKU parameter first
          if (cleanText.includes("itemId=")) {
            const urlParts = cleanText.split("itemId=");
            if (urlParts.length > 1) {
              const parsedId = urlParts[1].split("&")[0];
              const found = inventory.find(i => i.id === parsedId);
              if (found) {
                setSelectedStockItem(found);
                setShowScannerModal(false);
                showToast(`📦 Scanned Direct Item QR: Opened details for ${found.productName}`, "success");
                return;
              }
            }
          }

          if (cleanText.includes("INVSRV-MODEL:")) {
            cleanText = cleanText.substring(cleanText.indexOf("INVSRV-MODEL:") + "INVSRV-MODEL:".length);
          } else if (cleanText.includes("INVSRV-SERIAL:")) {
            cleanText = cleanText.substring(cleanText.indexOf("INVSRV-SERIAL:") + "INVSRV-SERIAL:".length);
          } else if (cleanText.includes("INVSRV-LOCATION:")) {
            cleanText = cleanText.substring(cleanText.indexOf("INVSRV-LOCATION:") + "INVSRV-LOCATION:".length);
          }

          if (scannerDestination === "addModel") {
            setAddModel(cleanText);
            showToast(`⚙️ Model Scanned: ${cleanText}`, "success");
          } else if (scannerDestination === "addSerial") {
            setAddSerial(cleanText);
            showToast(`🆔 Serial Number Scanned: ${cleanText}`, "success");
          } else {
            setSearchTerm(cleanText);
            showToast(`🔍 Scanned code/query: ${cleanText}`, "success");
          }
          setShowScannerModal(false);
        }}
        title={
          scannerDestination === "addModel"
            ? "Scan Model Number QR/Barcode"
            : scannerDestination === "addSerial"
            ? "Scan Serial Number QR/Barcode"
            : "Scan Model/Serial identifier"
        }
        placeholder={
          scannerDestination === "addModel"
            ? "Place model barcode/QR in camera view"
            : scannerDestination === "addSerial"
            ? "Place serial barcode/QR in camera view"
            : "Or type model number, brand, S/N..."
        }
      />

      {/* Excel Export and Share Central Dialog UI */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl relative space-y-4 text-left animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar">
            
            {/* Modal close */}
            <button
              onClick={() => setShowExportModal(false)}
              className="absolute top-4.5 right-4.5 text-gray-400 hover:text-stone-700 dark:hover:text-stone-250 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title block */}
            <div>
              <span className="p-1 px-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8.5px] font-black uppercase tracking-widest whitespace-nowrap">
                📊 Excel Generation Desk
              </span>
              <h3 className="text-sm font-black text-gray-900 dark:text-white mt-1.5 uppercase font-sans tracking-tight">
                Share Stock Excel Report
              </h3>
            </div>

            {/* 1. REPORT FIELDS (COLUMNS LAYOUT) - USER FOCUS */}
            <div className="space-y-1">
              <span className="block text-[8px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-widest">
                1. Choose Columns Layout
              </span>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-stone-950 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setExportColumns("simplified")}
                  className={`py-2 px-1 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all select-none cursor-pointer ${
                    exportColumns === "simplified"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-gray-500 dark:text-stone-400 hover:text-gray-805"
                  }`}
                >
                  Simplified Spec
                </button>
                <button
                  type="button"
                  onClick={() => setExportColumns("all")}
                  className={`py-2 px-1 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all select-none cursor-pointer ${
                    exportColumns === "all"
                      ? "bg-slate-300 dark:bg-stone-800 text-gray-800 dark:text-stone-200 shadow-xs"
                      : "text-gray-500 dark:text-stone-400 hover:text-gray-805"
                  }`}
                >
                  Full Details
                </button>
              </div>
              <p className="text-[9px] text-gray-400 dark:text-stone-500 italic px-0.5 leading-tight">
                {exportColumns === "simplified"
                  ? "Exports exactly: Model Spec (Brand, Model, Name), Quantity & Primary Spot location."
                  : "Includes all details: IDs, Categories, Serial Numbers, Quality Alert thresholds."
                }
              </p>
            </div>

            {/* 2. CHOOSE ITEMS (EXPORT SCOPE) */}
            <div className="space-y-1">
              <span className="block text-[8px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-widest">
                2. Exporting Spares Scope
              </span>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-stone-950 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setExportScope("all")}
                  className={`py-2 px-1 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all select-none cursor-pointer ${
                    exportScope === "all"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-gray-500 dark:text-stone-400 hover:text-gray-805"
                  }`}
                >
                  All Matches
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedItemIds.length > 0) {
                      setExportScope("selected");
                    } else {
                      showToast("Please check items on list first!", "info");
                    }
                  }}
                  disabled={selectedItemIds.length === 0}
                  className={`py-2 px-1 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all select-none ${
                    selectedItemIds.length === 0
                      ? "opacity-40 text-gray-300 dark:text-stone-700 cursor-not-allowed"
                      : exportScope === "selected"
                      ? "bg-emerald-600 text-white shadow-xs cursor-pointer"
                      : "text-gray-500 dark:text-stone-400 hover:text-gray-855 cursor-pointer"
                  }`}
                >
                  Selected Only ({selectedItemIds.length})
                </button>
              </div>
              <p className="text-[9px] text-gray-400 dark:text-stone-500 italic px-0.5 leading-tight">
                {selectedItemIds.length === 0
                  ? "Toggle selection checkboxes in stock list to only export checked items."
                  : exportScope === "selected"
                  ? `Exactly ${selectedItemIds.length} checked spares will be exported.`
                  : "All matching spares in specified date scope will be exported."
                }
              </p>
            </div>

            {/* 3. REPORT CLASSIFICATION (LEDGER VS STORAGE BASE) */}
            {exportScope === "all" && (
              <div className="space-y-1">
                <span className="block text-[8px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-widest">
                  3. Select Report format
                </span>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-stone-950 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setReportType("ledger")}
                    className={`py-2 px-1 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all select-none cursor-pointer ${
                      reportType === "ledger"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-gray-500 dark:text-stone-400 hover:text-gray-805"
                    }`}
                  >
                    Movements Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportType("catalog")}
                    className={`py-2 px-1 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all select-none cursor-pointer ${
                      reportType === "catalog"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-gray-500 dark:text-stone-400 hover:text-gray-805"
                    }`}
                  >
                    Catalog Stocks
                  </button>
                </div>
                <p className="text-[9px] text-gray-400 dark:text-stone-500 italic px-0.5 leading-tight">
                  {reportType === "ledger" 
                    ? "Exports logged In/Out transactions with reasons, operators & times."
                    : "Exports static available spares catalog lists and alert status."
                  }
                </p>
              </div>
            )}

            {/* 4. DATE RANGE TIMEFRAME (ONLY SHOWN FOR ALL RANGE/SINGLE FILTER OR LEDGER) */}
            {(exportScope === "all" || reportType === "ledger") && (
              <>
                {/* Date Picker Mode: By day or Day-to-Day */}
                <div className="space-y-1.5">
                  <span className="block text-[8px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-widest">
                    {exportScope === "all" ? "4. Specify Period Option" : "3. Specify Transaction Logs Period"}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-stone-950 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDateMode("single")}
                      className={`py-1.5 text-[9.5px] font-black rounded-lg uppercase tracking-wider transition-all select-none cursor-pointer ${
                        dateMode === "single"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-gray-500 dark:text-stone-400 hover:text-gray-850"
                      }`}
                    >
                      By single Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateMode("range")}
                      className={`py-1.5 text-[9.5px] font-black rounded-lg uppercase tracking-wider transition-all select-none cursor-pointer ${
                        dateMode === "range"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-gray-500 dark:text-stone-400 hover:text-gray-850"
                      }`}
                    >
                      Day To Day Range
                    </button>
                  </div>
                </div>

                {/* Inputs based on selection */}
                <div className="bg-slate-50 dark:bg-stone-950 p-3 rounded-2xl border border-slate-105 dark:border-stone-850/40 space-y-2.5">
                  {dateMode === "single" ? (
                    <div>
                      <label className="block text-[8px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-widest mb-1">
                        Select target day:
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={singleDate}
                          onChange={e => setSingleDate(e.target.value)}
                          className="w-full text-xs font-mono bg-white dark:bg-stone-900 border border-slate-205 dark:border-stone-800 rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-500 text-gray-800 dark:text-stone-200"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-widest mb-1">
                            Start Day:
                          </label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full text-xs font-mono bg-white dark:bg-stone-900 border border-slate-205 dark:border-stone-800 rounded-xl px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-gray-800 dark:text-stone-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-widest mb-1">
                            End Day:
                          </label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full text-xs font-mono bg-white dark:bg-stone-900 border border-slate-205 dark:border-stone-800 rounded-xl px-2 py-1.5 focus:outline-none text-gray-800 dark:text-stone-200"
                          />
                        </div>
                      </div>

                      {/* Preset Buttons for day ranges */}
                      <div className="flex gap-1 overflow-x-auto select-none no-scrollbar pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            setStartDate(d.toISOString().substring(0, 10));
                            setEndDate(d.toISOString().substring(0, 10));
                          }}
                          className="bg-white dark:bg-stone-900 text-gray-600 dark:text-stone-300 border border-slate-200 dark:border-stone-800 text-[8px] font-black px-2 py-1 rounded-lg uppercase whitespace-nowrap cursor-pointer hover:bg-slate-50"
                        >
                          Today Only
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 1);
                            const yesStr = d.toISOString().substring(0, 10);
                            setStartDate(yesStr);
                            setEndDate(yesStr);
                          }}
                          className="bg-white dark:bg-stone-900 text-gray-600 dark:text-stone-300 border border-slate-200 dark:border-stone-800 text-[8px] font-black px-2 py-1 rounded-lg uppercase whitespace-nowrap cursor-pointer hover:bg-slate-50"
                        >
                          Yesterday
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 7);
                            setStartDate(d.toISOString().substring(0, 10));
                            setEndDate(new Date().toISOString().substring(0, 10));
                          }}
                          className="bg-white dark:bg-stone-900 text-gray-600 dark:text-stone-300 border border-slate-200 dark:border-stone-800 text-[8px] font-black px-2 py-1 rounded-lg uppercase whitespace-nowrap cursor-pointer hover:bg-slate-50"
                        >
                          Last 7 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            setStartDate(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01");
                            setEndDate(new Date().toISOString().substring(0, 10));
                          }}
                          className="bg-white dark:bg-stone-900 text-gray-600 dark:text-stone-300 border border-slate-200 dark:border-stone-800 text-[8px] font-black px-2 py-1 rounded-lg uppercase whitespace-nowrap cursor-pointer hover:bg-slate-50"
                        >
                          This Month
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Dynamic Status Counter */}
            <div className={`p-2.5 rounded-2xl flex items-center justify-between text-xs font-black ${
              matchingCount > 0 
                ? "bg-emerald-500/5 border border-emerald-500/10 text-emerald-800 dark:text-emerald-400"
                : "bg-red-500/5 border border-red-500/10 text-rose-600 dark:text-rose-400"
            }`}>
              <div className="flex items-center gap-1.5 uppercase tracking-wide text-[9.5px]">
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>Computed match records:</span>
              </div>
              <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10">
                {matchingCount} items
              </span>
            </div>

            {/* Actions for output downloads and shares */}
            <div className="space-y-1.5 select-none pt-1">
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-[10px] uppercase tracking-wider py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-97 transition-all cursor-pointer"
                disabled={matchingCount === 0}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Excel Sheet</span>
              </button>

              <button
                type="button"
                onClick={handleShareReport}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-[10px] uppercase tracking-wider py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs active:scale-97 transition-all cursor-pointer"
                disabled={matchingCount === 0}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Excel Sheet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable QR code sticker modal */}
      {qrStickerItem && (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="bg-white dark:bg-stone-900 border border-gray-150 dark:border-stone-850 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative space-y-4 text-left animate-slide-up">
            
            {/* Modal close */}
            <button
              onClick={() => setQrStickerItem(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-stone-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[9px] font-black tracking-widest text-indigo-600 dark:text-indigo-400 uppercase font-mono">
                Physical Adhesive Sticker
              </span>
              <h3 className="text-sm font-black text-gray-800 dark:text-stone-100">
                Printable Product QR Passport
              </h3>
            </div>

            {/* Sticker simulator frame */}
            <div className="border border-dashed border-gray-200 dark:border-stone-800 rounded-2xl p-5 bg-stone-50 dark:bg-stone-950/40 relative overflow-hidden flex flex-col items-center text-center">
              {/* Zebra/Dotted background corners to simulate adhesive tag */}
              <div className="absolute top-2 left-2 text-[8px] font-mono text-gray-400 dark:text-stone-600 uppercase font-bold tracking-widest">
                STOCKIVO IDR
              </div>
              <div className="absolute top-2 right-2 text-[8px] font-mono text-gray-400 dark:text-stone-600 uppercase font-bold">
                SYSTEM TAG
              </div>

              {/* Main Product QR */}
              <div className="p-2 border border-gray-100 dark:border-stone-800 bg-white rounded-xl shadow-xs mt-3 select-all">
                <img
                  src={generateQRUrl(`${window.location.origin}/?tab=stock&itemId=${qrStickerItem.id}`, "160x160")}
                  alt="Stock Product QR sticker"
                  className="w-36 h-36 border-0 object-contain pointer-events-none bg-white rounded"
                />
              </div>

              {/* Item Info inside sticker */}
              <div className="mt-3.5 space-y-1.5 w-full">
                <div className="text-[10px] font-mono font-black uppercase text-indigo-650 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400 py-0.5 px-2 rounded inline-block">
                  SKU: {qrStickerItem.id}
                </div>
                <h4 className="text-xs font-black text-gray-800 dark:text-stone-100 px-3 truncate w-full">
                  {qrStickerItem.brand} - {qrStickerItem.productName}
                </h4>
                <div className="text-[9px] text-gray-500 dark:text-stone-400 font-medium leading-normal">
                  Model: <span className="font-mono text-gray-700 dark:text-stone-300">{qrStickerItem.modelNo || "N/A"}</span><br />
                  Storage Loc: <span className="font-extrabold text-[#059669] dark:text-emerald-400">📍 {qrStickerItem.location}</span>
                </div>
              </div>

              {/* Holographic simulated line */}
              <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-gray-200 dark:via-stone-800 to-transparent my-3"></div>

              <div className="text-[8px] font-mono text-gray-400 dark:text-stone-500 font-bold uppercase tracking-wider leading-none">
                Scan using camera to auto-redirect
              </div>
            </div>

            {/* Sticker specific print commands */}
            <div className="space-y-2">
              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?tab=stock&itemId=${qrStickerItem.id}`);
                    showToast("📋 Direct Item Deep link copied to clipboard!", "success");
                  }}
                  className="flex-1 bg-slate-50 dark:bg-stone-850 hover:bg-slate-100 dark:hover:bg-stone-200 text-gray-700 dark:text-stone-200 border border-slate-200 dark:border-stone-800 font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer select-none active:scale-95 text-center"
                >
                  Copy Deep Link
                </button>
                <button
                  onClick={() => {
                    const printUrl = generateQRUrl(`${window.location.origin}/?tab=stock&itemId=${qrStickerItem.id}`, "300x300");
                    const printWin = window.open(printUrl, "_blank");
                    if (printWin) {
                      showToast("🖨️ Opened High-Res sticker image for printing!", "success");
                    } else {
                      showToast("⚠️ Pop-up blocked! Right click image to save & print.", "info");
                    }
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer select-none active:scale-95 flex items-center justify-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Save / Print QR
                </button>
              </div>
              <p className="text-[8px] text-center text-gray-400 dark:text-stone-500 leading-none py-1 truncate">
                Deep link coordinates: {window.location.origin}/?itemId={qrStickerItem.id}
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
