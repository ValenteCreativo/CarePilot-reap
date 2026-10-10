'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

type Lang = 'en' | 'es';

const sceneCopy: Record<Lang, { aria: string; loading: string; ready: string }> = {
  en: { aria: 'CarePilot 3D otter, your care companion', loading: 'Your companion is arriving…', ready: 'Always close to you.' },
  es: { aria: 'Nutria 3D de CarePilot, tu compañero de cuidado', loading: 'Tu compañero está llegando…', ready: 'Siempre cerca de ti.' },
};

export default function OtterScene({ progress, lang = 'en' }: { progress: RefObject<number>; lang?: Lang }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); }
    catch {
      queueMicrotask(() => { if (!disposed) setStatus('fallback'); });
      return () => { disposed = true; };
    }
    let frame = 0;
    let loaded = false;
    let smoothScroll = progress.current;
    let smoothPointerX = 0;
    let smoothPointerY = 0;
    let lastTime = performance.now();
    let compact = innerWidth <= 700;
    let horizontalExtent = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
    camera.position.set(0, .15, 6.3);
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth <= 700 ? 1.25 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    container.appendChild(renderer.domElement);
    // Neutral, soft lighting keeps the original brown texture from washing out.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(3, 4, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, .65); rim.position.set(-3, 2, -3); scene.add(rim);
    const pivot = new THREE.Group(); scene.add(pivot);
    const disposeModel = (object: THREE.Object3D) => object.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
          material.dispose();
        }
      }
    });
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.load('/models/otter-web.glb', gltf => {
      if (disposed) { disposeModel(gltf.scene); return; }
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      model.scale.setScalar(3.7 / Math.max(size.x, size.y, size.z));
      bounds.setFromObject(model);
      model.position.sub(bounds.getCenter(new THREE.Vector3()));
      model.traverse(child => {
        if (child instanceof THREE.Mesh) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) if (material instanceof THREE.MeshStandardMaterial) {
            material.roughness = .95; material.metalness = 0;
            if (material.map) material.map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
          }
        }
      });
      pivot.add(model); loaded = true; setStatus('ready');
    }, undefined, () => { if (!disposed) setStatus('fallback'); });
    const pointer = new THREE.Vector2();
    const move = (event: PointerEvent) => { pointer.set(event.clientX / innerWidth * 2 - 1, event.clientY / innerHeight * 2 - 1); };
    const resize = () => {
      const width = container.clientWidth, height = container.clientHeight;
      compact = innerWidth <= 700;
      camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix();
      horizontalExtent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    addEventListener('pointermove', move, { passive: true });
    const framingKeys = [[0, .46], [.16, .46], [.29, -.46], [.41, -.46], [.54, .46], [.66, .46], [.79, -.46], [1, -.46]];
    const startedAt = performance.now();
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      if (document.hidden) return;
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, .05);
      lastTime = now;
      const damping = 1 - Math.exp(-7 * delta);
      smoothScroll += (progress.current - smoothScroll) * damping;
      smoothPointerX += (pointer.x - smoothPointerX) * damping;
      smoothPointerY += (pointer.y - smoothPointerY) * damping;
      const elapsed = (performance.now() - startedAt) / 1000;
      // Rotate around the normalized model center, preserving its original textures.
      pivot.rotation.y = reduced ? 0 : smoothScroll * Math.PI * 2 + smoothPointerX * .08;
      pivot.rotation.x = reduced ? 0 : smoothPointerY * .025;
      pivot.position.y = reduced ? 0 : Math.sin(elapsed * .65) * .045;
      // Holds each composition, then crosses smoothly before the next chapter appears.
      const keys = framingKeys;
      let framing = keys[keys.length - 1][1];
      for (let i = 0; i < keys.length - 1; i++) {
        if (smoothScroll >= keys[i][0] && smoothScroll <= keys[i + 1][0]) {
          const t = (smoothScroll - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
          const ease = t * t * (3 - 2 * t);
          framing = THREE.MathUtils.lerp(keys[i][1], keys[i + 1][1], ease);
          break;
        }
      }
      pivot.position.x = compact ? 0 : framing * horizontalExtent;
      pivot.scale.setScalar(compact ? 1 : .93 + Math.sin(smoothScroll * Math.PI) * .05);
      if (loaded) renderer.render(scene, camera);
    };
    animate();
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); removeEventListener('pointermove', move);
      disposeModel(pivot); renderer.dispose(); renderer.domElement.remove();
    };
  }, [progress]);
  const text = sceneCopy[lang];
  return <div className={`otter-scene scene-${status}`} ref={host} role="img" aria-label={text.aria}>
    {status !== 'ready' && <div className="otter-placeholder"><Image src="/images/logos/otters.png" alt="" width={480} height={400} priority /><span role="status">{status === 'loading' ? text.loading : text.ready}</span></div>}
  </div>;
}
