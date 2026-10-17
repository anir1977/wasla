"use client";
import { useState } from "react";
import Image from "next/image";
import {
  Store,
  Truck,
  Upload,
  Check,
  Save,
  Plug,
  ExternalLink,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
export function Settings() {
  const { data, setData, refresh } = useWorkspace(),
    [draft, setDraft] = useState(data.store),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (data.demo) {
        if (file) {
          setMessage(
            "Aperçu démo : l’upload de logo nécessite Supabase Storage.",
          );
          return;
        }
        setData((previous) => ({ ...previous, store: draft }));
      } else {
        const body = new FormData();
        body.set(
          "settings",
          JSON.stringify({
            name: draft.name,
            phone: draft.phone,
            delivery_casa: draft.delivery_casa,
            delivery_other: draft.delivery_other,
            ai_enabled: draft.ai_enabled,
          }),
        );
        if (file) body.set("logo", file);
        const response = await fetch("/api/settings", { method: "POST", body });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Enregistrement impossible");
        await refresh();
      }
      setMessage(
        data.demo
          ? "Aperçu mis à jour pour cette session."
          : "Votre boutique est à jour.",
      );
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
          <div className="eyebrow">À VOTRE IMAGE</div>
          <h1>Ma boutique</h1>
          <p>Les petits détails qui font votre différence.</p>
        </div>
      </div>
      <form onSubmit={save} className="settings-layout">
        <div>
          <section className="panel settings-panel">
            <div className="panel-title">
              <div>
                <h2>
                  <Store size={18} />
                  Identité de la boutique
                </h2>
                <p>Présentez-vous à vos clients.</p>
              </div>
            </div>
            <div className="settings-fields">
              <div className="logo-upload">
                <span className="store-logo">
                  {data.store.logo_path ? (
                    <Image
                      unoptimized
                      width={64}
                      height={64}
                      alt="Logo de la boutique"
                      src={
                        "/api/logo?path=" +
                        encodeURIComponent(data.store.logo_path)
                      }
                    />
                  ) : (
                    draft.name.slice(0, 1)
                  )}
                </span>
                <div>
                  <label className="upload-label">
                    <Upload size={14} />
                    Importer un logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <small>
                    {file ? file.name : "PNG, JPG ou WebP · 2 Mo maximum"}
                  </small>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  Nom de la boutique
                  <input
                    required
                    maxLength={100}
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Numéro WhatsApp
                  <input
                    type="tel"
                    required
                    placeholder="+212600000000"
                    value={draft.phone}
                    onChange={(e) =>
                      setDraft({ ...draft, phone: e.target.value })
                    }
                  />
                </label>
              </div>
            </div>
          </section>
          <section className="panel settings-panel">
            <div className="panel-title">
              <div>
                <h2>
                  <Truck size={19} />
                  Livraison au Maroc
                </h2>
                <p>Ces frais sont ajoutés aux commandes par l’assistant.</p>
              </div>
            </div>
            <div className="settings-fields">
              <div className="form-grid">
                <label>
                  Casablanca · DH
                  <input
                    type="number"
                    required
                    min="0"
                    max="1000"
                    step="0.01"
                    value={draft.delivery_casa}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        delivery_casa: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Autres villes · DH
                  <input
                    type="number"
                    required
                    min="0"
                    max="1000"
                    step="0.01"
                    value={draft.delivery_other}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        delivery_other: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <div className="inline-note">
                <Check size={14} /> Paiement à la livraison · montants en
                dirhams marocains.
              </div>
            </div>
          </section>
          <section className="panel settings-panel">
            <div className="settings-fields ai-toggle-row">
              <div>
                <h2>L’assistant peut répondre</h2>
                <p>En Darija et en français, selon la langue du client.</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={draft.ai_enabled}
                  onChange={(e) =>
                    setDraft({ ...draft, ai_enabled: e.target.checked })
                  }
                />
                <span className="sr-only">Activer les réponses Gemini</span>
              </label>
            </div>
          </section>
          <div className="save-row">
            <p role="status">{message}</p>
            <button disabled={busy} className="btn primary">
              <Save size={15} />
              {busy ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
          </div>
        </div>
        <aside>
          <section className="panel setup-card" id="setup">
            <div className="setup-icon">
              <Plug size={23} />
            </div>
            <h2>Prêt pour le réel ?</h2>
            <p>
              {data.demo
                ? "Cette visite utilise des données fictives. Pour activer votre boutique :"
                : "Les connexions de votre boutique sont configurées côté serveur."}
            </p>
            <ol className="setup-list">
              <li>Créez votre projet Supabase et appliquez la migration.</li>
              <li>
                Renseignez les clés dans <code>.env.local</code>.
              </li>
              <li>
                Désactivez <code>DEMO_MODE</code>, puis redémarrez.
              </li>
              <li>Inscrivez-vous et connectez WhatsApp par QR.</li>
            </ol>
            <a
              className="text-link"
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir Supabase <ExternalLink size={13} />
            </a>
          </section>
          <div className="privacy-note">
            <Check size={17} />
            <p>
              Les clés Gemini et les sessions WhatsApp restent côté serveur.
              Chaque boutique accède uniquement à ses données.
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}
