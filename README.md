# آزمایشگاه تعاملی الگوریتم‌های جست‌وجو

یک برنامه محلی و بدون سرور برای اجرای واقعی، مشاهده و مقایسه A*، دایکسترا، حریصانه، BFS، DFS و IDA* در هزارتو، پازل هشت‌تایی و گراف وزن‌دار. زبان پیش‌فرض فارسی است؛ انگلیسی، راست‌به‌چپ، چپ‌به‌راست، پوسته روشن و تیره پشتیبانی می‌شوند.

## راه‌اندازی

Node.js نسخه ۲۲٫۱۲ یا جدیدتر و npm لازم است. محیط توسعه این پروژه Node 26 است.

```sh
npm ci
npm run dev
```

نشانی توسعه: `http://127.0.0.1:5173`.

```sh
npm test
npm run typecheck
npx playwright install chromium
npm run test:e2e
npm run build
```

خروجی تولید در `dist/` قرار می‌گیرد. باید از یک سرور HTTP ایستا استفاده شود؛ باز کردن مستقیم فایل HTML برای Web Worker کافی نیست. برنامه به حساب کاربری، پایگاه داده سرور یا خدمات بیرونی نیاز ندارد.

## قابلیت‌ها و روش استفاده

محیط و الگوریتم را انتخاب کنید و «اجرای جست‌وجو» یا «مقایسه هر شش الگوریتم» را بزنید. محاسبه در Worker انجام می‌شود؛ توقف محاسبه با توقف بازپخش متفاوت است. پخش، گام جلو و عقب، خط زمان، تاریخچه، درخت قابل جمع کردن و بازپخش پاسخ از رد واقعی استفاده می‌کنند. تغییر مسئله اجرای جاری و نتایج موقت را پاک می‌کند؛ برای نگهداری ابتدا آزمایش را ذخیره کنید.

- هزارتو: ویرایش مانع و ابتدا/هدف، انتخاب چند خانه، رسم با کشیدن، حرکت قطری بدون عبور از گوشه، نقشه موانع تصادفی و هزارتوی کامل با بذر. تولید هزارتوی کامل ابعاد را فرد می‌کند و نقاط شروع/هدف را در گوشه‌ها می‌گذارد.
- پازل: صفحه سه‌بعدی، حرکت قانونی، شروع و هدف دلخواه، بررسی زوجیت، درهم‌ریزی با حرکت قانونی و بدون برگشت فوری. تعداد درهم‌ریزی معیار فاصله بهینه نیست.
- گراف: گره، موقعیت، یال، جهت و هزینه قابل ویرایش؛ تخمین صفر، هندسی و مقادیر دلخواه. اعتبارسنجی با روش مستقل بلمن–فورد معکوس انجام می‌شود.
- تحلیل: معیارهای واقعی، نمودارها، مقایسه، ۱۳ موضوع آموزشی و ۶ نوع تمرین.
- ذخیره: IndexedDB برای آزمایش‌ها، localStorage برای ترجیحات، ورود/خروج JSON، خروجی CSV و PDF با قلم فارسی جاسازی‌شده.

## تعریف معیارها

گسترش تعداد پردازش همسایه‌هاست؛ ورودی کهنه و خود هدف شمرده نمی‌شوند. تولید از ۱ آغاز می‌شود و هر درج یا بهبود پذیرفته‌شده را می‌شمارد. در IDA* تولید و گسترش تکرارهای آستانه‌ای نیز شمرده می‌شوند. طول مسیر تعداد انتقال و هزینه مسیر مجموع وزن‌هاست. مرز تعداد حالت‌های یکتای معتبر در انتظار است؛ اندازه فیزیکی هیپ جدا ثبت می‌شود. برای IDA* مرز اندازه پشته مسیر فعال است. حالت تکراری فقط کشف پذیرفته‌شده حالتی است که قبلاً ثبت شده است.

حافظه یک مدل ساختاری تقریبی است، نه اندازه‌گیری واقعی حافظه جاوااسکریپت. حافظه رد اجرا جدا گزارش می‌شود. زمان فقط زمان فعال موتور است؛ به سخت‌افزار وابسته است و مبنای رتبه‌بندی نیست. نتیجه محدود یا لغوشده به معنی نبود مسیر نیست. محدودیت پیش‌فرض: ۱۰۰هزار گسترش، ۲۵۰هزار تولید، یک‌میلیون رویداد و ۳۰ ثانیه زمان فعال. سقف رویداد محاسبه را متوقف می‌کند؛ رد اجرا بی‌صدا بریده نمی‌شود.

## صحت و بازتولید

هزارتوی پیش‌فرض **بازسازی‌شده** است و چیدمان منتشرشده گزارش اصلی نیست. مقادیر مرجع تنها برای بررسی نتیجه واقعی استفاده می‌شوند. ترتیب همسایه‌ها پایین، بالا، راست، چپ است. هیپ با اولویت و شمارنده درج افزایشی مرتب می‌شود. نشان «مطابق گزارش» تنها برای پیش‌فرض معتبر و نتیجه دقیق ظاهر می‌شود.

| محیط   | الگوریتم | هزینه | گسترش | تولید |
| ------ | -------- | ----: | ----: | ----: |
| هزارتو | A*       |    18 |    27 |    35 |
| هزارتو | Dijkstra |    18 |    64 |    69 |
| هزارتو | Greedy   |    22 |    22 |    32 |
| پازل   | A*       |    16 |    84 |   139 |
| پازل   | Dijkstra |    16 |  8162 | 12906 |
| پازل   | Greedy   |    28 |   101 |   171 |

دایکسترا برای هزینه نامنفی بهینه است؛ A* با بازگشایی حالت و تخمین مجاز و IDA* با شرایط فضای متناهی و تخمین مجاز بهینه‌اند. BFS گام‌ها را کمینه می‌کند و برای وزن دلخواه بهینه نیست. DFS و حریصانه تضمین عمومی بهینگی ندارند. تمام ادعاهای کامل بودن محدود به فضای متناهی و اجرای بدون محدودیت زودرس هستند.

## محدودیت‌ها

حداکثر هزارتو ۱۰۰×۱۰۰، گراف ۲۰۰ گره و ۲۰۰۰ یال است. نمایش درخت پیش‌فرض ۵۰۰ رخداد دارد؛ بقیه رکوردها حفظ می‌شوند. به دلیل ثبت رد کامل، حافظه کل برنامه IDA* خطی در عمق نیست. محدودیت زمانی ممکن است روی دستگاه‌های مختلف در نقطه متفاوتی تمام شود. CSV/JSON برای تحلیل ماشینی‌اند؛ PDF گزارش خواندنی است. بدون WebGL ویرایشگر متنی و تاریخچه همچنان قابل استفاده‌اند. نسخه اولیه ساختار JSON برابر ۱ است؛ نسخه ناشناخته رد می‌شود و مهاجرت ساختگی ارائه نمی‌شود.

---

# Interactive Search Algorithms Laboratory

A browser-local educational laboratory with real search execution, three R3F environments, deterministic traces, reversible playback, experiments, analysis, and bilingual learning material. No account, backend, remote inference, or fabricated result data.

## Stack and commands

Vite, React, strict TypeScript, Tailwind CSS, Three.js, React Three Fiber, Drei, Web Workers, Vitest, React Testing Library, Playwright, and jsPDF. Native IndexedDB and localStorage handle persistence. Vazirmatn is bundled under its SIL Open Font License in `public/fonts/OFL.txt`.

Use Node ≥22.12, run `npm ci`, then `npm run dev`. Run `npm test`, `npm run typecheck`, and `npm run build`. For browser verification, first `npx playwright install chromium`, then `npm run test:e2e`. Production output is `dist/`; serve it over HTTP, not `file://`.

## Architecture

```text
src/
  engine/          Strict shared types, heap, resumable algorithms, tests
  environments/    Validated models, seeded generators, heuristic reference
  workers/         Typed protocol and cooperative chunk scheduling
  playback/        Event reducer and bounded checkpoint cache
  visualization/   Maze, puzzle, graph R3F scenes and rendering boundary
  analytics/       Reference verification and comparison compatibility
  components/      Editors, analysis, history, tree, education
  services/        Validated IndexedDB persistence, CSV/JSON/PDF exports
  i18n/            Language context, localized messages and event names
  app/             Workspace orchestration
e2e/               Real-browser workflows
public/fonts/      Offline Persian font and license
DESIGN.md          Installed Claude design documentation
```

The required `npx getdesign@latest add claude` command produced `DESIGN.md`; it did not install React components. The UI implements its cream canvas, coral accents, warm dark surfaces, spacing and typography guidance with native accessible controls. Licensed Claude fonts and brand marks are not copied. English display uses the documented serif fallback; Persian uses Vazirmatn.

## Execution model and guarantees

`search(config, control)` is a synchronous generator that yields at safe transitions. The Worker consumes bounded chunks and yields to its event loop. Pause/resume and cancellation operate on computation, independently of replay. Comparisons execute sequentially on an immutable configuration; editing resets the active experiment. Events carry monotonically increasing indices rather than wall-clock ordering.

A*/Dijkstra/Greedy share strict best-g relaxation and lazy stale deletion with a stable binary heap. The tuple is `(priority, insertionCounter, g, state)`; unique insertion counters resolve ties before the last fields. BFS uses FIFO, DFS a LIFO stack with reversed push order to visit the configured neighbor order. IDA* uses explicit path frames, threshold iterations, minimum exceeded f, and current-path cycle prevention. Actual parent occurrences reconstruct results; reopening cannot rewrite previous history.

For finite validated spaces and nonnegative costs, Dijkstra is optimal; A* and IDA* additionally need admissibility and h(goal)=0. A* reopens improvements, including with inconsistent admissible heuristics. BFS minimizes transition count, not general weighted costs. DFS and Greedy have no general optimality guarantee. Unverified geometric graph heuristics are not assumed admissible.

## Environments and reproducibility

Maze presets, puzzle boards, exact unit costs and neighbor order follow the supplied specification. The reconstructed maze notice is always shown for that preset. A custom edit removes report eligibility. Randomness uses deterministic string-seeded xorshift32. Perfect-maze generation normalizes even dimensions to odd sizes. Puzzle shuffling performs legal moves from the selected goal and avoids immediate reversals; custom parity is checked relative to that goal. Graph heuristic validation uses independent reverse Bellman–Ford distances.

The six reference rows in the Persian table above are covered by automated regression tests. Reference constants never feed search results. Runtime badges require exact configuration and all three matching metrics. BFS, DFS, and IDA* have no invented report targets.

## Metrics and methodology

- **Expanded:** accepted state processing, excluding stale entries and goal processing. IDA* repeats count.
- **Generated:** initial insertion plus accepted discoveries/improvements; IDA* counts each iteration root and each admitted path occurrence.
- **Path cost / length:** summed costs / number of transitions; null cost when no solution was returned.
- **Frontier:** unique valid pending states; IDA* uses active path frames. Physical heap/stack occupancy is tracked separately.
- **Depth:** maximum accepted occurrence depth. **Repeated states:** accepted occurrences of an already registered state, not rejected neighbors.
- **Working-memory estimate:** modeled map/set entries and active entries, using documented fixed byte weights in the engine; excludes trace storage and is not a JS heap measurement. **Trace estimate:** UTF-16 serialized state size plus 64 bytes/occurrence and 56 bytes/event; approximate, excludes object/runtime overhead.
- **Time:** active engine computation, excluding paused intervals, worker scheduling gaps, rendering, and animation. Diagnostic only.

Defaults: 100,000 expanded, 250,000 generated, 1,000,000 recorded events, 30,000 active milliseconds. Terminal capacity is reserved; the engine may stop just before a multi-event transition would overflow the trace. `limit-reached` and `cancelled` retain partial metrics and never imply `no-path`.

## Storage and exports

Schema v1 records contain `schemaVersion`, `appVersion`, `id`, `title`, ISO `createdAt`, complete `config`, `result`, and `traceIncluded`. Configuration includes environment, algorithm, seed, shuffle moves, zero-heuristic override, and all limits. Results contain termination, metrics, returned path, state registry, parent occurrences, event trace, and IDA* thresholds. See the TypeScript interfaces for field types and `storage.ts` for boundary validation.

Save/load/duplicate/delete use committed IndexedDB transactions. Imports are validated before storage and assigned a fresh ID. Unknown schema versions are rejected; no previous schema exists to migrate. Corrupt records never become valid completed runs. JSON summary exports omit states/occurrences/events but keep configuration, metrics and the solution; replay is explicitly unavailable. CSV uses UTF-8 BOM, quoted fields, and formula-safe text. PDF downloads use embedded Vazirmatn, localized text, actual metrics, charts and methodology. Exported data never leaves the browser.

The current valid configuration is saved automatically and restored on reload, independently of completed results. The Experiments tab also exports configuration-only JSON (`schemaVersion: 1`, `kind: "configuration"`, `config`); import it through the same JSON input. Saved runs can be added to a comparison when their problem, heuristic and limits match. Configuration changes reset the active comparison. Event selection explains actual candidate rejection, frontier order and priority; BFS/DFS inspectors explicitly mark unused heuristic priorities.

پیکربندی معتبر کنونی خودکار ذخیره و پس از بارگذاری مجدد بازیابی می‌شود. خروجی پیکربندی بدون اجرا نیز از بخش آزمایش‌ها قابل دریافت و ورود است. آزمایش‌های ذخیره‌شده سازگار را می‌توان به مقایسه افزود. برای نگهداری بلندمدت از JSON استفاده کنید؛ ذخیره مرورگر ممکن است پاک شود.

## Known limits

100×100 maze; 200 graph nodes / 2,000 edges; default tree budget 500 occurrences, adjustable up to 2,000. Trace storage can dominate memory, particularly for repeated IDA* work. Checkpoints are bounded to 24 snapshots. Scientific reproduction covers decisions and counts, not runtime or the stopping point of a duration-limited run. Browser storage is origin-local and subject to quota/eviction: export important experiments. Rendering needs WebGL; accessible editors and analytical data remain available when the scene fails. The three-dimensional module is lazy-loaded but remains a substantial download.

Browser automation currently targets Chromium; Firefox and Safari have not been verified. Only the first 100 graph edge labels are drawn in 3D to bound visual clutter; all edges and their costs remain in the editor, search, and exports. PDF reports contain summaries and configurations, not embedded event traces; use full JSON for authoritative event analysis. A logical trace is deterministic, whereas engine timing and duration-limited termination vary with execution conditions.

## Verification

The automated suite includes 33 unit/integration tests and six Chromium end-to-end workflows. It covers all six exact report rows, independent shortest-path checks, all algorithms, stale entries, threshold iterations, cancellation and limits, replay reconstruction, import validation, persistence, all exports, Persian/English direction, theme persistence, reduced motion, worker failure, WebGL failure, and a 100×100 grid. PDF QA uses rendered pages to check Persian shaping, mixed-script text, tables, charts and pagination. Engine duration remains a diagnostic rather than a performance ranking.
