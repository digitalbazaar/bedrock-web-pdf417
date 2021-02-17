/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {
  PDF417Reader,
  BinaryBitmap,
  HybridBinarizer,
  HTMLCanvasElementLuminanceSource
} from '@zxing/library';
import delay from 'delay';
import {fabric} from 'fabric';

const DEGREE_TO_RADIANS = Math.PI / 180;

export default async function scan({url}) {
  const p = new Promise(resolve => fabric.Image.fromURL(url, resolve));
  const fabricImage = await p;
  return await findPoints({fabricImage});
}

async function findPoints({fabricImage}) {
  // if(fabricImage.width > 3000) {
  //   console.log('SCALE NOT IMPLEMENTED');
  //   // image.resize(2000, Jimp.AUTO, Jimp.RESIZE_BICUBIC);
  // }

  const rotations = [0];
  for(const rotation of rotations) {
    await delay(100);
    // let rotateCanvas = canvas;
    if(rotation > 0) {
      fabricImage.rotate(rotation);
    }
    // const canvasClone = cloneCanvas(rotateCanvas);
    for(let contrast = 0; contrast <= 20; contrast += 1) {
      const p = new Promise(resolve => fabricImage.clone(resolve));
      const imageClone = await p;
      const c = contrast / 100;
      console.log('CONTRAST', c);
      // imageClone.filters.push(new fabric.Image.filters.Grayscale('lightness'));
      const filter = new fabric.Image.filters.Contrast({
        contrast: c
      });
      imageClone.filters.push(filter);
      imageClone.applyFilters();
      // imageClone.scaleToWidth(2000);
      const canvas = new fabric.Canvas('c');
      canvas.setDimensions({
        width: imageClone.width, height: imageClone.height
      });
      canvas.add(imageClone);

      const result = await tryImage({canvas: canvas.toCanvasElement()});
      if(result && result.points[0] && !result.points[0].includes(null)) {
        const processedPoints = await processPoints(
          {canvas: canvas.toCanvasElement(), result});
        if(processedPoints) {
          // enable to display successfully scanned canvas
          // document.body.appendChild(newCanvas);
          return processedPoints;
        }
        continue;
      }
    }
  }
  throw new Error('Scanning Error');
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
      delay(50),
    ]);
  } catch(e) {
    console.error(`Detection Error: ${e.toString()}`);
  }
  return result;
}
