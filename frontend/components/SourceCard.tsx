"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { SPECIALIST_MAP } from "@/lib/specialists";
import { SOURCE_TYPE_ICON, SOURCE_TYPE_LABEL, faviconUrl, hostnameOf } from "@/lib/sourceTypes";
import type { SourceObject, SpecialistType } from "@/lib/types";

// A real link-preview card, not a bare text row -- this is the "rich
// resource preview" every source citation gets: the actual og:image from
// the source page when the backend found one, a considered icon-based
// header when it didn't (never a fake photo), favicon + domain, title,
// and the exact retrieved excerpt. Shared by the report view and the
// pipeline node detail modal so a citation looks identical everywhere.
//
// `specialists` is optional and only used by the report's resources panel,
// where one source can be corroborating more than one agent's flag on the
// same scene -- each contributing agent gets its own colored dot so the
// "every agent grounds through Parallel" claim is visible per-source, not
// just asserted in prose.
export default function SourceCard({
  source,
  index = 0,
  specialists,
  highlighted = false,
  dimmed = false,
  accentHex,
}: {
  source: SourceObject;
  index?: number;
  specialists?: SpecialistType[];
  // Set when this card is one of the sources backing the flag the reader is
  // currently focused on in the left column -- the visual tie between the
  // two panes, so they read as one synchronized view rather than two lists.
  highlighted?: boolean;
  dimmed?: boolean;
  accentHex?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const SourceIcon = SOURCE_TYPE_ICON[source.source_type];
  const showImage = Boolean(source.image_url) && !imgFailed;

  return (
    <motion.a
      href={source.source_url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: dimmed ? 0.35 : 1, y: 0, scale: highlighted ? 1.015 : 1 }}
      transition={{ duration: 0.3, delay: Math.min(index, 6) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      style={
        highlighted && accentHex
          ? { borderColor: accentHex, boxShadow: `0 0 0 1px ${accentHex}55, 0 16px 36px -18px ${accentHex}88` }
          : undefined
      }
      className="group flex flex-col overflow-hidden rounded-md border border-hairline bg-surface-1 backdrop-blur-md transition-colors duration-200 ease-out hover:border-hairline-strong hover:shadow-[0_16px_36px_-16px_rgba(147,82,221,0.4)]"
    >
      {showImage ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external domains, next/image needs a fixed allowlist */}
          <img
            src={source.image_url ?? undefined}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ground/55 via-transparent to-transparent" />
          {specialists && specialists.length > 0 && (
            <div className="absolute right-2 top-2 flex gap-1">
              {specialists.map((s) => (
                <span
                  key={s}
                  title={SPECIALIST_MAP[s].label}
                  className="h-2.5 w-2.5 rounded-full ring-2 ring-ground/70"
                  style={{ backgroundColor: SPECIALIST_MAP[s].hex }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-surface-2 to-surface-1">
          <SourceIcon className="h-7 w-7 text-ink-muted/50" strokeWidth={1.5} />
          {specialists && specialists.length > 0 && (
            <div className="absolute right-2 top-2 flex gap-1">
              {specialists.map((s) => (
                <span
                  key={s}
                  title={SPECIALIST_MAP[s].label}
                  className="h-2.5 w-2.5 rounded-full ring-2 ring-ground/70"
                  style={{ backgroundColor: SPECIALIST_MAP[s].hex }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center gap-1.5">
          {!faviconFailed && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={faviconUrl(source.source_url)}
              alt=""
              className="h-3.5 w-3.5 shrink-0 rounded-sm"
              onError={() => setFaviconFailed(true)}
            />
          )}
          <span className="truncate text-[10.5px] font-medium text-ink-muted">{hostnameOf(source.source_url)}</span>
          <span className="ml-auto shrink-0 font-mono text-[9.5px] uppercase tracking-wide text-ink-muted">
            {SOURCE_TYPE_LABEL[source.source_type]}
          </span>
        </div>

        <div className="flex items-start gap-1">
          <span className="line-clamp-2 flex-1 text-[12.5px] font-semibold leading-snug text-ink-primary group-hover:text-accent">
            {source.source_title}
          </span>
          <ExternalLink
            className="mt-0.5 h-3 w-3 shrink-0 text-ink-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            strokeWidth={2}
          />
        </div>

        <p className="line-clamp-2 text-[11.5px] leading-relaxed text-ink-secondary">{source.retrieved_snippet}</p>
      </div>
    </motion.a>
  );
}
