"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ShoppingBag,
  CheckCheck,
  Wallet,
  Clock3,
  MessageCircle,
  ArrowRight,
  Package,
  Check,
  Plus,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { OrderTable, money } from "./order-table";
export function Overview() {
  const { data } = useWorkspace();
  const confirmed = data.orders.filter((order) =>
      ["CONFIRMED", "SHIPPED"].includes(order.status),
    ),
    pending = data.orders.filter((order) => order.status === "PENDING").length;
  const stats = [
    {
      label: "Commandes reçues",
      value: data.orders.length,
      icon: ShoppingBag,
      note: "Toutes vos commandes",
      tone: "purple",
    },
    {
      label: "Commandes confirmées",
      value: confirmed.length,
      icon: CheckCheck,
      note: "Prêtes à être préparées",
      tone: "green",
    },
    {
      label: "Chiffre d’affaires confirmé",
      value: money(confirmed.reduce((sum, o) => sum + o.total_mad, 0)),
      icon: Wallet,
      note: "Livraison incluse",
      tone: "orange",
    },
    {
      label: "En attente de réponse",
      value: pending,
      icon: Clock3,
      note: "Un petit suivi, et ça avance",
      tone: "blue",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">VOTRE BOUTIQUE, EN MOUVEMENT</div>
          <h1>
            Salam, {data.store.name} <span className="wave">✳</span>
          </h1>
          <p>Tout ce qui compte pour votre commerce, au même endroit.</p>
        </div>
        <Link className="btn secondary" href="/products">
          <Plus size={16} />
          Ajouter un produit
        </Link>
      </div>
      <section className="welcome-card">
        <div className="welcome-copy">
          <span className="hero-tag">
            <i /> VOTRE NOUVEL ALLIÉ
          </span>
          <h2>
            Moins de messages à gérer.
            <br />
            <em>Plus de commandes à préparer.</em>
          </h2>
          <p>
            Votre assistant répond en Darija, présente vos produits
            <br className="desktop-break" /> et transforme les conversations en
            commandes.
          </p>
          <Link href="/whatsapp" className="btn dark">
            Connecter mon WhatsApp <ArrowUpRight size={16} />
          </Link>
          <span className="hero-note">
            <Check size={12} /> Un scan suffit pour démarrer
          </span>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="phone-mock">
            <div className="phone-top">
              <span className="phone-avatar">A</span>
              <span>
                <b>Votre boutique</b>
                <small>Assistant · en ligne</small>
              </span>
              <MessageCircle size={17} />
            </div>
            <div className="chat-bubble incoming">
              Salam ! Kayn had t-shirt
              <br />b taille M ? 👋<small>12:34</small>
            </div>
            <div className="chat-bubble outgoing">
              Wa 3alaykom salam ! Oui,
              <br />
              disponible en noir à 149 DH ✨<small>12:34 ✓✓</small>
            </div>
            <div className="mini-order">
              <span>
                <ShoppingBag size={15} />
              </span>
              <div>
                <b>Une nouvelle commande !</b>
                <small>T-shirt Oversize · M · Casablanca</small>
              </div>
              <Check size={15} />
            </div>
            <div className="phone-input">
              Écrire un message… <span>➤</span>
            </div>
          </div>
          <div className="floating-tag">
            <span>✧</span> Votre assistant parle Darija
          </div>
        </div>
      </section>
      <section className="stat-grid">
        {stats.map(({ label, value, icon: Icon, note, tone }) => (
          <article className="stat-card" key={label}>
            <div className="stat-card-top">
              <span>{label}</span>
              <span className={"stat-icon " + tone}>
                <Icon size={17} />
              </span>
            </div>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>
      <div className="overview-grid">
        <div>
          <OrderTable compact />
        </div>
        <aside className="right-rail">
          <section className="panel setup-card">
            <div className="setup-icon">
              <MessageCircle size={22} />
            </div>
            <h2>On se lance ?</h2>
            <p>
              Trois petites étapes.
              <br />
              Une boutique prête à vendre.
            </p>
            <div className="setup-step">
              <span className="done">
                <Check size={12} />
              </span>
              <div>
                <strong>Votre espace est créé</strong>
                <small>Marhba dans la famille Wasla.</small>
              </div>
            </div>
            <Link href="/products" className="setup-step">
              <span className={data.products.length ? "done" : ""}>
                {data.products.length ? <Check size={12} /> : 2}
              </span>
              <div>
                <strong>Ajoutez votre catalogue</strong>
                <small>Produits, tailles et couleurs.</small>
              </div>
              <ArrowRight size={14} />
            </Link>
            <Link href="/whatsapp" className="setup-step">
              <span>3</span>
              <div>
                <strong>Connectez WhatsApp</strong>
                <small>Scannez le QR, et c’est parti.</small>
              </div>
              <ArrowRight size={14} />
            </Link>
          </section>
          <Link href="/products" className="inventory-note">
            <Package size={21} />
            <div>
              <strong>Un stock bien suivi</strong>
              <p>
                {
                  data.products.filter(
                    (p) =>
                      p.variants.reduce((sum, v) => sum + v.stock, 0) <= 10,
                  ).length
                }{" "}
                produit(s) à surveiller
              </p>
            </div>
            <ArrowUpRight size={16} />
          </Link>
        </aside>
      </div>
    </>
  );
}
