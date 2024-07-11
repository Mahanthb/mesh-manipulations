import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Stats, OrbitControls } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import GUI from 'lil-gui';
import { Raycaster, Vector2, AnimationMixer, Box3, Vector3 } from 'three';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, listAll, getDownloadURL, uploadBytes } from 'firebase/storage';
import CardComponent from './CardComponent';
import './App.css';

const firebaseConfig = {
  apiKey: "AIzaSyCfWYRWOQyNrn9WGv3Wfz_EM47ZpbL_Yqs",
  authDomain: "virtual-world-84ce0.firebaseapp.com",
  projectId: "virtual-world-84ce0",
  storageBucket: "virtual-world-84ce0.appspot.com",
  messagingSenderId: "306111432374",
  appId: "1:306111432374:web",
  measurementId: "G-1K1M3CNJR7"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

function App() {
  const [model, setModel] = useState(null);
  const [animations, setAnimations] = useState(null);
  const [lightProperties, setLightProperties] = useState({
    type: 'ambientLight',
    color: '#ffffff',
    intensity: 3,
    position: { x: 10, y: 10, z: 10 },
  });
  const [sceneProperties, setSceneProperties] = useState({
    wireframe: false,
    autoRotate: false,
    backgroundColor: '#aaaaaa',
    showGrid: false,
    gridSize: 50,
    gridDivisions: 50,
  });
  const [firebaseFiles, setFirebaseFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(true);
  const [modelDimensions, setModelDimensions] = useState({ width: 0, height: 0, depth: 0 });
  const guiRef = useRef(null);

  useEffect(() => {
    const gui = new GUI();

    const lightFolder = gui.addFolder('Light Properties');
    lightFolder.add(lightProperties, 'type', ['ambientLight', 'directionalLight', 'pointLight', 'spotLight']).name('Type').onChange((value) => {
      setLightProperties((prev) => ({ ...prev, type: value }));
    });
    lightFolder.addColor(lightProperties, 'color').name('Color').onChange((value) => {
      setLightProperties((prev) => ({ ...prev, color: value }));
    });
    lightFolder.add(lightProperties, 'intensity', 0, 10).name('Intensity').onChange((value) => {
      setLightProperties((prev) => ({ ...prev, intensity: value }));
    });

    const positionFolder = lightFolder.addFolder('Position');
    positionFolder.add(lightProperties.position, 'x', -50, 50).name('X').onChange((value) => {
      setLightProperties((prev) => ({ ...prev, position: { ...prev.position, x: value } }));
    });
    positionFolder.add(lightProperties.position, 'y', -50, 50).name('Y').onChange((value) => {
      setLightProperties((prev) => ({ ...prev, position: { ...prev.position, y: value } }));
    });
    positionFolder.add(lightProperties.position, 'z', -50, 50).name('Z').onChange((value) => {
      setLightProperties((prev) => ({ ...prev, position: { ...prev.position, z: value } }));
    });

    const sceneFolder = gui.addFolder('Scene Properties');
    sceneFolder.add(sceneProperties, 'wireframe').name('Wireframe').onChange((value) => {
      setSceneProperties((prev) => ({ ...prev, wireframe: value }));
    });
    sceneFolder.add(sceneProperties, 'autoRotate').name('Auto Rotate').onChange((value) => {
      setSceneProperties((prev) => ({ ...prev, autoRotate: value }));
    });
    sceneFolder.addColor(sceneProperties, 'backgroundColor').name('Background Color').onChange((value) => {
      setSceneProperties((prev) => ({ ...prev, backgroundColor: value }));
    });
    sceneFolder.add(sceneProperties, 'showGrid').name('Show Grid').onChange((value) => {
      setSceneProperties((prev) => ({ ...prev, showGrid: value }));
    });
    sceneFolder.add(sceneProperties, 'gridSize', 1, 100).name('Grid Size').onChange((value) => {
      setSceneProperties((prev) => ({ ...prev, gridSize: value }));
    });
    sceneFolder.add(sceneProperties, 'gridDivisions', 1, 100).name('Grid Divisions').onChange((value) => {
      setSceneProperties((prev) => ({ ...prev, gridDivisions: value }));
    });

    const dimensionsFolder = gui.addFolder('Dimensions');
    const modelDimensionsController = dimensionsFolder;
    modelDimensionsController.add(modelDimensions, 'width').name('Width').listen();
    modelDimensionsController.add(modelDimensions, 'height').name('Height').listen();
    modelDimensionsController.add(modelDimensions, 'depth').name('Depth').listen();

    const meshFolder = gui.addFolder('Mesh Hierarchy');

    const printMeshHierarchy = (object, folder) => {
      const subFolder = folder.addFolder(object.name || 'Unnamed');
      if (object.children) {
        object.children.forEach((child) => printMeshHierarchy(child, subFolder));
      }
    };

    if (model) {
      printMeshHierarchy(model, meshFolder);
    }

    positionFolder.close();
    sceneFolder.close();
    dimensionsFolder.close();
    meshFolder.close();

    guiRef.current = gui;

    return () => {
      gui.destroy();
    };
  }, [lightProperties, sceneProperties, model]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const loader = new GLTFLoader();
    loader.load(URL.createObjectURL(file), (gltf) => {
      setModel(gltf.scene);
      setAnimations(gltf.animations);
      updateModelDimensions(gltf.scene);
    });
  };

  const handleFirebaseFileUpload = async (url) => {
    setLoading(true);
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        setModel(gltf.scene);
        setAnimations(gltf.animations);
        updateModelDimensions(gltf.scene);
        setLoading(false);
      },
      undefined,
      (error) => {
        console.error('An error happened while loading the model:', error);
        setLoading(false);
      }
    );
  };

  const loadFirebaseFiles = async () => {
    const listRef = ref(storage, '/');
    const res = await listAll(listRef);
    const files = await Promise.all(res.items.map(async (itemRef) => {
      const url = await getDownloadURL(itemRef);
      return { name: itemRef.name, url };
    }));
    setFirebaseFiles(files);
  };

  const handleExportToLocal = async () => {
    const exporter = new GLTFExporter();
    if (model) {
      exporter.parse(
        model,
        (result) => {
          const output = JSON.stringify(result, null, 2);
          const blob = new Blob([output], { type: 'application/json' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'modified_model.gltf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        },
        { binary: false }
      );
    }
  };

  const handleExportToFirebase = async () => {
    const exporter = new GLTFExporter();
    if (model) {
      exporter.parse(
        model,
        async (result) => {
          const output = JSON.stringify(result, null, 2);
          const blob = new Blob([output], { type: 'application/json' });

          let fileName = window.prompt('Enter a name for the file (without extension):');
          if (!fileName) {
            fileName = 'model'; // Default filename if user cancels prompt
          }

          fileName += '.gltf'; // Ensure the filename ends with .gltf

          const storageRef = ref(storage, fileName);
          await uploadBytes(storageRef, blob);
          alert(`Model "${fileName}" uploaded to Firebase successfully!`);
        },
        { binary: false }
      );
    }
  };

  useEffect(() => {
    loadFirebaseFiles();
  }, []);

  const handleSelectChange = (event) => {
    const selectedFile = firebaseFiles.find(file => file.name === event.target.value);
    setSelectedFile(selectedFile.url);
    handleFirebaseFileUpload(selectedFile.url);
  };

  const toggleAnimation = () => {
    setIsAnimationPlaying(!isAnimationPlaying);
  };

  const updateModelDimensions = (loadedModel) => {
    if (loadedModel) {
      const box = new Box3().setFromObject(loadedModel);
      const size = box.getSize(new Vector3());
      const dimensions = {
        width: size.x.toFixed(2),
        height: size.y.toFixed(2),
        depth: size.z.toFixed(2),
      };
      setModelDimensions(dimensions);
      console.log('Model Dimensions:', dimensions);
    }
  };


  return (
    <div className="app-container">
      <CardComponent
        handleFileUpload={handleFileUpload}
        selectedFile={selectedFile}
        firebaseFiles={firebaseFiles}
        handleSelectChange={handleSelectChange}
        handleExportToLocal={handleExportToLocal}
        handleExportToFirebase={handleExportToFirebase}
        toggleAnimation={toggleAnimation}
        isAnimationPlaying={isAnimationPlaying}
        loading={loading}
      />

      <Canvas style={{ height: 'calc(100vh - 120px)', width: '100%', background: sceneProperties.backgroundColor }}>
        <Stats className='stats' />
        <OrbitControls autoRotate={sceneProperties.autoRotate} />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        <pointLight position={[-10, -10, -10]} />
        <Scene
          model={model}
          animations={animations}
          lightProperties={lightProperties}
          sceneProperties={sceneProperties}
          isAnimationPlaying={isAnimationPlaying}
        />
      </Canvas>
    </div>
  );
}

function HoverHighlight({ setHoveredObject, setSelectedObject }) {
  const { gl, scene, camera } = useThree();
  const raycaster = useMemo(() => new Raycaster(), []);
  const mouse = useRef(new Vector2());
  const canvasRef = useRef(gl.domElement);
  const previousHoveredObject = useRef(null);
  const originalColor = useRef(null);

  const onMouseMove = useCallback((event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }, []);

  const onClick = useCallback(() => {
    if (previousHoveredObject.current) {
      setSelectedObject(previousHoveredObject.current);
      console.log('Clicked Mesh:', previousHoveredObject.current.name);
    }
  }, [setSelectedObject]);

  useEffect(() => {
    canvasRef.current.addEventListener('mousemove', onMouseMove);
    canvasRef.current.addEventListener('click', onClick);
    return () => {
      canvasRef.current.removeEventListener('mousemove', onMouseMove);
      canvasRef.current.removeEventListener('click', onClick);
    };
  }, [onMouseMove, onClick]);

  useFrame(() => {
    raycaster.setFromCamera(mouse.current, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      const object = intersects[0].object;
      setHoveredObject(object);

      if (previousHoveredObject.current && previousHoveredObject.current !== object) {
        previousHoveredObject.current.material.emissive.setHex(originalColor.current);
      }

      if (object.material && object.material.emissive) {
        if (previousHoveredObject.current !== object) {
          originalColor.current = object.material.emissive.getHex();
          previousHoveredObject.current = object;
        }
        if (object !== setSelectedObject) {
          object.material.emissive.setHex(0xaaaaaa);
        }
      }
    } else {
      if (previousHoveredObject.current) {
        previousHoveredObject.current.material.emissive.setHex(originalColor.current);
        previousHoveredObject.current = null;
        originalColor.current = null;
      }
      setHoveredObject(null);
    }
  });

  return null;
}

function Scene({ model, animations, lightProperties, sceneProperties, isAnimationPlaying }) {
  const { scene, camera, gl } = useThree();
  const [selectedMesh, setSelectedMesh] = useState(null);
  const [hoveredMesh, setHoveredMesh] = useState(null);
  const guiRef = useRef(null);
  const mixer = useRef(null);
  const [activeAction, setActiveAction] = useState(null);

  useEffect(() => {
    if (model) {
      scene.add(model);
      if (animations && animations.length > 0) {
        mixer.current = new AnimationMixer(model);
        const action = mixer.current.clipAction(animations[0]);
        action.play();
        setActiveAction(action);
      }
    }
    return () => {
      if (model) {
        scene.remove(model);
      }
      if (mixer.current) {
        mixer.current.stopAllAction();
        mixer.current = null;
        setActiveAction(null);
      }
    };
  }, [model, animations, scene]);

  useEffect(() => {
    if (selectedMesh && selectedMesh.isMesh) {
      setupMeshGUI(selectedMesh);
    }
  }, [selectedMesh]);

  useEffect(() => {
    if (model) {
      model.traverse((child) => {
        if (child.isMesh) {
          child.material.wireframe = sceneProperties.wireframe;
        }
      });
    }
  }, [model, sceneProperties.wireframe]);

  // Adjust camera position to fit model in the viewport
  useEffect(() => {
    if (model) {
      const box = new Box3().setFromObject(model);
      const size = box.getSize(new Vector3()).length();
      const center = box.getCenter(new Vector3());

      // Set camera position based on bounding box and size of the model
      const cameraOffset = 1.5;
      const cameraPosition = new Vector3().copy(center);
      cameraPosition.x += size / 2.0;
      cameraPosition.y += size / 4.0;
      cameraPosition.z += size * cameraOffset;

      camera.position.copy(cameraPosition);
      camera.lookAt(center);
    }
  }, [model, camera]);

  useFrame((state, delta) => {
    if (mixer.current && isAnimationPlaying) {
      mixer.current.update(delta);
    }
  });

  const setupMeshGUI = (mesh) => {
    if (guiRef.current) {
      guiRef.current.destroy();
    }

    guiRef.current = new GUI();

    if (mesh.geometry) {
      const geometry = mesh.geometry;
      const vertexCount = geometry.attributes.position.count;
      const triangleCount = geometry.index ? geometry.index.count / 3 : vertexCount / 3;
      const edgeCount = vertexCount;

      const meshFolder = guiRef.current.addFolder('Mesh Properties');
      const colorOptions = {
        Color: mesh.material.color.getStyle(),
      };
      const selectedMeshText = {
        Name: mesh.name || 'Unnamed',
      };
      meshFolder.add(selectedMeshText, 'Name').name('Selected Mesh');
      meshFolder.addColor(colorOptions, 'Color').name('Color').onChange((value) => {
        mesh.material.color.set(value);
      });

      meshFolder.add(mesh.material, 'wireframe').name('Wireframe');
      meshFolder.add(mesh.material, 'transparent').name('Transparent').onChange((value) => {
        mesh.material.transparent = value;
      });
      meshFolder.add(mesh.material, 'opacity', 0, 1).name('Opacity').onChange((value) => {
        mesh.material.transparent = value < 1;
        mesh.material.opacity = value;
        mesh.material.depthWrite = value >= 1; // Disable depth write for transparent objects
      });

      const positionFolder = meshFolder.addFolder('Position');
      positionFolder.add(selectedMesh.position, 'x', -50, 50).name('X');
      positionFolder.add(selectedMesh.position, 'y', -50, 50).name('Y');
      positionFolder.add(selectedMesh.position, 'z', -50, 50).name('Z');

      const rotationFolder = meshFolder.addFolder('Rotation');
      rotationFolder.add(selectedMesh.rotation, 'x', -Math.PI, Math.PI).name('X');
      rotationFolder.add(selectedMesh.rotation, 'y', -Math.PI, Math.PI).name('Y');
      rotationFolder.add(selectedMesh.rotation, 'z', -Math.PI, Math.PI).name('Z');

      const scaleFolder = meshFolder.addFolder('Scale');
      scaleFolder.add(selectedMesh.scale, 'x', 0.1, 10).name('X');
      scaleFolder.add(selectedMesh.scale, 'y', 0.1, 10).name('Y');
      scaleFolder.add(selectedMesh.scale, 'z', 0.1, 10).name('Z');

      const infoFolder = meshFolder.addFolder('Mesh Info');
      infoFolder.add({ Vertices: vertexCount }, 'Vertices').name('Vertices').listen();
      infoFolder.add({ Edges: edgeCount }, 'Edges').name('Edges').listen();
      infoFolder.add({ Triangles: triangleCount }, 'Triangles').name('Triangles').listen();

      meshFolder.open();
    }
  };


  return (
    <>
      <HoverHighlight setHoveredObject={setHoveredMesh} setSelectedObject={setSelectedMesh} />
      {lightProperties.type === 'ambientLight' ? (
        <ambientLight intensity={lightProperties.intensity} color={lightProperties.color} />
      ) : lightProperties.type === 'directionalLight' ? (
        <directionalLight
          intensity={lightProperties.intensity}
          color={lightProperties.color}
          position={[lightProperties.position.x, lightProperties.position.y, lightProperties.position.z]}
        />
      ) : lightProperties.type === 'pointLight' ? (
        <pointLight
          intensity={lightProperties.intensity}
          color={lightProperties.color}
          position={[lightProperties.position.x, lightProperties.position.y, lightProperties.position.z]}
        />
      ) : lightProperties.type === 'spotLight' ? (
        <spotLight
          intensity={lightProperties.intensity}
          color={lightProperties.color}
          position={[lightProperties.position.x, lightProperties.position.y, lightProperties.position.z]}
          angle={Math.PI / 5}
          penumbra={0.2}
          castShadow
        />
      ) : null}
      {sceneProperties.showGrid && (
        <gridHelper args={[sceneProperties.gridSize, sceneProperties.gridDivisions]} />
      )}
    </>
  );
}


export default App;
