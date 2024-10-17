import CameraControls from 'camera-controls';
import * as THREE from 'three';
import {
  AmbientLight,
  AxesHelper,
  Clock, Euler,
  LoadingManager,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  PointLightHelper,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three';
import {resizeRendererToDisplaySize} from './helpers/responsiveness'
import './style-map.css'
import {Skybox} from "./objects/skybox";
import {CelestialBodyList} from "./objects/CelestialBodyList";
import {CelestialBody} from "./objects/CelestialBody";
import {BehaviorSubject} from 'rxjs'
import {IRing, Util} from './objects/Util';

CameraControls.install({THREE: THREE});

const CANVAS_ID = 'scene'

const renderSize = 100000 * 256

let canvas: HTMLElement
let renderer: WebGLRenderer
let scene: Scene
let ambientLight: AmbientLight
let pointLight: PointLight
let camera: PerspectiveCamera
let cameraControls: CameraControls;
let axesHelper: AxesHelper
let pointLightHelper: PointLightHelper
let clock: Clock

let selectedBody: BehaviorSubject<CelestialBody | null> = new BehaviorSubject(null);
let selectedBodyFullyTransitioned: boolean = false;

let searchOverlay: HTMLDivElement
let searchBar: HTMLInputElement
let similaritiesList: HTMLDivElement
let similaritiesListObjects: HTMLDivElement
let inputDate: HTMLInputElement
let timeScaleText: HTMLParagraphElement
let dateText: HTMLParagraphElement
let timeText: HTMLParagraphElement

let planetOrbitsCheck: HTMLInputElement
let NEOOrbitCheck: HTMLInputElement
let planetOrbits = []
let NEOOrbits = []

let skybox: Skybox
let celestialBodyList: CelestialBodyList

//Global Variables
let epoch = new Date();
let simSpeedAbs = 1/2592000;
let simSpeed = 1;
let simSpeedPrint = 0;
let distanceFromCamera = 0;
let logMovement = false;

Util.generateFont()

export function init() {
  // ===== 🖼️ CANVAS, RENDERER, & SCENE =====
  {
    epoch = new Date();

    canvas = document.querySelector(`canvas#${CANVAS_ID}`)!
    renderer = new WebGLRenderer({canvas, antialias: true, alpha: true})
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFSoftShadowMap
    scene = new Scene();

    searchOverlay = document.querySelector('div#search-overlay');
    searchBar = document.querySelector('input#body-search')!;
    similaritiesList = document.querySelector('div#similarities')!;
    similaritiesListObjects = document.querySelector('div#similarities-object')!;
    dateText = document.querySelector('p#date-text')!;
    timeText = document.querySelector('p#time-text')!;
    inputDate = document.querySelector('input#time-slider')!;
    timeScaleText = document.querySelector('p#time-scale');

    planetOrbitsCheck = document.querySelector("input#orbits-planet");
    NEOOrbitCheck = document.querySelector("input#orbits-neo");

    planetOrbitsCheck.checked = true;
    NEOOrbitCheck.checked = true;

    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault();
        openSearchOverlay()
      }
      if (event.key === 'Escape') {
        closeSearchOverlay()
      }
    });

    planetOrbitsCheck.addEventListener('change', () => {
      if (planetOrbitsCheck.checked) {
        planetOrbits.forEach((line) => {
          scene.add(line);
        });
      } else {
        planetOrbits.forEach((line) => {
          scene.remove(line);
        });
      }
    });

    NEOOrbitCheck.addEventListener('change', () => {
      if (NEOOrbitCheck.checked) {
        NEOOrbits.forEach((line) => {
          scene.add(line);
        });
      } else {
        NEOOrbits.forEach((line) => {
          scene.remove(line);
        });
      }
    });

    inputDate.addEventListener('input', () => {
      simulatedTime();
      if (celestialBodyList) {
        celestialBodyList.getPlanets().forEach(celestialBody => {
          celestialBody.setRotationSpeed(celestialBody.initialRotationBySecond * simSpeed * 2592000 / 32);
        });
      }
    });

    function simulatedTime() {
      let value = Number(inputDate.value);
      value = value - 50;
      if (value < 0) {
        simSpeed = -simSpeedAbs * Math.pow(2, -value / 2);
        simSpeedPrint = -simSpeedAbs * Math.pow(2, -value / 2) * 40;
      } else {
        simSpeed = simSpeedAbs * Math.pow(2, value / 2);
        simSpeedPrint = simSpeedAbs * Math.pow(2, value / 2) * 40;
      }

      timeScaleText.innerHTML = simSpeedPrint.toFixed(2).toString() + " days / sec";
    }

    simulatedTime();

    similaritiesList.style.display = 'none';

    searchBar.addEventListener('input', () => {
      let query = searchBar.value;
      if (query.length === 0) {
        similaritiesListObjects.innerHTML = '';
        listAll()
        return
      }

      let planet = false;
      let neo = false;

      celestialBodyList.getPlanets().forEach((body) => {
        if (body.getName().toLowerCase().includes(query.toLowerCase())) {
          planet = true;
        }
      });

      celestialBodyList.getNeos().forEach((body) => {
        if (body.getName().toLowerCase().includes(query.toLowerCase())) {
          neo = true;
        }
      });

      similaritiesList.style.display = 'block';
      similaritiesListObjects.innerHTML = '';
      similaritiesList.style.display = 'block';

      if (planet) {
        celestialBodyList.getPlanets().forEach((body) => {
          if (body.getName().toLowerCase().includes(query.toLowerCase())) {
            generateElements(body);
          }
        });
      }

      if(neo){
        celestialBodyList.getNeos().forEach((body) => {
          if (body.getName().toLowerCase().includes(query.toLowerCase())) {
            generateElements(body);
          }
        });
      }

      if (!planet && !neo){
        let neoTitle = document.createElement('h2');
        neoTitle.innerHTML = "No objects found!";
        similaritiesListObjects.appendChild(neoTitle);
      }
    });
  }

  // ===== 💡 LIGHTS =====
  {
    ambientLight = new AmbientLight('white', 0.05)
    pointLight = new PointLight('white', 2.5, renderSize * 8)
    pointLight.position.set(0, 0, 0)
    pointLight.castShadow = true
    pointLight.shadow.radius = 4
    pointLight.shadow.camera.near = 0.5
    pointLight.shadow.camera.far = 4000
    pointLight.shadow.mapSize.width = 2048
    pointLight.shadow.mapSize.height = 2048
    pointLight.decay = 0;
    scene.add(ambientLight)
    scene.add(pointLight)
  }

  // ===== 🎥 CAMERA =====
  {
    camera = new PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, renderSize * 8)
    camera.position.set(2 * Util.SIZE_SCALER, 2 * Util.SIZE_SCALER, 5 * Util.SIZE_SCALER)

    cameraControls = new CameraControls(camera, renderer.domElement);
    cameraControls.dampingFactor = 0.1;
    cameraControls.draggingDampingFactor = 0.3;
    cameraControls.verticalDragToForward = true;

  }

  // ===== 📦 OBJECTS =====
  {
    skybox = new Skybox(0, 0, 0, renderSize / 1.5);
    scene.add(...skybox.getMesh());

    skybox.galaxyVisible.subscribe((bool) => {
      if (celestialBodyList === undefined) return;

      celestialBodyList.getPlanets().forEach((body) => {
        body.mesh.visible = !bool;
        body.traceOrbits()
      })

      if (bool) {
        planetOrbits.forEach((line) => {
          scene.remove(line);
        });
        NEOOrbits.forEach((line) => {
          scene.remove(line);
        });
      } else {
        planetOrbits.forEach((line) => {
          scene.add(line);
        });
        NEOOrbits.forEach((line) => {
          scene.add(line);
        });
      }
    });

    celestialBodyList = CelestialBodyList.getInstance();

    let descriptionDict = Util.CSVToDict("data/infoPlanets.csv");

    let sun = new CelestialBody(
        "Sun",
        696340,
        1.989e30,
        'sun.jpg',
        1,
        new Vector3(1, 1, 1),
        new Vector3(0, 0, 0),
        0,
        new Date(Date.UTC(2000, 0, 1, 0, 0, 0)),
        0,
        0,
        0,
        0,
        0,
        0xFDB813,
        0.000072921158553,
        new Euler(0, 0, 0, 'XYZ'),
        false,
        descriptionDict["sun"]
    );
    celestialBodyList.addPlanet(sun);

    let earth = new CelestialBody(
        "Earth",
        6378,
        5.972e24,
        "earthMap.png",
        1,
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 0),
        1.00000018,
        new Date(Date.UTC(2024, 1, 4, 0, 0, 0)),
        0.01673163,
        102.93005885,
        -5.11260389,
        100.46691572,
        -0.00054346,
        0x22ABDF,
        0.000072921158553,
        new Euler(0.4396, 0.8641, 5.869, "XYZ"),
        true,
        descriptionDict["earth"]
    )
    celestialBodyList.addPlanet(earth);

    let mars = new CelestialBody(
        "Mars",
        3389.5,
        6.39e23,
        "marsMap.jpg",
        1,
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 0),
        1.52371034,
        new Date(Date.UTC(2000, 0, 1, 0, 0, 0)),
        0.09339410,
        -23.94362959,
        49.55953891,
        -4.55343205,
        1.84969142,
        0xFF5E33,
        0.00007088222,
        new Euler(0.4396, 0.8641, 5.869, "XYZ"),
        true,
        descriptionDict["mars"]
    )
    celestialBodyList.addPlanet(mars);

    let jupiter = new CelestialBody(
        "Jupiter",
        69911,
        1.898e27,
        "JupiterMap.jpg",
        1,
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 0),
        5.20288700,
        new Date(Date.UTC(1999, 4, 20, 0, 0, 0)),
        0.04838624,
        14.72847983,
        100.47390909,
        34.39644051,
        1.30439695,
        0xA2440A,
        0.00017538081,
        new Euler(0.0545, 1.7541, 0.2575, "XYZ"),
        true,
        descriptionDict["jupiter"]
    );
    celestialBodyList.addPlanet(jupiter);

    let venus = new CelestialBody(
        "Venus",
        6051.8,
        4.867e24,
        "venusMap.jpg",
        1,
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 0),
        0.72332102,
        new Date(Date.UTC(2014, 8, 5, 0, 0, 0)),
        0.00676399,
        131.76755713,
        76.67261496,
        181.97970850,
        3.39777545,
        0xD8B712,
        0.0000002994132,
        new Euler(3.0960, 1.3383, 0.9578, "XYZ"),
        true,
        descriptionDict["venus"]
    );
    celestialBodyList.addPlanet(venus);

    let saturn = new CelestialBody(
        "Saturn",
        58232,
        5.683e26,
        "saturnMap.jpg",
        1,
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 0),
        9.53667594,
        new Date(Date.UTC(1944, 8, 7, 0, 0, 0)),
        0.05386179,
        92.59887831,
        113.66242448,
        49.95424423,
        2.48599187,
        0xF6D624,
        0.00016329833,
        new Euler(0.4665, 1.9839, 0.4574, "XYZ"),
        true,
        descriptionDict["saturn"],
        {
          ringTexture: "rings2.jpg",
          innerRadiusMult: 1.2,
          outerRadiusMult: 2.0
        } as IRing
    );
    celestialBodyList.addPlanet(saturn);

    let mercury = new CelestialBody(
        "Mercury",
        2440,
        3.285e23,
        "mercuryMap.jpg",
        1,
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 0),
        0.38709927,
        new Date(Date.UTC(2021, 3, 27, 0, 0, 0)),
        0.20563593,
        77.45779628,
        48.33076593,
        252.25032350,
        7.00497902,
        0xA195A8,
        0.00000123854412,
        new Euler(0.000593, 0.844493, 0.852917, "XYZ"),
        true,
        descriptionDict["mercury"]
    );
    celestialBodyList.addPlanet(mercury);

    let uranus = new CelestialBody(
        "Uranus",
        25362,
        8.681e25,
        "uranusMap.jpg",
        1,
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 0),
        19.18916464,
        new Date(Date.UTC(1966, 5, 2, 0, 0, 0)),
        0.04725744,
        170.95427630,
        74.01692503,
        313.23810451,
        0.77263783,
        0x949AFF,
        -0.00010104518,
        new Euler(1.7074, 1.2915, 2.9839, "XYZ"),
        true,
        descriptionDict["uranus"]
    );
    celestialBodyList.addPlanet(uranus);

    let neptune = new CelestialBody(
        "Neptune",
        24622,
        1.024e26,
        "neptuneMap.jpg",
        1,
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 0),
        30.06992276,
        new Date(Date.UTC(2042, 8, 15, 0, 0, 0)),
        0.00859048,
        44.96476227,
        131.78422574,
        -55.12002969,
        1.77004347,
        0x3339FF,
        0.00010865669,
        new Euler(0.4947, 2.2994, 0.7848, "XYZ"),
        true,
        descriptionDict["neptune"]
    );
    celestialBodyList.addPlanet(neptune);

    let moon = new CelestialBody(
        "Moon",
        1737.4,
        7.34767309e22,
        "moon.jpg",
        1,
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 0),
        0.00257,
        new Date(Date.UTC(2020, 10, 6, 0, 0, 0)),
        0.0549,
        0.0024,
        125.08,
        100.46691572,
        5.145,
        0xA1A1A1,
        0.001,
        new Euler(0.0269, 0.8497, 0.4647, "XYZ"),
        true,
        descriptionDict["moon"]
    );
    celestialBodyList.addPlanet(moon);

    async function processAsteroids() {
      try {
        let asteroids = await Util.CSVToArray("data/dataset.csv");
        for (let i = 0; i < asteroids.length; i++) {
          let asteroid = asteroids[i];
          let asteroidBody = new CelestialBody(
              asteroid.name,
              asteroid.diameter / 2,
              asteroid.gm / Util.GRAVITATIONALCONSTANT,
              "lunasGenericasMap.jpg",
              1,
              new Vector3(0, 0, 0),
              new Vector3(0, 0, 0),
              asteroid.a,
              new Date(Date.UTC((asteroid.tp))),
              asteroid.e,
              asteroid.q,
              asteroid.om,
              asteroid.w,
              asteroid.i,
              0x7F7F7F,
              0.0000002994132,
              new Euler(0, 0, 0, 'XYZ'),
              true,
                descriptionDict[asteroid]
          );
          celestialBodyList.addNeo(asteroidBody);
        }
      } catch (error) {
        console.error("Error parsing CSV:", error);
      }
    }

    processAsteroids().then(() => {
      scene.add(...celestialBodyList.getNeoMeshes());
      let bodyList = celestialBodyList.getNeos();
      for (let body of bodyList) {
        if (body.marker) {
          scene.add(body.marker);
        }
      }
      
      traceOrbits(bodyList, true);
      
    });

    scene.add(...celestialBodyList.getPlanetMeshes());
    let bodyList = celestialBodyList.getPlanets();
    for (let body of bodyList) {
      if (body.marker) {
        scene.add(body.marker);
      }
    }
    
    traceOrbits(bodyList, true);
    
  }

  // ===== 🕹️ CONTROLS =====
  {
    cameraControls.addEventListener('update', () => {
      let distance = camera.position.distanceTo(new Vector3(0, 0, 0))
      if (distance < renderSize * 0.9) {
        skybox.showGalaxy(false)
      } else {
        skybox.showGalaxy(true)
      }
    })

    selectedBody.subscribe(async (body) => {
      selectedBodyFullyTransitioned = false;

      if (!body) return;

      cameraControls.setPosition(
          selectedBody.getValue().getPosition().x,
          selectedBody.getValue().getPosition().y,
          selectedBody.getValue().getPosition().z,
          false
      )

      selectedBodyFullyTransitioned = true;
    });
  }

  // ===== 🪄 HELPERS =====
  {
    axesHelper = new AxesHelper(4)
    axesHelper.visible = false
    scene.add(axesHelper)

    pointLightHelper = new PointLightHelper(pointLight, undefined, 'orange')
    pointLightHelper.visible = false
    scene.add(pointLightHelper)
  }

  // ===== 📈 CLOCK =====
  {
    clock = new Clock()
  }
}

function traceOrbits(bodies: CelestialBody[], isNeo: boolean) {
  bodies.forEach(celestialBody => {
    if (!isNeo) {
      if (celestialBody.getName() === "Moon") return;
    }

    let line = celestialBody.traceOrbits();
    if (isNeo) {
      NEOOrbits.push([celestialBody.getName(),line]);
    } else {
      planetOrbits.push([celestialBody.getName(),line]);
    }

    scene.add(line);
  })
}

function updateOrbits(bodies: CelestialBody[], NEOOrbits: any[], planetOrbits: any[], isNeo: boolean) {
  NEOOrbits.forEach(celestialBody => {
    bodies.forEach(body => {
      if (!isNeo) {
        if (celestialBody.getName() === "Moon") return;
      }
      if (celestialBody[0] === body.getName()) {
        scene.remove(celestialBody[1]);
        celestialBody[1] = body.realTimeOrbitUpdate();
        scene.add(celestialBody[1]);
      }
    })
  })
  planetOrbits.forEach(celestialBody => {
    bodies.forEach(body => {
      if (!isNeo) {
        if (celestialBody.getName() === "Moon") return;
      }
      if (celestialBody[0] === body.getName()) {
        scene.remove(celestialBody[1]);
        celestialBody[1] = body.realTimeOrbitUpdate();
        scene.add(celestialBody[1]);
      }
    })
  })
}

export function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  // Actualizar los cuerpos celestes
  CelestialBodyList.getInstance().getPlanets().forEach(celestialBody => {
    distanceFromCamera = camera.position.distanceTo(celestialBody.marker.position);
    if (celestialBody.name === "Moon"){
      simSpeed = simSpeed/100;
      celestialBody.update(epoch, simSpeed, distanceFromCamera, camera, logMovement);
      simSpeed = simSpeed*100;
    } else {
      celestialBody.update(epoch, simSpeed, distanceFromCamera, camera, logMovement);
    }
  })

  celestialBodyList.getNeos().forEach(celestialBody => {
    distanceFromCamera = camera.position.distanceTo(celestialBody.marker.position);
    celestialBody.update(epoch, simSpeed, distanceFromCamera, camera, logMovement);
  });
  
  if(logMovement == true){
    updateOrbits(celestialBodyList.getPlanets(), NEOOrbits, planetOrbits, true);
  }

  updateTheDate();

  dateText.innerHTML = epoch.toISOString().split('T')[0];
  timeText.innerHTML = epoch.toTimeString().split(' ')[0];

  if (selectedBody.getValue() !== null && selectedBodyFullyTransitioned) {
    cameraControls.moveTo(
        selectedBody.getValue().getPosition().x,
        selectedBody.getValue().getPosition().y,
        selectedBody.getValue().getPosition().z,
        false
    )
    cameraControls.setTarget(
        selectedBody.getValue().getPosition().x,
        selectedBody.getValue().getPosition().y,
        selectedBody.getValue().getPosition().z,
        false
    )

  }

  cameraControls.update(delta);

  // Redimensionar si es necesario
  if (resizeRendererToDisplaySize(renderer)) {
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }

  // Renderizar la escena
  renderer.render(scene, camera);
}

function updateTheDate() {
  if (simSpeed == 1) {
    epoch = new Date(Date.now());            // At maximum speed, increment calendar by a day for each clock-cycle.
  } else if (0 > simSpeed) {
    epoch.setDate(epoch.getDate() - simSpeed * 24 * 3600000)
  } else if (simSpeed == 0) {
    epoch.setDate(Date.now());
  } else {
    epoch.setTime(epoch.getTime() + simSpeed * 24 * 3600000);
  }  // 24 hours * milliseconds in an hour * simSpeed
}

  function listAll() {
  similaritiesList.style.display = 'block';
  celestialBodyList.getPlanets().forEach((body) => {
    generateElements(body);
  });
  celestialBodyList.getNeos().forEach((body) => {
    generateElements(body);
  });
}

function generateElements(body: CelestialBody) {
  let bodyElement = document.createElement('div');
  bodyElement.classList.add('body-result');
  bodyElement.innerHTML = body.getName();
  if (bodyElement.innerHTML === selectedBody.getValue()?.getName()) {
    bodyElement.classList.add('selected');
  }
  bodyElement.addEventListener('click', () => {
    selectedBody.next(body);
    similaritiesListObjects.innerHTML = '';
    searchBar.value = "";
    searchOverlay.style.display = 'none';
  });
  similaritiesListObjects.appendChild(bodyElement);
}

function openSearchOverlay() {
  if (searchOverlay.style.display === 'none') {
    searchOverlay.style.display = 'flex';
  }
  searchBar.focus();
  listAll();
}

function closeSearchOverlay() {
  searchOverlay.style.display = 'none';
}

