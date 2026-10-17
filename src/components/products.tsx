"use client";
import { useState } from "react";
import { useDialogFocus } from "./use-dialog-focus";
import { Plus, Search, Package, ArrowUpRight, X, Trash2 } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import type { Product } from "@/lib/types";
import { money } from "./order-table";
import { productInput } from "@/lib/validation";
type Draft = {
  id?: string;
  name: string;
  description: string;
  price_mad: number;
  active: boolean;
  variants: { id?: string; size: string; color: string; stock: number }[];
};
const empty = (): Draft => ({
  name: "",
  description: "",
  price_mad: 149,
  active: true,
  variants: ["S", "M", "L", "XL"].map((size) => ({
    size,
    color: "Noir",
    stock: 0,
  })),
});
export function Products() {
  const { data, setData, refresh } = useWorkspace(),
    [query, setQuery] = useState(""),
    [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useDialogFocus(Boolean(draft));
  const products = data.products.filter((product) =>
    product.name.toLowerCase().includes(query.toLowerCase()),
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setMessage("");
    try {
      const parsed = productInput.safeParse(draft);
      if (!parsed.success)
        throw new Error(
          "Vérifiez les champs : variantes uniques, prix positif et stocks valides.",
        );
      if (data.demo) {
        const id = draft.id || crypto.randomUUID();
        const product: Product = {
          ...draft,
          id,
          store_id: data.store.id,
          created_at: new Date().toISOString(),
          variants: draft.variants.map((v) => ({
            ...v,
            id: v.id || crypto.randomUUID(),
            product_id: id,
            store_id: data.store.id,
          })),
        };
        setData((previous) => ({
          ...previous,
          products: previous.products.some((p) => p.id === id)
            ? previous.products.map((p) => (p.id === id ? product : p))
            : [product, ...previous.products],
        }));
      } else {
        const response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Enregistrement impossible.");
        await refresh();
      }
      setDraft(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">VOTRE CATALOGUE, TOUJOURS À JOUR</div>
          <h1>Produits & inventaire</h1>
          <p>Les bons produits. Les bonnes tailles. Le bon stock.</p>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            setDraft(empty());
            setMessage("");
          }}
        >
          <Plus size={16} />
          Ajouter un produit
        </button>
      </div>
      <div className="catalog-summary">
        <span>
          <Package size={16} />
          <strong>{data.products.length}</strong> produits au catalogue
        </span>
        <span>
          <i className="green-dot" />
          {data.products.reduce(
            (total, p) =>
              total + p.variants.reduce((sum, v) => sum + v.stock, 0),
            0,
          )}{" "}
          unités disponibles
        </span>
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Rechercher un produit"
            placeholder="Rechercher un produit…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="product-grid">
        {products.map((product, i) => {
          const stock = product.variants.reduce((sum, v) => sum + v.stock, 0);
          return (
            <article className="product-card panel" key={product.id}>
              <div className={"product-art art-" + (i % 4)}>
                <svg viewBox="0 0 180 160" aria-hidden="true">
                  <path
                    d="M62 30 38 40 16 75l25 15 13-19v68h72V71l13 19 25-15-22-35-24-10c-8 17-48 17-56 0Z"
                    fill="currentColor"
                  />
                  <path
                    d="M72 33c4 12 32 12 36 0"
                    fill="none"
                    stroke="#ffffff70"
                    strokeWidth="3"
                  />
                </svg>
                <span
                  className={
                    "stock-tag " + (!stock ? "out" : stock <= 10 ? "low" : "")
                  }
                >
                  {!stock
                    ? "Rupture de stock"
                    : stock <= 10
                      ? "Stock faible"
                      : "En stock"}
                </span>
              </div>
              <div className="product-body">
                <div className="product-heading">
                  <h2>{product.name}</h2>
                  <button
                    className="icon-btn"
                    aria-label={"Modifier " + product.name}
                    onClick={() => {
                      setDraft({
                        ...product,
                        variants: product.variants.map((v) => ({ ...v })),
                      });
                      setMessage("");
                    }}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </div>
                <p>{product.description || "Votre prochain best-seller."}</p>
                <div className="size-chips">
                  {Array.from(new Set(product.variants.map((v) => v.size))).map(
                    (size) => (
                      <span key={size}>{size}</span>
                    ),
                  )}
                  <small>
                    {Array.from(
                      new Set(product.variants.map((v) => v.color)),
                    ).join(" · ")}
                  </small>
                </div>
                <div className="product-footer">
                  <strong>{money(product.price_mad)}</strong>
                  <span>{stock} unités</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!products.length && (
        <div className="empty-state panel">
          <Package size={30} />
          <h3>Votre catalogue attend son premier produit.</h3>
          <button className="btn primary" onClick={() => setDraft(empty())}>
            Ajouter un produit
          </button>
        </div>
      )}
      {draft && (
        <div className="modal-backdrop">
          <section
            className="modal wide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">CATALOGUE</span>
                <h2 id="product-title">
                  {draft.id ? "Modifier le produit" : "Un nouveau produit"}
                </h2>
              </div>
              <button
                className="icon-btn"
                aria-label="Fermer"
                onClick={() => setDraft(null)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={save} className="editor-form">
              <div className="form-grid">
                <label>
                  Nom du produit
                  <input
                    required
                    maxLength={120}
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Prix en DH
                  <input
                    required
                    type="number"
                    min="0.01"
                    max="100000"
                    step="0.01"
                    value={draft.price_mad}
                    onChange={(e) =>
                      setDraft({ ...draft, price_mad: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <label>
                Description
                <textarea
                  maxLength={1000}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </label>
              <div className="variant-header">
                <h3>Tailles, couleurs & stock</h3>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      variants: [
                        ...draft.variants,
                        { size: "M", color: "", stock: 0 },
                      ],
                    })
                  }
                >
                  <Plus size={14} />
                  Ajouter une variante
                </button>
              </div>
              <div className="variants-editor">
                {draft.variants.map((variant, index) => (
                  <div className="variant-row" key={index}>
                    <label>
                      Taille
                      <select
                        value={variant.size}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            variants: draft.variants.map((v, i) =>
                              i === index ? { ...v, size: e.target.value } : v,
                            ),
                          })
                        }
                      >
                        {["S", "M", "L", "XL"].map((size) => (
                          <option key={size}>{size}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Couleur
                      <input
                        required
                        maxLength={40}
                        value={variant.color}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            variants: draft.variants.map((v, i) =>
                              i === index ? { ...v, color: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Stock
                      <input
                        required
                        type="number"
                        min="0"
                        max="1000000"
                        value={variant.stock}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            variants: draft.variants.map((v, i) =>
                              i === index
                                ? { ...v, stock: Number(e.target.value) }
                                : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={
                        Boolean(variant.id) || draft.variants.length <= 1
                      }
                      title={
                        variant.id
                          ? "Pour retirer une variante existante, mettez son stock à zéro."
                          : "Retirer"
                      }
                      aria-label={"Retirer la variante " + (index + 1)}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          variants: draft.variants.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) =>
                    setDraft({ ...draft, active: e.target.checked })
                  }
                />
                Disponible pour l’assistant WhatsApp
              </label>
              {message && (
                <p role="alert" className="form-message">
                  {message}
                </p>
              )}
              <button disabled={busy} className="btn primary">
                {busy ? "Enregistrement…" : "Enregistrer le produit"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
