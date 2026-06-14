import React, { useState, useEffect } from "react";
import { User as AppUser, UserRole, Staff } from "../types";
import { 
  LogIn, 
  UserPlus, 
  Info, 
  CheckCircle2, 
  X, 
  Lock, 
  Unlock, 
  Mail, 
  RotateCw, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  ArrowLeft,
  Layers
} from "lucide-react";
import { 
  registerNewOperator, 
  signInOperator, 
  sendPasswordReset, 
  resendEmailVerificationLink,
  checkUserStatusAndAttempts,
  firebaseSignInWithGoogle,
  logAuditEntry,
  db
} from "../utils/firebase";

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
  // Screen/State mode: LOGIN, REGISTER, FORGOT_PASSWORD, EMAIL_VERIFICATION_SENT, ACCOUNT_LOCKED
  const [authMode, setAuthMode] = useState<"LOGIN" | "REGISTER" | "FORGOT_PASSWORD" | "EMAIL_VERIFICATION_SENT" | "ACCOUNT_LOCKED">("LOGIN");

  // Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("Technician");
  
  // UI Controls
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lockedReason, setLockedReason] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [operationNotAllowed, setOperationNotAllowed] = useState(false);

  // Password Policy calculations
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordStrong = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  // Track Resend verification countdown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // SUBMIT handler
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      showToast("Email and password fields are required.", "error");
      return;
    }

    setIsLoading(true);
    setOperationNotAllowed(false);

    try {
      if (authMode === "LOGIN") {
        // 1. Check if user is locked or disabled FIRST to prevent brute force
        const check = await checkUserStatusAndAttempts(email.trim());
        if (!check.allowed) {
          setLockedReason(check.reason);
          setAuthMode("ACCOUNT_LOCKED");
          setIsLoading(false);
          return;
        }

        // 2. Perform authentic sign-in via Firebase
        const res = await signInOperator(email.trim(), password);
        
        if (res.user) {
          // Complete login successfully
          onLoginSuccess({
            id: res.user.uid,
            name: res.firestoreUser.name || res.user.displayName || "Operator",
            role: res.firestoreUser.role as UserRole,
            email: res.user.email || email.trim()
          });
          showToast(`Welcome back, ${res.firestoreUser.name || "Operator"}!`, "success");
        }
      } else if (authMode === "REGISTER") {
        // Enforce password policy
        if (!isPasswordStrong) {
          showToast("Password must fulfill all strong policy requirements.", "error");
          setIsLoading(false);
          return;
        }

        if (!name.trim()) {
          showToast("Operator Full Name is required.", "error");
          setIsLoading(false);
          return;
        }

        // Trigger secure registration
        const res = await registerNewOperator(email.trim(), password, name.trim(), role);
        if (res.user) {
          // Tell app about new account profile schema
          onRegisterUser({
            id: res.user.uid,
            name: name.trim(),
            role: role,
            email: email.trim().toLowerCase()
          });
          
          showToast("Account created! A verification link has been sent.", "info");
          setAuthMode("EMAIL_VERIFICATION_SENT");
        }
      }
    } catch (err: any) {
      console.error(err);
      
      // Handle failed attempts lock check
      if (authMode === "LOGIN") {
        const recheck = await checkUserStatusAndAttempts(email.trim());
        if (!recheck.allowed) {
          setLockedReason(recheck.reason);
          setAuthMode("ACCOUNT_LOCKED");
        }
      }

      let friendlyMsg = err.message || "Authentication attempt rejected.";
      if (err.code === "auth/email-already-in-use" || String(err).includes("email-already-in-use")) {
        friendlyMsg = "This email is already registered! Switch to 'Sign In' above to log in, or use the 'Forgot Password' link.";
      } else if (err.code === "auth/operation-not-allowed" || String(err).includes("operation-not-allowed")) {
        setOperationNotAllowed(true);
        friendlyMsg = "Registration Provider Restricting Access: Please enable Email/Password Authentication in your Firebase Console.";
      }

      showToast(friendlyMsg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password resets
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast("Registered email address is required.", "error");
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordReset(email.trim());
      showToast("Verification handshake success! Reset password link has been sent to your inbox.", "success");
      setAuthMode("LOGIN");
    } catch (err: any) {
      console.error("Forgot password flow error details:", err);
      let friendlyMsg = err.message || "Failed to trigger reset email.";
      
      const errorCode = err?.code || "";
      if (errorCode === "auth/user-not-found" || String(err).includes("user-not-found")) {
        friendlyMsg = "No active operator profile was found registered with this email address. Please make sure the email is typed correctly or register a new account first.";
      } else if (errorCode === "auth/invalid-email" || String(err).includes("invalid-email")) {
        friendlyMsg = "The email address supplied is invalid. Please verify and retry.";
      } else if (errorCode === "auth/network-request-failed" || String(err).includes("network-request-failed")) {
        friendlyMsg = "Network timeout or connection issues encountered. Please check your internet connectivity and try again.";
      } else if (errorCode === "auth/too-many-requests" || String(err).includes("too-many-requests")) {
        friendlyMsg = "Too many reset attempts detected. For security purposes, please wait a few minutes and try again.";
      } else if (err.code === "auth/internal-error" || String(err).includes("internal-error")) {
        friendlyMsg = "An internal authentication server error occurred. Please try again later.";
      }
      
      showToast(friendlyMsg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Resend Verification handler
  const handleResendVerification = async () => {
    if (!email.trim()) {
      showToast("Operator email is required.", "error");
      return;
    }
    if (resendCountdown > 0) return;

    try {
      await resendEmailVerificationLink();
      showToast("A fresh verification handshake email has been dispatched!", "success");
      setResendCountdown(60); // rate limiting to 60 seconds
    } catch (err: any) {
      showToast(err.message || "Failed to resend. Please try again.", "error");
    }
  };

  // Third party authentications
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
    showToast("Apple Sign-In is only active on native iOS binaries. Fallback initiated.", "info");
    // Simulate Apple credentials response for preview
    setTimeout(() => {
      onLoginSuccess({
        id: "APPLE_MOCK_USER_" + Math.random().toString(36).substr(2, 5).toUpperCase(),
        name: "Apple Operator",
        role: "Technician",
        email: "apple.operator@example.com"
      });
      showToast("Signed in securely using simulated Apple ID keychain (Sandbox Bypass).", "success");
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
          SECURITY & INFRASTRUCTURE GATEWAY
        </p>
      </div>

      {/* Screen 1: Forgot Password Form */}
      {authMode === "FORGOT_PASSWORD" && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-md border border-gray-100 dark:border-stone-800 p-5 text-left animate-slide-up">
          <button 
            onClick={() => setAuthMode("LOGIN")}
            className="flex items-center gap-1 text-[10px] uppercase font-black text-gray-400 hover:text-gray-600 mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to LogIn
          </button>

          <h3 className="text-base font-black text-gray-800 dark:text-stone-100 mb-1">
            Send Reset Handshake Password
          </h3>
          <p className="text-[10.5px] text-gray-500 dark:text-stone-400 font-medium leading-relaxed mb-4">
            Input your registered administrator or operator email. We will mail a password recovery instruction link shortly.
          </p>

          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-[9.5px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1.5">
                Operator Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  placeholder="name@invservice.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl pl-9 pr-3.5 py-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-black text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98 transition-all"
            >
              {isLoading ? "Sending recovery link..." : "Send Reset / Handshake Link"}
            </button>
          </form>

          {/* Email Delivery Troubleshooting Guide */}
          <div className="mt-5 p-3.5 bg-amber-500/5 border border-amber-500/10 dark:border-amber-500/20 rounded-xl space-y-2 select-none font-sans">
            <span className="block text-[8.5px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              ✉️ Why did the recovery email not arrive?
            </span>
            <ul className="list-disc pl-3 text-[10px] text-gray-500 dark:text-stone-400 space-y-1.5 leading-relaxed font-medium">
              <li>
                <strong className="text-gray-700 dark:text-stone-300">Account might not exist yet:</strong> If you saw the <span className="text-rose-500 font-bold">"auth/operation-not-allowed"</span> error during registration, your account was <strong className="text-rose-500">never created</strong>. Firebase cannot send password resets to non-existent accounts!
              </li>
              <li>
                <strong className="text-gray-700 dark:text-stone-300">Firebase Email provider is disabled:</strong> For emails or password resets to go through, you must enable <strong className="text-gray-700 dark:text-stone-300">"Email/Password"</strong> in your Firebase Console &rarr; Authentication &rarr; Sign-in method tab.
              </li>
              <li>
                <strong className="text-gray-700 dark:text-stone-300">Check Spam & Junk folders:</strong> Email delivery servers can occasionally route reset keys under Spam, Trash, or Updates tabs.
              </li>
              <li>
                <strong className="text-gray-700 dark:text-stone-300">Try Google Login:</strong> Avoid email recovery altogether and log in instantly via the <strong className="text-gray-700 dark:text-stone-300">Google SSO</strong> button on the Login page if Gmail is preferred.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Screen 2: Email Verification Pending / Resend screen */}
      {authMode === "EMAIL_VERIFICATION_SENT" && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-md border border-gray-100 dark:border-stone-800 p-5 text-left animate-slide-up">
          <div className="text-center py-3">
            <Mail className="w-12 h-12 text-blue-500 mx-auto mb-3 animate-pulse" />
            <h3 className="text-base font-black text-gray-800 dark:text-stone-100 mb-1">
              Verify Operator Email Address
            </h3>
            <p className="text-xs text-gray-500 dark:text-stone-400 font-medium px-4">
              A secure activation link was dispatched to <strong>{email}</strong>.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-900/30 p-3 rounded-lg text-[10px] text-blue-800 dark:text-blue-300 font-medium leading-relaxed mt-2">
            ⚠️ <strong>Security Policy Activation:</strong> Email verification is strictly required before accessing inventory, client databases, or ticket workspaces. Once verified, return here to sign in.
          </div>

          <div className="space-y-2 mt-4">
            <button
              onClick={handleResendVerification}
              disabled={resendCountdown > 0}
              className={`w-full text-xs font-black py-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                resendCountdown > 0
                  ? "bg-slate-50 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white hover:bg-slate-50 dark:bg-stone-800 text-gray-700 dark:text-stone-200 border-gray-250 cursor-pointer"
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${resendCountdown > 0 && "animate-spin"}`} />
              <span>{resendCountdown > 0 ? `Resend available in ${resendCountdown}s` : "Resend Verification Handshake"}</span>
            </button>

            <button
              onClick={() => setAuthMode("LOGIN")}
              className="w-full text-xs font-black text-blue-600 dark:text-emerald-400 py-2.5 hover:underline text-center cursor-pointer block"
            >
              ← Back to login gate
            </button>
          </div>
        </div>
      )}

      {/* Screen 3: Account Locked Screen */}
      {authMode === "ACCOUNT_LOCKED" && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-md border border-gray-100 dark:border-stone-800 p-5 text-center animate-slide-up">
          <ShieldAlert className="w-14 h-14 text-rose-600 mx-auto mb-3.5 animate-bounce" />
          <h3 className="text-base font-black text-gray-800 dark:text-stone-100">
            Account Access Blocked
          </h3>
          <p className="text-[10.5px] font-bold text-rose-600 uppercase tracking-wider mt-1">
            Brute-Force Protection Active
          </p>

          <p className="text-xs text-gray-500 dark:text-stone-400 font-medium leading-relaxed p-3 bg-slate-50 dark:bg-black/40 rounded-xl border border-gray-150 dark:border-stone-850 mt-4 text-left">
            {lockedReason || "This Operator account has been disabled after 5+ consecutive failed login attempts or manually by an Administrator."}
          </p>

          <div className="space-y-2.5 mt-5">
            <div className="text-[9.5px] text-gray-400 font-semibold leading-normal">
              To regain system privileges, please contact the Business Owner (Vijay Naik) or direct support lines to reset login constraints.
            </div>

            <button
              onClick={() => setAuthMode("LOGIN")}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-black text-xs py-2.5 rounded-xl block cursor-pointer"
            >
              Back to Login Portal
            </button>
          </div>
        </div>
      )}

      {/* Screen 4/5: Login & Register tabs */}
      {(authMode === "LOGIN" || authMode === "REGISTER") && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-lg border border-gray-100/80 dark:border-stone-800 p-5 text-left">
          
          {/* Custom tab toggler */}
          <div className="flex bg-slate-100 dark:bg-stone-800 p-1 rounded-xl mb-4.5">
            <button
              onClick={() => setAuthMode("LOGIN")}
              className={`flex-1 text-center py-2 text-[10.5px] font-black uppercase tracking-wider rounded-lg transition-all ${
                authMode === "LOGIN"
                  ? "bg-white dark:bg-stone-700 text-gray-800 dark:text-stone-100 shadow-sm"
                  : "text-gray-400 dark:text-stone-400 hover:text-gray-650"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode("REGISTER")}
              className={`flex-1 text-center py-2 text-[10.5px] font-black uppercase tracking-wider rounded-lg transition-all ${
                authMode === "REGISTER"
                  ? "bg-white dark:bg-stone-700 text-gray-800 dark:text-stone-100 shadow-sm"
                  : "text-gray-400 dark:text-stone-400 hover:text-gray-650"
              }`}
            >
              Register Account
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            
            {/* Field 1: Full Name (Registration only) */}
            {authMode === "REGISTER" && (
              <div>
                <label className="block text-[9.5px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1.5">
                  Worker Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anand Kumar"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            )}

            {/* Field 2: Email */}
            <div>
              <label className="block text-[9.5px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1.5">
                Operator Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="name@invservice.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Field 3: Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[9.5px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest">
                  Secure Password *
                </label>
                {authMode === "LOGIN" && (
                  <button
                    type="button"
                    onClick={() => setAuthMode("FORGOT_PASSWORD")}
                    className="text-[9px] font-black text-blue-500 hover:underline cursor-pointer bg-none border-none"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl pl-3.5 pr-10 py-2.5 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-0.5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* LIVE PASSWORD POLICY CHECKER (Requirement) */}
              {authMode === "REGISTER" && (
                <div className="mt-2.5 bg-slate-50 dark:bg-stone-950 p-3 rounded-xl border border-gray-150 dark:border-stone-800 text-[10px] space-y-1 select-none">
                  <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Password Security Policy Strength:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 font-semibold text-[9.5px]">
                    <div className="flex items-center gap-1 text-gray-500">
                      <span className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? "bg-emerald-500" : "bg-rose-500 animate-ping"}`} />
                      <span className={hasMinLength ? "text-emerald-600 font-bold" : "text-rose-600"}>8+ Characters</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 font-semibold text-[9.5px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${hasUppercase ? "bg-emerald-500" : "bg-rose-500 animate-ping"}`} />
                      <span className={hasUppercase ? "text-emerald-600 font-bold" : "text-rose-600"}>Uppercase (A-Z)</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 font-semibold text-[9.5px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${hasLowercase ? "bg-emerald-500" : "bg-rose-500 animate-ping"}`} />
                      <span className={hasLowercase ? "text-emerald-600 font-bold" : "text-rose-600"}>Lowercase (a-z)</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 font-semibold text-[9.5px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${hasNumber ? "bg-emerald-500" : "bg-rose-500 animate-ping"}`} />
                      <span className={hasNumber ? "text-emerald-600 font-bold" : "text-rose-600"}>Number (0-9)</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 font-semibold text-[9.5px] col-span-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${hasSpecial ? "bg-emerald-500" : "bg-rose-500 animate-ping"}`} />
                      <span className={hasSpecial ? "text-emerald-600 font-bold" : "text-rose-600"}>Special Character (!@#$*)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Field 4: Business Role Selection (Registration only) */}
            {authMode === "REGISTER" && (
              <div>
                <label className="block text-[9.5px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest mb-1.5">
                  Business Role Assignment Level *
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Owner">Owner (Business Administrator)</option>
                  <option value="Manager">Manager</option>
                  <option value="Technician">Technician</option>
                  <option value="Staff">Staff</option>
                  <option value="Receptionist">Receptionist</option>
                </select>
              </div>
            )}

            {/* Troubleshooting info block for operation-not-allowed */}
            {authMode === "REGISTER" && operationNotAllowed && (
              <div className="p-4 bg-amber-500/10 border border-amber-550/20 rounded-xl space-y-2 select-none">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="block text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    ⚙️ Firebase Email Provider Setup Required
                  </span>
                </div>
                <p className="text-[10px] text-gray-600 dark:text-stone-300 font-medium leading-relaxed">
                  The Email/Password authentication provider is currently disabled inside your Google Firebase project configuration. Follow these steps to enable it:
                </p>
                <ol className="list-decimal pl-4.5 text-[9.5px] text-gray-500 dark:text-stone-400 space-y-1.5 leading-relaxed font-semibold">
                  <li>
                    Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Firebase Console</a> for your project.
                  </li>
                  <li>
                    Navigate to <strong className="text-gray-700 dark:text-stone-200">Build</strong> &rarr; <strong className="text-gray-700 dark:text-stone-200">Authentication</strong> in the left sidebar.
                  </li>
                  <li>
                    Select the <strong className="text-gray-700 dark:text-stone-200">"Sign-in method"</strong> tab at the top.
                  </li>
                  <li>
                    Click <strong className="text-gray-700 dark:text-stone-200">"Add new provider"</strong>, choose <strong className="text-gray-700 dark:text-stone-200">"Email/Password"</strong>, toggle <strong className="text-gray-700 dark:text-stone-200">"Enable"</strong>, and press Save.
                  </li>
                </ol>
                <div className="pt-2 border-t border-amber-500/10 text-[9px] text-gray-400 dark:text-stone-500 font-medium leading-normal">
                  ⚡ Alternatively, you can use the <strong className="text-gray-500 dark:text-stone-300">Google SSO</strong> option below to bypass and sign in instantly.
                </div>
              </div>
            )}

            {/* Submit Actions */}
            <button
              type="submit"
              disabled={isLoading || (authMode === "REGISTER" && !isPasswordStrong)}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 disabled:opacity-50 text-white font-black text-xs py-3 rounded-xl shadow-md hover:from-emerald-750 active:scale-98 transition-all flex items-center justify-center gap-1.5 mt-2 cursor-pointer border-none"
              id="auth-submit-btn"
            >
              {isLoading ? "Synchronizing credentials..." : authMode === "LOGIN" ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span>{isLoading ? "Please Wait..." : authMode === "LOGIN" ? "Authenticate & Access" : "Register & Dispatch Activation"}</span>
            </button>
          </form>

          {/* Third party Single Sign On Buttons */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-stone-800 space-y-2 select-none">
            <span className="block text-[8px] font-black text-gray-400 dark:text-stone-400 uppercase tracking-widest text-center">
              Or connect via single sign on
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleGoogleSignInAttempt}
                disabled={isLoading}
                className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-black block border border-gray-200 dark:border-stone-800 rounded-xl text-gray-700 dark:text-stone-200 hover:bg-slate-50 dark:hover:bg-stone-850 cursor-pointer text-center"
              >
                Google SSO
              </button>
              <button
                type="button"
                onClick={handleAppleSignInAttempt}
                disabled={isLoading}
                className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-black block border border-gray-200 dark:border-stone-800 rounded-xl text-gray-700 dark:text-stone-200 hover:bg-slate-50 dark:hover:bg-stone-850 cursor-pointer text-center"
              >
                Apple ID
              </button>
            </div>
          </div>

          {/* Demo / Sandbox Quick Access bypass option */}
          <div className="mt-4 pt-3.5 border-t border-dashed border-indigo-150 dark:border-stone-800 space-y-2 select-none">
            <span className="block text-[8px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest text-center">
              ⚡ Sandbox Demo Quick Access
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onLoginSuccess({
                    id: "bypass_operator_uid",
                    name: "Vijay Naik",
                    role: "Owner",
                    email: "vijaynaik2798@gmail.com"
                  });
                  showToast("Welcome back, Vijay! (Bypass Mode)", "success");
                }}
                className="flex flex-col items-center justify-center p-2 border border-dashed border-indigo-200/50 dark:border-stone-800 rounded-xl bg-indigo-500/5 hover:bg-indigo-500/10 dark:hover:bg-stone-850 cursor-pointer text-center group transition-all"
              >
                <span className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 group-hover:text-indigo-700">Vijay Naik</span>
                <span className="text-[7.5px] font-black text-gray-400 dark:text-stone-550 uppercase tracking-wider block mt-0.5">Owner Access</span>
              </button>
              <button
                type="button"
                focused-id="bypass-demo-tech"
                onClick={() => {
                  onLoginSuccess({
                    id: "bypass_tech_uid_1",
                    name: "Anand Kumar",
                    role: "Technician",
                    email: "anand@invservice.com"
                  });
                  showToast("Welcome back, Anand! (Bypass Mode)", "success");
                }}
                className="flex flex-col items-center justify-center p-2 border border-dashed border-indigo-200/50 dark:border-stone-800 rounded-xl bg-indigo-500/5 hover:bg-indigo-500/10 dark:hover:bg-stone-850 cursor-pointer text-center group transition-all"
              >
                <span className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 group-hover:text-indigo-700">Anand Kumar</span>
                <span className="text-[7.5px] font-black text-gray-400 dark:text-stone-550 uppercase tracking-wider block mt-0.5">Tech Access</span>
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
