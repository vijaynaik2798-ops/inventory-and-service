import React, { useState, useMemo } from "react";
import QRScannerModal from "./QRScannerModal";
import { InventoryItem } from "../types";
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
  FileSpreadsheet
} from "lucide-react";
import { formatDateTime, generateQRUrl } from "../utils/helpers";

interface StockTabProps {
  inventory: InventoryItem[];
  currentUser: any;
  onAddInventoryItem: (item: Omit<InventoryItem, "id" | "history" | "createdAt">) => void;
  onUpdateInventoryItem: (item: InventoryItem) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export default function StockTab({
  inventory,
  currentUser,
  onAddInventoryItem,
  onUpdateInventoryItem,
  showToast
}: StockTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Scanner simulation states style
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

  // Selection states
  const [selectedStockItem, setSelectedStockItem] = useState<InventoryItem | null>(null);

  // AI Audit States
  const [isAuditingInventory, setIsAuditingInventory] = useState(false);
  const [aiAuditReport, setAiAuditReport] = useState<{
    criticalAlerts: string[];
    restockRecommendations: string[];
    strategicAdvice: string;
  } | null>(null);
  const [showAiAuditPanel, setShowAiAuditPanel] = useState(false);

  // Excel Sharing & Report states
  const [showExportModal, setShowExportModal] = useState(false);
  const [reportType, setReportType] = useState<"ledger" | "catalog">("ledger");
  const [dateMode, setDateMode] = useState<"single" | "range">("range");
  
  const todayYMD = useMemo(() => new Date().toISOString().substring(0, 10), []);
  const [singleDate, setSingleDate] = useState(todayYMD);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState(todayYMD);

  // Compute matched items count dynamically
  const matchingCount = useMemo(() => {
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
  }, [inventory, reportType, dateMode, singleDate, startDate, endDate]);

  const generateCSVData = () => {
    const isLedger = reportType === "ledger";
    const rows: string[][] = [];
    
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
      
      inventory.forEach(item => {
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
      
      inventory.forEach(item => {
        const itemDate = item.createdAt ? item.createdAt.substring(0, 10) : "";
        
        let match = false;
        if (dateMode === "single") {
          match = itemDate === singleDate;
        } else {
          match = itemDate >= startDate && itemDate <= endDate;
        }
        
        if (match) {
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
        }
      });
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
  const [addCat, setAddCat] = useState("CCTV Bullet Camera");
  const [addModel, setAddModel] = useState("");
  const [addSerial, setAddSerial] = useState("");
  const [addQty, setAddQty] = useState(10);
  const [addMinQty, setAddMinQty] = useState(5);
  const [addLoc, setAddLoc] = useState("Store Room");

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

    onAddInventoryItem({
      productName: addProd,
      brand: addBrand || "Generic",
      category: addCat,
      modelNo: addModel,
      serialNo: addSerial,
      quantity: Number(addQty),
      minQuantity: Number(addMinQty),
      location: addLoc
    });

    // Reset Form
    setAddProd("");
    setAddBrand("");
    setAddCat("CCTV Bullet Camera");
    setAddModel("");
    setAddSerial("");
    setAddQty(10);
    setAddMinQty(5);
    setAddLoc("Store Room");
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
            id="btn-stock-add"
          >
            <Plus className="w-4 h-4" />
            <span>Add Stock</span>
          </button>
          
          <button
            onClick={handleRunInventoryAudit}
            className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black p-2.5 rounded-xl flex items-center gap-1 text-xs cursor-pointer shadow-sm transition-all whitespace-nowrap"
            id="btn-stock-ai-audit"
          >
            <span>✨ AI Audit</span>
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="bg-[#0f172a] dark:bg-stone-800 hover:bg-slate-900 dark:hover:bg-stone-700 active:scale-95 text-white font-black p-2.5 rounded-xl flex items-center gap-1 text-xs cursor-pointer shadow-sm transition-all whitespace-nowrap"
            id="btn-stock-excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>📊 Excel Report</span>
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
            return (
              <div
                key={item.id}
                onClick={() => setSelectedStockItem(item)}
                className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800/80 p-3.5 rounded-xl text-left shadow-sm hover:border-emerald-500/20 dark:hover:border-emerald-500/10 cursor-pointer hover:shadow-md transition-all active:scale-99 flex justify-between items-center relative overflow-hidden"
              >
                {isLow && (
                  <div className="absolute top-0 right-0 left-0 h-[2px] bg-amber-500"></div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
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

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                    isLow
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 animate-pulse border border-rose-300/25"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
                  }`}>
                    Qty: {item.quantity}
                  </span>

                  {isLow && (
                    <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 px-1.5 py-0.5 rounded uppercase">
                      <AlertTriangle className="w-2.5 h-2.5" /> LOW
                    </span>
                  )}
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
                  placeholder="e.g. CP Plus, Dahua, Bosch..."
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
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Model Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="DS-2CE16..."
                    value={addModel}
                    onChange={e => setAddModel(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3 py-2.5 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Serial Number (S/N) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="HK-192..."
                    value={addSerial}
                    onChange={e => setAddSerial(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3 py-2.5 focus:outline-none"
                  />
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
                    <option value="CCTV Dome Camera">CCTV Dome Camera</option>
                    <option value="CCTV Bullet Camera">CCTV Bullet Camera</option>
                    <option value="DVR Receiver">DVR Receiver</option>
                    <option value="NVR Receiver">NVR Receiver</option>
                    <option value="Hard Disk Drive">Hard Disk Drive</option>
                    <option value="PoE Switch">PoE Switch</option>
                    <option value="WiFi Router">WiFi Router</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Spot Location
                  </label>
                  <input
                    type="text"
                    required
                    value={addLoc}
                    onChange={e => setAddLoc(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-stone-800 border border-gray-200 rounded-xl px-3 py-2.5"
                  />
                </div>
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
          if (cleanText.includes("INVSRV-MODEL:")) {
            cleanText = cleanText.substring(cleanText.indexOf("INVSRV-MODEL:") + "INVSRV-MODEL:".length);
          } else if (cleanText.includes("INVSRV-SERIAL:")) {
            cleanText = cleanText.substring(cleanText.indexOf("INVSRV-SERIAL:") + "INVSRV-SERIAL:".length);
          } else if (cleanText.includes("INVSRV-LOCATION:")) {
            cleanText = cleanText.substring(cleanText.indexOf("INVSRV-LOCATION:") + "INVSRV-LOCATION:".length);
          }
          setSearchTerm(cleanText);
          showToast(`🔍 Scanned code/query: ${cleanText}`, "success");
        }}
        title="Scan Model/Serial identifier"
        placeholder="Or type model number, brand, S/N..."
      />

      {/* Excel Export and Share Central Dialog UI */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl relative space-y-4 text-left animate-slide-up">
            
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

            {/* Report Type selector: Logs movement vs static lists */}
            <div className="space-y-1">
              <span className="block text-[8px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-widest">
                1. Select Report format
              </span>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-stone-950 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setReportType("ledger")}
                  className={`py-2 px-1 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all select-none cursor-pointer ${
                    reportType === "ledger"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-gray-500 dark:text-stone-400 hover:text-gray-800"
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
                      : "text-gray-500 dark:text-stone-400 hover:text-gray-800"
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

            {/* Date Picker Mode: By day or Day-to-Day */}
            <div className="space-y-1.5">
              <span className="block text-[8px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-widest">
                2. Specify Period Option
              </span>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-stone-950 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDateMode("single")}
                  className={`py-1.5 text-[9.5px] font-black rounded-lg uppercase tracking-wider transition-all select-none cursor-pointer ${
                    dateMode === "single"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-gray-500 dark:text-stone-400 hover:text-gray-800"
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
                      : "text-gray-500 dark:text-stone-400 hover:text-gray-800"
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

    </div>
  );
}
