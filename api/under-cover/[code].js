export default async function handler(req, res) {
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

  try {
    const { getRoomMeta, getRoomState, handleAction } = await import(
      "./_lib/rooms.js"
    );

    if (req.method === "GET") {
      if (req.query.meta === "1") {
        const meta = await getRoomMeta(code);
        return res.status(200).json(meta);
      }
      const room = await getRoomState(
        code,
        typeof req.query.playerId === "string" ? req.query.playerId : undefined
      );
      return res.status(200).json({ room });
    }

    if (req.method === "POST") {
      const room = await handleAction(code, req.body);
      return res.status(200).json({ room });
    }

    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    const status = message.includes("introuvable") ? 404 : 500;
    return res.status(status).json({ error: message });
  }
}
