import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const modelCache = new Map<string, GLTF>();
const textureCache = new Map<string, THREE.Texture>();
const ALPHA_TEST_THRESHOLD = 0.5;

export async function loadModrinthModel(modelUrl: string): Promise<GLTF> {
  const cached = modelCache.get(modelUrl);
  if (cached) return cached;

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(modelUrl);
  modelCache.set(modelUrl, gltf);
  return gltf;
}

export async function loadModrinthAnimationSource(source: string | Blob): Promise<GLTF> {
  if (typeof source === 'string') {
    return loadModrinthModel(source);
  }

  const objectUrl = URL.createObjectURL(source);
  try {
    const loader = new GLTFLoader();
    return await loader.loadAsync(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function loadModrinthTexture(textureUrl: string): Promise<THREE.Texture> {
  const cached = textureCache.get(textureUrl);
  if (cached) return cached;

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const texture = await loader.loadAsync(textureUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  textureCache.set(textureUrl, texture);
  return texture;
}

export function createTransparentTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  canvas.getContext('2d')?.clearRect(0, 0, 1, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

export function enableSampleAlphaToCoverage(renderer: THREE.WebGLRenderer): void {
  const gl = renderer.getContext();
  gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
}

export function applyPlayerTexture(model: THREE.Object3D, texture: THREE.Texture): void {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    const isSkinLayer = mesh.name.endsWith('_Layer');

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.name === 'cape') continue;

      material.map = texture;
      material.color.set(0xffffff);
      material.metalness = 0;
      material.roughness = 1;
      material.toneMapped = false;
      material.flatShading = true;
      material.transparent = false;
      material.depthTest = true;
      material.depthWrite = true;
      material.side = THREE.DoubleSide;
      material.alphaTest = ALPHA_TEST_THRESHOLD;
      material.alphaToCoverage = true;
      material.polygonOffset = isSkinLayer;
      material.polygonOffsetFactor = isSkinLayer ? -1 : 0;
      material.polygonOffsetUnits = isSkinLayer ? -1 : 0;
      material.needsUpdate = true;
    }
  });
}

export function applyCapeTexture(
  model: THREE.Object3D,
  texture: THREE.Texture | null,
  transparentTexture: THREE.Texture,
): void {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.name !== 'cape') continue;

      material.map = texture ?? transparentTexture;
      material.transparent = !texture;
      material.visible = !!texture;
      material.color.set(0xffffff);
      material.metalness = 0;
      material.roughness = 1;
      material.toneMapped = false;
      material.flatShading = true;
      material.depthTest = true;
      material.depthWrite = true;
      material.side = THREE.DoubleSide;
      material.alphaTest = texture ? ALPHA_TEST_THRESHOLD : 0;
      material.alphaToCoverage = !!texture;
      material.needsUpdate = true;
    }
  });
}

export function cloneModelScene(scene: THREE.Object3D): THREE.Object3D {
  const clone = scene.clone(true);
  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    const isSkinLayer = mesh.name.endsWith('_Layer');

    mesh.geometry = mesh.geometry.clone();
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => {
          const clonedMat = material.clone();
          if (clonedMat instanceof THREE.MeshStandardMaterial) {
            clonedMat.polygonOffset = isSkinLayer;
            clonedMat.polygonOffsetFactor = isSkinLayer ? -1 : 0;
            clonedMat.polygonOffsetUnits = isSkinLayer ? -1 : 0;
          }
          return clonedMat;
        })
      : (() => {
          const clonedMat = mesh.material.clone();
          if (clonedMat instanceof THREE.MeshStandardMaterial) {
            clonedMat.polygonOffset = isSkinLayer;
            clonedMat.polygonOffsetFactor = isSkinLayer ? -1 : 0;
            clonedMat.polygonOffsetUnits = isSkinLayer ? -1 : 0;
          }
          return clonedMat;
        })();
  });
  return clone;
}

export function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();

    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        material.dispose();
      }
    }
  });
}

interface WebGLShader {
  uniforms: { [uniform: string]: any };
  vertexShader: string;
  fragmentShader: string;
}

type DamageFlashMaterial = THREE.MeshStandardMaterial & {
  userData: THREE.MeshStandardMaterial['userData'] & {
    damageFlashShader?: WebGLShader;
    damageFlashShaderInstalled?: boolean;
  };
};

const DAMAGE_FLASH_COLOR = new THREE.Color(0xbd2f2f);
const DAMAGE_FLASH_SHADER_KEY = 'skin-preview-damage-flash';

function installDamageFlashShader(material: THREE.MeshStandardMaterial, intensity: number) {
  const damageMaterial = material as DamageFlashMaterial;

  if (damageMaterial.userData.damageFlashShaderInstalled) {
    return;
  }

  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousCustomProgramCacheKey = material.customProgramCacheKey.bind(material);

  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);

    shader.uniforms.uDamageFlashIntensity = { value: intensity };
    shader.uniforms.uDamageFlashColor = { value: DAMAGE_FLASH_COLOR };
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nuniform float uDamageFlashIntensity;\nuniform vec3 uDamageFlashColor;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      'gl_FragColor.rgb = mix(gl_FragColor.rgb, uDamageFlashColor, uDamageFlashIntensity * gl_FragColor.a);\n#include <dithering_fragment>',
    );

    damageMaterial.userData.damageFlashShader = shader;
  };

  material.customProgramCacheKey = () =>
    `${previousCustomProgramCacheKey()}|${DAMAGE_FLASH_SHADER_KEY}`;
  damageMaterial.userData.damageFlashShaderInstalled = true;
  material.needsUpdate = true;
}

export function syncDamageFlashMaterial(material: THREE.MeshStandardMaterial, intensity: number) {
  installDamageFlashShader(material, intensity);

  const shader = (material as DamageFlashMaterial).userData.damageFlashShader;
  if (shader) {
    shader.uniforms.uDamageFlashIntensity.value = intensity;
  }
}

export function syncDamageFlashShader(scene: THREE.Object3D | null, intensity: number) {
  if (!scene) return;

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.name === 'cape') return;

      syncDamageFlashMaterial(material, intensity);
    });
  });
}

