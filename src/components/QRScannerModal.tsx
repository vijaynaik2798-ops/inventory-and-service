import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, RefreshCw, AlertCircle, Barcode, HelpCircle } from "lucide-react";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
  placeholder?: string;
}

export default function QRScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = "Scan QR / Barcode Code",
  placeholder = "Or type/paste manually..."
}: QRScannerModalProps) {
  const [scannedInput, setScannedInput] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const elementId = "live-qr-scanner-viewport";

  // Vibration on successful scan
  const triggerHapticFeedback = () => {
    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(100);
      } catch (e) {
        // Safe fail
      }
    }
  };

  const getMockPresetsForContext = () => {
    const t = title.toLowerCase();
    if (t.includes("pair") || t.includes("link") || t.includes("device")) {
      return [
        { label: "Pair Chrome - macOS (Corporate HQ)", code: "STOCKIVO-LINK:BROWSER_CHROME_MAC" },
        { label: "Pair Safari - iPad Pro (Chennai Shop Front)", code: "STOCKIVO-LINK:TABLET_SAFARI_FRONT" },
        { label: "Pair Firefox - Linux (CCTV Monitor Terminal)", code: "STOCKIVO-LINK:MONITOR_FIREFOX_TERM" }
      ];
    }
    if (t.includes("customer")) {
      return [
        { label: "Ramesh Naik (CUST-101)", code: "INVSRV-CUSTOMER:CUST-101" },
        { label: "Pooja Hegde (CUST-102)", code: "INVSRV-CUSTOMER:CUST-102" },
        { label: "Vikram Dev (CUST-103)", code: "INVSRV-CUSTOMER:CUST-103" }
      ];
    }
    if (t.includes("model") || t.includes("part")) {
      return [
        { label: "CP Plus Dome Camera", code: "INVSRV-MODEL:CP-IP-DOME-50" },
        { label: "Dahua Bullet Camera", code: "INVSRV-MODEL:DAHUA-BULLET-4K" },
        { label: "TP-Link PoE Switch 8p", code: "INVSRV-MODEL:TP-LINK-POE-8" },
        { label: "Seagate SkyHawk 2TB HDD", code: "INVSRV-MODEL:SEAGATE-SKYHAWK-2TB" }
      ];
    }
    if (t.includes("location") || t.includes("spot")) {
      return [
        { label: "Shelf A (Main Rack)", code: "INVSRV-LOCATION:SHELF-A" },
        { label: "Repair Bench 2", code: "INVSRV-LOCATION:WORKBENCH-2" },
        { label: "QC Test Zone", code: "INVSRV-LOCATION:QC-TEST" },
        { label: "Dispatch Bay 3", code: "INVSRV-LOCATION:DISPATCH-3" }
      ];
    }
    // Generic fallback or job card
    return [
      { label: "Active Ticket JOB-8101", code: "INVSRV-JOBCARD:JOB-8101" },
      { label: "Active Ticket JOB-8102", code: "INVSRV-JOBCARD:JOB-8102" },
      { label: "CP Plus Dome model", code: "INVSRV-MODEL:CP-IP-DOME-50" },
      { label: "Main Shelf A", code: "INVSRV-LOCATION:SHELF-A" }
    ];
  };

  // Enumerate cameras and check permissions
  useEffect(() => {
    if (!isOpen) return;

    let stopped = false;
    setIsInitializing(true);
    setScanError(null);

    // Prompt for permissions and list cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (stopped) return;
        setHasPermission(true);
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer environment camera or the first device/camera
          const backCamera = devices.find(d => 
            d.label.toLowerCase().includes("back") || 
            d.label.toLowerCase().includes("environment") || 
            d.label.toLowerCase().includes("rear")
          );
          setActiveCameraId(backCamera ? backCamera.id : devices[0].id);
        } else {
          setScanError("No compatible video capture cameras detected.");
        }
        setIsInitializing(false);
      })
      .catch((err) => {
        if (stopped) return;
        console.warn("Camera access failed gracefully in sandbox:", err);
        setHasPermission(false);
        setIsInitializing(false);
        setScanError(`Camera access unavailable: ${err.message || err}. Use simulated inputs instead.`);
      });

    return () => {
      stopped = true;
    };
  }, [isOpen]);

  // Start QR Code Scanning Hook
  useEffect(() => {
    if (!isOpen || isInitializing) return;

    const html5QrCode = new Html5Qrcode(elementId);
    qrCodeInstanceRef.current = html5QrCode;

    const qrCodeSuccessCallback = (decodedText: string) => {
      triggerHapticFeedback();
      onScanSuccess(decodedText);
      onClose();
    };

    const config = {
      fps: 15,
      qrbox: (width: number, height: number) => {
        // Return a box size matching the aspect ratio of the viewport
        const minSize = Math.min(width, height);
        const qrBoxSize = Math.floor(minSize * 0.72);
        return { width: qrBoxSize, height: qrBoxSize };
      },
      aspectRatio: 1.0
    };

    // Trigger start selection
    const cameraParam = activeCameraId 
      ? { deviceId: { exact: activeCameraId } }
      : { facingMode };

    html5QrCode.start(
      cameraParam,
      config,
      qrCodeSuccessCallback,
      () => {
        // Verbose error logs in background can be ignored to avoid terminal spam
      }
    ).catch((err) => {
      console.warn("Failed to launch html5-qrcode scanner:", err);
      // Fallback or retry with facingMode if deviceId selection fails
      if (activeCameraId) {
        html5QrCode.start(
          { facingMode },
          config,
          qrCodeSuccessCallback,
          () => {}
        ).catch((fallbackErr) => {
          setScanError(`Camera Feed Interrupted: ${fallbackErr.message || fallbackErr}`);
        });
      } else {
        setScanError(`Camera Feed Interrupted: ${err.message || err}`);
      }
    });

    return () => {
      if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
        qrCodeInstanceRef.current.stop()
          .catch((err) => console.warn("Error stopping qr scanner gracefully:", err));
      }
    };
  }, [isOpen, isInitializing, activeCameraId, facingMode]);

  if (!isOpen) return null;

  // Toggle between available camera streams
  const handleToggleCamera = () => {
    if (cameras.length > 1) {
      const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      setActiveCameraId(cameras[nextIndex].id);
    } else {
      // Toggle string facing mode
      const newMode = facingMode === "environment" ? "user" : "environment";
      setFacingMode(newMode);
      setActiveCameraId(null);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scannedInput.trim()) {
      onScanSuccess(scannedInput.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in text-left">
      <div className="w-full max-w-sm bg-white dark:bg-stone-900 rounded-3xl border border-gray-100 dark:border-stone-850 shadow-2xl p-5 space-y-4 flex flex-col max-h-[90vh]">
        
        {/* Header Block */}
        <div className="flex justify-between items-center text-left">
          <div>
            <span className="text-[9px] uppercase font-bold text-blue-500 dark:text-blue-400 tracking-widest block leading-none mb-1">
              Live Assets Camera Scanner
            </span>
            <h4 className="text-sm font-black text-gray-800 dark:text-stone-100">
              {title}
            </h4>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-50 hover:bg-slate-100 dark:bg-stone-800 dark:hover:bg-stone-750 text-gray-400 dark:text-stone-300 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Frame */}
        <div className="relative aspect-square w-full bg-stone-950 rounded-2xl overflow-hidden shadow-inner flex flex-col items-center justify-center border border-gray-200/20">
          
          {/* HTML5 Qrcode integration div */}
          <div 
            id={elementId} 
            className={`absolute inset-0 w-full h-full object-cover z-0 [&_video]:object-cover [&_video]:w-full [&_video]:h-full`}
          />

          {/* Interactive Guidelines Layer */}
          {hasPermission && !scanError && (
            <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4">
              <div className="flex justify-between">
                <div className="w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                <div className="w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
              </div>
              
              {/* Scan Center Overlay Guideline */}
              <div className="self-center w-4/5 border border-dashed border-white/30 rounded-lg aspect-square flex items-center justify-center">
                <div className="w-full h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.85)] animate-pulse" />
              </div>

              <div className="flex justify-between">
                <div className="w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                <div className="w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
              </div>
            </div>
          )}

          {/* Loading / Diagnostic Feedback / Permission status message */}
          {isInitializing && (
            <div className="absolute inset-0 bg-stone-950 flex flex-col items-center justify-center text-center p-4 z-20 space-y-2">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">
                Checking Camera Feeds...
              </p>
            </div>
          )}

          {scanError && (
            <div className="absolute inset-0 bg-stone-950 flex flex-col items-center justify-center p-5 z-20 overflow-y-auto">
              <div className="w-full space-y-3">
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-[9.5px] font-black text-amber-500 uppercase tracking-wide">
                    Camera access unavailable in preview
                  </span>
                </div>
                
                <p className="text-[10px] text-stone-400 leading-normal font-medium text-left">
                  We've enabled our built-in <strong>Virtual QR Card Simulator</strong>. Tap a code below to instantly trigger scan success:
                </p>

                <div className="grid grid-cols-1 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {getMockPresetsForContext().map((preset, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        triggerHapticFeedback();
                        onScanSuccess(preset.code);
                        onClose();
                      }}
                      className="text-left text-xs bg-stone-900 hover:bg-stone-850 border border-stone-800 p-2 text-stone-200 rounded-xl flex justify-between items-center transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white leading-tight">{preset.label}</span>
                        <span className="text-[8px] font-mono text-blue-400 mt-0.5">{preset.code}</span>
                      </div>
                      <span className="text-[8px] font-black bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 font-sans">
                        ⚡ Tap
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Camera Control actions footer */}
        {hasPermission && !scanError && (cameras.length > 1 || facingMode) && (
          <div className="flex justify-between items-center bg-slate-50 dark:bg-stone-850 p-2 px-3 rounded-xl">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-gray-500 dark:text-stone-400 shrink-0" />
              <span className="text-[10px] font-extrabold text-gray-600 dark:text-stone-300 uppercase truncate max-w-[150px]">
                {cameras.find(c => c.id === activeCameraId)?.label || `Camera Mode: ${facingMode}`}
              </span>
            </div>
            
            <button
              onClick={handleToggleCamera}
              className="flex items-center gap-1.5 p-1.5 px-3 bg-white dark:bg-stone-900 hover:bg-slate-100 dark:hover:bg-stone-800 border border-gray-150 dark:border-stone-800 rounded-lg text-[9px] font-black text-gray-700 dark:text-stone-300 tracking-wider uppercase transition-all cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 text-blue-500" />
              <span>Flip Camera</span>
            </button>
          </div>
        )}

        {/* Manual Fallback input form */}
        <form onSubmit={handleManualSubmit} className="space-y-2">
          <label className="block text-[8px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest text-left">
            Keyboard Manual Input entry or scanner paste
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder={placeholder}
              value={scannedInput}
              onChange={e => setScannedInput(e.target.value)}
              className="flex-1 text-xs p-2.5 bg-slate-50 dark:bg-stone-850 font-mono text-gray-800 dark:text-stone-100 border border-gray-150 dark:border-stone-800 rounded-xl focus:outline-none focus:border-blue-500 transition-all uppercase"
            />
            <button
              type="submit"
              disabled={!scannedInput.trim()}
              className="bg-blue-600 hover:bg-blue-700 transition-colors text-white font-black text-[10px] uppercase px-4 rounded-xl cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              Apply
            </button>
          </div>
        </form>

        <div className="text-center">
          <span className="text-[8.5px] text-gray-400 dark:text-stone-500 leading-relaxed inline-flex items-center gap-1">
            <HelpCircle className="w-3 h-3 shrink-0" />
            <span>Point safety line at QR code card to decode directly!</span>
          </span>
        </div>

      </div>
    </div>
  );
}
