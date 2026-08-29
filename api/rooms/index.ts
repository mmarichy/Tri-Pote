import type { VercelRequest, VercelResponse } from "@vercel/node";

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

    const { createRoom } = await import("./_lib/rooms");
    const room = await createRoom(hostName);
    return res.status(201).json({
      room,
      playerId: room.hostId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    console.error("createRoom error:", err);
    return res.status(500).json({ error: message });
  }
}
