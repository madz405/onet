import { redirect } from "next/navigation";

// Ruang Virtual sudah digantikan Grup Chat. Link lama diarahkan ke halaman baru.
export const metadata = { robots: { index: false } };

export default function RuangPage() {
  redirect("/grup");
}
