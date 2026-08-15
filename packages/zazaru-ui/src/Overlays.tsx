import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Button } from "./Button";

export interface DialogProps {
  trigger?: React.ReactElement;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
  portalContainer?: HTMLElement | null;
  className?: string;
  closeLabel?: string;
  role?: "dialog" | "alertdialog";
}

export function Dialog({ trigger, title, description, children, footer, open, defaultOpen, onOpenChange, modal = true, portalContainer, className, closeLabel = "Close", role = "dialog" }: DialogProps): React.ReactElement {
  return <DialogPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} modal={modal}>
    {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
    <DialogPrimitive.Portal container={portalContainer ?? undefined}>
      <DialogPrimitive.Overlay className="z-dialog-overlay" />
      <DialogPrimitive.Content role={role} className={["z-dialog", className].filter(Boolean).join(" ")}>
        <header className="z-dialog__header"><div><DialogPrimitive.Title className="z-dialog__title">{title}</DialogPrimitive.Title>{description ? <DialogPrimitive.Description className="z-dialog__description">{description}</DialogPrimitive.Description> : null}</div><DialogPrimitive.Close asChild><button type="button" className="z-dialog__close" aria-label={closeLabel}>×</button></DialogPrimitive.Close></header>
        <div className="z-dialog__body">{children}</div>
        {footer ? <footer className="z-dialog__footer">{footer}</footer> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

export interface AlertDialogProps extends Omit<DialogProps, "footer" | "modal" | "role"> { confirmLabel: string; cancelLabel?: string; onConfirm: () => void; confirmVariant?: "primary" | "danger"; }
export function AlertDialog({ confirmLabel, cancelLabel = "Cancel", onConfirm, confirmVariant = "danger", ...props }: AlertDialogProps): React.ReactElement {
  return <Dialog {...props} modal role="alertdialog" footer={<><DialogPrimitive.Close asChild><Button>{cancelLabel}</Button></DialogPrimitive.Close><DialogPrimitive.Close asChild><Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button></DialogPrimitive.Close></>} />;
}

export interface PopoverProps { trigger: React.ReactElement; children: React.ReactNode; open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; align?: "start" | "center" | "end"; side?: "top" | "right" | "bottom" | "left"; portalContainer?: HTMLElement | null; className?: string; ariaLabel?: string; }
export function Popover({ trigger, children, open, defaultOpen, onOpenChange, align = "center", side = "bottom", portalContainer, className, ariaLabel }: PopoverProps): React.ReactElement {
  return <PopoverPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}><PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger><PopoverPrimitive.Portal container={portalContainer ?? undefined}><PopoverPrimitive.Content className={["z-popover", className].filter(Boolean).join(" ")} side={side} align={align} sideOffset={5} collisionPadding={8} aria-label={ariaLabel}><PopoverPrimitive.Arrow className="z-popover__arrow" />{children}</PopoverPrimitive.Content></PopoverPrimitive.Portal></PopoverPrimitive.Root>;
}

export interface TooltipProps { children: React.ReactElement; content: React.ReactNode; delayDuration?: number; side?: "top" | "right" | "bottom" | "left"; disabled?: boolean; portalContainer?: HTMLElement | null; }
export function Tooltip({ children, content, delayDuration = 500, side = "top", disabled, portalContainer }: TooltipProps): React.ReactElement {
  if (disabled) return children;
  return <TooltipPrimitive.Provider delayDuration={delayDuration}><TooltipPrimitive.Root><TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger><TooltipPrimitive.Portal container={portalContainer ?? undefined}><TooltipPrimitive.Content className="z-tooltip" side={side} sideOffset={5} collisionPadding={6}>{content}<TooltipPrimitive.Arrow className="z-tooltip__arrow" /></TooltipPrimitive.Content></TooltipPrimitive.Portal></TooltipPrimitive.Root></TooltipPrimitive.Provider>;
}

export interface MenuItem { id: string; label: React.ReactNode; onSelect?: () => void; disabled?: boolean; shortcut?: string; danger?: boolean; separatorBefore?: boolean; }
export interface DropdownMenuProps { trigger: React.ReactElement; items: readonly MenuItem[]; label?: string; open?: boolean; onOpenChange?: (open: boolean) => void; portalContainer?: HTMLElement | null; align?: "start" | "center" | "end"; }
export function DropdownMenu({ trigger, items, label, open, onOpenChange, portalContainer, align = "start" }: DropdownMenuProps): React.ReactElement {
  return <MenuPrimitive.Root open={open} onOpenChange={onOpenChange}><MenuPrimitive.Trigger asChild>{trigger}</MenuPrimitive.Trigger><MenuPrimitive.Portal container={portalContainer ?? undefined}><MenuPrimitive.Content className="z-menu" align={align} sideOffset={4} collisionPadding={8} aria-label={label}>{items.map((item) => <React.Fragment key={item.id}>{item.separatorBefore ? <MenuPrimitive.Separator className="z-menu-separator" /> : null}<MenuPrimitive.Item className={["z-menu-item", item.danger ? "z-menu-item--danger" : ""].filter(Boolean).join(" ")} disabled={item.disabled} onSelect={item.onSelect}><span>{item.label}</span>{item.shortcut ? <span className="z-menu-shortcut">{item.shortcut}</span> : null}</MenuPrimitive.Item></React.Fragment>)}</MenuPrimitive.Content></MenuPrimitive.Portal></MenuPrimitive.Root>;
}

export interface ContextMenuProps extends Omit<DropdownMenuProps, "trigger"> { children: React.ReactElement; }
export function ContextMenu({ children, items, label, portalContainer, open, onOpenChange }: ContextMenuProps): React.ReactElement {
  return <ContextMenuPrimitive.Root open={open} onOpenChange={onOpenChange}><ContextMenuPrimitive.Trigger asChild>{children}</ContextMenuPrimitive.Trigger><ContextMenuPrimitive.Portal container={portalContainer ?? undefined}><ContextMenuPrimitive.Content className="z-menu" collisionPadding={8} aria-label={label}>{items.map((item) => <React.Fragment key={item.id}>{item.separatorBefore ? <ContextMenuPrimitive.Separator className="z-menu-separator" /> : null}<ContextMenuPrimitive.Item className={["z-menu-item", item.danger ? "z-menu-item--danger" : ""].filter(Boolean).join(" ")} disabled={item.disabled} onSelect={item.onSelect}><span>{item.label}</span>{item.shortcut ? <span className="z-menu-shortcut">{item.shortcut}</span> : null}</ContextMenuPrimitive.Item></React.Fragment>)}</ContextMenuPrimitive.Content></ContextMenuPrimitive.Portal></ContextMenuPrimitive.Root>;
}

interface ToastMessage { id: number; title: React.ReactNode; description?: React.ReactNode; tone?: "neutral" | "success" | "danger"; duration?: number; }
interface ToastApi { publish: (message: Omit<ToastMessage, "id">) => void; }
const ToastContext = React.createContext<ToastApi | null>(null);
export function useToast(): ToastApi { const value = React.useContext(ToastContext); if (!value) throw new Error("useToast must be used inside ToastProvider"); return value; }
export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [messages, setMessages] = React.useState<ToastMessage[]>([]);
  const nextId = React.useRef(0);
  const publish = React.useCallback((message: Omit<ToastMessage, "id">) => { const id = ++nextId.current; setMessages((current) => [...current, { ...message, id }]); window.setTimeout(() => setMessages((current) => current.filter((item) => item.id !== id)), message.duration ?? 5000); }, []);
  return <ToastContext.Provider value={{ publish }}>{children}<div className="z-toast-region" aria-label="Notifications">{messages.map((message) => <div key={message.id} className={`z-toast z-toast--${message.tone ?? "neutral"}`} role={message.tone === "danger" ? "alert" : "status"}><div><strong>{message.title}</strong>{message.description ? <div>{message.description}</div> : null}</div><button type="button" aria-label="Dismiss notification" onClick={() => setMessages((current) => current.filter((item) => item.id !== message.id))}>×</button></div>)}</div></ToastContext.Provider>;
}
