import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";

export interface SelectOption<Value extends string | number = string> {
  value: Value;
  label: string;
  disabled?: boolean;
  group?: string;
  fontFamily?: string;
  /** Optional secondary text shown below the option label. */
  description?: string;
  /** Nested choices. Parents with children open an accessible submenu and are not selectable. */
  children?: readonly SelectOption<Value>[];
}

export interface SelectProps<Value extends string | number = string> {
  value?: Value;
  defaultValue?: Value;
  options: readonly SelectOption<Value>[];
  onChange?: (value: Value) => void;
  onHover?: (value: Value | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  className?: string;
  contentClassName?: string;
  portalContainer?: HTMLElement | null;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

function Chevron({ side = "down" }: { side?: "down" | "right" }): React.ReactElement {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d={side === "right" ? "m9 6 6 6-6 6" : "m6 9 6 6 6-6"} /></svg>;
}

function Check(): React.ReactElement {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m20 6-11 11-5-5" /></svg>;
}

function flattenOptions<Value extends string | number>(options: readonly SelectOption<Value>[]): SelectOption<Value>[] {
  return options.flatMap((option) => option.children?.length ? flattenOptions(option.children) : [option]);
}

function NestedSelect<Value extends string | number>({
  value,
  defaultValue,
  options,
  onChange,
  onHover,
  placeholder = "Select an option",
  disabled,
  required,
  name,
  className,
  contentClassName,
  portalContainer,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  forwardedRef,
}: SelectProps<Value> & { forwardedRef: React.ForwardedRef<HTMLButtonElement> }): React.ReactElement {
  const [internalValue, setInternalValue] = React.useState<Value | undefined>(defaultValue);
  const current = value ?? internalValue;
  const leaves = React.useMemo(() => flattenOptions(options), [options]);
  const selected = leaves.find((option) => Object.is(option.value, current));
  const keyFor = (candidate: Value) => `z-nested-${leaves.findIndex((option) => Object.is(option.value, candidate))}`;
  const choose = (option: SelectOption<Value>) => {
    if (value === undefined) setInternalValue(option.value);
    onChange?.(option.value);
  };

  const renderItems = (items: readonly SelectOption<Value>[], depth = 0): React.ReactNode => (
    <DropdownPrimitive.RadioGroup value={current === undefined ? undefined : keyFor(current)}>
      {items.map((option, index) => option.children?.length ? (
        <DropdownPrimitive.Sub key={`${depth}-${index}`}>
          <DropdownPrimitive.SubTrigger className="z-menu-item z-select-subtrigger" disabled={option.disabled} onPointerMove={() => onHover?.(option.value)}>
            <span className="z-select-option-copy"><span>{option.label}</span>{option.description ? <small>{option.description}</small> : null}</span>
            <span className="z-select-subtrigger__chevron"><Chevron side="right" /></span>
          </DropdownPrimitive.SubTrigger>
          <DropdownPrimitive.Portal container={portalContainer ?? undefined}>
            <DropdownPrimitive.SubContent className="z-menu z-select-subcontent" sideOffset={5} alignOffset={-5} collisionPadding={8} avoidCollisions>
              {renderItems(option.children, depth + 1)}
            </DropdownPrimitive.SubContent>
          </DropdownPrimitive.Portal>
        </DropdownPrimitive.Sub>
      ) : (
        <DropdownPrimitive.RadioItem
          key={`${depth}-${index}`}
          value={keyFor(option.value)}
          disabled={option.disabled}
          className="z-menu-item z-select-radio-item"
          style={option.fontFamily ? { fontFamily: option.fontFamily } : undefined}
          onPointerMove={() => onHover?.(option.value)}
          onPointerLeave={() => onHover?.(null)}
          onSelect={() => choose(option)}
        >
          <span className="z-select-option-copy"><span>{option.label}</span>{option.description ? <small>{option.description}</small> : null}</span>
          <DropdownPrimitive.ItemIndicator className="z-select-indicator"><Check /></DropdownPrimitive.ItemIndicator>
        </DropdownPrimitive.RadioItem>
      ))}
    </DropdownPrimitive.RadioGroup>
  );

  return (
    <DropdownPrimitive.Root>
      {name ? <input type="hidden" name={name} value={current === undefined ? "" : String(current)} required={required} disabled={disabled} /> : null}
      <DropdownPrimitive.Trigger ref={forwardedRef} disabled={disabled} className={["z-select-trigger", "z-select-trigger--nested", className].filter(Boolean).join(" ")} aria-label={ariaLabel} aria-labelledby={ariaLabelledby}>
        <span>{selected?.label ?? placeholder}</span>
        <span className="z-select-trigger__icon"><Chevron /></span>
      </DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal container={portalContainer ?? undefined}>
        <DropdownPrimitive.Content className={["z-menu", "z-select-menu", contentClassName].filter(Boolean).join(" ")} sideOffset={4} collisionPadding={8} align="start">
          {renderItems(options)}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}

function SelectInner<Value extends string | number>(
  {
    value,
    defaultValue,
    options,
    onChange,
    onHover,
    placeholder = "Select an option",
    disabled,
    required,
    name,
    className,
    contentClassName,
    portalContainer,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
  }: SelectProps<Value>,
  ref: React.ForwardedRef<HTMLButtonElement>,
): React.ReactElement {
  if (options.some((option) => option.children?.length)) {
    return <NestedSelect {...{ value, defaultValue, options, onChange, onHover, placeholder, disabled, required, name, className, contentClassName, portalContainer, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledby }} forwardedRef={ref} />;
  }
  const keyFor = React.useCallback((candidate: Value | undefined) => {
    if (candidate === undefined) return undefined;
    const index = options.findIndex((option) => Object.is(option.value, candidate));
    return index < 0 ? undefined : `z-option-${index}`;
  }, [options]);
  const selectedKey = keyFor(value);
  const defaultKey = keyFor(defaultValue);
  const groups = React.useMemo(() => {
    const result: Array<{ label?: string; options: Array<{ option: SelectOption<Value>; index: number }> }> = [];
    options.forEach((option, index) => {
      const last = result.at(-1);
      if (!last || last.label !== option.group) result.push({ label: option.group, options: [{ option, index }] });
      else last.options.push({ option, index });
    });
    return result;
  }, [options]);

  return (
    <SelectPrimitive.Root
      value={selectedKey}
      defaultValue={defaultKey}
      disabled={disabled}
      required={required}
      name={name}
      onValueChange={(key) => {
        const index = Number(key.replace("z-option-", ""));
        const option = options[index];
        if (option && !option.disabled) onChange?.(option.value);
      }}
    >
      <SelectPrimitive.Trigger ref={ref} className={["z-select-trigger", className].filter(Boolean).join(" ")} aria-label={ariaLabel} aria-labelledby={ariaLabelledby}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="z-select-trigger__icon"><Chevron /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={portalContainer ?? undefined}>
        <SelectPrimitive.Content className={["z-select-content", contentClassName].filter(Boolean).join(" ")} position="popper" sideOffset={4} collisionPadding={8} avoidCollisions>
          <SelectPrimitive.ScrollUpButton className="z-select-scroll">▲</SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="z-select-viewport">
            {groups.map((group, groupIndex) => (
              <SelectPrimitive.Group key={`${group.label ?? "ungrouped"}-${groupIndex}`}>
                {group.label ? <SelectPrimitive.Label className="z-select-label">{group.label}</SelectPrimitive.Label> : null}
                {group.options.map(({ option, index }) => (
                  <SelectPrimitive.Item
                    key={`z-option-${index}`}
                    value={`z-option-${index}`}
                    disabled={option.disabled}
                    className="z-select-item"
                    style={option.fontFamily ? { fontFamily: option.fontFamily } : undefined}
                    onPointerMove={() => onHover?.(option.value)}
                    onPointerLeave={() => onHover?.(null)}
                  >
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="z-select-indicator"><Check /></SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
                {groupIndex < groups.length - 1 ? <SelectPrimitive.Separator className="z-menu-separator" /> : null}
              </SelectPrimitive.Group>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="z-select-scroll">▼</SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export const Select = React.forwardRef(SelectInner) as <Value extends string | number = string>(
  props: SelectProps<Value> & React.RefAttributes<HTMLButtonElement>,
) => React.ReactElement;
