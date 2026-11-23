import { createContext, useContext, useMemo } from "react";
export type Language = "fa" | "en";
export const LanguageContext = createContext<Language>("fa");
export function useText() {
  const language = useContext(LanguageContext);
  const formatter = useMemo(
    () => new Intl.NumberFormat(language, { maximumFractionDigits: 3 }),
    [language],
  );
  return {
    language,
    t: (en: string, fa: string) => (language === "fa" ? fa : en),
    n: (value: number) => formatter.format(value),
  };
}
export const algorithmNames = {
  astar: "A*",
  dijkstra: "Dijkstra",
  greedy: "Greedy",
  bfs: "BFS",
  dfs: "DFS",
  ida: "IDA*",
};
export function errorText(code: string, language: Language) {
  const messages: Record<string, [string, string]> = {
    invalid: [
      "Invalid configuration or file. Check dimensions, endpoints, weights, and schema.",
      "پیکربندی یا پرونده نامعتبر است. ابعاد، ابتدا و هدف، وزن‌ها و ساختار را بررسی کنید.",
    ],
    unsolvable: [
      "This puzzle cannot reach the selected goal: parity differs.",
      "این پازل به هدف انتخاب‌شده نمی‌رسد: زوجیت متفاوت است.",
    ],
    storage: [
      "Storage failed. Your browser may have insufficient space or storage disabled.",
      "ذخیره‌سازی انجام نشد. فضای مرورگر یا دسترسی ذخیره‌سازی را بررسی کنید.",
    ],
    worker: [
      "Search execution failed. You can change settings and retry.",
      "اجرای جست‌وجو ناموفق بود. تنظیمات را تغییر دهید و دوباره تلاش کنید.",
    ],
    export: [
      "Export failed. Please retry.",
      "خروجی ساخته نشد. دوباره تلاش کنید.",
    ],
  };
  return (messages[code] ?? messages.worker)[language === "fa" ? 1 : 0];
}
export function eventName(type: string, fa: boolean) {
  const names: Record<string, string> = {
    initialize: "آغاز",
    push: "افزودن به مرز",
    pop: "برداشت از مرز",
    "skip-stale": "رد ورودی کهنه",
    expand: "گسترش",
    discover: "کشف",
    relax: "بهبود",
    reject: "رد همسایه",
    goal: "هدف",
    "iteration-start": "آغاز تکرار",
    "iteration-end": "پایان تکرار",
    backtrack: "بازگشت",
    terminate: "پایان",
    "goal-found": "هدف پیدا شد",
    "no-path": "مسیری وجود ندارد",
    cancelled: "لغو شد",
    "limit-reached": "محدودیت اجرا",
    threshold: "آستانه",
    cycle: "چرخه",
    "not-improved": "بدون بهبود",
  };
  return fa ? (names[type] ?? type) : type.replaceAll("-", " ");
}
