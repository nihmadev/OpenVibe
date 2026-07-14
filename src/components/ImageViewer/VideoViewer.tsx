import React, { useEffect, useRef, useState, useCallback } from "react";
import { useI18n } from "../../hooks/useI18n.js";
import { PlayIcon, PauseIcon, VolumeMutedIcon, VolumeLowIcon, VolumeHighIcon, FullscreenIcon } from "../icons/icons.js";
import "../../styles/VideoViewer.css";

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogg", "mov", "avi", "mkv", "wmv", "flv", "m4v", "3gp", "avi"]);

function getExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot <= 0) return "";
  return path.slice(dot + 1).toLowerCase();
}

function getVideoMimeType(ext: string): string {
  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "ogg":
      return "video/ogg";
    case "mov":
      return "video/quicktime";
    case "avi":
      return "video/x-msvideo";
    case "mkv":
      return "video/x-matroska";
    case "wmv":
      return "video/x-ms-wmv";
    case "flv":
      return "video/x-flv";
    case "m4v":
      return "video/x-m4v";
    case "3gp":
      return "video/3gpp";
    default:
      return "video/mp4";
  }
}

export function isVideoFile(path: string): boolean {
  const ext = getExtension(path);
  return VIDEO_EXTENSIONS.has(ext);
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface Props {
  path: string;
}

export function VideoViewer({ path }: Props): React.ReactElement {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Load video file
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
        const mime = getVideoMimeType(ext);
        setDataUrl(`data:${mime};base64,${res.data}`);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to read file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [path]);

  // Media event handlers
  const onPlay = useCallback(() => setPlaying(true), []);
  const onPause = useCallback(() => setPlaying(false), []);
  const onTimeUpdate = useCallback(() => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }, []);
  const onLoadedMetadata = useCallback(() => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  }, []);
  const onEnded = useCallback(() => setPlaying(false), []);

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  // Seek via progress bar click
  const seek = useCallback(
    (e: React.MouseEvent) => {
      const bar = progressRef.current;
      const v = videoRef.current;
      if (!bar || !v) return;
      const rect = bar.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      v.currentTime = x * duration;
    },
    [duration],
  );

  // Volume
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v;
      setMuted(v === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  // Playback speed
  const changeSpeed = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setShowSpeedMenu(false);
  }, []);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    const el = videoRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === "f") {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === "m") {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleFullscreen, toggleMute]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div className="video-viewer video-viewer--error">
        <span className="video-viewer__error-title">{t("cannotOpenFile")}</span>
        <span className="video-viewer__error-msg">{error}</span>
      </div>
    );
  }

  if (loading || !dataUrl) {
    return <div className="video-viewer video-viewer--loading">{t("loading")}</div>;
  }

  return (
    <div className="video-viewer">
      <div className="video-viewer__container">
        <video
          ref={videoRef}
          className="video-viewer__video"
          src={dataUrl}
          preload="metadata"
          onClick={togglePlay}
          onPlay={onPlay}
          onPause={onPause}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onEnded}
        />

        <div className="video-viewer__controls">
          {/* Progress bar */}
          <div ref={progressRef} className="video-viewer__progress" onClick={seek}>
            <div className="video-viewer__progress-track">
              <div className="video-viewer__progress-fill" style={{ width: `${progress}%` }} />
              <div className="video-viewer__progress-thumb" style={{ left: `${progress}%` }} />
            </div>
          </div>

          <div className="video-viewer__controls-row">
            {/* Play/Pause */}
            <button
              className="video-viewer__btn"
              onClick={togglePlay}
              title={playing ? "Pause (Space)" : "Play (Space)"}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>

            {/* Time display */}
            <span className="video-viewer__time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Spacer */}
            <div className="video-viewer__spacer" />

            {/* Mute */}
            <button className="video-viewer__btn" onClick={toggleMute} title={muted ? "Unmute (M)" : "Mute (M)"}>
              {muted || volume === 0 ? <VolumeMutedIcon /> : volume < 0.5 ? <VolumeLowIcon /> : <VolumeHighIcon />}
            </button>

            {/* Volume slider */}
            <div className="video-viewer__volume-wrap">
              <input
                type="range"
                className="video-viewer__volume-slider"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                title="Volume"
              />
            </div>

            {/* Speed */}
            <div className="video-viewer__speed-wrap">
              <button
                className="video-viewer__btn video-viewer__speed-btn"
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                title="Playback speed"
              >
                {playbackRate}x
              </button>
              {showSpeedMenu && (
                <div className="video-viewer__speed-menu">
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      className={
                        "video-viewer__speed-opt" + (rate === playbackRate ? " video-viewer__speed-opt--active" : "")
                      }
                      onClick={() => changeSpeed(rate)}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button className="video-viewer__btn" onClick={toggleFullscreen} title="Fullscreen (F)">
              <FullscreenIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
