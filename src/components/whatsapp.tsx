"use client";
import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
type Connection = {
  state: string;
  qr?: string | null;
  phone?: string;
  error?: string;
};
export function WhatsApp() {
  const { data } = useWorkspace(),
    [connection, setConnection] = useState<Connection>({
      state: data.demo ? "demo" : "loading",
    }),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
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
    if (data.demo) return;
    const initial = setTimeout(() => void poll(), 0);
    const timer = setInterval(() => void poll(), 3000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [data.demo, poll]);
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
  const connected = connection.state === "connected";
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LÀ OÙ SONT VOS CLIENTS</div>
          <h1>Votre WhatsApp, connecté.</h1>
          <p>
            Un numéro. Votre catalogue. Un assistant qui s’occupe de la suite.
          </p>
        </div>
        <span className={"pill " + (connected ? "secure-pill" : "demo-pill")}>
          <i className="tiny-dot" />
          {connected ? "Connecté" : data.demo ? "Aperçu démo" : "Non connecté"}
        </span>
      </div>
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
                    ? "Le QR réel apparaîtra après configuration."
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
          <section className="ai-preview">
            <span className="eyebrow">ET APRÈS ?</span>
            <h2>Votre boutique parle Darija.</h2>
            <p>« Salam, bghit had hoodie b taille M, couleur olive. »</p>
            <div>
              <Check size={15} /> Le catalogue répond aux questions.
            </div>
            <div>
              <Check size={15} /> L’IA recueille les infos de livraison.
            </div>
            <div>
              <Check size={15} /> La commande confirmée arrive ici.
            </div>
          </section>
          <p className="pairing-disclaimer">
            Connexion communautaire Baileys, non officielle. Un worker permanent
            est nécessaire ; sa session ne tourne pas dans une fonction
            serverless.
          </p>
        </aside>
      </div>
    </>
  );
}
