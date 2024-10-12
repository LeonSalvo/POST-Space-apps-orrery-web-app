import Papa from "papaparse";
import { NEO } from "./Neo";
import {Font, FontData, FontLoader} from "three/examples/jsm/loaders/FontLoader";

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
}

export interface IRing {
  ringTexture: string;
  innerRadiusMult: number;
  outerRadiusMult: number;
};
