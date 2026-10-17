"use client";

import { useState } from "react";
import { X, Truck, Download, Check, AlertCircle } from "lucide-react";
import type { Order } from "@/lib/types";
import { money } from "./order-table";
import { useWorkspace } from "./workspace-provider";

export type CarrierFormat = "cathedis" | "ameex" | "sendit" | "standard";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
}

function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+\-@]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function DeliveryExportModal({ isOpen, onClose, orders }: Props) {
  const { data, refresh, setData } = useWorkspace();
  const [carrier, setCarrier] = useState<CarrierFormat>("cathedis");
  const [onlyConfirmed, setOnlyConfirmed] = useState(true);
  const [allowOpenPackage, setAllowOpenPackage] = useState(true);
  const [markAsShipped, setMarkAsShipped] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");

  if (!isOpen) return null;

  // Filtrer les commandes à exporter
  const candidateOrders = onlyConfirmed
    ? orders.filter((o) => o.status === "CONFIRMED")
    : orders.filter((o) => o.status !== "CANCELLED");

  const totalAmount = candidateOrders.reduce((sum, o) => sum + o.total_mad, 0);

  async function handleExport() {
    if (candidateOrders.length === 0) {
      setExportMessage("Aucune commande éligible à exporter.");
      return;
    }

    setIsExporting(true);
    setExportMessage("");

    try {
      let headers: string[] = [];
      let rows: (string | number)[][] = [];
      const today = new Date().toISOString().split("T")[0];

      if (carrier === "cathedis" || carrier === "sendit") {
        // Format standard EcoTrack / Cathedis / Sendit
        headers = [
          "Destinataire",
          "Téléphone",
          "Ville",
          "Adresse",
          "Montant CRBT (DH)",
          "Marchandise",
          "Référence Commande",
          "Ouvrir colis",
          "Commentaire",
        ];
        rows = candidateOrders.map((o) => [
          o.customer_name,
          o.phone,
          o.city,
          o.address,
          o.total_mad,
          `${o.product_name} (${o.size} - ${o.color}) x${o.quantity}`,
          `#${o.id.slice(-6).toUpperCase()}`,
          allowOpenPackage ? "OUI" : "NON",
          allowOpenPackage
            ? "Client autorisé à vérifier le colis avant paiement. Paiement à la livraison."
            : "Paiement à la livraison.",
        ]);
      } else if (carrier === "ameex") {
        // Format Ameex / Ozone Express
        headers = [
          "Code Envoi / Réf",
          "Nom & Prénom",
          "Téléphone",
          "Ville Destination",
          "Adresse Complète",
          "CRBT (Montant)",
          "Désignation Marchandise",
          "Remarque Livreur",
        ];
        rows = candidateOrders.map((o) => [
          `#${o.id.slice(-6).toUpperCase()}`,
          o.customer_name,
          o.phone,
          o.city,
          o.address,
          o.total_mad,
          `${o.product_name} - ${o.size}/${o.color} (x${o.quantity})`,
          allowOpenPackage
            ? "Ouvrir colis autorisé. Merci d'appeler le client avant livraison."
            : "Paiement en espèces à la livraison.",
        ]);
      } else {
        // Format Standard Wasla complet
        headers = [
          "Réf",
          "Date",
          "Client",
          "Téléphone",
          "Ville",
          "Adresse",
          "Produit",
          "Taille",
          "Couleur",
          "Quantité",
          "Prix Unitaire DH",
          "Frais Livraison DH",
          "Total DH",
          "Statut",
        ];
        rows = candidateOrders.map((o) => [
          `#${o.id.slice(-6).toUpperCase()}`,
          new Date(o.created_at).toLocaleDateString("fr-FR"),
          o.customer_name,
          o.phone,
          o.city,
          o.address,
          o.product_name,
          o.size,
          o.color,
          o.quantity,
          o.unit_price_mad,
          o.delivery_fee_mad,
          o.total_mad,
          o.status,
        ]);
      }

      // Générer le CSV avec UTF-8 BOM pour ouverture directe et propre dans Excel
      const content =
        "\uFEFF" +
        [headers, ...rows]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n");

      const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wasla-livraison-${carrier}-${today}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      // Si l'option "Marquer comme expédiée" est cochée
      if (markAsShipped && candidateOrders.length > 0) {
        if (data.demo) {
          const exportedIds = new Set(candidateOrders.map((o) => o.id));
          setData((prev) => ({
            ...prev,
            orders: prev.orders.map((o) =>
              exportedIds.has(o.id) ? { ...o, status: "SHIPPED" } : o,
            ),
          }));
        } else {
          // Mettre à jour les statuts via l'API
          for (const order of candidateOrders) {
            if (order.status === "CONFIRMED") {
              try {
                await fetch(`/api/orders/${order.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "SHIPPED" }),
                });
              } catch {
                // Continuer pour les autres
              }
            }
          }
          await refresh();
        }
      }

      setExportMessage("Fichier téléchargé avec succès !");
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setExportMessage(
        err instanceof Error ? err.message : "Erreur lors de l'export.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal wide-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                padding: "8px",
                borderRadius: "8px",
                background: "#eff5e9",
                color: "#4e7041",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Truck size={20} />
            </span>
            <div>
              <h2 style={{ fontSize: "16px", margin: 0 }}>
                Exporter pour sociétés de livraison
              </h2>
              <p style={{ fontSize: "11px", color: "var(--muted)", margin: "3px 0 0" }}>
                Fichiers prêts à être importés dans votre plateforme de livraison au Maroc.
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {/* Choix du transporteur */}
        <div style={{ margin: "20px 0" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
            Sélectionnez le transporteur / Format d'import :
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            {[
              {
                id: "cathedis",
                name: "Cathedis / EcoTrack",
                desc: "Standard Maroc (Maystro, Tawsil, etc.)",
              },
              {
                id: "ameex",
                name: "Ameex Express / Ozone",
                desc: "Format avec CRBT et désignation",
              },
              {
                id: "sendit",
                name: "Sendit.ma",
                desc: "Format compatible plateforme Sendit",
              },
              {
                id: "standard",
                name: "Format Général Wasla",
                desc: "Toutes les colonnes détaillées",
              },
            ].map((c) => (
              <div
                key={c.id}
                onClick={() => setCarrier(c.id as CarrierFormat)}
                style={{
                  border: carrier === c.id ? "1.5px solid #4a754b" : "1px solid var(--line)",
                  background: carrier === c.id ? "#f5f9f2" : "#fff",
                  borderRadius: "8px",
                  padding: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "12px", color: "#324838" }}>{c.name}</strong>
                  {carrier === c.id && <Check size={14} color="#4a754b" />}
                </div>
                <small style={{ display: "block", color: "var(--muted)", fontSize: "10px", marginTop: "4px" }}>
                  {c.desc}
                </small>
              </div>
            ))}
          </div>
        </div>

        {/* Options de filtrage et paramètres */}
        <div
          style={{
            background: "#fafbf9",
            border: "1px solid var(--line)",
            borderRadius: "8px",
            padding: "14px",
            margin: "18px 0",
            display: "grid",
            gap: "12px",
          }}
        >
          <label className="check-label" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={onlyConfirmed}
              onChange={(e) => setOnlyConfirmed(e.target.checked)}
            />
            <span>
              <strong>Commandes confirmées uniquement</strong> (Recommandé : ignore les commandes en attente ou annulées)
            </span>
          </label>

          <label className="check-label" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={allowOpenPackage}
              onChange={(e) => setAllowOpenPackage(e.target.checked)}
            />
            <span>
              <strong>Autoriser l'ouverture du colis devant le livreur</strong> (Indique OUI dans la remarque pour rassurer le client)
            </span>
          </label>

          <label className="check-label" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={markAsShipped}
              onChange={(e) => setMarkAsShipped(e.target.checked)}
            />
            <span>
              <strong>Passer automatiquement ces commandes en statut « Expédiée »</strong> après le téléchargement
            </span>
          </label>
        </div>

        {/* Récapitulatif */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            background: "#edf4e8",
            borderRadius: "7px",
            fontSize: "12px",
            color: "#40643b",
          }}
        >
          <span>
            <strong>{candidateOrders.length}</strong> commande(s) prête(s) à être expédiée(s)
          </span>
          <strong>Total COD : {money(totalAmount)}</strong>
        </div>

        {exportMessage && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px",
              borderRadius: "6px",
              background: exportMessage.includes("succès") ? "#eef7ee" : "#fdf0ed",
              color: exportMessage.includes("succès") ? "#356637" : "#b04b40",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {exportMessage.includes("succès") ? <Check size={14} /> : <AlertCircle size={14} />}
            <span>{exportMessage}</span>
          </div>
        )}

        <div className="action-row" style={{ marginTop: "22px", justifyContent: "flex-end" }}>
          <button className="btn secondary" onClick={onClose} disabled={isExporting}>
            Annuler
          </button>
          <button
            className="btn primary"
            onClick={() => void handleExport()}
            disabled={isExporting || candidateOrders.length === 0}
          >
            <Download size={14} />
            {isExporting ? "Génération en cours..." : `Télécharger le fichier (${candidateOrders.length})`}
          </button>
        </div>
      </section>
    </div>
  );
}
