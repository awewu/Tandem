'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import type { FloorPlanData } from './FloorPlanCanvas';

export interface Model3DPreviewProps {
  data: FloorPlanData;
}

export default function Model3DPreview({ data }: Model3DPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6);

    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 1, 10000);
    camera.position.set(0, 800, 800);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(200, 500, 300);
    scene.add(dir);

    // Floor grid
    const grid = new THREE.GridHelper(2000, 40, 0x9ca3af, 0xd1d5db);
    scene.add(grid);

    // Walls as 3D boxes
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x374151 });
    for (const wall of data.walls) {
      const [x1, y1, x2, y2] = wall.points;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const thickness = wall.thickness;
      const height = 250; // cm
      const geometry = new THREE.BoxGeometry(length, height, thickness);
      const mesh = new THREE.Mesh(geometry, wallMaterial);
      mesh.position.set((x1 + x2) / 2, height / 2, (y1 + y2) / 2);
      mesh.rotation.y = -angle;
      scene.add(mesh);
    }

    // Rooms as flat slabs
    const roomMaterial = new THREE.MeshLambertMaterial({ color: 0xbfdbfe, transparent: true, opacity: 0.5 });
    for (const room of data.rooms) {
      const geometry = new THREE.BoxGeometry(room.width, 5, room.height);
      const mesh = new THREE.Mesh(geometry, roomMaterial);
      mesh.position.set(room.x + room.width / 2, 2.5, room.y + room.height / 2);
      scene.add(mesh);
    }

    // Pipes as cylinders
    const pipeMaterial = new THREE.MeshLambertMaterial({ color: 0x8b5cf6 });
    for (const pipe of data.pipes ?? []) {
      const { start, end, diameterMm } = pipe;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const dz = (end.z ?? 0) - (start.z ?? 0);
      const length = Math.hypot(dx, dy, dz) || 0.01;
      const radius = diameterMm / 2 / 10; // mm -> cm
      const geometry = new THREE.CylinderGeometry(radius, radius, length, 16);
      const mesh = new THREE.Mesh(geometry, pipeMaterial);
      mesh.position.set((start.x + end.x) / 2, 220, (start.y + end.y) / 2);
      mesh.lookAt(end.x, 220, end.y);
      mesh.rotateX(Math.PI / 2);
      scene.add(mesh);
    }

    // Devices as small boxes
    const deviceMaterial = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
    for (const dev of data.devices ?? []) {
      const geometry = new THREE.BoxGeometry(40, 40, 40);
      const mesh = new THREE.Mesh(geometry, deviceMaterial);
      mesh.position.set(dev.x, 220, dev.y);
      scene.add(mesh);
    }

    // Center camera on content
    const box = new THREE.Box3();
    let hasObject = false;
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        box.expandByObject(obj);
        hasObject = true;
      }
    });
    if (hasObject) {
      const center = box.getCenter(new THREE.Vector3());
      controls.target.copy(center);
    }

    let active = true;
    const animate = () => {
      if (!active) return;
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!el) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      active = false;
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [data]);

  return <div ref={containerRef} className="w-full h-full min-h-[400px]" />;
}
