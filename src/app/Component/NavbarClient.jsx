"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const ADMIN_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/poster", label: "Create Poster" },
  { href: "/dashboard/event", label: "Events" },
];

export default function NavbarClient({ isAdmin, authSlot }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const linkClass = (href) => {
    const active = pathname === href;
    return [
      "block rounded-full px-4 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-blue-600 text-white shadow-sm"
        : "text-gray-600 hover:bg-blue-50 hover:text-blue-600",
    ].join(" ");
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-500 text-lg font-bold text-white shadow">
            A
          </span>
          <span className="text-lg font-semibold tracking-tight text-gray-900">
            ACE Voting
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {isAdmin &&
            ADMIN_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                {l.label}
              </Link>
            ))}
          <span className="ml-2">{authSlot}</span>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          className="inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden cursor-pointer"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-gray-200/70 bg-white md:hidden">
          <div className="mx-auto flex max-w-screen-xl flex-col gap-1 px-4 py-3">
            {isAdmin &&
              ADMIN_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={linkClass(l.href)}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
            <span className="mt-1">{authSlot}</span>
          </div>
        </div>
      )}
    </nav>
  );
}
