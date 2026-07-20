import type { SVGProps } from "react";

/** Deterministic interlocking DC monogram used across DreamCanvas surfaces. */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="DreamCanvas" {...props}>
      <path fill="currentColor" fillRule="evenodd" d="M8 10h18c16 0 25 8.5 25 22s-9 22-25 22H8V10Zm10 10v24h8c9.5 0 15-4.4 15-12s-5.5-12-15-12h-8Z" />
      <path fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="butt" strokeLinejoin="round" d="M57 17c-4-4-9-6-14-6-11 0-18 9-18 21s7 21 19 21c5 0 9-2 13-6" />
    </svg>
  );
}
