import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Generate a small poster once, at upload time, and release native resources. */
export async function createChatVideoPoster(uri: string): Promise<string> {
  const player = createVideoPlayer(null);
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let image: Awaited<ReturnType<ReturnType<typeof ImageManipulator.manipulate>['renderAsync']>> | undefined;
  let thumbnail: VideoThumbnail | undefined;
  try {
    player.muted = true;
    await player.replaceAsync(uri);
    [thumbnail] = await player.generateThumbnailsAsync([0], { maxWidth: 480, maxHeight: 480 });
    if (!thumbnail) throw new Error('No video frame available');
    context = ImageManipulator.manipulate(thumbnail);
    image = await context.renderAsync();
    return (await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 })).uri;
  } finally {
    image?.release();
    context?.release();
    thumbnail?.release();
    player.release();
  }
}
