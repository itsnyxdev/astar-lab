import { useEffect, useState } from "react";
import type { ExperimentRecord } from "../engine/types";
import { useText, algorithmNames } from "../i18n";
const topics: [string, string, string, string][] = [
  [
    "State spaces",
    "فضای حالت",
    "A state describes a complete problem configuration; actions connect states. The same state can be reached through different search occurrences.",
    "حالت یک پیکربندی کامل مسئله است؛ عمل‌ها حالت‌ها را متصل می‌کنند. یک حالت ممکن است از رخدادهای جست‌وجوی متفاوت برسد.",
  ],
  [
    "Search trees",
    "درخت جست‌وجو",
    "Tree occurrences record actual parent relationships. A graph state may appear several times after improvements or in different IDA* iterations.",
    "رخدادهای درخت روابط واقعی والد را ثبت می‌کنند. یک حالت گراف ممکن است پس از بهبود یا در تکرارهای مختلف IDA* چند بار ظاهر شود.",
  ],
  [
    "Nodes and edges",
    "گره‌ها و یال‌ها",
    "Nodes represent states; edges represent legal actions and their costs. Direction matters: a directed action need not be reversible.",
    "گره‌ها حالت‌ها و یال‌ها عمل‌های مجاز و هزینه‌شان را نشان می‌دهند. یال جهت‌دار لزوماً برگشت‌پذیر نیست.",
  ],
  [
    "Frontier and explored states",
    "مرز و حالت‌های بررسی‌شده",
    "The frontier holds pending work. Expanded states have had their successors examined. Stale heap entries are discarded without expansion.",
    "مرز شامل کارهای در انتظار است. جانشین‌های حالت‌های گسترش‌یافته بررسی شده‌اند. ورودی کهنه هیپ بدون گسترش کنار گذاشته می‌شود.",
  ],
  [
    "Path cost",
    "هزینه مسیر",
    "g is the sum of edge costs along a recorded path. Path length counts transitions; these quantities differ when costs vary.",
    "g مجموع هزینه یال‌های مسیر ثبت‌شده است. طول مسیر تعداد انتقال‌هاست؛ با هزینه‌های متفاوت این دو برابر نیستند.",
  ],
  [
    "Heuristics",
    "توابع تخمین",
    "h estimates remaining cost. A* orders g+h, Dijkstra orders g, and Greedy orders h. Setting h=0 makes A* use Dijkstra’s priority.",
    "h هزینه باقی‌مانده را تخمین می‌زند. A* با g+h، دایکسترا با g و حریصانه با h مرتب می‌کند. با h=0 اولویت A* مانند دایکسترا می‌شود.",
  ],
  [
    "Admissibility",
    "مجاز بودن",
    "An admissible heuristic never exceeds the true cheapest remaining cost. Geometric distance is not automatically admissible for arbitrary graph weights.",
    "تخمین مجاز هرگز از کمترین هزینه واقعی باقی‌مانده بیشتر نیست. فاصله هندسی برای وزن‌های دلخواه گراف لزوماً مجاز نیست.",
  ],
  [
    "Consistency",
    "سازگاری",
    "Consistency requires h(u) ≤ cost(u,v)+h(v) on each edge and h(goal)=0. A* here reopens improved states, allowing admissible inconsistent heuristics.",
    "سازگاری برای هر یال h(u) ≤ cost(u,v)+h(v) و h(goal)=0 را لازم دارد. A* این برنامه حالت بهبودیافته را بازمی‌گشاید و تخمین مجاز ناسازگار را پشتیبانی می‌کند.",
  ],
  [
    "Priority queues",
    "صف اولویت",
    "The binary heap selects the smallest priority. A monotonically increasing insertion counter breaks equal-priority ties deterministically. BFS uses FIFO; DFS uses LIFO.",
    "هیپ دودویی کمترین اولویت را برمی‌گزیند. شمارنده افزایشی درج، تساوی‌ها را قطعی می‌شکند. BFS از صف و DFS از پشته استفاده می‌کند.",
  ],
  [
    "Completeness",
    "کامل بودن",
    "On finite validated state spaces with cycle handling, these searches exhaust reachable work if no goal exists. Limits or cancellation invalidate a no-path conclusion.",
    "در فضای حالت متناهی معتبر با کنترل چرخه، جست‌وجو کار دست‌یافتنی را تمام می‌کند. محدودیت یا لغو اجازه نتیجه‌گیری نبود مسیر را نمی‌دهد.",
  ],
  [
    "Optimality",
    "بهینگی",
    "Dijkstra requires nonnegative costs. A* and IDA* require admissible heuristics, nonnegative costs and finite search conditions. BFS minimizes steps, not arbitrary weights. Greedy and DFS offer no general optimality guarantee.",
    "دایکسترا به هزینه نامنفی نیاز دارد. A* و IDA* به تخمین مجاز، هزینه نامنفی و شرایط جست‌وجوی متناهی نیاز دارند. BFS تعداد گام را کمینه می‌کند، نه وزن دلخواه. حریصانه و DFS تضمین عمومی بهینگی ندارند.",
  ],
  [
    "Time complexity",
    "پیچیدگی زمانی",
    "With adjacency lists and consistent heuristics, heap-based graph search is commonly O((V+E) log V); reopening can add work. BFS/DFS are O(V+E). IDA* may repeatedly traverse exponentially many paths.",
    "با فهرست مجاورت و تخمین سازگار، جست‌وجوی هیپی معمولاً O((V+E) log V) است؛ بازگشایی کار را بیشتر می‌کند. BFS/DFS از مرتبه O(V+E) هستند. IDA* ممکن است مسیرهای نمایی را بارها بپیماید.",
  ],
  [
    "Space complexity",
    "پیچیدگی فضایی",
    "Graph searches retain discovered-state bookkeeping. IDA* uses a depth-sized active path, but this laboratory also stores an execution trace: total application memory is not linear in depth.",
    "جست‌وجوی گراف اطلاعات حالت‌های کشف‌شده را نگه می‌دارد. مسیر فعال IDA* به اندازه عمق است؛ اما آزمایشگاه رد اجرا را هم ذخیره می‌کند و حافظه کل برنامه خطی در عمق نیست.",
  ],
];
export function Lessons({
  records,
  index,
}: {
  records: ExperimentRecord[];
  index: number;
}) {
  const { t, n, language } = useText(),
    [topic, T] = useState(0),
    [exercise, E] = useState(0),
    [answer, A] = useState<string | null>(null),
    current = records.at(-1);
  useEffect(() => A(null), [language, exercise, index]);
  const next = current?.result.events.find(
    (e) => e.index > index && e.type === "expand",
  );
  const astar = records.find(
      (r) => r.config.algorithm === "astar" && r.result.found,
    ),
    greedy = records.find(
      (r) => r.config.algorithm === "greedy" && r.result.found,
    ),
    ida = records.find((r) => r.config.algorithm === "ida" && r.result.found);
  const exercises = [
    t(
      "Predict the next expanded occurrence",
      "رخداد گسترش بعدی را پیش‌بینی کنید",
    ),
    t(
      "Compare zero and Manhattan heuristics",
      "تخمین صفر و منهتن را مقایسه کنید",
    ),
    t("Identify an inadmissible estimate", "تخمین نامجاز را شناسایی کنید"),
    t("Inspect Greedy solution quality", "کیفیت پاسخ حریصانه را بررسی کنید"),
    t(
      "Why can weighted BFS be nonoptimal?",
      "چرا BFS وزن‌دار ممکن است نابهینه باشد؟",
    ),
    t("Compare A* and IDA* memory", "حافظه A* و IDA* را مقایسه کنید"),
  ];
  let question = "",
    choices: string[] = [],
    correct = "",
    explanation = "";
  if (exercise === 0) {
    question = next
      ? t(
          "Which occurrence expands next after the selected playback event?",
          "پس از رویداد انتخاب‌شده کدام رخداد گسترش می‌یابد؟",
        )
      : t(
          "Run a search and move the timeline before its final expansion.",
          "جست‌وجو را اجرا کنید و خط زمان را پیش از آخرین گسترش ببرید.",
        );
    if (next) {
      correct = String(next.occurrence);
      choices = [
        ...new Set([
          String(Math.max(0, next.occurrence - 1)),
          correct,
          String(next.occurrence + 1),
        ]),
      ];
      explanation = t(
        "The answer comes from the next recorded expand event.",
        "پاسخ از رویداد گسترش بعدی ثبت‌شده به دست آمده است.",
      );
    }
  }
  if (exercise === 1) {
    question = t(
      "On the four-direction unit-cost maze, which heuristic is more informative while remaining admissible?",
      "در هزارتوی چهارجهته با هزینه واحد، کدام تخمین مجاز اطلاعات بیشتری دارد؟",
    );
    choices = [t("Zero", "صفر"), t("Manhattan", "منهتن")];
    correct = choices[1];
    explanation = t(
      "Manhattan lower-bounds required row and column moves. Zero is admissible but provides no guidance. Run both using the zero-heuristic switch to compare actual work.",
      "منهتن تعداد حرکت‌های لازم ردیف و ستون را از پایین کران می‌زند. صفر مجاز است ولی راهنمایی ندارد. هر دو را با کلید تخمین صفر اجرا و کار واقعی را مقایسه کنید.",
    );
  }
  if (exercise === 2) {
    question = t(
      "An edge directly reaches the goal at cost 2. Which h is certainly inadmissible?",
      "یالی مستقیم با هزینه ۲ به هدف می‌رسد. کدام h قطعاً نامجاز است؟",
    );
    choices = ["0", "2", "3"];
    correct = "3";
    explanation = t(
      "True remaining cost is at most 2, so 3 overestimates it.",
      "هزینه واقعی باقی‌مانده حداکثر ۲ است؛ بنابراین ۳ بیش‌برآورد است.",
    );
  }
  if (exercise === 3) {
    question =
      astar && greedy
        ? t(
            "Did Greedy return a higher cost than A* in these runs?",
            "آیا هزینه پاسخ حریصانه در این اجراها از A* بیشتر است؟",
          )
        : t(
            "Compare algorithms first to obtain A* and Greedy results.",
            "ابتدا الگوریتم‌ها را مقایسه کنید تا نتایج A* و حریصانه ایجاد شوند.",
          );
    if (astar && greedy) {
      choices = [t("Yes", "بله"), t("No", "خیر")];
      correct =
        choices[Number(!(greedy.result.pathCost! > astar.result.pathCost!))];
      explanation = `A*: ${n(astar.result.pathCost!)} · Greedy: ${n(greedy.result.pathCost!)}`;
    }
  }
  if (exercise === 4) {
    question = t(
      "Why can BFS choose a more expensive weighted path?",
      "چرا BFS ممکن است مسیر وزن‌دار گران‌تری را انتخاب کند؟",
    );
    choices = [
      t("It orders by number of steps", "بر اساس تعداد گام مرتب می‌کند"),
      t("It orders by total cost", "بر اساس هزینه کل مرتب می‌کند"),
    ];
    correct = choices[0];
    explanation = t(
      "A direct edge costing 9 is found before a two-edge path costing 1+1.",
      "یال مستقیم با هزینه ۹ پیش از مسیر دو یالی با هزینه ۱+۱ پیدا می‌شود.",
    );
  }
  if (exercise === 5) {
    question =
      astar && ida
        ? t(
            "Which run recorded the smaller peak frontier/active stack?",
            "کدام اجرا بیشینه مرز یا پشته فعال کمتری ثبت کرده است؟",
          )
        : t(
            "Compare algorithms first to obtain A* and IDA* results.",
            "ابتدا الگوریتم‌ها را مقایسه کنید تا نتایج A* و IDA* ایجاد شوند.",
          );
    if (astar && ida) {
      choices = ["A*", "IDA*", t("Equal", "برابر")];
      correct =
        astar.result.maxFrontierSize === ida.result.maxFrontierSize
          ? choices[2]
          : astar.result.maxFrontierSize < ida.result.maxFrontierSize
            ? "A*"
            : "IDA*";
      explanation = t(
        "This compares recorded active work, not total memory including traces.",
        "این مقایسه کار فعال ثبت‌شده است، نه حافظه کل شامل رد اجرا.",
      );
    }
  }
  return (
    <section>
      <div className="section-title">
        <h2>{t("Learn through execution", "یادگیری با اجرا")}</h2>
        <span className="badge">
          {t("13 concepts · 6 exercises", "۱۳ مفهوم · ۶ تمرین")}
        </span>
      </div>
      <div className="lesson-layout">
        <nav aria-label={t("Lessons", "درس‌ها")}>
          {topics.map((v, i) => (
            <button key={i} aria-current={topic === i} onClick={() => T(i)}>
              {n(i + 1)}. {t(v[0], v[1])}
            </button>
          ))}
        </nav>
        <article>
          <h3>{t(topics[topic][0], topics[topic][1])}</h3>
          <p>{t(topics[topic][2], topics[topic][3])}</p>
          {current && (
            <div className="inspector">
              <b>
                {t("Current experiment", "آزمایش کنونی")}:{" "}
                {algorithmNames[current.config.algorithm]}
              </b>
              <p>
                {t("Expanded", "گسترش‌یافته")}:{" "}
                {n(current.result.expandedNodes)} · {t("Generated", "تولیدشده")}
                : {n(current.result.generatedNodes)}
              </p>
              <code dir="ltr">
                {current.config.algorithm === "astar"
                  ? "f = g + h"
                  : current.config.algorithm === "dijkstra"
                    ? "f = g"
                    : current.config.algorithm === "greedy"
                      ? "f = h"
                      : current.config.algorithm === "bfs"
                        ? "FIFO"
                        : current.config.algorithm === "dfs"
                          ? "LIFO"
                          : `thresholds: ${current.result.thresholds.join(" → ")}`}
              </code>
            </div>
          )}
          <hr />
          <label>
            {t("Exercise", "تمرین")}
            <select
              value={exercise}
              onChange={(e) => {
                E(Number(e.target.value));
                A(null);
              }}
            >
              {exercises.map((v, i) => (
                <option key={i} value={i}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <h3>{question}</h3>
          <div className="toolbar">
            {choices.map((v) => (
              <button key={v} onClick={() => A(v)}>
                {v}
              </button>
            ))}
          </div>
          {answer !== null && (
            <p role="status">
              {answer === correct
                ? t("Correct.", "درست است.")
                : t("Try again.", "دوباره تلاش کنید.")}{" "}
              {explanation}
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
