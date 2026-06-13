/**
 * Inventory Service Application Helpers
 */

import { Customer, ServiceJob, ServiceItem, InventoryItem } from "../types";

/**
 * Format currency to Indian Rupees (standard for INR and local CCTV businesses in general)
 */
export const formatCurrency = (amt: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amt);
};

/**
 * Format date nicely
 */
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch (e) {
    return dateStr;
  }
};

export const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (e) {
    return dateStr;
  }
};

/**
 * Generate QR code URL using api.qrserver.com
 */
export const generateQRUrl = (data: string, size = "200x200"): string => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(data)}`;
};

/**
 * Generate a device detail block for WhatsApp message templates
 */
export const buildDeviceBlock = (items: ServiceItem[]): string => {
  return items
    .map((item, idx) => {
      const accList = Object.entries(item.accessories)
        .filter(([_, value]) => value)
        .map(([name]) => name)
        .join(", ");
      
      const repList = item.replacements.length > 0
        ? `    Replaced Parts: ${item.replacements.map(r => `${r.partName} (New S/N: ${r.newSerial})`).join("; ")}`
        : "";

      const burntInfo = item.isBurnt
        ? `    🔥 Burnt Damage: ${item.burntDetails || "High voltage/Surge damage logged"}`
        : "";

      const replacementInfo = item.isProductReplaced
        ? `    🔄 Unit Replaced: Model \`${item.replacementModelNo || item.modelNo}\` | S/N \`${item.replacementSerialNo}\``
        : "";

      const extraLines = [repList, burntInfo, replacementInfo].filter(Boolean).join("\n");

      return `${idx + 1}. *DS: ${item.productName}* (${item.brand})
    M/N: \`${item.modelNo}\` | S/N: \`${item.serialNo}\`
    Prob: ${item.problemDescription || "None"}
    Accs: ${accList || "None"}
    Location: ${item.currentLocation}
    Fee: ₹${item.total}${extraLines ? `\n${extraLines}` : ""}`;
    })
    .join("\n\n");
};

/**
 * Parse and substitute WhatsApp template variables
 */
export const compileWhatsAppMessage = (
  template: string,
  customer: Customer,
  job: ServiceJob,
  specificItems?: ServiceItem[]
): string => {
  // Determine which items to use (specific items or all in the job)
  const itemsToRender = specificItems || job.items;
  const deviceBlock = buildDeviceBlock(itemsToRender);
  const total = itemsToRender.reduce((sum, item) => sum + item.total, 0);

  // Status is defined as either the unique status if single-item or overall comma-separated
  const uniqueStatuses = Array.from(new Set(itemsToRender.map(i => i.status))).join(", ");

  let msg = template;
  msg = msg.replaceAll("{{customerName}}", customer.name);
  msg = msg.replaceAll("{{jobNo}}", job.id);
  msg = msg.replaceAll("{{date}}", formatDate(job.date));
  msg = msg.replaceAll("{{deviceBlock}}", deviceBlock);
  msg = msg.replaceAll("{{grandTotal}}", total.toString());
  msg = msg.replaceAll("{{status}}", uniqueStatuses);

  return msg;
};

/**
 * Build WhatsApp click-to-chat API url
 */
export const getWhatsAppClickUrl = (phone: string, text: string): string => {
  // Clean phone number: remove non-digits, and append prefix if not present
  let cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length === 10) {
    cleanPhone = "91" + cleanPhone; // Default to India prefix if exactly 10 digits
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
};

/**
 * Export Customers to CSV format
 */
export const convertCustomersToCSV = (customers: Customer[]): string => {
  const headers = ["ID", "Name", "Phone", "Address", "Notes", "Created At"];
  const rows = customers.map(c => [
    c.id,
    c.name,
    c.phone,
    c.address.replace(/"/g, '""'),
    c.notes.replace(/"/g, '""'),
    c.createdAt
  ]);
  
  return [headers, ...rows].map(r => r.map(val => `"${val}"`).join(",")).join("\n");
};

/**
 * Export Jobs to CSV format
 */
export const convertJobsToCSV = (jobs: ServiceJob[], customers: Customer[]): string => {
  const headers = [
    "Job No",
    "Customer Name",
    "Customer Phone",
    "Items Count",
    "Grand Total",
    "Paid Amount",
    "Payment Status",
    "Payment Method",
    "Paid Date",
    "Created At",
    "Device Breakdown (Product | Brand | Serial | Status | Cost)"
  ];

  const rows = jobs.map(j => {
    const cust = customers.find(c => c.id === j.customerId);
    const breakdown = j.items
      .map(
        item =>
          `${item.productName} (${item.brand}) | S/N: ${item.serialNo} | Status: ${item.status} | Cost: ${item.total}`
      )
      .join(" ;; ");

    return [
      j.id,
      cust ? cust.name : "Unknown",
      cust ? cust.phone : "-",
      j.items.length,
      j.grandTotal,
      j.paidAmount,
      j.paymentStatus,
      j.paymentMethod,
      j.paidDate || "",
      j.createdAt,
      breakdown.replace(/"/g, '""')
    ];
  });

  return [headers, ...rows].map(r => r.map(val => `"${val}"`).join(",")).join("\n");
};

/**
 * Export Inventory to CSV format
 */
export const convertInventoryToCSV = (inventory: InventoryItem[]): string => {
  const headers = ["ID", "Product Name", "Brand", "Category", "Model No", "Serial No", "Qty", "Min Qty", "Location", "Created At"];
  const rows = inventory.map(item => [
    item.id,
    item.productName.replace(/"/g, '""'),
    item.brand,
    item.category,
    item.modelNo,
    item.serialNo,
    item.quantity,
    item.minQuantity,
    item.location,
    item.createdAt
  ]);

  return [headers, ...rows].map(r => r.map(val => `"${val}"`).join(",")).join("\n");
};

/**
 * Export helper triggers download
 */
export const triggerCSVDownload = (content: string, fileName: string): void => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Compile a detailed WhatsApp message containing status tracking link and material details
 */
export const compileTrackingMessage = (
  customer: Customer,
  job: ServiceJob,
  appUrl: string
): string => {
  const trackingLink = `${appUrl}?track=${job.id}`;
  
  // Emojis mapping for status
  const getStatusEmoji = (status: string) => {
    switch (status) {
      case "Delivered": return "🚚";
      case "Completed": return "✅";
      case "Waiting for Parts": return "🔧";
      case "Repairing": return "🛠️";
      case "Under Inspection": return "🔍";
      case "Received": default: return "📥";
    }
  };

  const itemLines = job.items.map((item, idx) => {
    const emoji = getStatusEmoji(item.status);
    let details = `${idx + 1}. *${item.productName}* (${item.brand})\n   Status: ${emoji} *${item.status}*`;
    if (item.serialNo) details += `\n   S/N: \`${item.serialNo}\``;
    if (item.isBurnt) details += `\n   ⚠️ _Damage Alert: ${item.burntDetails || "Burnt tracks/IC damage logged."}_`;
    return details;
  }).join("\n\n");

  const pendingItems = job.items.filter(item => item.status !== "Completed" && item.status !== "Delivered");
  let pendingBlock = "";
  if (pendingItems.length === 0) {
    pendingBlock = "🎉 *ALL ITEMS REPAIRED & READY OVERVIEW!*";
  } else {
    pendingBlock = `⚠️ *PENDING ITEMS STATUS (${pendingItems.length} in progress):*\n` +
      pendingItems.map((item) => {
        const emoji = getStatusEmoji(item.status);
        let note = `• *${item.productName}* (${item.status} ${emoji})`;
        if (item.status === "Waiting for Parts") {
          note += `\n  ↳ _Waiting for spare components_`;
        }
        return note;
      }).join("\n");
  }

  return `*🛠️ SERVICE JOB TRACKING UPDATE*\n\n` +
    `*Ticket:* #${job.id}\n` +
    `*Customer:* ${customer.name}\n` +
    `*Date:* ${formatDate(job.date)}\n\n` +
    `*📋 RECEIVED MATERIALS STATUS:*\n` +
    `${itemLines}\n\n` +
    `${pendingBlock}\n\n` +
    `🔗 *Track live progress on your phone:*\n` +
    `${trackingLink}\n\n` +
    `_Thank you for choosing our services! We are dedicated to providing the best resolution._`;
};
