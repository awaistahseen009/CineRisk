// Ten real, documented cases of exactly the risk categories CineRisk's five
// specialists check for -- researched and verified before writing, not
// invented for effect. Every `source`/`imageUrl` here is a real, live URL:
// article links were checked against the actual reporting, and every image
// is the real og:image the outlet itself used for that story (fetched with
// the same scraper the product uses for report sources, and spot-checked
// for a real HTTP 200), never a stock photo standing in for the event.
// Two cases (Inventing Anna, Hangover Part II) genuinely have no usable
// og:image from any outlet tried -- they use the same honest icon fallback
// SourceCard uses for a source with no image, rather than substituting a
// generic or unrelated picture.
import type { SpecialistType } from "./types";

export interface RiskCase {
  title: string;
  specialist: SpecialistType;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
}

export const RISK_CASES: RiskCase[] = [
  {
    title: "The Siege (1998)",
    specialist: "cultural_sensitivity",
    summary:
      "A Bruce Willis/Denzel Washington thriller depicting Arab-Americans rounded into detention camps drew organized protests from CAIR and the ADC over its terrorist stereotyping, before it even opened.",
    sourceName: "CBS News",
    sourceUrl: "https://www.cbsnews.com/news/siege-beseiged-by-protesters/",
    imageUrl:
      "https://assets1.cbsnewsstatic.com/hub/i/r/2015/04/29/340c23e5-e5a3-40ef-bf68-dcc84ef47c4b/thumbnail/1200x630/6e2e666786e7a06c8786e0cd609401f5/restrictedimagesub.jpg",
  },
  {
    title: "Aladdin (1992)",
    specialist: "cultural_sensitivity",
    summary:
      'Disney\'s opening lyric, "they cut off your ear if they don\'t like your face, it\'s barbaric," drew a formal ADC objection and was rewritten for the home-video release, though advocacy groups called the fix inadequate.',
    sourceName: "Inside the Magic",
    sourceUrl: "https://insidethemagic.net/2021/05/disney-altered-arabian-nights-kc1/",
    imageUrl: "https://insidethemagic.net/wp-content/uploads/2021/05/63f1dd78-2261-49f5-afe0-a9676a00f7c2.png",
  },
  {
    title: "24 (2005)",
    specialist: "cultural_sensitivity",
    summary:
      "After CAIR raised concerns over a Muslim family written as a terrorist sleeper cell, Fox agreed to air a Kiefer Sutherland PSA distancing the show's villains from real Muslims.",
    sourceName: "CBS News",
    sourceUrl: "https://www.cbsnews.com/news/24-under-fire-from-muslim-groups/",
    imageUrl:
      "https://assets1.cbsnewsstatic.com/hub/i/r/2007/01/16/d55139d4-a642-11e2-a3f0-029118418759/thumbnail/1200x630/a33c3d8d5260879070a9b9d9db93d701/image2364640x.jpg",
  },
  {
    title: "The Queen's Gambit (2020)",
    specialist: "defamation_real_person",
    summary:
      'A single line calling real chess champion Nona Gaprindashvili the only woman who\'d "never faced men" was false by the show\'s own 1968 setting. She sued Netflix for defamation, a judge ruled fiction isn\'t immune, and the case settled.',
    sourceName: "CBS News",
    sourceUrl: "https://www.cbsnews.com/news/nona-gaprindashvili-sues-netflix-queens-gambit-portrayal-chess-legend/",
    imageUrl:
      "https://assets2.cbsnewsstatic.com/hub/i/r/2021/08/04/3cdbac8c-8212-45a6-bc75-3f2b8d0e59f3/thumbnail/1200x630/c907e9012136bdcff3b6f1069a6a3117/the-queens-gambit-077r.jpg",
  },
  {
    title: "Inventing Anna (2022)",
    specialist: "defamation_real_person",
    summary:
      'The real journalist Rachel DeLoache Williams sued Netflix, saying the series turned her into a "greedy, disloyal, opportunistic" character for dramatic effect. The suit survived dismissal and ran nearly four years before settling.',
    sourceName: "The Washington Post",
    sourceUrl: "https://www.washingtonpost.com/lifestyle/2022/08/31/inventing-anna-netflix-rachel-williams-lawsuit/",
    imageUrl: null,
  },
  {
    title: "The Terminator (1984)",
    specialist: "ip_plot_similarity",
    summary:
      "James Cameron's screenplay echoed two Harlan Ellison stories closely enough that Ellison sued. The studio settled out of court, paying Ellison and adding a screen credit that still runs on every release since.",
    sourceName: "ScreenRant",
    sourceUrl: "https://screenrant.com/terminator-movie-james-cameron-harlan-ellison-lawsuit-explained/",
    imageUrl:
      "https://static0.srcdn.com/wordpress/wp-content/uploads/2019/10/James-Cameron-and-Arnold-Schwarzenegger-as-Terminator.jpg?w=1200&h=675&fit=crop",
  },
  {
    title: "The Shape of Water (2017)",
    specialist: "ip_plot_similarity",
    summary:
      "Guillermo del Toro's Best Picture winner was accused by a Pulitzer-winning playwright's estate of lifting its premise from a 1969 play. The claim was ultimately dropped and acknowledged as unfounded.",
    sourceName: "NBC News",
    sourceUrl: "https://www.nbcnews.com/pop-culture/movies/shape-water-accused-plagiarism-late-playwright-s-estate-n841461",
    imageUrl:
      "https://media-cldnry.s-nbcnews.com/image/upload/t_nbcnews-fp-1200-630,f_auto,q_auto:best/newscms/2018_04/2302351/180123-shape-of-water-mn-0855.jpg",
  },
  {
    title: "The Hangover Part II (2011)",
    specialist: "trademark_brand_risk",
    summary:
      'Louis Vuitton sued Warner Bros. over a knockoff-bag joke, arguing the film implied the brand endorsed a counterfeit. A federal judge dismissed the suit, but not before the studio had to litigate a punchline.',
    sourceName: "The Hollywood Reporter",
    sourceUrl: "https://www.hollywoodreporter.com/business/business-news/the-hangover-warner-bros-louis-vuitton-301097/",
    imageUrl: null,
  },
  {
    title: "The Crown (2016-2023)",
    specialist: "historical_misrepresentation",
    summary:
      "Netflix's royal drama drew a UK government call for an on-screen fiction disclaimer, and public criticism from Judi Dench, over how freely it blurred real events with invented scenes.",
    sourceName: "NBC News",
    sourceUrl: "https://www.nbcnews.com/think/opinion/netflix-s-crown-disclaimer-debate-says-more-about-queen-it-ncna1250309",
    imageUrl:
      "https://media-cldnry.s-nbcnews.com/image/upload/t_nbcnews-fp-1200-630,f_auto,q_auto:best/newscms/2020_50/3434013/201207-the-crown-charles-diana-ew-624p.jpg",
  },
  {
    title: "The Social Network (2010)",
    specialist: "historical_misrepresentation",
    summary:
      "Aaron Sorkin's script compressed timelines and invented dialogue and motives for Zuckerberg and the Winklevoss twins. Zuckerberg has repeatedly said the finished film misrepresents him.",
    sourceName: "ScreenRant",
    sourceUrl: "https://screenrant.com/social-network-facebook-movie-true-story-wrong-changes/",
    imageUrl:
      "https://static0.srcdn.com/wordpress/wp-content/uploads/2023/11/the-social-network-winklevoss-twins-mark-zuckerberg-eduardo-saverin.jpeg?w=1200&h=675&fit=crop",
  },
];
