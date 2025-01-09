"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import * as THREE from 'three';

const initialMeasurements = {
  // Fracture characteristics
  fractureLength: 300,
  fracturePosition: 150,
  
  // Displacement in mm
  medialDisplacement: 0,
  anteriorDisplacement: 0,
  proximalDisplacement: 0,
  
  // Angulation in degrees
  valgusAngulation: 0,
  anteversionAngulation: 0,
  rotationalAngulation: 0
} as const;  // Make this object readonly

// Type definitions
type MeasurementKey = keyof typeof initialMeasurements;
type Measurements = typeof initialMeasurements;

interface InputGroupProps {
  label: string;
  value: number;
  onChange: (value: string) => void;
  unit?: string;
}

const InputGroup: React.FC<InputGroupProps> = ({ label, value, onChange, unit = "" }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium">
      {label} {unit && `(${unit})`}
    </label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 border rounded"
    />
  </div>
);

const FractureVisualization: React.FC = () => {
  const [measurements, setMeasurements] = useState<Measurements>(initialMeasurements);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>(null);
  const rendererRef = useRef<THREE.WebGLRenderer>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const proximalBoneRef = useRef<THREE.Mesh>(null);
  const distalBoneRef = useRef<THREE.Mesh>(null);
  const [isAnteriorView, setIsAnteriorView] = useState(true);

  const updateBoneGeometries = (scene: THREE.Scene): void => {
    const radius = 15;
    const radialSegments = 32;

    // Remove existing bones if they exist
    if (proximalBoneRef.current) scene.remove(proximalBoneRef.current);
    if (distalBoneRef.current) scene.remove(distalBoneRef.current);

    // Create proximal bone
    const proximalGeometry = new THREE.CylinderGeometry(
      radius,
      radius * 0.9,
      measurements.fracturePosition,
      radialSegments
    );
    const proximalMaterial = new THREE.MeshPhongMaterial({
      color: 0x90ee90,
      transparent: true,
      opacity: 0.5,
    });
    const proximalBone = new THREE.Mesh(proximalGeometry, proximalMaterial);
    // Position from origin (top) to fracture point
    proximalBone.position.y = -measurements.fracturePosition/2;
    scene.add(proximalBone);
    proximalBoneRef.current = proximalBone;

    // Create distal bone
    const distalLength = measurements.fractureLength - measurements.fracturePosition;
    const distalGeometry = new THREE.CylinderGeometry(
      radius * 0.9,
      radius * 0.8,
      distalLength,
      radialSegments
    );
    const distalMaterial = new THREE.MeshPhongMaterial({
      color: 0xffb6c1,
      transparent: true,
      opacity: 0.5,
    });
    const distalBone = new THREE.Mesh(distalGeometry, distalMaterial);
    
    // Position at fracture point
    distalBone.position.y = -measurements.fracturePosition - distalLength/2;
    
    scene.add(distalBone);
    distalBoneRef.current = distalBone;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 500);
    camera.lookAt(0, -150, 0);  // Look at center of bone
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(400, 40);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(100);
    scene.add(axesHelper);

    // Store ref value in variable for cleanup
    const container = containerRef.current;

    // Initial bone creation
    updateBoneGeometries(scene);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      renderer.dispose();
      container?.removeChild(renderer.domElement);
    };
  }, []);  // Empty dependency array is fine here as it's setup code

  // Update bones when measurements change
  useEffect(() => {
    if (!sceneRef.current || !distalBoneRef.current) return;

    updateBoneGeometries(sceneRef.current);

    const distalBone = distalBoneRef.current;

    // Create pivot point at fracture position
    const pivot = new THREE.Object3D();
    pivot.position.y = -measurements.fracturePosition;
    sceneRef.current.add(pivot);

    // Reset distal bone position to anatomical position
    const distalLength = measurements.fractureLength - measurements.fracturePosition;
    distalBone.position.set(0, -measurements.fracturePosition - distalLength/2, 0);
    distalBone.rotation.set(0, 0, 0);

    // Apply transformations relative to fracture point
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    // Attach distal bone to pivot for rotations
    pivot.attach(distalBone);
    
    // Apply rotations to pivot
    pivot.rotation.z = toRad(measurements.valgusAngulation);
    pivot.rotation.x = toRad(measurements.anteversionAngulation);
    pivot.rotation.y = toRad(measurements.rotationalAngulation);

    // Apply displacements
    distalBone.position.x += measurements.medialDisplacement;
    distalBone.position.z += measurements.anteriorDisplacement;
    distalBone.position.y -= measurements.proximalDisplacement;

    // Re-attach to scene
    sceneRef.current.attach(distalBone);
    sceneRef.current.remove(pivot);

  }, [measurements]);  // Add measurements to dependency array

  const handleMeasurementChange = (key: MeasurementKey, value: string): void => {
    setMeasurements(prev => ({
      ...prev,
      [key]: parseFloat(value) || 0
    }));
  };

  const toggleView = () => {
    if (!cameraRef.current) return;
    
    setIsAnteriorView(prev => !prev);
    const camera = cameraRef.current;
    
    if (isAnteriorView) {
      // Move to lateral (side) view
      camera.position.set(500, 0, 0);
    } else {
      // Move to anterior (front) view
      camera.position.set(0, 0, 500);
    }
    camera.lookAt(0, -150, 0);
  };

  return (
    <Card className="w-full max-w-7xl">
      <CardHeader>
        <CardTitle>Fracture Visualization Tool</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row gap-4">
          <div className="w-2/3">
            <button
              onClick={toggleView}
              className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {isAnteriorView ? 'Switch to Side View' : 'Switch to Front View'}
            </button>
            <div 
              ref={containerRef} 
              className="w-full h-[800px] bg-white rounded-lg"
            />
          </div>
          <div className="w-1/3 space-y-4 overflow-y-auto max-h-[800px]">
            <div className="space-y-4">
              <h3 className="font-semibold">Displacement Measurements</h3>
              <InputGroup
                label="Medial/Lateral"
                value={measurements.medialDisplacement}
                onChange={(v) => handleMeasurementChange('medialDisplacement', v)}
                unit="mm (+medial/-lateral)"
              />
              <InputGroup
                label="Anterior/Posterior"
                value={measurements.anteriorDisplacement}
                onChange={(v) => handleMeasurementChange('anteriorDisplacement', v)}
                unit="mm (+ant/-post)"
              />
              <InputGroup
                label="Proximal/Distal"
                value={measurements.proximalDisplacement}
                onChange={(v) => handleMeasurementChange('proximalDisplacement', v)}
                unit="mm (+prox/-dist)"
              />
            </div>

            <div className="space-y-4 mt-4">
              <h3 className="font-semibold">Angulation</h3>
              <InputGroup
                label="Valgus/Varus"
                value={measurements.valgusAngulation}
                onChange={(v) => handleMeasurementChange('valgusAngulation', v)}
                unit="deg (+valgus/-varus)"
              />
              <InputGroup
                label="Anteversion/Retroversion"
                value={measurements.anteversionAngulation}
                onChange={(v) => handleMeasurementChange('anteversionAngulation', v)}
                unit="deg (+ante/-retro)"
              />
              <InputGroup
                label="Rotation"
                value={measurements.rotationalAngulation}
                onChange={(v) => handleMeasurementChange('rotationalAngulation', v)}
                unit="deg (+ext/-int)"
              />
            </div>

            <div className="space-y-4 mt-4">
              <h3 className="font-semibold">Bone Parameters</h3>
              <InputGroup
                label="Total Length"
                value={measurements.fractureLength}
                onChange={(v) => handleMeasurementChange('fractureLength', v)}
                unit="mm"
              />
              <InputGroup
                label="Fracture Position"
                value={measurements.fracturePosition}
                onChange={(v) => handleMeasurementChange('fracturePosition', v)}
                unit="mm from proximal"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FractureVisualization;