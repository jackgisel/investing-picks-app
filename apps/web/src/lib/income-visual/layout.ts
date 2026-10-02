import type { FlowLink, FlowNode, IncomeFlow, NodeKind } from "./model";

/**
 * Column layout for the income flow.
 *
 * Not a general Sankey solver: the graph is always the same shape (segments →
 * revenue → gross → operating → net), every link joins adjacent columns, and
 * the vertical order within a column is fixed by `RANK` so profit sits above
 * cost and no two bands ever cross. What is solved is spacing — every node
 * reserves room for its three-line label, and the scale shrinks until the
 * tallest column fits.
 */

export type LayoutOptions = {
  width: number;
  height: number;
  nodeWidth: number;
  /** Room reserved beside the first and last columns for their labels. */
  sideLabelWidth: number;
  /** Vertical room a node reserves for its label block. */
  labelHeight: (node: FlowNode, columnStep: number) => number;
  gap: number;
  /** How far profit lines drift up and cost lines drift down per column. */
  spread: number;
};

export type PlacedNode = FlowNode & {
  x: number;
  y: number;
  h: number;
  labelSide: "left" | "right";
};

export type PlacedLink = FlowLink & { d: string; kind: NodeKind };

export type FlowLayout = {
  nodes: PlacedNode[];
  links: PlacedLink[];
  scale: number;
  /** Horizontal distance between columns. */
  step: number;
};

export function columnStep(columns: number, o: LayoutOptions): number {
  const firstX = o.sideLabelWidth;
  const lastX = o.width - o.sideLabelWidth - o.nodeWidth;
  return columns > 1 ? (lastX - firstX) / (columns - 1) : 0;
}

const RANK = [
  "revenue",
  "gross",
  "cogs",
  // Above operating profit: it joins net profit, the topmost line in the next
  // column, so drawn below it would cross the operating → tax band.
  "other_income",
  "operating",
  "opex",
  "net",
  "tax",
  "other",
  "rd",
  "sga",
  "opex_other",
];

function rank(id: string): number {
  return id.startsWith("seg:") ? -1 : RANK.indexOf(id);
}

const MIN_BAND = 2;

function tryLayout(
  flow: IncomeFlow,
  o: LayoutOptions,
  scale: number,
): FlowLayout | null {
  const cols = flow.columns;
  const firstX = o.sideLabelWidth;
  const step = columnStep(cols, o);

  const byId = new Map<string, PlacedNode>();
  const placed: PlacedNode[] = flow.nodes.map((n) => {
    const p: PlacedNode = {
      ...n,
      x: firstX + n.column * step,
      y: 0,
      h: n.flow > 0 ? Math.max(n.flow * scale, MIN_BAND) : 0,
      labelSide: n.column === 0 ? "left" : "right",
    };
    byId.set(n.id, p);
    return p;
  });

  const ordered = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return flow.nodes.findIndex((n) => n.id === a) - flow.nodes.findIndex((n) => n.id === b);
    });

  const outgoing = (id: string) => {
    const links = flow.links.filter((l) => l.source === id);
    const order = ordered(links.map((l) => l.target));
    return links.sort((a, b) => order.indexOf(a.target) - order.indexOf(b.target));
  };
  const incoming = (id: string) =>
    flow.links
      .filter((l) => l.target === id)
      .sort((a, b) => byId.get(a.source)!.y - byId.get(b.source)!.y);

  /** Top of the band `link` occupies on its source node. */
  const sourcePortTop = (link: FlowLink) => {
    const src = byId.get(link.source)!;
    let y = src.y;
    for (const l of outgoing(link.source)) {
      if (l === link || (l.source === link.source && l.target === link.target)) break;
      y += l.value * scale;
    }
    return y;
  };

  const slot = (n: PlacedNode) => Math.max(n.h, o.labelHeight(n, step));

  for (let c = 0; c < cols; c++) {
    const ids = ordered(placed.filter((n) => n.column === c).map((n) => n.id));
    const column = ids.map((id) => byId.get(id)!);

    let desired: number[];
    if (c === 0) {
      const total =
        column.reduce((s, n) => s + slot(n), 0) + o.gap * (column.length - 1);
      let cursor = (o.height - total) / 2;
      desired = column.map((n) => {
        const center = cursor + slot(n) / 2;
        cursor += slot(n) + o.gap;
        return center;
      });
    } else {
      desired = column.map((n) => {
        const inbound = flow.links
          .filter((l) => l.target === n.id)
          .sort((a, b) => rank(a.source) - rank(b.source));
        if (!inbound.length) return Number.NEGATIVE_INFINITY;
        const drift =
          n.kind === "profit" ? -o.spread : n.kind === "cost" ? o.spread : 0;
        return sourcePortTop(inbound[0]) + n.h / 2 + drift;
      });
    }

    // Downward pass: honour each node's wish unless the one above is in the way.
    const centers: number[] = [];
    let floor = 0;
    column.forEach((n, i) => {
      const half = slot(n) / 2;
      const center = Math.max(desired[i], floor + half);
      centers.push(center);
      floor = center + half + o.gap;
    });
    // Upward pass: pull back inside the bottom edge.
    let ceiling = o.height;
    for (let i = column.length - 1; i >= 0; i--) {
      const half = slot(column[i]) / 2;
      centers[i] = Math.min(centers[i], ceiling - half);
      ceiling = centers[i] - half - o.gap;
    }
    if (centers.length && centers[0] - slot(column[0]) / 2 < -0.5) return null;

    column.forEach((n, i) => {
      n.y = centers[i] - n.h / 2;
    });
  }

  const links: PlacedLink[] = [];
  const targetOffset = new Map<string, number>();
  for (const target of placed) {
    let y = target.y;
    for (const l of incoming(target.id)) {
      targetOffset.set(`${l.source}>${l.target}`, y);
      y += l.value * scale;
    }
  }
  for (const l of flow.links) {
    const src = byId.get(l.source)!;
    const tgt = byId.get(l.target)!;
    const w = Math.max(l.value * scale, 1);
    const sy = sourcePortTop(l);
    const ty = targetOffset.get(`${l.source}>${l.target}`) ?? tgt.y;
    const sx = src.x + o.nodeWidth;
    const tx = tgt.x;
    const mx = (sx + tx) / 2;
    const d = [
      `M${sx.toFixed(1)},${sy.toFixed(1)}`,
      `C${mx.toFixed(1)},${sy.toFixed(1)} ${mx.toFixed(1)},${ty.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`,
      `L${tx.toFixed(1)},${(ty + w).toFixed(1)}`,
      `C${mx.toFixed(1)},${(ty + w).toFixed(1)} ${mx.toFixed(1)},${(sy + w).toFixed(1)} ${sx.toFixed(1)},${(sy + w).toFixed(1)}`,
      "Z",
    ].join(" ");
    links.push({ ...l, d, kind: tgt.kind });
  }

  return { nodes: placed, links, scale, step };
}

export function layoutIncomeFlow(
  flow: IncomeFlow,
  options: LayoutOptions,
): FlowLayout {
  let scale = (options.height * 0.8) / flow.revenue;
  for (let i = 0; i < 24; i++) {
    const out = tryLayout(flow, options, scale);
    if (out) return out;
    scale *= 0.88;
  }
  // Labels alone overflow the canvas (an unusually long opex breakdown). Draw
  // at a tiny scale rather than fail; the caller still gets every label.
  return tryLayout(flow, { ...options, gap: 2 }, scale) ?? {
    nodes: [],
    links: [],
    scale,
    step: columnStep(flow.columns, options),
  };
}
