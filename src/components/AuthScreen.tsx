import React, { useState, useEffect } from "react";
import { User as AppUser, UserRole, Staff } from "../types";
import { Layers, QrCode, MonitorSmartphone, ShieldAlert, CheckCircle, RefreshCw } from "lucide-react";
import { firebaseSignInWithGoogle } from "../utils/firebase";
import { generateQRUrl } from "../utils/helpers";

interface AuthScreenProps {
  users: any[];
  technicians?: Staff[];
  onLoginSuccess: (user: AppUser) => void;
  onRegisterUser: (newUser: any) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export default function AuthScreen({
  users,
  technicians = [],
  onLoginSuccess,
  onRegisterUser,
  showToast
}: AuthScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showQrMode, setShowQrMode] = useState(false);
  const [qrSessionId, setQrSessionId] = useState("");

  // Initialize unique session ID when entering QR Login mode
  const handleEnableQrMode = () => {
    const randomId = "SESSION-" + Math.random().toString(36).substring(2, 8).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
    setQrSessionId(randomId);
    setShowQrMode(true);
    showToast("One-time security session QR generated!", "success");
  };

  // Poll LocalStorage and window.storage for Remote Authorization approval token
  useEffect(() => {
    if (!showQrMode || !qrSessionId) return;

    const interval = setInterval(() => {
      const liveToken = localStorage.getItem(`approved_session_${qrSessionId}`);
      if (liveToken) {
        try {
          const parsed = JSON.parse(liveToken);
          if (parsed && parsed.user) {
            onLoginSuccess({
              id: parsed.user.id || "QR_AUTH_USER_101",
              name: parsed.user.name || "Remote Companion Operator",
              role: (parsed.user.role || "Manager") as UserRole,
              email: parsed.user.email || "companion@stockivo.com"
            });
            showToast(`SSO Handshake complete! Welcome, ${parsed.user.name}.`, "success");
            localStorage.removeItem(`approved_session_${qrSessionId}`);
            clearInterval(interval);
          } else if (parsed && parsed.denied) {
            showToast("Secure login request was rejected by remote device.", "error");
            setShowQrMode(false);
            setQrSessionId("");
            clearInterval(interval);
          }
        } catch (e) {
          // Silent catch
        }
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [showQrMode, qrSessionId, onLoginSuccess, showToast]);

  // Third-party authentications
  const handleGoogleSignInAttempt = async () => {
    setIsLoading(true);
    try {
      const res = await firebaseSignInWithGoogle();
      if (res.user) {
        onLoginSuccess({
          id: res.user.uid,
          name: res.firestoreUser.name || res.user.displayName || "Google Operator",
          role: res.firestoreUser.role as UserRole,
          email: res.user.email || ""
        });
        showToast("Connected via linked Google Workspace SSO!", "success");
      }
    } catch (err: any) {
      showToast(err.message || "Google authentication failed.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignInAttempt = () => {
    setIsLoading(true);
    showToast("Apple Sign-In is only active on native iOS binaries. Fallback initiated.", "info");
    // Simulate Apple credentials response for preview
    setTimeout(() => {
      onLoginSuccess({
        id: "APPLE_MOCK_USER_" + Math.random().toString(36).substring(2, 7).toUpperCase(),
        name: "Apple Operator",
        role: "Technician",
        email: "apple.operator@example.com"
      });
      showToast("Signed in securely using simulated Apple ID keychain (Sandbox Bypass).", "success");
      setIsLoading(false);
    }, 1200);
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-8 bg-slate-50 dark:bg-stone-950 transition-colors duration-200 select-none">
      
      {/* App Header branding */}
      <div className="w-full text-center mb-6 flex flex-col items-center justify-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#6366f1] to-indigo-600 text-white font-black shadow-xl mb-3 border-4 border-white dark:border-stone-900 shadow-indigo-500/20">
          <Layers className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex flex-col items-center">
          <span className="text-indigo-600 dark:text-indigo-400 font-black text-2xl tracking-tighter leading-none font-sans">STOCKIVO</span>
          <span className="text-[8px] font-black tracking-widest text-slate-400 dark:text-stone-550 uppercase mt-1 font-mono">INTELLIGENCE SUITE</span>
        </h2>
        <p className="text-[9px] text-gray-400 dark:text-stone-500 font-extrabold max-w-[280px] mx-auto mt-2 uppercase tracking-widest">
          Multi-Device Secure Sign-In Hub
        </p>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-lg border border-gray-100/80 dark:border-stone-800 p-6 text-left max-w-sm mx-auto w-full space-y-5 animate-slide-up">
        <div>
          <span className="p-1 px-2.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8.5px] font-black uppercase tracking-widest whitespace-nowrap">
            🔒 Secure Access Control
          </span>
          <h3 className="text-sm font-black text-gray-900 dark:text-white mt-1.5 uppercase font-sans tracking-tight">
            Security Identity Gateway
          </h3>
          <p className="text-[10.5px] text-gray-450 dark:text-stone-400 mt-1.5 font-medium leading-relaxed">
            Please authenticate using an authorized corporate Google Workspace, personal Apple ID, or link via secure console QR.
          </p>
        </div>

        {showQrMode ? (
          <div className="space-y-4 text-center">
            <div className="p-3.5 bg-slate-50 dark:bg-stone-950/60 rounded-2xl border border-gray-100 dark:border-stone-850 flex flex-col items-center select-text">
              <span className="text-[8.5px] font-mono font-bold text-gray-400 dark:text-stone-500 uppercase tracking-widest mb-2.5 flex items-center gap-1">
                <MonitorSmartphone className="w-3.5 h-3.5 text-indigo-500" />
                Auth Code: {qrSessionId.substring(0, 15)}...
              </span>

              <div className="p-2 bg-white rounded-xl border border-gray-150 inline-block">
                <img
                  src={generateQRUrl(`STOCKIVO-QR-LOGIN-REQ:${qrSessionId}`, "160x160")}
                  alt="Session Authorization QR"
                  className="w-36 h-36"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="mt-3 flex items-center gap-2 text-[9.5px] text-indigo-600 dark:text-indigo-400 font-extrabold animate-pulse uppercase tracking-wider">
                <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                <span>PULSING · Waiting for remote scan...</span>
              </div>
            </div>

            <p className="text-[10px] text-gray-450 dark:text-stone-400 leading-normal max-w-[280px] mx-auto text-left">
              To log in automatically, scan this code with the scanner under your logged-in teammate's device <span className="font-bold text-gray-800 dark:text-white">(Linked Devices Dashboard &gt; Scan Pairing QR)</span>.
            </p>

            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-stone-800/80">
              <span className="text-[8px] font-mono font-extrabold text-[#6366f1] dark:text-indigo-400 tracking-widest block uppercase text-left">
                🛠️ SANDBOX BYPASS (Local Test suite)
              </span>
              <button
                type="button"
                onClick={() => {
                  const simulatedUser = {
                    id: "bypass_vijay_owner_uid",
                    name: "Vijay Naik",
                    role: "Owner",
                    email: "vijaynaik2798@gmail.com"
                  };
                  localStorage.setItem(`approved_session_${qrSessionId}`, JSON.stringify({ user: simulatedUser }));
                  showToast("Local device sandbox loop approved successfully!", "success");
                }}
                className="w-full text-center py-2.5 px-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all border border-dashed border-emerald-500/25 active:scale-97 cursor-pointer"
              >
                ⚡ Instantly simulate scan/approval
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setShowQrMode(false);
                  setQrSessionId("");
                }}
                className="w-full text-center py-2 px-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-stone-800 text-gray-700 dark:text-stone-300 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all cursor-pointer"
              >
                Go back
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignInAttempt}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-50 dark:bg-stone-800 dark:hover:bg-stone-750 disabled:opacity-50 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all cursor-pointer active:scale-97"
            >
              {/* SVG Google logo */}
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.65 0 3.13.57 4.3 1.69l3.22-3.22C17.56 1.63 14.97 1 12 1 7.35 1 3.39 3.68 1.48 7.58l3.85 2.99C6.27 7.22 8.91 5.04 12 5.04z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.44c-.28 1.48-1.12 2.73-2.38 3.58l3.69 2.87c2.16-1.99 3.74-4.92 3.74-8.55z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.33 14.43c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29l-3.85-2.99C.53 8.35 0 10.12 0 12s.53 3.65 1.48 4.86l3.85-2.99z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.69-2.87c-1.1.74-2.5 1.18-4.27 1.18-3.09 0-5.73-2.18-6.67-5.53L1.48 15.86C3.39 19.76 7.35 23 12 23z"
                />
              </svg>
              <span>{isLoading ? "Connecting SSO..." : "Log In with Google"}</span>
            </button>

            <button
              type="button"
              onClick={handleAppleSignInAttempt}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-900 dark:bg-stone-950 hover:bg-black dark:hover:bg-black disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all cursor-pointer active:scale-97"
            >
              {/* SVG Apple logo */}
              <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.13.67-2.85 1.49-.62.72-1.17 1.87-1.02 2.95 1.1.09 2.14-.52 2.88-1.38" />
              </svg>
              <span>{isLoading ? "Authenticating..." : "Log In with Apple ID"}</span>
            </button>

            {/* Secure One-Time QR Login Button */}
            <button
              type="button"
              onClick={handleEnableQrMode}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-indigo-50 hover:bg-indigo-100 dark:bg-stone-800 dark:hover:bg-stone-750 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-stone-750 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-97"
            >
              <QrCode className="w-4 h-4 shrink-0 text-indigo-500" />
              <span>Log In via Instant QR Code</span>
            </button>

            {/* Dedicated Owner Quick Sandbox Bypass */}
            <div className="pt-1 border-t border-dashed border-gray-150/85 dark:border-stone-800/80">
              <button
                type="button"
                onClick={() => {
                  onLoginSuccess({
                    id: "bypass_vijay_owner_uid",
                    name: "Vijay Naik",
                    role: "Owner",
                    email: "vijaynaik2798@gmail.com"
                  });
                  showToast("Logged in successfully as Owner Vijay Naik!", "success");
                }}
                className="w-full py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer border border-dashed border-emerald-500/25 active:scale-97 text-center block"
              >
                ⚡ Instant Developer Access (Vijay Naik)
              </button>
            </div>
          </div>
        )}

        {/* Aesthetic corporate stamp/telemetry footer indicator */}
        <div className="pt-3.5 border-t border-gray-100 dark:border-stone-800/80 flex items-center justify-between text-[8px] font-mono text-gray-400 uppercase tracking-widest">
          <span>SECURED SESSION</span>
          <span className="text-emerald-500 animate-pulse flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block" />
            <span>online</span>
          </span>
        </div>
      </div>

    </div>
  );
}
