"use client";

import { useEffect, useRef, type ReactElement } from "react";
import { useTheme } from "next-themes";
import { useReducedMotion } from "motion/react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";

const POINTS = 160;

function lineCountForWidth(width: number): number {
  return width < 768 ? 36 : 64;
}

function readAccent(): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--agentforge-accent")
    .trim();
  return value || "#0f766e";
}

function isDarkTheme(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function HeroFlow(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }

    const scene = new Scene();
    const camera = new PerspectiveCamera(34, 1, 0.1, 40);
    camera.position.set(0, 0.2, 5.4);
    camera.lookAt(0, -0.05, 0);

    const group = new Group();
    group.rotation.x = -0.42;
    group.rotation.z = -0.06;
    scene.add(group);

    const materials: LineBasicMaterial[] = [];
    const geometries: BufferGeometry[] = [];
    const lanes: number[] = [];
    const phases: number[] = [];
    const positionAttrs: BufferAttribute[] = [];

    const buildLines = (count: number): void => {
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
      while (group.children.length > 0) {
        group.remove(group.children[0]!);
      }
      materials.length = 0;
      geometries.length = 0;
      lanes.length = 0;
      phases.length = 0;
      positionAttrs.length = 0;

      const color = new Color(readAccent());
      const opacity = isDarkTheme() ? 0.32 : 0.2;

      for (let i = 0; i < count; i += 1) {
        const lane = (i / Math.max(count - 1, 1)) * 2 - 1;
        const positions = new Float32Array(POINTS * 3);
        const geometry = new BufferGeometry();
        const attribute = new BufferAttribute(positions, 3);
        geometry.setAttribute("position", attribute);
        const material = new LineBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
        });
        group.add(new Line(geometry, material));
        geometries.push(geometry);
        materials.push(material);
        lanes.push(lane);
        phases.push(i * 0.17);
        positionAttrs.push(attribute);
      }
    };

    const writeFrame = (time: number): void => {
      for (let i = 0; i < positionAttrs.length; i += 1) {
        const attribute = positionAttrs[i];
        const lane = lanes[i] ?? 0;
        const phase = phases[i] ?? 0;
        if (!attribute) {
          continue;
        }
        for (let p = 0; p < POINTS; p += 1) {
          const t = p / (POINTS - 1);
          const x = t * 5.6 - 2.8;
          const dip = Math.exp(-(x * x) / 1.35) * 0.42;
          const wave =
            Math.sin(x * 1.35 + time * 0.55 + phase) * 0.16 +
            Math.sin(x * 3.1 - time * 0.32 + phase * 1.4) * 0.05;
          const y = lane * 1.05 - dip * (1 - Math.abs(lane) * 0.35) + wave;
          const z = Math.sin(x * 0.9 + time * 0.18 + phase) * 0.35;
          attribute.setXYZ(p, x, y, z);
        }
        attribute.needsUpdate = true;
      }
    };

    let elapsed = 0;

    const resize = (): void => {
      const frame = canvas.parentElement ?? canvas;
      const width = Math.max(frame.clientWidth, 1);
      const height = Math.max(frame.clientHeight, 1);
      const dpr = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const nextCount = lineCountForWidth(width);
      if (nextCount !== lanes.length) {
        buildLines(nextCount);
        writeFrame(elapsed);
      }
    };

    renderer.setClearColor(0x000000, 0);
    resize();
    if (lanes.length === 0) {
      buildLines(lineCountForWidth(canvas.parentElement?.clientWidth || 1200));
      writeFrame(0);
    }
    renderer.render(scene, camera);

    let frame = 0;
    let visible = true;
    let last = performance.now();
    const reduced = Boolean(reduce);

    const tick = (now: number): void => {
      frame = window.requestAnimationFrame(tick);
      if (!visible || document.hidden || reduced) {
        last = now;
        return;
      }
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += delta;
      group.rotation.y = Math.sin(elapsed * 0.12) * 0.05;
      writeFrame(elapsed);
      renderer.render(scene, camera);
    };

    if (!reduced) {
      frame = window.requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
      },
      { threshold: 0.05 },
    );
    observer.observe(canvas);

    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      observer.disconnect();
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
      renderer.dispose();
    };
  }, [reduce, resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
