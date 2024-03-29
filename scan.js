/*!
 * Copyright (c) 2021-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {
  PDF417Reader,
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  HTMLCanvasElementLuminanceSource
} from '@zxing/library';
import delay from 'delay';

// one frame is 16 ms because it is the amount of time a single frame
// would be rendered in a 60 frames/sec video, i.e., it should not be
// perceptible to a human
const ONE_FRAME_MS = 16;
// for converting degrees to radians for rotation
const RADIANS_PER_DEGREE = Math.PI / 180;
// number of pixels to allow around a detected PDF417 barcode bounding box
const BOX_ERROR = 50;

export default async function scan({url}) {
  const image = await _getImage({url});
  await delay(ONE_FRAME_MS);

  // create working square canvas with max width/height to enable rotation of
  // images within it
  const canvas = document.createElement('canvas');
  const dimension = Math.max(image.width, image.height);
  canvas.width = canvas.height = dimension;
  // enable image smoothing as it seems to improve scan success rate
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // scan in bands of high/low width scaled images
  const highWidth = Math.min(image.width - 11, 2000);
  const lowWidth = Math.min(image.width / 2, 1000);

  // create widths to scale the image by incrementally adding two pixels to
  // the width that defines each band; this increases the likelihood that the
  // scaling algorithm will flip pixels in the barcode and yield a success
  const widths = [highWidth, lowWidth];
  for(let i = 0, hw = highWidth + 2, lw = lowWidth + 2;
    i < 5; ++i, ++hw, ++lw) {
    widths.push(hw, lw);
  }

  let err;
  const rotations = [0, 90, 270];
  for(const rotation of rotations) {
    for(const width of widths) {
      // render the image with the given width and rotation
      _render({canvas, image, width, rotation});

      // try to detect the PDF417 barcode
      try {
        const result = await _getBarcode({canvas});
        if(result) {
          return result;
        }
      } catch(e) {
        err = e;
      }

      await delay(ONE_FRAME_MS);
    }
  }
  if(err) {
    throw err;
  }

  return null;
}

async function _getImage({url}) {
  const image = new Image();
  const imageLoaded = new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
  });
  image.src = url;
  await imageLoaded;
  return image;
}

async function _getBarcode({canvas}) {
  const result = await _detectWithTimeout({canvas});
  if(!result) {
    // no barcode detected
    return null;
  }

  // native detector has already parsed the barcode
  if(result.barcode) {
    // normalize (somewhat) to zxing results
    return {
      text: result.barcode.rawValue,
      resultPoints: result.points,
      barcode
    };
  }

  // crop barcode and decode it
  const croppedImage = _crop({canvas, result});
  const decoded = await _decodeWithTimeout({canvas: croppedImage});
  if(!(decoded && decoded.length === 1)) {
    // no barcode decoded
    return false;
  }

  return decoded[0];
}

function _crop({canvas, result}) {
  // destructure result into barcode bounding box coordinates
  const {points: [[tl, bl, tr, br]]} = result;

  // calculate bounding box with some error margin
  const left = Math.max(Math.min(bl.x, tl.x) - BOX_ERROR, 0);
  const right = Math.min(Math.max(tr.x, br.x) + BOX_ERROR, canvas.width);
  const top = Math.max(Math.min(tl.y, tr.y) - BOX_ERROR, 0);
  const bottom = Math.min(Math.max(bl.y, br.y) + BOX_ERROR, canvas.height);
  const height = bottom - top;
  const width = right - left;

  // write the contents of bounding box to a new canvas
  const destCanvas = document.createElement('canvas');
  destCanvas.width = width;
  destCanvas.height = height;
  destCanvas.getContext('2d').drawImage(
    canvas,
    // source rect with content to crop
    left, top, width, height,
    // destination rect, same size as source rect
    0, 0, width, height);
  return destCanvas;
}

async function _decode({canvas}) {
  const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas);
  const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
  const formats = [BarcodeFormat.PDF_417];
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
  return PDF417Reader.decode(binaryBitmap, hints);
}

async function _decodeWithTimeout({canvas, timeout = ONE_FRAME_MS}) {
  return Promise.race([_decode({canvas}), delay(timeout)]);
}

async function _detect({canvas}) {
  if(globalThis.BarcodeDetector) {
    try {
      // attempt native scan
      const barcodeDetector = new BarcodeDetector({formats: ['pdf417']});
      const [barcode] = await barcodeDetector.detect(canvas);
      if(barcode) {
        // normalize to zxing results
        const {boundingBox} = barcode;
        const points = [[
          // top-left
          {x: boundingBox.left, y: boundingBox.top},
          // bottom-left
          {x: boundingBox.left, y: boundingBox.bottom},
          // top-right
          {x: boundingBox.right, y: boundingBox.top},
          // bottom-right
          {x: boundingBox.right, y: boundingBox.bottom}
        ]];
        return {result: points, barcode};
      }
    } catch(e) {
      // log, but ignore error, try non-native detection
      console.log('Native barcode detection failed', e);
    }
  }

  const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas);
  const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
  const formats = [BarcodeFormat.PDF_417];
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
  const result = await PDF417Reader.detect(binaryBitmap, hints);
  if(result && result.points[0] && !result.points[0].includes(null)) {
    return result;
  }
  // no barcode detected
  return null;
}

async function _detectWithTimeout({canvas, timeout = ONE_FRAME_MS}) {
  return Promise.race([_detect({canvas}), delay(timeout)]);
}

function _render({canvas, image, width, rotation}) {
  // reset 2d transform and clear canvas
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // coordinates for the center of the image
  const cx = image.width / 2;
  const cy = image.height / 2;

  // determine scale for image
  let scale = 1;
  if(image.width > width) {
    scale = width / image.width;
  }

  // set transform to prepare to scale and rotate the image; the horizontal
  // and vertical scaling is the same and we move to the center of the image
  // for rotation around it
  ctx.setTransform(scale, 0, 0, scale, cx, cy);

  // perform rotation, if any
  if(rotation !== 0) {
    // rotate given degrees (convert to radians)
    ctx.rotate(rotation * RADIANS_PER_DEGREE);
  }

  // draw image, noting that the transformation has moved the context to the
  // center of the image, so we must adjust the coordinates for where to draw
  ctx.drawImage(image, -cx, -cy);
}
