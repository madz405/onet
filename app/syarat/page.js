import { redirect } from "next/navigation";

// Digabung ke satu halaman: /kebijakan (bagian Syarat Layanan).
export const metadata = { robots: { index: false } };

export default function TermsRedirect() {
  redirect("/kebijakan#syarat");
}
