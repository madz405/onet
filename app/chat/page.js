import PageIntro from "@/components/PageIntro";
import ChatPanel from "@/components/ChatPanel";
import { CHAT_BOT_NAME } from "@/lib/chatPersona";
import { SITE_NAME } from "@/lib/site";

export const metadata = {
  title: `Chat AI — ${SITE_NAME}`,
  description:
    "Ngobrol dengan Kayna, asisten AI KOYEN, untuk bantuan cara memakai fitur downloader, tools, dan musik.",
  alternates: { canonical: "/chat" },
};

export default function ChatPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-12 pt-6 sm:pt-10">
      <PageIntro eyebrow="Tanya-tanya dulu" title={<>Ngobrol sama {CHAT_BOT_NAME}</>} accent="flare">
        Bingung cara pakai salah satu fitur di {SITE_NAME}? Tanya langsung di sini.
      </PageIntro>

      <ChatPanel />
    </div>
  );
}
