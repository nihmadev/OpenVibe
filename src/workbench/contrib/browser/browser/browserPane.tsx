import { ArrowLeft, ArrowRight, Hand, MousePointer2, Plus, RotateCw, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/platform/localization/localizationService";
import type { BrowserEvent, BrowserTab, BrowserViewProps, BrowserViewport } from "../common/browser";
import { browserService } from "../tauri/browserService";
import { onBrowserEvent } from "./browserEventService";
import "./browserPane.css";

interface AgentPointer {
  x: number;
  y: number;
  durationMs: number;
  down: boolean;
  target?: string;
}

interface MappedPoint {
  x: number;
  y: number;
}

interface StageSize {
  width: number;
  height: number;
}

interface ManualPointerSample extends MappedPoint {
  deltaX?: number;
  deltaY?: number;
}

export function mapClientPointToViewport(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  viewport: BrowserViewport,
): MappedPoint {
  const x = ((clientX - rect.left) / Math.max(1, rect.width)) * viewport.width;
  const y = ((clientY - rect.top) / Math.max(1, rect.height)) * viewport.height;
  return {
    x: Math.min(viewport.width, Math.max(0, x)),
    y: Math.min(viewport.height, Math.max(0, y)),
  };
}

export function BrowserPane({ active }: BrowserViewProps): React.ReactElement {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [address, setAddress] = useState("");
  const [title, setTitle] = useState(t("browserTitle"));
  const [image, setImage] = useState<string>();
  const [viewport, setViewport] = useState<BrowserViewport>({ width: 1280, height: 800 });
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string>();
  const [pointer, setPointer] = useState<AgentPointer>({ x: 24, y: 24, durationMs: 0, down: false });
  const [pointerVisible, setPointerVisible] = useState(false);
  const [ripple, setRipple] = useState(0);
  const [stageSize, setStageSize] = useState<StageSize>({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef(viewport);
  const lastPointerSend = useRef(0);
  const imageMounted = useRef(false);
  const pendingFrame = useRef<string>();
  const frameRequest = useRef<number>();
  const pendingMove = useRef<ManualPointerSample>();
  const moveQueued = useRef(false);
  const pendingWheel = useRef<ManualPointerSample>();
  const wheelQueued = useRef(false);
  const addressEditing = useRef(false);
  const navigationPending = useRef(false);
  const committedUrl = useRef("");
  const manualRef = useRef(false);
  const inputQueue = useRef<Promise<unknown>>(Promise.resolve());
  const pointerHideTimer = useRef<number>();

  const enqueueInput = useCallback((operation: () => Promise<unknown>) => {
    inputQueue.current = inputQueue.current.then(operation, operation).catch((reason: unknown) => {
      setError(formatBrowserError(reason));
    });
  }, []);

  const presentFrame = useCallback((nextFrame: string) => {
    // Mount the image with React once. Subsequent 30–60 fps screencast
    // frames are committed directly on the next paint so a base64 frame does
    // not rerender the toolbar, tabs and cursor every 16 ms.
    if (!imageMounted.current) {
      imageMounted.current = true;
      setImage(nextFrame);
      return;
    }
    pendingFrame.current = nextFrame;
    if (frameRequest.current !== undefined) return;
    frameRequest.current = window.requestAnimationFrame(() => {
      frameRequest.current = undefined;
      const frame = pendingFrame.current;
      pendingFrame.current = undefined;
      if (!frame) return;
      if (imageRef.current) imageRef.current.src = frame;
      else setImage(frame);
    });
  }, []);

  const clearFrame = useCallback(() => {
    if (frameRequest.current !== undefined) window.cancelAnimationFrame(frameRequest.current);
    frameRequest.current = undefined;
    pendingFrame.current = undefined;
    imageMounted.current = false;
    setImage(undefined);
  }, []);

  const handleBrowserEvent = useCallback(
    (event: BrowserEvent) => {
      const commitUrl = (nextUrl: string | undefined) => {
        if (!nextUrl || isBlankPage(nextUrl) || navigationPending.current) return;
        if (committedUrl.current === nextUrl) return;
        committedUrl.current = nextUrl;
        setUrl(nextUrl);
        if (!addressEditing.current) setAddress(nextUrl);
      };
      switch (event.type) {
        case "browser:session-started":
          setError(undefined);
          setReady(true);
          setLoading(false);
          break;
        case "browser:page-changed":
          commitUrl(event.url);
          if (event.title) setTitle(event.title);
          if (event.tabs) setTabs(event.tabs);
          break;
        case "browser:loading":
          setLoading(event.loading);
          break;
        case "browser:snapshot":
          if (event.image) presentFrame(event.image);
          commitUrl(event.url);
          if (event.title) setTitle(event.title);
          if (event.viewport) {
            const current = viewportRef.current;
            if (
              current.width !== event.viewport.width ||
              current.height !== event.viewport.height ||
              current.deviceScaleFactor !== event.viewport.deviceScaleFactor
            ) {
              viewportRef.current = event.viewport;
              setViewport(event.viewport);
            }
          }
          break;
        case "browser:pointer-move":
          if (pointerHideTimer.current !== undefined) window.clearTimeout(pointerHideTimer.current);
          setPointerVisible(true);
          setPointer((current) => ({
            ...current,
            x: event.x,
            y: event.y,
            durationMs: event.durationMs,
            target: event.target,
          }));
          break;
        case "browser:pointer-down":
          setPointer((current) => ({ ...current, x: event.x, y: event.y, down: true }));
          break;
        case "browser:pointer-up":
          setPointer((current) => ({ ...current, x: event.x, y: event.y, down: false }));
          setRipple((value) => value + 1);
          break;
        case "browser:action-started":
          setPointer((current) => ({ ...current, target: event.target ?? event.url ?? event.action }));
          break;
        case "browser:action-completed":
          if (pointerHideTimer.current !== undefined) window.clearTimeout(pointerHideTimer.current);
          pointerHideTimer.current = window.setTimeout(() => setPointerVisible(false), 650);
          break;
        case "browser:manual-control":
          manualRef.current = event.manual;
          setManual(event.manual);
          if (event.manual) setPointerVisible(false);
          break;
        case "browser:error":
          setError(event.message);
          setLoading(false);
          setPointerVisible(false);
          break;
        case "browser:session-closed":
          clearFrame();
          setReady(false);
          setPointerVisible(false);
          break;
        default:
          break;
      }
    },
    [clearFrame, presentFrame],
  );

  useEffect(() => {
    const unsubscribe = onBrowserEvent(handleBrowserEvent);
    browserService
      .start()
      .then(() => setReady(true))
      .catch((reason: unknown) => {
        setError(formatBrowserError(reason));
        setLoading(false);
      });
    return () => {
      unsubscribe();
      if (pointerHideTimer.current !== undefined) window.clearTimeout(pointerHideTimer.current);
      if (frameRequest.current !== undefined) window.cancelAnimationFrame(frameRequest.current);
      void browserService.close();
    };
  }, [handleBrowserEvent]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const update = () => setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    update();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active || !ready || stageSize.width <= 0 || stageSize.height <= 0) return;
    const timer = window.setTimeout(() => {
      void browserService.resize(Math.round(stageSize.width), Math.round(stageSize.height)).catch((reason: unknown) => {
        setError(formatBrowserError(reason));
      });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [active, ready, stageSize.height, stageSize.width]);

  useEffect(() => {
    if (!ready) return;
    void browserService.setStreamActive(active).catch((reason: unknown) => {
      setError(formatBrowserError(reason));
    });
  }, [active, ready]);

  const submitAddress = (event: React.FormEvent) => {
    event.preventDefault();
    const draft = address.trim();
    if (!draft) return;
    addressEditing.current = false;
    navigationPending.current = true;
    setError(undefined);
    setLoading(true);
    browserService
      .navigate(draft)
      .then((result: unknown) => {
        const committed = browserResultUrl(result) ?? draft;
        navigationPending.current = false;
        committedUrl.current = committed;
        setUrl(committed);
        setAddress(committed);
      })
      .catch((reason: unknown) => {
        navigationPending.current = false;
        setAddress(committedUrl.current);
        setError(formatBrowserError(reason));
        setLoading(false);
      });
  };

  const showBlankTab = () => {
    addressEditing.current = false;
    navigationPending.current = false;
    committedUrl.current = "";
    setUrl("");
    setAddress("");
    clearFrame();
    setTitle(t("browserTitle"));
    setError(undefined);
    setLoading(false);
  };

  const queueMove = useCallback(
    (point: ManualPointerSample) => {
      pendingMove.current = point;
      const flush = () => {
        if (moveQueued.current || !pendingMove.current) return;
        moveQueued.current = true;
        enqueueInput(async () => {
          const next = pendingMove.current;
          pendingMove.current = undefined;
          try {
            if (next) await browserService.pointer("move", next.x, next.y);
          } finally {
            moveQueued.current = false;
            flush();
          }
        });
      };
      flush();
    },
    [enqueueInput],
  );

  const queueWheel = useCallback(
    (point: ManualPointerSample) => {
      const previous = pendingWheel.current;
      pendingWheel.current = {
        x: point.x,
        y: point.y,
        deltaX: (previous?.deltaX ?? 0) + (point.deltaX ?? 0),
        deltaY: (previous?.deltaY ?? 0) + (point.deltaY ?? 0),
      };
      const flush = () => {
        if (wheelQueued.current || !pendingWheel.current) return;
        wheelQueued.current = true;
        enqueueInput(async () => {
          const next = pendingWheel.current;
          pendingWheel.current = undefined;
          try {
            if (next) {
              await browserService.pointer("wheel", next.x, next.y, next.deltaX ?? 0, next.deltaY ?? 0);
            }
          } finally {
            wheelQueued.current = false;
            flush();
          }
        });
      };
      flush();
    },
    [enqueueInput],
  );

  const sendPointer = useCallback(
    (kind: "move" | "down" | "up" | "wheel", event: React.MouseEvent | React.WheelEvent) => {
      if (!imageRef.current) return;
      const wasManual = manualRef.current;
      // Merely crossing or hovering the browser is not an intent to interact.
      // A click, wheel gesture, or the toolbar button starts manual input.
      if (!wasManual && (kind === "move" || kind === "up")) return;
      const now = performance.now();
      if (kind === "move" && lastPointerSend.current > 0 && now - lastPointerSend.current < 16) return;
      lastPointerSend.current = now;
      const point = mapClientPointToViewport(
        event.clientX,
        event.clientY,
        imageRef.current.getBoundingClientRect(),
        viewport,
      );
      const wheel = "deltaX" in event ? event : undefined;
      if (!wasManual) {
        manualRef.current = true;
        setManual(true);
        setPointerVisible(false);
      }
      if (wasManual && kind === "move") {
        queueMove(point);
        return;
      }
      if (wasManual && kind === "wheel") {
        queueWheel({ ...point, deltaX: wheel?.deltaX ?? 0, deltaY: wheel?.deltaY ?? 0 });
        return;
      }
      enqueueInput(async () => {
        if (!wasManual) {
          try {
            await browserService.setManualControl(true);
          } catch (reason) {
            manualRef.current = false;
            setManual(false);
            throw reason;
          }
        }
        return browserService.pointer(kind, point.x, point.y, wheel?.deltaX ?? 0, wheel?.deltaY ?? 0);
      });
    },
    [enqueueInput, queueMove, queueWheel, viewport],
  );

  const handleKey = (event: React.KeyboardEvent) => {
    if (!manualRef.current) return;
    event.preventDefault();
    const text = event.key.length === 1 && !event.ctrlKey && !event.metaKey ? event.key : undefined;
    enqueueInput(() => browserService.key(event.key, text));
  };

  const toggleManualControl = () => {
    const next = !manualRef.current;
    manualRef.current = next;
    setManual(next);
    if (next) setPointerVisible(false);
    enqueueInput(() => browserService.setManualControl(next));
  };

  const pointerStyle = useMemo<React.CSSProperties>(
    () => ({
      left: `${(pointer.x / Math.max(1, viewport.width)) * 100}%`,
      top: `${(pointer.y / Math.max(1, viewport.height)) * 100}%`,
      transitionDuration: `${pointer.durationMs}ms`,
    }),
    [pointer.durationMs, pointer.x, pointer.y, viewport.height, viewport.width],
  );
  const viewportStyle = useMemo<React.CSSProperties>(() => {
    if (stageSize.width <= 0 || stageSize.height <= 0) return { aspectRatio: `${viewport.width} / ${viewport.height}` };
    const scale = Math.min(stageSize.width / viewport.width, stageSize.height / viewport.height);
    return { width: viewport.width * scale, height: viewport.height * scale };
  }, [stageSize.height, stageSize.width, viewport.height, viewport.width]);

  return (
    <section className="browser-pane" aria-label={t("browserTitle")}>
      <div className="browser-pane__toolbar">
        <div className="browser-pane__nav">
          <button
            type="button"
            aria-label={t("browserBack")}
            title={t("browserBack")}
            onClick={() => browserService.history(-1)}
          >
            <ArrowLeft size={15} />
          </button>
          <button
            type="button"
            aria-label={t("browserForward")}
            title={t("browserForward")}
            onClick={() => browserService.history(1)}
          >
            <ArrowRight size={15} />
          </button>
          <button
            type="button"
            aria-label={t("browserReload")}
            title={t("browserReload")}
            onClick={() => browserService.reload()}
          >
            <RotateCw size={14} />
          </button>
        </div>
        <div className="browser-pane__address-wrap">
          <form onSubmit={submitAddress} className="browser-pane__address-form">
            <input
              aria-label={t("browserAddress")}
              value={address}
              placeholder={t("browserAddressPlaceholder")}
              onChange={(event) => {
                addressEditing.current = true;
                setAddress(event.target.value);
              }}
              onFocus={(event) => {
                addressEditing.current = true;
                event.currentTarget.select();
              }}
              onBlur={() => {
                addressEditing.current = false;
                if (!navigationPending.current) setAddress(committedUrl.current);
              }}
              spellCheck={false}
            />
          </form>
        </div>
        <div className="browser-pane__actions">
          <button
            type="button"
            aria-label={t("browserNewTab")}
            title={t("browserNewTab")}
            onClick={() => {
              showBlankTab();
              void browserService.tabs("new", undefined, "about:blank");
            }}
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className={`browser-pane__manual${manual ? " browser-pane__manual--active" : ""}`}
            aria-pressed={manual}
            aria-label={manual ? t("browserReturnAgent") : t("browserTakeControl")}
            onClick={toggleManualControl}
            title={manual ? t("browserReturnAgent") : t("browserTakeControl")}
          >
            {manual ? <MousePointer2 size={14} /> : <Hand size={14} />}
          </button>
        </div>
        <div
          className={`browser-pane__progress${loading ? " browser-pane__progress--active" : ""}`}
          aria-label={loading ? t("browserLoading") : undefined}
        />
      </div>

      {tabs.length > 1 ? (
        <div className="browser-pane__tabs" role="tablist" aria-label={t("browserTabs")}>
          {tabs.map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab.active}
              className={`browser-pane__tab${tab.active ? " browser-pane__tab--active" : ""}`}
              key={tab.targetId}
              onClick={() => {
                if (isBlankPage(tab.url)) showBlankTab();
                void browserService.tabs("select", tab.targetId);
              }}
            >
              <span>{tab.title || tab.url || t("browserNewTab")}</span>
              <span
                className="browser-pane__tab-close"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  void browserService.tabs("close", tab.targetId);
                }}
              >
                <X size={10} />
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div
        ref={stageRef}
        role="application"
        aria-label={manual ? t("browserManualActive") : t("browserTitle")}
        className={`browser-pane__stage${manual ? " browser-pane__stage--manual" : ""}`}
        tabIndex={manual ? 0 : -1}
        onKeyDown={handleKey}
        onMouseMove={(event) => sendPointer("move", event)}
        onMouseDown={(event) => {
          event.currentTarget.focus();
          sendPointer("down", event);
        }}
        onMouseUp={(event) => sendPointer("up", event)}
        onWheel={(event) => {
          if (manualRef.current) event.preventDefault();
          sendPointer("wheel", event);
        }}
      >
        {image && url ? (
          <div className="browser-pane__viewport" style={viewportStyle}>
            <img ref={imageRef} src={image} alt={title || url} draggable={false} decoding="async" />
            {!manual && pointerVisible ? (
              <div
                className={`browser-agent-pointer${pointer.down ? " browser-agent-pointer--down" : ""}`}
                style={pointerStyle}
                data-testid="browser-agent-pointer"
              >
                <MousePointer2 size={20} fill="currentColor" />
                {pointer.target ? <span>{pointer.target}</span> : null}
                {ripple > 0 ? (
                  <i key={ripple} className="browser-agent-pointer__ripple" data-testid="click-ripple" />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="browser-pane__empty">
            {error ?? (!ready || loading ? t("browserStarting") : t("browserEmpty"))}
          </div>
        )}
        {error && image && url ? <div className="browser-pane__error">{error}</div> : null}
        {manual ? <div className="browser-pane__manual-badge">{t("browserManualActive")}</div> : null}
      </div>
    </section>
  );
}

function isBlankPage(url: string): boolean {
  return url === "about:blank" || url.trim() === "";
}

function browserResultUrl(result: unknown): string | undefined {
  if (!result || typeof result !== "object" || !("url" in result)) return undefined;
  return typeof result.url === "string" && !isBlankPage(result.url) ? result.url : undefined;
}

function formatBrowserError(reason: unknown): string {
  if (typeof reason === "string") return reason;
  if (reason instanceof Error) return reason.message;
  if (reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string") {
    return reason.message;
  }
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}
