"use client";

import { openCV } from "@/components/full-cv";

/** Opens the Full CV dialog. */
export function CVButton({
  className,
  children,
  label,
}: {
  className?: string;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={openCV}
      aria-haspopup="dialog"
      aria-label={label}
    >
      {children}
    </button>
  );
}
