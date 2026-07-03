// Lanternfish: the only kind things down here. Wild ones shelter in the
// gardens, their gold lures burning like distant candles. Freed ones school
// around you, softly echo-pinging for free vision — and once the gate wakes,
// they dart ahead to lead you to it.
import * as THREE from 'three';
import { getGlowTexture } from './glow.js';

export class Lanternfish {
  constructor(pings, worldPos, idx) {
    this.idx = idx;
    this.state = 'wild';
    this.home = worldPos.clone();
    this.pos = worldPos.clone();
    this.pingT = 3 + idx * 2.1;
    this.chirpT = 1 + Math.random() * 2;

    this.mat = pings.material({ albedo: [1.0, 0.86, 0.6] });
    const g = new THREE.Group();
    const body = new THREE.SphereGeometry(0.34, 10, 8);
    body.scale(0.55, 0.62, 1.0);
    g.add(new THREE.Mesh(body, this.mat));
    this.tail = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.32), this.mat);
    this.tail.position.set(0, 0, -0.4);
    g.add(this.tail);

    // the lantern itself: a gold light on a little stalk
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.3, 4), this.mat);
    stalk.position.set(0, 0.28, 0.18);
    stalk.rotation.x = 0.5;
    g.add(stalk);
    this.orbMat = new THREE.MeshBasicMaterial({
      color: 0xffd98a,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), this.orbMat);
    orb.position.set(0, 0.42, 0.3);
    g.add(orb);
    this.haloMat = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: 0xffd98a,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const halo = new THREE.Sprite(this.haloMat);
    halo.scale.setScalar(1.1);
    halo.position.copy(orb.position);
    g.add(halo);

    g.position.copy(this.pos);
    this.group = g;
  }

  addTo(scene) {
    scene.add(this.group);
  }

  removeFrom(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.mat.dispose();
    this.orbMat.dispose();
    this.haloMat.dispose();
  }

  update(dt, g) {
    const t = g.time;
    let target;

    if (this.state === 'wild') {
      target = new THREE.Vector3(
        this.home.x + Math.sin(t * 1.1 + this.idx * 3) * 0.6,
        this.home.y + Math.sin(t * 1.9 + this.idx) * 0.25,
        this.home.z + Math.cos(t * 0.9 + this.idx * 2) * 0.6,
      );
      if ((this.pingT -= dt) <= 0) {
        this.pingT = 6.5 + Math.random() * 2;
        g.pings.emit(this.pos, 'lantern');
      }
      const pd = g.player.pos.distanceTo(this.pos);
      if (pd < 12 && (this.chirpT -= dt) <= 0) {
        this.chirpT = 2.2 + Math.random() * 1.5;
        g.audio.fishChirp(pd);
      }
      if (pd < 2.3) {
        this.state = 'ally';
        g.onFishFreed(this);
      }
    } else if (g.unlocked) {
      // guide mode: stretch out ahead of the player, toward the gate
      const toGate = g.world.gatePos.clone().sub(g.player.pos);
      const gd = toGate.length();
      toGate.normalize();
      const lead = Math.min(gd - 1, 4.5 + Math.sin(t * 1.6 + this.idx * 2) * 2.5);
      target = g.player.pos
        .clone()
        .addScaledVector(toGate, Math.max(1.5, lead))
        .add(
          new THREE.Vector3(
            Math.sin(t * 2.1 + this.idx * 2.4) * 0.7,
            0.4 + Math.sin(t * 1.7 + this.idx) * 0.5,
            Math.cos(t * 1.9 + this.idx * 1.7) * 0.7,
          ),
        );
    } else {
      // schooling: orbit the player like a small warm constellation
      const angle = t * 1.1 + this.idx * 2.4;
      target = new THREE.Vector3(
        g.player.pos.x + Math.cos(angle) * 1.3,
        g.player.pos.y + 0.5 + Math.sin(t * 2.3 + this.idx) * 0.3,
        g.player.pos.z + Math.sin(angle) * 1.3,
      );
    }

    if (this.state === 'ally' && (this.pingT -= dt) <= 0) {
      this.pingT = 4.2 + this.idx * 0.8;
      g.pings.emit(this.pos, 'lantern');
    }

    const prev = this.pos.clone();
    this.pos.lerp(target, 1 - Math.exp(-dt * (g.unlocked && this.state === 'ally' ? 3.4 : 2.6)));
    this.group.position.copy(this.pos);
    const heading = this.pos.clone().sub(prev);
    if (heading.lengthSq() > 1e-6) this.group.lookAt(this.pos.clone().add(heading));
    this.tail.rotation.y = Math.sin(t * 9 + this.idx * 3) * 0.7;
    this.haloMat.opacity = 0.5 + Math.sin(t * 3.4 + this.idx * 2) * 0.2;
  }
}
