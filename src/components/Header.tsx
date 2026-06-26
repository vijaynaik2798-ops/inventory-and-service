import { Sun, Moon, RefreshCw, Layers } from "lucide-react";
import { User } from "../types";
// @ts-ignore
import stockivoLogo from "../assets/images/stockivo_logo_v4_1782356434674.jpg";

interface HeaderProps {
  currentUser: User | null;
  syncStatus: "live" | "syncing" | "offline";
  onRefresh: () => void;
  dark: boolean;
  setDark: (val: boolean) => void;
}

export default function Header({
  currentUser,
  syncStatus,
  onRefresh,
  dark,
  setDark
}: HeaderProps) {
  // Map sync state to styling
  const syncStyleMap = {
    live: { color: "text-emerald-500", text: "☁ Live", bg: "bg-emerald-500/10" },
    syncing: { color: "text-amber-500 animate-spin", text: "⟳ Sync", bg: "bg-amber-500/10" },
    offline: { color: "text-rose-500", text: "⚠ Offline", bg: "bg-rose-500/10" }
  };

  const syncState = syncStyleMap[syncStatus] || syncStyleMap.live;

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case "Owner":
        return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30";
      case "Manager":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30";
      case "Technician":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30";
      default:
        return "bg-gray-500/15 text-gray-700 dark:text-gray-400 border border-gray-500/30";
    }
  };

  return (
    <header className="bg-white/85 dark:bg-stone-900/85 backdrop-blur-md px-5 py-3.5 flex justify-between items-center border-b border-slate-100 dark:border-stone-800/80 sticky top-0 z-40 transition-colors duration-200">
      <div className="flex items-center gap-2.5">
        <img
          src={stockivoLogo}
          alt="STOCKIVO LOGO"
          className="w-8 h-8 rounded-xl object-cover shadow-sm border border-slate-200/50 dark:border-stone-800 bg-white"
          referrerPolicy="no-referrer"
        />
        <div className="flex flex-col">
          <span className="text-gray-900 dark:text-white font-black text-md tracking-tight leading-none font-sans">STOCKIVO</span>
          <span className="text-[7.5px] font-black tracking-widest text-[#6366f1] dark:text-indigo-400 mt-1 font-mono">INTELLIGENCE</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Sync Status Button */}
        <button
          onClick={onRefresh}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide transition-all active:scale-95 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40`}
          title="Force Cloud Check"
          id="hdr-sync-btn"
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 ${syncStatus === 'syncing' ? 'animate-ping' : 'animate-pulse'}`}></span>
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            {syncStatus === 'syncing' ? "Sync" : "Live"}
          </span>
          <RefreshCw className={`w-3 h-3 text-emerald-600 dark:text-emerald-400 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
        </button>

        {/* Light/Dark Toggle */}
        <button
          onClick={() => setDark(!dark)}
          className="p-1.5 rounded-full text-slate-500 hover:text-slate-850 dark:text-stone-400 dark:hover:text-stone-200 bg-slate-50 hover:bg-slate-100 dark:bg-stone-800/50 dark:hover:bg-stone-800 transition-all border border-slate-100 dark:border-stone-800/60"
          title={dark ? "Switch To Light Mode" : "Switch To Dark Mode"}
          id="hdr-theme-btn"
        >
          {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        {/* Current user role badge */}
        {currentUser && (
          <div className="flex items-center gap-1.5 ml-1 pl-1.5 border-l border-slate-100 dark:border-stone-800/60">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-800 dark:text-stone-200 truncate max-w-[65px] leading-tight">
                {currentUser.name.split(" ")[0]}
              </span>
              <span className={`text-[8px] font-black px-1 rounded uppercase scale-90 ${getRoleBadgeColor(currentUser.role)}`}>
                {currentUser.role}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
