"use client";
import { useState } from "react";
import { useDialogFocus } from "./use-dialog-focus";
import Link from "next/link";
import { Search, ArrowUpRight, Download, ShoppingBag, X, Truck } from "lucide-react";
import type { Order, Status } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";
import { DeliveryExportModal } from "./delivery-export-modal";

export const money = (value: number) =>
  new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(value) +
  " DH";

const labels: Record<Status, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  CANCELLED: "Annulée",
  SHIPPED: "Expédiée",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={"status-badge " + status}>
      <i />
      {labels[status]}
    </span>
  );
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+\-@]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function OrderTable({ compact = false }: { compact?: boolean }) {
  const { data, refresh, setData } = useWorkspace(),
    [filter, setFilter] = useState("ALL"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Order | null>(null),
    [showDeliveryModal, setShowDeliveryModal] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);

  useDialogFocus(Boolean(selected));

  const filtered = data.orders.filter(
    (order) =>
      (filter === "ALL" || order.status === filter) &&
      [
        order.customer_name,
        order.phone,
        order.city,
        order.product_name,
        order.id,
      ].some((value) => value.toLowerCase().includes(query.toLowerCase())),
  );

  const orders = compact ? filtered.slice(0, 5) : filtered;

  function downloadRawCsv() {
    const headers = [
      "Order ID",
      "Client",
      "Téléphone",
      "Produit",
      "Taille",
      "Couleur",
      "Quantité",
      "Ville",
      "Adresse",
      "Total DH",
      "Statut",
    ];
    const content =
      "\uFEFF" +
      [
        headers,
        ...filtered.map((o) => [
          o.id,
          o.customer_name,
          o.phone,
          o.product_name,
          o.size,
          o.color,
          o.quantity,
          o.city,
          o.address,
          o.total_mad,
          o.status,
        ]),
      ]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    link.download = "wasla-commandes-brut.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function updateStatus(status: Status) {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      if (data.demo) {
        setData((previous) => ({
          ...previous,
          orders: previous.orders.map((order) =>
            order.id === selected.id ? { ...order, status } : order,
          ),
        }));
      } else {
        const response = await fetch("/api/orders/" + selected.id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!response.ok) throw new Error();
        await refresh();
      }
      setSelected({ ...selected, status });
      setMessage("Statut mis à jour.");
    } catch {
      setMessage("Mise à jour impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="panel orders-panel">
        <div className="panel-title">
          <div>
            <h2>
              {compact ? "Les dernières commandes" : "Toutes les commandes"}
              <span className="count-chip">{data.orders.length}</span>
            </h2>
            <p>
              {compact
                ? "Votre activité, en un clin d’œil."
                : "Retrouvez chaque commande et suivez son avancement."}
            </p>
          </div>
          {compact ? (
            <Link href="/orders" className="text-link">
              Tout voir <ArrowUpRight size={15} />
            </Link>
          ) : (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                className="btn primary small-btn"
                onClick={() => setShowDeliveryModal(true)}
              >
                <Truck size={14} />
                Exporter pour livraison 🚚
              </button>
              <button
                className="btn secondary small-btn"
                onClick={downloadRawCsv}
              >
                <Download size={14} />
                CSV Brut
              </button>
            </div>
          )}
        </div>
        {!compact && (
          <div className="table-toolbar">
            <div className="tabs">
              {[
                ["ALL", "Toutes"],
                ["PENDING", "En attente"],
                ["CONFIRMED", "Confirmées"],
                ["SHIPPED", "Expédiées"],
                ["CANCELLED", "Annulées"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={filter === value ? "selected" : ""}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="search">
              <Search size={16} />
              <input
                aria-label="Rechercher une commande"
                placeholder="Rechercher un client, une ville…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Commande</th>
                <th>Client</th>
                <th>Produit</th>
                <th>Ville</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>
                  <span className="sr-only">Détails</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => (
                <tr key={order.id}>
                  <td>
                    <button
                      className="order-id"
                      onClick={() => setSelected(order)}
                    >
                      #{order.id.slice(-6).toUpperCase()}
                    </button>
                    <small>
                      {new Date(order.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </small>
                  </td>
                  <td>
                    <div className="customer">
                      <span className={"customer-avatar tone-" + (i % 4)}>
                        {order.customer_name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span>
                        <strong>{order.customer_name}</strong>
                        <small>{order.phone}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong className="product-name">
                      {order.product_name}
                    </strong>
                    <small>
                      {order.size} · {order.color} · Qté {order.quantity}
                    </small>
                  </td>
                  <td>{order.city}</td>
                  <td className="amount">{money(order.total_mad)}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      aria-label={
                        "Détails de la commande de " + order.customer_name
                      }
                      onClick={() => setSelected(order)}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!orders.length && (
            <div className="empty-state">
              <ShoppingBag size={30} />
              <h3>Aucune commande pour le moment</h3>
              <p>Les commandes de votre assistant apparaîtront ici.</p>
            </div>
          )}
        </div>
        <div className="table-bottom">
          <span>
            {orders.length} sur {filtered.length} commandes
          </span>
          <span className="live-indicator">
            <i />
            {data.demo
              ? "Aperçu de démonstration"
              : "Synchronisation Supabase active"}
          </span>
        </div>
      </section>

      {/* Modal Détails d'une commande */}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <h2 id="order-title">Commande #{selected.id.slice(-6)}</h2>
              <button
                className="icon-btn"
                onClick={() => setSelected(null)}
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            <StatusBadge status={selected.status} />
            <dl className="details">
              <dt>Client</dt>
              <dd>{selected.customer_name}</dd>
              <dt>Téléphone</dt>
              <dd>{selected.phone}</dd>
              <dt>Livraison</dt>
              <dd>
                {selected.address}, {selected.city}
              </dd>
              <dt>Article</dt>
              <dd>
                {selected.product_name} · {selected.size} · {selected.color} ×
                {selected.quantity}
              </dd>
              <dt>Total</dt>
              <dd>
                {money(selected.total_mad)} (livraison{" "}
                {money(selected.delivery_fee_mad)})
              </dd>
            </dl>
            <p className="muted">
              Les annulations et confirmations mettent à jour le stock dans une
              transaction.
            </p>
            <div className="action-row">
              {(["CONFIRMED", "SHIPPED", "CANCELLED"] as Status[]).map(
                (status) => (
                  <button
                    className="btn secondary"
                    disabled={busy || status === selected.status}
                    key={status}
                    onClick={() => void updateStatus(status)}
                  >
                    {labels[status]}
                  </button>
                ),
              )}
            </div>
            {message && <p role="status">{message}</p>}
          </section>
        </div>
      )}

      {/* Modal d'exportation pour sociétés de livraison */}
      <DeliveryExportModal
        isOpen={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        orders={filtered}
      />
    </>
  );
}
