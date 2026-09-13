"use client";

import { useState } from "react";
import { Loader2, Download, Upload } from "lucide-react";
import Modal from "@/components/Modal";

function buildInitialState(fields = []) {
  const state = {};
  fields.forEach((f) => {
    state[f.name] = f.default ?? "";
  });
  return state;
}

export default function ToolModal({ tool, onClose }) {
  const [values, setValues] = useState(() => buildInitialState(tool.fields));
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState(null);
  const [resultKind, setResultKind] = useState(null); // "image" | "video"

  function updateField(name, value) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
  }

  async function handleResponse(res) {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      throw new Error(data.message || "Gagal memproses permintaan.");
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    setResultUrl(objectUrl);
    setResultKind(blob.type.startsWith("video") ? "video" : "image");
  }

  async function handleTextSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResultUrl(null);
    try {
      const params = new URLSearchParams();
      Object.entries(values).forEach(([k, v]) => params.set(k, v));
      const res = await fetch(`/api/tools/${tool.id}?${params.toString()}`);
      await handleResponse(res);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadSubmit(e) {
    e.preventDefault();
    if (!file) return;
    // Untuk tool yang teksnya opsional tapi tidak boleh kosong semua
    // (misal Meme: teks atas & bawah, minimal salah satu harus diisi).
    if (tool.requireAtLeastOneOf) {
      const anyFilled = tool.requireAtLeastOneOf.some((name) => (values[name] || "").toString().trim());
      if (!anyFilled) {
        setError("Isi minimal salah satu kolom teks di atas.");
        return;
      }
    }
    setLoading(true);
    setError("");
    setResultUrl(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // Untuk tool bertipe "upload-text" (misal fakeml), sertakan juga
      // field teks tambahan seperti nickname.
      if (tool.kind === "upload-text") {
        Object.entries(values).forEach(([k, v]) => formData.append(k, v));
      }
      const res = await fetch(`/api/tools/process?tool=${tool.id}`, {
        method: "POST",
        body: formData,
      });
      await handleResponse(res);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={tool.name} onClose={onClose}>
      {tool.kind === "text" && (
        <form onSubmit={handleTextSubmit} className="space-y-3">
          {tool.fields.map((field) => (
            <Field key={field.name} field={field} value={values[field.name]} onChange={updateField} />
          ))}
          <SubmitButton loading={loading} />
        </form>
      )}

      {(tool.kind === "upload" || tool.kind === "upload-text") && (
        <form onSubmit={handleUploadSubmit} className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/60 hover:border-white/30 hover:text-white/80">
            <Upload size={22} />
            {file ? file.name : "Pilih gambar dari perangkatmu"}
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>
          {filePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={filePreview} alt="" className="mx-auto max-h-52 rounded-xl border border-white/10" />
          )}
          {tool.kind === "upload-text" &&
            tool.fields.map((field) => (
              <Field key={field.name} field={field} value={values[field.name]} onChange={updateField} />
            ))}
          <SubmitButton loading={loading} disabled={!file} />
        </form>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-3 text-sm text-flare-400">
          {error}
        </p>
      )}

      {resultUrl && (
        <div className="mt-5 animate-rise space-y-3">
          {resultKind === "video" ? (
            <video controls autoPlay loop src={resultUrl} className="w-full rounded-xl border border-white/10 bg-black" />
          ) : (
            <div
              className="rounded-xl border border-white/10 p-1"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #201d33 25%, transparent 25%), linear-gradient(-45deg, #201d33 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #201d33 75%), linear-gradient(-45deg, transparent 75%, #201d33 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                backgroundColor: "#141225",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultUrl} alt="Hasil" className="mx-auto max-h-80 w-auto rounded-lg" />
            </div>
          )}
          <a
            href={resultUrl}
            download={`${tool.id}-result.${resultKind === "video" ? "mp4" : "png"}`}
            className="flex items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 hover:scale-[1.01]"
          >
            <Download size={16} />
            Unduh hasil
          </a>
        </div>
      )}
    </Modal>
  );
}

function SubmitButton({ loading, disabled }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {loading ? "Memproses..." : "Buat sekarang"}
    </button>
  );
}

function Field({ field, value, onChange }) {
  const base =
    "w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-sm text-white placeholder:text-white/30 focus-ring";

  if (field.type === "textarea") {
    return (
      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/50">{field.label}</label>
        <textarea
          required={field.required}
          rows={3}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={base}
        />
      </div>
    );
  }

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

  if (field.type === "select") {
    return (
      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/50">{field.label}</label>
        <select
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={base}
        >
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white/50">{field.label}</label>
      <input
        type={field.type}
        required={field.required}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(field.name, e.target.value)}
        className={base}
      />
    </div>
  );
}
