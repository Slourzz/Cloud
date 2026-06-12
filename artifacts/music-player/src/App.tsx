import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MusicPlayerProvider, useMusicPlayer } from "@/hooks/use-music-player";
import { ThemeColorsProvider } from "@/hooks/use-theme-colors";
import { PlaylistsProvider } from "@/hooks/use-playlists";
import { LyricsProvider } from "@/hooks/use-lyrics";
import { DarkModeProvider } from "@/hooks/use-dark-mode";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import Home from "@/pages/home";
import Library from "@/pages/library";
import Queue from "@/pages/queue";
import Liked from "@/pages/liked";
import Playlists from "@/pages/playlists";
import PlaylistDetailInmersivo from "@/pages/PlaylistDetailInmersivo";
import { SplashScreen } from "@/components/SplashScreen";
import { TranslationProvider } from "@/hooks/use-translations";
import { AppearanceProvider } from "@/providers/appearance-provider";
import ArtistDetail from "@/pages/artist-detail";
import AlbumDetail from "@/pages/album-detail";
import { CloudNotificationsProvider } from "@/hooks/use-cloud-notifications";
import { DiscordAuthProvider } from "@/hooks/use-discord-auth";
import { GoogleCastProvider } from "@/hooks/use-google-cast";

const queryClient = new QueryClient();

function Router() {
  return (
    <DiscordAuthProvider>
      <CloudNotificationsProvider>
        <Layout>
          <Switch>
            <Route path="/" component={() => <Redirect to="/home" />} />
            <Route path="/home" component={Home} />
            <Route path="/library" component={Library} />
            <Route path="/queue" component={Queue} />
            <Route path="/liked" component={Liked} />
            <Route path="/playlists" component={Playlists} />
            <Route path="/playlists/:id" component={PlaylistDetailInmersivo} />
            <Route path="/artist/:artist" component={ArtistDetail} />
            <Route path="/album/:artist/:album" component={AlbumDetail} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </CloudNotificationsProvider>
    </DiscordAuthProvider>
  );
}

function SplashManager() {
  const { isLoadingLibrary } = useMusicPlayer();
  const [showSplash, setShowSplash] = useState(false);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const splashShown = sessionStorage.getItem("splash-shown");
    if (!splashShown) {
      setShowSplash(true);
      sessionStorage.setItem("splash-shown", "true");
    }
    setAppReady(true);
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (!appReady) return null;

  return (
    <>
      {showSplash && (
        <SplashScreen
          onFinish={handleSplashFinish}
          isLoading={isLoadingLibrary}
        />
      )}
      <div
        style={{ opacity: showSplash ? 0 : 1, transition: "opacity 0.8s ease" }}
      >
        <Router />
      </div>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TranslationProvider>
        <AppearanceProvider>
          <TooltipProvider>
            <DarkModeProvider>
              <MusicPlayerProvider>
                <ThemeColorsProvider>
                  <PlaylistsProvider>
                    <LyricsProvider>
                      <GoogleCastProvider>
                        <WouterRouter>
                          <SplashManager />
                        </WouterRouter>
                      </GoogleCastProvider>
                    </LyricsProvider>
                  </PlaylistsProvider>
                </ThemeColorsProvider>
              </MusicPlayerProvider>
            </DarkModeProvider>
            <Toaster />
            <SonnerToaster
              position="top-center"
              toastOptions={{ duration: 5000 }}
            />
          </TooltipProvider>
        </AppearanceProvider>
      </TranslationProvider>
    </QueryClientProvider>
  );
}

export default App;
