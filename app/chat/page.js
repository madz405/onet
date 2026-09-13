import ChatPanel from "@/components/ChatPanel";
import { CHAT_BOT_NAME } from "@/lib/chatPersona";
import { SITE_NAME } from "@/lib/site";

export const metadata = { title: `Chat AI — ${SITE_NAME}` };

export default function ChatPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <section className="mb-8 max-w-2xl">
        <p className="mb-3 text-sm font-medium text-flare-400">Tanya-tanya dulu</p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Ngobrol sama {CHAT_BOT_NAME}
        </h1>
        <p className="mt-3 text-white/60">
          Bingung cara pakai salah satu fitur di {SITE_NAME}? Tanya langsung di sini.
        </p>
      </section>

      <ChatPanel />
    </div>
  );
}
