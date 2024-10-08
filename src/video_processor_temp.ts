import ffmpeg from 'fluent-ffmpeg';
import { createCanvas, loadImage } from 'canvas';
import Jimp from 'jimp';
import fs from 'fs';
import * as path from 'path';

const audioPath = path.join(__dirname, '../media/audio/LOVE.mp3');
const tempfilepath = path.join(__dirname, '../temp/temp_video.mp4');

export const tempCollagePath = path.join(__dirname, '../media/temp_collage.png');
export const outputPath = path.join(__dirname, '../output/test003.mp4');
export const imageDuration = 3;

interface HeadlineOptions {
  headling: string;
  x: number;
  y: number;
  font?: string;
  color?: string;
}

interface ImageOptions {
  url: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

async function overlayTextOnImage(
  imagePath: string, 
  outputPath: string, 
  text: string,
  xloc: number,
  yloc: number,
) {
  try {
      const image = await loadImage(imagePath);
      
      // Create a canvas with the same dimensions as the image
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');

      // Draw the image on the canvas
      ctx.drawImage(image, 0, 0);

      // Set the text properties
      const fontSize = 36;
      ctx.font = `${fontSize}px Helvetica`;
      ctx.fillStyle = 'black';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Add the text to the canvas at the coordinates
      ctx.fillText(text, xloc, yloc);

      // Save the resulting image to the output path
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);

      console.log(`Canvas created with text successfully`);
  } catch (error) {
      console.error('Error overlaying text on image:', error);
  }
}

async function padBackground(inputFile: string, outputFile: string): Promise<void> {
  try {
    const image = await Jimp.read(inputFile);

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const alpha = this.bitmap.data[idx + 3];
      if (alpha === 0) {
        this.bitmap.data[idx] = 255;      // R
        this.bitmap.data[idx + 1] = 255;  // G
        this.bitmap.data[idx + 2] = 255;  // B
        this.bitmap.data[idx + 3] = 255;  // A
      }
    });

    await image.writeAsync(outputFile);
    console.log('Image background changed to white successfully');
  } catch (error) {
    console.error('Error processing image:', error);
  }
}

async function createCollageFrom6Images (
  images: { [key: string]: string }, 
  tempCollagePath: string
): Promise<void> {
  const requiredImages = ['img1', 'img2', 'img3', 'img4', 'img5', 'img6'];

  // Ensure that the dictionary contains all required images
  for (const key of requiredImages) {
    if (!images[key]) {
      return Promise.reject(new Error(`Missing image: ${key}`));
    }
  }

  // Pad each image
  const paddedImages: { [key: string]: string } = {};
  await Promise.all(requiredImages.map(async (key) => {
    const inputFile = images[key];
    const outputFile = path.join(__dirname, `../tempImg/padded_img_${key}.png`);
    await padBackground(inputFile, outputFile);
    paddedImages[key] = outputFile;
  }));

  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(paddedImages.img1)
      .input(paddedImages.img2)
      .input(paddedImages.img3)
      .input(paddedImages.img4)
      .input(paddedImages.img5)
      .input(paddedImages.img6)
      .complexFilter([
        '[0:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:white[t0]; \
         [1:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:white[t1]; \
         [2:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:white[t2]; \
         [3:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:white[t3]; \
         [4:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:white[t4]; \
         [5:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:white[t5]',
        '[t0][t1]hstack=inputs=2[top]; \
         [t2][t3]hstack=inputs=2[mid]; \
         [t4][t5]hstack=inputs=2[bot]',
        '[top][mid][bot]vstack=inputs=3[v]'
      ])
      .map('[v]')
      .output(tempCollagePath)
      .on('end', () => {
        console.log('Collage created successfully.');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error creating collage:', err);
        reject(err);
      })
      .run();
  });
};

// resizeImage function
async function resizeImage(
  inputPath: string, 
  canvasSizeX: number, 
  canvasSizeY: number,
  outputPath: string) {  
  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-vf scale='if(gt(a,1),${canvasSizeX},-1)':'if(gt(a,1),-1,${canvasSizeX})',pad=${canvasSizeX}:${canvasSizeY}:(ow-iw)/2:(oh-ih)/2:white`,  // Scale and pad
        '-pix_fmt rgba'           // Include alpha channel for transparency
      ])
      .on('end', () => {
        console.log('Image resized and padded successfully');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error resizing image:', err);
        reject(err);
      })
      .save(outputPath);
  });
}

// overlap logo image to image frame
async function overlayLogoImage(
  inputPath: string, 
  logoPath: string, 
  outputPath: string, 
  x: number, 
  y: number, 
  logoWidth: number
): Promise<void> {
  const resizedLogoPath = path.join(__dirname, '../temp/temp_logo.png');
  //await resizeImage(inputPath, logoWidth, resizedLogoPath)
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .input(logoPath)
      .complexFilter([
        // Resize the main image (similar to previous version)
        `[0:v]scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=0x00000000[bg]`,
        // Resize the logo to the fixed width and maintain aspect ratio
        `[1:v]scale=${logoWidth}:-1:force_original_aspect_ratio=decrease[logo]`,
        // Overlay the resized logo at the specified coordinates
        `[bg][logo]overlay=${x}:${y}`
      ])
      .outputOptions('-pix_fmt yuv420p') // Ensure compatibility
      .on('end', () => {
        console.log(`Image resized and logo overlaid successfully`);
        resolve();
      })
      .on('error', (err) => {
        console.error('Error processing image:', err);
        reject(err);
      })
      .save(outputPath);
  });
}

export const createVideoFrom2Images = async (): Promise<void> => {
  const resizedImage1Path = path.join(__dirname, '../temp/temp1.jpg');
  const resizedImage2Path = path.join(__dirname, '../temp/temp2.jpg');

  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(resizedImage1Path)
      .loop(imageDuration)
      .input(resizedImage2Path)
      .loop(imageDuration)
      .complexFilter([
        `[0:v] scale=1080:1080, setsar=1[img1]; [1:v] scale=1080:1080, setsar=1[img2]`,
        `[img1][img2] concat=n=2:v=1:a=0 [v]`,
        `[v][1:v] overlay=enable='between(t, 7.5, 15)'`
      ])
      .outputOptions([
        `-t ${imageDuration * 2}`
      ])
      .on('error', (err) => {
        console.error('Error:', err);
        reject(err);
      })
      .on('end', () => {
        console.log('Video created successfully.');
        resolve();
      })
      .save(tempfilepath);
  });
};

// create video: square / 3 images / logo / auido /
async function createVideoFrom3Images(
  imageResolutionX: number,
  imageResolutionY: number,
  imageDuration: number,
  image1Path: string,
  image2Path: string,
  image3Path: string,
  logoPath: string,
  outputPath: string,
): Promise<void> {
  const resizedImage1Path = path.join(__dirname, '../temp/temp1.jpg');
  const resizedImage2Path = path.join(__dirname, '../temp/temp2.jpg');
  const resizedImage3Path = path.join(__dirname, '../temp/temp3.jpg');

  await resizeImage(image1Path, imageResolutionX, imageResolutionY, resizedImage1Path);
  await resizeImage(image2Path, imageResolutionX, imageResolutionY, resizedImage2Path);
  await resizeImage(image3Path, imageResolutionX, imageResolutionY, resizedImage3Path);
  await overlayLogoImage(resizedImage1Path, logoPath, resizedImage1Path, 30, 30, 400);
  await overlayLogoImage(resizedImage2Path, logoPath, resizedImage2Path, 30, 30, 400);
  await overlayLogoImage(resizedImage3Path, logoPath, resizedImage3Path, 30, 30, 400);
  await overlayTextOnImage(resizedImage1Path, resizedImage1Path, 'Limited 15%', 120, 120);
  await overlayTextOnImage(resizedImage2Path, resizedImage2Path, 'Limited 25%', 120, 120);
  await overlayTextOnImage(resizedImage3Path, resizedImage3Path, 'Limited 35%', 120, 120);

  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(resizedImage1Path)
      .loop(imageDuration)
      .input(resizedImage2Path)
      .loop(imageDuration)
      .input(resizedImage3Path)
      .loop(imageDuration)
      .complexFilter([
        `[0:v] scale=${imageResolutionX}:${imageResolutionY}, setsar=1 [img1]; \
         [1:v] scale=${imageResolutionX}:${imageResolutionY}, setsar=1 [img2]; \
         [2:v] scale=${imageResolutionX}:${imageResolutionY}, setsar=1 [img3]`,
        `[img1][img2][img3] concat=n=3:v=1:a=0 [v]`,
        `[v][1:v] overlay=enable='between(t, 3, 6)'[out0]; \
         [out0][2:v] overlay=enable='between(t, 6, 9)'`
      ])
      .outputOptions([
        `-t ${imageDuration * 3}`
      ])
      .on('error', (err) => {
        console.error('Error creating video:', err);
        reject(err);
      })
      .on('end', () => {
        console.log('Video created successfully.');
        resolve();
      })
      .save(outputPath);
  });
};

async function addAudioToVideo(
  videoDuration: number,
  videoPath: string, 
  audioPath: string, 
  outputPath: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .addInput(audioPath)
      .setDuration(videoDuration)
      .on('error', (err) => {
        console.error('Error:', err);
        reject(err);
      })
      .on('end', () => {
        console.log('Audio added successfully.');
        resolve();
      })
      .save(outputPath);
  });
};

export const createVideo2 = async (): Promise<void> => {
  const tempfilepath = path.join(__dirname, '../temp/temp_video.mp4');

  try {
    //await createVideoFrom2Images();
    //await addAudioToVideo();
    console.log('Final video created successfully.');
  } catch (error) {
    console.error('Error creating video:', error);
  }
};

export const createVideo3 = async (): Promise<void> => {
  const image1Path = path.join(__dirname, '../media/001p.jpg');
  const image2Path = path.join(__dirname, '../media/002p.jpg');
  const image3Path = path.join(__dirname, '../media/temp_collage.png');
  const logoPath = path.join(__dirname, '../media/mts_logo.png');
  
  const videoDuration = 9;
  const imageResolutionX = 1080;
  const imageResolutionY = 1080;
  const imageDuration = 3;
  const tempfilepath = path.join(__dirname, '../temp/temp_video.mp4');
  const outputPath = path.join(__dirname, '../output/test001.mp4');

  try {
    await createVideoFrom3Images(imageResolutionX, imageResolutionY, imageDuration, image1Path, image2Path, image3Path, logoPath, tempfilepath);
    await addAudioToVideo(videoDuration, tempfilepath, audioPath, outputPath);
    console.log('Final video created successfully.');
  } catch (error) {
    console.error('Error creating video:', error);
  }
};

export const createCollage = async (): Promise<void> => {
  const sixImageTypeA = { 
    img1: path.join(__dirname, `../tempImg/temp_img_1.png`),
    img2: path.join(__dirname, `../tempImg/temp_img_2.png`),
    img3: path.join(__dirname, `../tempImg/temp_img_3.png`),
    img4: path.join(__dirname, `../tempImg/temp_img_4.png`),
    img5: path.join(__dirname, `../tempImg/temp_img_5.png`),
    img6: path.join(__dirname, `../tempImg/temp_img_6.png`),
  };
  //const tempfilepath = path.join(__dirname, '../temp/temp_collage.jpg');
  try {
    await createCollageFrom6Images(sixImageTypeA, tempCollagePath);
    console.log('Collage created complete.');
  } catch (error) {
    console.error('Error creating Collage:', error);
  }
};
