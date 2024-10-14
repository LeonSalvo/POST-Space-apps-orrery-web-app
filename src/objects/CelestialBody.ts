import * as THREE from 'three';
import {Euler, FrontSide, Vector3} from 'three';
import {IRing, Util} from "./Util";
import {FontLoader} from "three/examples/jsm/loaders/FontLoader";
import {TextGeometry} from "three/examples/jsm/geometries/TextGeometry";
import {CelestialBodyList} from "./CelestialBodyList";
import {Queue} from "queue-typescript";

export class CelestialBody {
    name: string;
    radius: number; // Radio del cuerpo celeste
    mass: number;   // Masa del cuerpo celeste
    texture: THREE.Texture;
    time: number;
    position: THREE.Vector3;  // Posición en el espacio (x, y, z)
    velocity: THREE.Vector3;  // Velocidad (puede ser opcional)
    mesh: THREE.Mesh;         // Representación visual en Three.js
    semiMajorAxis: number;
    t0: Date;
    e: number;
    ESTAR: number;
    longitudeOfPerihelion: number;
    longitudeOfAscendingNode: number;
    excentricAnomalyE: number;
    perihelion: number;
    meanLongitude: number;
    inclination: number;
    period: number;
    trueAnomalyS: number;
    orbitColor: THREE.ColorRepresentation;
    marker: THREE.Mesh;
    rotationBySecond: number;
    initialRotationBySecond: number;
    axisInclicnation: Euler;
    ringMesh: THREE.Mesh | undefined;
    textMesh: THREE.Mesh | undefined;
    orbPos: Queue<THREE.Vector3>;
    lastUpdate: Date = new Date();
    description: string;


    constructor(
        name: string,
        radius: number,
        mass: number,
        texture: string | THREE.Texture,
        time: number,
        initialPosition: THREE.Vector3,
        initialVelocity: THREE.Vector3,
        a: number,
        t0: Date,
        e: number,
        longitudeOfPerihelion: number,
        longitudeOfAscendingNode: number,
        meanLongitude: number,
        inclination: number,
        orbitColor: THREE.ColorRepresentation,
        rotation: number,
        axis: Euler,
        castShadow: boolean = false,
        description: string,
        ring: IRing | undefined = undefined
    ) {
        this.name = name;
        this.radius = Util.KmtoAU(radius) * 10000;
        this.mass = mass;
        this.time = time;
        this.position = initialPosition;
        this.velocity = initialVelocity;
        this.semiMajorAxis = a;
        this.t0 = t0;
        this.e = e;
        this.ESTAR = 57.29577951308232 * e;
        this.longitudeOfPerihelion = longitudeOfPerihelion;
        this.longitudeOfAscendingNode = longitudeOfAscendingNode;
        this.excentricAnomalyE = 0;
        this.perihelion = longitudeOfPerihelion - longitudeOfAscendingNode;
        this.meanLongitude = meanLongitude;
        this.inclination = inclination;
        this.period = Math.sqrt(Math.pow(this.semiMajorAxis, 3));
        this.trueAnomalyS = 0;
        this.orbitColor = orbitColor;
        this.rotationBySecond = rotation;
        this.initialRotationBySecond = rotation;
        this.description = description;
        this.axisInclicnation = axis;

        const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
        if (typeof texture === 'string') {
            this.texture = new THREE.TextureLoader().load(texture);
        } else {
            this.texture = texture;
        }

        let material;

        if (castShadow) {
            material = new THREE.MeshLambertMaterial({
                map: this.texture,
                side: FrontSide,
                emissiveIntensity: 0.2
            });
        } else {
            material = new THREE.MeshBasicMaterial({
                map: this.texture,
                side: FrontSide,
            });
        }
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        let positionClone = this.mesh.position.clone();
        this.mesh.rotation.copy(this.axisInclicnation);

        const markerGeometry = new THREE.SphereGeometry(10, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({color: orbitColor, transparent: true, opacity: 0.5});
        this.marker = new THREE.Mesh(markerGeometry, markerMaterial);
        this.marker.position.copy(this.position)
        this.marker.layers.enable(20);
        if (ring !== undefined) {
            const ringGeometry = new THREE.RingGeometry(this.radius * ring.innerRadiusMult, this.radius * ring.outerRadiusMult, 64);
            var pos = ringGeometry.attributes.position;
            var v3 = new THREE.Vector3();
            for (let i = 0; i < pos.count; i++){
                v3.fromBufferAttribute(pos, i);
                ringGeometry.attributes.uv.setXY(i, v3.length() < this.radius * ring.innerRadiusMult + 1 ? 0 : 1, 1);
            }

            let ringMaterial;
            if (castShadow){
                ringMaterial = new THREE.MeshLambertMaterial({
                    map: new THREE.TextureLoader().load(ring.ringTexture),
                    color: 0xffffff,
                    side: THREE.DoubleSide,
                    transparent: true,
                    emissiveIntensity: 0.2
                });
                }else{
                ringMaterial = new THREE.MeshBasicMaterial({
                    map: new THREE.TextureLoader().load(ring.ringTexture),
                    color: 0xffffff,
                    side: THREE.DoubleSide,
                    transparent: true
                });
            }
            const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);

            ringMesh.rotation.x = this.mesh.rotation.y;
            ringMesh.rotation.y = this.mesh.rotation.x;
            ringMesh.position.copy(this.position);

            ringMesh.castShadow = true;
            ringMesh.receiveShadow = true;

            this.ringMesh = ringMesh;
            ringMesh.receiveShadow = true;

            this.mesh.children.push(ringMesh);
        }

        const textGeometry = new TextGeometry(this.name, {
            font: Util.font,
            size: 5,
            depth: 0,
        });
        const textMaterial = new THREE.MeshBasicMaterial({color: orbitColor});
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.set(positionClone.x, positionClone.y + (this.radius * 1.2 ), positionClone.z);
        this.mesh.add(textMesh);
        this.textMesh = textMesh;
    }

    // Función de actualización del cuerpo celeste, a invocar cada frame
    update(date: Date, simSpeed: number, distanceFromCamera: number, camera: THREE.Camera, logMovement: boolean) {
        let vector = this.calculateOrbitPosition(date, simSpeed);

        // Tamaño base del marcador
        const baseSize = 1;

        // Calcular el tamaño del marcador en función de la distancia
        const scaleFactor = baseSize * (distanceFromCamera / 1500);
        this.marker.scale.set(scaleFactor, scaleFactor, scaleFactor);

        this.mesh.rotation.copy(new Euler(this.mesh.rotation.x, this.mesh.rotation.y + this.rotationBySecond, this.mesh.rotation.z, "XZY"));

        if (!camera) return;
        this.textMesh.lookAt(camera.position);

        const textScaleFactor = distanceFromCamera / 500;
        this.textMesh.scale.set(textScaleFactor, textScaleFactor, textScaleFactor);

        if (logMovement) {
            if (this.name === "Sun") {
                this.marker.scale.set(scaleFactor, scaleFactor, scaleFactor);
                const sunPosition = this.calculateSunPosition(date, simSpeed, -0.000001);
                vector.set(sunPosition.x, sunPosition.y, sunPosition.z);
                this.marker.position.copy(vector);
                this.mesh.position.copy(vector);
                return;
            }
        } else {
            if (this.name === "Sun") {
                this.marker.scale.set(scaleFactor, scaleFactor, scaleFactor);
                this.marker.position.set(0, 0, 0);
                return;
            }
        }
        
        if (this.name === "Moon") {
            let earth = CelestialBodyList.getInstance().getPlanets().find(planet => planet.name === "Earth")!;

            vector.setX(vector.x + earth.getPosition().x);
            vector.setY(vector.y + earth.getPosition().y);
            vector.setZ(vector.z + earth.getPosition().z);

            this.marker.position.copy(vector);
            this.mesh.position.copy(vector);
        } else {
            let sun = CelestialBodyList.getInstance().getPlanets().find(planet => planet.name === "Sun")!;
            vector.setX(vector.x + sun.getPosition().x);
            vector.setY(vector.y + sun.getPosition().y);
            vector.setZ(vector.z + sun.getPosition().z);
        }

        this.marker.position.copy(vector);
        this.mesh.position.copy(vector);
        if (this.ringMesh !== undefined) {
            this.mesh.children[0].position.copy(new Vector3(vector.x, vector.y, vector.z));
        }
    }

    calculateOrbitPosition(date: Date , simSpeed : number): THREE.Vector3 {
        var pos = this.propagate(this.trueAnomalyS)
        //console.log(this.trueAnomalyS);

        var currentPosition = [] ;
        var deltaTime = 0 ;

        // Calculate mean motion n:
        var n = (2 * Math.PI) / (this.period * 365.25) ;   // radians per day

        // Calculate Eccentric Anomaly E based on the orbital eccentricity and previous true anomaly:
        var e = this.e ;
        var f = this.trueAnomalyS;
        var eA = this.trueToEccentricAnomaly(e,f)            // convert from true anomaly to eccentric anomaly

        // Calculate current Mean Anomaly
        var m0 = eA - e * Math.sin(eA);

        deltaTime = simSpeed * n

        // Update Mean anomaly by adding the Mean Anomaly at Epoch to the mean motion * delaTime
        var mA = deltaTime + m0

        this.time = this.time +  deltaTime // increment timer

        eA = this.eccentricAnomaly (e, mA)
        var trueAnomaly = this.eccentricToTrueAnomaly(e, eA)
        this.trueAnomalyS = trueAnomaly

        var xCart = pos[0]*Util.SIZE_SCALER;
        var yCart = pos[1]*Util.SIZE_SCALER;
        var zCart = pos[2]*Util.SIZE_SCALER;
        return new THREE.Vector3(yCart, zCart, xCart);
        }

    calculateSunPosition(date: Date, simSpeed : number, speed : number): THREE.Vector3 {
        // Velocidad constante en el movimiento lineal (puedes ajustar este valor)
        const linearSpeed = speed * simSpeed; // unidades por segundo, escalado por simSpeed
        
        // Delta de tiempo desde la última actualización (en días o segundos, ajusta según tu sistema)
        const deltaTime = this.calculateElapsedTime(this.lastUpdate);
        
        // Incremento de posición lineal: asumiendo que el objeto se mueve a lo largo del eje X por simplicidad
        const linearPosition = linearSpeed * deltaTime;
        
        // Actualizamos la posición en el espacio 3D usando THREE.Vector3
        const x = 0  // Movimiento en el eje X
        const y = this.getPosition().y + linearPosition;  // Mantén las posiciones Y y Z constantes (o modifícalas si es necesario)
        const z = 0;
            
        // Actualizamos el valor de "lastUpdate" para el próximo cálculo
        this.lastUpdate = date;
        
        return new THREE.Vector3(x, y, z);
    }


    propagate(uA){
        // Purpose: Determine a position on an orbital trajectory based on a true anomoly.
        // Used by the traceOrbits function to draw the orbits.
        var pos = [] ;
        var xdot; var ydot; var zdot;            // velocity coordinates
        var theta = uA;                          // Update true anomaly.
        var smA = this.semiMajorAxis;                      // Semi-major Axis
        var oI =  this.inclination * 0.01745329 ;                      // Orbital Inclination
        var aP = this.longitudeOfPerihelion * 0.01745329 ;                       // Get the object's orbital elements.
        var oE = this.e;                        // Orbital eccentricity
        var aN = this.longitudeOfAscendingNode ;                       // ascending Node
        var sLR = smA * (1 - oE^2) ;             // Compute Semi-Latus Rectum.
        var r = sLR/(1 + oE * Math.cos(theta));  // Compute radial distance.

        pos[0] = r * (Math.cos(aP + theta) * Math.cos(aN) - Math.cos(oI) * Math.sin(aP + theta) * Math.sin(aN)) ;
        pos[1] = r * (Math.cos(aP + theta) * Math.sin(aN) + Math.cos(oI) * Math.sin(aP + theta) * Math.cos(aN)) ;
        pos[2] = r * (Math.sin(aP + theta) * Math.sin(oI)) ;

        return pos ;
    }
    
    traceOrbits() {

        const geometry = new THREE.BufferGeometry(); // BufferGeometry instead of Geometry
        const material = new THREE.LineBasicMaterial({ color: this.orbitColor });
        const orbPos = [];
        let i = 0.0;
    
        // Loop to propagate the orbit positions
        while (i <= Math.PI * 2.001) {
            const pos = this.propagate(i);  // Propagate the orbit to get the position
    
            orbPos.push(new THREE.Vector3(pos[1]*Util.SIZE_SCALER, pos[2]*Util.SIZE_SCALER, pos[0]*Util.SIZE_SCALER));
    
            i += 0.001;  // Increment the orbit angle
        }
        
        
        // Set the vertices array to the BufferGeometry
        geometry.setFromPoints(orbPos);
    
        // Create the line object for the orbit trace
        const line = new THREE.Line(geometry, material);
    
        const orbitName = this.name + "_trace";
        line.name = orbitName;
    
        return line;
    }

    realTimeOrbitUpdate() {
        // BufferGeometry para la órbita
        const orbitLine = new THREE.Line();
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.LineBasicMaterial({ color: this.orbitColor });
        let currentPos = new THREE.Vector3(0, 0, 0);

    
        // Esta variable almacenará las posiciones actualizadas de la órbita
        // Inicializar si no está definida
        this.orbPos = this.orbPos || new Queue<THREE.Vector3>();
    
        // Calcular la posición actual usando la propagación
        const pos = this.propagate(this.trueAnomalyS);
        let sun = CelestialBodyList.getInstance().getPlanets().find(planet => planet.name === "Sun")!;

        if (this.name === "Moon") {
            let earth = CelestialBodyList.getInstance().getPlanets().find(planet => planet.name === "Earth")!;

            currentPos.setX(pos[1] * Util.SIZE_SCALER + earth.getPosition().x);
            currentPos.setY(pos[2] * Util.SIZE_SCALER + earth.getPosition().y);
            currentPos.setZ(pos[0] * Util.SIZE_SCALER + earth.getPosition().z);
            
        } else {
            currentPos.setX(pos[1] * Util.SIZE_SCALER + sun.getPosition().x);
            currentPos.setY(pos[2] * Util.SIZE_SCALER + sun.getPosition().y);
            currentPos.setZ(pos[0] * Util.SIZE_SCALER + sun.getPosition().z);
    }
        
        // Añadir la nueva posición a la lista de posiciones de la órbita
        Util.limitedEnqueue(this.orbPos, currentPos, 500, null);

        // Actualizar la geometría de la línea con los nuevos puntos
        geometry.setFromPoints(this.orbPos.toArray());
    
        orbitLine.geometry = geometry;
        orbitLine.material = material;

        return orbitLine;
    }

    julianDate(date: Date): number {
        let y = date.getUTCFullYear() + 8000;
        let m = date.getUTCMonth();
        let d = date.getUTCDate();

        if (m < 3) {
            y--;
            m += 12;
        }
        let julianDate = (y * 365) + (y / 4) - (y / 100) + (y / 400) - 1200820 + (m * 153 + 3) / 5 - 92 + d - 1;
        return julianDate;
    }

    getT(date: Date): number {
        let JulianDate = this.julianDate(date);
        return (JulianDate - 2451545)/36525;
    }

    //M en radianes
    meanAnomaly(date: Date): number {
        let meanA = this.meanLongitude - this.longitudeOfPerihelion + Math.pow(this.getT(date), 2) + Math.cos(this.getT(date)) + Math.sin(this.getT(date));
        return meanA;
    }

    //E en radianes
    eccentricAnomaly(e : number, M : number): number {
        var eccentricAnomaly = 0;
        var tol = 0.0001;  // tolerance
        var eAo = M;       // initialize eccentric anomaly with mean anomaly
        var ratio = 1;     // set ratio higher than the tolerance
        while (Math.abs(ratio) > tol) {
            var f_E = eAo - e * Math.sin(eAo) - M;
            var f_Eprime = 1 - e * Math.cos(eAo);
            ratio = f_E / f_Eprime;
            if (Math.abs(ratio) > tol) {
                eAo = eAo - ratio;
            // console.log ("ratio  " + ratio) ;
            }
            else
                eccentricAnomaly = eAo;
        }
        return eccentricAnomaly;
        }

    trueToEccentricAnomaly(e,f) {
        // http://mmae.iit.edu/~mpeet/Classes/MMAE441/Spacecraft/441Lecture19.pdf slide 7 
        var eccentricAnomaly = 2* Math.atan(Math.sqrt((1-e)/(1+e))* Math.tan(f/2));

        return eccentricAnomaly ;
    }

    eccentricToTrueAnomaly(e, E) {
    // http://mmae.iit.edu/~mpeet/Classes/MMAE441/Spacecraft/441Lecture19.pdf slide 8
        var trueAnomaly = 2 * Math.atan(Math.sqrt((1+e)/(1-e))* Math.tan(E/2));
        return trueAnomaly
    }
    
    
    calculateElapsedTime(t0: Date) {
        let actualTime = new Date().getTime();
        let elapsedTime = actualTime - t0.getTime();
        //console.log("ELAPSED TIME: " + elapsedTime / 1000);
        return elapsedTime / 1000;
    }

    calculateSumMeanAnomaly(date: Date, En: number): number {
        let sumMeanAnomaly = this.meanAnomaly(date) - (En - (this.ESTAR * Math.sin(En)));
        //console.log("SUM MEAN ANOMALY: " + sumMeanAnomaly);
        return sumMeanAnomaly;
    }

    calculateSumExcentricAnomaly(date: Date, En: number): number {
        //console.log("SUM EXCENTRIC ANOMALY: " + this.calculateSumMeanAnomaly(date, En) / (1 - (this.ESTAR * Math.cos(En))));
        return this.calculateSumMeanAnomaly(date, En) / (1 - (this.ESTAR * Math.cos(En)));
    }



    // Método para actualizar el mesh visual
    updateMesh() {
        this.mesh.position.copy(this.position);
    }

  getName() {
    return this.name;
  }

  getPosition() {
    return this.mesh.position;
  }

  getRadius() {
    return this.radius;
  }

    getRotationSpeed() {
        return this.rotationBySecond;
    }

    setRotationSpeed(number: number) {
        this.rotationBySecond = number;
    }
}
