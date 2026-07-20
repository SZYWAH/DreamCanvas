import { Media } from "@capacitor-community/media";
import { Capacitor } from "@capacitor/core";
import type { GenerationRecordV2 } from "./domain";
import { resolveDisplayImageUri } from "./storage";

export const readImageDimensions = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("无法读取上游返回图片的真实尺寸。"));
    image.src = src;
  });

const two = (value: number) => String(value).padStart(2, "0");

export const buildImageFileName = (record: GenerationRecordV2, now = new Date()) => {
  const stamp = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
  const dimensions = record.actualWidth && record.actualHeight
    ? `${record.actualWidth}x${record.actualHeight}`
    : record.requestedSize;
  return `DreamCanvas-${stamp}-${dimensions}`;
};

const ensureDreamCanvasAlbum = async () => {
  const current = await Media.getAlbums();
  const existing = current.albums.find((album) => album.name === "DreamCanvas");
  if (existing) return existing.identifier;
  await Media.createAlbum({ name: "DreamCanvas" });
  const refreshed = await Media.getAlbums();
  const created = refreshed.albums.find((album) => album.name === "DreamCanvas");
  if (!created) throw new Error("DreamCanvas 相册创建后未能被识别。");
  return created.identifier;
};

export const saveRecordToGallery = async (record: GenerationRecordV2) => {
  const fileName = buildImageFileName(record);
  if (Capacitor.isNativePlatform()) {
    const albumIdentifier = await ensureDreamCanvasAlbum();
    await Media.savePhoto({ path: record.imageUri, albumIdentifier, fileName });
    return "已保存到系统 DreamCanvas 相册。";
  }
  const anchor = document.createElement("a");
  anchor.href = resolveDisplayImageUri(record);
  anchor.download = `${fileName}.${record.mimeType === "image/jpeg" ? "jpg" : record.mimeType === "image/webp" ? "webp" : "png"}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return "浏览器下载已开始。";
};
