import React, { useState, useEffect } from "react";
import { User as AppUser, UserRole, Staff } from "../types";
// @ts-ignore
import stockivoLogo from "../assets/images/stockivo_logo_v4_1782356434674.jpg";
import { Layers, QrCode, MonitorSmartphone, ShieldAlert, CheckCircle, RefreshCw, Eye, EyeOff, Mail, Lock, User, UserPlus, LogIn, Key } from "lucide-react";
import { firebaseSignInWithGoogle, signInOperator, registerNewOperator, db } from "../utils/firebase";
import { generateQRUrl } from "../utils/helpers";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";

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

  // Email login/sign-up state parameters
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<UserRole>("Staff");

  // Real-time password strength analyzer for strong credentials
  const analyzePasswordStrength = (pwd: string) => {
    if (!pwd) {
      return {
        score: 0,
        label: "None",
        color: "bg-gray-200 dark:bg-stone-850",
        hasMin: false,
        hasUpper: false,
        hasLower: false,
        hasNumOrSpecial: false
      };
    }

    const hasMin = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumOrSpecial = /[\d\W]/.test(pwd);

    let score = 0;
    if (pwd.length >= 4) score += 1;
    if (hasMin) score += 1;
    // Check for mix of lowercase and uppercase
    if (hasLower && hasUpper) score += 1;
    if (hasNumOrSpecial) score += 1;

    let label = "Too Weak";
    let color = "bg-rose-500";
    if (score === 2) {
      label = "Fair";
      color = "bg-amber-400";
    } else if (score === 3) {
      label = "Strong";
      color = "bg-indigo-550 dark:bg-indigo-500";
    } else if (score === 4) {
      label = "Excellent (Very Strong)";
      color = "bg-emerald-500";
    }

    return { score, label, color, hasMin, hasUpper, hasLower, hasNumOrSpecial };
  };

  // Initialize unique session ID when entering QR Login mode
  const handleEnableQrMode = async () => {
    const randomId = "SESSION-" + Math.random().toString(36).substring(2, 8).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
    setQrSessionId(randomId);
    setShowQrMode(true);
    
    // Write placeholder to Firestore so secondary companion scans can find and update it
    try {
      await setDoc(doc(db, "qr_login_sessions", randomId), {
        status: "PENDING",
        createdAt: serverTimestamp(),
        approvedBy: null,
        approvedUserRole: null,
        approvedUserEmail: null,
        authToken: null
      });
      showToast("One-time companion session QR generated!", "success");
    } catch (err: any) {
      console.warn("Failed to register QR session placeholder in cloud:", err);
      showToast("One-time companion session QR generated (Local Sync Mode).", "success");
    }
  };

  // Poll LocalStorage and Firestore for Remote Authorization approval token
  useEffect(() => {
    if (!showQrMode || !qrSessionId) return;

    // 1. Real-time Firestore sync listener
    const docRef = doc(db, "qr_login_sessions", qrSessionId);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.status === "APPROVED") {
          onLoginSuccess({
            id: data.authToken || "QR_AUTH_USER_101",
            name: data.approvedBy || "Remote Companion Operator",
            role: (data.approvedUserRole || "Manager") as UserRole,
            email: data.approvedUserEmail || "companion@stockivo.com"
          });
          showToast(`SSO Handshake complete! Welcome, ${data.approvedBy || "Operator"}.`, "success");
          setShowQrMode(false);
          setQrSessionId("");
        } else if (data.status === "DENIED") {
          showToast("Login request was rejected by remote device.", "error");
          setShowQrMode(false);
          setQrSessionId("");
        }
      }
    }, (error) => {
      console.warn("Firestore QR listener restricted. Falling back to LocalStorage sync:", error);
    });

    // 2. Poll LocalStorage fallback for same-machine frame pairing emulation
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
            showToast("Login request was rejected by remote device.", "error");
            setShowQrMode(false);
            setQrSessionId("");
            clearInterval(interval);
          }
        } catch (e) {
          // Silent catch
        }
      }
    }, 1200);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
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
      console.error("Google SSO error:", err);
      const isIframe = window.self !== window.top;
      if (isIframe || err.code === "auth/popup-blocked" || err.message?.toLowerCase().includes("popup")) {
        showToast("🔒 Browser restricted popup inside preview frame. Click the 'Open in New Tab' icon in the top-right corner to login, or use email/password instead!", "error");
      } else if (err.code === "auth/operation-not-allowed") {
        showToast("Google Sign-In is disabled. Please enable Google provider in your Firebase Console authentication options.", "error");
      } else {
        showToast(err.message || "Google authentication failed.", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailStr = formEmail.trim();
    const pwdStr = formPassword.trim();
    if (!emailStr || !pwdStr) {
      showToast("Email and password are required.", "error");
      return;
    }
    setIsLoading(true);
    try {
      const res = await signInOperator(emailStr, pwdStr);
      if (res && res.firestoreUser) {
        onLoginSuccess({
          id: res.user.uid,
          name: res.firestoreUser.name || "Operator",
          role: res.firestoreUser.role as UserRole,
          email: res.firestoreUser.email || ""
        });
        showToast(`Welcome back, ${res.firestoreUser.name}!`, "success");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to log in. Please check credentials.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameStr = regName.trim();
    const emailStr = regEmail.trim();
    const pwdStr = regPassword.trim();

    if (!nameStr || !emailStr || !pwdStr) {
      showToast("All fields (Name, Email, Password) are required.", "error");
      return;
    }

    const { hasMin, hasUpper, hasLower, hasNumOrSpecial } = analyzePasswordStrength(pwdStr);

    if (!hasMin) {
      showToast("Security requirement: Password must be at least 8 characters long.", "error");
      return;
    }
    if (!hasUpper || !hasLower) {
      showToast("Security requirement: Password must contain both uppercase and lowercase letters.", "error");
      return;
    }
    if (!hasNumOrSpecial) {
      showToast("Security requirement: Password must contain at least one number or special character.", "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerNewOperator(emailStr, pwdStr, nameStr, regRole);
      if (res && res.firestoreUser) {
        // Register locally
        onRegisterUser(res.firestoreUser);
        // Login immediately
        onLoginSuccess({
          id: res.user.uid,
          name: res.firestoreUser.name,
          role: res.firestoreUser.role as UserRole,
          email: res.firestoreUser.email
        });
        showToast(`Account created successfully! Welcome, ${res.firestoreUser.name}.`, "success");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create account.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-8 bg-slate-50 dark:bg-stone-950 transition-colors duration-200 select-none">
      
      {/* App Header branding */}
      <div className="w-full text-center mb-6 flex flex-col items-center justify-center">
        <img
          src={stockivoLogo}
          alt="STOCKIVO LOGO"
          className="w-16 h-16 rounded-2xl object-cover shadow-xl mb-3 border-4 border-white dark:border-stone-900 bg-white animate-pulse"
          referrerPolicy="no-referrer"
        />
        <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex flex-col items-center">
          <span className="text-indigo-600 dark:text-indigo-400 font-black text-2xl tracking-tighter leading-none font-sans">STOCKIVO</span>
          <span className="text-[8px] font-black tracking-widest text-slate-400 dark:text-stone-550 uppercase mt-1 font-mono">INTELLIGENCE SUITE</span>
        </h2>
        <p className="text-[9px] text-gray-400 dark:text-stone-500 font-extrabold max-w-[280px] mx-auto mt-2 uppercase tracking-widest">
          Multi-Device Operator Sign-In Hub
        </p>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-lg border border-gray-100/80 dark:border-stone-800 p-6 text-left max-w-sm mx-auto w-full space-y-4 animate-slide-up">
        {/* Dynamic header depending on Mode */}
        <div>
          <span className="p-1 px-2.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8.5px] font-black uppercase tracking-widest whitespace-nowrap">
            🔑 Operator Access Control
          </span>
          <h3 className="text-sm font-black text-gray-900 dark:text-white mt-1.5 uppercase font-sans tracking-tight">
            {showQrMode ? "Scan QR Access Code" : authTab === "signin" ? "Operator Log In" : "Register New Account"}
          </h3>
          <p className="text-[10.5px] text-gray-450 dark:text-stone-400 mt-1 font-medium leading-relaxed">
            {showQrMode 
              ? "Scan code with your active authenticated companion device to synchronize." 
              : authTab === "signin" 
                ? "Provide your authorized credentials or connect instantly via quick SSO protocols below."
                : "Create an operator account. Enter your name, email, and master password to get started."}
          </p>
        </div>

        {showQrMode ? (
          <div className="space-y-4 text-center pb-2">
            <div className="p-3.5 bg-slate-50 dark:bg-stone-950/60 rounded-2xl border border-gray-100 dark:border-stone-850 flex flex-col items-center select-text">
              <span className="text-[8.5px] font-mono font-bold text-gray-400 dark:text-stone-500 uppercase tracking-widest mb-2.5 flex items-center gap-1">
                <MonitorSmartphone className="w-3.5 h-3.5 text-indigo-500" />
                Auth Code: {qrSessionId.substring(0, 15)}...
              </span>

              <div className="p-2 bg-white rounded-xl border border-gray-150 inline-block">
                <img
                  src={generateQRUrl(`STOCKIVO-QR-LOGIN-REQ:${qrSessionId}`, "160x160")}
                  alt="Session Authorization QR"
                  className="w-32 h-32"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="mt-3 flex items-center gap-2 text-[9.5px] text-indigo-600 dark:text-indigo-400 font-extrabold animate-pulse uppercase tracking-wider">
                <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                <span>PULSING · Waiting for remote scan...</span>
              </div>
            </div>

            <p className="text-[9.5px] text-gray-455 dark:text-stone-400 leading-normal max-w-[280px] mx-auto text-left font-sans">
              Scan this code with the scanner under your logged-in teammate's device <span className="font-bold text-gray-800 dark:text-white">(Linked Devices Dashboard &gt; Scan Pairing QR)</span>.
            </p>

            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-stone-800/80">
              <button
                type="button"
                onClick={() => {
                  setShowQrMode(false);
                  setQrSessionId("");
                }}
                className="w-full text-center py-2 bg-gray-100 hover:bg-gray-200 dark:bg-stone-800 text-gray-700 dark:text-stone-300 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all cursor-pointer border-none"
              >
                Go back
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Elegant Mode switcher tab bar */}
            <div className="flex bg-slate-100 dark:bg-stone-950 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setAuthTab("signin")}
                className={`flex-1 py-1.5 text-center text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer border-none ${
                  authTab === "signin"
                    ? "bg-white dark:bg-stone-850 text-indigo-650 dark:text-indigo-400 shadow-sm"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-stone-300"
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => setAuthTab("signup")}
                className={`flex-1 py-1.5 text-center text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer border-none ${
                  authTab === "signup"
                    ? "bg-white dark:bg-stone-850 text-indigo-650 dark:text-indigo-400 shadow-sm"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-stone-300"
                }`}
              >
                Register
              </button>
            </div>

            {/* Content Tab 1: Log In Form */}
            {authTab === "signin" ? (
              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="login-email" className="block text-[9px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                    </span>
                    <input
                      id="login-email"
                      name="email"
                      autoComplete="username email"
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="e.g. operator@stockivo.com"
                      className="w-full bg-slate-50 dark:bg-stone-950 border border-gray-150 dark:border-stone-850 rounded-xl py-2 pl-9 pr-4 text-xs font-medium text-gray-800 dark:text-stone-250 placeholder-gray-400 dark:placeholder-stone-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label htmlFor="login-password" className="block text-[9px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-wider">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                    </span>
                    <input
                      id="login-password"
                      name="password"
                      autoComplete="current-password"
                      type={showPwd ? "text" : "password"}
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 dark:bg-stone-950 border border-gray-150 dark:border-stone-850 rounded-xl py-2 pl-9 pr-10 text-xs font-medium text-gray-800 dark:text-stone-250 placeholder-gray-400 dark:placeholder-stone-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                    />
                    <button
                      id="toggle-login-password"
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center outline-none border-none bg-transparent text-gray-400 hover:text-gray-600 dark:hover:text-stone-300"
                    >
                      {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#6366f1] hover:bg-indigo-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl text-center shadow-md shadow-indigo-500/10 cursor-pointer transition-all active:scale-98 border-none flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying Session...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Authenticate Log In</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Content Tab 2: Register Form */
              <form onSubmit={handleEmailSignUp} className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="register-name" className="block text-[9px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-wider">
                    Full Operator Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                    </span>
                    <input
                      id="register-name"
                      name="name"
                      autoComplete="name"
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Alexander Pierce"
                      className="w-full bg-slate-50 dark:bg-stone-950 border border-gray-150 dark:border-stone-850 rounded-xl py-2 pl-9 pr-4 text-xs font-medium text-gray-800 dark:text-stone-250 placeholder-gray-400 dark:placeholder-stone-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="register-email" className="block text-[9px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-wider">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                    </span>
                    <input
                      id="register-email"
                      name="email"
                      autoComplete="email username"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. name@company.com"
                      className="w-full bg-slate-50 dark:bg-stone-950 border border-gray-150 dark:border-stone-850 rounded-xl py-2 pl-9 pr-4 text-xs font-medium text-gray-800 dark:text-stone-250 placeholder-gray-400 dark:placeholder-stone-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="register-role" className="block text-[9px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-wider">
                    Assigned Workspace Role
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <Layers className="w-3.5 h-3.5 text-gray-400" />
                    </span>
                    <select
                      id="register-role"
                      name="role"
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as UserRole)}
                      className="w-full bg-slate-50 dark:bg-stone-950 border border-gray-150 dark:border-stone-850 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-gray-800 dark:text-stone-250 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 appearance-none cursor-pointer"
                    >
                      <option value="Staff">Staff Operator</option>
                      <option value="Manager">Manager</option>
                      <option value="Technician">Technician</option>
                      <option value="Receptionist">Receptionist</option>
                      <option value="Owner">Business Owner</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1 flex-1">
                  <label htmlFor="register-password" className="block text-[9px] font-black text-gray-400 dark:text-stone-500 uppercase tracking-wider flex justify-between items-center">
                    <span>Password (min. 8 characters)</span>
                    {regPassword && (
                      <span className={`text-[8px] font-black uppercase tracking-widest ${
                        regPassword.length < 8 ? "text-rose-500" :
                        !/[A-Z]/.test(regPassword) || !/[a-z]/.test(regPassword) ? "text-amber-500" :
                        !/[\d\W]/.test(regPassword) ? "text-indigo-400" : "text-emerald-500"
                      }`}>
                        {analyzePasswordStrength(regPassword).label}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                    </span>
                    <input
                      id="register-password"
                      name="password"
                      autoComplete="new-password"
                      type={showPwd ? "text" : "password"}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="e.g. SecurePass1@"
                      className="w-full bg-slate-50 dark:bg-stone-950 border border-gray-150 dark:border-stone-850 rounded-xl py-2 pl-9 pr-10 text-xs font-semibold text-gray-800 dark:text-stone-250 placeholder-gray-400 dark:placeholder-stone-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 font-sans"
                    />
                    <button
                      id="toggle-register-password"
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center outline-none border-none bg-transparent text-gray-400 hover:text-gray-600 dark:hover:text-stone-300 pointer-events-auto"
                    >
                      {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Dynamic Password Strength Indicator Checkbox Matrix */}
                  <div className="p-2 bg-slate-50 dark:bg-stone-950/70 border border-gray-150 dark:border-stone-850 rounded-xl space-y-2 text-[9.5px]">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => {
                        const stats = analyzePasswordStrength(regPassword);
                        let lit = false;
                        if (regPassword.length > 0) {
                          if (i === 1 && regPassword.length >= 4) lit = true;
                          if (i === 2 && stats.hasMin) lit = true;
                          if (i === 3 && stats.hasLower && stats.hasUpper) lit = true;
                          if (i === 4 && stats.hasNumOrSpecial) lit = true;
                        }
                        return (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                              lit ? stats.color : "bg-gray-200 dark:bg-stone-850"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <div className="space-y-1 text-gray-500 dark:text-stone-450 font-medium text-[9px] leading-tight text-left">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${regPassword.length >= 8 ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-stone-705'}`} />
                        <span className={regPassword.length >= 8 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                          At least 8 characters
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${(/[A-Z]/.test(regPassword) && /[a-z]/.test(regPassword)) ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-stone-705'}`} />
                        <span className={(/[A-Z]/.test(regPassword) && /[a-z]/.test(regPassword)) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                          Uppercase & lowercase letters
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${/[\d\W]/.test(regPassword) ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-stone-705'}`} />
                        <span className={/[\d\W]/.test(regPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                          One number or special symbol
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#6366f1] hover:bg-indigo-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl text-center shadow-md shadow-indigo-500/10 cursor-pointer transition-all active:scale-98 border-none flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Register Account</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Quick Divider for SSO alternatives */}
            <div className="relative flex py-1 items-center select-none">
              <div className="flex-grow border-t border-gray-150 dark:border-stone-850"></div>
              <span className="flex-shrink mx-2 text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">
                or use quick channels
              </span>
              <div className="flex-grow border-t border-gray-150 dark:border-stone-850"></div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleSignInAttempt}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-2 px-4 bg-white hover:bg-slate-50 dark:bg-stone-800 dark:hover:bg-stone-750 disabled:opacity-50 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 font-extrabold text-[10px] uppercase tracking-wider rounded-xl shadow-xs transition-all cursor-pointer active:scale-97"
              >
                {/* SVG Google logo */}
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
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
                <span>Google Workspace Single Sign-On</span>
              </button>

              {/* Informative helper for Google Single Sign-On inside AI Studio iframe preview */}
              <div className="p-2.5 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/20 rounded-xl text-[9px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed text-left space-y-1">
                <span className="font-extrabold block uppercase tracking-wider text-center text-amber-800 dark:text-amber-300">💡 Google SSO inside Iframe Preview</span>
                <p>
                  Because the live preview runs inside a sandboxed cross-origin iframe, your browser blocks Google login popups by default.
                </p>
                <p>
                  To log in with Google, click the <strong>'Open in New Tab'</strong> icon in the top-right corner of the preview panel, or use traditional email login.
                </p>
              </div>

              <button
                type="button"
                onClick={handleEnableQrMode}
                className="w-full flex items-center justify-center gap-2.5 py-2 px-4 bg-indigo-50 hover:bg-indigo-100 dark:bg-stone-800 dark:hover:bg-stone-750 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-stone-750 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-97"
              >
                <QrCode className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                <span>Instant Companion QR Sign-In</span>
              </button>

            </div>
          </div>
        )}

        {/* Aesthetic corporate stamp/telemetry footer indicator */}
        <div className="pt-2 border-t border-gray-100 dark:border-stone-800/80 flex items-center justify-between text-[8px] font-mono text-gray-400 uppercase tracking-widest">
          <span>ACTIVE SESSION</span>
          <span className="text-emerald-500 animate-pulse flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block" />
            <span>online</span>
          </span>
         </div>
       </div>

    </div>
  );
}
