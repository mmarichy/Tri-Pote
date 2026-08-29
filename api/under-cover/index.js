export default async function handler(req, res) {
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
    const { hostName } = req.body || {};
    if (!hostName?.trim()) {
      return res.status(400).json({ error: "Nom requis" });
    }

    const { createRoom } = await import("./_lib/rooms.js");
    const { room, playerId } = await createRoom(hostName);
    return res.status(201).json({ room, playerId });
  } catch (err) {
    console.error("under-cover createRoom error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
  }
}
