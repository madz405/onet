import { redirect } from "next/navigation";

// Digabung ke satu halaman: /kebijakan (bagian Kebijakan Privasi).
export const metadata = { robots: { index: false } };

export default function PrivacyRedirect() {
  redirect("/kebijakan#privasi");
}
