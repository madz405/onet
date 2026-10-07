import { NextResponse } from "next/server";
import { uploadAnyFile } from "@/lib/uploadFile";
import { SERVER_MAX_BYTES, validateUpload } from "@/lib/uploadRules";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(message, status = 400) {
  return NextResponse.json({ status: false, message }, { status });
}

export async function POST(req) {
  let data;
  try {
    data = await req.formData();
  } catch {
    return fail("Gagal membaca file yang diunggah.");
  }

  const file = data.get("file");
  const expiry = (data.get("expiry") || "24h").toString();
  if (!file || typeof file === "string") return fail("Pilih file terlebih dahulu.");

  const invalid = validateUpload(file.name, file.size, expiry);
  if (invalid) return fail(invalid);
  if (file.size > SERVER_MAX_BYTES) {
    return fail("File lebih dari 4 MB harus dikirim langsung dari browser. Coba lagi.", 413);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadAnyFile(buffer, file.name, file.type, expiry);
    return NextResponse.json({ status: true, ...result });
  } catch (err) {
    return fail(err.message || "Gagal upload file.", 502);
  }
}
