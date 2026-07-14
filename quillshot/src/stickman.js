// Tiny shared toolkit for drawing smooth stickmen: round-capped segments,
// two-bone IK for knees/elbows, heads. Characters are the "smooth" half of
// the pixel/stick hybrid look, so everything here uses round joins.

export function seg(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// Two-bone IK: shoulder/hip A → end effector B with bone lengths l1, l2.
// dir (+1/-1) picks which side the joint bends toward.
export function ik(ax, ay, bx, by, l1, l2, dir) {
  let dx = bx - ax;
  let dy = by - ay;
  let d = Math.hypot(dx, dy);
  const maxD = (l1 + l2) * 0.999;
  if (d < 0.0001) { dx = 1; dy = 0; d = 0.0001; }
  if (d > maxD) {
    dx *= maxD / d;
    dy *= maxD / d;
    d = maxD;
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d;
  const uy = dy / d;
  return {
    x: ax + ux * a - uy * h * dir,
    y: ay + uy * a + ux * h * dir,
  };
}

// Draw a limb A → joint → B (joint from ik()).
export function limb(ctx, ax, ay, bx, by, l1, l2, dir) {
  const j = ik(ax, ay, bx, by, l1, l2, dir);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(j.x, j.y);
  ctx.lineTo(bx, by);
  ctx.stroke();
  return j;
}

export function head(ctx, x, y, r, fill = false) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) ctx.fill();
  else ctx.stroke();
}

// Configure a ctx for stickman strokes.
export function inkStyle(ctx, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}
