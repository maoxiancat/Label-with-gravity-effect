"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Matter from "matter-js";

type MatterBody = ReturnType<typeof Matter.Bodies.rectangle>;

export type PhysicsTag = {
  label: string;
  accent?: boolean;
};

const DEFAULT_TAGS: PhysicsTag[] = [
  { label: "HTML" },
  { label: "CSS" },
  { label: "JavaScript", accent: true },
  { label: "Gsap" },
  { label: "Matter.js" },
  { label: "React", accent: true },
  { label: "TailwindCSS", accent: true },
  { label: "Figma", accent: true },
  { label: "AdobeIllustrator" },
  { label: "Next.js", accent: true },
  { label: "TypeScript" },
  { label: "Vue.js" },
  { label: "Vue" },
  { label: "Vite" },
  { label: "Go", accent: true },
  { label: "Gin" },
  { label: "Gorm" },
  { label: "Python" },
  { label: "MySQL" },
  { label: "Electron" },
  { label: "Ionic" },
];

type PhysicsTagCloudProps = {
  tags?: PhysicsTag[];
  className?: string;
};

function estimateSize(label: string) {
  const fontPx = 30;
  const charW = 14;
  const padX = 28;
  const bodyW = Math.max(label.length * charW + padX, 56);
  const bodyH = Math.ceil(fontPx * 1.2);
  return { bodyW, bodyH };
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  pad: number
) {
  const dx = Math.abs(ax - bx) * 2 < aw + bw + pad * 2;
  const dy = Math.abs(ay - by) * 2 < ah + bh + pad * 2;
  return dx && dy;
}

type MatterMouseLike = {
    mousemove: (e: Event) => void;
    mousedown: (e: Event) => void;
    mouseup: (e: Event) => void;
    mousewheel: (e: Event) => void;
};

function detachMatterMouse(element: HTMLElement, mouse: MatterMouseLike) {
  const m = mouse;
  element.removeEventListener("mousemove", m.mousemove);
  element.removeEventListener("mousedown", m.mousedown);
  element.removeEventListener("mouseup", m.mouseup);
  element.removeEventListener("wheel", m.mousewheel);
  element.removeEventListener("touchmove", m.mousemove);
  element.removeEventListener("touchstart", m.mousedown);
  element.removeEventListener("touchend", m.mouseup);
}

export function PhysicsTagCloud({
  tags = DEFAULT_TAGS,
  className = "",
}: PhysicsTagCloudProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [size, setSize] = useState({ w: 0, h: 0 });

  const tagsKey = useMemo(
    () => tags.map((t) => `${t.label}:${t.accent ? 1 : 0}`).join("\0"),
    [tags]
  );

  useLayoutEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const read = () =>
      setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el || size.w < 80 || size.h < 80) return;

    const {
      Engine,
      Bodies,
      World,
      Runner,
      Mouse,
      MouseConstraint,
      Composite,
      Events,
    } = Matter;

    const { w: width, h: height } = size;

    const sideT = 14;
    const floorT = 8;
    const ceilT = 12;

    const engine = Engine.create({
      enableSleeping: false,
      positionIterations: 12,
      velocityIterations: 12,
    });
    engine.gravity.y = 1;
    engine.gravity.scale = 0.0012;

    const wallOpts = { isStatic: true, friction: 0.6, frictionStatic: 1 };

    const walls = [
      Bodies.rectangle(width / 2, ceilT / 2, width + sideT * 4, ceilT, wallOpts),
      Bodies.rectangle(
        width / 2,
        height - floorT / 2,
        width + sideT * 4,
        floorT,
        wallOpts
      ),
      Bodies.rectangle(
        sideT / 2,
        height / 2,
        sideT,
        height + ceilT + floorT,
        wallOpts
      ),
      Bodies.rectangle(
        width - sideT / 2,
        height / 2,
        sideT,
        height + ceilT + floorT,
        wallOpts
      ),
    ];
    World.add(engine.world, walls);

    const labelSizes = tags.map((tag) => estimateSize(tag.label));
    const innerLeft = sideT + 6;
    const innerRight = width - sideT - 6;
    const innerW = innerRight - innerLeft;
    const spawnTop = ceilT + 24;
    const spawnBand = Math.min(140, height * 0.35);

    const planned: { cx: number; cy: number; bodyW: number; bodyH: number }[] =
      [];

    tags.forEach((tag, i) => {
      const { bodyW, bodyH } = labelSizes[i];
      let cx = innerLeft + bodyW / 2;
      let cy = spawnTop + bodyH / 2;
      const pad = 6;

      for (let attempt = 0; attempt < 120; attempt++) {
        const slot = (i + attempt * 0.37) % tags.length;
        const t = tags.length > 1 ? slot / (tags.length - 1) : 0.5;
        cx =
          innerLeft +
          bodyW / 2 +
          t * Math.max(0, innerW - bodyW) +
          (Math.random() - 0.5) * Math.min(36, innerW * 0.08);
        cy =
          spawnTop +
          bodyH / 2 +
          Math.random() * spawnBand +
          (attempt % 7) * 4;

        const hit = planned.some((p) =>
          rectsOverlap(cx, cy, bodyW, bodyH, p.cx, p.cy, p.bodyW, p.bodyH, pad)
        );
        if (!hit) break;
      }

      planned.push({ cx, cy, bodyW, bodyH });
    });

    const bodies: MatterBody[] = [];

    planned.forEach((p, i) => {
      const body = Bodies.rectangle(p.cx, p.cy, p.bodyW, p.bodyH, {
        restitution: 0.08,
        friction: 0.55,
        frictionStatic: 0.85,
        frictionAir: 0.022,
        density: 0.003,
        angle: (Math.random() - 0.5) * 0.5,
      });
      (body as MatterBody & { tagIndex: number }).tagIndex = i;
      bodies.push(body);
    });
    World.add(engine.world, bodies);

    const mouse = Mouse.create(el);
    mouse.pixelRatio = 1;

    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.35,
        damping: 0.1,
        render: { visible: false },
      },
    });
    Composite.add(engine.world, mouseConstraint);

    const runner = Runner.create();
    Runner.run(runner, engine);

    const syncDom = () => {
      bodies.forEach((body) => {
        const idx = (body as MatterBody & { tagIndex: number }).tagIndex;
        const node = wordRefs.current.get(idx);
        if (!node) return;
        const { x, y } = body.position;
        const { bodyW: hw, bodyH: hh } = labelSizes[idx];
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = `${hw}px`;
        node.style.height = `${hh}px`;
        node.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`;
      });
    };

    Events.on(engine, "afterUpdate", syncDom);
    syncDom();

    return () => {
      Events.off(engine, "afterUpdate", syncDom);
      Events.off(engine, "beforeUpdate");
      detachMatterMouse(el, mouse);
      Runner.stop(runner);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
    };
  }, [size.w, size.h, tagsKey]);

  return (
    <div className={`w-full max-w-3xl ${className} hover:scale-101 hover:shadow-[0_0_20px_10px_rgba(0,255,0,0.3)] transition-all duration-500 rounded-3xl`}>
      <div
        ref={sceneRef}
        className="relative h-[45vh] w-full touch-none overflow-hidden rounded-2xl border-2 border-neutral-400 bg-transparent"
      >
        {tags.map((tag, i) => (
          <div
            key={`${tag.label}-${i}`}
            ref={(node) => {
              if (node) wordRefs.current.set(i, node);
              else wordRefs.current.delete(i);
            }}
            className={[
              "pointer-events-none absolute box-border flex select-none items-end justify-center whitespace-nowrap font-semibold leading-none tracking-tight",
              "text-3xl sm:text-3xl",
              tag.accent ? "text-[#6fe367]" : "text-[#efffee]",
            ].join(" ")}
            style={{
              willChange: "transform",
            }}
          >
            {tag.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PhysicsTagCloud;
