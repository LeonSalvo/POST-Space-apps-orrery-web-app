import * as THREE from "three";
import { LoadingManager } from "three";
import i18next from "i18next";
import * as scene from "./scene"

const loadingManager = new LoadingManager();

loadingManager.onStart = () => {
  console.log('📦 Iniciando descarga de recurso...');
};

loadingManager.onError = (url: string) => {
  console.log(`❌ Error cargando: ${url}`);
};

let toLoad: string[] = [];
let loaded: string[] = [];

// Actualizar la interfaz de carga (porcentaje y recurso actual)
function updateLoadingUI(percentage: number, percentageText: string, url: string) {
  const percentageElem = document.querySelector("p#percentage")!;
  const progressBar = document.querySelector("div#percentage-loading")!;
  const currentResourceElem = document.querySelector("h3#current-resource")!;

  percentageElem.textContent = `${percentageText}`;
  progressBar.style.width = `${percentage}%`;
  currentResourceElem.textContent = url;

  console.log(`📥 Cargando recurso: ${url} -> ${percentage}%`);
}

function updateImageLoadingUI(percentage: number, percentageText: string, url: string) {
  const percentageImageElem = document.querySelector("p#percentage-image")!;
  const progressImageBar = document.querySelector("div#percentage-image-loading")!;
  const currentImageResourceElem = document.querySelector("h3#current-image-resource")!;

  percentageImageElem.textContent = `${percentageText}`;
  progressImageBar.style.width = `${percentage}%`;
  currentImageResourceElem.textContent = url;

  console.log(`📥 Cargando imagen: ${url} -> ${percentage}%`);
}

// Mostrar el canvas y ocultar el loader después de la carga
function showCanvasAndHideLoader() {
  console.log('🚀 Iniciando NEO Navigator...');
  const overCanvas = document.querySelector("div#over-canvas")!;
  const resourcesDiv = document.querySelector("div#resources")!;

  overCanvas.style.animation = 'fadeIn 1s forwards';
  resourcesDiv.style.animation = 'fadeOut 1s forwards';

  scene.init();
  scene.animate();

  setTimeout(() => {
    resourcesDiv.style.display = 'none';
  }, 1000);
}

// Función principal para iniciar la aplicación
async function StartNeoNavigator() {
  try {
    console.log('🚀 Iniciando NEO Navigator...');
    const supportedLangs = await fetchSupportedLangs();
    const lang = detectLanguage(supportedLangs);

    const translation = await loadTranslation(lang);
    initializeI18next(lang, translation);

    const loadingText = document.querySelector("h1#loading-text")!;
    loadingText.textContent = i18next.t('loading');

    const textures = await fetchTextures();
    toLoad.push(...textures);
    await loadTextures(textures);
    showCanvasAndHideLoader();
  } catch (error) {
    console.error('Error al iniciar NEO Navigator:', error);
  }
}

// Cargar los idiomas soportados
async function fetchSupportedLangs(): Promise<{ [key: string]: boolean }> {
  console.log('🌐 Iniciando carga de idiomas...');
  const resSupportedLangs = await fetch('public/i18n/supported_langs.json');
  const supportedLangs = await resSupportedLangs.json();
  console.log('🌐 Idiomas soportados: ', supportedLangs);
  return supportedLangs;
}

// Detectar el idioma del navegador o usar inglés por defecto
function detectLanguage(supportedLangs: { [key: string]: boolean }): string {
  let lang = window.navigator.language.split('-')[0];
  if (!supportedLangs[lang]) {
    console.log('🌐 Idioma no soportado, cambiando a inglés...');
    lang = 'en';
  } else {
    console.log('🌐 Idioma del navegador:', lang);
  }
  return lang;
}

// Cargar las traducciones para el idioma seleccionado
async function loadTranslation(language: string): Promise<{ [id: string]: string }> {
  console.log('🌐 Cargando traducción:', `${language}.json`);
  try {
    const res = await fetch(`public/i18n/${language}.json`);
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('❌ Error al cargar la traducción:', language + '.json');
    return {};
  }
}

// Inicializar i18next con las traducciones cargadas
function initializeI18next(lang: string, translation: { [id: string]: string }) {
  i18next.init({
    lng: lang,
    resources: {
      [lang]: { translation },
    },
  });
}

// Cargar la lista de texturas desde un archivo JSON
async function fetchTextures(): Promise<string[]> {
  const res = await fetch('public/textures/textures.json');
  const textures = await res.json();
  return textures;
}

// Cargar todas las texturas utilizando el gestor de carga, monitorizando el progreso
async function loadTextures(textures: string[]) {
  for (const textureUrl of textures) {
    await loadTextureWithProgress(textureUrl);
  }
}

async function loadTextureWithProgress(textureUrl: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open('GET', textureUrl, true);
    request.responseType = 'blob'; // Para tratar los datos como un binario

    // Escuchar el progreso de la descarga
    request.onprogress = (event: ProgressEvent) => {
      if (event.lengthComputable) {
        const mbDownloaded = event.loaded / (1024 * 1024); // Convertir bytes a MB
        const mbTotal = event.total / (1024 * 1024); // Convertir bytes a MB
        const percentage = Math.floor((event.loaded / event.total) * 100);

        console.log(`📥 ${textureUrl}: ${mbDownloaded.toFixed(2)}MB / ${mbTotal.toFixed(2)}MB (${percentage}%)`);
        updateImageLoadingUI(
            percentage,
            `${mbDownloaded.toFixed(2)}MB / ${mbTotal.toFixed(2)}MB - ${percentage}%`,
            textureUrl
        );
      }
    };

    // Una vez cargado, usar la textura
    request.onload = () => {
      if (request.status === 200) {
        const blob = request.response;
        const url = URL.createObjectURL(blob); // Convertir el blob a URL
        const textureLoader = new THREE.TextureLoader(loadingManager);
        textureLoader.load(url, () => {
          console.log(`✅ Textura cargada: ${textureUrl}`);
          loaded.push(textureUrl)
          updateLoadingUI(
              Math.floor((loaded.length / toLoad.length) * 100),
              `${loaded.length} / ${toLoad.length} - ${Math.floor((loaded.length / toLoad.length) * 100)}%`,
              textureUrl
          );
          resolve();
        });
      } else {
        reject(new Error(`❌ Error cargando la textura: ${textureUrl} - Status: ${request.status}`));
      }
    };

    // Manejo de errores
    request.onerror = () => {
      reject(new Error(`❌ Error cargando la textura: ${textureUrl}`));
    };

    request.send();
  });
}

// Iniciar la aplicación
await StartNeoNavigator();

