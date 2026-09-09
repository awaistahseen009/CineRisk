// The four headline figures on the landing page.
//
// Every number here is real and every link was verified, not typed from
// memory. Two of them (Fox/Dominion and Newsmax/Dominion) were retrieved by
// Parallel during an actual production audit run of this app, which is why
// those particular sources are cited: the tool found its own landing-page
// evidence. The other two were grounded through the same Parallel Search
// client the specialists use.
//
// The `kind` field exists because these are NOT the same class of fact, and
// flattening them into one "look how expensive this is" number would be the
// exact dishonesty this product is built to avoid. A settlement is money
// that actually changed hands. A claim is an amount someone sued for and
// may never receive. Those are labelled differently in the UI on purpose.

export type CostKind = "settlement" | "claim" | "pulled";

export interface CostCase {
  /** Numeric magnitude, animated on scroll. */
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;
  kind: CostKind;
  party: string;
  year: string;
  detail: string;
  sourceName: string;
  sourceUrl: string;
}

export const COST_KIND_LABEL: Record<CostKind, string> = {
  settlement: "Settlement paid",
  claim: "Amount sued for",
  pulled: "Pulled from air",
};

export const COST_CASES: CostCase[] = [
  {
    value: 787.5,
    decimals: 1,
    prefix: "$",
    suffix: "M",
    kind: "settlement",
    party: "Fox News to Dominion Voting Systems",
    year: "2023",
    detail:
      "One defamation case over on-air claims about a named voting technology company. Settled on the morning the trial was due to begin.",
    sourceName: "PBS NewsHour",
    sourceUrl:
      "https://www.pbs.org/newshour/show/fox-news-to-pay-787m-settlement-to-dominion-voting-systems-over-stolen-election-lies",
  },
  {
    value: 67,
    decimals: 0,
    prefix: "$",
    suffix: "M",
    kind: "settlement",
    party: "Newsmax to Dominion Voting Systems",
    year: "2025",
    detail:
      "A second broadcaster, the same set of false claims about the same company, settled two years after the first.",
    // The New York Times rather than one of the other outlets that covered
    // this: it is the source Parallel actually returned during a live
    // CineRisk audit run, and it resolves cleanly. Politico covered it too
    // but serves a 403 to non-browser clients, which makes it a poor link
    // to put behind a claim whose whole point is that you can go check it.
    sourceName: "The New York Times",
    sourceUrl:
      "https://www.nytimes.com/2025/08/18/business/media/newsmax-dominion-defamation-lawsuit-settlement.html",
  },
  {
    value: 170,
    decimals: 0,
    prefix: "$",
    suffix: "M",
    kind: "claim",
    party: "Fiona Harvey v. Netflix, Baby Reindeer",
    year: "2024",
    detail:
      "A defamation suit turning on the words \"this is a true story\" on screen. A judge found the series was wrongly billed as one.",
    sourceName: "The Hollywood Reporter",
    sourceUrl:
      "https://www.hollywoodreporter.com/tv/tv-features/fiona-harvey-baby-reindeer-lawsuit-netflix-richard-gadd-1235922751/",
  },
  {
    value: 24,
    decimals: 0,
    prefix: "",
    suffix: " hrs",
    kind: "pulled",
    party: "Pepsi, the Kendall Jenner protest ad",
    year: "2017",
    detail:
      "Months of production and a global media buy, withdrawn with an apology roughly a day after release.",
    sourceName: "The Guardian",
    sourceUrl:
      "https://www.theguardian.com/media/2017/apr/05/pepsi-kendall-jenner-pepsi-apology-ad-protest",
  },
];

/** Only the figures that are money actually paid. Deliberately excludes the
 *  claim, which was sued for and not awarded. */
export const TOTAL_SETTLED_MILLIONS = COST_CASES.filter((c) => c.kind === "settlement").reduce(
  (sum, c) => sum + c.value,
  0
);
