import OpenAI from "openai";
import Jimp from 'jimp';
import axios from 'axios';
import fs from 'fs';
import * as path from 'path';

const OPENAI_API_KEY="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"
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function downloadImage(url: string, filename: string): Promise<void> {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });
  
    const writer = fs.createWriteStream(path.resolve(__dirname, filename));
    response.data.pipe(writer);
  
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
}

async function createMask(inputImagePath: string, outputImagePath: string): Promise<void> {
    try {
        // Read the input image
        const image = await Jimp.read(inputImagePath);

        // Get the width and height of the image
        const { width, height } = image.bitmap;

        // Iterate through each pixel to set the background to transparent
        image.scan(0, 0, width, height, (x, y, idx) => {
            // Check if the pixel is white or close to white (allowing some tolerance)
            const tolerance = 30; // Adjust tolerance as needed
            if (image.getPixelColor(x, y) <= Jimp.rgbaToInt(255 - tolerance, 255 - tolerance, 255 - tolerance, 255)) {
                // Set the pixel to be fully transparent (alpha = 0)
                image.setPixelColor(Jimp.rgbaToInt(255, 255, 255, 0), x, y);
            }
        });

        // Save the image with transparent background
        await image.writeAsync(outputImagePath);

        console.log('Product image with transparent background created successfully');
    } catch (error) {
        console.error('Error creating transparent background:', error);
        throw error;
    }
}
      
async function createGAIImage() { 
  const inputPath = path.join(__dirname, '../media/temp/img7_padded_large.png');
  const maskPath = path.join(__dirname, '../tempImg/mask.png');
  const outputPath = path.join(__dirname, '../media/gaiBG_3.png');
  await createMask(inputPath, maskPath);

  const response = await openai.images.edit({
    image: fs.createReadStream(inputPath),
    //mask: fs.createReadStream(inputPath),
    prompt: "create an image of the July 4th. This image will be use as a background and leave the middle section blank",
    n: 1,
    size: "1024x1024"  
  });

  if (response.data[0] && response.data[0].url) {
    const image_url = response.data[0].url;
    //console.log(`GAI BG created ${image_url}.`);
    await downloadImage(image_url, outputPath);
  } else {
    // Handle the case where response.data[0] or response.data[0].url is undefined
    console.error('Failed to retrieve image URL from response');
  }
}


export const createGAIbackground = async (): Promise<void> => {
    try {
      await createGAIImage();
      console.log('GAI BG created successfully.');
    } catch (error) {
      console.error('Error creating video:', error);
    }
  };
  