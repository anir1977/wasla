"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  MessageCircle,
  Settings,
  ChevronDown,
  ArrowUpRight,
  LogOut,
  Menu,
  X,
  Store,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { signOut } from "@/app/auth/actions";
const links = [
  { href: "/", label: "Vue d’ensemble", icon: LayoutDashboard },
  { href: "/orders", label: "Commandes", icon: ShoppingBag },
  { href: "/products", label: "Produits & stock", icon: Package },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/settings", label: "Ma boutique", icon: Settings },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    { data } = useWorkspace(),
    [open, setOpen] = useState(false);
  const pending = data.orders.filter(
    (order) => order.status === "PENDING",
  ).length;
  return (
    <div className="app-shell">
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={"sidebar " + (open ? "mobile-open" : "")}>
        <Link href="/" className="wordmark">
          <span className="brand-mark">w</span>wasla
          <span className="brand-dot">.</span>
        </Link>
        <Link href="/settings" className="store-switch">
          <span className="store-icon">
            <Store size={19} />
          </span>
          <span>
            <strong>{data.store.name}</strong>
            <small>Votre espace commerçant</small>
          </span>
          <ChevronDown size={14} />
        </Link>
        <div className="nav-label">VOTRE ESPACE</div>
        <nav>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={"nav-link " + (path === href ? "active" : "")}
            >
              <Icon size={19} />
              <span>{label}</span>
              {href === "/orders" && pending > 0 && <b>{pending}</b>}
              {href === "/whatsapp" && <span className="tiny-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="spark">✧</span>
            <strong>Un coup de main ?</strong>
            <p>Tout pour lancer votre boutique, b chwiyya b chwiyya.</p>
            <Link href="/settings#setup">
              Guide de démarrage <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="account">
            <span className="avatar">{data.store.name.slice(0, 1)}</span>
            <span>
              <strong>{data.store.name}</strong>
              <small>
                {data.demo ? "Espace de démonstration" : data.email}
              </small>
            </span>
            <form action={signOut}>
              <button aria-label="Se déconnecter" className="icon-btn">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setOpen(!open)}
              aria-label="Menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Espace commerçant</span>
            <span>/</span>
            <strong>
              {links.find((link) => link.href === path)?.label ||
                "Tableau de bord"}
            </strong>
          </div>
          <div className="topbar-right">
            <span
              className={"pill " + (data.demo ? "demo-pill" : "secure-pill")}
            >
              <ShieldCheck size={13} />
              {data.demo ? "Mode démo" : "Espace privé"}
            </span>
            <span className="language">
              FR <ChevronDown size={12} />
            </span>
            <span className="avatar small">{data.store.name.slice(0, 1)}</span>
          </div>
        </header>
        <main className="page-content">
          {data.demo && (
            <div className="demo-banner">
              <span>
                Données fictives · Explorez votre future boutique. Aucun message
                réel n’est envoyé.
              </span>
              <Link href="/settings#setup">
                Connecter mes services <ArrowUpRight size={13} />
              </Link>
            </div>
          )}
          {children}
          <footer className="page-footer">
            <span>wasla. · Pensé au Maroc, pour votre commerce.</span>
            <span>Darija. Français. Et beaucoup de simplicité.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
