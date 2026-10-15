import { NextResponse } from "next/server";
import { proxyMedia } from "@/lib/proxyMedia";

export const runtime = "nodejs";

const API = "https://webapi-fawn.vercel.app/download/fakeff";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const username = (searchParams.get("username") || "").trim();
  const lobbyRaw = (searchParams.get("lobby") || "").trim();

  if (!username) {
    return NextResponse.json({ status: false, message: "Username tidak boleh kosong." }, { status: 400 });
  }
  if (username.length > 20) {
    return NextResponse.json({ status: false, message: "Username maksimal 20 karakter." }, { status: 400 });
  }

  // Lobby opsional (1-30). Kosong = acak 1-30.
  let lobby;
  if (lobbyRaw === "") {
    lobby = Math.floor(Math.random() * 30) + 1;
  } else {
    lobby = Number(lobbyRaw);
    if (!Number.isInteger(lobby) || lobby < 1 || lobby > 30) {
      return NextResponse.json({ status: false, message: "Lobby harus angka 1-30." }, { status: 400 });
    }
  }

  const url = `${API}?username=${encodeURIComponent(username)}&lobby=${lobby}&format=image`;
  return proxyMedia(url);
}
