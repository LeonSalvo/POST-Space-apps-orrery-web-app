import { CelestialBody } from './CelestialBody';
import * as THREE from 'three';

export class CelestialBodyList {
    private static instance: CelestialBodyList;
    private planets: CelestialBody[] = [];
    private neos: CelestialBody[] = [];

    private constructor() {
    }

    public static getInstance(): CelestialBodyList {
        if (!CelestialBodyList.instance) {
            CelestialBodyList.instance = new CelestialBodyList();
        }

        return CelestialBodyList.instance;
    }

    public addPlanet(celestialBody: CelestialBody): void {
        this.planets.push(celestialBody);
    }

    public getPlanets(): CelestialBody[] {
        return this.planets;
    }

    public getPlanetMeshes(): THREE.Mesh[] {
        return this.planets.map(celestialBody => celestialBody.mesh);
    }

    public addNeo(celestialBody: CelestialBody): void {
        this.neos.push(celestialBody);
    }

    public getNeos(): CelestialBody[] {
        return this.neos;
    }

    public getNeoMeshes(): THREE.Mesh[] {
        return this.neos.map(celestialBody => celestialBody.mesh);
    }

    public cleanCelestialBodies(): void {
        this.planets = [];
        this.neos = [];
    }

}
