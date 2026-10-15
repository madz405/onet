// Kerangka halaman hukum (Privasi & Syarat Layanan): judul, tanggal pembaruan,
// kelompok bagian (<LegalGroup>) berisi <LegalSection> bernomor. Server component biasa.

export function LegalGroup({ id, title, children }) {
  return (
    <div id={id} className="mt-12 scroll-mt-24 border-t border-white/10 pt-6">
      <h2 className="font-display text-2xl font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}

export function LegalSection({ title, children }) {
  return (
    <section className="mt-6">
      <h3 className="font-display text-base font-semibold text-white">{title}</h3>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-white/70">{children}</div>
    </section>
  );
}

export default function LegalPage({ title, updated, intro, children }) {
  return (
    <article className="mx-auto max-w-3xl px-5 pb-16 pt-8 sm:pt-12">
      <h1 className="font-display text-3xl font-semibold leading-tight text-white">{title}</h1>
      <p className="mt-2 text-xs text-white/40">Terakhir diperbarui: {updated}</p>
      {intro && <p className="mt-5 text-sm leading-relaxed text-white/70">{intro}</p>}
      {children}
    </article>
  );
}
