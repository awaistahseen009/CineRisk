"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { SPECIALIST_MAP } from "@/lib/specialists";
import { RISK_CASES, type RiskCase } from "@/lib/riskCases";
import { faviconUrl, hostnameOf } from "@/lib/sourceTypes";
import RiskCaseModal from "@/components/RiskCaseModal";

// Continuous, ambient motion (not user-triggered, seen passively) earns
// linear easing: it is constant, unhurried drift, not a UI response to an
// action. Slow enough to read as a gallery moving past, never a ticker.
const AUTOPLAY_PX_PER_SEC = 34;
const RESUME_AFTER_IDLE_MS = 1800;

// Coverflow falloff. Every value below is a function of a card's distance
// from the strip's centre, measured in "cards away" -- so the focal
// treatment is driven by real scroll position, not by an index that flips
// at a threshold. That is what makes it continuous: there is no moment
// where a card "becomes" the focus, it is simply nearer the middle.
const FOCUS_FALLOFF_CARDS = 2.2; // distance at which a card hits the minimums
const MAX_SCALE = 1.06;
const MIN_SCALE = 0.78;
const MAX_OPACITY = 1;
const MIN_OPACITY = 0.42;
const MAX_ROTATE_DEG = 26;
const PULL_PX = 30; // tucks side cards toward the centre so the fan stays tight

// How far a press may travel and still count as a click rather than a drag.
const DRAG_CLICK_THRESHOLD_PX = 6;

// Smoothstep, applied in the SPATIAL domain rather than the time domain.
// A linear falloff makes the focal card trade places with its neighbour at
// a constant rate, which reads as mechanical; easing the curve lets the
// centred card hold its prominence a beat longer and then hand off, so the
// swap feels eased even though nothing is "animating" in the usual sense.
function smoothstep(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
}

function CaseCard({
  item,
  cardRef,
  onCardClick,
}: {
  item: RiskCase;
  cardRef: (el: HTMLAnchorElement | null) => void;
  onCardClick: (e: React.MouseEvent) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const specialist = SPECIALIST_MAP[item.specialist];
  const Icon = specialist.icon;
  const showImage = Boolean(item.imageUrl) && !imgFailed;

  return (
    <a
      ref={cardRef}
      href={item.sourceUrl}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      onClick={onCardClick}
      // NOTE: `transform`, `opacity` and `zIndex` on this element are owned
      // exclusively by the rAF loop below. Nothing else may animate them --
      // not Framer Motion, not a Tailwind hover: utility, not a CSS
      // transition. Two owners of one transform is precisely how the
      // straighten-on-hover silently died in the previous version, and a
      // CSS transition here would lag behind the per-frame writes and turn
      // crisp scroll-tracking into mush. Hover therefore only touches
      // shadow and border, and the image scales on its own child element.
      // bg is near-opaque rather than surface-1's 0.6 alpha: at 60% over the
      // page ground a card had barely any edge of its own, which is what
      // made a no-image card look like a floating badge with nothing under
      // it. Cards should always read as physical objects on the strip.
      className="group relative flex w-[240px] shrink-0 select-none flex-col overflow-hidden rounded-xl border border-hairline-strong bg-[#141519]/95 shadow-[0_16px_32px_-16px_rgba(0,0,0,0.55)] backdrop-blur-md transition-[box-shadow,border-color] duration-200 ease-out hover:border-accent-border hover:shadow-[0_28px_50px_-18px_rgba(94,106,210,0.55)]"
      style={{ willChange: "transform, opacity" }}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-2">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- real, verified news-outlet images from arbitrary domains
          <img
            src={item.imageUrl ?? undefined}
            alt=""
            loading="lazy"
            draggable={false}
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          // Same honest fallback as SourceCard: a considered icon, never a
          // stock photo standing in for an event we could not get a real
          // image for. The surface is OPAQUE and clearly lighter than the
          // page on purpose: the old translucent version composited to
          // roughly rgb(20,21,25) against the #08090A ground, so a card
          // with no image had no visible surface at all and its badge read
          // as floating in empty space rather than pinned to the card.
          <div className="relative flex h-full w-full items-center justify-center bg-[#171820]">
            <span
              className="absolute inset-0"
              style={{
                background: `radial-gradient(120% 85% at 50% 0%, ${specialist.hex}22, transparent 70%)`,
              }}
              aria-hidden
            />
            <Icon className="relative h-10 w-10 opacity-40" style={{ color: specialist.hex }} strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ground via-ground/50 to-transparent" />

        <ExternalLink
          className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-white/70 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          strokeWidth={2.25}
        />

        {/* The category tag lives with the text, above the title, so the
            photograph itself stays completely clean. `self-start` matters:
            in this flex column a block-level badge would otherwise stretch
            the full card width instead of hugging its label. */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3">
          <span
            className={`flex self-start items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold backdrop-blur-md ${specialist.textClass} ${specialist.bgSoftClass} ${specialist.borderClass}`}
          >
            <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
            {specialist.shortLabel}
          </span>
          <h3 className="font-display text-[13.5px] font-bold leading-snug text-white">{item.title}</h3>
          <p className="line-clamp-2 text-[11px] leading-relaxed text-white/75">{item.summary}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-3 py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={faviconUrl(item.sourceUrl)}
          alt=""
          draggable={false}
          className="h-3 w-3 shrink-0 rounded-sm"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <span className="truncate text-[10.5px] font-medium text-ink-muted">{hostnameOf(item.sourceUrl)}</span>
      </div>
    </a>
  );
}

export default function ProblemSection() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  // Layout geometry, cached so the per-frame loop only ever WRITES styles.
  // offsetLeft/offsetWidth are layout values, unaffected by the transforms
  // we apply, which is exactly why they are used here instead of
  // getBoundingClientRect (whose result would include our own scaling and
  // feed back into the next frame).
  const metricsRef = useRef<{ left: number; width: number }[]>([]);
  const pitchRef = useRef(1);
  // One set's width derived from real card pitch, NOT scrollWidth/3: the
  // scroller's horizontal padding is counted once in scrollWidth but would
  // be divided by three, so wrapping on that value drifts by ~2/3 of the
  // padding every loop and shows a visible jump. pitch * setLength is exact.
  const setWidthRef = useRef(0);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const dragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  // Tracks whether the current press travelled far enough to be a drag
  // rather than a click. Without this, every drag of the strip would end by
  // opening the modal for whichever card happened to be under the cursor.
  const pressRef = useRef({ x: 0, y: 0, moved: false });
  const [selected, setSelected] = useState<RiskCase | null>(null);

  // Rendered 3x back-to-back so the wraparound always has a full spare set
  // on either side: the loop never shows a seam or an empty run-off.
  const loopedCases = [...RISK_CASES, ...RISK_CASES, ...RISK_CASES];

  const measure = useCallback(() => {
    metricsRef.current = cardRefs.current.map((el) =>
      el ? { left: el.offsetLeft, width: el.offsetWidth } : { left: 0, width: 0 }
    );
    const [a, b] = metricsRef.current;
    // Real pitch from two adjacent cards, rather than assuming width + gap.
    pitchRef.current = b && b.left > a?.left ? b.left - a.left : (a?.width ?? 1);
    setWidthRef.current = pitchRef.current * RISK_CASES.length;
  }, []);

  function pauseAutoplay() {
    pausedRef.current = true;
    clearTimeout(resumeTimerRef.current);
  }

  function scheduleResume() {
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, RESUME_AFTER_IDLE_MS);
  }

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    measure();
    el.scrollLeft = setWidthRef.current;

    const onResize = () => measure();
    window.addEventListener("resize", onResize);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let lastTime: number | null = null;

    function frame(time: number) {
      if (!el) return;
      if (lastTime === null) lastTime = time;
      const deltaSec = (time - lastTime) / 1000;
      lastTime = time;

      // --- advance (skipped entirely under reduced motion) ---
      if (!reduceMotion && !pausedRef.current) {
        el.scrollLeft += AUTOPLAY_PX_PER_SEC * deltaSec;
      }

      // --- read once, then write ---
      const width = setWidthRef.current;
      if (width > 0) {
        if (el.scrollLeft >= width * 2) el.scrollLeft -= width;
        else if (el.scrollLeft <= 0) el.scrollLeft += width;
      }

      const viewCentre = el.scrollLeft + el.clientWidth / 2;
      const pitch = pitchRef.current || 1;

      // The focal treatment is recomputed every frame from live scroll
      // position, so it tracks autoplay, a drag, a wheel, and the browser's
      // own smooth-scroll from the arrow buttons identically. Whatever ends
      // up centred is the focused card, by construction.
      for (let i = 0; i < cardRefs.current.length; i++) {
        const card = cardRefs.current[i];
        const m = metricsRef.current[i];
        if (!card || !m) continue;

        const d = (m.left + m.width / 2 - viewCentre) / pitch;
        const dist = Math.abs(d);
        const t = smoothstep(dist / FOCUS_FALLOFF_CARDS);
        const dir = Math.sign(d);

        const scale = MAX_SCALE + (MIN_SCALE - MAX_SCALE) * t;
        const opacity = MAX_OPACITY + (MIN_OPACITY - MAX_OPACITY) * t;
        const rotate = dir * MAX_ROTATE_DEG * t;
        const pull = -dir * PULL_PX * Math.min(dist, FOCUS_FALLOFF_CARDS);

        card.style.transform = `translateX(${pull.toFixed(2)}px) rotateY(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        card.style.opacity = opacity.toFixed(3);
        card.style.zIndex = String(Math.round(100 - dist * 10));
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      clearTimeout(resumeTimerRef.current);
    };
  }, [measure]);

  // Mouse drag-to-scroll. Touch devices already get native swipe and
  // momentum from overflow-x-auto, so this engages only for a real mouse
  // pointer rather than fighting the browser's own touch handling.
  function onPointerDown(e: React.PointerEvent) {
    // Movement tracking runs for every pointer type, since a touch swipe
    // must suppress the tap-to-open just as a mouse drag does.
    pressRef.current = { x: e.clientX, y: e.clientY, moved: false };
    if (e.pointerType !== "mouse" || !scrollerRef.current) return;
    dragRef.current = { active: true, startX: e.clientX, startScrollLeft: scrollerRef.current.scrollLeft };
    pauseAutoplay();
  }
  function onPointerMove(e: React.PointerEvent) {
    const travel = Math.hypot(e.clientX - pressRef.current.x, e.clientY - pressRef.current.y);
    if (travel > DRAG_CLICK_THRESHOLD_PX) pressRef.current.moved = true;
    if (!dragRef.current.active || !scrollerRef.current) return;
    scrollerRef.current.scrollLeft = dragRef.current.startScrollLeft - (e.clientX - dragRef.current.startX);
  }

  function handleCardClick(e: React.MouseEvent, item: RiskCase) {
    // Let genuine "open in a new tab" gestures through to the browser --
    // the card is still a real <a href>, which is also why middle-click and
    // right-click-open keep working.
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (pressRef.current.moved) return; // that was a drag, not a click
    setSelected(item);
    pauseAutoplay();
  }
  function endDrag() {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    scheduleResume();
  }

  function nudge(delta: number) {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
    pauseAutoplay();
    scheduleResume();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="relative"
    >
      <div
        ref={scrollerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={() => {
          endDrag();
          scheduleResume();
        }}
        onMouseEnter={pauseAutoplay}
        onWheel={() => {
          pauseAutoplay();
          scheduleResume();
        }}
        onTouchStart={() => {
          pauseAutoplay();
          scheduleResume();
        }}
        onTouchEnd={scheduleResume}
        // `relative` matters: it makes this the offsetParent, so each card's
        // offsetLeft is a stable content-space coordinate for the maths above.
        // Generous vertical padding leaves room for the centre card to scale
        // up and cast its glow without being clipped -- overflow-x:auto also
        // clips the vertical axis, so that room has to be padding, not margin.
        className="relative flex cursor-grab gap-2 overflow-x-auto px-6 py-12 active:cursor-grabbing sm:px-10 md:px-16 [perspective:1400px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {loopedCases.map((item, i) => (
          <CaseCard
            key={`${item.title}-${i}`}
            item={item}
            cardRef={(el) => {
              cardRefs.current[i] = el;
            }}
            onCardClick={(e) => handleCardClick(e, item)}
          />
        ))}
      </div>

      {/* Edge fades hint the strip continues past the viewport; the arrows
          are the explicit, discoverable control. Both they and drag/swipe
          pause autoplay and hand it back after the same idle window. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-ground to-transparent sm:w-28" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-ground to-transparent sm:w-28" aria-hidden />

      <button
        type="button"
        onClick={() => nudge(-(240 + 8))}
        aria-label="Scroll left"
        className="press-feedback absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-hairline-strong bg-surface-1/90 text-ink-secondary shadow-panel backdrop-blur-md transition-colors duration-150 hover:text-ink-primary sm:flex sm:left-5"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={() => nudge(240 + 8)}
        aria-label="Scroll right"
        className="press-feedback absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-hairline-strong bg-surface-1/90 text-ink-secondary shadow-panel backdrop-blur-md transition-colors duration-150 hover:text-ink-primary sm:flex sm:right-5"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
      </button>

      <RiskCaseModal
        item={selected}
        onClose={() => {
          setSelected(null);
          scheduleResume();
        }}
      />
    </motion.div>
  );
}
