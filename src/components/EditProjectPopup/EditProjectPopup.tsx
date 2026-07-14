import React, { useState, useRef, useCallback, useEffect } from "react";
import type { Project } from "../../types.js";
import { useI18n } from "../../hooks/useI18n.js";
import { CloseXIcon, UploadIcon } from "../icons/icons.js";
import "../../styles/EditProjectPopup.css";

const SWATCHES = ["#223883ff", "#0e5340ff", "#7c2d12", "#361868ff", "#155e75"];

function initialLetter(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const ch = t.replace(/[^\p{L}\p{N}]+/gu, "")[0];
  return ch ? ch.toUpperCase() : "?";
}

interface Props {
  project: Project;
  onSave: () => void;
  onClose: () => void;
}

export function EditProjectPopup({ project, onSave, onClose }: Props): React.ReactElement {
  const { t } = useI18n();
  const [name, setName] = useState(project.name);
  const [photo, setPhoto] = useState(project.photo ?? "");
  const [color, setColor] = useState(project.color);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) loadFile(file);
    };

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);

    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, [loadFile]);

  const handleClickUpload = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadFile(file);
    },
    [loadFile],
  );

  const handleClearPhoto = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPhoto("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await window.vibe.projects.rename(project.id, trimmed);
    await window.vibe.projects.setColor(project.id, color);
    await window.vibe.projects.setPhoto(project.id, photo || null);
    await window.vibe.projects.setIcon(project.id, null);
    onSave();
  };

  const previewStyle = photo ? undefined : ({ "--avatar-bg": color } as React.CSSProperties);

  return (
    <div className="edit-project-overlay" onClick={onClose}>
      <div className="edit-project" onClick={(e) => e.stopPropagation()}>
        <div className="edit-project__header">
          <h2 className="edit-project__title">{t("editProjectTitle")}</h2>
        </div>

        <label className="edit-project__label">{t("name")}</label>
        <input
          className="edit-project__input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <label className="edit-project__label">{t("projectIcon")}</label>
        <div className="edit-project__preview-wrap" ref={wrapRef} onClick={handleClickUpload}>
          <div
            className={"edit-project__preview" + (photo ? " edit-project__preview--photo" : "")}
            style={previewStyle}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="edit-project__file-input"
              onChange={handleFileChange}
            />
            {photo ? (
              <img src={photo} alt="" className="edit-project__preview-img" />
            ) : (
              <span className="edit-project__preview-letter">{initialLetter(name)}</span>
            )}
            <div className={"edit-project__preview-overlay" + (dragOver ? " edit-project__preview-overlay--drag" : "")}>
              {photo ? (
                <button className="edit-project__preview-action" onClick={handleClearPhoto}>
                  <CloseXIcon />
                </button>
              ) : (
                <UploadIcon />
              )}
            </div>
          </div>
          <span className="edit-project__preview-hint">Drop photo or click</span>
        </div>

        <div className={"edit-project__bg-wrap" + (photo ? " edit-project__bg-wrap--hidden" : "")}>
          <label className="edit-project__label">{t("backgroundColor")}</label>
          <div className="edit-project__swatches">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                className={"edit-project__swatch" + (color === swatch ? " edit-project__swatch--active" : "")}
                style={{ "--swatch-color": swatch } as React.CSSProperties}
                onClick={() => setColor(swatch)}
                aria-label={swatch}
              />
            ))}
          </div>
        </div>

        <div className="edit-project__actions">
          <button className="edit-project__btn edit-project__btn--primary" onClick={handleSave}>
            {t("save")}
          </button>
          <button className="edit-project__btn" onClick={onClose}>
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
