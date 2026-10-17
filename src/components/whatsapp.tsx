"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MessageCircle,
  QrCode,
  RefreshCw,
  Check,
  ArrowUpRight,
  ShieldCheck,
  Smartphone,
  Send,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";

type Connection = {
  state: string;
  qr?: string | null;
  phone?: string;
  error?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  time?: string;
  order?: {
    id: string;
    total_mad: number;
    product_name: string;
  } | null;
};

export function WhatsApp() {
  const { data } = useWorkspace();
  const [tab, setTab] = useState<"simulator" | "qr">("simulator");
  const [connection, setConnection] = useState<Connection>({
    state: data.demo ? "demo" : "loading",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // Simulator state
  const [input, setInput] = useState("");
  const [simLoading, setSimLoading] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Salam ! Marhba bik f ${data.store.name} 👋\nChno n9der n3awnek lyoum ? 3ndna sel3a n9iya w livraison partout au Maroc 🇲🇦`,
      time: "12:00",
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, simLoading]);

  const poll = useCallback(async () => {
    if (data.demo) return;
    try {
      const response = await fetch("/api/whatsapp", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Passerelle indisponible.");
      setConnection(result);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Passerelle indisponible.",
      );
    }
  }, [data.demo]);

  useEffect(() => {
    if (data.demo || tab !== "qr") return;
    const initial = setTimeout(() => void poll(), 0);
    const timer = setInterval(() => void poll(), 3000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [data.demo, tab, poll]);

  async function connect() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setConnection(result);
      await poll();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Connexion impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || simLoading) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const newChat: ChatMessage[] = [
      ...chat,
      { role: "user", content: text, time: timeStr },
    ];
    setChat(newChat);
    if (!textToSend) setInput("");
    setSimLoading(true);

    try {
      const historyPayload = newChat.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: historyPayload.slice(0, -1),
        }),
      });
      const json = await res.json();
      if (res.ok && json.reply) {
        setChat((prev) => [
          ...prev,
          {
            role: "assistant",
            content: json.reply,
            time: timeStr,
            order: json.order,
          },
        ]);
      } else {
        setChat((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              json.error ||
              "Sme7 lia, وقع مشكل فالاتصال بالذكاء الاصطناعي. عاود صيفط الميساج.",
            time: timeStr,
          },
        ]);
      }
    } catch {
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Erreur de connexion. Veuillez réessayer.",
          time: timeStr,
        },
      ]);
    } finally {
      setSimLoading(false);
    }
  }

  const connected = connection.state === "connected";

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LÀ OÙ SONT VOS CLIENTS</div>
          <h1>Assistant WhatsApp & Darija</h1>
          <p>
            Testez votre assistant en direct ou connectez votre vrai numéro WhatsApp par QR code.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div className="tabs" style={{ background: "#ffffff", padding: "4px", borderRadius: "10px", border: "1px solid var(--line)" }}>
            <button
              className={tab === "simulator" ? "selected" : ""}
              onClick={() => setTab("simulator")}
            >
              💬 Simulateur en direct
            </button>
            <button
              className={tab === "qr" ? "selected" : ""}
              onClick={() => setTab("qr")}
            >
              📱 Connexion QR
            </button>
          </div>
          <span className={"pill " + (connected ? "secure-pill" : "demo-pill")}>
            <i className="tiny-dot" />
            {connected ? "Connecté" : data.demo ? "Mode démo" : "IA active"}
          </span>
        </div>
      </div>

      {tab === "simulator" ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) 380px", gap: "24px", alignItems: "start" }}>
          {/* Main Simulator Card */}
          <section className="panel" style={{ borderRadius: "var(--radius-xl)", overflow: "hidden", display: "flex", flexDirection: "column", height: "660px", boxShadow: "var(--shadow-md)" }}>
            {/* WhatsApp Phone Bar */}
            <div style={{ background: "#0f4c3a", color: "#ffffff", padding: "14px 20px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#ecfdf5", color: "#065f46", display: "grid", placeItems: "center", fontWeight: "700", fontSize: "16px" }}>
                {data.store.name.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: "15px", fontWeight: "700", color: "#ffffff" }}>
                  {data.store.name}
                </strong>
                <small style={{ display: "flex", alignItems: "center", gap: "6px", color: "#a7f3d0", fontSize: "11px" }}>
                  <i style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
                  Assistant en ligne · Répond en Darija & Français
                </small>
              </div>
              <span style={{ fontSize: "11px", background: "rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: "12px", color: "#ffffff" }}>
                WhatsApp Mockup
              </span>
            </div>

            {/* Chat Messages Scroll */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px", background: "#f0fdf4", backgroundImage: "radial-gradient(#10b981 0.75px, transparent 0.75px)", backgroundSize: "16px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ alignSelf: "center", background: "#ffffff", padding: "4px 12px", borderRadius: "12px", fontSize: "11px", color: "#64748b", border: "1px solid var(--line)", boxShadow: "var(--shadow-xs)" }}>
                Aujourd’hui · Messages chiffrés de bout en bout
              </div>

              {chat.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "80%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      background: msg.role === "user" ? "#dcfce7" : "#ffffff",
                      color: msg.role === "user" ? "#064e3b" : "#0f172a",
                      padding: "12px 14px",
                      borderRadius: msg.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                      fontSize: "13px",
                      lineHeight: "1.55",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      border: msg.role === "user" ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                    }}
                  >
                    {msg.content}
                    {msg.order && (
                      <div style={{ marginTop: "10px", padding: "10px", background: "#ecfdf5", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#065f46", fontWeight: "700", fontSize: "12px" }}>
                          <ShoppingBag size={14} /> Commande enregistrée !
                        </div>
                        <div style={{ fontSize: "11px", color: "#047857", marginTop: "4px" }}>
                          Total : {msg.order.total_mad} DH · Paiement à la livraison
                        </div>
                        <Link href="/orders" className="text-link" style={{ marginTop: "6px", display: "inline-flex", fontSize: "11px" }}>
                          Voir dans Commandes →
                        </Link>
                      </div>
                    )}
                    <span style={{ display: "block", textAlign: "right", fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>
                      {msg.time || "12:00"} {msg.role === "user" && "✓✓"}
                    </span>
                  </div>
                </div>
              ))}

              {simLoading && (
                <div style={{ alignSelf: "flex-start", background: "#ffffff", padding: "10px 16px", borderRadius: "14px 14px 14px 2px", fontSize: "12px", color: "#0f4c3a", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Sparkles size={14} className="spark" style={{ margin: 0 }} />
                  <span>Votre assistant écrit en Darija…</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Suggestions Chips */}
            <div style={{ padding: "8px 16px", background: "#f8fafc", borderTop: "1px solid var(--line)", display: "flex", gap: "8px", overflowX: "auto" }}>
              <button
                type="button"
                className="btn secondary small-btn"
                onClick={() => void sendMessage("Salam, chno 3ndkom f l-magasin ?")}
                disabled={simLoading}
              >
                🛍️ Chno 3ndkom ?
              </button>
              <button
                type="button"
                className="btn secondary small-btn"
                onClick={() => void sendMessage("Kifach kadirou l-livraison w l-khalas ?")}
                disabled={simLoading}
              >
                🚚 Kifach livraison ?
              </button>
              <button
                type="button"
                className="btn secondary small-btn"
                onClick={() => void sendMessage("Bghit ncommandi t-shirt oversize taille L f l-k7el ana f Casa")}
                disabled={simLoading}
              >
                📦 Commander en Darija
              </button>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
              style={{ display: "flex", gap: "10px", padding: "14px 16px", background: "#ffffff", borderTop: "1px solid var(--line)" }}
            >
              <input
                type="text"
                placeholder="Écrivez un message en Darija ou français (ex: Salam, bghit had t-shirt...)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={simLoading}
                style={{ margin: 0, flex: 1, borderRadius: "24px", padding: "12px 18px" }}
              />
              <button
                type="submit"
                className="btn primary"
                disabled={!input.trim() || simLoading}
                style={{ borderRadius: "50%", width: "44px", height: "44px", padding: 0, flexShrink: 0 }}
              >
                <Send size={18} />
              </button>
            </form>
          </section>

          {/* Right Sidebar Guide */}
          <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <section className="panel" style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <div className="stat-icon green" style={{ width: "32px", height: "32px" }}>
                  <Sparkles size={16} />
                </div>
                <strong style={{ fontSize: "14px", color: "var(--ink)" }}>Comment tester ?</strong>
              </div>
              <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: "1.6" }}>
                Ce simulateur utilise votre catalogue réel et le modèle <strong>Gemini</strong> avec le prompt commercial marocain.
              </p>
              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
                <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                  <strong style={{ color: "var(--ink)", display: "block" }}>1. Demandez les produits</strong>
                  <span style={{ color: "var(--muted)", fontSize: "11px" }}>« Salam khoya wach kayn t-shirt ? »</span>
                </div>
                <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                  <strong style={{ color: "var(--ink)", display: "block" }}>2. Précisez la taille et la ville</strong>
                  <span style={{ color: "var(--muted)", fontSize: "11px" }}>« Taille L f l-k7el, ana f Casa »</span>
                </div>
                <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                  <strong style={{ color: "var(--ink)", display: "block" }}>3. Confirmez la commande</strong>
                  <span style={{ color: "var(--muted)", fontSize: "11px" }}>« Ah safi siftouha lia f Maarif »</span>
                </div>
              </div>
            </section>

            <section className="panel" style={{ padding: "18px", background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)", border: "1px solid #bbf7d0" }}>
              <strong style={{ fontSize: "13px", color: "#065f46", display: "block" }}>
                Passer au vrai WhatsApp ?
              </strong>
              <p style={{ fontSize: "11px", color: "#047857", margin: "6px 0 12px", lineHeight: "1.5" }}>
                Vous pouvez connecter le téléphone de votre boutique par QR code pour répondre automatiquement à vos vrais clients.
              </p>
              <button
                type="button"
                className="btn primary small-btn"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => setTab("qr")}
              >
                Ouvrir la connexion QR <ArrowUpRight size={14} />
              </button>
            </section>
          </aside>
        </div>
      ) : (
        /* Original QR Pairing View */
        <div className="pairing-grid">
          <section className="panel pairing-card">
            <div className="setup-icon">
              <MessageCircle size={28} />
            </div>
            <h2>
              {connected
                ? "Marhba, vous êtes connecté !"
                : "Scannez. Connectez. Vendez."}
            </h2>
            <p>
              {connected
                ? "Votre assistant peut recevoir les conversations."
                : "Liez votre compte depuis l’application WhatsApp sur votre téléphone."}
            </p>
            <div className={"qr-frame " + (connected ? "connected-frame" : "")}>
              {connected ? (
                <>
                  <Check size={55} />
                  <strong>{connection.phone || "WhatsApp connecté"}</strong>
                </>
              ) : connection.qr ? (
                <Image
                  unoptimized
                  src={connection.qr}
                  alt="QR de connexion WhatsApp"
                  width={240}
                  height={240}
                />
              ) : (
                <>
                  <QrCode size={74} strokeWidth={1} />
                  <span>
                    {data.demo
                      ? "Le QR réel apparaîtra après configuration du worker."
                      : connection.state === "connecting"
                        ? "Génération du QR…"
                        : "Votre QR apparaîtra ici."}
                  </span>
                </>
              )}
            </div>
            {data.demo ? (
              <Link href="/settings#setup" className="btn primary">
                Configurer mes services <ArrowUpRight size={16} />
              </Link>
            ) : (
              <button
                className="btn primary"
                onClick={() => void connect()}
                disabled={busy || connected}
              >
                <RefreshCw size={15} />
                {busy ? "Connexion…" : "Générer le QR code"}
              </button>
            )}
            {message && (
              <p className="form-message" role="alert">
                {message}
              </p>
            )}
            <div className="pairing-foot">
              <ShieldCheck size={14} /> Session privée et chiffrée sur le worker.
            </div>
          </section>
          <aside>
            <section className="panel pairing-guide">
              <h2>Trois étapes, b sehoula.</h2>
              <div className="guide-step">
                <span>1</span>
                <div>
                  <strong>Ouvrez WhatsApp</strong>
                  <p>Sur le téléphone de votre boutique, allez dans Réglages.</p>
                </div>
                <Smartphone size={20} />
              </div>
              <div className="guide-step">
                <span>2</span>
                <div>
                  <strong>Appareils connectés</strong>
                  <p>Appuyez sur « Connecter un appareil ».</p>
                </div>
              </div>
              <div className="guide-step">
                <span>3</span>
                <div>
                  <strong>Scannez le QR</strong>
                  <p>Pointez votre téléphone vers le QR affiché ici. Safi !</p>
                </div>
              </div>
            </section>
            <p className="pairing-disclaimer">
              Connexion communautaire Baileys, non officielle. Un worker permanent
              est nécessaire ; sa session ne tourne pas dans une fonction
              serverless.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
