"use client";

// Jendela "Info grup": profil sendiri, daftar anggota (dengan penanda online),
// dan — khusus admin — pengaturan grup serta pengelolaan anggota (bisukan,
// blokir, jadikan admin). Semua perubahan lewat API Supabase; yang berhak
// melakukannya ditentukan aturan keamanan di database (supabase/grup-chat.sql),
// bukan oleh tampilan ini.

import { useEffect, useState } from "react";
import { Check, Loader2, LogOut, ShieldCheck } from "lucide-react";
import Modal from "@/components/Modal";
import { MAX_NAME, MUTE_OPTIONS, SLOW_MODE_OPTIONS, httpsOrNull } from "@/lib/groupChat";

const FIELD =
  "w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-2.5 text-base text-white placeholder:text-white/30 focus-ring";

function Avatar({ person, size = 36 }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  return person?.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.avatar_url} alt="" referrerPolicy="no-referrer" style={style} className="flex-shrink-0 rounded-full object-cover" />
  ) : (
    <span style={style} className="grid flex-shrink-0 place-items-center rounded-full bg-white/10 font-semibold uppercase text-white/70">
      {(person?.display_name || "?").slice(0, 1)}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-6 border-t border-white/10 pt-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">{title}</h3>
      {children}
    </section>
  );
}

export default function GroupInfoSheet({
  supabase,
  uid,
  profile,
  settings,
  online,
  onClose,
  onSignOut,
  onProfileSaved,
  onSettingsSaved,
}) {
  const isAdmin = profile.role === "admin";
  const [members, setMembers] = useState(null);
  const [membersError, setMembersError] = useState("");
  const [openMember, setOpenMember] = useState(null);
  const [notice, setNotice] = useState("");

  const [nickname, setNickname] = useState(profile.display_name || "");
  const [savingNick, setSavingNick] = useState(false);

  const [form, setForm] = useState({
    name: settings?.name || "",
    description: settings?.description || "",
    avatar_url: settings?.avatar_url || "",
    only_admin_can_send: Boolean(settings?.only_admin_can_send),
    slow_mode_seconds: settings?.slow_mode_seconds || 0,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("profiles")
      .select("id,display_name,avatar_url,role,banned,muted_until")
      .order("display_name", { ascending: true })
      .limit(300)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMembersError(error.message);
        else setMembers(data || []);
      });
    return () => {
      active = false;
    };
  }, [supabase]);

  function flash(msg) {
    setNotice(msg);
    setTimeout(() => setNotice((cur) => (cur === msg ? "" : cur)), 2500);
  }

  async function saveNickname(e) {
    e.preventDefault();
    const name = nickname.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
    if (!name || name === profile.display_name) return;
    setSavingNick(true);
    const { data, error } = await supabase.from("profiles").update({ display_name: name }).eq("id", uid).select().single();
    setSavingNick(false);
    if (error) return flash(error.message || "Gagal menyimpan nama.");
    onProfileSaved(data);
    setMembers((list) => list && list.map((m) => (m.id === uid ? { ...m, display_name: data.display_name } : m)));
    flash("Nama disimpan.");
  }

  async function saveSettings(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return flash("Nama grup tidak boleh kosong.");
    const avatar = form.avatar_url.trim();
    if (avatar && !httpsOrNull(avatar)) return flash("Foto grup harus berupa link gambar https.");
    setSavingSettings(true);
    const { data, error } = await supabase
      .from("group_settings")
      .update({
        name: name.slice(0, 40),
        description: form.description.trim().slice(0, 300),
        avatar_url: avatar ? httpsOrNull(avatar) : null,
        only_admin_can_send: form.only_admin_can_send,
        slow_mode_seconds: Number(form.slow_mode_seconds) || 0,
      })
      .eq("id", 1)
      .select()
      .single();
    setSavingSettings(false);
    if (error) return flash(error.message || "Gagal menyimpan pengaturan.");
    onSettingsSaved(data);
    flash("Pengaturan grup disimpan.");
  }

  // Ubah satu anggota (khusus admin; database yang memeriksa haknya).
  async function updateMember(id, patch, okMessage) {
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", id)
      .select("id,display_name,avatar_url,role,banned,muted_until")
      .single();
    if (error) return flash(error.message || "Gagal mengubah anggota.");
    setMembers((list) => list.map((m) => (m.id === id ? data : m)));
    flash(okMessage);
  }

  const onlineSet = new Set(online);
  const mutedNow = (m) => m.muted_until && new Date(m.muted_until).getTime() > Date.now();

  return (
    <Modal title="Info grup" onClose={onClose}>
      <div className="flex items-center gap-3">
        <Avatar person={{ display_name: settings?.name || "G", avatar_url: settings?.avatar_url }} size={56} />
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold text-white">{settings?.name || "Grup KOYEN"}</h3>
          <p className="text-xs text-white/50">{online.length} online</p>
        </div>
      </div>
      {settings?.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-white/60">{settings.description}</p>}

      {notice && (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80" role="status">
          {notice}
        </p>
      )}

      <Section title="Profil saya">
        <form onSubmit={saveNickname} className="flex gap-2">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, MAX_NAME))}
            maxLength={MAX_NAME}
            aria-label="Nama panggilan"
            className={FIELD}
          />
          <button
            type="submit"
            disabled={savingNick || !nickname.trim() || nickname.trim() === profile.display_name}
            className="flex-shrink-0 rounded-xl bg-signal-500 px-4 text-sm font-semibold text-ink-950 disabled:opacity-50"
          >
            {savingNick ? <Loader2 size={16} className="animate-spin" /> : "Simpan"}
          </button>
        </form>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          <LogOut size={16} />
          Keluar
        </button>
      </Section>

      {isAdmin && (
        <Section title="Pengaturan grup (admin)">
          <form onSubmit={saveSettings} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-white/50" htmlFor="gs-name">
                Nama grup
              </label>
              <input
                id="gs-name"
                value={form.name}
                maxLength={40}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={FIELD}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50" htmlFor="gs-desc">
                Deskripsi
              </label>
              <textarea
                id="gs-desc"
                value={form.description}
                maxLength={300}
                rows={3}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={`${FIELD} resize-none`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50" htmlFor="gs-avatar">
                Foto grup (link gambar https, boleh kosong)
              </label>
              <input
                id="gs-avatar"
                value={form.avatar_url}
                placeholder="https://..."
                onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                className={FIELD}
              />
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={form.only_admin_can_send}
              onClick={() => setForm({ ...form, only_admin_can_send: !form.only_admin_can_send })}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-medium text-white">Hanya admin yang boleh mengirim</span>
                <span className="block text-xs text-white/50">Anggota lain hanya bisa membaca dan memberi reaksi.</span>
              </span>
              <span
                className={`relative ml-3 h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                  form.only_admin_can_send ? "bg-signal-500" : "bg-white/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                    form.only_admin_can_send ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>

            <div>
              <label className="mb-1 block text-xs text-white/50" htmlFor="gs-slow">
                Mode lambat (jeda antar pesan anggota)
              </label>
              <select
                id="gs-slow"
                value={form.slow_mode_seconds}
                onChange={(e) => setForm({ ...form, slow_mode_seconds: Number(e.target.value) })}
                className={FIELD}
              >
                {SLOW_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 disabled:opacity-60"
            >
              {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Simpan pengaturan
            </button>
          </form>
        </Section>
      )}

      <Section title={`Anggota${members ? ` (${members.length})` : ""}`}>
        {membersError && <p className="text-sm text-flare-400">{membersError}</p>}
        {!members && !membersError && <Loader2 className="animate-spin text-white/50" />}
        <ul className="space-y-1">
          {(members || []).map((m) => {
            const self = m.id === uid;
            const expanded = openMember === m.id && isAdmin && !self;
            return (
              <li key={m.id} className="rounded-xl border border-white/8">
                <button
                  type="button"
                  onClick={() => isAdmin && !self && setOpenMember(expanded ? null : m.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left ${isAdmin && !self ? "" : "cursor-default"}`}
                >
                  <span className="relative">
                    <Avatar person={m} size={36} />
                    {onlineSet.has(m.id) && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-900 bg-emerald-400" aria-label="Online" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm font-medium text-white">
                      {m.display_name}
                      {self && <span className="text-xs font-normal text-white/40">(kamu)</span>}
                      {m.role === "admin" && <ShieldCheck size={13} className="text-signal-400" aria-label="Admin" />}
                    </span>
                    {(m.banned || mutedNow(m)) && (
                      <span className="block text-xs text-flare-400">{m.banned ? "Diblokir" : "Dibisukan"}</span>
                    )}
                  </span>
                </button>

                {expanded && (
                  <div className="flex flex-wrap gap-1.5 border-t border-white/10 px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateMember(
                          m.id,
                          { role: m.role === "admin" ? "member" : "admin" },
                          m.role === "admin" ? "Admin dicabut." : "Dijadikan admin."
                        )
                      }
                      className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
                    >
                      {m.role === "admin" ? "Cabut admin" : "Jadikan admin"}
                    </button>

                    {mutedNow(m) ? (
                      <button
                        type="button"
                        onClick={() => updateMember(m.id, { muted_until: null }, "Bisu dibatalkan.")}
                        className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
                      >
                        Batalkan bisu
                      </button>
                    ) : (
                      MUTE_OPTIONS.map((o) => (
                        <button
                          type="button"
                          key={o.label}
                          onClick={() =>
                            updateMember(m.id, { muted_until: new Date(Date.now() + o.ms).toISOString() }, `Dibisukan ${o.label}.`)
                          }
                          className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
                        >
                          Bisukan {o.label}
                        </button>
                      ))
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        updateMember(m.id, { banned: !m.banned }, m.banned ? "Blokir dibuka." : "Anggota diblokir.")
                      }
                      className="rounded-lg border border-flare-500/40 px-2.5 py-1 text-xs text-flare-400 hover:bg-flare-500/10"
                    >
                      {m.banned ? "Buka blokir" : "Blokir"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {isAdmin && members && members.length > 1 && (
          <p className="mt-2 text-xs text-white/40">Ketuk nama anggota untuk membisukan, memblokir, atau mengubah perannya.</p>
        )}
      </Section>
    </Modal>
  );
}
