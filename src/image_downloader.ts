import { Client } from 'pg';
import axios from 'axios';
import fs from 'fs';
import * as path from 'path';

const client = new Client({
    host: '',
    database: '',
    user: '',
    password: '',
    port: ,
});
  
async function queryRecords(keywords: string[]): Promise<any[]> {
    await client.connect();
    const keywordCondition = keywords.map(keyword => `title ILIKE '%${keyword}%'`).join(' OR ');
    const query = `SELECT title, image_url FROM public.products WHERE ${keywordCondition}`;
    const res = await client.query(query);
    await client.end();
    return res.rows;
}
  
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
  
export const getProdImages = async (numOfImg: number, keywords: string[]): Promise<any[]> => {
    const savePath = path.join(__dirname, '../media');
    const downloadedImages: any[] = [];

    try {
        const records = await queryRecords(keywords);
        
        if (records.length < numOfImg) {
            throw new Error('Less than 6 records found in product table');
        }
      
        const selectedRecords = new Set<number>();
        const downloadPromises: Promise<void>[] = [];
        let attemptCount = 0;
    
        while (downloadPromises.length < numOfImg && attemptCount < records.length) {
          // Get a random record that has not been used
          let index;
          do {
            index = Math.floor(Math.random() * records.length);
          } while (selectedRecords.has(index));
    
          selectedRecords.add(index);
          const record = records[index];
    
          try {
            const filename = path.join(savePath, `temp_img_${downloadPromises.length + 1}.png`);
            await downloadImage(record.image_url, filename);
            downloadedImages.push(record);
            downloadPromises.push(Promise.resolve());
          } catch (error) {
            console.error(`Failed to download image from ${record.image_url}: ${error}`);
          }
    
          attemptCount++;
        }
    
        if (downloadPromises.length < numOfImg) {
          throw new Error('Not enough images downloaded');
        }
        
        await Promise.all(downloadPromises);
        console.log(`${numOfImg} Images downloaded successfully.`);
        
        // Print the URL, title, and description_long of each image
        downloadedImages.forEach((record, index) => {
            console.log(`Image ${index + 1}:`);
            console.log(`URL: ${record.image_url}`);
            console.log(`Title: ${record.title}`);
            //console.log(`Description: ${record.description_long}`);
            console.log('------------------------------------');
        });
    
    } catch (err) {
        console.error('Error:', err);
    }
    return downloadedImages;
};
