import React, { useEffect, useState } from "react";
import { useI18n } from "../../hooks/useI18n.js";
import "../../styles/ImageViewer.css";

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "webp", "ico", "tiff", "tif", "avif",
]);

const SVG_EXTENSION = "svg";

function getMimeType(ext: string): string {
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "bmp": return "image/bmp";
    case "webp": return "image/webp";
    case "ico": return "image/x-icon";
    case "tiff":
    case "tif": return "image/tiff";
    case "avif": return "image/avif";
    case "svg": return "image/svg+xml";
    default: return "image/png";
  }
}

function getExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot <= 0) return "";
  return path.slice(dot + 1).toLowerCase();
}

export function isImageFile(path: string): boolean {
  const ext = getExtension(path);
  return IMAGE_EXTENSIONS.has(ext) || ext === SVG_EXTENSION;
}

interface Props {
  path: string;
}

export function ImageViewer({ path }: Props): React.ReactElement {
  const { t } = useI18n();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setDataUrl(null);

      try {
        const res = await window.vibe.fs.readBinary(path);
        if (cancelled) return;

        if (!res.ok) {
          setError(res.error);
          return;
        }

        const ext = getExtension(path);
        const mime = getMimeType(ext);
        const url = `data:${mime};base64,${res.data}`;
        setDataUrl(url);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to read file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [path]);

  if (error) {
    return (
      <div className="image-viewer image-viewer--error">
        <span className="image-viewer__error-title">{t("cannotOpenFile")}</span>
        <span className="image-viewer__error-msg">{error}</span>
      </div>
    );
  }

  if (loading) {
    return <div className="image-viewer image-viewer--loading">{t("loading")}</div>;
  }

  return (
    <div className="image-viewer">
      <div className="image-viewer__container">
        <img
          className="image-viewer__img"
          src={dataUrl!}
          alt={path}
          draggable={false}
        />
      </div>
    </div>
  );
}
