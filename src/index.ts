import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import KoaRouter from '@koa/router';

import { createVideo } from './video_processor';
import { getProdImages } from './image_downloader';
import { createCollage } from './image_processor';

const app = new Koa();
const router = new KoaRouter();

// Create Video from 3 images and audio
router.get('/createVideo', async (ctx) => {
  try {
    const { video } = ctx.request.body;
    console.log('Request body:', video);

    const videoPath = await createVideo(video);
    ctx.body = {
      video: videoPath
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = 'Error creating video';
  }
});

// Fetch images from the database product table by keywords
router.post('/getProdImgs', async (ctx) => {
  try {
    const { keywords } = ctx.request.body;
    const numOfImg = 6;
    //console.log('Request keywords:', keywords);

    if (!Array.isArray(keywords) || keywords.length === 0) {
      ctx.status = 400;
      ctx.body = 'Keywords must be a non-empty array';
      return;
    }
    const downloadedImages = await getProdImages(numOfImg, keywords);
    ctx.body = {
        images: downloadedImages
    };
} catch (error) {
    ctx.status = 500;
    ctx.body = 'Error fetching images';
  }
});

// create collage image
router.get('/createCollage', async (ctx) => {
  try {
    const { collage } = ctx.request.body;
    console.log('Request body:', collage);

    const collageImage = await createCollage(collage);
    ctx.body = {
      images: collageImage
    };
  } catch (error) { 
    ctx.status = 500;
    ctx.body = 'Error createing Collage';
  }
});

app.use(bodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
