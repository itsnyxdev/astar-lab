import { useEffect, useState } from "react";
import type {
  Environment,
  ExperimentConfig,
  Graph,
  Maze,
} from "../engine/types";
import {
  generateGraph,
  generateMaze,
  shufflePuzzle,
  preset,
  reachable,
  validateEnvironment,
  validateHeuristic,
  order,
} from "../environments";
import { useText } from "../i18n";
export type MazeTool =
  "inspect" | "wall" | "erase" | "start" | "goal" | "select";
export function editCell(e: Maze, id: number, tool: MazeTool): Maze {
  if (tool === "start" || tool === "goal")
    return { ...e, [tool]: id, walls: e.walls.filter((n) => n !== id) };
  if (tool === "wall" && id !== e.start && id !== e.goal)
    return { ...e, walls: [...new Set([...e.walls, id])] };
  if (tool === "erase") return { ...e, walls: e.walls.filter((n) => n !== id) };
  return e;
}
export function Editor({
  config,
  change,
  tool,
  setTool,
  onError,
  inspect,
}: {
  config: ExperimentConfig;
  change: (c: ExperimentConfig) => void;
  tool: MazeTool;
  setTool: (t: MazeTool) => void;
  onError: (code: string) => void;
  inspect?: (state: number) => void;
}) {
  const { t, n, language } = useText(),
    e = config.environment;
  const [density, setDensity] = useState(0.28),
    [strategy, setStrategy] = useState<"obstacles" | "perfect">("obstacles"),
    [selected, setSelected] = useState<number[]>([]),
    [message, setMessage] = useState("");
  const [gridOpen, GridOpen] = useState(false);
  useEffect(() => setMessage(""), [language]);
  const update = (environment: Environment) => {
    try {
      validateEnvironment(environment);
      change({ ...config, environment });
      setMessage("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "invalid");
    }
  };
  const generate = () => {
    try {
      update(
        e.kind === "maze"
          ? generateMaze(e, config.seed, strategy, density)
          : e.kind === "puzzle"
            ? shufflePuzzle(e, config.seed, config.shuffleMoves)
            : generateGraph(config.seed),
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : "invalid");
    }
  };
  return (
    <section className="editor">
      <div className="section-title">
        <h3>{t("Problem editor", "ویرایش مسئله")}</h3>
        <button onClick={() => update(preset(e.kind))}>
          {t("Restore preset", "بازیابی پیش‌فرض")}
        </button>
      </div>
      <div className="form-grid">
        <label>
          {t("Seed", "بذر")}
          <input
            value={config.seed}
            onChange={(x) => change({ ...config, seed: x.target.value })}
          />
        </label>
        {e.kind === "maze" && (
          <>
            <label>
              {t("Rows", "ردیف")}
              <input
                type="number"
                min="2"
                max="100"
                value={e.rows}
                onChange={(x) => {
                  const rows = Number(x.target.value);
                  update({
                    ...e,
                    rows,
                    walls: e.walls.filter((i) => i < rows * e.cols),
                    start: 0,
                    goal: rows * e.cols - 1,
                  });
                }}
              />
            </label>
            <label>
              {t("Columns", "ستون")}
              <input
                type="number"
                min="2"
                max="100"
                value={e.cols}
                onChange={(x) => {
                  const cols = Number(x.target.value);
                  update({
                    ...e,
                    cols,
                    walls: [],
                    start: 0,
                    goal: e.rows * cols - 1,
                  });
                }}
              />
            </label>
            <label>
              {t("Generator", "روش تولید")}
              <select
                value={strategy}
                onChange={(x) => setStrategy(x.target.value as typeof strategy)}
              >
                <option value="obstacles">
                  {t("Random obstacles", "موانع تصادفی")}
                </option>
                <option value="perfect">
                  {t(
                    "Perfect maze (odd dimensions)",
                    "هزارتوی کامل (ابعاد فرد)",
                  )}
                </option>
              </select>
            </label>
            {strategy === "obstacles" && (
              <label>
                {t("Obstacle density", "تراکم موانع")}
                <input
                  type="range"
                  min="0"
                  max=".65"
                  step=".01"
                  value={density}
                  onChange={(x) => setDensity(Number(x.target.value))}
                />
                {n(density * 100)}%
              </label>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={e.diagonal}
                onChange={(x) => update({ ...e, diagonal: x.target.checked })}
              />
              {t(
                "Diagonal movement, no corner cutting",
                "حرکت قطری بدون عبور از گوشه",
              )}
            </label>
          </>
        )}
        {e.kind === "puzzle" && (
          <label>
            {t("Shuffle moves", "تعداد حرکات درهم‌ریزی")}
            <input
              type="number"
              min="0"
              max="10000"
              value={config.shuffleMoves}
              onChange={(x) =>
                change({ ...config, shuffleMoves: Number(x.target.value) })
              }
            />
          </label>
        )}
      </div>
      <div className="toolbar">
        <button onClick={generate}>
          {t("Generate from seed", "تولید با بذر")}
        </button>
        {e.kind === "maze" && (
          <>
            <button onClick={() => update({ ...e, walls: [] })}>
              {t("Clear walls", "حذف موانع")}
            </button>
            <button
              onClick={() =>
                setMessage(
                  reachable(e)
                    ? t("Goal is reachable.", "هدف دست‌یافتنی است.")
                    : t("No path exists.", "مسیری وجود ندارد."),
                )
              }
            >
              {t("Check reachability", "بررسی دسترسی")}
            </button>
          </>
        )}
      </div>
      {e.kind !== "graph" && (
        <label>
          {t("Neighbor order", "ترتیب همسایه‌ها")}
          <select
            value={e.order.join(",")}
            onChange={(x) =>
              update({ ...e, order: x.target.value.split(",") as typeof order })
            }
          >
            {[
              [...order],
              ["right", "down", "left", "up"],
              ["up", "left", "down", "right"],
              ["left", "right", "up", "down"],
            ].map((ds) => (
              <option key={ds.join()} value={ds.join()}>
                {ds
                  .map((d) =>
                    t(
                      d,
                      (
                        {
                          down: "پایین",
                          up: "بالا",
                          right: "راست",
                          left: "چپ",
                        } as Record<string, string>
                      )[d],
                    ),
                  )
                  .join(" ← ")}
              </option>
            ))}
          </select>
        </label>
      )}
      {e.kind === "maze" && (
        <>
          <div className="toolbar">
            {(
              ["inspect", "wall", "erase", "start", "goal", "select"] as const
            ).map((v, i) => (
              <button
                key={v}
                aria-pressed={tool === v}
                onClick={() => setTool(v)}
              >
                {t(
                  ["Inspect", "Draw walls", "Erase", "Start", "Goal", "Select"][
                    i
                  ],
                  ["بازرسی", "رسم مانع", "پاک‌کن", "شروع", "هدف", "انتخاب"][i],
                )}
              </button>
            ))}
          </div>
          <details onToggle={(event) => GridOpen(event.currentTarget.open)}>
            <summary>
              {t(
                "Keyboard-accessible grid editor",
                "ویرایشگر شبکه با صفحه‌کلید",
              )}
            </summary>
            <div
              className="grid-editor"
              style={{
                gridTemplateColumns: `repeat(${e.cols},minmax(26px,1fr))`,
              }}
            >
              {gridOpen &&
                Array.from({ length: e.rows * e.cols }, (_, i) => (
                  <button
                    key={i}
                    className={
                      e.walls.includes(i)
                        ? "wall"
                        : selected.includes(i)
                          ? "selected"
                          : ""
                    }
                    aria-label={`${t("Cell", "خانه")} ${n(Math.floor(i / e.cols))}, ${n(i % e.cols)}`}
                    aria-pressed={selected.includes(i)}
                    onClick={() =>
                      tool === "select"
                        ? setSelected((s) =>
                            s.includes(i)
                              ? s.filter((x) => x !== i)
                              : [...s, i],
                          )
                        : tool === "inspect"
                          ? inspect?.(i)
                          : update(editCell(e, i, tool))
                    }
                  >
                    {i === e.start
                      ? "S"
                      : i === e.goal
                        ? "G"
                        : e.walls.includes(i)
                          ? "■"
                          : "·"}
                  </button>
                ))}
            </div>
            <div className="toolbar">
              <button
                onClick={() => {
                  update({
                    ...e,
                    walls: [
                      ...new Set([
                        ...e.walls,
                        ...selected.filter(
                          (i) => i !== e.start && i !== e.goal,
                        ),
                      ]),
                    ],
                  });
                  setSelected([]);
                }}
              >
                {t("Block selection", "مسدود کردن انتخاب")}
              </button>
              <button
                onClick={() => {
                  update({
                    ...e,
                    walls: e.walls.filter((i) => !selected.includes(i)),
                  });
                  setSelected([]);
                }}
              >
                {t("Clear selection", "پاک کردن انتخاب")}
              </button>
            </div>
          </details>
        </>
      )}
      {e.kind === "puzzle" && (
        <>
          <p className="muted">
            {t(
              "Click a neighboring tile to move the blank. Shuffle depth is not optimal solution length.",
              "برای حرکت خانه خالی روی کاشی مجاور کلیک کنید. تعداد درهم‌ریزی طول مسیر بهینه نیست.",
            )}
          </p>
          <div className="puzzle-edit">
            {e.start.map((tile, i) => (
              <button
                key={i}
                disabled={tile === 0}
                onClick={() => {
                  const j = e.start.indexOf(0);
                  if (
                    Math.abs(Math.floor(i / 3) - Math.floor(j / 3)) +
                      Math.abs((i % 3) - (j % 3)) !==
                    1
                  )
                    return;
                  const start = [...e.start];
                  [start[i], start[j]] = [start[j], start[i]];
                  update({ ...e, start });
                }}
              >
                {tile ? n(tile) : "·"}
              </button>
            ))}
          </div>
          <PuzzleInputs
            key={JSON.stringify(e)}
            environment={e}
            update={update}
          />
        </>
      )}
      {e.kind === "graph" && (
        <GraphEditor environment={e} update={update} message={setMessage} />
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
function PuzzleInputs({
  environment: e,
  update,
}: {
  environment: Extract<Environment, { kind: "puzzle" }>;
  update: (e: Environment) => void;
}) {
  const { t } = useText();
  const [start, S] = useState(e.start.join(" ")),
    [goal, G] = useState(e.goal.join(" "));
  return (
    <div className="form-grid">
      <label>
        {t("Start tiles (0 = blank)", "کاشی‌های شروع (۰ = خالی)")}
        <input dir="ltr" value={start} onChange={(x) => S(x.target.value)} />
      </label>
      <label>
        {t("Goal tiles", "کاشی‌های هدف")}
        <input dir="ltr" value={goal} onChange={(x) => G(x.target.value)} />
      </label>
      <button
        onClick={() =>
          update({
            ...e,
            start: start.trim().split(/[ ,]+/).map(Number),
            goal: goal.trim().split(/[ ,]+/).map(Number),
          })
        }
      >
        {t("Apply boards", "اعمال صفحه‌ها")}
      </button>
    </div>
  );
}
function GraphEditor({
  environment: e,
  update,
  message,
}: {
  environment: Graph;
  update: (e: Environment) => void;
  message: (m: string) => void;
}) {
  const { t, n } = useText(),
    [from, F] = useState(e.start),
    [to, T] = useState(e.goal),
    [cost, C] = useState(1);
  return (
    <>
      <div className="form-grid">
        <label>
          {t("Start", "شروع")}
          <select
            value={e.start}
            onChange={(x) => update({ ...e, start: x.target.value })}
          >
            {e.nodes.map((n) => (
              <option key={n.id}>{n.id}</option>
            ))}
          </select>
        </label>
        <label>
          {t("Goal", "هدف")}
          <select
            value={e.goal}
            onChange={(x) => update({ ...e, goal: x.target.value })}
          >
            {e.nodes.map((n) => (
              <option key={n.id}>{n.id}</option>
            ))}
          </select>
        </label>
        <label>
          {t("Heuristic", "تابع تخمین")}
          <select
            value={e.heuristic}
            onChange={(x) =>
              update({ ...e, heuristic: x.target.value as Graph["heuristic"] })
            }
          >
            {(["zero", "euclidean", "manhattan", "custom"] as const).map(
              (v, i) => (
                <option value={v} key={v}>
                  {t(
                    ["Zero", "Euclidean", "Manhattan", "Node values"][i],
                    ["صفر", "اقلیدسی", "منهتن", "مقادیر گره"][i],
                  )}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={e.directed}
            onChange={(x) => update({ ...e, directed: x.target.checked })}
          />
          {t("Directed", "جهت‌دار")}
        </label>
      </div>
      <div className="toolbar">
        <button
          onClick={() => {
            let i = e.nodes.length + 1;
            while (e.nodes.some((n) => n.id === String(i))) i++;
            update({
              ...e,
              nodes: [...e.nodes, { id: String(i), x: 0, y: 0, h: 0 }],
            });
          }}
        >
          {t("Add node", "افزودن گره")}
        </button>
        <button
          onClick={() => {
            const v = validateHeuristic(e);
            message(
              `${t("Admissible", "مجاز")}: ${v.admissible ? t("Yes", "بله") : t("No", "خیر")} · ${t("Consistent", "سازگار")}: ${v.consistent ? t("Yes", "بله") : t("No", "خیر")}`,
            );
          }}
        >
          {t("Validate heuristic", "اعتبارسنجی تخمین")}
        </button>
      </div>
      <details>
        <summary>
          {t("Nodes and positions", "گره‌ها و موقعیت‌ها")} ({n(e.nodes.length)})
        </summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Node", "گره")}</th>
                <th>x</th>
                <th>y</th>
                <th>h</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {e.nodes.map((node, i) => (
                <tr key={node.id}>
                  <td>{node.id}</td>
                  {(["x", "y", "h"] as const).map((k) => (
                    <td key={k}>
                      <input
                        aria-label={`${node.id} ${k}`}
                        type="number"
                        value={node[k]}
                        onChange={(x) =>
                          update({
                            ...e,
                            nodes: e.nodes.map((v, j) =>
                              j === i
                                ? { ...v, [k]: Number(x.target.value) }
                                : v,
                            ),
                          })
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      disabled={e.nodes.length === 1}
                      onClick={() => {
                        const nodes = e.nodes.filter((v) => v.id !== node.id);
                        update({
                          ...e,
                          nodes,
                          edges: e.edges.filter(
                            (a) => a.from !== node.id && a.to !== node.id,
                          ),
                          start: e.start === node.id ? nodes[0].id : e.start,
                          goal: e.goal === node.id ? nodes[0].id : e.goal,
                        });
                      }}
                    >
                      {t("Delete", "حذف")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details>
        <summary>
          {t("Edges and costs", "یال‌ها و هزینه‌ها")} ({n(e.edges.length)})
        </summary>
        <div className="form-grid">
          <label>
            {t("From", "از")}
            <select value={from} onChange={(x) => F(x.target.value)}>
              {e.nodes.map((n) => (
                <option key={n.id}>{n.id}</option>
              ))}
            </select>
          </label>
          <label>
            {t("To", "به")}
            <select value={to} onChange={(x) => T(x.target.value)}>
              {e.nodes.map((n) => (
                <option key={n.id}>{n.id}</option>
              ))}
            </select>
          </label>
          <label>
            {t("Cost", "هزینه")}
            <input
              type="number"
              min="0"
              value={cost}
              onChange={(x) => C(Number(x.target.value))}
            />
          </label>
          <button
            onClick={() =>
              update({ ...e, edges: [...e.edges, { from, to, cost }] })
            }
          >
            {t("Add edge", "افزودن یال")}
          </button>
        </div>
        {e.edges.map((a, i) => (
          <div className="edge-row" key={i}>
            <span dir="ltr">
              {a.from} {e.directed ? "→" : "↔"} {a.to}
            </span>
            <input
              aria-label={`${t("Cost", "هزینه")} ${a.from} ${a.to}`}
              type="number"
              min="0"
              value={a.cost}
              onChange={(x) =>
                update({
                  ...e,
                  edges: e.edges.map((a, j) =>
                    j === i ? { ...a, cost: Number(x.target.value) } : a,
                  ),
                })
              }
            />
            <button
              onClick={() =>
                update({ ...e, edges: e.edges.filter((_, j) => j !== i) })
              }
            >
              {t("Delete", "حذف")}
            </button>
          </div>
        ))}
      </details>
    </>
  );
}
