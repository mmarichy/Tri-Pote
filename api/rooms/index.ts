import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createRoom } from "./_lib/rooms";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    const { hostName } = req.body as { hostName?: string };
    if (!hostName?.trim()) {
      return res.status(400).json({ error: "Nom requis" });
    }

    const room = await createRoom(hostName);
    return res.status(201).json({
      room,
      playerId: room.hostId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return res.status(400).json({ error: message });
  }
}
