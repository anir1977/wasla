import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-state">
      <h1>Cette page a pris un autre chemin.</h1>
      <Link href="/" className="btn primary">
        Revenir à ma boutique
      </Link>
    </main>
  );
}
