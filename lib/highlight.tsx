import type { ReactNode } from "react";

const BRAND = "ပြန်အမ်းငွေ — Cashback";

export function highlight(text: string): ReactNode {
  const parts = text.split(BRAND);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span style={{ color: "#f5a623", fontWeight: 700 }}>{BRAND}</span>
          )}
        </span>
      ))}
    </>
  );
}
