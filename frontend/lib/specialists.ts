// Single source of truth for specialist metadata -- icon, labels, and the
// mandate description -- consumed by the pipeline tree, the report cards,
// and the routing-explainer copy alike, so adding a 6th specialist someday
// is a one-file change instead of a hunt across four components.
import type { LucideIcon } from "lucide-react";
import { Copyright, Scale, ScrollText, ShieldAlert, Tag } from "lucide-react";
import type { SpecialistType } from "./types";

export interface SpecialistMeta {
  type: SpecialistType;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  // A per-specialist identity color -- deliberately distinct from both the
  // severity red/amber/gray vocabulary and the single accent indigo, so a
  // reader can tell "which agent said this" independently of "how bad is
  // it." Used consistently everywhere an agent's identity shows up: its
  // badge, its card's left-edge spine, its icon, and a faint card-wide
  // tint -- never just one lonely, easy-to-miss spot.
  hex: string;
  textClass: string;
  bgSoftClass: string;
  borderClass: string;
  glowClass: string;
  barClass: string;
  cardTintClass: string;
}

export const SPECIALISTS: SpecialistMeta[] = [
  {
    type: "cultural_sensitivity",
    label: "Cultural Sensitivity",
    shortLabel: "Cultural",
    icon: ShieldAlert,
    description: "Jokes, stereotypes, and identity-linked portrayals checked against documented backlash.",
    hex: "#A78BFA",
    textClass: "text-[#BBA6FC]",
    bgSoftClass: "bg-[#A78BFA]/[0.14]",
    borderClass: "border-[#A78BFA]/40",
    glowClass: "shadow-[0_0_18px_-4px_rgba(167,139,250,0.55)]",
    barClass: "bg-[#A78BFA] w-1",
    cardTintClass: "bg-gradient-to-br from-[#A78BFA]/[0.07] via-surface-1 to-surface-1",
  },
  {
    type: "defamation_real_person",
    label: "Defamation & Real-Person Resemblance",
    shortLabel: "Defamation",
    icon: Scale,
    description: "Characters cross-referenced against identifiable real people and legal precedent.",
    hex: "#E0499E",
    textClass: "text-[#EA76B3]",
    bgSoftClass: "bg-[#E0499E]/[0.14]",
    borderClass: "border-[#E0499E]/40",
    glowClass: "shadow-[0_0_18px_-4px_rgba(224,73,158,0.55)]",
    barClass: "bg-[#E0499E] w-1",
    cardTintClass: "bg-gradient-to-br from-[#E0499E]/[0.07] via-surface-1 to-surface-1",
  },
  {
    type: "ip_plot_similarity",
    label: "IP & Plot-Similarity",
    shortLabel: "IP & Plot",
    icon: Copyright,
    description: "Premises and scenes checked against works with a history of copyright disputes.",
    hex: "#38BDF8",
    textClass: "text-[#67CBFA]",
    bgSoftClass: "bg-[#38BDF8]/[0.14]",
    borderClass: "border-[#38BDF8]/40",
    glowClass: "shadow-[0_0_18px_-4px_rgba(56,189,248,0.55)]",
    barClass: "bg-[#38BDF8] w-1",
    cardTintClass: "bg-gradient-to-br from-[#38BDF8]/[0.07] via-surface-1 to-surface-1",
  },
  {
    type: "trademark_brand_risk",
    label: "Trademark & Brand Risk",
    shortLabel: "Trademark",
    icon: Tag,
    description: "Real brands and products checked for damaging or falsely-endorsed depictions.",
    hex: "#A3C554",
    textClass: "text-[#B7D178]",
    bgSoftClass: "bg-[#A3C554]/[0.14]",
    borderClass: "border-[#A3C554]/40",
    glowClass: "shadow-[0_0_18px_-4px_rgba(163,197,84,0.55)]",
    barClass: "bg-[#A3C554] w-1",
    cardTintClass: "bg-gradient-to-br from-[#A3C554]/[0.07] via-surface-1 to-surface-1",
  },
  {
    type: "historical_misrepresentation",
    label: "Historical & Factual Misrepresentation",
    shortLabel: "Historical",
    icon: ScrollText,
    description: "\"True story\" content checked against the documented historical record.",
    hex: "#C26DE8",
    textClass: "text-[#D08AEE]",
    bgSoftClass: "bg-[#C26DE8]/[0.14]",
    borderClass: "border-[#C26DE8]/40",
    glowClass: "shadow-[0_0_18px_-4px_rgba(194,109,232,0.55)]",
    barClass: "bg-[#C26DE8] w-1",
    cardTintClass: "bg-gradient-to-br from-[#C26DE8]/[0.07] via-surface-1 to-surface-1",
  },
];

export const SPECIALIST_MAP: Record<SpecialistType, SpecialistMeta> = Object.fromEntries(
  SPECIALISTS.map((s) => [s.type, s])
) as Record<SpecialistType, SpecialistMeta>;
