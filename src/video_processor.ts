import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { createLogoVideo, LogoVideoOptions } from './logovideo_processor';
import { createCanvas, loadImage, Image, registerFont } from 'canvas';

ffmpeg.setFfmpegPath(ffmpegPath!);

// properties of headling
interface HeadlineOptions {
  headline: string;
  x: number;
  y: number;
  font?: string;
  color?: string;
}

// properties of headling in Video Frames
interface LogoOptions {
  path: string;    // Logo image file path
  x: number;    // Image coordinate x (upper left cornor)
  y: number;    // Image coordinate y (upper left cornor)
  width: number;    // Image width
  height: number;    // Image height
}

// properties of Video Frames
interface FrameOptions {
  path: string;    // Image file path
  x: number;    // Image coordinate x (upper left cornor)
  y: number;    // Image coordinate y (upper left cornor)
  width: number;    // Image width
  height: number;    // Image height
}

// properties of Video
interface VideoOptions {
  frames: FrameOptions[];
  headline: HeadlineOptions;
  logo: LogoOptions;
  logoVideo?: LogoVideoOptions;    // Logo Video (Optional)
  audioPath?: string;    // Audio (Optional)
  background: string;
  videoResolutionX: number;
  videoResolutionY: number;
  frameDuration: number;    // duration for each frame
}

const isValidNumber = (num: any): boolean => typeof num === 'number' && !isNaN(num);

const checkFrameOptions = (frame: FrameOptions): boolean => {
  return isValidNumber(frame.x) && isValidNumber(frame.y) && isValidNumber(frame.width) && isValidNumber(frame.height);
};

function calculateAspectRatioFit(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  return { width: srcWidth * ratio, height: srcHeight * ratio };
}

async function editFrame(
  videoResolutionX: number,
  videoResolutionY: number,
  headlineOptions: HeadlineOptions,
  logoOptions: LogoOptions,
  frameOptions: FrameOptions,
  outputImagePath: string
): Promise<string> {
  try {
    if (!checkFrameOptions(frameOptions)) {
      console.log('Invalid frame options. Skipping frame creation.');
      return '';
    }

    // Create a canvas with the video resolution dimensions
    const canvas = createCanvas(videoResolutionX, videoResolutionY);
    const ctx = canvas.getContext('2d');

    // Fill the canvas with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, videoResolutionX, videoResolutionY);

    // Load and draw the frame image
    const frameImage = await loadImage(frameOptions.path);
    const frameDimensions = calculateAspectRatioFit(
      frameImage.width,
      frameImage.height,
      frameOptions.width,
      frameOptions.height
    );
    ctx.drawImage(
      frameImage,
      frameOptions.x + (frameOptions.width - frameDimensions.width) / 2,
      frameOptions.y + (frameOptions.height - frameDimensions.height) / 2,
      frameDimensions.width,
      frameDimensions.height
    );

    // Set font and measure text
    ctx.font = headlineOptions.font || '30px Arial';
    ctx.fillStyle = headlineOptions.color || 'black';
    const text = headlineOptions.headline;
    const textWidth = ctx.measureText(text).width;
    const textHeight = parseInt(ctx.font, 10); // Assumes font size is in pixels

    // Calculate position to center the text at (headlineOptions.x, headlineOptions.y)
    const x = headlineOptions.x - textWidth / 2;
    const y = headlineOptions.y + textHeight / 2; // Note: y is typically from the baseline

    // Draw the headline text on the canvas
    ctx.fillText(text, x, y);

    // Load and draw the logo image
    const logoImage = await loadImage(logoOptions.path);
    const logoDimensions = calculateAspectRatioFit(
      logoImage.width,
      logoImage.height,
      logoOptions.width,
      logoOptions.height
    );
    ctx.drawImage(
      logoImage,
      logoOptions.x + (logoOptions.width - logoDimensions.width) / 2,
      logoOptions.y + (logoOptions.height - logoDimensions.height) / 2,
      logoDimensions.width,
      logoDimensions.height
    );

    // Save the resulting image to the output path
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputImagePath, buffer);

    console.log('Frame created successfully.');
    return outputImagePath;
  } catch (error) {
    console.error('Error creating frame:', error);
    throw error;
  }
}

async function createVideoFrom3Images(
  videoOptions: VideoOptions,
  tempfilepath: string
): Promise<void> {
  const { frames, headline, logo, videoResolutionX, videoResolutionY, frameDuration } = videoOptions;
  if (frames.length !== 3) {
    throw new Error('Require exactly 3 frames');
  }
  
  const resizedImagePaths = [
    path.join(__dirname, '../temp/resized1.png'),
    path.join(__dirname, '../temp/resized2.png'),
    path.join(__dirname, '../temp/resized3.png'),
  ];

  const transitionDuration = 1;    // Duration of the transition in seconds

  await editFrame(videoResolutionX, videoResolutionY, headline, logo, frames[0], resizedImagePaths[0]);
  await editFrame(videoResolutionX, videoResolutionY, headline, logo, frames[1], resizedImagePaths[1]);
  await editFrame(videoResolutionX, videoResolutionY, headline, logo, frames[2], resizedImagePaths[2]);

  return new Promise<void>((resolve, reject) => {
    ffmpeg()
    .input(resizedImagePaths[0])
    .loop(frameDuration)
    .input(resizedImagePaths[1])
    .loop(frameDuration)
    .input(resizedImagePaths[2])
    .loop(frameDuration)
    .complexFilter([
      `[0:v] scale=${videoResolutionX}:${videoResolutionY}, setsar=1 [img1];
       [1:v] scale=${videoResolutionX}:${videoResolutionY}, setsar=1 [img2];
       [2:v] scale=${videoResolutionX}:${videoResolutionY}, setsar=1 [img3];
       [img1][img2] xfade=transition=fade:duration=${transitionDuration}:offset=${frameDuration - transitionDuration} [xf1];
       [xf1][img3] xfade=transition=fade:duration=${transitionDuration}:offset=${2 * frameDuration - transitionDuration}`,
    ])
    .outputOptions([
      `-t ${frameDuration * 3}`,
      `-pix_fmt yuv420p`
    ])
    .on('stderr', (stderr) => {
      console.log(`FFmpeg stderr: ${stderr}`);
    })
    .on('error', (err) => {
      console.error('Error creating video:', err);
      reject(err);
    })
    .on('end', () => {
      console.log('Video created successfully.');
      resolve();
    })
    .save(tempfilepath);
    return tempfilepath;
  });
};

export function mergeVideos(video1Path: string, video2Path: string, outputFilePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create a temporary file to store the list of input videos
    const listFilePath = path.join(__dirname, '../temp/temp_video_list.txt');
    const fileContent = `file '${video1Path}'\nfile '${video2Path}'`;

    fs.writeFileSync(listFilePath, fileContent);

    ffmpeg()
      .input(listFilePath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions('-c:v copy')  // Copy video codec without re-encoding
      .output(outputFilePath)
      .on('end', () => {
        // Clean up the temporary file
        fs.unlinkSync(listFilePath);
        console.log('Concatenation finished');
        resolve();
      })
      .on('error', (err) => {
        console.error('An error occurred:', err.message);
        reject(err);
      })
      .run();
  });
}

// append 
async function appendAudioToVideo(videoPath: string, audioPath: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .addInput(audioPath)
      .audioCodec('aac')
      .videoCodec('libx264')
      .on('error', reject)
      .on('end', () => resolve(outputPath))
      .save(outputPath);
  });
}

export const createVideo = async (videoOptions: VideoOptions): Promise<string> => {
  //const { VideoOptions } = options;

  // Step 1: Create the 3-frame video
  const outputPath = path.join(__dirname, '../output/test001.mp4');

  const videoPath = path.join(__dirname, '../temp/threeFrameVideo.mp4');
  await createVideoFrom3Images(videoOptions, videoPath);

  let currentVideoPath = videoPath;

  // Step 2: Create and append logo video if needed
  if (videoOptions.logoVideo) {
    const logoVideoPath = await createLogoVideo(videoOptions.logoVideo, videoOptions.logo.path, videoOptions.videoResolutionX, videoOptions.videoResolutionY);
    const mergedVideoPath = path.join(__dirname, '../temp/mergedVideo.mp4');
    await mergeVideos(currentVideoPath, logoVideoPath, mergedVideoPath);
    currentVideoPath = mergedVideoPath;
  }

  // Step 3: Add audio if needed
  if (videoOptions.audioPath) {
    const videoWithAudioPath = path.join(__dirname, '../temp/videoWithAudio.mp4');
    await appendAudioToVideo(currentVideoPath, videoOptions.audioPath, videoWithAudioPath);
    currentVideoPath = videoWithAudioPath;
  }

  // Step 4: Move the final video to the desired output path
  fs.renameSync(currentVideoPath, outputPath);

  // Clean up temporary files
  [videoPath, path.join(__dirname, '../temp/mergedVideo.mp4'), path.join(__dirname, '../temp/videoWithAudio.mp4')]
    .forEach(tempPath => {
      if (fs.existsSync(tempPath) && tempPath !== outputPath) {
        fs.unlinkSync(tempPath);
      }
    });

  return outputPath;
};