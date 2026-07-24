"use client";

import { useEffect, useRef } from "react";

type ShapeKind = "cube" | "tetra" | "octa" | "prism";

interface Geometry {
  vertices: [number, number, number][];
  edges: [number, number][];
  faces: number[][];
}

// Unit cube
const CUBE: Geometry = {
  vertices: [
    [-0.5, -0.5, -0.5],
    [0.5, -0.5, -0.5],
    [0.5, 0.5, -0.5],
    [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5],
    [0.5, -0.5, 0.5],
    [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5],
  ],
  edges: [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ],
  faces: [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [2, 3, 7, 6],
    [0, 3, 7, 4],
    [1, 2, 6, 5],
  ],
};

// Tetrahedron — upward "growth arrow" feel
const TETRA: Geometry = {
  vertices: [
    [0.5, 0.5, 0.5],
    [0.5, -0.5, -0.5],
    [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5],
  ],
  edges: [
    [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
  ],
  faces: [
    [0, 1, 2],
    [0, 1, 3],
    [0, 2, 3],
    [1, 2, 3],
  ],
};

// Octahedron — diamond / gem
const OCTA: Geometry = {
  vertices: [
    [0.6, 0, 0],
    [-0.6, 0, 0],
    [0, 0.6, 0],
    [0, -0.6, 0],
    [0, 0, 0.6],
    [0, 0, -0.6],
  ],
  edges: [
    [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 2], [1, 3], [1, 4], [1, 5],
    [2, 4], [4, 3], [3, 5], [5, 2],
  ],
  faces: [
    [0, 2, 4],
    [0, 4, 3],
    [0, 3, 5],
    [0, 5, 2],
    [1, 2, 4],
    [1, 4, 3],
    [1, 3, 5],
    [1, 5, 2],
  ],
};

// Triangular prism — chart bar / growth wedge
const PRISM: Geometry = {
  vertices: [
    [-0.5, -0.4, -0.5],
    [0.5, -0.4, -0.5],
    [0, 0.5, -0.5],
    [-0.5, -0.4, 0.5],
    [0.5, -0.4, 0.5],
    [0, 0.5, 0.5],
  ],
  edges: [
    [0, 1], [1, 2], [2, 0],
    [3, 4], [4, 5], [5, 3],
    [0, 3], [1, 4], [2, 5],
  ],
  faces: [
    [0, 1, 2],
    [3, 4, 5],
    [0, 1, 4, 3],
    [1, 2, 5, 4],
    [2, 0, 3, 5],
  ],
};

const GEOMETRIES: Record<ShapeKind, Geometry> = {
  cube: CUBE,
  tetra: TETRA,
  octa: OCTA,
  prism: PRISM,
};

interface Shape {
  kind: ShapeKind;
  x: number;
  y: number;
  z: number;
  size: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  speedX: number;
  speedY: number;
  speedZ: number;
  driftX: number;
  driftY: number;
  opacity: number;
}

const KINDS: ShapeKind[] = ["cube", "tetra", "octa", "prism"];

function createShapes(width: number, height: number): Shape[] {
  const count = 22;
  const shapes: Shape[] = [];
  for (let i = 0; i < count; i++) {
    shapes.push({
      kind: KINDS[i % KINDS.length],
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random() * 400 - 200,
      size: 30 + Math.random() * 70,
      rotX: Math.random() * Math.PI * 2,
      rotY: Math.random() * Math.PI * 2,
      rotZ: Math.random() * Math.PI * 2,
      speedX: (Math.random() - 0.5) * 0.004,
      speedY: (Math.random() - 0.5) * 0.004,
      speedZ: (Math.random() - 0.5) * 0.003,
      driftX: (Math.random() - 0.5) * 0.15,
      driftY: (Math.random() - 0.5) * 0.1,
      opacity: 0.08 + Math.random() * 0.14,
    });
  }
  return shapes;
}

function project(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number
): { sx: number; sy: number; scale: number } {
  const perspective = 800;
  const scale = perspective / (perspective + z);
  return {
    sx: cx + (x - cx) * scale,
    sy: cy + (y - cy) * scale,
    scale,
  };
}

function rotatePoint(
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number
): [number, number, number] {
  const y1 = y * Math.cos(rx) - z * Math.sin(rx);
  const z1 = y * Math.sin(rx) + z * Math.cos(rx);
  const x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
  const z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
  const x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
  const y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
  return [x3, y3, z2];
}

export function ShapeField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shapesRef = useRef<Shape[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.parentElement!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      canvas!.style.width = rect.width + "px";
      canvas!.style.height = rect.height + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      shapesRef.current = createShapes(rect.width, rect.height);
    }

    resize();
    window.addEventListener("resize", resize);

    function draw() {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      const cx = w / 2;
      const cy = h / 2;

      ctx!.clearRect(0, 0, w, h);

      for (const shape of shapesRef.current) {
        shape.rotX += shape.speedX;
        shape.rotY += shape.speedY;
        shape.rotZ += shape.speedZ;
        shape.x += shape.driftX;
        shape.y += shape.driftY;

        if (shape.x < -shape.size) shape.x = w + shape.size;
        if (shape.x > w + shape.size) shape.x = -shape.size;
        if (shape.y < -shape.size) shape.y = h + shape.size;
        if (shape.y > h + shape.size) shape.y = -shape.size;

        const geo = GEOMETRIES[shape.kind];

        const projected = geo.vertices.map(([vx, vy, vz]) => {
          const [rx, ry, rz] = rotatePoint(
            vx * shape.size,
            vy * shape.size,
            vz * shape.size,
            shape.rotX,
            shape.rotY,
            shape.rotZ
          );
          return project(shape.x + rx, shape.y + ry, shape.z + rz, cx, cy);
        });

        ctx!.strokeStyle = `rgba(34, 197, 94, ${shape.opacity})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        for (const [a, b] of geo.edges) {
          ctx!.moveTo(projected[a].sx, projected[a].sy);
          ctx!.lineTo(projected[b].sx, projected[b].sy);
        }
        ctx!.stroke();

        ctx!.fillStyle = `rgba(34, 197, 94, ${shape.opacity * 0.08})`;
        for (const face of geo.faces) {
          ctx!.beginPath();
          ctx!.moveTo(projected[face[0]].sx, projected[face[0]].sy);
          for (let i = 1; i < face.length; i++) {
            ctx!.lineTo(projected[face[i]].sx, projected[face[i]].sy);
          }
          ctx!.closePath();
          ctx!.fill();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
