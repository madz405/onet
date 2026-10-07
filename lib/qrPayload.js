// Menyusun isi QR dari form. Fungsi murni (tanpa React) supaya mudah dites.
// Tiap builder mengembalikan "" kalau kolom wajibnya belum diisi, jadi QR
// baru muncul setelah isinya lengkap.

export const QR_TYPES = [
  {
    id: "text",
    label: "Teks / link",
    fields: [
      {
        name: "text",
        label: "Teks atau link",
        type: "textarea",
        placeholder: "https://contoh.com atau teks apa saja",
      },
    ],
  },
  {
    id: "wifi",
    label: "WiFi",
    fields: [
      { name: "ssid", label: "Nama WiFi (SSID)", type: "text", placeholder: "Nama jaringan" },
      { name: "wifiPassword", label: "Password", type: "text", placeholder: "Password WiFi" },
      {
        name: "security",
        label: "Keamanan",
        type: "select",
        options: [
          { value: "WPA", label: "WPA / WPA2 / WPA3" },
          { value: "WEP", label: "WEP" },
          { value: "nopass", label: "Tanpa password" },
        ],
        default: "WPA",
      },
      { name: "hidden", label: "Jaringan tersembunyi", type: "toggle", default: false },
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    fields: [
      { name: "waNumber", label: "Nomor WhatsApp", type: "text", placeholder: "08123456789", inputMode: "tel" },
      { name: "waMessage", label: "Pesan awal (opsional)", type: "textarea", placeholder: "Halo, saya mau tanya..." },
    ],
  },
  {
    id: "email",
    label: "Email",
    fields: [
      { name: "mailTo", label: "Alamat email", type: "email", placeholder: "nama@contoh.com" },
      { name: "mailSubject", label: "Subjek (opsional)", type: "text", placeholder: "Subjek email" },
      { name: "mailBody", label: "Isi pesan (opsional)", type: "textarea", placeholder: "Tulis pesan..." },
    ],
  },
  {
    id: "contact",
    label: "Kontak",
    fields: [
      { name: "cName", label: "Nama", type: "text", placeholder: "Nama lengkap" },
      { name: "cPhone", label: "Telepon (opsional)", type: "text", placeholder: "+6281234567890", inputMode: "tel" },
      { name: "cEmail", label: "Email (opsional)", type: "email", placeholder: "nama@contoh.com" },
      { name: "cOrg", label: "Perusahaan (opsional)", type: "text", placeholder: "Nama perusahaan" },
    ],
  },
  { id: "file", label: "File / gambar", fields: [] },
];

export function defaultQrValues() {
  const v = {};
  QR_TYPES.forEach((t) => t.fields.forEach((f) => (v[f.name] = f.default ?? "")));
  v.fileUrl = "";
  return v;
}

const clean = (s) => (s ?? "").toString().trim();

// Nomor lokal Indonesia (08xx) diubah ke format internasional (628xx) yang
// dibutuhkan wa.me. Nomor yang sudah berawalan kode negara dibiarkan.
export function normalizePhone(raw) {
  let d = clean(raw).replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0")) d = "62" + d.slice(1);
  return d;
}

// Format WiFi QR: karakter \ ; , : " di dalam nilai harus di-escape.
const wifiEsc = (s) => s.replace(/([\\;,:"])/g, "\\$1");

// vCard: \ ; , dan baris baru di-escape.
const vcardEsc = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function buildQrPayload(type, v) {
  switch (type) {
    case "text":
      return clean(v.text);

    case "wifi": {
      const ssid = clean(v.ssid);
      if (!ssid) return "";
      const security = ["WPA", "WEP", "nopass"].includes(v.security) ? v.security : "WPA";
      const password = clean(v.wifiPassword);
      if (security !== "nopass" && !password) return "";
      let out = `WIFI:T:${security};S:${wifiEsc(ssid)};`;
      if (security !== "nopass") out += `P:${wifiEsc(password)};`;
      if (v.hidden) out += "H:true;";
      return out + ";";
    }

    case "whatsapp": {
      const number = normalizePhone(v.waNumber);
      if (number.length < 8) return "";
      const msg = clean(v.waMessage);
      return `https://wa.me/${number}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
    }

    case "email": {
      const to = clean(v.mailTo);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return "";
      const params = [];
      if (clean(v.mailSubject)) params.push(`subject=${encodeURIComponent(clean(v.mailSubject))}`);
      if (clean(v.mailBody)) params.push(`body=${encodeURIComponent(clean(v.mailBody))}`);
      return `mailto:${to}${params.length ? `?${params.join("&")}` : ""}`;
    }

    case "contact": {
      const name = clean(v.cName);
      if (!name) return "";
      const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:;${vcardEsc(name)};;;`, `FN:${vcardEsc(name)}`];
      if (clean(v.cOrg)) lines.push(`ORG:${vcardEsc(clean(v.cOrg))}`);
      if (clean(v.cPhone)) lines.push(`TEL:${vcardEsc(clean(v.cPhone))}`);
      if (clean(v.cEmail)) lines.push(`EMAIL:${vcardEsc(clean(v.cEmail))}`);
      lines.push("END:VCARD");
      return lines.join("\r\n");
    }

    case "file":
      return clean(v.fileUrl);

    default:
      return "";
  }
}
