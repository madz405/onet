"use client";

// Ruang Virtual 2D multiplayer (terinspirasi KaiSpace / Gather).
//
// - Gambar: <canvas> biasa, tanpa library game.
// - Realtime: Supabase Realtime (Broadcast untuk posisi & chat, Presence untuk
//   daftar pemain online). TIDAK memakai database, jadi tidak ada tabel yang
//   perlu dibuat. Lihat lib/supabaseClient.js untuk env yang dibutuhkan.
// - Kontrol: tombol panah / WASD (desktop), ketuk layar untuk jalan (HP).
// - Chat: tampil sebagai bubble di atas kepala karakter selama beberapa detik.
//
// Catatan keamanan: karena tanpa server sendiri, pesan dari pemain lain
// diperlakukan sebagai data tidak tepercaya (divalidasi, dipotong, dibatasi
// kecepatannya) dan hanya digambar sebagai teks di canvas (aman dari XSS).

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Users } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";

// ---------- Pengaturan ----------
const ROOM_CHANNEL = "koyen-ruang-utama";
const W = 960; // lebar dunia (satuan game, bukan piksel layar)
const H = 600;
const SPEED = 170; // satuan/detik
const MAX_PLAYERS = 30;
const MAX_NAME = 14;
const MAX_CHAT = 80;
const CHAT_COOLDOWN_MS = 1500; // jeda minimal kirim chat (sisi pengirim)
const REMOTE_CHAT_MIN_GAP_MS = 700; // pesan dari pemain yang sama lebih cepat dari ini diabaikan
const BUBBLE_MS = 6000;
const POS_SEND_MS = 100;
const PROFILE_KEY = "koyen-ruang-profile";

const AVATARS = [
  { name: "Biru", body: "#4f6bed", hair: "#2b2d42" },
  { name: "Merah", body: "#e5484d", hair: "#3b1f14" },
  { name: "Hijau", body: "#2fb67c", hair: "#1d1d1d" },
  { name: "Kuning", body: "#f2b705", hair: "#5a3a1b" },
  { name: "Ungu", body: "#8e5ce6", hair: "#1f1235" },
  { name: "Pink", body: "#ec5fa0", hair: "#4a2a1a" },
];

const EMOTES = ["👋", "😂", "❤️", "👍", "😮"];

// Furnitur: kotak "solid" dipakai untuk tabrakan sekaligus untuk menggambar.
const FURNITURE = [
  { t: "desk", x: 40, y: 130, w: 100, h: 64 },
  { t: "desk", x: 40, y: 270, w: 100, h: 64 },
  { t: "desk", x: 40, y: 410, w: 100, h: 64 },
  { t: "desk", x: 820, y: 130, w: 100, h: 64 },
  { t: "desk", x: 820, y: 270, w: 100, h: 64 },
  { t: "desk", x: 820, y: 410, w: 100, h: 64 },
  { t: "table", x: 380, y: 300, w: 200, h: 90 },
  { t: "counter", x: 360, y: 90, w: 240, h: 56 },
  { t: "plant", x: 200, y: 110, w: 30, h: 30 },
  { t: "plant", x: 730, y: 110, w: 30, h: 30 },
  { t: "plant", x: 220, y: 500, w: 30, h: 30 },
  { t: "plant", x: 710, y: 500, w: 30, h: 30 },
];
const WALL_H = 78; // dinding atas (tidak bisa dilewati)
const HALF_W = 9; // setengah lebar kotak tabrakan kaki karakter
const FOOT_H = 8;

// ---------- Util ----------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

function blocked(x, y) {
  if (x - HALF_W < 8 || x + HALF_W > W - 8 || y - FOOT_H < WALL_H || y > H - 8) return true;
  for (const f of FURNITURE) {
    if (x + HALF_W > f.x && x - HALF_W < f.x + f.w && y > f.y && y - FOOT_H < f.y + f.h) return true;
  }
  return false;
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `p${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

function spawnPoint() {
  for (let i = 0; i < 40; i++) {
    const x = 250 + Math.random() * 460;
    const y = 190 + Math.random() * 90;
    if (!blocked(x, y)) return { x, y };
  }
  return { x: 480, y: 220 };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    // kata yang terlalu panjang dipecah per karakter
    let chunk = w;
    while (ctx.measureText(chunk).width > maxWidth && chunk.length > 1) {
      let cut = chunk.length - 1;
      while (cut > 1 && ctx.measureText(chunk.slice(0, cut)).width > maxWidth) cut--;
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(chunk.slice(0, cut));
      chunk = chunk.slice(cut);
    }
    const test = line ? `${line} ${chunk}` : chunk;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = chunk;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

// ---------- Gambar ----------
function drawRoom(ctx) {
  // lantai
  ctx.fillStyle = "#e9ecfb";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#d5daf2";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, WALL_H);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = WALL_H; y <= H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // dinding
  ctx.fillStyle = "#7b88e0";
  ctx.fillRect(0, 0, W, WALL_H);
  ctx.fillStyle = "#5b68c4";
  ctx.fillRect(0, WALL_H - 8, W, 8);
  // papan nama
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, W / 2 - 90, 14, 180, 44, 8);
  ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("KOYEN", W / 2, 37);
  // bingkai luar
  ctx.strokeStyle = "#5b68c4";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);
}

function drawFurniture(ctx, f) {
  if (f.t === "desk") {
    ctx.fillStyle = "#c98a4b";
    roundRect(ctx, f.x, f.y, f.w, f.h, 6);
    ctx.fill();
    ctx.fillStyle = "#a96f38";
    ctx.fillRect(f.x, f.y + f.h - 10, f.w, 10);
    ctx.fillStyle = "#2b6cb0"; // monitor
    ctx.fillRect(f.x + 12, f.y + 8, 34, 24);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(f.x + 62, f.y + 14, 26, 18); // kertas/buku
  } else if (f.t === "table") {
    ctx.fillStyle = "#d9b38c";
    roundRect(ctx, f.x, f.y, f.w, f.h, 12);
    ctx.fill();
    ctx.fillStyle = "#c39a70";
    ctx.fillRect(f.x + 8, f.y + f.h - 12, f.w - 16, 12);
  } else if (f.t === "counter") {
    ctx.fillStyle = "#f3e6d0";
    roundRect(ctx, f.x, f.y, f.w, f.h, 14);
    ctx.fill();
    ctx.fillStyle = "#e09f3e";
    ctx.fillRect(f.x + 10, f.y + f.h - 14, f.w - 20, 14);
  } else if (f.t === "plant") {
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(f.x + 6, f.y + 16, 18, 14);
    ctx.fillStyle = "#2f9e44";
    ctx.beginPath();
    ctx.arc(f.x + 15, f.y + 10, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#40c057";
    ctx.beginPath();
    ctx.arc(f.x + 10, f.y + 7, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx, p, now) {
  const av = AVATARS[p.color] || AVATARS[0];
  const bob = p.moving ? Math.sin(now / 90) * 2 : 0;
  const x = p.x;
  const y = p.y;
  // bayangan
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // kaki
  ctx.fillStyle = "#2b2d42";
  ctx.fillRect(x - 7, y - 10 + bob * 0.5, 6, 10);
  ctx.fillRect(x + 1, y - 10 - bob * 0.5, 6, 10);
  // badan
  ctx.fillStyle = av.body;
  roundRect(ctx, x - 9, y - 28 + bob, 18, 20, 5);
  ctx.fill();
  // kepala
  ctx.fillStyle = "#f2c9a0";
  ctx.beginPath();
  ctx.arc(x, y - 36 + bob, 10, 0, Math.PI * 2);
  ctx.fill();
  // rambut
  ctx.fillStyle = av.hair;
  ctx.beginPath();
  ctx.arc(x, y - 38 + bob, 10, Math.PI, 0);
  ctx.fill();
  // mata
  ctx.fillStyle = "#1a1a2e";
  const ex = (p.dir || 0) * 2;
  ctx.fillRect(x - 4 + ex, y - 36 + bob, 2, 3);
  ctx.fillRect(x + 2 + ex, y - 36 + bob, 2, 3);
}

function drawLabel(ctx, p, now) {
  const top = p.y - 52;
  // nama
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(p.name).width + 12;
  ctx.fillStyle = p.me ? "rgba(79,107,237,0.92)" : "rgba(20,20,35,0.78)";
  roundRect(ctx, p.x - tw / 2, top - 9, tw, 18, 9);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(p.name, p.x, top);

  // bubble chat
  if (p.bubble && p.bubble.until > now) {
    ctx.font = "13px sans-serif";
    const lines = wrapText(ctx, p.bubble.text, 150);
    const lh = 16;
    const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18;
    const bh = lines.length * lh + 12;
    const bx = clamp(p.x - bw / 2, 6, W - bw - 6);
    const by = top - 16 - bh;
    ctx.fillStyle = "rgba(255,255,255,0.97)";
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // ekor bubble
    ctx.fillStyle = "rgba(255,255,255,0.97)";
    ctx.beginPath();
    ctx.moveTo(p.x - 6, by + bh - 1);
    ctx.lineTo(p.x + 6, by + bh - 1);
    ctx.lineTo(p.x, by + bh + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "center";
    lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, by + 6 + lh * i + lh / 2));
  }
}

// ---------- Komponen ----------
const FIELD =
  "w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-base text-white placeholder:text-white/30 focus-ring";

export default function VirtualRoom() {
  const configured = isSupabaseConfigured();
  const [phase, setPhase] = useState("join"); // join | room
  const [nameInput, setNameInput] = useState("");
  const [color, setColor] = useState(0);
  const [conn, setConn] = useState("connecting"); // connecting | online | error | full
  const [count, setCount] = useState(1);
  const [log, setLog] = useState([]);
  const [chatText, setChatText] = useState("");

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const playersRef = useRef(new Map());
  const meRef = useRef(null);
  const channelRef = useRef(null);
  const lastChatRef = useRef(0);
  const profileRef = useRef({ name: "", color: 0 });

  // Ambil profil tersimpan (nama & karakter terakhir).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p?.name === "string") setNameInput(p.name.slice(0, MAX_NAME));
      if (Number.isInteger(p?.color) && p.color >= 0 && p.color < AVATARS.length) setColor(p.color);
    } catch {
      // abaikan
    }
  }, []);

  const pushLog = useCallback((name, text, me) => {
    setLog((prev) => [...prev.slice(-29), { id: `${Date.now()}-${Math.random()}`, name, text, me }]);
  }, []);

  function handleJoin(e) {
    e.preventDefault();
    const name = nameInput.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
    if (!name) return;
    profileRef.current = { name, color };
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, color }));
    } catch {
      // abaikan
    }
    setConn("connecting");
    setLog([]);
    setPhase("room");
  }

  // ---- Game: berjalan selama phase === "room" ----
  useEffect(() => {
    if (phase !== "room") return undefined;
    const supabase = getSupabase();
    if (!supabase) {
      setConn("error");
      return undefined;
    }

    const myId = newId();
    const { name: myName, color: myColor } = profileRef.current;
    const sp = spawnPoint();
    const me = {
      id: myId,
      me: true,
      name: myName,
      color: myColor,
      x: sp.x,
      y: sp.y,
      dir: 0,
      moving: false,
      bubble: null,
      dest: null,
    };
    meRef.current = me;
    const players = playersRef.current;
    players.clear();
    players.set(myId, me);

    const keys = new Set();
    let alive = true;
    let lastSent = 0;
    let wasMoving = false;
    let online = false; // baru boleh kirim setelah channel benar-benar tersambung

    // ---- Realtime ----
    const channel = supabase.channel(ROOM_CHANNEL, {
      config: { broadcast: { self: false }, presence: { key: myId } },
    });
    channelRef.current = channel;

    const sendPos = () => {
      if (!online) return;
      channel.send({
        type: "broadcast",
        event: "pos",
        payload: { id: myId, x: Math.round(me.x), y: Math.round(me.y), d: me.dir },
      });
    };

    const ensureRemote = (id) => {
      let p = players.get(id);
      if (!p) {
        const s = spawnPoint();
        p = {
          id,
          me: false,
          name: "...",
          color: 0,
          x: s.x,
          y: s.y,
          tx: s.x,
          ty: s.y,
          dir: 0,
          moving: false,
          bubble: null,
          lastChat: 0,
          lastSeen: performance.now(),
          placed: false,
        };
        players.set(id, p);
      }
      return p;
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = Object.keys(state);
        setCount(ids.length);
        const now = performance.now();
        for (const id of ids) {
          if (id === myId) continue;
          const meta = state[id]?.[0] || {};
          const p = ensureRemote(id);
          p.name = String(meta.name || "Tamu").slice(0, MAX_NAME);
          p.color = Number.isInteger(meta.color) && meta.color >= 0 && meta.color < AVATARS.length ? meta.color : 0;
          p.lastSeen = now;
        }
        for (const id of [...players.keys()]) {
          if (id === myId || ids.includes(id)) continue;
          const p = players.get(id);
          if (now - (p.lastSeen || 0) > 4000) players.delete(id);
        }
      })
      .on("presence", { event: "join" }, ({ key }) => {
        // Ada yang baru masuk: kirim posisiku supaya dia langsung melihatku.
        if (key !== myId) sendPos();
      })
      .on("broadcast", { event: "pos" }, ({ payload }) => {
        if (!payload || typeof payload.id !== "string" || payload.id === myId) return;
        if (!isNum(payload.x) || !isNum(payload.y)) return;
        const p = ensureRemote(payload.id.slice(0, 64));
        const x = clamp(payload.x, 0, W);
        const y = clamp(payload.y, WALL_H, H);
        p.tx = x;
        p.ty = y;
        p.dir = payload.d === -1 || payload.d === 1 ? payload.d : 0;
        p.lastSeen = performance.now();
        if (!p.placed) {
          p.x = x;
          p.y = y;
          p.placed = true;
        }
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        if (!payload || typeof payload.id !== "string" || typeof payload.t !== "string") return;
        const p = players.get(payload.id);
        if (!p || p.me) return;
        const now = performance.now();
        if (now - p.lastChat < REMOTE_CHAT_MIN_GAP_MS) return; // anti-spam
        p.lastChat = now;
        const text = payload.t.replace(/\s+/g, " ").trim().slice(0, MAX_CHAT);
        if (!text) return;
        p.bubble = { text, until: now + BUBBLE_MS };
        pushLog(p.name, text, false);
      })
      .subscribe(async (status) => {
        if (!alive) return;
        if (status === "SUBSCRIBED") {
          const res = await channel.track({ name: myName, color: myColor });
          if (!alive) return;
          if (res === "error") {
            setConn("error");
            return;
          }
          // Ruangan penuh? (dicek setelah daftar pemain tersinkron)
          setTimeout(() => {
            if (!alive) return;
            const n = Object.keys(channel.presenceState()).length;
            if (n > MAX_PLAYERS) {
              setConn("full");
              supabase.removeChannel(channel);
              alive = false;
              return;
            }
            online = true;
            setConn("online");
            sendPos();
          }, 700);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConn("error");
        }
      });

    // ---- Input ----
    const onKeyDown = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) {
        keys.add(k);
        me.dest = null;
        e.preventDefault();
      }
    };
    const onKeyUp = (e) => keys.delete(e.key.toLowerCase());
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const canvas = canvasRef.current;
    const onPointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      me.dest = { x: clamp(x, 0, W), y: clamp(y, WALL_H, H) };
    };
    canvas.addEventListener("pointerdown", onPointer);

    // ---- Ukuran canvas ----
    const ctx = canvas.getContext("2d");
    const resize = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const cssW = wrap.clientWidth;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.height = `${(cssW * H) / W}px`;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(((cssW * H) / W) * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);

    // ---- Loop ----
    let raf = 0;
    let prev = performance.now();
    const tick = (now) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;

      // gerak pemain lokal
      let dx = 0;
      let dy = 0;
      if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
      if (keys.has("arrowright") || keys.has("d")) dx += 1;
      if (keys.has("arrowup") || keys.has("w")) dy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) dy += 1;
      if (!dx && !dy && me.dest) {
        const vx = me.dest.x - me.x;
        const vy = me.dest.y - me.y;
        const dist = Math.hypot(vx, vy);
        if (dist < 4) me.dest = null;
        else {
          dx = vx / dist;
          dy = vy / dist;
        }
      }
      let moved = false;
      if (dx || dy) {
        const len = Math.hypot(dx, dy) || 1;
        const sx = (dx / len) * SPEED * dt;
        const sy = (dy / len) * SPEED * dt;
        if (sx && !blocked(me.x + sx, me.y)) {
          me.x += sx;
          moved = true;
        }
        if (sy && !blocked(me.x, me.y + sy)) {
          me.y += sy;
          moved = true;
        }
        if (sx) me.dir = sx > 0 ? 1 : -1;
        if (!moved) me.dest = null; // nabrak: berhenti
      }
      me.moving = moved;
      if ((moved && now - lastSent > POS_SEND_MS) || (!moved && wasMoving)) {
        lastSent = now;
        sendPos();
      }
      wasMoving = moved;

      // pemain lain: halus menuju posisi target
      const k = Math.min(1, dt * 12);
      for (const p of players.values()) {
        if (p.me) continue;
        const ddx = p.tx - p.x;
        const ddy = p.ty - p.y;
        p.moving = Math.abs(ddx) + Math.abs(ddy) > 1.5;
        p.x += ddx * k;
        p.y += ddy * k;
      }

      // gambar
      const s = canvas.width / W;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      drawRoom(ctx);
      const drawables = [
        ...FURNITURE.map((f) => ({ kind: "f", y: f.y + f.h, f })),
        ...[...players.values()].map((p) => ({ kind: "p", y: p.y, p })),
      ].sort((a, b) => a.y - b.y);
      for (const d of drawables) {
        if (d.kind === "f") drawFurniture(ctx, d.f);
        else drawPlayer(ctx, d.p, now);
      }
      for (const p of [...players.values()].sort((a, b) => a.y - b.y)) drawLabel(ctx, p, now);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointer);
      try {
        channel.untrack();
        supabase.removeChannel(channel);
      } catch {
        // abaikan
      }
      channelRef.current = null;
      meRef.current = null;
      players.clear();
    };
  }, [phase, pushLog]);

  function say(raw) {
    const me = meRef.current;
    const channel = channelRef.current;
    if (!me || !channel) return;
    const text = String(raw || "").replace(/\s+/g, " ").trim().slice(0, MAX_CHAT);
    if (!text) return;
    const now = performance.now();
    if (now - lastChatRef.current < CHAT_COOLDOWN_MS) return;
    lastChatRef.current = now;
    me.bubble = { text, until: now + BUBBLE_MS };
    pushLog(me.name, text, true);
    channel.send({ type: "broadcast", event: "chat", payload: { id: me.id, t: text } });
  }

  function handleChatSubmit(e) {
    e.preventDefault();
    say(chatText);
    setChatText("");
  }

  function leave() {
    setPhase("join");
  }

  // ---------- Tampilan ----------
  if (!configured) {
    return (
      <div className="max-w-xl rounded-2xl border border-white/10 bg-ink-900/60 p-6">
        <h2 className="font-display text-lg font-semibold text-white">Ruang virtual belum aktif</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Fitur ini membutuhkan layanan realtime yang belum disambungkan. Kembali lagi nanti ya.
        </p>
      </div>
    );
  }

  if (phase === "join") {
    return (
      <form onSubmit={handleJoin} className="max-w-xl space-y-5 rounded-2xl border border-white/10 bg-ink-900/60 p-6">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50" htmlFor="ruang-nama">
            Nama panggilan
          </label>
          <input
            id="ruang-nama"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value.slice(0, MAX_NAME))}
            placeholder="Contoh: Kaka"
            maxLength={MAX_NAME}
            required
            className={FIELD}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-white/50">Warna karakter</p>
          <div className="flex flex-wrap gap-3">
            {AVATARS.map((a, i) => (
              <button
                key={a.name}
                type="button"
                onClick={() => setColor(i)}
                aria-label={a.name}
                aria-pressed={color === i}
                className={`grid h-12 w-12 place-items-center rounded-xl border-2 transition-transform focus-ring ${
                  color === i ? "scale-110 border-signal-500" : "border-white/10"
                }`}
              >
                <span className="relative block h-7 w-6">
                  <span className="absolute left-1/2 top-0 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[#f2c9a0]" />
                  <span
                    className="absolute bottom-0 left-0 h-4 w-6 rounded-md"
                    style={{ backgroundColor: a.body }}
                  />
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={!nameInput.trim()}
          className="w-full rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
        >
          Masuk ruangan
        </button>
        <p className="text-xs leading-relaxed text-white/40">
          Pesan di ruang ini terlihat oleh semua pengunjung yang sedang online dan tidak disimpan. Jaga sopan santun ya.
        </p>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-white/60">
          <Users size={16} />
          {conn === "online" ? `${count} online` : "Menghubungkan..."}
        </span>
        <button
          type="button"
          onClick={leave}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
        >
          Keluar
        </button>
      </div>

      <div ref={wrapRef} className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-900/60">
        <canvas ref={canvasRef} className="block w-full touch-manipulation" aria-label="Ruang virtual" />
        {conn === "connecting" && (
          <div className="absolute inset-0 grid place-items-center bg-black/40">
            <Loader2 className="animate-spin text-white" />
          </div>
        )}
        {(conn === "error" || conn === "full") && (
          <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center">
            <p className="max-w-xs text-sm text-white">
              {conn === "full"
                ? "Ruangan sedang penuh. Coba lagi sebentar lagi."
                : "Tidak bisa terhubung ke ruang virtual. Periksa koneksi internetmu lalu coba lagi."}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-white/40">Ketuk lantai untuk berjalan (HP), atau pakai tombol panah / WASD (desktop).</p>

      <form onSubmit={handleChatSubmit} className="flex gap-2">
        <input
          value={chatText}
          onChange={(e) => setChatText(e.target.value.slice(0, MAX_CHAT))}
          placeholder="Tulis pesan..."
          maxLength={MAX_CHAT}
          enterKeyHint="send"
          className={FIELD}
        />
        <button
          type="submit"
          aria-label="Kirim"
          disabled={conn !== "online" || !chatText.trim()}
          className="grid w-12 shrink-0 place-items-center rounded-xl bg-signal-500 text-ink-950 disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EMOTES.map((em) => (
          <button
            key={em}
            type="button"
            onClick={() => say(em)}
            disabled={conn !== "online"}
            className="rounded-xl border border-white/10 px-3 py-1.5 text-lg hover:bg-white/10 disabled:opacity-50"
            aria-label={`Kirim ${em}`}
          >
            {em}
          </button>
        ))}
      </div>

      {log.length > 0 && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-ink-900/60 p-3 text-sm">
          {log.map((l) => (
            <p key={l.id} className="break-words text-white/70">
              <span className={`font-semibold ${l.me ? "text-signal-400" : "text-white"}`}>{l.name}</span>: {l.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
