import React, { useState } from "react";
import { User, UserRole, Staff } from "../types";
import { LogIn, UserPlus, Info, CheckCircle2 } from "lucide-react";

interface AuthScreenProps {
  users: any[];
  technicians?: Staff[];
  onLoginSuccess: (user: User) => void;
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
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("Technician");

  // Pre-configured test accounts for convenience
  const testAccounts = [
    { name: "Vijay Naik", role: "Owner" as UserRole, email: "vijaynaik2798@gmail.com", password: "password" },
    { name: "Anand Kumar", role: "Technician" as UserRole, email: "anand@invservice.com", password: "password" },
    { name: "Suresh Patil", role: "Manager" as UserRole, email: "suresh@invservice.com", password: "password" },
    { name: "Deepa Nair", role: "Receptionist" as UserRole, email: "deepa@invservice.com", password: "password" }
  ];

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      showToast("Email and password are required", "error");
      return;
    }

    if (isLogin) {
      // Look up in database, standard test accounts, or active staff/technicians
      const staffMatched = technicians.find(
        t => t.status === "Active" &&
             ((t.loginId && t.loginId.toLowerCase() === email.toLowerCase()) || 
              (t.id && t.id.toLowerCase() === email.toLowerCase())) &&
             t.password === password
      );

      const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password) ||
                      testAccounts.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password) ||
                      (staffMatched ? {
                        id: staffMatched.id,
                        name: staffMatched.name,
                        role: staffMatched.role as UserRole,
                        email: staffMatched.loginId || `${staffMatched.id}@invservice.com`
                      } : null);

      if (matched) {
        onLoginSuccess({
          id: matched.id || "U_" + Math.random().toString(36).substr(2, 9),
          name: matched.name,
          role: matched.role as UserRole,
          email: matched.email
        });
        showToast(`Welcome back, ${matched.name}!`, "success");
      } else {
        showToast("Invalid credentials! Try using a Quick Login card below.", "error");
      }
    } else {
      if (!name) {
        showToast("Name is required for registration", "error");
        return;
      }

      // Check if user already exists
      const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase()) ||
                     testAccounts.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (exists) {
        showToast("An account already exists with this email", "error");
        return;
      }

      const newUser = {
        id: "U_" + Math.random().toString(36).substr(2, 9),
        name,
        role,
        email: email.toLowerCase(),
        password
      };

      onRegisterUser(newUser);
      onLoginSuccess({
        id: newUser.id,
        name: newUser.name,
        role: newUser.role,
        email: newUser.email
      });
      showToast(`User ${name} registered & logged in!`, "success");
    }
  };

  const handleQuickLogin = (acc: typeof testAccounts[number]) => {
    // Check if user already registered or use test account directly
    onLoginSuccess({
      id: "TEST_" + acc.role.toUpperCase(),
      name: acc.name,
      role: acc.role,
      email: acc.email
    });
    showToast(`Quick Logged inside as: ${acc.name} (${acc.role})`, "success");
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-8 bg-slate-50 dark:bg-stone-950 transition-colors duration-200">
      <div className="w-full text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-blue-600 text-white font-black text-2xl shadow-xl border-4 border-white dark:border-stone-900 mb-3">
          INV
        </div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-stone-100 tracking-tight">
          Welcome to Inventory Service
        </h2>
        <p className="text-xs text-gray-500 dark:text-stone-400 font-medium max-w-[280px] mx-auto mt-1">
          Real-time CCTV & Electronics inventory and customer service workspace
        </p>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-lg hover:shadow-xl border border-gray-100/80 dark:border-stone-800 p-5 transition-all">
        {/* Toggle tabs */}
        <div className="flex bg-slate-100 dark:bg-stone-800 p-1 rounded-xl mb-5">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all ${
              isLogin
                ? "bg-white dark:bg-stone-700 text-gray-800 dark:text-stone-100 shadow-sm"
                : "text-gray-400 dark:text-stone-400 hover:text-gray-600"
            }`}
          >
            LogIn Account
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all ${
              !isLogin
                ? "bg-white dark:bg-stone-700 text-gray-800 dark:text-stone-100 shadow-sm"
                : "text-gray-400 dark:text-stone-400 hover:text-gray-600"
            }`}
          >
            Register Profile
          </button>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-[11px] font-bold text-gray-500 dark:text-stone-400 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Ramesh Patel"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-stone-400 uppercase tracking-wider mb-1">
              Email Address or Staff Login ID
            </label>
            <input
              type="text"
              placeholder="name@invservice.com or Staff ID..."
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-stone-400 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-[11px] font-bold text-gray-500 dark:text-stone-400 uppercase tracking-wider mb-1">
                Business Role
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                className="w-full text-xs bg-slate-50 dark:bg-stone-800 text-gray-800 dark:text-stone-100 border border-gray-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Owner">Owner (Full Admin Access)</option>
                <option value="Manager">Manager</option>
                <option value="Technician">Technician</option>
                <option value="Staff">Staff</option>
                <option value="Receptionist">Receptionist</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold text-xs py-3 rounded-xl shadow-md hover:from-emerald-700 hover:to-emerald-800 hover:shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
            id="auth-submit-btn"
          >
            {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {isLogin ? "Authenticate / Sign In" : "Register and Sign In"}
          </button>
        </form>
      </div>

      {/* Quick Test Logins Section */}
      <div className="mt-6">
        <div className="flex items-center gap-1.5 justify-center text-gray-400 mb-3 px-2">
          <Info className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Quick testing bypass cards
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2.5">
          {testAccounts.map((acc, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickLogin(acc)}
              className="text-left bg-white dark:bg-stone-900 border border-gray-100 dark:border-stone-800/80 p-2.5 rounded-xl shadow-sm hover:border-emerald-500/50 dark:hover:border-emerald-500/30 transition-all group"
            >
              <div className="text-[11px] font-bold text-gray-800 dark:text-stone-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                {acc.name}
              </div>
              <div className="flex items-center justify-between text-[9px] text-gray-400 dark:text-stone-400 font-semibold mt-1">
                <span>{acc.role}</span>
                <CheckCircle2 className="w-3 h-3 text-gray-200 group-hover:text-emerald-500 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
