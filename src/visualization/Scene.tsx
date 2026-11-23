import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import {
  CanvasTexture,
  Color,
  InstancedMesh,
  Object3D,
  Vector3,
  type Mesh,
} from "three";
import type { Environment, SearchTrace, State } from "../engine/types";
import type { Playback } from "../playback";
import type { MazeTool } from "../components/Editor";
import { useText } from "../i18n";
const colors = {
  free: "#e8e0d2",
  wall: "#454640",
  start: "#477c69",
  goal: "#b76d50",
  frontier: "#e8a55a",
  expanded: "#9caaa0",
  current: "#f3d482",
  path: "#cc785c",
};
/** Scene-native labels avoid DOM portals when a WebGL scene is replaced. */
function Label({
  text,
  position,
  scale = 1,
}: {
  text: string;
  position: [number, number, number];
  scale?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#faf9f5";
    ctx.fillRect(0, 0, 256, 80);
    ctx.fillStyle = "#252523";
    ctx.font = "36px Vazirmatn, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 40, 245);
    return new CanvasTexture(canvas);
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite
      position={position}
      scale={[scale, scale * 0.3125, 1]}
      raycast={() => {}}
    >
      <spriteMaterial map={texture} depthTest={false} />
    </sprite>
  );
}
class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function sceneColor(
  s: State,
  e: Environment,
  r: SearchTrace | null,
  p: Playback | null,
) {
  const same = (a: State, b: State) => JSON.stringify(a) === JSON.stringify(b);
  if (same(s, e.start)) return colors.start;
  if (same(s, e.goal)) return colors.goal;
  if (!r || !p) return colors.free;
  const id = r.states.findIndex((v) => same(s, v));
  if (id < 0) return colors.free;
  if (p.path.has(id)) return colors.path;
  if (p.current === id) return colors.current;
  if ([...p.frontier].some((i) => r.occurrences[i].stateId === id))
    return colors.frontier;
  if (p.expanded.has(id)) return colors.expanded;
  return colors.free;
}
type Props = {
  environment: Environment;
  result: SearchTrace | null;
  playback: Playback | null;
  tool: MazeTool;
  onCell: (id: number) => void;
  onSelect: (s: State) => void;
};
export default function Scene(props: Props) {
  const { t } = useText(),
    [cameraKey, setCameraKey] = useState(0),
    [top, setTop] = useState(false),
    [quality, Q] = useState(true);
  const e = props.environment,
    size = e.kind === "maze" ? Math.max(e.rows, e.cols) : 12;
  const fallback = (
    <div className="scene-fallback">
      {t(
        "3D rendering unavailable. The editor, history, and results remain accessible below.",
        "نمایش سه‌بعدی در دسترس نیست. ویرایشگر، تاریخچه و نتایج در پایین در دسترس‌اند.",
      )}
    </div>
  );
  return (
    <div className="scene-wrap">
      <div className="scene-tools">
        <button onClick={() => setCameraKey((k) => k + 1)}>
          {t("Reset camera", "بازنشانی دوربین")}
        </button>
        <button
          aria-pressed={top}
          onClick={() => {
            setTop((v) => !v);
            setCameraKey((k) => k + 1);
          }}
        >
          {t("Top view", "نمای بالا")}
        </button>
        <button aria-pressed={!quality} onClick={() => Q((v) => !v)}>
          {t("Low graphics", "گرافیک سبک")}
        </button>
      </div>
      <Boundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <Canvas
            key={`${cameraKey}-${e.kind}`}
            dpr={quality ? [1, 1.5] : 1}
            camera={{
              position: top
                ? [0, size * 1.4, 0.01]
                : [size * 0.75, size, size * 0.95],
              fov: 45,
            }}
            onCreated={({ gl }) => {
              gl.domElement.setAttribute(
                "aria-label",
                t("Interactive search scene", "صحنه تعاملی جست‌وجو"),
              );
              gl.domElement.setAttribute("role", "img");
            }}
          >
            <color attach="background" args={["#efe9de"]} />
            <ambientLight intensity={1.8} />
            <directionalLight position={[8, 15, 5]} intensity={2.4} />
            {e.kind === "maze" ? (
              <MazeScene {...props} environment={e} />
            ) : e.kind === "puzzle" ? (
              <PuzzleScene {...props} environment={e} />
            ) : (
              <GraphScene {...props} environment={e} />
            )}
            <OrbitControls
              makeDefault
              enableRotate={props.tool === "inspect"}
              maxPolarAngle={Math.PI / 2.05}
            />
            <gridHelper
              args={[
                Math.max(size + 4, 16),
                Math.max(size + 4, 16),
                "#d4c8b7",
                "#e3d9ca",
              ]}
              position={[0, -0.16, 0]}
            />
          </Canvas>
        </Suspense>
      </Boundary>
      <div className="scene-caption">
        {t(
          "Drag to orbit · scroll to zoom · right-drag to pan",
          "کشیدن برای چرخش · پیمایش برای بزرگ‌نمایی · کشیدن راست برای جابه‌جایی",
        )}
      </div>
    </div>
  );
}
function MazeScene({
  environment: e,
  result,
  playback,
  tool,
  onCell,
  onSelect,
}: Props & { environment: Extract<Environment, { kind: "maze" }> }) {
  const tiles = useRef<InstancedMesh>(null),
    walls = useRef<InstancedMesh>(null),
    markers = useRef<InstancedMesh>(null),
    dummy = useMemo(() => new Object3D(), []),
    [hover, H] = useState<number | null>(null);
  const blocked = useMemo(() => new Set(e.walls), [e.walls]);
  const position = (i: number): [number, number, number] => [
    (i % e.cols) - (e.cols - 1) / 2,
    0,
    Math.floor(i / e.cols) - (e.rows - 1) / 2,
  ];
  useEffect(() => {
    if (!tiles.current || !walls.current || !markers.current) return;
    const stateIds = new Map(result?.states.map((s, i) => [s, i]) ?? []),
      frontier = new Set(
        playback && result
          ? [...playback.frontier].map((i) => result.occurrences[i].stateId)
          : [],
      );
    for (let i = 0; i < e.rows * e.cols; i++) {
      dummy.position.set(...position(i));
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      tiles.current.setMatrixAt(i, dummy.matrix);
      const id = stateIds.get(i);
      let color = colors.free;
      if (id !== undefined && playback) {
        if (playback.expanded.has(id)) color = colors.expanded;
        if (frontier.has(id)) color = colors.frontier;
        if (playback.current === id) color = colors.current;
        if (playback.path.has(id)) color = colors.path;
      }
      if (i === e.start) color = colors.start;
      if (i === e.goal) color = colors.goal;
      tiles.current.setColorAt(i, new Color(color));
      const current = id !== undefined && playback?.current === id,
        pending = id !== undefined && frontier.has(id),
        expanded = id !== undefined && playback?.expanded.has(id);
      const size = current ? 0.32 : pending ? 0.22 : expanded ? 0.09 : 0;
      dummy.position.y = 0.13;
      dummy.scale.set(size, 0.04, size);
      dummy.rotation.y = pending ? Math.PI / 4 : 0;
      dummy.updateMatrix();
      markers.current.setMatrixAt(i, dummy.matrix);
    }
    tiles.current.instanceMatrix.needsUpdate = true;
    if (tiles.current.instanceColor)
      tiles.current.instanceColor.needsUpdate = true;
    e.walls.forEach((i, j) => {
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(...position(i));
      dummy.position.y = 0.32;
      dummy.updateMatrix();
      walls.current!.setMatrixAt(j, dummy.matrix);
    });
    walls.current.count = e.walls.length;
    walls.current.instanceMatrix.needsUpdate = true;
    markers.current.instanceMatrix.needsUpdate = true;
  }, [e, result, playback, dummy]);
  return (
    <>
      <instancedMesh
        ref={markers}
        args={[undefined, undefined, e.rows * e.cols]}
        raycast={() => {}}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#454640" />
      </instancedMesh>
      {result && playback && playback.path.size > 1 && (
        <Line
          points={[...playback.path].map((id) => {
            const [x, , z] = position(Number(result.states[id]));
            return [x, 0.18, z] as [number, number, number];
          })}
          color="#7d3d29"
          lineWidth={3}
        />
      )}
      <instancedMesh
        ref={tiles}
        args={[undefined, undefined, e.rows * e.cols]}
        onPointerDown={(x) => {
          if (x.instanceId !== undefined) {
            x.stopPropagation();
            onSelect(x.instanceId);
            if (tool !== "inspect") onCell(x.instanceId);
          }
        }}
        onPointerMove={(x) => {
          if (x.instanceId !== undefined) {
            H(x.instanceId);
            if (x.buttons === 1 && ["wall", "erase"].includes(tool))
              onCell(x.instanceId);
          }
        }}
        onPointerOut={() => H(null)}
      >
        <boxGeometry args={[0.92, 0.16, 0.92]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh
        ref={walls}
        args={[undefined, undefined, e.rows * e.cols]}
        onPointerDown={(x) => {
          if (x.instanceId !== undefined) {
            x.stopPropagation();
            const i = e.walls[x.instanceId];
            onSelect(i);
            if (tool !== "inspect") onCell(i);
          }
        }}
        onPointerMove={(x) => {
          if (x.buttons === 1 && x.instanceId !== undefined && tool === "erase")
            onCell(e.walls[x.instanceId]);
        }}
      >
        <boxGeometry args={[0.88, 0.65, 0.88]} />
        <meshStandardMaterial color={colors.wall} />
      </instancedMesh>
      {[e.start, e.goal].map((i, k) => (
        <group key={k} position={position(i)}>
          <mesh position={[0, 0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.22, 0.3, 32]} />
            <meshBasicMaterial color="#fff9ed" />
          </mesh>
          <Label position={[0, 0.7, 0]} text={k ? "G" : "S"} scale={0.7} />
        </group>
      ))}
      {hover !== null && !blocked.has(hover) && (
        <Label
          position={position(hover)}
          text={`${Math.floor(hover / e.cols)}, ${hover % e.cols}`}
        />
      )}
    </>
  );
}
function Tile({
  number,
  position,
  animate,
  onSelect,
}: {
  number: number;
  position: [number, number, number];
  animate: boolean;
  onSelect: () => void;
}) {
  const { n } = useText();
  const ref = useRef<Mesh>(null);
  const origin = useRef(position),
    target = useMemo(
      () => new Vector3(...position),
      [position[0], position[1], position[2]],
    );
  useFrame((_, dt) => {
    if (ref.current) {
      if (animate) ref.current.position.lerp(target, 1 - Math.exp(-dt * 14));
      else ref.current.position.copy(target);
    }
  });
  return (
    <mesh
      ref={ref}
      position={origin.current}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <boxGeometry args={[0.9, 0.28, 0.9]} />
      <meshStandardMaterial color={colors.free} />
      <Label position={[0, 0.25, 0]} text={n(number)} scale={0.7} />
    </mesh>
  );
}
function PuzzleScene({
  environment: e,
  result,
  playback,
  onSelect,
}: Props & { environment: Extract<Environment, { kind: "puzzle" }> }) {
  const { t, n } = useText();
  const current = (
      playback?.current !== null && playback?.current !== undefined && result
        ? result.states[playback.current]
        : e.start
    ) as number[],
    previous = useRef(current);
  const animate =
    previous.current.filter((v, i) => v !== current[i]).length === 2 &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    previous.current = current;
  }, [current]);
  return (
    <group scale={2}>
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[3.2, 0.2, 3.2]} />
        <meshStandardMaterial color={colors.wall} />
      </mesh>
      {current.filter(Boolean).map((tile) => {
        const i = current.indexOf(tile);
        return (
          <Tile
            key={tile}
            number={tile}
            position={[(i % 3) - 1, 0.1, Math.floor(i / 3) - 1]}
            animate={animate}
            onSelect={() =>
              onSelect(
                `${t("Tile", "کاشی")} ${n(tile)} · ${n(Math.floor(i / 3))}, ${n(i % 3)}`,
              )
            }
          />
        );
      })}
    </group>
  );
}
function GraphScene({
  environment: e,
  result,
  playback,
  onSelect,
}: Props & { environment: Extract<Environment, { kind: "graph" }> }) {
  const { n } = useText();
  const path =
    result && playback
      ? [...playback.path].map((id) => String(result.states[id])).reverse()
      : [];
  return (
    <group>
      {e.edges.map((edge, i) => {
        const a = e.nodes.find((n) => n.id === edge.from)!,
          b = e.nodes.find((n) => n.id === edge.to)!,
          av: [number, number, number] = [a.x, 0.12, a.y],
          bv: [number, number, number] = [b.x, 0.12, b.y];
        return (
          <group key={i}>
            <Line
              points={[av, bv]}
              color={
                path.some(
                  (s, i) =>
                    (s === edge.from && path[i + 1] === edge.to) ||
                    (!e.directed && s === edge.to && path[i + 1] === edge.from),
                )
                  ? "#a9583e"
                  : "#888276"
              }
              lineWidth={
                path.some(
                  (s, i) =>
                    (s === edge.from && path[i + 1] === edge.to) ||
                    (!e.directed && s === edge.to && path[i + 1] === edge.from),
                )
                  ? 4
                  : 1.5
              }
            />
            {i < 100 && (
              <Label
                position={[(a.x + b.x) / 2, 0.18, (a.y + b.y) / 2]}
                text={n(edge.cost)}
                scale={0.7}
              />
            )}
            {e.directed && (
              <mesh
                position={[
                  a.x + (b.x - a.x) * 0.75,
                  0.14,
                  a.y + (b.y - a.y) * 0.75,
                ]}
                rotation={[
                  Math.PI / 2,
                  0,
                  -Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2,
                ]}
              >
                <coneGeometry args={[0.09, 0.25, 8]} />
                <meshStandardMaterial color="#888276" />
              </mesh>
            )}
          </group>
        );
      })}
      {e.nodes.map((node) => (
        <mesh
          key={node.id}
          position={[node.x, 0.2, node.y]}
          onClick={(x) => {
            x.stopPropagation();
            onSelect(node.id);
          }}
        >
          <cylinderGeometry args={[0.35, 0.35, 0.35, 24]} />
          <meshStandardMaterial
            color={sceneColor(node.id, e, result, playback)}
          />
          <Label
            position={[0, 0.55, 0]}
            text={`${node.id}${node.id === e.start ? " · S" : node.id === e.goal ? " · G" : ""} ${{ [colors.current]: "◎", [colors.expanded]: "▪", [colors.frontier]: "◇", [colors.path]: "━" }[sceneColor(node.id, e, result, playback)] ?? ""}`}
          />
        </mesh>
      ))}
    </group>
  );
}
