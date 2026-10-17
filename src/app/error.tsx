"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty-state">
      <h1>Un petit contretemps.</h1>
      <p>Vérifiez la configuration Supabase et la migration, puis réessayez.</p>
      <button className="btn primary" onClick={reset}>
        Réessayer
      </button>
    </main>
  );
}
