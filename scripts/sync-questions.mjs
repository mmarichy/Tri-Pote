import { copyFileSync } from "node:fs";

copyFileSync("public/questions.json", "api/rooms/_lib/questions.json");
console.log("Questions synchronisees vers api/rooms/_lib/questions.json");
