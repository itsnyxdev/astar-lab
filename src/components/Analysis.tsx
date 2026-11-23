import { useMemo, useState } from "react";
import type {
  Algorithm,
  ExperimentRecord,
  SearchResult,
} from "../engine/types";
import { Timeline } from "../playback";
import { useText, eventName, algorithmNames } from "../i18n";
import { reportMatch, comparable } from "../analytics";
import { validateHeuristic } from "../environments";
export function Metrics({ result: r }: { result: SearchResult }) {
  const { t, n } = useText();
  return (
    <div className="metrics">
      {[
        [t("Path cost", "هزینه مسیر"), r.pathCost],
        [t("Expanded", "گسترش‌یافته"), r.expandedNodes],
        [t("Generated", "تولیدشده"), r.generatedNodes],
        [t("Peak frontier", "بیشینه مرز"), r.maxFrontierSize],
      ].map(([label, value]) => (
        <div key={String(label)}>
          <small>{label}</small>
          <strong>{value === null ? "—" : n(Number(value))}</strong>
        </div>
      ))}
    </div>
  );
}
export function Analysis({ records }: { records: ExperimentRecord[] }) {
  const { t, n, language } = useText();
  const [metric, M] = useState<
    "expandedNodes" | "generatedNodes" | "maxFrontierSize" | "pathCost"
  >("expandedNodes");
  const max = Math.max(1, ...records.map((r) => r.result[metric] ?? 0));
  const eligible = records.filter((r) => r.result.found),
    a = eligible.find((r) => r.config.algorithm === "astar"),
    d = eligible.find((r) => r.config.algorithm === "dijkstra"),
    g = eligible.find((r) => r.config.algorithm === "greedy");
  return (
    <section>
      <div className="section-title">
        <h2>{t("Evidence, not assumptions", "شواهد، نه فرض‌ها")}</h2>
        <select
          aria-label={t("Chart metric", "معیار نمودار")}
          value={metric}
          onChange={(e) => M(e.target.value as typeof metric)}
        >
          {(
            [
              "expandedNodes",
              "generatedNodes",
              "maxFrontierSize",
              "pathCost",
            ] as const
          ).map((v, i) => (
            <option key={v} value={v}>
              {t(
                ["Expanded", "Generated", "Peak frontier", "Path cost"][i],
                ["گسترش‌یافته", "تولیدشده", "بیشینه مرز", "هزینه مسیر"][i],
              )}
            </option>
          ))}
        </select>
      </div>
      {!records.length ? (
        <p className="empty">
          {t(
            "Run an experiment to see measured results.",
            "برای دیدن نتایج واقعی یک آزمایش اجرا کنید.",
          )}
        </p>
      ) : (
        <>
          <div className="comparison-chart">
            {records.map((r) => (
              <div className="bar-row" key={r.id}>
                <span>{algorithmNames[r.config.algorithm]}</span>
                <div>
                  <i
                    style={{
                      width: `${((r.result[metric] ?? 0) / max) * 100}%`,
                    }}
                  />
                </div>
                <b>{r.result[metric] === null ? "—" : n(r.result[metric]!)}</b>
              </div>
            ))}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    t("Algorithm", "الگوریتم"),
                    t("Status", "وضعیت"),
                    t("Cost", "هزینه"),
                    t("Expanded", "گسترش"),
                    t("Generated", "تولید"),
                    t("Peak frontier", "بیشینه مرز"),
                    t("Optimality", "بهینگی"),
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const c = r.config,
                    e = c.environment,
                    valid =
                      c.zeroHeuristic ||
                      e.kind !== "graph" ||
                      validateHeuristic(e).admissible,
                    guaranteed =
                      ["dijkstra"].includes(c.algorithm) ||
                      (["astar", "ida"].includes(c.algorithm) && valid) ||
                      (c.algorithm === "bfs" &&
                        (e.kind === "puzzle" ||
                          (e.kind === "maze" && !e.diagonal) ||
                          (e.kind === "graph" &&
                            e.edges.every((a) => a.cost === 1))));
                  return (
                    <tr key={r.id}>
                      <td>
                        {algorithmNames[c.algorithm]}{" "}
                        {reportMatch(c, r.result) && (
                          <span className="badge">
                            {t("Matches report", "مطابق گزارش")}
                          </span>
                        )}
                      </td>
                      <td>
                        {eventName(
                          r.result.terminationReason,
                          language === "fa",
                        )}
                      </td>
                      <td>
                        {r.result.pathCost === null
                          ? "—"
                          : n(r.result.pathCost)}
                      </td>
                      <td>{n(r.result.expandedNodes)}</td>
                      <td>{n(r.result.generatedNodes)}</td>
                      <td>
                        {n(r.result.maxFrontierSize)}
                        {c.algorithm === "ida" ? " †" : ""}
                      </td>
                      <td>
                        {!r.result.found
                          ? t("Incomplete / no solution", "ناقص / بدون پاسخ")
                          : guaranteed
                            ? t(
                                "Guaranteed for these conditions",
                                "تضمین‌شده با این شرایط",
                              )
                            : t("Not guaranteed", "تضمین نمی‌شود")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="findings">
            {a &&
              d &&
              comparable(a.config, d.config) &&
              a.result.expandedNodes > 0 && (
                <p>
                  {t(
                    "For this problem, Dijkstra/A* expansion ratio:",
                    "در این مسئله، نسبت گسترش دایکسترا به A*:",
                  )}{" "}
                  <b>{n(d.result.expandedNodes / a.result.expandedNodes)}</b>.{" "}
                  {a.result.pathCost === d.result.pathCost
                    ? t(
                        "Both found the same path cost.",
                        "هر دو هزینه مسیر یکسانی یافتند.",
                      )
                    : t(
                        "Their path costs differ.",
                        "هزینه مسیرهای آن‌ها متفاوت است.",
                      )}
                </p>
              )}
            {a && g && comparable(a.config, g.config) && (
              <p>
                {t(
                  "Observed Greedy minus A* path cost:",
                  "اختلاف مشاهده‌شده هزینه حریصانه با A*:",
                )}{" "}
                {n(g.result.pathCost! - a.result.pathCost!)}.
              </p>
            )}
            <p>
              {t(
                "† IDA* frontier measures active path stack. Memory is a structural estimate, not browser heap usage. Timing is hardware-dependent and is not used for ranking.",
                "† مرز IDA* اندازه پشته مسیر فعال است. حافظه برآورد ساختاری است، نه مصرف واقعی مرورگر. زمان وابسته به سخت‌افزار است و برای رتبه‌بندی استفاده نمی‌شود.",
              )}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
export function History({
  result: r,
  index,
  jump,
  algorithm,
}: {
  result: SearchResult;
  index: number;
  jump: (n: number) => void;
  algorithm: Algorithm;
}) {
  const { t, n, language } = useText(),
    [filter, F] = useState(""),
    [query, Q] = useState(""),
    [page, P] = useState(0);
  const filtered = useMemo(
    () =>
      r.events.filter(
        (e) =>
          (!filter || e.type === filter) &&
          (!query ||
            JSON.stringify(
              r.states[r.occurrences[e.occurrence].stateId],
            ).includes(query)),
      ),
    [r, filter, query],
  );
  const event = r.events[index],
    o = event ? r.occurrences[event.occurrence] : null;
  const candidates = useMemo(
    () =>
      event?.type === "pop" ? [...new Timeline(r).at(index - 1).frontier] : [],
    [r, index, event],
  );
  const scored = !["bfs", "dfs"].includes(algorithm);
  return (
    <section>
      <div className="section-title">
        <h2>{t("Execution history", "تاریخچه اجرا")}</h2>
        <span>
          {n(filtered.length)} {t("events", "رویداد")}
        </span>
      </div>
      <div className="form-grid">
        <label>
          {t("Event type", "نوع رویداد")}
          <select
            value={filter}
            onChange={(e) => {
              F(e.target.value);
              P(0);
            }}
          >
            <option value="">{t("All events", "همه رویدادها")}</option>
            {[...new Set(r.events.map((e) => e.type))].map((v) => (
              <option key={v} value={v}>
                {eventName(v, language === "fa")}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Find state", "یافتن حالت")}
          <input
            value={query}
            onChange={(e) => {
              Q(e.target.value);
              P(0);
            }}
          />
        </label>
      </div>
      {event && o && (
        <div className="inspector">
          <b>
            {eventName(event.type, language === "fa")} · {n(event.index)}
          </b>
          <code dir="ltr">{JSON.stringify(r.states[o.stateId])}</code>
          <p dir="ltr">
            g = {n(o.g)} · h = {scored ? n(o.h) : "—"} · f ={" "}
            {scored ? n(o.priority) : "—"} · {t("depth", "عمق")} = {n(o.depth)}
          </p>
          <p>
            {algorithm === "bfs"
              ? t(
                  "FIFO selects the earliest queued occurrence; h and f do not select nodes.",
                  "صف، قدیمی‌ترین رخداد در انتظار را انتخاب می‌کند؛ h و f در انتخاب نقشی ندارند.",
                )
              : algorithm === "dfs"
                ? t(
                    "LIFO selects the most recently stacked occurrence; h and f do not select nodes.",
                    "پشته آخرین رخداد افزوده‌شده را انتخاب می‌کند؛ h و f در انتخاب نقشی ندارند.",
                  )
                : algorithm === "ida"
                  ? t(
                      "Depth-first traversal admits g+h within the current threshold, with current-path cycle checks.",
                      "پیمایش عمقی g+h را در آستانه جاری با بررسی چرخه مسیر می‌پذیرد.",
                    )
                  : t(
                      `Selection priority: ${algorithm === "astar" ? "g+h" : algorithm === "dijkstra" ? "g" : "h"}. Equal priorities use the earlier insertion counter.`,
                      `اولویت انتخاب: ${algorithm === "astar" ? "g+h" : algorithm === "dijkstra" ? "g" : "h"}. در تساوی، شمارنده درج زودتر انتخاب می‌شود.`,
                    )}
          </p>
          {event.targetStateId !== undefined && (
            <p>
              {t("Rejected candidate", "نامزد ردشده")}:{" "}
              <code>{JSON.stringify(r.states[event.targetStateId])}</code> · g ={" "}
              {n(event.candidateG ?? 0)} ·{" "}
              {eventName(event.reason ?? "", language === "fa")}
            </p>
          )}
          {event.threshold !== undefined && (
            <p>
              {t("Threshold", "آستانه")}: {n(event.threshold)}
            </p>
          )}
          {!!candidates.length && (
            <p>
              {t(
                "Frontier before selection (occurrence IDs)",
                "مرز پیش از انتخاب (شناسه رخدادها)",
              )}
              : {candidates.slice(0, 20).map(n).join(" · ")}{" "}
              {candidates.length > 20 ? `+${n(candidates.length - 20)}` : ""}
            </p>
          )}
          <p>
            {t("Frontier", "مرز")}: {n(event.frontier)} ·{" "}
            {t("Iteration", "تکرار")}: {n(o.iteration)}{" "}
            {event.reason && ` · ${eventName(event.reason, language === "fa")}`}
          </p>
          {o.parent !== null && (
            <button
              onClick={() =>
                jump(r.events.findIndex((e) => e.occurrence === o.parent))
              }
            >
              {t("Inspect parent", "بازرسی والد")}
            </button>
          )}
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>{t("Event", "رویداد")}</th>
              <th>{t("State", "حالت")}</th>
              <th>g</th>
              <th>h</th>
              <th>f</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(page * 60, (page + 1) * 60).map((e) => {
              const o = r.occurrences[e.occurrence];
              return (
                <tr
                  key={e.index}
                  className={e.index === index ? "active-row" : ""}
                >
                  <td>
                    <button onClick={() => jump(e.index)}>{n(e.index)}</button>
                  </td>
                  <td>{eventName(e.type, language === "fa")}</td>
                  <td>
                    <code>{JSON.stringify(r.states[o.stateId])}</code>
                  </td>
                  <td>{n(o.g)}</td>
                  <td>{scored ? n(o.h) : "—"}</td>
                  <td>{scored ? n(o.priority) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button disabled={page === 0} onClick={() => P((p) => p - 1)}>
          {t("Previous page", "صفحه قبل")}
        </button>
        <span>
          {n(page + 1)} / {n(Math.max(1, Math.ceil(filtered.length / 60)))}
        </span>
        <button
          disabled={(page + 1) * 60 >= filtered.length}
          onClick={() => P((p) => p + 1)}
        >
          {t("Next page", "صفحه بعد")}
        </button>
      </div>
    </section>
  );
}
export function SearchTree({
  result: r,
  index,
  jump,
}: {
  result: SearchResult;
  index: number;
  jump: (n: number) => void;
}) {
  const { t, n } = useText(),
    [depth, D] = useState(4),
    [budget, B] = useState(500),
    [collapsed, C] = useState(new Set<number>()),
    [zoom, Z] = useState(1),
    [query, Q] = useState("");
  const first = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of r.events)
      if (!m.has(e.occurrence)) m.set(e.occurrence, e.index);
    return m;
  }, [r]);
  const visible = useMemo(() => {
    const hidden = new Set<number>();
    return r.occurrences
      .filter((o) => {
        if (
          o.parent !== null &&
          (collapsed.has(o.parent) || hidden.has(o.parent))
        )
          hidden.add(o.id);
        return (
          (first.get(o.id) ?? Infinity) <= index &&
          !hidden.has(o.id) &&
          o.depth <= depth &&
          (!query || JSON.stringify(r.states[o.stateId]).includes(query))
        );
      })
      .slice(0, budget);
  }, [r, index, collapsed, depth, budget, query, first]);
  const positions = new Map<number, [number, number]>(),
    levels = new Map<number, number>();
  for (const o of visible) {
    const x = levels.get(o.depth) ?? 0;
    positions.set(o.id, [60 + x * 100, 45 + o.depth * 95]);
    levels.set(o.depth, x + 1);
  }
  const width = Math.max(600, ...[...levels.values()].map((v) => v * 100 + 60)),
    height = (Math.max(0, ...visible.map((o) => o.depth)) + 1) * 95 + 40;
  return (
    <section>
      <h2>{t("Search occurrences", "رخدادهای درخت جست‌وجو")}</h2>
      <div className="form-grid">
        <label>
          {t("Visible depth", "عمق نمایان")}
          <input
            type="number"
            min="0"
            max="100"
            value={depth}
            onChange={(e) =>
              D(Math.min(100, Math.max(0, Number(e.target.value))))
            }
          />
        </label>
        <label>
          {t("Node budget", "سقف گره‌های نمایان")}
          <input
            type="number"
            min="10"
            max="2000"
            value={budget}
            onChange={(e) =>
              B(Math.max(10, Math.min(2000, Number(e.target.value))))
            }
          />
        </label>
        <label>
          {t("Zoom", "بزرگ‌نمایی")}
          <input
            type="range"
            min=".3"
            max="2"
            step=".1"
            value={zoom}
            onChange={(e) => Z(Number(e.target.value))}
          />
        </label>
        <label>
          {t("Find state", "یافتن حالت")}
          <input value={query} onChange={(e) => Q(e.target.value)} />
        </label>
      </div>
      <p className="muted">
        {n(visible.length)} / {n(r.occurrences.length)} ·{" "}
        {t(
          "Other occurrences are hidden or not reached in playback. Select a node to inspect; double-click to collapse. Scroll to pan.",
          "بقیه رخدادها پنهان‌اند یا هنوز در بازپخش نرسیده‌اند. انتخاب برای بازرسی؛ دوبار کلیک برای جمع کردن؛ پیمایش برای جابه‌جایی.",
        )}
      </p>
      {r.events[index] &&
        (() => {
          const o = r.occurrences[r.events[index].occurrence];
          return (
            <div className="inspector">
              <b>
                {t("Selected occurrence", "رخداد انتخاب‌شده")}: {n(o.id)}
              </b>
              <code>{JSON.stringify(r.states[o.stateId])}</code>
              <p dir="ltr">
                g={n(o.g)} · h={n(o.h)} · {t("Depth", "عمق")}={n(o.depth)} ·{" "}
                {t("Iteration", "تکرار")}={n(o.iteration)}
              </p>
              <p>
                {t("Expansion event", "رویداد گسترش")}:{" "}
                {(() => {
                  const event = r.events.find(
                    (e) =>
                      e.occurrence === o.id &&
                      e.type === "expand" &&
                      e.index <= index,
                  );
                  return event
                    ? n(event.index)
                    : t(
                        "Not expanded at this point",
                        "در این نقطه گسترش نیافته",
                      );
                })()}
              </p>
              {o.parent !== null && (
                <button onClick={() => jump(first.get(o.parent!) ?? 0)}>
                  {t("Inspect parent", "بازرسی والد")}
                </button>
              )}
              <button
                aria-pressed={collapsed.has(o.id)}
                onClick={() =>
                  C((s) => {
                    const next = new Set(s);
                    next.has(o.id) ? next.delete(o.id) : next.add(o.id);
                    return next;
                  })
                }
              >
                {t("Collapse / expand subtree", "جمع / باز کردن زیردرخت")}
              </button>
            </div>
          );
        })()}
      <div className="tree-scroll">
        <svg
          width={width * zoom}
          height={height * zoom}
          role="img"
          aria-label={t("Recorded search tree", "درخت ثبت‌شده جست‌وجو")}
        >
          <g transform={`scale(${zoom})`}>
            {visible.map((o) => {
              const a = positions.get(o.id)!,
                b = o.parent === null ? null : positions.get(o.parent);
              return b ? (
                <line
                  key={`l${o.id}`}
                  x1={a[0]}
                  y1={a[1]}
                  x2={b[0]}
                  y2={b[1]}
                  stroke="#b9b0a2"
                />
              ) : null;
            })}
            {visible.map((o) => {
              const [x, y] = positions.get(o.id)!;
              return (
                <g
                  key={o.id}
                  transform={`translate(${x},${y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${t("Occurrence", "رخداد")} ${o.id}`}
                  onClick={() => jump(first.get(o.id) ?? 0)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") jump(first.get(o.id) ?? 0);
                    if (e.key === " ")
                      C((s) => {
                        const next = new Set(s);
                        next.has(o.id) ? next.delete(o.id) : next.add(o.id);
                        return next;
                      });
                  }}
                  onDoubleClick={() =>
                    C((s) => {
                      const next = new Set(s);
                      next.has(o.id) ? next.delete(o.id) : next.add(o.id);
                      return next;
                    })
                  }
                >
                  <circle
                    r="22"
                    fill={
                      r.pathOccurrences.includes(o.id) &&
                      r.events[index]?.type === "terminate"
                        ? "#cc785c"
                        : collapsed.has(o.id)
                          ? "#5db8a6"
                          : "#efe9de"
                    }
                    stroke="#8e8b82"
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="12"
                    fill="#252523"
                  >
                    {n(o.id)}
                  </text>
                  <text textAnchor="middle" y="38" fontSize="10" fill="#6c6a64">
                    g:{n(o.g)} h:{n(o.h)} i:{n(o.iteration)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
}
