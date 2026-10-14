import PageIntro from "@/components/PageIntro";
import GroupChat from "@/components/GroupChat";
import { SITE_NAME } from "@/lib/site";

export const metadata = {
  title: `Grup Chat — ${SITE_NAME}`,
  description:
    "Grup chat publik KOYEN: masuk dengan akun Google, ngobrol realtime dengan pengunjung lain, dan dikelola oleh admin.",
  alternates: { canonical: "/grup" },
};

export default function GroupPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-12 pt-6 sm:pt-10">
      <PageIntro eyebrow="Grup chat publik" title="Ngobrol bareng pengunjung KOYEN." accent="signal">
        Masuk dengan akun Google, lalu ngobrol realtime di grup publik. Kamu bisa membalas pesan, memberi reaksi, dan
        melihat siapa yang sedang online. Grup dijaga oleh admin, jadi tetap sopan ya.
      </PageIntro>

      <GroupChat />
    </div>
  );
}
