import { createCanvas, loadImage } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegPath!);

interface HeadlineOption {
  headline: string;
  headlineFont: string;
  headlineColor: string;
}

interface UrlOption {
  url: string;
  urlFont: string;
  urlColor: string;
}

export interface LogoVideoOptions {
  headlineOption: HeadlineOption;
  urlOption: UrlOption;
  background: string;
  animationDuration: number;    // total duration of text animation in seconds
  animationActiveDuration: number;    // duration of active text animation in seconds
  finalFrameDuration: number;    // duration for holding the last frame in seconds  
}

export const createLogoVideo = async (
  options: LogoVideoOptions, 
  logoPath: string, 
  width: number, 
  height: number,
): Promise<string> => {
  const {
    urlOption,
    headlineOption,
    background,
    animationDuration,
    animationActiveDuration,
    finalFrameDuration,
  } = options;

  const outputPath = path.join(__dirname, '../temp/logovideo.mp4');
  const searchBarImagePath = path.join(__dirname, '../media/sb.png');
  const searchBarCoordsx = 60;
  const searchBarCoordsy = 600;

  const maxLogoWidth = width * 0.8;
  const maxLogoHeight = height * 0.4;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Load and resize the logo image while maintaining aspect ratio
  const logo = await loadImage(logoPath);
  let logoWidth = logo.width;
  let logoHeight = logo.height;

  if (logoWidth > maxLogoWidth || logoHeight > maxLogoHeight) {
    const widthRatio = maxLogoWidth / logoWidth;
    const heightRatio = maxLogoHeight / logoHeight;
    const scaleRatio = Math.min(widthRatio, heightRatio);

    logoWidth *= scaleRatio;
    logoHeight *= scaleRatio;
  }

  const logoX = (width - logoWidth) / 2;
  const logoY = (height - logoHeight) / 4;

  // Create a function to draw the basic canvas (logo + background)
  const drawBaseCanvas = async () => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);

    // Add the headline text
    ctx.font = headlineOption.headlineFont;
    ctx.fillStyle = headlineOption.headlineColor;
    const headlineWidth = ctx.measureText(headlineOption.headline).width;
    const headlineX = (width - headlineWidth) / 2;
    const headlineY = logoY + logoHeight + 700;
    ctx.fillText(headlineOption.headline, headlineX, headlineY);

    // Draw the search bar image
    const searchBarImage = await loadImage(searchBarImagePath);
    ctx.drawImage(searchBarImage, searchBarCoordsx, searchBarCoordsy);
  };

  // Create the output directory for frames if it doesn't exist
  const frameDir = path.join(__dirname, '../temp/frames');
  if (!fs.existsSync(frameDir)) {
    fs.mkdirSync(frameDir, { recursive: true });
  }

  // Animation properties
  const frameRate = 30;
  const animationFrames = animationActiveDuration * frameRate;
  const totalFrames = (animationDuration + finalFrameDuration) * frameRate;

  // Stage 1: Static image (start)
  await drawBaseCanvas();

  // Save the static frame
  const saveFrame = (framePath: string) => {
    return new Promise<void>((resolve) => {
      const out = fs.createWriteStream(framePath);
      const stream = canvas.createPNGStream();
      stream.pipe(out);
      out.on('finish', resolve);
    });
  };

  await saveFrame(path.join(frameDir, 'frame_0000.png'));

  // Stage 2: Animated text over the search bar (URL)
  for (let i = 0; i < animationFrames; i++) {
    await drawBaseCanvas();
    
    // Now add the animated URL text in front of the search bar
    const textLength = Math.floor((i / animationFrames) * urlOption.url.length);
    const animatedUrl = urlOption.url.slice(0, textLength);

    // Auto-center the URL text
    ctx.font = urlOption.urlFont;
    ctx.fillStyle = urlOption.urlColor;
    const urlWidth = ctx.measureText(animatedUrl).width;
    const urlTextX = (width - urlWidth) / 2;
    const urlTextY = searchBarCoordsy + 510; // Adjust for center
    ctx.fillText(animatedUrl, urlTextX, urlTextY);

    await saveFrame(path.join(frameDir, `frame_${i.toString().padStart(4, '0')}.png`));
  }

  // Stage 3: Hold full text at the end
  for (let i = animationFrames; i < totalFrames; i++) {
    await drawBaseCanvas();

    // Auto-center the full URL text
    ctx.font = urlOption.urlFont;
    ctx.fillStyle = urlOption.urlColor;
    const urlWidth = ctx.measureText(urlOption.url).width;
    const urlTextX = (width - urlWidth) / 2;
    const urlTextY = searchBarCoordsy + 510; // Adjust for center
    ctx.fillText(urlOption.url, urlTextX, urlTextY);

    await saveFrame(path.join(frameDir, `frame_${i.toString().padStart(4, '0')}.png`));
  }

  // Create video from frames using FFmpeg
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(path.join(frameDir, 'frame_%04d.png'))
      .inputFPS(frameRate)
      .output(outputPath)
      .outputOptions('-pix_fmt yuv420p')
      .on('end', () => {
        console.log('Logo Video created successfully');
        resolve(true);
      })
      .on('error', (err) => {
        console.error('Error creating video:', err);
        reject(err);
      })
      .run();
  });
  
  // Clear the frames directory
  fs.readdir(frameDir, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(frameDir, file), (err) => {
        if (err) throw err;
      });
    }  
  });

  return outputPath;
};
