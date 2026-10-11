import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const top = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const privFile = path.join(top, "tools/vapid-private.json");

if (fs.existsSync(privFile) && !process.argv.includes("--force")) {
  console.log("すでにあります。作り直すなら --force を付けてください（作り直すと、いまの購読者への通知は、届かなくなります）。");
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = privateKey.export({ format: "jwk" });
const pub = publicKey.export({ format: "jwk" });
const b64u = (s) => s;
const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]).toString("base64url");

fs.writeFileSync(privFile, JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }));
fs.writeFileSync(path.join(top, "site/assets/push-config.js"), `export const VAPID_PUBLIC = "${b64u(raw)}";\n`);
console.log("公開鍵を site/assets/push-config.js に書きました。");
console.log("秘密の鍵を tools/vapid-private.json に書きました（リポジトリには入りません。画面には出しません）。");
