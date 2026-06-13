import { Home, Users, Hammer, Package, MoreHorizontal } from "lucide-react";

export type TabType = "home" | "customers" | "services" | "stock" | "more";

interface BottomNavProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  pendingJobsCount: number;
  lowStockCount: number;
}

export default function BottomNav({
  currentTab,
  setCurrentTab,
  pendingJobsCount,
  lowStockCount
}: BottomNavProps) {
  const tabs = [
    { id: "home" as TabType, label: "Home", icon: Home },
    { id: "customers" as TabType, label: "Clients", icon: Users },
    { id: "services" as TabType, label: "Jobs", icon: Hammer, badge: pendingJobsCount },
    { id: "stock" as TabType, label: "Stock", icon: Package, badge: lowStockCount },
    { id: "more" as TabType, label: "More", icon: MoreHorizontal }
  ];

  return (
    <nav className="sticky bottom-0 z-40 bg-white/85 dark:bg-stone-900/85 backdrop-blur-md border-t border-slate-100 dark:border-stone-800/60 flex items-center justify-around py-3 px-2 transition-colors duration-200">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            className="flex flex-col items-center justify-center flex-1 py-0.5 relative group focus:outline-none transition-all active:scale-95"
            id={`nav-tab-${tab.id}`}
          >
            <div className="relative pb-0.5">
              <Icon
                className={`w-5 h-5 transition-transform duration-150 ${
                  isActive
                    ? "text-[#059669] dark:text-emerald-400 scale-110 font-bold"
                    : "text-slate-400 dark:text-stone-500 group-hover:text-slate-600 dark:group-hover:text-stone-300"
                }`}
              />
              
              {/* Optional notifications bubble */}
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute -top-1.5 -right-2.5 bg-rose-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md border border-white dark:border-stone-900">
                  {tab.badge}
                </span>
              ) : null}
            </div>

            <span
              className={`text-[9px] font-bold tracking-widest uppercase transition-all mt-1 ${
                isActive
                  ? "text-[#059669] dark:text-emerald-400 font-extrabold"
                  : "text-slate-400 dark:text-stone-500"
              }`}
            >
              {tab.label}
            </span>

            {/* Micro active animation dot */}
            {isActive && (
              <span className="absolute bottom-[-6px] w-1.5 h-1.5 rounded-full bg-[#059669] dark:bg-emerald-400"></span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
