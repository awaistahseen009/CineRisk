// Single source of truth for source-type icon/label, mirroring the
// specialists.ts pattern -- consumed by SourceCard and anywhere else a
// source citation renders, so it only needs updating in one place.
import type { LucideIcon } from "lucide-react";
import { Clapperboard, FileText, Gavel, Megaphone, Newspaper } from "lucide-react";
import type { SourceObject } from "./types";

export const SOURCE_TYPE_ICON: Record<SourceObject["source_type"], LucideIcon> = {
  news_article: Newspaper,
  legal_filing: Gavel,
  advocacy_statement: Megaphone,
  entertainment_press: Clapperboard,
  other: FileText,
};

export const SOURCE_TYPE_LABEL: Record<SourceObject["source_type"], string> = {
  news_article: "News",
  legal_filing: "Legal filing",
  advocacy_statement: "Advocacy",
  entertainment_press: "Entertainment press",
  other: "Source",
};

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function faviconUrl(url: string): string {
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostnameOf(url))}`;
}
