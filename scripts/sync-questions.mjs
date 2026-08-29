import { copyFileSync } from "node:fs";

copyFileSync("public/questions.json", "api/_lib/questions.json");
console.log("Questions synchronisees vers api/_lib/questions.json");
