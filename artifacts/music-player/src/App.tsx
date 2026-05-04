import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MusicPlayerProvider } from "@/hooks/use-music-player";
import { ThemeColorsProvider } from "@/hooks/use-theme-colors";
import { PlaylistsProvider } from "@/hooks/use-playlists";
import { LyricsProvider } from "@/hooks/use-lyrics";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

import Home from "@/pages/home";
import Library from "@/pages/library";
import Queue from "@/pages/queue";
import Liked from "@/pages/liked";
import Playlists from "@/pages/playlists";
import PlaylistDetail from "@/pages/playlist-detail";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/library" component={Library} />
        <Route path="/queue" component={Queue} />
        <Route path="/liked" component={Liked} />
        <Route path="/playlists" component={Playlists} />
        <Route path="/playlists/:id" component={PlaylistDetail} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MusicPlayerProvider>
          <ThemeColorsProvider>
            <PlaylistsProvider>
              <LyricsProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <Router />
                </WouterRouter>
              </LyricsProvider>
            </PlaylistsProvider>
          </ThemeColorsProvider>
        </MusicPlayerProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
