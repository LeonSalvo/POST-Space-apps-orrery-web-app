import Papa from "papaparse";
import * as THREE from 'three';
import { NEO } from "./Neo";
import {Font, FontData, FontLoader} from "three/examples/jsm/loaders/FontLoader";
import {Queue} from "queue-typescript";
import * as three from "three";

export class Util {
  static font: Font;

  static dateToJulianDate(date: Date): number {
    let y = date.getUTCFullYear() + 8000;
    let m = date.getUTCMonth();
    let d = date.getUTCDate();

    if (m < 3) {
      y--;
      m += 12;
    }
    return (y * 365) + (y / 4) - (y / 100) + (y / 400) - 1200820 + (m * 153 + 3) / 5 - 92 + d - 1;
  }

  static dateToDay(date: Date): number {
    // convertir fecha en dias incluyendo horas minutos y segundos
    return date.getTime() / (1000 * 60 * 60 * 24);
  }

  static KmtoAU(km: number): number {
    return km / (1.496e8);
  }

  static CSVToArray(csvPath: string): Promise<NEO[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(csvPath, {
        header: true,
        download: true,
        skipEmptyLines: true,
        delimiter: ";",
        complete: function (results) {
          resolve(results.data as NEO[]);
        },
        error: function (error) {
          reject(error);
        }
      })
    });
  }

  static CSVToDict(csvPath: string): Promise<Map<string, string>> {
    return new Promise((resolve, reject) => {
      Papa.parse(csvPath, {
        header: true,
        download: true,
        skipEmptyLines: true,
        delimiter: ",",
        complete: function (results) {
          let map = new Map<string, string>();
          results.data.forEach((row: any) => {
            map.set(row["Planet"], row["Description"]);
          });
          resolve(map);
        },
        error: function (error) {
          reject(error);
        }
      })
    });

  }

  static SUNMASS = 1.989e30;
  static GRAVITATIONALCONSTANT = 6.67430e-11;
  static AU = 1.496e8
  static SIZE_SCALER = 10000
  static TOL = 1e-6;

  static generateFont() {
    return new Promise<void>((resolve, reject) => {
      const loader = new FontLoader();
      loader.load('fonts/helvetiker_regular.typeface.json', (font) => {
        Util.font = font;
        resolve();
      });
    });
  }
  static limitedEnqueue(queue: Queue<any>, element: any, limit: number, scene : three.Scene | null) {
    if (queue.length >= limit) {
      let toRemove = queue.dequeue();
      if (scene != null){
        scene.remove(toRemove);
      }
    }
    queue.enqueue(element);
  }
}

export function adjustRingGeometry(geom) {
  const twopi = 2 * Math.PI;
  const iVer = Math.max(2, geom.gridY);
  for (let i = 0; i < iVer + 1; i++) {
    const fRad1 = i / iVer,
        fRad2 = (i + 1) / iVer,
        fX1 = geom.innerRadius * Math.cos(fRad1 * twopi),
        fY1 = geom.innerRadius * Math.sin(fRad1 * twopi),
        fX2 = geom.outerRadius * Math.cos(fRad1 * twopi),
        fY2 = geom.outerRadius * Math.sin(fRad1 * twopi),
        fX4 = geom.innerRadius * Math.cos(fRad2 * twopi),
        fY4 = geom.innerRadius * Math.sin(fRad2 * twopi),
        fX3 = geom.outerRadius * Math.cos(fRad2 * twopi),
        fY3 = geom.outerRadius * Math.sin(fRad2 * twopi),
        v1 = new THREE.Vector3(fX1, fY1, 0),
        v2 = new THREE.Vector3(fX2, fY2, 0),
        v3 = new THREE.Vector3(fX3, fY3, 0),
        v4 = new THREE.Vector3(fX4, fY4, 0);
    geom.vertices.push(new THREE.Vertex(v1));
    geom.vertices.push(new THREE.Vertex(v2));
    geom.vertices.push(new THREE.Vertex(v3));
    geom.vertices.push(new THREE.Vertex(v4));
  }
  for (let i = 0; i < iVer + 1; i++) {
    geom.faces.push(new THREE.Face3(i * 4, i * 4 + 1, i * 4 + 2));
    geom.faces.push(new THREE.Face3(i * 4, i * 4 + 2, i * 4 + 3));
    geom.faceVertexUvs[0].push([
      new THREE.UV(0, 1),
      new THREE.UV(1, 1),
      new THREE.UV(1, 0)
    ]);
    geom.faceVertexUvs[0].push([
      new THREE.UV(0, 1),
      new THREE.UV(1, 0),
      new THREE.UV(0, 0)
    ]);
  }
  geom.computeFaceNormals();
  geom.boundingSphere = {
    radius: geom.outerRadius
  };
}

export interface IRing {
  ringTexture: string;
  innerRadiusMult: number;
  outerRadiusMult: number;
};
