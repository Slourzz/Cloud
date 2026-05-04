import React, { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Music, ListMusic, ListVideo } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Music, label: "Now Playing" },
    { href: "/library", icon: ListMusic, label: "Library" },
    { href: "/queue", icon: ListVideo, label: "Queue" },
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-surface text-on-surface overflow-hidden relative shadow-2xl sm:rounded-[32px] sm:my-8 sm:h-[calc(100vh-4rem)] sm:border border-outline-variant">
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative pb-20">
        {children}
      </main>

      {/* M3 Navigation Bar */}
      <nav className="absolute bottom-0 w-full h-20 bg-surface-container elevation-2 flex items-center justify-around px-2 z-50">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center justify-center w-16 h-14 rounded-[16px] cursor-pointer ripple select-none transition-colors duration-200",
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-16 h-8 rounded-full transition-all duration-300",
                    isActive ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant hover:bg-on-surface/5"
                  )}
                >
                  <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span
                  className={cn(
                    "text-[12px] font-medium mt-1 transition-colors duration-200",
                    isActive ? "text-on-surface" : "text-on-surface-variant"
                  )}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
