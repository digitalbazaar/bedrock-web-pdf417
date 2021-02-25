/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import Jimp from 'jimp/es';
import {
  PDF417Reader,
  BinaryBitmap,
  HybridBinarizer,
  RGBLuminanceSource
} from '@zxing/library';
import delay from 'delay';

export default async function scan({url}) {
  const image = await Jimp.read({url});
  image.grayscale();
  return findPoints({image});
}

async function findPoints({image}) {
  if(image.bitmap.width > 3000) {
    image.resize(2000, Jimp.AUTO, Jimp.RESIZE_BICUBIC);
  }
  const rotations = [0, 180, 90, 180];
  for(const rotation of rotations) {
    image.rotate(rotation);
    for(let contrast = 0; contrast <= .20; contrast += .10) {
      image.contrast(contrast);
      const result = await tryImage({image});
      if(result && result.points[0] && !result.points[0].includes(null)) {
        const processedPoints = await processPoints({image, result});
        if(processedPoints) {
          return processedPoints;
        }
        continue;
      }
    }
  }
  throw new Error('Scanning Error');
}

async function processPoints({image, result}) {
  const croppedImage = cropImage({image, result});
  const decodeResult = await decodeImage({image: croppedImage});
  if(decodeResult.length === 1) {
    console.log(`SUCCESSFULLY DECODED`);
    return decodeResult[0];
  }
}

function cropImage({image, result}) {
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
    Math.max(topRightX, bottomRightX) + 50, image.bitmap.width);
  const topMin = Math.max(Math.min(topLeftY, topRightY) - 50, 0);
  const bottomMax = Math.min(
    Math.max(bottomLeftY, bottomRightY) + 50, image.bitmap.height);
  const height = bottomMax - topMin;
  const width = rightMax - leftMin;
  const croppedImage = image.clone();
  croppedImage.crop(leftMin, topMin, width, height);
  return croppedImage;
}

async function decodeImage({image}) {
  let result = [];
  const pixels = computePixels({image});
  try {
    result = await Promise.race([
      (async () => {
        const luminanceSource = new RGBLuminanceSource(
          Int32Array.from(pixels), image.bitmap.width,
          image.bitmap.height,
        );
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

async function tryImage({image}) {
  let result;
  const pixels = computePixels({image});
  try {
    result = await Promise.race([
      (async () => {
        const luminanceSource = new RGBLuminanceSource(
          Int32Array.from(pixels), image.bitmap.width,
          image.bitmap.height,
        );
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
