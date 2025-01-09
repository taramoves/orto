"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import * as THREE from 'three';

const initialMeasurements = {
  // Fracture characteristics
  fractureLength: 300, // Total length in mm
  fracturePosition: 150, // Position from proximal end in mm
  
  // Displacement in mm (using standard anatomical terms)
  medialDisplacement: 0,    // X-axis: + is medial, - is lateral
  anteriorDisplacement: 0,  // Z-axis: + is anterior, - is posterior
  proximalDisplacement: 0,  // Y-axis: + is proximal (shortening), - is distal (distraction)
  
  // Angulation in degrees
  valgusAngulation: 0,     // Rotation around Z-axis: + is valgus, - is varus
  anteversionAngulation: 0, // Rotation around X-axis: + is anteversion, - is retroversion
  rotationalAngulation: 0   // Rotation around Y-axis: + is external, - is internal
};

const FractureVisualization = () => {
  const [measurements, setMeasurements] = useState(initialMeasurements);
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const proximalBoneRef = useRef(null);
  const distalBoneRef = useRef(null);

  // Function to create or update bone geometries
  const updateBoneGeometries = (scene) => {
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
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  // Update bones when measurements change
  useEffect(() => {
    if (!sceneRef.current || !distalBoneRef.current) return;

    // Update geometries when fracture position changes
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
    const toRad = (deg) => (deg * Math.PI) / 180;

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

  }, [measurements]);

  const handleMeasurementChange = (key, value) => {
    setMeasurements(prev => ({
      ...prev,
      [key]: parseFloat(value) || 0
    }));
  };

  const InputGroup = ({ label, value, onChange, unit = "" }) => (
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

  return (
    <Card className="w-full max-w-7xl">
      <CardHeader>
        <CardTitle>Fracture Visualization Tool</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row gap-4">
          <div 
            ref={containerRef} 
            className="w-2/3 h-[800px] bg-white rounded-lg"
          />
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