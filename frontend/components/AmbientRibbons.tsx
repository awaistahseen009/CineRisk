// Large, soft, flowing band shapes instead of circular point-glows.
//
// The first two attempts at this used a thick semi-transparent STROKE
// along a curvy centerline. On a path with tight bends, a thick stroke
// overlaps itself at the bend -- and where semi-transparent layers stack,
// the opacity compounds, producing a dark blob at the bend with only the
// non-overlapping edges reading as color. That's exactly the "dark stain
// with a purple halo" bug.
//
// This version uses FILLED closed shapes instead (elongated ellipses,
// rotated diagonally) -- a fill only ever paints once per pixel, so
// there's no overlap-darkening failure mode regardless of curvature.
// Fixed like the rest of the ambient system (see .ambient-bg in
// globals.css): one continuous graphic behind every section.
function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5523; // standard 4-bezier ellipse approximation constant
  const kx = rx * k;
  const ky = ry * k;
  return [
    `M ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy - ky}, ${cx - kx} ${cy - ry}, ${cx} ${cy - ry}`,
    `C ${cx + kx} ${cy - ry}, ${cx + rx} ${cy - ky}, ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy + ky}, ${cx + kx} ${cy + ry}, ${cx} ${cy + ry}`,
    `C ${cx - kx} ${cy + ry}, ${cx - rx} ${cy + ky}, ${cx - rx} ${cy}`,
    "Z",
  ].join(" ");
}

export default function AmbientRibbons() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="ribbonA" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#7B85E8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#9B5CE0" stopOpacity="0.24" />
        </linearGradient>
        <linearGradient id="ribbonB" x1="0" y1="0" x2="1" y2="-0.2">
          <stop offset="0%" stopColor="#9B5CE0" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#C4944A" stopOpacity="0.18" />
        </linearGradient>
        <filter id="ribbonBlur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <g filter="url(#ribbonBlur)">
        <path
          d={ellipsePath(72, 12, 58, 15)}
          fill="url(#ribbonA)"
          transform="rotate(-26 72 12)"
        />
        <path
          d={ellipsePath(20, 78, 62, 16)}
          fill="url(#ribbonB)"
          transform="rotate(24 20 78)"
        />
      </g>
    </svg>
  );
}
