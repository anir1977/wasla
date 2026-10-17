"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { authenticate } from "@/app/auth/actions";
export function AuthForm({
  register = false,
  demo = false,
  configured = false,
}: {
  register?: boolean;
  demo?: boolean;
  configured?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <Link href="/" className="wordmark">
          <span className="brand-mark">w</span>wasla
          <span className="brand-dot">.</span>
        </Link>
        <div>
          <div className="eyebrow light">LE COMMERCE, PLUS PROCHE.</div>
          <h1>
            Vos clients écrivent.
            <br />
            Votre boutique
            <br />
            <em>avance.</em>
          </h1>
          <p>
            Un assistant qui parle leur langue.
            <br />
            Des commandes qui arrivent toutes seules.
          </p>
          <div className="story-chat">
            <span className="chat-icon">
              <MessageCircle size={20} />
            </span>
            <div>
              <small>Votre assistant · Darija & français</small>
              <p>
                Salam ! Marhba bik 👋
                <br />
                Chno n9der n3awnek lyoum ?
              </p>
            </div>
            <Check size={15} />
          </div>
        </div>
        <small>Conçu pour les boutiques marocaines. 🇲🇦</small>
      </div>
      <main className="auth-main">
        <div className="auth-card">
          <span className="eyebrow">MARHBA BIK</span>
          <h2>
            {register
              ? "Votre boutique commence ici."
              : "Heureux de vous revoir."}
          </h2>
          <p>
            {register
              ? "Créez votre espace et rapprochez-vous de vos clients."
              : "Connectez-vous à votre espace commerçant."}
          </p>
          {(demo || !configured) && (
            <div className="notice" style={{ marginBottom: "20px" }}>
              <p style={{ margin: "0 0 10px 0" }}>
                {demo
                  ? "Mode démonstration actif : vous pouvez explorer l'ensemble de la plateforme sans identifiants."
                  : "Connectez un projet Supabase pour activer les comptes ou explorez directement la démo."}
              </p>
              <Link
                href="/"
                className="btn primary"
                style={{ width: "100%", justifyContent: "center", textDecoration: "none" }}
              >
                Accéder au Dashboard (Démo) →
              </Link>
            </div>
          )}
          <form
            action={async (form) => {
              setPending(true);
              setMessage("");
              try {
                const result = await authenticate(form);
                if (result.redirect) {
                  router.push(result.redirect);
                  router.refresh();
                } else setMessage(result.error || result.success || "");
              } catch {
                setMessage("Service indisponible. Réessayez.");
              } finally {
                setPending(false);
              }
            }}
          >
            <input
              type="hidden"
              name="mode"
              value={register ? "register" : "login"}
            />
            <label>
              Adresse email
              <input
                type="email"
                name="email"
                placeholder="vous@boutique.ma"
                required
                autoComplete="email"
              />
            </label>
            <label>
              Mot de passe
              <input
                type="password"
                name="password"
                placeholder="10 caractères minimum"
                minLength={10}
                maxLength={128}
                required
                autoComplete={register ? "new-password" : "current-password"}
              />
            </label>
            <button
              className="btn primary"
              disabled={pending || demo || !configured}
            >
              {pending
                ? "Un instant…"
                : register
                  ? "Créer ma boutique"
                  : "Se connecter"}
              <ArrowRight size={16} />
            </button>
            {message && (
              <p role="status" className="form-message">
                {message}
              </p>
            )}
          </form>
          <p className="auth-switch">
            {register ? "Vous avez déjà un compte ?" : "Pas encore de compte ?"}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "Se connecter" : "Créer ma boutique"}
            </Link>
          </p>
          <div className="auth-foot">
            <Check size={14} /> Votre catalogue et vos clients restent privés.
          </div>
        </div>
      </main>
    </div>
  );
}
