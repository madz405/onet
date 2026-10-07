"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, QrCode } from "lucide-react";
import Modal from "@/components/Modal";
import UploadBox from "@/components/UploadBox";
import { QR_TYPES, buildQrPayload, defaultQrValues } from "@/lib/qrPayload";

const FIELD =
  "w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-sm text-white placeholder:text-white/30 focus-ring";

async function loadQr() {
  const mod = await import("qrcode");
  return mod.default || mod;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// QR sulit dipindai kalau kontrasnya rendah atau warnanya terbalik (terang di atas gelap).
function colorWarning(fg, bg) {
  const [l1, l2] = [luminance(fg), luminance(bg)];
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  if (ratio < 3) return "Warna QR dan latar terlalu mirip, QR bisa sulit dipindai.";
  if (l1 > l2) return "Sebaiknya warna QR lebih gelap dari latar. Kalau terbalik, sebagian pemindai gagal membaca.";
  return "";
}

export default function QrModal({ tool, onClose }) {
  const [typeId, setTypeId] = useState("text");
  const [values, setValues] = useState(defaultQrValues);
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  const type = QR_TYPES.find((t) => t.id === typeId);
  const payload = useMemo(() => buildQrPayload(typeId, values), [typeId, values]);
  const warning = colorWarning(fg, bg);

  const setValue = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  useEffect(() => {
    let cancelled = false;
    if (!payload) {
      setDataUrl("");
      setError("");
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const QRCode = await loadQr();
        const url = await QRCode.toDataURL(payload, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 1024,
          color: { dark: fg, light: bg },
        });
        if (!cancelled) {
          setDataUrl(url);
          setError("");
        }
      } catch {
        if (!cancelled) {
          setDataUrl("");
          setError("Isinya terlalu panjang untuk dijadikan QR. Persingkat dulu teksnya.");
        }
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [payload, fg, bg]);

  async function downloadSvg() {
    try {
      const QRCode = await loadQr();
      const svg = await QRCode.toString(payload, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 2,
        color: { dark: fg, light: bg },
      });
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `qr-${typeId}.svg` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Gagal membuat file SVG.");
    }
  }

  return (
    <Modal title={tool.name} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {QR_TYPES.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setTypeId(t.id)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                typeId === t.id
                  ? "border-signal-500 bg-signal-500/10 text-signal-400"
                  : "border-white/10 text-white/60 hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {typeId === "file" ? (
          values.fileUrl ? (
            <div className="space-y-2 rounded-xl border border-white/10 p-3">
              <p className="text-xs font-medium text-white/50">QR berisi link file ini</p>
              <p className="break-all text-sm text-white/80">{values.fileUrl}</p>
              <button
                type="button"
                onClick={() => setValue("fileUrl", "")}
                className="text-xs text-signal-400 hover:underline"
              >
                Ganti file
              </button>
            </div>
          ) : (
            <UploadBox
              defaultExpiry="24h"
              hint="QR berhenti berfungsi setelah link kedaluwarsa. Pilih Permanen untuk file kecil yang akan dicetak."
              onUploaded={(r) => setValue("fileUrl", r.url)}
            />
          )
        ) : (
          <div className="space-y-3">
            {type.fields.map((f) => (
              <QrField key={f.name} field={f} value={values[f.name]} onChange={setValue} />
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <ColorInput label="Warna QR" value={fg} onChange={setFg} />
          <ColorInput label="Warna latar" value={bg} onChange={setBg} />
        </div>
        {warning && <p className="text-xs text-amber-300">{warning}</p>}

        {error && (
          <p className="rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-3 text-sm text-flare-400">
            {error}
          </p>
        )}

        {dataUrl ? (
          <div className="animate-rise space-y-3">
            <div className="rounded-xl border border-white/10 p-3" style={{ backgroundColor: bg }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUrl} alt="Kode QR hasil" className="mx-auto w-full max-w-[260px]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={dataUrl}
                download={`qr-${typeId}.png`}
                className="flex items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 hover:scale-[1.01]"
              >
                <Download size={16} />
                Unduh PNG
              </a>
              <button
                type="button"
                onClick={downloadSvg}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/5"
              >
                <Download size={16} />
                Unduh SVG
              </button>
            </div>
            <p className="text-xs text-white/40">PNG 1024 px untuk dibagikan, SVG untuk dicetak tanpa pecah.</p>
          </div>
        ) : (
          !error && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
              <QrCode size={22} />
              QR muncul di sini setelah form terisi.
            </div>
          )
        )}
      </div>
    </Modal>
  );
}

function ColorInput({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-ink-950 px-3 py-2">
      <span className="text-xs font-medium text-white/50">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
        aria-label={label}
      />
    </label>
  );
}

function QrField({ field, value, onChange }) {
  if (field.type === "toggle") {
    return (
      <label className="flex items-center justify-between rounded-xl border border-white/10 bg-ink-950 px-4 py-3">
        <span className="text-sm text-white/70">{field.label}</span>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(field.name, e.target.checked)}
          className="h-5 w-5 accent-signal-500"
        />
      </label>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white/50">{field.label}</label>
      {field.type === "textarea" ? (
        <textarea
          rows={3}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={FIELD}
        />
      ) : field.type === "select" ? (
        <select value={value} onChange={(e) => onChange(field.name, e.target.value)} className={FIELD}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type}
          inputMode={field.inputMode}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={FIELD}
        />
      )}
    </div>
  );
}
