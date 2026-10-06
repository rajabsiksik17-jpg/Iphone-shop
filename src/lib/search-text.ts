/**
 * Text processing for search. Used both to build the product search index
 * and to process queries, so the two always agree. Pure functions — no I/O.
 *
 * normalizeText: folds spelling variants that shoppers type interchangeably
 *   (hamza/alef forms, ta marbuta, alef maqsura, diacritics, tatweel,
 *   Arabic-Indic digits, Latin accents, punctuation). Only used for matching,
 *   never shown, so product names are never altered.
 *
 * phoneticKey: a script-independent consonant skeleton. Arabic and Latin
 *   letters map onto shared sound classes and vowels are dropped, so a
 *   transliterated word and its original produce the same key:
 *     iphone → fn   ايفون → fn      samsung → smsnj   سامسونج → smsnj
 *     galaxy → jlks جالكسي → jlks   pixel → bksl      بكسل → bksl
 *   Combined with trigram similarity this tolerates typos in either script.
 */

const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;

export function normalizeText(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // Latin accents (é → e)
      .toLowerCase()
      .replace(ARABIC_DIACRITICS, "")
      .replace(TATWEEL, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/ء/g, "")
      .replace(/[کك]/g, "ك")
      .replace(/[یي]/g, "ي")
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      // Keep letters, digits and spaces; "+" matters in product names (S25+).
      .replace(/[^\p{L}\p{N}+\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

// Arabic letter → sound class. Long vowels and glottals are dropped.
const AR: Record<string, string> = {
  ب: "b", ت: "t", ط: "t", ث: "s", ج: "j", غ: "j", ح: "h", خ: "h", ه: "h", د: "d", ض: "d", ذ: "s", ظ: "s",
  ر: "r", ز: "s", س: "s", ص: "s", ش: "s", ف: "f", ق: "k", ك: "k", ل: "l", م: "m", ن: "n", ڤ: "f", پ: "b", چ: "s", گ: "j",
  ا: "", و: "", ي: "", ع: "", ء: "",
};

/** Latin word → sound classes (rough English transliteration rules). */
function latinSkeleton(w: string) {
  let s = w
    .replace(/^x/, "s") // xiaomi → s-
    .replace(/ph/g, "f")
    .replace(/(ch|sh)/g, "s")
    .replace(/th/g, "s")
    .replace(/ck/g, "k")
    .replace(/x/g, "ks")
    .replace(/q/g, "k")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/g/g, "j")
    .replace(/z/g, "s")
    .replace(/p/g, "b")
    .replace(/v/g, "f");
  s = s.replace(/[aeiouwyh]/g, (m, i: number) => (m === "h" && i === 0 ? "h" : ""));
  return s;
}

function arabicSkeleton(w: string) {
  let out = "";
  for (const ch of w) out += AR[ch] ?? (/[a-z0-9]/.test(ch) ? ch : "");
  return out;
}

const collapse = (s: string) => s.replace(/(.)\1+/g, "$1");

/** Phonetic key of one normalized word (digits are kept verbatim: "s25"). */
export function phoneticWord(word: string): string {
  if (/^\d+$/.test(word)) return word;
  const arabic = /[؀-ۿ]/.test(word);
  return collapse(arabic ? arabicSkeleton(word) : latinSkeleton(word));
}

/**
 * Phonetic key of a text: per-word keys plus, for multi-word phrases, the
 * joined key (so "ماك بوك" and "macbook" meet as "mkbk").
 */
export function phoneticKey(text: string): string {
  const words = normalizeText(text).split(" ").filter(Boolean);
  const keys = words.map(phoneticWord).filter((k) => k.length > 0);
  if (keys.length > 1) keys.push(collapse(keys.join("")));
  return keys.join(" ");
}

/** Levenshtein distance with an early exit (used for small in-memory lists). */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Relevance of a short label (brand/category name) for a query, 0..1.
 * Exact > prefix > contained > phonetic match > small typo distance.
 */
export function labelScore(query: string, label: string): number {
  const q = normalizeText(query);
  const l = normalizeText(label);
  if (!q || !l) return 0;
  if (q === l) return 1;
  if (l.startsWith(q) && q.length >= 2) return 0.9;
  const words = l.split(" ");
  if (q.length >= 2 && words.some((w) => w.startsWith(q))) return 0.8;
  // "ساعات" ↔ "الساعات الذكيه": compare against stems, by word prefix only, so
  // short queries don't match the middle of unrelated words ("ابل" ≠ "الكوابل").
  const qs = stemWord(q);
  if (qs.length >= 3 && words.some((w) => stemWord(w).startsWith(qs))) return 0.75;
  if (q.length >= 5 && l.includes(q)) return 0.7;
  const qp = phoneticKey(q);
  const lp = phoneticKey(l);
  if (qp.length >= 2 && (lp === qp || lp.split(" ").includes(qp))) return 0.65;
  const tol = q.length <= 4 ? 1 : 2;
  if (q.length >= 3 && words.some((w) => editDistance(q, w, tol) <= tol)) return 0.55;
  if (qp.length >= 4 && lp.split(" ").some((w) => w.length === qp.length && editDistance(qp, w, 1) <= 1)) return 0.45;
  return 0;
}

const AR_PREFIXES = ["وال", "بال", "كال", "فال", "لل", "ال"];
const AR_SUFFIXES = ["ات", "ون", "ين", "ان", "ها", "ه", "ي"];

/**
 * Light Arabic stemmer for matching (not linguistics): strips the definite
 * article / attached prepositions and common plural or feminine endings, so
 * "الساعات", "ساعة" and "ساعه" all reduce to "ساع". Latin words pass through.
 */
export function stemWord(word: string): string {
  if (!/[؀-ۿ]/.test(word)) return word;
  let w = word;
  for (const p of AR_PREFIXES) {
    if (w.startsWith(p) && w.length - p.length >= 3) {
      w = w.slice(p.length);
      break;
    }
  }
  for (const s of AR_SUFFIXES) {
    if (w.endsWith(s) && w.length - s.length >= 3) {
      w = w.slice(0, -s.length);
      break;
    }
  }
  return w;
}

/** Stems of a normalized text that differ from the original words. */
export function stemText(normalized: string): string {
  const out = new Set<string>();
  for (const w of normalized.split(" ")) {
    const s = stemWord(w);
    if (s !== w && s.length >= 3) out.add(s);
  }
  return [...out].join(" ");
}

// One ASCII symbol per (normalized) Arabic letter — unique, so no information
// is lost. Romanized words are prefixed with "0" so they never blend into
// real Latin words when trigrams are compared.
const ROMAN: Record<string, string> = {
  ا: "a", ب: "b", ت: "t", ث: "v", ج: "j", ح: "h", خ: "x", د: "d", ذ: "8", ر: "r", ز: "z", س: "s", ش: "c", ص: "p",
  ض: "e", ط: "g", ظ: "9", ع: "o", غ: "i", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "u", و: "w", ي: "y",
};

/**
 * Romanized copies of the Arabic words in a normalized text. Trigram indexes
 * only see letters the database locale classifies as alphanumeric — on a "C"
 * locale Postgres that excludes Arabic — so indexing a romanized copy keeps
 * fuzzy Arabic matching working on any database.
 */
export function romanizeArabic(normalized: string): string {
  const out: string[] = [];
  for (const w of normalized.split(" ")) {
    if (!/[؀-ۿ]/.test(w)) continue;
    let r = "0";
    for (const ch of w) r += ROMAN[ch] ?? (/[a-z0-9]/.test(ch) ? ch : "");
    if (r.length > 2) out.push(r);
  }
  return out.join(" ");
}
