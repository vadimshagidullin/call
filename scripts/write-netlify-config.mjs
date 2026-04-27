import fs from "node:fs";
import path from "node:path";

const signalingUrl = (process.env.SIGNALING_URL || "").trim();
const buildId = process.env.COMMIT_REF || process.env.RENDER_GIT_COMMIT || process.env.DEPLOY_ID || "netlify";
const target = path.join(process.cwd(), "Preview", "runtime-config.js");
const value = JSON.stringify(signalingUrl);
const build = JSON.stringify(buildId.slice(0, 12));

fs.writeFileSync(target, `window.CLEARCALL_SIGNALING_URL = ${value};\nwindow.CLEARCALL_BUILD = ${build};\n`);
console.log(signalingUrl ? `Using signaling server ${signalingUrl}` : "No SIGNALING_URL configured");
