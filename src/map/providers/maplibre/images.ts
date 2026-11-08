import type { Map } from "maplibre-gl";
import type { MapTokens } from "../../types";

export const IMAGE_IDS = {
  chevron: "fleet-chevron",
  alert: "fleet-alert",
  hatch: "fleet-hatch",
  routeChevron: "fleet-route-chevron",
} as const;

const SIZE = 48;

function context(): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const drawing = canvas.getContext("2d");
  if (!drawing) throw new Error("Canvas 2D is unavailable");
  return drawing;
}

function chevronImage(tokens: MapTokens): ImageData {
  const drawing = context();
  drawing.fillStyle = tokens.colors.textInverse;
  drawing.beginPath();
  drawing.moveTo(SIZE * 0.38, SIZE * 0.28);
  drawing.lineTo(SIZE * 0.7, SIZE * 0.5);
  drawing.lineTo(SIZE * 0.38, SIZE * 0.72);
  drawing.closePath();
  drawing.fill();
  return drawing.getImageData(0, 0, SIZE, SIZE);
}

function alertImage(tokens: MapTokens): ImageData {
  const drawing = context();
  drawing.fillStyle = tokens.colors.textInverse;
  drawing.font = `600 ${SIZE * 0.6}px sans-serif`;
  drawing.textAlign = "center";
  drawing.textBaseline = "middle";
  drawing.fillText("!", SIZE / 2, SIZE * 0.54);
  return drawing.getImageData(0, 0, SIZE, SIZE);
}

function routeChevronImage(tokens: MapTokens): ImageData {
  const drawing = context();
  drawing.fillStyle = tokens.colors.accent;
  drawing.strokeStyle = tokens.colors.surface;
  drawing.lineWidth = 5;
  drawing.beginPath();
  drawing.moveTo(SIZE * 0.36, SIZE * 0.26);
  drawing.lineTo(SIZE * 0.72, SIZE * 0.5);
  drawing.lineTo(SIZE * 0.36, SIZE * 0.74);
  drawing.closePath();
  drawing.fill();
  drawing.stroke();
  return drawing.getImageData(0, 0, SIZE, SIZE);
}

function hatchImage(tokens: MapTokens): ImageData {  const drawing = context();
  drawing.strokeStyle = tokens.colors.geofenceRestricted;
  drawing.lineWidth = 4;
  for (let offset = -SIZE; offset < SIZE * 2; offset += 16) {
    drawing.beginPath();
    drawing.moveTo(offset, 0);
    drawing.lineTo(offset + SIZE, SIZE);
    drawing.stroke();
  }
  return drawing.getImageData(0, 0, SIZE, SIZE);
}

function replaceImage(map: Map, id: string, image: ImageData): void {
  if (map.hasImage(id)) map.removeImage(id);
  map.addImage(id, image, { pixelRatio: 2 });
}

export function installImages(map: Map, tokens: MapTokens): void {
  replaceImage(map, IMAGE_IDS.chevron, chevronImage(tokens));
  replaceImage(map, IMAGE_IDS.alert, alertImage(tokens));
  replaceImage(map, IMAGE_IDS.hatch, hatchImage(tokens));
  replaceImage(map, IMAGE_IDS.routeChevron, routeChevronImage(tokens));
}

export function hasImages(map: Map): boolean {
  return Object.values(IMAGE_IDS).every((id) => map.hasImage(id));
}
