import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { PrismaClient } from "@prisma/client";

const envPath = path.join(process.cwd(), ".env");
const settingKeys = [
  "CLOUDFLARE_STREAM_SIGNING_KEY_ID",
  "CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY",
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function applyEnv(content) {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, "\n");
    if (!(key in process.env)) process.env[key] = value;
  }
}

function encodeEnvValue(value) {
  return `"${String(value).replace(/\r\n/g, "\n").replace(/\n/g, "\\n").replace(/"/g, '\\"')}"`;
}

function upsertEnvValue(content, key, value) {
  const encoded = `${key}=${encodeEnvValue(value)}`;
  const lines = content.split(/\r?\n/);
  let replaced = false;
  const nextLines = lines.map((line) => {
    if (line.match(new RegExp(`^\\s*${key}=`))) {
      replaced = true;
      return encoded;
    }
    return line;
  });

  if (!replaced) {
    while (nextLines.length && nextLines[nextLines.length - 1] === "") nextLines.pop();
    nextLines.push(encoded);
  }

  return `${nextLines.join("\n")}\n`;
}

const envContent = loadEnvFile(envPath);
applyEnv(envContent);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing from .env.");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const rows = await prisma.$queryRaw`
    SELECT setting_key, setting_value
    FROM tochukwu_admin_settings
    WHERE setting_key IN ('CLOUDFLARE_STREAM_SIGNING_KEY_ID', 'CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY')
  `;
  const values = new Map(
    rows.map((row) => [String(row.setting_key || "").trim(), String(row.setting_value || "").trim()])
  );

  const missing = settingKeys.filter((key) => !values.get(key));
  if (missing.length) {
    console.error(`${missing.join(", ")} not found in tochukwu_admin_settings.`);
    process.exitCode = 1;
  } else {
    let nextEnv = envContent;
    for (const key of settingKeys) {
      nextEnv = upsertEnvValue(nextEnv, key, values.get(key));
    }
    fs.writeFileSync(envPath, nextEnv, "utf8");
    console.log("Cloudflare Stream signing key id and private key copied to .env.");
  }
} finally {
  await prisma.$disconnect();
}
