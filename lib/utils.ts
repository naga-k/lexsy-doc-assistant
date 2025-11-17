import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Combines conditional class names with Tailwind-aware deduping.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
