import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  algorithms,
  type Algorithm,
  type Environment,
  type ExperimentConfig,
  type ExperimentRecord,
  type SearchResult,
  type State,
  type SearchTrace,
  type SearchEvent,
} from "../engine/types";
import { initialConfig, preset, key } from "../environments";
import { validateConfig } from "../engine/search";
import { Timeline, type Playback } from "../playback";
import {
  LanguageContext,
  useText,
  errorText,
  eventName,
  algorithmNames,
  type Language,
} from "../i18n";
import { Editor, editCell, type MazeTool } from "../components/Editor";
import { Metrics, Analysis, History, SearchTree } from "../components/Analysis";
import { Lessons } from "../components/Lessons";
import * as storage from "../services/storage";
import { csv, download, jsonRecord, pdf } from "../services/export";
import type { Response, Request } from "../workers/protocol";
import { reportMatch, comparable } from "../analytics";
const Scene = lazy(() => import("../visualization/Scene"));
function preference(name: string, fallback: string) {
  try {
    return localStorage.getItem(name) ?? fallback;
  } catch {
    return fallback;
  }
}
export default function App() {
  const [language, L] = useState<Language>(
      preference("language", "fa") === "en" ? "en" : "fa",
    ),
    [theme, T] = useState(preference("theme", "system"));
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
    try {
      localStorage.setItem("language", language);
      localStorage.setItem("theme", theme);
    } catch {}
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [language, theme]);
  return (
    <LanguageContext.Provider value={language}>
      <Workspace
        language={language}
        setLanguage={L}
        theme={theme}
        setTheme={T}
      />
    </LanguageContext.Provider>
  );
}
function Workspace({
  language,
  setLanguage,
  theme,
  setTheme,
}: {
  language: Language;
  setLanguage: (l: Language) => void;
  theme: string;
  setTheme: (t: string) => void;
}) {
  const { t, n } = useText(),
    [config, C] = useState(
      () => storage.readConfiguration() ?? initialConfig(),
    ),
    [records, R] = useState<ExperimentRecord[]>([]),
    [current, Current] = useState<ExperimentRecord | null>(null),
    [saved, S] = useState<ExperimentRecord[]>([]),
    [index, I] = useState(-1),
    [playing, Play] = useState(false),
    [speed, Speed] = useState(5),
    [tab, Tab] = useState("analysis"),
    [tool, Tool] = useState<MazeTool>("inspect"),
    [error, ErrorState] = useState(""),
    [notice, Notice] = useState(""),
    [running, Running] = useState(false),
    [paused, Paused] = useState(false),
    [steps, Steps] = useState(0),
    [selected, Selected] = useState<State | null>(null),
    [title, Title] = useState(""),
    [includeTrace, Include] = useState(true),
    [solutionMode, SolutionMode] = useState(false);
  const [livePlayback, LivePlayback] = useState<Playback | null>(null),
    [liveEvent, LiveEvent] = useState<SearchEvent | null>(null);
  const stream = useRef<SearchTrace>({
      states: [],
      occurrences: [],
      events: [],
    }),
    liveTimeline = useRef<Timeline | null>(null);
  const worker = useRef<Worker | null>(null),
    runId = useRef(""),
    queue = useRef<Algorithm[]>([]),
    runConfig = useRef(config),
    cancelled = useRef(false),
    file = useRef<HTMLInputElement>(null);
  const result = current?.result ?? null,
    timeline = useMemo(() => (result ? new Timeline(result) : null), [result]),
    playback = useMemo(() => timeline?.at(index) ?? null, [timeline, index]);
  const refresh = () =>
    storage
      .list()
      .then(S)
      .catch(() => ErrorState("storage"));
  useEffect(() => Notice(""), [language]);
  useEffect(() => {
    refresh();
    return () => worker.current?.terminate();
  }, []);
  useEffect(() => {
    try {
      storage.saveConfiguration(config);
    } catch (error) {
      if (error instanceof Error && error.message === "storage")
        ErrorState("storage");
    }
  }, [config]);
  const send = (message: Request) => worker.current?.postMessage(message);
  function launch(c: ExperimentConfig) {
    C(c);
    runConfig.current = c;
    const id = crypto.randomUUID();
    runId.current = id;
    Running(true);
    Paused(false);
    Steps(0);
    Current(null);
    I(-1);
    LivePlayback(null);
    LiveEvent(null);
    stream.current = { states: [], occurrences: [], events: [] };
    liveTimeline.current = new Timeline(stream.current);
    worker.current?.terminate();
    const w = new Worker(
      new URL("../workers/search.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = w;
    w.onerror = () => {
      ErrorState("worker");
      Running(false);
      queue.current = [];
      w.terminate();
    };
    w.onmessage = (event: MessageEvent<Response>) => {
      const m = event.data;
      if (m.runId !== runId.current) return;
      if (m.type === "progress") {
        Steps(m.steps);
        for (const s of m.states) stream.current.states.push(s);
        for (const o of m.occurrences) stream.current.occurrences.push(o);
        for (const e of m.events) stream.current.events.push(e);
        LiveEvent(m.events.at(-1) ?? null);
        LivePlayback(
          liveTimeline.current!.at(stream.current.events.length - 1),
        );
      } else if (m.type === "failure") {
        ErrorState(m.error);
        Running(false);
        queue.current = [];
        w.terminate();
      } else {
        const record: ExperimentRecord = {
          schemaVersion: 1,
          appVersion: "1.0.0",
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          title: `${algorithmNames[c.algorithm]} · ${c.environment.kind === "maze" ? t("Maze", "هزارتو") : c.environment.kind === "puzzle" ? t("8-Puzzle", "پازل هشت‌تایی") : t("Graph", "گراف")}`,
          config: structuredClone(c),
          result: m.result,
          traceIncluded: true,
        };
        R((rs) => [
          ...rs.filter((r) => r.config.algorithm !== c.algorithm),
          record,
        ]);
        Current(record);
        I(m.result.events.length - 1);
        Running(false);
        Paused(false);
        w.terminate();
        const next = queue.current.shift();
        if (next && !cancelled.current) launch({ ...c, algorithm: next });
      }
    };
    send({ type: "start", runId: id, config: c });
  }
  function start(compare = false) {
    try {
      validateConfig(config);
      ErrorState("");
      Notice("");
      Play(false);
      cancelled.current = false;
      queue.current = compare ? algorithms.slice(1) : [];
      if (compare) R([]);
      launch({
        ...config,
        algorithm: compare ? algorithms[0] : config.algorithm,
      });
    } catch (e) {
      ErrorState(e instanceof Error ? e.message : "invalid");
      Running(false);
      Paused(false);
      queue.current = [];
    }
  }
  function change(c: ExperimentConfig) {
    cancelled.current = true;
    queue.current = [];
    worker.current?.terminate();
    runId.current = "";
    Running(false);
    Paused(false);
    Play(false);
    Current(null);
    I(-1);
    R([]);
    C(c);
    Selected(null);
  }
  const jump = (i: number) => {
    Play(false);
    I(i);
  };
  useEffect(() => {
    if (!playing || !result) return;
    const timer = setInterval(
      () => {
        I((i) => {
          const next = solutionMode
            ? result.events.find(
                (e) =>
                  e.index > i &&
                  result.pathOccurrences.includes(e.occurrence) &&
                  ["initialize", "discover", "relax"].includes(e.type),
              )?.index
            : Math.min(
                result.events.length - 1,
                i + Math.max(1, Math.floor(speed / 5)),
              );
          if (next === undefined || next >= result.events.length - 1) {
            Play(false);
            return result.events.length - 1;
          }
          return next;
        });
      },
      Math.max(20, 200 / speed),
    );
    return () => clearInterval(timer);
  }, [playing, speed, result, solutionMode]);
  async function action(fn: () => Promise<void>) {
    try {
      ErrorState("");
      await fn();
    } catch (e) {
      ErrorState(
        e instanceof Error &&
          ["invalid", "storage", "unsolvable"].includes(e.message)
          ? e.message
          : "export",
      );
    }
  }
  async function saveCurrent() {
    if (!current) return;
    const updated = { ...current, title: title.trim() || current.title };
    await storage.save(updated);
    Current(updated);
    R((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    await refresh();
    Notice(t("Experiment saved.", "آزمایش ذخیره شد."));
  }
  function load(r: ExperimentRecord) {
    try {
      storage.validateRecord(r);
      change(r.config);
      Current(r);
      R([r]);
      I(r.result.events.length - 1);
      Title(r.title);
      Tab("analysis");
    } catch (e) {
      ErrorState(e instanceof Error ? e.message : "invalid");
    }
  }
  function selectState(s: State) {
    Selected(s);
    if (result) {
      const sid = result.states.findIndex((v) => key(v) === key(s)),
        event = result.events.find(
          (e) => result.occurrences[e.occurrence].stateId === sid,
        );
      if (event) jump(event.index);
    }
  }
  const reportDefault =
    config.environment.kind !== "graph" &&
    JSON.stringify(config.environment) ===
      JSON.stringify(preset(config.environment.kind));
  const status = running
    ? paused
      ? t("Computation paused", "محاسبه متوقف است")
      : t("Computing", "در حال محاسبه")
    : result
      ? eventName(result.terminationReason, language === "fa")
      : t("Ready to explore", "آماده کاوش");
  return (
    <>
      <header className="app-header">
        <a className="brand" href="#main">
          <span className="brand-symbol">⌘</span>
          <span>
            {t("Search Laboratory", "آزمایشگاه جست‌وجو")}
            <small>
              {t("ALGORITHMS · EVIDENCE · DISCOVERY", "الگوریتم · شواهد · کشف")}
            </small>
          </span>
        </a>
        <div className="header-controls">
          <label className="sr-only" htmlFor="language">
            {t("Language", "زبان")}
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            <option value="fa">فارسی</option>
            <option value="en">English</option>
          </select>
          <label className="sr-only" htmlFor="theme">
            {t("Theme", "پوسته")}
          </label>
          <select
            id="theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="system">{t("System theme", "پوسته سیستم")}</option>
            <option value="light">{t("Light", "روشن")}</option>
            <option value="dark">{t("Dark", "تیره")}</option>
          </select>
        </div>
      </header>
      <main id="main">
        <div className="intro">
          <div>
            <div className="eyebrow">
              {t("INTERACTIVE ALGORITHMS / 01", "الگوریتم‌های تعاملی / ۰۱")}
            </div>
            <h1>
              {t("Every search tells a story.", "هر جست‌وجو داستانی دارد.")}
            </h1>
            <p>
              {t(
                "Explore the decisions behind the path. Execute, inspect, and compare six search strategies.",
                "تصمیم‌های پشت مسیر را کشف کنید. شش راهبرد جست‌وجو را اجرا، بررسی و مقایسه کنید.",
              )}
            </p>
          </div>
          <div className="status" role="status">
            <span className={running ? "status-dot busy" : "status-dot"} />
            {status}
            {running && (
              <small>
                {n(steps)} {t("execution steps", "گام اجرا")}
              </small>
            )}
          </div>
        </div>
        {error && (
          <div className="alert" role="alert">
            {errorText(error, language)}
            <button onClick={() => ErrorState("")}>
              {t("Dismiss", "بستن")}
            </button>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        <div className="workspace">
          <aside className="configuration">
            <div className="section-title">
              <h2>{t("Experiment", "آزمایش")}</h2>
              <span className="badge">
                {reportDefault
                  ? t("Report preset", "پیش‌فرض گزارش")
                  : t("Custom", "سفارشی")}
              </span>
            </div>
            <label>
              {t("Environment", "محیط")}
              <select
                value={config.environment.kind}
                onChange={(e) =>
                  change({
                    ...config,
                    environment: preset(e.target.value as Environment["kind"]),
                  })
                }
              >
                <option value="maze">{t("Maze", "هزارتو")}</option>
                <option value="puzzle">{t("8-Puzzle", "پازل هشت‌تایی")}</option>
                <option value="graph">
                  {t("Weighted graph", "گراف وزن‌دار")}
                </option>
              </select>
            </label>
            <label>
              {t("Search algorithm", "الگوریتم جست‌وجو")}
              <select
                value={config.algorithm}
                onChange={(e) =>
                  change({ ...config, algorithm: e.target.value as Algorithm })
                }
              >
                {algorithms.map((a) => (
                  <option key={a} value={a}>
                    {algorithmNames[a]}
                  </option>
                ))}
              </select>
            </label>
            <div className="formula" dir="ltr">
              {config.algorithm === "astar"
                ? "f(n) = g(n) + h(n)"
                : config.algorithm === "dijkstra"
                  ? "f(n) = g(n)"
                  : config.algorithm === "greedy"
                    ? "f(n) = h(n)"
                    : config.algorithm === "bfs"
                      ? "FIFO"
                      : config.algorithm === "dfs"
                        ? "LIFO"
                        : `f(n) ≤ ${t("threshold", "آستانه")}`}
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={config.zeroHeuristic}
                onChange={(e) =>
                  change({ ...config, zeroHeuristic: e.target.checked })
                }
              />
              {t("Use zero heuristic", "استفاده از تخمین صفر")}
            </label>
            <button
              className="primary run"
              disabled={running}
              onClick={() => start()}
            >
              {t("Run search", "اجرای جست‌وجو")}{" "}
              <span aria-hidden="true">↗</span>
            </button>
            <button disabled={running} onClick={() => start(true)}>
              {t("Compare all six", "مقایسه هر شش الگوریتم")}
            </button>
            {running && (
              <div className="toolbar">
                <button
                  onClick={() => {
                    send({
                      type: paused ? "resume" : "pause",
                      runId: runId.current,
                    });
                    Paused(!paused);
                  }}
                >
                  {paused
                    ? t("Resume computation", "ادامه محاسبه")
                    : t("Pause computation", "توقف محاسبه")}
                </button>
                <button
                  onClick={() => {
                    cancelled.current = true;
                    queue.current = [];
                    send({ type: "cancel", runId: runId.current });
                  }}
                >
                  {t("Cancel", "لغو")}
                </button>
              </div>
            )}
            <details>
              <summary>{t("Execution limits", "محدودیت‌های اجرا")}</summary>
              {(["expanded", "generated", "events", "durationMs"] as const).map(
                (v, i) => (
                  <label key={v}>
                    {t(
                      [
                        "Expanded nodes",
                        "Generated nodes",
                        "Recorded events",
                        "Active duration (ms)",
                      ][i],
                      [
                        "گره‌های گسترش‌یافته",
                        "گره‌های تولیدشده",
                        "رویدادهای ثبت‌شده",
                        "زمان فعال (میلی‌ثانیه)",
                      ][i],
                    )}
                    <input
                      type="number"
                      min={v === "events" ? 8 : 1}
                      value={config.limits[v]}
                      onChange={(e) =>
                        change({
                          ...config,
                          limits: {
                            ...config.limits,
                            [v]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ),
              )}
            </details>
            <div className="legend">
              {[
                ["start", "S", t("Start", "شروع")],
                ["goal", "G", t("Goal", "هدف")],
                ["frontier", "◇", t("Frontier", "مرز")],
                ["expanded", "▪", t("Expanded", "گسترش‌یافته")],
                ["current", "◎", t("Current", "کنونی")],
                ["path", "━", t("Path", "مسیر")],
              ].map(([v, s, label]) => (
                <span key={v}>
                  <i className={`legend-${v}`}>{s}</i>
                  {label}
                </span>
              ))}
            </div>
            {reportDefault && config.environment.kind === "maze" && (
              <p className="footnote">
                {t(
                  "Reconstructed layout. The original report does not publish its exact obstacle positions. This layout reproduces the report's expected results.",
                  "چیدمان بازسازی‌شده: گزارش اصلی موقعیت دقیق موانع را منتشر نکرده است. این چیدمان نتایج مورد انتظار گزارش را بازتولید می‌کند.",
                )}
              </p>
            )}
          </aside>
          <div className="visual-workspace">
            <Suspense
              fallback={
                <div className="scene-fallback">
                  {t("Preparing scene…", "آماده‌سازی صحنه…")}
                </div>
              }
            >
              <Scene
                environment={config.environment}
                result={running ? stream.current : result}
                playback={running ? livePlayback : playback}
                tool={tool}
                onCell={(id) => {
                  if (config.environment.kind === "maze") {
                    if (tool === "inspect" || tool === "select")
                      selectState(id);
                    else
                      change({
                        ...config,
                        environment: editCell(config.environment, id, tool),
                      });
                  }
                }}
                onSelect={selectState}
              />
            </Suspense>
            <div className="playback">
              <div className="toolbar">
                <button
                  disabled={!result?.events.length}
                  onClick={() => jump(-1)}
                  aria-label={t("Jump to start", "رفتن به آغاز")}
                >
                  |◀
                </button>
                <button
                  disabled={!result || index < 0}
                  onClick={() => jump(index - 1)}
                  aria-label={t("Previous event", "رویداد قبل")}
                >
                  ◀
                </button>
                <button
                  disabled={!result?.events.length}
                  onClick={() => {
                    if (index >= result!.events.length - 1) I(-1);
                    Play(!playing);
                  }}
                >
                  {playing
                    ? t("Pause replay", "توقف بازپخش")
                    : t("Play replay", "پخش اجرا")}
                </button>
                <button
                  disabled={!result || index >= result.events.length - 1}
                  onClick={() => jump(index + 1)}
                  aria-label={t("Next event", "رویداد بعد")}
                >
                  ▶
                </button>
                <button
                  disabled={!result?.events.length}
                  onClick={() => jump(result!.events.length - 1)}
                  aria-label={t("Jump to end", "رفتن به پایان")}
                >
                  ▶|
                </button>
                <span className="event-counter">
                  {n(index + 1)} / {n(result?.events.length ?? 0)}
                </span>
              </div>
              <label className="timeline-label">
                <span className="sr-only">{t("Timeline", "خط زمان")}</span>
                <input
                  type="range"
                  min="-1"
                  max={Math.max(0, (result?.events.length ?? 0) - 1)}
                  value={index}
                  disabled={!result?.events.length}
                  onChange={(e) => jump(Number(e.target.value))}
                />
              </label>
              <div className="toolbar">
                <label>
                  {t("Speed", "سرعت")}{" "}
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={speed}
                    onChange={(e) => Speed(Number(e.target.value))}
                  />
                  {n(speed)}×
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={solutionMode}
                    onChange={(e) => SolutionMode(e.target.checked)}
                  />
                  {t("Solution replay", "بازپخش مسیر پاسخ")}
                </label>
                {current && reportMatch(current.config, current.result) && (
                  <span className="badge success">
                    ✓ {t("Matches report", "مطابق گزارش")}
                  </span>
                )}
              </div>
            </div>
            {result ? (
              <Metrics result={result} />
            ) : (
              <div className="metrics">
                {[
                  t("Path cost", "هزینه مسیر"),
                  t("Expanded", "گسترش‌یافته"),
                  t("Generated", "تولیدشده"),
                  t("Peak frontier", "بیشینه مرز"),
                ].map((v, i) => (
                  <div key={v}>
                    <small>{v}</small>
                    <strong>
                      {running && liveEvent && i > 0
                        ? n(
                            i === 1
                              ? liveEvent.expanded
                              : i === 2
                                ? liveEvent.generated
                                : stream.current.events.reduce(
                                    (max, e) => Math.max(max, e.frontier),
                                    0,
                                  ),
                          )
                        : "—"}
                    </strong>
                  </div>
                ))}
              </div>
            )}
            {selected !== null && (
              <div className="selected-state">
                {t("Selected state", "حالت انتخاب‌شده")}:{" "}
                <code dir="ltr">{JSON.stringify(selected)}</code>
              </div>
            )}
            {config.environment.kind === "puzzle" && (
              <p className="goal-reference">
                {t("Goal board", "صفحه هدف")}:{" "}
                <code dir="ltr">
                  {config.environment.goal.map((v) => v || "□").join(" · ")}
                </code>
              </p>
            )}
          </div>
        </div>
        <details className="editor-container">
          <summary>
            {t(
              "Edit problem & generation settings",
              "ویرایش مسئله و تنظیمات تولید",
            )}
          </summary>
          <Editor
            config={config}
            change={change}
            tool={tool}
            setTool={Tool}
            onError={ErrorState}
            inspect={selectState}
          />
        </details>
        <nav className="tabs" aria-label={t("Workspaces", "بخش‌های آزمایشگاه")}>
          {["analysis", "history", "tree", "learn", "saved"].map((v, i) => (
            <button
              key={v}
              aria-current={tab === v ? "page" : undefined}
              onClick={() => Tab(v)}
            >
              {t(
                ["Analysis", "History", "Search tree", "Learn", "Experiments"][
                  i
                ],
                ["تحلیل", "تاریخچه", "درخت جست‌وجو", "یادگیری", "آزمایش‌ها"][i],
              )}
            </button>
          ))}
        </nav>
        <div className="analysis-workspace">
          {tab === "analysis" && (
            <>
              <Analysis records={records} />
              {result && (
                <details>
                  <summary>{t("Detailed metrics", "معیارهای تفصیلی")}</summary>
                  <dl className="details-grid">
                    {[
                      [
                        t("Path length", "طول مسیر"),
                        result.found ? result.path.length - 1 : null,
                      ],
                      [
                        t("Final frontier", "مرز نهایی"),
                        result.finalFrontierSize,
                      ],
                      [
                        t("Peak physical heap/stack", "بیشینه هیپ/پشته فیزیکی"),
                        result.maxPhysicalFrontier,
                      ],
                      [t("Maximum depth", "بیشینه عمق"), result.maxDepth],
                      [
                        t(
                          "Repeated accepted states",
                          "حالت‌های تکراری پذیرفته‌شده",
                        ),
                        result.repeatedStates,
                      ],
                      [
                        t(
                          "Working memory estimate (bytes)",
                          "برآورد حافظه کاری (بایت)",
                        ),
                        result.workingMemoryBytes,
                      ],
                      [
                        t("Trace estimate (bytes)", "برآورد رد اجرا (بایت)"),
                        result.traceBytes,
                      ],
                      [
                        t("Engine time (ms)", "زمان موتور (میلی‌ثانیه)"),
                        result.elapsedMs,
                      ],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt>{label}</dt>
                        <dd>{value === null ? "—" : n(Number(value))}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </>
          )}
          {tab === "history" &&
            (result?.events.length ? (
              <History
                result={result}
                index={index}
                jump={jump}
                algorithm={current!.config.algorithm}
              />
            ) : (
              <p className="empty">
                {t(
                  "Run or load an experiment with a trace.",
                  "آزمایشی با رد اجرا را اجرا یا بارگذاری کنید.",
                )}
              </p>
            ))}
          {tab === "tree" &&
            (result?.events.length ? (
              <SearchTree result={result} index={index} jump={jump} />
            ) : (
              <p className="empty">
                {t(
                  "A recorded trace is required.",
                  "رد اجرای ثبت‌شده لازم است.",
                )}
              </p>
            ))}
          {tab === "learn" && <Lessons records={records} index={index} />}
          {tab === "saved" && (
            <section>
              <h2>{t("Your experiments", "آزمایش‌های شما")}</h2>
              <p>
                {t(
                  "Stored only in this browser. Export JSON to keep a portable copy.",
                  "فقط در این مرورگر ذخیره می‌شود. برای نسخه قابل انتقال، JSON بگیرید.",
                )}
              </p>
              <div className="form-grid">
                <label>
                  {t("Experiment title", "عنوان آزمایش")}
                  <input
                    value={title}
                    onChange={(e) => Title(e.target.value)}
                    maxLength={500}
                  />
                </label>
                <button disabled={!current} onClick={() => action(saveCurrent)}>
                  {t("Save current", "ذخیره کنونی")}
                </button>
                <button onClick={() => file.current?.click()}>
                  {t("Import JSON", "ورود JSON")}
                </button>
                <button
                  onClick={() =>
                    action(async () => {
                      validateConfig(config);
                      download(
                        JSON.stringify(
                          { schemaVersion: 1, kind: "configuration", config },
                          null,
                          2,
                        ),
                        "configuration.json",
                        "application/json",
                      );
                    })
                  }
                >
                  {t("Export configuration", "خروجی پیکربندی")}
                </button>
                <input
                  ref={file}
                  className="sr-only"
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      action(async () => {
                        if (f.size > 100 * 1024 * 1024) throw Error("invalid");
                        let value: unknown;
                        try {
                          value = JSON.parse(await f.text());
                        } catch {
                          throw Error("invalid");
                        }
                        if (
                          value &&
                          typeof value === "object" &&
                          "kind" in value &&
                          value.kind === "configuration"
                        ) {
                          if (
                            !("schemaVersion" in value) ||
                            value.schemaVersion !== 1 ||
                            !("config" in value)
                          )
                            throw Error("invalid");
                          validateConfig(value.config);
                          change(value.config);
                          Notice(
                            t("Configuration loaded.", "پیکربندی بارگذاری شد."),
                          );
                          return;
                        }
                        storage.validateRecord(value);
                        const imported = { ...value, id: crypto.randomUUID() };
                        await storage.save(imported);
                        await refresh();
                        load(imported);
                      });
                    e.target.value = "";
                  }}
                />
              </div>
              {!saved.length && (
                <p className="empty">
                  {t(
                    "No saved experiments yet.",
                    "هنوز آزمایشی ذخیره نشده است.",
                  )}
                </p>
              )}
              {saved.map((r) => (
                <div className="saved-row" key={r.id}>
                  <div>
                    <b>{r.title}</b>
                    <small>
                      {new Intl.DateTimeFormat(language, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(r.createdAt))}{" "}
                      ·{" "}
                      {r.traceIncluded
                        ? t("Full trace", "رد کامل")
                        : t("Summary only", "فقط خلاصه")}
                    </small>
                  </div>
                  <div className="toolbar">
                    <button onClick={() => load(r)}>
                      {t("Load", "بارگذاری")}
                    </button>
                    <button
                      disabled={running}
                      onClick={() => {
                        if (
                          records.length &&
                          !comparable(records[0].config, r.config)
                        ) {
                          Notice(
                            t(
                              "Compare experiments with the same problem, heuristic, and limits.",
                              "آزمایش‌هایی با مسئله، تخمین و محدودیت یکسان مقایسه کنید.",
                            ),
                          );
                          return;
                        }
                        R((rs) => [...rs.filter((v) => v.id !== r.id), r]);
                        Current(r);
                        C(r.config);
                        I(r.result.events.length - 1);
                        Tab("analysis");
                      }}
                    >
                      {t("Add to comparison", "افزودن به مقایسه")}
                    </button>
                    <button
                      onClick={() =>
                        action(async () => {
                          await storage.save({
                            ...r,
                            id: crypto.randomUUID(),
                            createdAt: new Date().toISOString(),
                            title: `${r.title} · ${t("Copy", "نسخه")}`,
                          });
                          await refresh();
                        })
                      }
                    >
                      {t("Duplicate", "تکثیر")}
                    </button>
                    <button
                      onClick={() =>
                        action(async () => {
                          await storage.remove(r.id);
                          await refresh();
                        })
                      }
                    >
                      {t("Delete", "حذف")}
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
        <section className="export-strip">
          <div>
            <h3>{t("Take the evidence with you.", "شواهد را همراه ببرید.")}</h3>
            <p>
              {t(
                "Real measurements. Reproducible configurations.",
                "اندازه‌گیری واقعی. پیکربندی بازتولیدپذیر.",
              )}
            </p>
          </div>
          <div>
            <label className="check">
              <input
                type="checkbox"
                checked={includeTrace}
                onChange={(e) => Include(e.target.checked)}
              />
              {t("Include full trace in JSON", "رد کامل در JSON")}
            </label>
            <div className="toolbar">
              <button
                disabled={!records.length}
                onClick={() =>
                  action(async () =>
                    download(
                      csv(records),
                      "search-metrics.csv",
                      "text/csv;charset=utf-8",
                    ),
                  )
                }
              >
                CSV
              </button>
              <button
                disabled={!current}
                onClick={() =>
                  action(async () =>
                    download(
                      JSON.stringify(
                        jsonRecord(current!, includeTrace),
                        null,
                        2,
                      ),
                      "experiment.json",
                      "application/json",
                    ),
                  )
                }
              >
                JSON
              </button>
              <button
                disabled={!records.length}
                onClick={() => action(() => pdf(records, language))}
              >
                PDF
              </button>
            </div>
          </div>
        </section>
      </main>
      <footer>
        {t("Search Laboratory", "آزمایشگاه جست‌وجو")}{" "}
        <span>
          01 /{" "}
          {t(
            "Built for curiosity. Grounded in evidence.",
            "برای کنجکاوی. بر پایه شواهد.",
          )}
        </span>
      </footer>
    </>
  );
}
