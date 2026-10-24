"use client";

import { useState, type ReactNode } from "react";
import { fmtDesk } from "@/lib/deal";

/** Accepts "1000", "1 000", "1,000", "1,000.50", "1000,50" */
export function parseNum(raw: string): number {
  let v = raw.replace(/[\s$%\u00a0]/g, "");
  if (v.includes(",") && v.includes(".")) v = v.replace(/,/g, "");
  else if (/,\d{3}(,|$)/.test(v)) v = v.replace(/,/g, "");
  else v = v.replace(",", ".");
  return parseFloat(v);
}

export function NumField({
  value,
  onChange,
  readOnly,
  hl,
  className = "",
  blankZero,
  decimals = 2,
  suffix,
  commitOnBlur,
}: {
  /** call onChange only when the field loses focus (or Enter) */
  commitOnBlur?: boolean;
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
  hl?: boolean;
  className?: string;
  blankZero?: boolean;
  decimals?: number;
  suffix?: string;
}) {
  const [focus, setFocus] = useState(false);
  const [text, setText] = useState("");
  const display =
    blankZero && !value
      ? ""
      : decimals === 2
        ? fmtDesk(value)
        : (Number(value) || 0).toFixed(decimals);
  return (
    <input
      className={`fld num ${readOnly ? "ro" : ""} ${hl ? "hl" : ""} ${className}`}
      readOnly={readOnly || !onChange}
      inputMode="decimal"
      value={focus ? text : display + (suffix && display ? suffix : "")}
      onFocus={(e) => {
        if (readOnly || !onChange) return;
        setFocus(true);
        setText(value ? String(value) : "");
        const el = e.target;
        requestAnimationFrame(() => el.select());
      }}
      onChange={(e) => {
        setText(e.target.value);
        if (commitOnBlur) return;
        const n = parseNum(e.target.value);
        onChange?.(isNaN(n) ? 0 : n);
      }}
      onBlur={() => {
        setFocus(false);
        if (commitOnBlur && onChange) {
          const n = parseNum(text);
          const v = isNaN(n) ? 0 : n;
          if (v !== value) onChange(v);
        }
      }}
    />
  );
}

export function TextField({
  value,
  onChange,
  className = "",
  placeholder,
  type = "text",
  readOnly,
}: {
  value: string;
  onChange?: (s: string) => void;
  className?: string;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      className={`fld ${readOnly ? "ro" : ""} ${className}`}
      value={value}
      placeholder={placeholder}
      readOnly={readOnly || !onChange}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}

/** One desk row: label · field area · "..." button  (matches the desking screen) */
export function R({
  label,
  children,
  dots,
  onDots,
  dotsLabel = "...",
  fieldWidth = "w-[190px]",
  labelClass = "",
}: {
  label: ReactNode;
  children?: ReactNode;
  dots?: boolean;
  onDots?: () => void;
  dotsLabel?: string;
  fieldWidth?: string;
  labelClass?: string;
}) {
  return (
    <div className="flex items-center gap-2 h-[34px]">
      <span className={`lbl flex-1 ${labelClass}`}>{label}</span>
      <div className={`${fieldWidth} flex gap-1 shrink-0`}>{children}</div>
      {dots ? (
        <button type="button" className="dots" onClick={onDots} disabled={!onDots}>
          {dotsLabel}
        </button>
      ) : (
        <span className="w-7 shrink-0" />
      )}
    </div>
  );
}

export function SecHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="sec-head">
      <div className="sec-tab">{title}</div>
      <div className="flex-1 flex items-center gap-2 px-3 py-1">{children}</div>
    </div>
  );
}

export function F({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`flex items-center gap-2 ${wide ? "col-span-2" : ""}`}>
      <span className="lbl w-[130px] shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </label>
  );
}
