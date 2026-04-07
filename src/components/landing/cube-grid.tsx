"use client";

import { useEffect, useRef } from "react";

interface Cube {
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

function createCubes(width: number, height: number): Cube[] {
  const count = 18;
  const cubes: Cube[] = [];
  for (let i = 0; i < count; i++) {
    cubes.push({
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
  return cubes;
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

// Unit cube vertices centered at origin
const vertices: [number, number, number][] = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [0.5, 0.5, -0.5],
  [-0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5],
  [0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5],
];

const edges: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0], // back face
  [4, 5], [5, 6], [6, 7], [7, 4], // front face
  [0, 4], [1, 5], [2, 6], [3, 7], // connecting edges
];

function rotatePoint(
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number
): [number, number, number] {
  // Rotate X
  let y1 = y * Math.cos(rx) - z * Math.sin(rx);
  let z1 = y * Math.sin(rx) + z * Math.cos(rx);
  // Rotate Y
  let x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
  let z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
  // Rotate Z
  let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
  let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
  return [x3, y3, z2];
}

export function CubeGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cubesRef = useRef<Cube[]>([]);
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
      cubesRef.current = createCubes(rect.width, rect.height);
    }

    resize();
    window.addEventListener("resize", resize);

    function draw() {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      const cx = w / 2;
      const cy = h / 2;

      ctx!.clearRect(0, 0, w, h);

      for (const cube of cubesRef.current) {
        cube.rotX += cube.speedX;
        cube.rotY += cube.speedY;
        cube.rotZ += cube.speedZ;
        cube.x += cube.driftX;
        cube.y += cube.driftY;

        // Wrap around
        if (cube.x < -cube.size) cube.x = w + cube.size;
        if (cube.x > w + cube.size) cube.x = -cube.size;
        if (cube.y < -cube.size) cube.y = h + cube.size;
        if (cube.y > h + cube.size) cube.y = -cube.size;

        // Transform vertices
        const projected = vertices.map(([vx, vy, vz]) => {
          const [rx, ry, rz] = rotatePoint(
            vx * cube.size,
            vy * cube.size,
            vz * cube.size,
            cube.rotX,
            cube.rotY,
            cube.rotZ
          );
          return project(cube.x + rx, cube.y + ry, cube.z + rz, cx, cy);
        });

        // Draw edges
        ctx!.strokeStyle = `rgba(34, 197, 94, ${cube.opacity})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        for (const [a, b] of edges) {
          ctx!.moveTo(projected[a].sx, projected[a].sy);
          ctx!.lineTo(projected[b].sx, projected[b].sy);
        }
        ctx!.stroke();

        // Faint face fills for depth
        const faces = [
          [0, 1, 2, 3],
          [4, 5, 6, 7],
          [0, 1, 5, 4],
          [2, 3, 7, 6],
          [0, 3, 7, 4],
          [1, 2, 6, 5],
        ];
        ctx!.fillStyle = `rgba(34, 197, 94, ${cube.opacity * 0.08})`;
        for (const face of faces) {
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
