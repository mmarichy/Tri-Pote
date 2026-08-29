import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { RoomAction } from "../../shared/types";
import { getRoomMeta, getRoomState, handleAction } from "../_lib/rooms";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const code = String(req.query.code ?? "").toUpperCase();
  if (!code) {
    return res.status(400).json({ error: "Code requis" });
  }

  if (req.method === "GET") {
    try {
      if (req.query.meta === "1") {
        const meta = await getRoomMeta(code);
        return res.status(200).json(meta);
      }
      const room = await getRoomState(code);
      return res.status(200).json({ room });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      return res.status(404).json({ error: message });
    }
  }

  if (req.method === "POST") {
    try {
      const room = await handleAction(code, req.body as RoomAction);
      return res.status(200).json({ room });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      const status = message.includes("introuvable") ? 404 : 400;
      return res.status(status).json({ error: message });
    }
  }

  return res.status(405).json({ error: "Méthode non autorisée" });
}
