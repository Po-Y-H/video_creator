//import ffmpeg from 'fluent-ffmpeg';
//import Jimp from 'jimp';
import { createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';
import fs from 'fs';
import * as path from 'path';

interface ImageOptions {
    url: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
  
interface CollageOptions {
  width: number;
  height: number;
  resolution: number;
  images: ImageOptions[];
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

async function createOverlapImage(options: CollageOptions): Promise<void> {
  const { width, height, resolution, images } = options;
  const canvas = createCanvas(width * resolution, height * resolution);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // overlap images on canvas
  for (const image of images) {
    const img = await loadImage(image.url);
    
    const aspectRatio = img.width / img.height;
    let drawWidth = image.width * resolution;
    let drawHeight = image.height * resolution;

    if (drawWidth / aspectRatio > drawHeight) {
      drawWidth = drawHeight * aspectRatio;
    } else {
      drawHeight = drawWidth / aspectRatio;
    }

    // Calculate position to center the image
    const drawX = image.x * resolution + (image.width * resolution - drawWidth) / 2;
    const drawY = image.y * resolution + (image.height * resolution - drawHeight) / 2;

    // Draw image on canvas
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.fillStyle = '#f5f5f5';

    // Set title text properties
    ctx.font = `bold ${14 * resolution}px Open Sans`;
    ctx.fillStyle = 'black';

    const titleLines = wrapText(ctx, image.title, image.width * resolution);
    titleLines.forEach((line, index) => {
      const textWidth = ctx.measureText(line).width;
      const textX = image.x * resolution + (image.width * resolution - textWidth) / 2;
      const textY = (image.y + image.height + 12 + index * 20) * resolution;
      ctx.fillText(line, textX, textY);
    });
      /*
    // Draw description
    ctx.font = `${12 * resolution}px Arial`;
    const descriptionLines = wrapText(ctx, image.description, image.width * resolution);
    descriptionLines.forEach((line, index) => {
      ctx.fillText(line, image.x * resolution, (image.y + image.height + 24 + index * 20) * resolution);
    });
    */
  }
  const outputBuffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(__dirname, '../media/collage2.png'), outputBuffer);
}

export const createCollage = async (reqBody: any): Promise<void> => {
  const isNonEmptyString = (str: any): boolean => typeof str === 'string' && str.trim() !== '';
  const isNonNegativeNumber = (num: any): boolean => typeof num === 'number' && num >= 0;

  const verifyImageOptions = (image: any): ImageOptions => {
    if (!isNonEmptyString(image.url) || 
        !isNonEmptyString(image.title) || 
        !isNonNegativeNumber(image.x) || 
        !isNonNegativeNumber(image.y) || 
        !isNonNegativeNumber(image.width) || 
        !isNonNegativeNumber(image.height)) {
      throw new Error('Invalid or empty image object');
    }
    return image;
  };

  const verifyCollageOptions = (data: any): CollageOptions => {
    if (!isNonNegativeNumber(data.width) || 
        !isNonNegativeNumber(data.height) || 
        !isNonNegativeNumber(data.resolution)) {
      throw new Error('Invalid or empty collage dimensions or resolution');
    }
    if (!Array.isArray(data.images) || data.images.length === 0) {
      throw new Error('Invalid or empty images array');
    }
    data.images = data.images.map(verifyImageOptions);
    return data;
  };

  try {
    const collageOptions: CollageOptions = verifyCollageOptions(reqBody);
    await createOverlapImage(collageOptions);
    console.log('Collage created complete.');
  } catch (error) {
    console.error('Error creating Collage:', error);
  }
};