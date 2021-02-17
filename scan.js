/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
// import Jimp from 'jimp/es'
import {
  PDF417Reader,
  BinaryBitmap,
  HybridBinarizer,
  RGBLuminanceSource,
  HTMLCanvasElementLuminanceSource
} from '@zxing/library';
import delay from 'delay';

const DEGREE_TO_RADIANS = Math.PI / 180;

export default async function scan({url}) {
  const img = await getImage({url});
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  // ctx.filter = 'grayscale(100)';
  // const image = await Jimp.read({url});
  // image.grayscale();
  return await findPoints({canvas});
}

async function getImage({url}) {
  const reader = new FileReader();
  const p = new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
  });
  const i = await fetch(url);
  reader.readAsDataURL(await i.blob());
  const imageData = await p;
  const img = new Image();
  img.src = imageData;

  return img;
}

async function findPoints({canvas}) {
  if(canvas.width > 3000) {
    throw new Error('SCALE NOT IMPLEMENTED');
    // image.resize(2000, Jimp.AUTO, Jimp.RESIZE_BICUBIC);
  }

  const rotations = [0, 180, 90, 180];
  for(const rotation of rotations) {
    console.log('TTTTTTTT', rotation);
    if(rotation > 0) {
      const ctx = canvas.getContext('2d');
      ctx.rotate(rotation * DEGREE_TO_RADIANS);
    }
    const canvasClone = cloneCanvas(canvas);
    for(let contrast = 100; contrast <= 120; contrast += 1) {
      // const ctx = canvasClone.getContext('2d');
      const c = contrast / 100;
      console.log('CCCCCC', c);
      const newCanvas = document.createElement('canvas');
      newCanvas.width = canvasClone.width;
      newCanvas.height = canvasClone.height;
      const ctx2 = newCanvas.getContext('2d');
      ctx2.filter = `contrast(${c})`;
      ctx2.drawImage(canvasClone, 0, 0);
      // image.contrast(contrast);
      const result = await tryImage({canvas: newCanvas});
      if(result && result.points[0] && !result.points[0].includes(null)) {
        console.log('111111111');
        const processedPoints = await processPoints(
          {canvas: newCanvas, result});
        if(processedPoints) {
          return processedPoints;
        }
        continue;
      }
    }
  }
  throw new Error('Scanning Error');
}

function cloneCanvas(oldCanvas) {

    //create a new canvas
    var newCanvas = document.createElement('canvas');
    var context = newCanvas.getContext('2d');

    //set dimensions
    newCanvas.width = oldCanvas.width;
    newCanvas.height = oldCanvas.height;

    //apply the old canvas to the new one
    context.drawImage(oldCanvas, 0, 0);

    //return the new canvas
    return newCanvas;
}

async function processPoints({canvas, result}) {
  const croppedImage = cropImage({canvas, result});
  const decodeResult = await decodeImage({canvas: croppedImage});
  if(decodeResult.length === 1) {
    console.log(`SUCCESSFULLY DECODED`);
    return decodeResult[0];
  }
}

const cropCanvas = (sourceCanvas, left, top, width, height) => {
  let destCanvas = document.createElement('canvas');
  destCanvas.width = width;
  destCanvas.height = height;
  destCanvas.getContext("2d").drawImage(
      sourceCanvas,
      left, top, width, height,  // source rect with content to crop
      0, 0, width, height);      // newCanvas, same size as source rect
  return destCanvas;
}

function cropImage({canvas, result}) {
  const points = result.points[0];
  const topLeftX = points[0].x;
  const topLeftY = points[0].y;
  const topRightX = points[2].x;
  const topRightY = points[2].y;
  const bottomLeftX = points[1].x;
  const bottomLeftY = points[1].y;
  const bottomRightX = points[3].x;
  const bottomRightY = points[3].y;

  const leftMin = Math.max(Math.min(bottomLeftX, topLeftX) - 50, 0);
  const rightMax = Math.min(
    Math.max(topRightX, bottomRightX) + 50, canvas.width);
  const topMin = Math.max(Math.min(topLeftY, topRightY) - 50, 0);
  const bottomMax = Math.min(
    Math.max(bottomLeftY, bottomRightY) + 50, canvas.height);
  const height = bottomMax - topMin;
  const width = rightMax - leftMin;
  // const croppedImage = image.clone();
  const croppedImage = cropCanvas(canvas, leftMin, topMin, width, height);
  // croppedImage.crop(leftMin, topMin, width, height);
  return croppedImage;
}

async function decodeImage({canvas}) {
  let result = [];
  try {
    result = await Promise.race([
      (async () => {
        const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas);
        const binaryBitmap = new BinaryBitmap(new HybridBinarizer(
          luminanceSource));
        const r = await PDF417Reader.decode(binaryBitmap);
        console.log('RRRRRRRRRRRRR', r);
        return r;
      })(),
      delay(5),
    ]);
  } catch(e) {
    console.error(`Decode Error: ${e.toString()}`);
  }
  return result;
}

async function tryImage({canvas}) {
  let result;
  // const pixels = computePixels({image});
  try {
    result = await Promise.race([
      (async () => {
        const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas);
        const binaryBitmap = new BinaryBitmap(new HybridBinarizer(
          luminanceSource));
        const r = await PDF417Reader.detect(binaryBitmap);
        return r;
      })(),
      delay(5),
    ]);
  } catch(e) {
    console.error(`Detection Error: ${e.toString()}`);
  }
  return result;
}

function computePixels({image}) {
  const pixels = [];

  for(let p = 0; p < image.bitmap.width * image.bitmap.height * 4; p += 4) {
    const r = image.bitmap.data[p];
    const g = image.bitmap.data[p + 1];
    const b = image.bitmap.data[p + 2];
    const a = image.bitmap.data[p + 3];

    let rgba = r;
    rgba = (rgba << 8) + g;
    rgba = (rgba << 8) + b;
    rgba = (rgba << 8) + a;

    pixels.push(rgba);
  }

  return pixels;
}
