"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
  { name: 'Sales', href: '/', icon: '🧾' },
  { name: 'Invoices', href: '/invoices', icon: '📋' },
  { name: 'Purchase', href: '/purchase', icon: '📦' },
  { name: 'Payments', href: '/payments', icon: '💰' },
  { name: 'Products', href: '/products', icon: '💊' },
  { name: 'Accounts', href: '/accounts', icon: '👥' },
  { name: 'Reports', href: '/reports', icon: '📊' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  return (
    <aside 
      className={`${expanded ? 'w-48' : 'w-14'} bg-slate-900 min-h-screen flex flex-col transition-all duration-200 ease-in-out`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="h-12 flex items-center justify-center border-b border-slate-700">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold">P</span>
        </div>
        {expanded && <span className="ml-2 text-white font-semibold text-sm">PharmaStream</span>}
      </div>

      {/* Menu */}
      <nav className="flex-1 py-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center h-10 px-4 mx-1 my-0.5 rounded transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-base w-6 text-center">{item.icon}</span>
              {expanded && <span className="ml-3 text-xs font-medium whitespace-nowrap">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-slate-700">
        <div className={`flex items-center ${expanded ? 'justify-start px-2' : 'justify-center'}`}>
          <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center">
            <span className="text-xs text-slate-300">A</span>
          </div>
          {expanded && <span className="ml-2 text-xs text-slate-400">Admin</span>}
        </div>
      </div>
    </aside>
  );
}
