import ToolsSection from "@/components/ToolsSection";

export const metadata = { title: "Tools — Unduhin" };

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <section className="mb-10 max-w-2xl">
        <p className="mb-3 text-sm font-medium text-flare-400">Edit cepat, tanpa install apa-apa</p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Tools bantu konten harianmu.
        </h1>
        <p className="mt-3 text-white/60">
          Pilih tool di bawah, isi form singkatnya, dan hasilnya siap diunduh dalam beberapa detik.
        </p>
      </section>

      <ToolsSection />
    </div>
  );
}
