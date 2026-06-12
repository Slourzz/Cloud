import { useMusicPlayer } from "@/hooks/use-music-player";
import { AlbumArtBackground } from "./AlbumArtBackground";

export function BackgroundLayer() {
  const { currentSong } = useMusicPlayer();
  return <AlbumArtBackground coverUrl={currentSong?.coverUrl} />;
}
