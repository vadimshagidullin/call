import fs from "node:fs";
import path from "node:path";

const signalingUrl = (process.env.SIGNALING_URL || "").trim();
const target = path.join(process.cwd(), "Preview", "runtime-config.js");
const value = JSON.stringify(signalingUrl);

fs.writeFileSync(target, `window.CLEARCALL_SIGNALING_URL = ${value};\n`);
console.log(signalingUrl ? `Using signaling server ${signalingUrl}` : "No SIGNALING_URL configured");
