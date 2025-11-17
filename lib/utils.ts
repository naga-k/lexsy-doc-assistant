import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Combines conditional class names with Tailwind-aware deduping.
export function cn(...inputs: clsx.ClassValue[]) {
  return twMerge(clsx(inputs));
}
