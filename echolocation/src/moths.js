// Glow-moths: the only friendly things down here. Wild ones wait in dead
// ends, chirping softly. Freed ones orbit you, ping gently for free vision,
// and together they can open the sealed way down.
import * as THREE from 'three';

let mothTexture = null;
function getMothTexture() {
  if (mothTexture) return mothTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 236, 190, 1)');
  grad.addColorStop(0.25, 'rgba(240, 196, 110, 0.8)');
  grad.addColorStop(0.6, 'rgba(200, 150, 60, 0.25)');
  grad.addColorStop(1, 'rgba(160, 110, 30, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  mothTexture = new THREE.CanvasTexture(c);
  return mothTexture;
}

export class Moth {
  constructor(pings, worldPos, idx) {
    this.pings = pings;
    this.idx = idx;
    this.state = 'wild';
    this.home = worldPos.clone();
    this.pos = worldPos.clone().setY(1.3);
    this.pingT = 3 + idx * 2.3;
    this.chirpT = 1 + Math.random() * 2;

    this.mat = new THREE.SpriteMaterial({
      map: getMothTexture(),
      color: 0xffd98a,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.scale.setScalar(0.55);
    this.sprite.position.copy(this.pos);
  }

  addTo(scene) {
    scene.add(this.sprite);
  }

  removeFrom(scene) {
    scene.remove(this.sprite);
    this.mat.dispose();
  }

  update(dt, g) {
    const t = g.time;
    if (this.state === 'wild') {
      this.pos.set(
        this.home.x + Math.sin(t * 1.3 + this.idx * 3) * 0.35,
        1.3 + Math.sin(t * 2.1 + this.idx) * 0.18,
        this.home.z + Math.cos(t * 1.1 + this.idx * 2) * 0.35,
      );
      // a wild moth glimmers on its own so a careful listener can find it
      if ((this.pingT -= dt) <= 0) {
        this.pingT = 7 + Math.random() * 2;
        g.pings.emit(this.pos, 'moth');
      }
      const pd = Math.hypot(g.player.pos.x - this.pos.x, g.player.pos.z - this.pos.z);
      if (pd < 10 && (this.chirpT -= dt) <= 0) {
        this.chirpT = 2.2 + Math.random() * 1.5;
        g.audio.mothChirp(pd);
      }
      if (pd < 1.7) {
        this.state = 'ally';
        g.onMothFreed(this);
      }
    } else {
      const angle = t * 1.2 + this.idx * 2.4;
      const target = new THREE.Vector3(
        g.player.pos.x + Math.cos(angle) * 0.95,
        1.95 + Math.sin(t * 2.6 + this.idx) * 0.14,
        g.player.pos.z + Math.sin(angle) * 0.95,
      );
      this.pos.lerp(target, 1 - Math.exp(-dt * 3.2));
      if ((this.pingT -= dt) <= 0) {
        this.pingT = 4.5 + this.idx * 0.8;
        g.pings.emit(this.pos, 'moth');
      }
    }
    this.sprite.position.copy(this.pos);
    this.mat.opacity = 0.65 + Math.sin(t * 3.7 + this.idx * 2) * 0.25;
  }
}
