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
  const reader = new FileReader();
  const p = new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
  });
  const i = await fetch(url);
  reader.readAsDataURL(await i.blob());
  // after p resolves, reader.result will contain data: URL
  const b64DataUrl = await p;
  console.log('VVVVVVV', b64DataUrl);
  const b64 = b64DataUrl.split(',')[1];
  // const b64 = b64DataUrl.replace(/^data:.*\/.*;base64,/, ``);
  // const b64 = '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';
  console.log('TTTTTT', b64);
  const photon = await import('@silvia-odwyer/photon');
  const u = photon.PhotonImage.new_from_base64(b64);
  // const y = photon.base64_to_image(b64);
  // console.log('YYYYYYYY', y);
  console.log('IIIIII', u);
  // const image = await Jimp.read({url});
  // image.grayscale();
  // return await findPoints({image});
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
