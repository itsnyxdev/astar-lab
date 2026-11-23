import type { ExperimentRecord } from "../engine/types";
import { eventName, algorithmNames, type Language } from "../i18n";
import { comparable } from "../analytics";

/** Paginated, text-based reports with embedded Persian glyphs and actual execution data. */
export async function pdf(records: ExperimentRecord[], language: Language) {
  if (!records.length) throw Error("export");
  const { jsPDF } = await import("jspdf"),
    doc = new jsPDF(),
    response = await fetch(
      `${import.meta.env.BASE_URL}fonts/Vazirmatn-Regular.ttf`,
    );
  if (!response.ok) throw Error("export");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  doc.addFileToVFS("Vazirmatn.ttf", btoa(binary));
  doc.addFont("Vazirmatn.ttf", "Vazirmatn", "normal");
  doc.setFont("Vazirmatn");
  // The Unicode bidi engine already reorders logical text; setR2L would reverse it twice.
  doc.setR2L(false);
  const fa = language === "fa",
    t = (en: string, faText: string) => (fa ? faText : en),
    num = (v: number | null) =>
      v === null
        ? "—"
        : new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(
            v,
          );
  let y = 22;
  function page() {
    doc.addPage();
    y = 22;
  }
  function room(height: number) {
    if (y + height > 270) page();
  }
  function line(text: string, size = 11, rtl = fa) {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, 170) as string[];
    for (const value of lines) {
      room(size * 0.55 + 2);
      const display = value.replace(/(?:IDA|A)\*/g, "\u200e$&\u200e");
      doc.text(display, rtl ? 190 : 20, y, {
        align: rtl ? "right" : "left",
        isInputVisual: false,
        isInputRtl: rtl && /[\u0600-\u06ff]/.test(value),
        isOutputVisual: true,
        isOutputRtl: false,
      });
      y += size * 0.55 + 2;
    }
    y += 2;
  }
  function heading(text: string) {
    room(40);
    line(text, 15);
  }
  function table(headers: string[], rows: string[][], widths: number[]) {
    const draw = (values: string[], header: boolean) => {
      const height = 8;
      room(height);
      doc.setFillColor(
        header ? 239 : 250,
        header ? 233 : 249,
        header ? 222 : 245,
      );
      doc.rect(20, y - 5, 170, height, "F");
      doc.setFontSize(9);
      let offset = 0;
      for (let i = 0; i < values.length; i++) {
        const x = fa ? 188 - offset : 22 + offset;
        doc.text(values[i], x, y + 1, {
          align: fa ? "right" : "left",
          maxWidth: widths[i] - 4,
          isInputVisual: false,
          isInputRtl: fa && /[\u0600-\u06ff]/.test(values[i]),
          isOutputVisual: true,
          isOutputRtl: false,
        });
        offset += widths[i];
      }
      y += height;
    };
    draw(headers, true);
    for (const row of rows) {
      if (y + 8 > 270) {
        page();
        draw(headers, true);
      }
      draw(row, false);
    }
    y += 8;
  }
  line(
    t(
      "Interactive Search Algorithms Laboratory",
      "آزمایشگاه تعاملی الگوریتم‌های جست‌وجو",
    ),
    18,
  );
  line(
    new Intl.DateTimeFormat(language, { dateStyle: "full" }).format(new Date()),
    10,
  );
  heading(t("Measured comparison", "مقایسه نتایج واقعی"));
  table(
    [
      t("Algorithm", "الگوریتم"),
      t("Cost", "هزینه"),
      t("Expanded", "گسترش"),
      t("Generated", "تولید"),
      t("Peak frontier", "بیشینه مرز"),
    ],
    records.map((r) => [
      algorithmNames[r.config.algorithm],
      num(r.result.pathCost),
      num(r.result.expandedNodes),
      num(r.result.generatedNodes),
      num(r.result.maxFrontierSize),
    ]),
    [38, 25, 35, 35, 37],
  );
  heading(t("Expanded-node comparison", "مقایسه گره‌های گسترش‌یافته"));
  const max = Math.max(1, ...records.map((r) => r.result.expandedNodes));
  for (const r of records) {
    room(12);
    doc.setFontSize(9);
    doc.text(
      `${algorithmNames[r.config.algorithm]}: ${num(r.result.expandedNodes)}`,
      20,
      y,
    );
    doc.setFillColor(204, 120, 92);
    doc.rect(20, y + 3, (170 * r.result.expandedNodes) / max, 2.5, "F");
    y += 12;
  }
  heading(t("Observations from these runs", "مشاهدات این اجراها"));
  const a = records.find(
      (r) => r.config.algorithm === "astar" && r.result.found,
    ),
    d = records.find(
      (r) => r.config.algorithm === "dijkstra" && r.result.found,
    ),
    g = records.find((r) => r.config.algorithm === "greedy" && r.result.found);
  if (a && d && comparable(a.config, d.config) && a.result.expandedNodes > 0)
    line(
      `${t("Dijkstra / A* expansion ratio", "نسبت گسترش دایکسترا به A*")}: ${num(d.result.expandedNodes / a.result.expandedNodes)}. ${a.result.pathCost === d.result.pathCost ? t("Their returned costs are equal.", "هزینه پاسخ آن‌ها برابر است.") : t("Their returned costs differ.", "هزینه پاسخ آن‌ها متفاوت است.")}`,
      10,
    );
  if (a && g && comparable(a.config, g.config))
    line(
      `${t("Greedy minus A* solution cost", "اختلاف هزینه پاسخ حریصانه با A*")}: ${num(g.result.pathCost! - a.result.pathCost!)}`,
      10,
    );
  if (!a || (!d && !g))
    line(
      t(
        "Additional compatible completed runs are required for comparative findings.",
        "برای نتیجه‌گیری مقایسه‌ای، اجراهای کامل و سازگار بیشتری لازم است.",
      ),
      10,
    );
  line(
    t(
      "Incomplete runs are not proofs of no path. A dash means no returned solution cost. IDA* frontier is its active path stack.",
      "اجرای ناقص نبود مسیر را ثابت نمی‌کند. خط تیره یعنی هزینه پاسخ موجود نیست. مرز IDA* پشته مسیر فعال آن است.",
    ),
    10,
  );
  for (const r of records) {
    page();
    const v = r.result,
      e = r.config.environment;
    heading(r.title);
    line(
      `${t("Algorithm", "الگوریتم")}: ${algorithmNames[r.config.algorithm]}`,
    );
    line(
      `${t("Environment", "محیط")}: ${e.kind === "maze" ? t("Maze", "هزارتو") : e.kind === "puzzle" ? t("8-Puzzle", "پازل هشت‌تایی") : t("Graph", "گراف")}`,
    );
    line(`${t("Status", "وضعیت")}: ${eventName(v.terminationReason, fa)}`);
    const metrics: [string, number | null][] = [
      [t("Path cost", "هزینه مسیر"), v.pathCost],
      [t("Path length", "طول مسیر"), v.found ? v.path.length - 1 : null],
      [t("Expanded", "گسترش"), v.expandedNodes],
      [t("Generated", "تولید"), v.generatedNodes],
      [t("Peak / final frontier", "بیشینه مرز"), v.maxFrontierSize],
      [t("Final frontier", "مرز نهایی"), v.finalFrontierSize],
      [
        t("Peak physical heap / stack", "بیشینه هیپ یا پشته فیزیکی"),
        v.maxPhysicalFrontier,
      ],
      [t("Maximum depth", "بیشینه عمق"), v.maxDepth],
      [
        t("Repeated accepted states", "حالت‌های تکراری پذیرفته‌شده"),
        v.repeatedStates,
      ],
      [
        t("Working memory estimate (bytes)", "برآورد حافظه کاری (بایت)"),
        v.workingMemoryBytes,
      ],
      [
        t("Trace memory estimate (bytes)", "برآورد حافظه رد اجرا (بایت)"),
        v.traceBytes,
      ],
      [t("Active engine milliseconds", "میلی‌ثانیه فعال موتور"), v.elapsedMs],
    ];
    table(
      [
        t("Metric", "معیار"),
        t("Measured / estimated value", "مقدار واقعی یا برآوردی"),
      ],
      metrics.map(([name, value]) => [name, num(value)]),
      [115, 55],
    );
    line(`${t("Seed", "بذر")}: ${r.config.seed}`, 10);
    line(
      `${t("Recorded at", "زمان ثبت")}: ${new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(r.createdAt))}`,
      10,
    );
    line(
      `${t("Application / schema", "نسخه برنامه / ساختار")}: ${r.appVersion} / ${r.schemaVersion}`,
      10,
    );
    line(
      t(
        r.traceIncluded
          ? "The source experiment has a complete recorded trace. This PDF contains a summary; export full JSON for event-level analysis."
          : "The source experiment is summary-only. Replay is unavailable. Exported JSON preserves its configuration and metrics.",
        r.traceIncluded
          ? "آزمایش منبع رد کامل دارد. این PDF گزارش خلاصه است؛ برای تحلیل رویدادها JSON کامل بگیرید."
          : "آزمایش منبع فقط خلاصه دارد. بازپخش در دسترس نیست. JSON پیکربندی و معیارها را حفظ می‌کند.",
      ),
      10,
    );
    heading(t("Reproducible configuration", "پیکربندی بازتولیدپذیر"));
    line(JSON.stringify(r.config), 8, false);
  }
  page();
  heading(t("Methodology and limitations", "روش‌شناسی و محدودیت‌ها"));
  line(
    t(
      "Expanded excludes stale heap entries and the goal. Generated includes the initial state and accepted insertions or improvements. IDA* counts repeated threshold iterations. Path length counts transitions; path cost sums actual edge weights. Frontier measures unique valid pending states, or the active IDA* stack.",
      "گسترش ورودی کهنه هیپ و هدف را شامل نمی‌شود. تولید شامل حالت آغازین و درج یا بهبود پذیرفته‌شده است. IDA* تکرارهای آستانه را نیز می‌شمارد. طول مسیر تعداد انتقال‌هاست و هزینه مجموع وزن واقعی یال‌هاست. مرز تعداد حالت‌های یکتای معتبر در انتظار یا پشته فعال IDA* است.",
    ),
  );
  line(
    t(
      "Memory estimates use fixed structural weights, not measured JavaScript heap allocation. Working storage and recorded trace storage are reported separately. Timing measures active engine computation; hardware, browser and recording overhead affect it. Timing is not a ranking criterion.",
      "برآورد حافظه از وزن‌های ثابت ساختاری استفاده می‌کند، نه اندازه‌گیری هیپ جاوااسکریپت. حافظه کاری و رد ثبت‌شده جدا گزارش می‌شوند. زمان فقط محاسبه فعال موتور را می‌سنجد و به سخت‌افزار، مرورگر و سربار ثبت وابسته است. زمان معیار رتبه‌بندی نیست.",
    ),
  );
  line(
    t(
      "Dijkstra requires nonnegative costs. A* with reopening and IDA* require admissible heuristics and finite-search conditions for optimality. BFS minimizes steps, not arbitrary weighted cost. Greedy and DFS have no general optimality guarantee. Geometric graph heuristics must be validated.",
      "دایکسترا به هزینه نامنفی نیاز دارد. A* با بازگشایی و IDA* برای بهینگی به تخمین مجاز و شرایط فضای متناهی نیاز دارند. BFS گام‌ها را کمینه می‌کند، نه هزینه وزن‌دار دلخواه. حریصانه و DFS تضمین عمومی بهینگی ندارند. تخمین هندسی گراف باید اعتبارسنجی شود.",
    ),
  );
  line(
    t(
      "Cancellation and search limits return incomplete statistics, never a proof of no path. Event limits stop execution before an unrecordable transition. Decisions are reproducible from the configuration and seed, but duration limits may stop at different points on different devices. The default maze is reconstructed, not an originally published obstacle map.",
      "لغو و محدودیت جست‌وجو آمار ناقص می‌دهند، نه اثبات نبود مسیر. سقف رویداد اجرا را پیش از انتقال ثبت‌ناپذیر متوقف می‌کند. تصمیم‌ها با پیکربندی و بذر بازتولید می‌شوند، اما محدودیت زمان ممکن است در دستگاه‌های متفاوت در نقاط متفاوتی تمام شود. هزارتوی پیش‌فرض بازسازی‌شده است، نه نقشه موانع منتشرشده اصلی.",
    ),
  );
  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`${num(p)} / ${num(doc.getNumberOfPages())}`, 105, 286, {
      align: "center",
    });
    doc.text("Search Laboratory", 20, 12);
  }
  doc.save("search-laboratory.pdf");
}
