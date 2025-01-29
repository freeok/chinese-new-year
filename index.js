let scene, camera, renderer, city, composer;
const buildings = [];
let buildingBoundingBoxes = [];
let lastTime = performance.now();
let frameCount = 0;
let buildingGeometries = {};
let windowGeometry;
let windowMaterial;
let cameraAngle = 0;
let cameraHeight = 50;
let cameraRadius = 100;
let cars = [];
let roadNetwork = [];
let audioPlayer = null;
let currentTrack = '';
let lastTrackCheck = 0;
let fireworks = [];

function isColliding(position, boundingBoxes) {
  const cameraBox = new THREE.Box3().setFromCenterAndSize(position, new THREE.Vector3(2, 2, 2));
  return boundingBoxes.some(box => box.intersectsBox(cameraBox));
}

function clampHeight(y) {
  const MIN_HEIGHT = 20;
  const MAX_HEIGHT = 300;
  return Math.max(MIN_HEIGHT, Math.min(y, MAX_HEIGHT));
}

function init() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a001a, 0.002);
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 50, 100);
  renderer = new THREE.WebGLRenderer({
    antialias: window.devicePixelRatio < 2,
    powerPreference: "high-performance",
    precision: "mediump",
    stencil: false,
    depth: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x0a001a);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('retrowaveCity').appendChild(renderer.domElement);
  buildingGeometries = {
    small: new THREE.BoxGeometry(10, 30, 10),
    medium: new THREE.BoxGeometry(15, 50, 15),
    large: new THREE.BoxGeometry(20, 100, 20)
  };
  windowGeometry = new THREE.BoxGeometry(0.5, 1, 0.5);
  windowMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1
  });
  const gridHelper = createAnimatedGrid();
  scene.add(gridHelper);
  createCity();
  const ambientLight = new THREE.AmbientLight(0x101010);
  scene.add(ambientLight);
  const {
    sun,
    flare
  } = createSun();
  const pointLight = new THREE.PointLight(0xff2d95, 2, 1000);
  pointLight.position.set(0, 200, 0);
  pointLight.castShadow = true;
  scene.add(pointLight);
  const pointLight2 = new THREE.PointLight(0x00ffff, 2, 1000);
  pointLight2.position.set(100, 200, 100);
  pointLight2.castShadow = true;
  scene.add(pointLight2);
  createStarfield();
  createFogParticles();
  generateRoadNetwork();
  spawnCars();
  document.querySelector('.loading').style.display = 'none';
  onWindowResize();
  adjustQualitySettings();
  updateNowPlaying();
}

function createAnimatedGrid() {
  const size = 1000;
  const divisions = 100;
  const gridHelper = new THREE.GridHelper(size, divisions, 0xff2d95, 0x00ffff);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.3;
  gridHelper.userData.offset = 0;
  gridHelper.userData.update = time => {
    gridHelper.position.z = Math.sin(time * 0.5) * 5;
    gridHelper.material.opacity = 0.3 + Math.sin(time) * 0.1;
  };
  return gridHelper;
}

function createStarfield() {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 3000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 3000;
    positions[i * 3 + 1] = Math.random() * 1500;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 3000;
    const color = Math.random() > 0.5 ? 0xff2d95 : 0x00ffff;
    const c = new THREE.Color(color);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    sizes[i] = Math.random() * 2 + 1;
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const starMaterial = new THREE.PointsMaterial({
    size: 2,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const starfield = new THREE.Points(starGeometry, starMaterial);
  starfield.userData.update = time => {
    const positions = starfield.geometry.attributes.position.array;
    for (let i = 0; i < starCount; i++) {
      positions[i * 3 + 1] += Math.sin(time + i) * 0.1;
    }
    starfield.geometry.attributes.position.needsUpdate = true;
  };
  scene.add(starfield);
}

function createFogParticles() {
  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = 3000;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2000;
    positions[i * 3 + 1] = Math.random() * 400;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2000;
  }
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMaterial = new THREE.PointsMaterial({
    size: 5,
    color: 0x0a001a,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.position.z = -1000;
  particles.userData.update = time => {
    const positions = particles.geometry.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3 + 1] += Math.sin(time + i) * 0.2;
      positions[i * 3] += Math.cos(time + i) * 0.2;
      positions[i * 3 + 2] += Math.sin(time + i * 0.5) * 0.2;
      if (positions[i * 3 + 1] > 400) positions[i * 3 + 1] = 0;
      if (Math.abs(positions[i * 3]) > 1000) positions[i * 3] *= -1;
      if (Math.abs(positions[i * 3 + 2]) > 1000) positions[i * 3 + 2] *= -1;
    }
    particles.geometry.attributes.position.needsUpdate = true;
    particles.material.opacity = 0.4 + Math.sin(time * 0.5) * 0.3;
  };
  particles.renderOrder = -1;
  scene.fog = new THREE.FogExp2(0x0a001a, 0.002);
  scene.add(particles);
}

function createCity() {
  city = new THREE.Group();
  buildingBoundingBoxes = [];
  const GRID_SIZE = 500;
  const MIN_DISTANCE = 40;

  function isValidPosition(position, size) {
    const newBuildingBox = new THREE.Box3(new THREE.Vector3(position.x - size.x / 2, 0, position.z - size.z / 2), new THREE.Vector3(position.x + size.x / 2, size.y, position.z + size.z / 2));
    newBuildingBox.min.x -= MIN_DISTANCE;
    newBuildingBox.min.z -= MIN_DISTANCE;
    newBuildingBox.max.x += MIN_DISTANCE;
    newBuildingBox.max.z += MIN_DISTANCE;
    return !buildingBoundingBoxes.some(box => box.intersectsBox(newBuildingBox));
  }

  function findValidPosition(size) {
    let attempts = 0;
    const maxAttempts = 100;
    while (attempts < maxAttempts) {
      const position = new THREE.Vector3((Math.random() - 0.5) * (GRID_SIZE - size.x), size.y / 2, (Math.random() - 0.5) * (GRID_SIZE - size.z));
      if (isValidPosition(position, size)) {
        return position;
      }
      attempts++;
    }
    return null;
  }

  const buildingConfigs = [{
    geometry: buildingGeometries.large,
    count: 40
  }, {
    geometry: buildingGeometries.medium,
    count: 60
  }, {
    geometry: buildingGeometries.small,
    count: 80
  }];
  for (const config of buildingConfigs) {
    for (let i = 0; i < config.count; i++) {
      const building = createBuilding(config.geometry);
      const size = {
        x: building.geometry.parameters.width * building.scale.x,
        y: building.geometry.parameters.height,
        z: building.geometry.parameters.depth * building.scale.z
      };
      const position = findValidPosition(size);
      if (position) {
        building.position.copy(position);
        buildings.push(building);
        city.add(building);
        const boundingBox = new THREE.Box3().setFromObject(building);
        buildingBoundingBoxes.push(boundingBox);
      }
    }
  }
  scene.add(city);
}

function createBuilding(geometry) {
  const heightVariations = [30, 50, 70, 90, 120];
  const height = heightVariations[Math.floor(Math.random() * heightVariations.length)];
  const width = 10 + Math.random() * 15;
  const depth = 10 + Math.random() * 15;
  const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
  const building = new THREE.Mesh(buildingGeometry, new THREE.MeshPhongMaterial({
    color: 0x000000,
    emissive: new THREE.Color(Math.random() < 0.5 ? 0xff2d95 : 0x00ffff),
    emissiveIntensity: 0.5,
    shininess: 100,
    specular: 0x666666
  }));
  const buildingWidth = buildingGeometry.parameters.width;
  const buildingHeight = buildingGeometry.parameters.height;
  const buildingDepth = buildingGeometry.parameters.depth;
  const windowCount = Math.floor(buildingHeight / 2) * 8;
  const windowInstances = new THREE.InstancedMesh(windowGeometry, windowMaterial, windowCount);
  let instanceIdx = 0;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < buildingHeight / 2; i++) {
    for (let j = 0; j < 8; j++) {
      if (Math.random() > 0.2) {
        dummy.position.set((buildingWidth / 2 - 0.5) * Math.cos(j * Math.PI / 4), -buildingHeight / 2 + i * 2, (buildingDepth / 2 - 0.5) * Math.sin(j * Math.PI / 4));
        dummy.updateMatrix();
        windowInstances.setMatrixAt(instanceIdx++, dummy.matrix);
      }
    }
  }
  building.add(windowInstances);
  const emissiveColors = [0xff2d95, 0x00ffff, 0xff00ff, 0x00ff99];
  const randomColor = emissiveColors[Math.floor(Math.random() * emissiveColors.length)];
  building.material.emissive = new THREE.Color(randomColor);
  building.material.emissiveIntensity = 0.5;
  building.rotation.y = Math.random() * Math.PI * 2;
  const scale = 0.8 + Math.random() * 0.4;
  building.scale.setX(scale);
  building.scale.setZ(scale);
  building.userData.pulsePhase = Math.random() * Math.PI * 2;
  building.userData.pulseSpeed = 0.5 + Math.random() * 2;
  const edges = new THREE.EdgesGeometry(buildingGeometry);
  const edgesMaterial = new THREE.LineBasicMaterial({
    color: randomColor,
    transparent: true,
    opacity: 0.8
  });
  const edgesLines = new THREE.LineSegments(edges, edgesMaterial);
  building.add(edgesLines);
  const beamGeometry = new THREE.CylinderGeometry(0.5, 5, 50, 8, 1, true);
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: randomColor,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide
  });
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beam.position.y = buildingHeight / 2 + 25;
  if (Math.random() > 0.7) {
    building.add(beam);
  }
  const haloGeometry = new THREE.TorusGeometry(buildingWidth * 0.7, 0.5, 16, 100);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: randomColor,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide
  });
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = buildingHeight / 2 + 2;
  building.add(halo);
  if (Math.random() < 0.3) {
    const pyramidGeometry = new THREE.ConeGeometry(width / 2, height * 1.2, 4);
    const pyramid = new THREE.Mesh(pyramidGeometry, building.material.clone());
    pyramid.position.y = height / 2;
    building.add(pyramid);
    const antennaTowerGeometry = new THREE.CylinderGeometry(0.5, 0.5, height / 2, 8);
    const antennaTower = new THREE.Mesh(antennaTowerGeometry, new THREE.MeshPhongMaterial({
      color: 0x000000,
      emissive: 0x00ffff,
      emissiveIntensity: 1
    }));
    antennaTower.position.y = height;
    building.add(antennaTower);
  }
  building.userData.updateEmission = time => {
    building.material.emissiveIntensity = 0.5 + Math.sin(time * building.userData.pulseSpeed + building.userData.pulsePhase) * 0.3;
    if (beam) {
      beam.rotation.y = time * 0.5;
      beam.material.opacity = 0.2 + Math.sin(time * 2) * 0.1;
    }
    edgesLines.material.opacity = 0.5 + Math.sin(time + building.userData.pulsePhase) * 0.3;
  };
  const originalUpdateEmission = building.userData.updateEmission;
  building.userData.updateEmission = time => {
    originalUpdateEmission(time);
    if (halo) {
      halo.rotation.z = time * 0.5;
      halo.scale.setScalar(1 + Math.sin(time * 2) * 0.1);
      halo.material.opacity = 0.3 + Math.sin(time * 3 + building.userData.pulsePhase) * 0.2;
    }
  };
  return building;
}

function generateRoadNetwork() {
  const GRID_SIZE = 100;
  const GRID_DIVISIONS = 10;
  const CELL_SIZE = GRID_SIZE * 2 / GRID_DIVISIONS;
  for (let i = -GRID_SIZE; i <= GRID_SIZE; i += CELL_SIZE) {
    roadNetwork.push({
      start: new THREE.Vector3(i, 0, -GRID_SIZE),
      end: new THREE.Vector3(i, 0, GRID_SIZE)
    });
    roadNetwork.push({
      start: new THREE.Vector3(-GRID_SIZE, 0, i),
      end: new THREE.Vector3(GRID_SIZE, 0, i)
    });
  }
}

function createCar() {
  const car = new THREE.Group();
  const bodyGeometry = new THREE.BoxGeometry(4, 1, 2);
  const bodyMaterial = new THREE.MeshPhongMaterial({
    color: 0x000000,
    emissive: Math.random() > 0.5 ? 0xff2d95 : 0x00ffff,
    emissiveIntensity: 1,
    specular: 0xffffff,
    shininess: 100
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  car.add(body);
  const roofGeometry = new THREE.BoxGeometry(2, 0.8, 1.8);
  const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
  roof.position.set(-0.5, 0.9, 0);
  car.add(roof);
  const glowGeometry = new THREE.PlaneGeometry(6, 4);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: bodyMaterial.emissive,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.5;
  car.add(glow);
  const headlightGeometry = new THREE.ConeGeometry(0.2, 0.8, 16);
  const headlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8
  });
  const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
  leftHeadlight.rotation.z = Math.PI / 2;
  leftHeadlight.position.set(-1.9, 0, 0.8);
  car.add(leftHeadlight);
  const rightHeadlight = leftHeadlight.clone();
  rightHeadlight.position.x *= -1;
  car.add(rightHeadlight);
  const beamGeometry = new THREE.CylinderGeometry(0.1, 0.5, 4, 16, 1, true);
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide
  });
  const leftBeam = new THREE.Mesh(beamGeometry, beamMaterial);
  leftBeam.rotation.x = Math.PI / 2;
  leftBeam.position.set(-1.9, 0, 2.5);
  car.add(leftBeam);
  const rightBeam = leftBeam.clone();
  rightBeam.position.x *= -1;
  car.add(rightBeam);
  const tailLightGeometry = new THREE.BoxGeometry(0.2, 0.4, 0.1);
  const tailLightMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 1
  });
  const leftTaillight = new THREE.Mesh(tailLightGeometry, tailLightMaterial);
  leftTaillight.position.set(-1.9, 0, -1);
  car.add(leftTaillight);
  const rightTaillight = leftTaillight.clone();
  rightTaillight.position.x *= -1;
  car.add(rightTaillight);
  const windowTrimGeometry = new THREE.TorusGeometry(0.5, 0.05, 16, 100);
  const windowTrimMaterial = new THREE.MeshBasicMaterial({
    color: bodyMaterial.emissive,
    transparent: true,
    opacity: 0.8
  });
  const windowTrim = new THREE.Mesh(windowTrimGeometry, windowTrimMaterial);
  windowTrim.rotation.x = Math.PI / 2;
  windowTrim.position.set(-0.5, 1.3, 0);
  car.add(windowTrim);
  car.userData.glowIntensity = Math.random() * 0.3 + 0.7;
  car.userData.glowSpeed = Math.random() * 2 + 1;
  return car;
}

function spawnCars() {
  const CAR_COUNT = 50;
  for (let i = 0; i < CAR_COUNT; i++) {
    const car = createCar();
    const roadSegment = roadNetwork[Math.floor(Math.random() * roadNetwork.length)];
    const t = Math.random();
    car.position.lerpVectors(roadSegment.start, roadSegment.end, t);
    const direction = new THREE.Vector3().subVectors(roadSegment.end, roadSegment.start).normalize();
    const angle = Math.atan2(direction.x, direction.z);
    car.rotation.y = angle;
    car.userData.currentRoad = roadSegment;
    car.userData.t = t;
    car.userData.speed = 0.2 + Math.random() * 0.3;
    car.userData.direction = Math.random() > 0.5 ? 1 : -1;
    cars.push(car);
    city.add(car);
  }
}

function updateCars(deltaTime) {
  const time = performance.now() * 0.001;
  cars.forEach(car => {
    car.userData.t += car.userData.speed * car.userData.direction * deltaTime;
    if (car.userData.t > 1 || car.userData.t < 0) {
      const newRoad = roadNetwork[Math.floor(Math.random() * roadNetwork.length)];
      car.userData.currentRoad = newRoad;
      car.userData.t = car.userData.t > 1 ? 0 : 1;
      const direction = new THREE.Vector3().subVectors(newRoad.end, newRoad.start).normalize();
      const angle = Math.atan2(direction.x, direction.z);
      car.rotation.y = angle;
    }
    car.position.lerpVectors(car.userData.currentRoad.start, car.userData.currentRoad.end, car.userData.t);
    const glow = car.children.find(child => child.geometry instanceof THREE.PlaneGeometry);
    if (glow) {
      glow.material.opacity = 0.3 + Math.sin(time * car.userData.glowSpeed) * 0.2 * car.userData.glowIntensity;
    }
    const beams = car.children.filter(child => child.geometry instanceof THREE.CylinderGeometry);
    beams.forEach(beam => {
      beam.material.opacity = 0.1 + Math.sin(time * 2) * 0.05;
      beam.scale.set(1, 1 + Math.sin(time * 3) * 0.1, 1);
    });
    const windowTrim = car.children.find(child => child.geometry instanceof THREE.TorusGeometry);
    if (windowTrim) {
      windowTrim.material.opacity = 0.6 + Math.sin(time * 2) * 0.2;
    }
  });
}

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  if (composer) composer.setSize(width, height);
  const title = document.querySelector('.title');
  if (title) {
    title.style.fontSize = width < 600 ? '24px' : '48px';
    title.style.padding = width < 600 ? '5px 10px' : '10px 20px';
  }
  const controls = document.querySelectorAll('.mywork-button, .radio-button, .code-by');
  controls.forEach(control => {
    control.style.fontSize = width < 600 ? '14px' : '18px';
    control.style.padding = width < 600 ? '10px 20px' : '15px 30px';
  });
}

function animate() {
  const currentTime = performance.now();
  if (currentTime - lastTrackCheck > 10000) {
    updateNowPlaying();
    lastTrackCheck = currentTime;
  }
  requestAnimationFrame(animate);
  const time = performance.now() * 0.001;
  buildings.forEach(building => {
    if (building.userData.updateEmission) {
      building.userData.updateEmission(time);
    }
  });
  const gridHelper = scene.children.find(child => child instanceof THREE.GridHelper);
  if (gridHelper && gridHelper.userData.update) {
    gridHelper.userData.update(time);
  }
  scene.children.forEach(child => {
    if (child.userData.update) {
      child.userData.update(time);
    }
  });
  cameraAngle += 0.002;
  let nextX = Math.cos(cameraAngle) * cameraRadius;
  let nextZ = Math.sin(cameraAngle) * cameraRadius;
  let nextY = clampHeight(50 + Math.sin(time * 0.5) * 20);
  const nextPosition = new THREE.Vector3(nextX, nextY, nextZ);
  if (!isColliding(nextPosition, buildingBoundingBoxes)) {
    camera.position.copy(nextPosition);
  } else {
    cameraAngle -= 0.002;
    cameraRadius *= 1.1;
    camera.position.x = Math.cos(cameraAngle) * cameraRadius;
    camera.position.z = Math.sin(cameraAngle) * cameraRadius;
    camera.position.y = nextY;
  }
  const lookAtOffset = new THREE.Vector3(Math.sin(time * 0.7) * 20, 40 + Math.sin(time * 0.4) * 10, Math.cos(time * 0.7) * 20);
  camera.lookAt(lookAtOffset);
  const bloomPass = composer && composer.passes.find(pass => pass instanceof THREE.UnrealBloomPass);
  if (bloomPass) {
    const heightFactor = Math.min(camera.position.y / 200, 1);
    bloomPass.strength = 2.5 + heightFactor * 1.5;
  }
  const rgbShiftPass = composer && composer.passes.find(pass => pass.constructor.name === 'ShaderPass');
  if (rgbShiftPass) {
    const movementIntensity = 0.002;
    rgbShiftPass.uniforms.amount.value = movementIntensity + Math.sin(time * 2) * 0.001;
  }
  updateFPSCounter();
  updatePositionDisplay();
  updateCars(0.016);
  updateFireworks(0.016);
  scene.children.forEach(child => {
    if (!child.parent) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });
  if (composer) composer.render();
}

function updateFPSCounter() {
  frameCount++;
  const currentTime = performance.now();
  if (currentTime > lastTime + 1000) {
    const fps = Math.round(frameCount * 1000 / (currentTime - lastTime));
    document.getElementById('fps').textContent = fps;
    frameCount = 0;
    lastTime = currentTime;
  }
}

function updatePositionDisplay() {
  const pos = camera.position;
  document.getElementById('position').textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)}`;
}

function addPostProcessing() {
  const composer = new THREE.EffectComposer(renderer);
  const renderPass = new THREE.RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 2.5, 0.7, 0.6);
  composer.addPass(bloomPass);
  const rgbShiftPass = new THREE.ShaderPass(THREE.RGBShiftShader);
  rgbShiftPass.uniforms.amount.value = 0.002;
  composer.addPass(rgbShiftPass);
  const saturationPass = new THREE.ShaderPass(THREE.HueSaturationShader);
  saturationPass.uniforms.saturation.value = 0.8;
  composer.addPass(saturationPass);
  return composer;
}

function createSun() {
  const sunGeometry = new THREE.SphereGeometry(100, 32, 32);
  const sunMaterial = new THREE.MeshBasicMaterial({
    color: 0xff2d95,
    transparent: true,
    opacity: 0.6
  });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.position.set(0, -200, -1500);
  const flareGeometry = new THREE.PlaneGeometry(400, 400);
  const flareMaterial = new THREE.MeshBasicMaterial({
    color: 0xff2d95,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending
  });
  const flare = new THREE.Mesh(flareGeometry, flareMaterial);
  flare.position.copy(sun.position);
  flare.lookAt(camera.position);
  sun.userData.update = time => {
    sun.material.opacity = 0.6 + Math.sin(time * 0.5) * 0.2;
    flare.lookAt(camera.position);
    flare.material.opacity = 0.4 + Math.sin(time * 0.7) * 0.2;
  };
  scene.add(sun);
  scene.add(flare);
  return {
    sun,
    flare
  };
}

async function updateNowPlaying() {
  try {
    const response = await fetch('https://nightride.fm/api/now-playing');
    const data = await response.json();
    if (data && data.now_playing && data.now_playing.song) {
      const track = `${data.now_playing.song.artist} - ${data.now_playing.song.title}`;
      if (track !== currentTrack) {
        currentTrack = track;
        const nowPlaying = document.getElementById('nowPlaying');
        nowPlaying.textContent = track;
        nowPlaying.style.opacity = '1';
      }
    }
  } catch (err) {
    console.log('Error fetching now playing:', err);
    const nowPlaying = document.getElementById('nowPlaying');
    nowPlaying.textContent = 'Nightride.FM Synthwave';
    nowPlaying.style.opacity = '1';
  }
}

function addScrollingTextEffect() {
  const scrollingContainer = document.querySelector('.scrolling-container');
  const scrollingText = document.querySelector('.scrolling-text');
  let scrollOffset = 0;
  scrollingText.style.setProperty('--scroll-offset', 0);
  scrollingContainer.style.opacity = '1';
  scrollingText.style.animation = 'none';
  scrollingText.offsetHeight;
  scrollingText.style.animation = 'scrollText 60s linear infinite, neonFlicker 2s infinite';

  function updateScroll() {
    scrollOffset += 0.01;
    scrollingText.style.setProperty('--scroll-offset', scrollOffset);
    requestAnimationFrame(updateScroll);
  }

  updateScroll();
  scrollingText.addEventListener('animationend', () => {
    scrollingText.style.animation = 'none';
    scrollingText.offsetHeight;
    scrollingText.style.animation = 'scrollText 30s linear infinite, neonFlicker 2s infinite';
  });
}

function toggleRadio() {
  const radioButton = document.querySelector('.radio-button');
  const scrollingContainer = document.querySelector('.scrolling-container');
  const scrollingText = document.querySelector('.scrolling-text');
  scrollingContainer.style.opacity = '0';
  if (scrollingText) {
    scrollingText.style.animation = 'none';
    scrollingText.style.transform = 'translateX(100vw)';
    void scrollingText.offsetWidth;
  }
  // 浏览器全屏
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log('Fullscreen error:', err);
    });
  }
  if (!audioPlayer) {
    radioButton.textContent = '关闭电台';
    addScrollingTextEffect();
    audioPlayer = new Audio('https://nightride.fm/stream/nightride.m4a');
    audioPlayer.addEventListener('playing', () => {
      updateNowPlaying();
    });
    audioPlayer.addEventListener('pause', () => {
      radioButton.textContent = '启动电台';
      scrollingContainer.style.opacity = '0';
    });
    audioPlayer.addEventListener('error', () => {
    });
    audioPlayer.play().catch(err => {
    });
  } else {
    if (audioPlayer.paused) {
      audioPlayer.play().catch(err => {
      });
      radioButton.textContent = '关闭电台';
      scrollingContainer.style.opacity = '1';
    } else {
      audioPlayer.pause();
      radioButton.textContent = '启动电台';
      scrollingContainer.style.opacity = '0';
    }
  }
}

const isMobile = navigator.userAgent;

function adjustQualitySettings() {
  if (isMobile) {
    renderer.setPixelRatio(1);
    if (composer) {
      composer.passes.forEach(pass => {
        if (pass instanceof THREE.UnrealBloomPass) {
          pass.strength = 1.5;
          pass.radius = 0.5;
        }
      });
    }
  }
}

window.addEventListener('resize', onWindowResize, false);
window.addEventListener('orientationchange', onWindowResize, false);

function createFirework() {
  const particleCount = 100;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const velocities = [];
  const origin = new THREE.Vector3((Math.random() - 0.5) * 200, 100 + Math.random() * 100, (Math.random() - 0.5) * 200);
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const height = Math.random() * Math.PI;
    const speed = 2 + Math.random() * 2;
    velocities.push(new THREE.Vector3(Math.sin(angle) * Math.cos(height) * speed, Math.sin(height) * speed, Math.cos(angle) * Math.cos(height) * speed));
    positions[i * 3] = origin.x;
    positions[i * 3 + 1] = origin.y;
    positions[i * 3 + 2] = origin.z;
    const color = Math.random() > 0.5 ? new THREE.Color(0xff2d95) : new THREE.Color(0x00ffff);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 2,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 1
  });
  const points = new THREE.Points(geometry, material);
  points.userData.velocities = velocities;
  points.userData.age = 0;
  points.userData.origin = origin.clone();
  points.userData.dispose = () => {
    geometry.dispose();
    material.dispose();
  };
  return points;
}

function updateFireworks(deltaTime) {
  fireworks = fireworks.filter(firework => firework.userData.age < 3);
  if (Math.random() < 0.02) {
    const firework = createFirework();
    fireworks.push(firework);
    scene.add(firework);
  }
  fireworks.forEach(firework => {
    const positions = firework.geometry.attributes.position.array;
    const velocities = firework.userData.velocities;
    for (let i = 0; i < positions.length; i += 3) {
      const velocity = velocities[i / 3];
      positions[i] += velocity.x;
      positions[i + 1] += velocity.y;
      positions[i + 2] += velocity.z;
      velocity.y -= 0.1;
    }
    firework.geometry.attributes.position.needsUpdate = true;
    firework.material.opacity = Math.max(0, 1 - firework.userData.age / 3);
    firework.userData.age += deltaTime;
    if (firework.userData.age >= 3) {
      if (firework.userData.dispose) {
        firework.userData.dispose();
      }
      scene.remove(firework);
      firework.geometry = undefined;
      firework.material = undefined;
    }
  });
}

init();
composer = addPostProcessing();
animate();
const newScrollingText = document.querySelector('.scrolling-text');
newScrollingText.textContent = "春风开瑞景，万物展新颜。\n" +
  "爆竹迎佳节，桃符映彩笺。\n" +
  "年丰人共乐，日暖福相连。\n" +
  "岁岁皆如意，和谐庆永年。";