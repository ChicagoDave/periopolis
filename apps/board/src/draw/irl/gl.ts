/**
 * @file The GL adapter: the one file that imports three.js. It owns a WebGL renderer on the page's canvas, a sky, a
 * sun that casts soft shadows, a ground plane, and one lit mesh a kind of block built from the described scene;
 * it renders under the orbit camera, resizes with the canvas and survives a lost context. It decides nothing about
 * what is built: the describer does (ADR-0023 Decisions 1 and 2).
 * Public interface: Tokens, IrlRenderer, webglSupported.
 * Owner context: Board (adapter), the IRL view (plan irl-3d-city-view, ADR-0023).
 */
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene as GlScene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { DARK } from '../angled/canvas.ts';
import type { Palette } from '../angled/canvas.ts';
import type { SceneKind } from '../angled/scene.ts';
import { eyeOf } from './camera.ts';
import type { Orbit, Point3 } from './camera.ts';
import type { Described } from './describe.ts';

/** The page's colours the view needs beyond the blocks': the ground and the sky. */
export interface Tokens {
  readonly ground: string;
  readonly sky: string;
}

/** Whether the browser can give the canvas a WebGL context at all. */
export function webglSupported(canvas: HTMLCanvasElement): boolean {
  try {
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Scene metres (x east, y south, z up) to three's (x right, y up, z toward the viewer): a turn, not a reflection,
 * so every face keeps its winding. */
function toGl(p: Point3): Vector3 {
  return new Vector3(p.x, p.z, -p.y);
}

/** Where the sun stands, scene metres from the target: from the south-west, forty-five degrees up, as the angled
 * view's light. */
const SUN_OFFSET: Point3 = { x: -1, y: 1, z: Math.SQRT2 };

/** The renderer on one canvas: built once, fed a described scene when it changes, rendered every frame. */
export class IrlRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new GlScene();
  private readonly camera = new PerspectiveCamera(45, 1, 1, 100000);
  private readonly sun: DirectionalLight;
  private readonly sky: HemisphereLight;
  private ground: Mesh | null = null;
  private meshes: Mesh[] = [];
  private frames = 0;

  /**
   * @param canvas - the page's canvas
   * @param onLost - called when the GL context is lost, so the page can say so
   * @param onRestored - called when it comes back, so the page can render again
   */
  constructor(canvas: HTMLCanvasElement, onLost: () => void, onRestored: () => void) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.sun = new DirectionalLight(0xfff4e0, 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.sky = new HemisphereLight(0xbfd8f0, 0x6b6a5a, 0.9);
    this.scene.add(this.sun, this.sun.target, this.sky, new AmbientLight(0xffffff, 0.15));
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      onLost();
    });
    canvas.addEventListener('webglcontextrestored', () => onRestored());
  }

  /** Frames rendered since the renderer was made. */
  get rendered(): number {
    return this.frames;
  }

  /**
   * Replace what stands: one mesh a kind, every block's prism merged into it with a vertex colour from the palette
   * dimmed by how little of it is lit (an unlit home keeps DARK of its colour, as the angled view); a ground plane
   * round the box; the sun's shadow camera fitted to the box; the sky and fog from the page's tokens.
   */
  build(described: Described, palette: Palette, tokens: Tokens): void {
    this.clear();
    const sky = new Color(tokens.sky);
    this.scene.background = sky;
    this.sky.color.copy(sky).lerp(new Color(0xffffff), 0.4);
    this.sky.groundColor.set(tokens.ground);
    const bounds = described.bounds;
    if (!bounds) {
      this.scene.fog = null;
      return;
    }
    const byKind = new Map<SceneKind, { positions: number[]; normals: number[]; colors: number[]; indices: number[] }>();
    const tint = new Color();
    for (const { block, prism } of described.meshes) {
      let bucket = byKind.get(block.kind);
      if (!bucket) {
        bucket = { positions: [], normals: [], colors: [], indices: [] };
        byKind.set(block.kind, bucket);
      }
      const at = bucket.positions.length / 3;
      // Scene (x, y south, z up) to GL (x, z up, -y), vertex by vertex.
      for (let i = 0; i < prism.positions.length; i += 3) {
        bucket.positions.push(prism.positions[i] as number, prism.positions[i + 2] as number, -(prism.positions[i + 1] as number));
        bucket.normals.push(prism.normals[i] as number, prism.normals[i + 2] as number, -(prism.normals[i + 1] as number));
      }
      tint.set(palette[block.kind]).multiplyScalar(DARK + (1 - DARK) * block.lit);
      for (let i = 0; i < prism.positions.length; i += 3) bucket.colors.push(tint.r, tint.g, tint.b);
      for (const ix of prism.indices) bucket.indices.push(at + ix);
    }
    for (const [kind, b] of byKind) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(b.positions), 3));
      geometry.setAttribute('normal', new BufferAttribute(new Float32Array(b.normals), 3));
      geometry.setAttribute('color', new BufferAttribute(new Float32Array(b.colors), 3));
      geometry.setIndex(b.indices);
      const flat = kind === 'line' || kind === 'siteline';
      const mesh = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: flat ? 0.95 : 0.8, metalness: 0 }));
      mesh.castShadow = !flat;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    const margin = Math.max(spanX, spanY) * 0.6 + 200;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const plane = new PlaneGeometry(spanX + 2 * margin, spanY + 2 * margin);
    plane.rotateX(-Math.PI / 2);
    this.ground = new Mesh(plane, new MeshStandardMaterial({ color: new Color(tokens.ground), roughness: 1, metalness: 0 }));
    this.ground.position.copy(toGl({ x: cx, y: cy, z: 0 }));
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    // The sun stands off the box's middle far enough that its shadow camera holds the whole box.
    const radius = Math.hypot(spanX, spanY, bounds.maxZ) / 2 + 50;
    const sunAt: Point3 = { x: cx + SUN_OFFSET.x * radius * 2, y: cy + SUN_OFFSET.y * radius * 2, z: SUN_OFFSET.z * radius * 2 };
    this.sun.position.copy(toGl(sunAt));
    this.sun.target.position.copy(toGl({ x: cx, y: cy, z: 0 }));
    const shadow = this.sun.shadow.camera;
    shadow.left = -radius;
    shadow.right = radius;
    shadow.top = radius;
    shadow.bottom = -radius;
    shadow.near = radius;
    shadow.far = radius * 6;
    shadow.updateProjectionMatrix();
    const far = Math.max(spanX, spanY) * 6 + 2000;
    this.scene.fog = new Fog(sky, far * 0.35, far);
  }

  /**
   * One frame under the orbit: the canvas sized to the pixels, the camera at the eye looking at the target.
   * @returns the frames rendered so far
   */
  render(orbit: Orbit, width: number, height: number, dpr: number): number {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.fov = (orbit.fov * 180) / Math.PI;
    this.camera.near = Math.max(0.5, orbit.distance / 500);
    this.camera.far = Math.max(5000, orbit.distance * 40);
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(toGl(eyeOf(orbit)));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(toGl(orbit.target));
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    return this.frames;
  }

  /** Take down what stands and let its GL resources go. */
  private clear(): void {
    for (const m of this.meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as MeshStandardMaterial).dispose();
    }
    this.meshes = [];
    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground.geometry.dispose();
      (this.ground.material as MeshStandardMaterial).dispose();
      this.ground = null;
    }
  }

  /** Let every GL resource go. */
  dispose(): void {
    this.clear();
    this.renderer.dispose();
  }
}

