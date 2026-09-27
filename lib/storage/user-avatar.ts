import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_CONTENT_TYPE = "image/webp";

const storageRoot = path.resolve(process.env.USER_STORAGE_DIR ?? path.join(process.cwd(), "storage", "users"));
const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function avatarDirectory(userId: string) {
  if (!userIdPattern.test(userId)) throw new Error("INVALID_USER_ID");
  const directory = path.resolve(storageRoot, userId, "avatar");
  if (!directory.startsWith(`${storageRoot}${path.sep}`)) throw new Error("INVALID_AVATAR_PATH");
  return directory;
}

export function avatarStorageKey(userId: string) {
  avatarDirectory(userId);
  return `users/${userId}/avatar/avatar.webp`;
}

export async function normalizeAvatar(input: Buffer) {
  if (input.length === 0 || input.length > AVATAR_MAX_BYTES) throw new Error("AVATAR_SIZE_INVALID");

  const image = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 });
  const metadata = await image.metadata();
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) throw new Error("AVATAR_TYPE_INVALID");
  if (!metadata.width || !metadata.height) throw new Error("AVATAR_DIMENSIONS_INVALID");

  return image
    .rotate()
    .resize(512, 512, { fit: "cover", position: "attention", withoutEnlargement: false })
    .webp({ quality: 84, effort: 4 })
    .toBuffer();
}

export async function saveUserAvatar(userId: string, image: Buffer) {
  const directory = avatarDirectory(userId);
  const destination = path.join(directory, "avatar.webp");
  const temporary = path.join(directory, `avatar-${crypto.randomUUID()}.tmp`);
  await mkdir(directory, { recursive: true });
  await writeFile(temporary, image, { flag: "wx" });
  await rename(temporary, destination);
  return avatarStorageKey(userId);
}

export async function readUserAvatar(userId: string) {
  return readFile(path.join(avatarDirectory(userId), "avatar.webp"));
}

export async function removeUserAvatar(userId: string) {
  await rm(avatarDirectory(userId), { recursive: true, force: true });
}
