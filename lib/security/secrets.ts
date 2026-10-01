import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { getEnv } from "@/lib/env";

const algorithm = "aes-256-gcm";
let encryptionKey: Buffer | undefined;

function getEncryptionKey() {
  if (!encryptionKey) {
    encryptionKey = createHash("sha256").update(getEnv().SECRETS_ENCRYPTION_KEY).digest();
  }
  return encryptionKey;
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(payload: string): string {
  const [ivValue, tagValue, encryptedValue] = payload.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv(algorithm, getEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}
