import * as React from "react";
import type { HTMLAttributes, MouseEvent } from "react";
import { cn } from "@/lib/utils";

type ElementTag = keyof HTMLElementTagNameMap;

interface SpotlightAreaProps<T extends ElementTag = "div"> extends HTMLAttributes<HTMLElement> {
  as?: T;
  active?: boolean;
}

export function SpotlightArea<T extends ElementTag = "div">(
  props: SpotlightAreaProps<T> & { children?: React.ReactNode }
) {
  const { as, className, active = true, onMouseMove, onMouseLeave, children, ...rest } = props as SpotlightAreaProps & { children?: React.ReactNode };
  const Tag = (as || "div") as any;

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (!active) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--spot-x", `${x}px`);
    el.style.setProperty("--spot-y", `${y}px`);
  };

  const handleMouseLeave = (e: MouseEvent<HTMLElement>) => {
    if (!active) return;
    const el = e.currentTarget as HTMLElement;
    el.style.removeProperty("--spot-x");
    el.style.removeProperty("--spot-y");
  };

  return (
    <Tag
      className={cn("aa-spotlight relative overflow-hidden", className)}
  onMouseMove={(e: React.MouseEvent<HTMLElement>) => { handleMouseMove(e); onMouseMove?.(e); }}
  onMouseLeave={(e: React.MouseEvent<HTMLElement>) => { handleMouseLeave(e); onMouseLeave?.(e); }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default SpotlightArea;
