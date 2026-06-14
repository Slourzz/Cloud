(function () {
  "use strict";

  var namespace = "urn:x-cast:com.cloudapp.player";
  var state = {
    layout: "cover",
    requestedLayout: "cover",
    lyricMotion: "animated",
    lyricFormat: "line-words",
    interfaceTheme: "crystalized",
    song: null,
    nextSong: null,
    lyrics: [],
    lyricsRevision: 0,
    credits: null,
    progress: 0,
    duration: 0,
    isPlaying: false,
    updatedAt: performance.now(),
  };

  var stage = document.getElementById("stage");
  var background = document.getElementById("background");
  var cover = document.getElementById("cover");
  var title = document.getElementById("title");
  var artist = document.getElementById("artist");
  var lyrics = document.getElementById("lyrics");
  var progress = document.getElementById("progress");
  var elapsed = document.getElementById("elapsed");
  var duration = document.getElementById("duration");
  var nextSong = document.getElementById("next-song");
  var nextCover = document.getElementById("next-cover");
  var nextTitle = document.getElementById("next-title");
  var nextArtist = document.getElementById("next-artist");
  var audio = document.getElementById("cast-audio");
  var receiverContext = null;
  var playerManager = null;
  var lastActiveLine = -1;
  var layoutTransitionTimer = 0;
  var kawarp = null;
  var kawarpReady = import("/kawarp-core.js")
    .then(function (module) {
      kawarp = new module.default(background, {
        warpIntensity: 1.85,
        blurPasses: 10,
        animationSpeed: 0.82,
        saturation: 2.15,
        dithering: 0.012,
        transitionDuration: 950,
        tintIntensity: 0.28,
        scale: 1.08,
      });
      kawarp.start();
      return kawarp;
    })
    .catch(function (error) {
      console.warn("Cloud Cast Receiver: Kawarp no pudo iniciarse.", error);
      return null;
    });
  var loadedBackground = "";
  var coverBuffers = {
    current: "",
    next: "",
  };
  var nativeLyricsReady = false;
  var lastLyricsPaused = null;
  var layouts = ["cover", "linear", "split"];

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    var safe = Math.max(0, Math.floor(seconds));
    return Math.floor(safe / 60) + ":" + String(safe % 60).padStart(2, "0");
  }

  function estimatedProgress() {
    if (playerManager) {
      var castTime = Number(
        typeof playerManager.getCurrentTimeSec === "function"
          ? playerManager.getCurrentTimeSec()
          : 0,
      );
      if (Number.isFinite(castTime) && castTime >= 0) return castTime;
    }
    if (audio && Number.isFinite(audio.currentTime) && audio.readyState > 0) {
      return audio.currentTime;
    }
    if (!state.isPlaying) return state.progress;
    return Math.min(
      state.duration || Infinity,
      state.progress + (performance.now() - state.updatedAt) / 1000,
    );
  }

  function findActiveLine(currentTime) {
    var index = -1;
    for (var i = 0; i < state.lyrics.length; i += 1) {
      var line = state.lyrics[i];
      if (currentTime >= line.begin && currentTime < line.end) return i;
      if (currentTime >= line.begin) index = i;
    }
    return index;
  }

  function renderLine(line, index, activeIndex, currentTime) {
    var paragraph = document.createElement("p");
    paragraph.className = "lyric-line";
    if (index === activeIndex) paragraph.classList.add("is-active");
    if (Math.abs(index - activeIndex) === 1) paragraph.classList.add("is-near");

    if (
      state.lyricMotion !== "static" &&
      index === activeIndex &&
      state.lyricFormat !== "line" &&
      Array.isArray(line.words) &&
      line.words.length
    ) {
      line.words.forEach(function (word, wordIndex) {
        var span = document.createElement("span");
        span.className = "lyric-word";
        span.dataset.begin = String(word.begin);
        span.dataset.end = String(word.end);
        if (currentTime >= word.begin) span.classList.add("is-active");
        if (currentTime >= word.begin && currentTime < word.end) {
          span.classList.add("is-current");
        }
        span.textContent = word.text;
        paragraph.appendChild(span);
        if (wordIndex < line.words.length - 1) {
          paragraph.appendChild(document.createTextNode(" "));
        }
      });
    } else {
      paragraph.textContent = line.text;
    }

    return paragraph;
  }

  function renderLyrics(currentTime) {
    if (nativeLyricsReady) return;
    if (!state.lyrics.length || state.layout === "cover") {
      lyrics.replaceChildren();
      return;
    }

    var activeIndex = findActiveLine(currentTime);
    if (activeIndex === lastActiveLine && lyrics.childElementCount) {
      if (state.lyricMotion !== "static" && state.lyricFormat !== "line") {
        var activeLine = state.lyrics[activeIndex];
        var words = lyrics.querySelectorAll(
          ".lyric-line.is-active .lyric-word",
        );
        words.forEach(function (wordElement, index) {
          var word = activeLine.words[index];
          if (!word) return;
          var wordDuration = Math.max(0.001, word.end - word.begin);
          var wordProgress = Math.max(
            0,
            Math.min(1, (currentTime - word.begin) / wordDuration),
          );
          wordElement.classList.toggle("is-active", currentTime >= word.begin);
          wordElement.classList.toggle(
            "is-current",
            currentTime >= word.begin && currentTime < word.end,
          );
          wordElement.style.setProperty(
            "--word-progress",
            String(wordProgress),
          );
        });
      }
      return;
    }

    lastActiveLine = activeIndex;
    var from = Math.max(0, activeIndex - 2);
    var to = Math.min(state.lyrics.length, activeIndex + 3);
    var fragment = document.createDocumentFragment();
    for (var index = from; index < to; index += 1) {
      fragment.appendChild(
        renderLine(state.lyrics[index], index, activeIndex, currentTime),
      );
    }
    lyrics.replaceChildren(fragment);
  }

  function syncNativeLyrics() {
    var bridge = window.CloudLyricsDisplay;
    nativeLyricsReady = Boolean(bridge);
    if (!bridge) return;

    if (!state.lyrics.length) {
      bridge.clear();
      return;
    }

    bridge.render(lyrics, {
      lines: state.lyrics,
      songId: state.song ? state.song.id : undefined,
      revision: state.lyricsRevision,
      isPaused: !state.isPlaying,
      interfaceTheme: state.interfaceTheme,
      lyricMotion: state.lyricMotion,
      lyricFormat: state.lyricFormat,
      credits: state.credits || undefined,
    });
    lastLyricsPaused = !state.isPlaying;
  }

  function effectiveLayout() {
    return state.lyrics.length ? state.requestedLayout : "cover";
  }

  function applyPresentation(animate) {
    var nextLayout = effectiveLayout();
    var changed = nextLayout !== state.layout;
    state.layout = nextLayout;

    if (animate && changed) {
      stage.classList.add("is-layout-changing");
      window.clearTimeout(layoutTransitionTimer);
      layoutTransitionTimer = window.setTimeout(function () {
        renderState();
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            stage.classList.remove("is-layout-changing");
          });
        });
      }, 120);
      return;
    }

    renderState();
  }

  function renderState() {
    stage.classList.add("is-transitioning");
    stage.className =
      "cast-stage layout-" +
      state.layout +
      " theme-" +
      state.interfaceTheme +
      " lyrics-motion-" +
      state.lyricMotion +
      " lyrics-format-" +
      state.lyricFormat +
      " is-transitioning";

    if (state.song) {
      title.textContent = state.song.title || "Cloud";
      artist.textContent = state.song.artist || "Artista desconocido";
      applyCurrentCover(state.song.cover || "");
      syncAudio();
    }

    if (state.nextSong) {
      nextCover.src = state.nextSong.cover || "";
      nextTitle.textContent = state.nextSong.title || "";
      nextArtist.textContent = state.nextSong.artist || "";
    }

    lastActiveLine = -1;
    syncNativeLyrics();
    window.setTimeout(function () {
      stage.classList.remove("is-transitioning");
    }, 40);
  }

  function applyCurrentCover(source) {
    cover.src = source || "";
    cover.classList.toggle("is-empty", !source);
    if (!source || source === loadedBackground) return;
    loadedBackground = source;
    kawarpReady.then(function (renderer) {
      if (!renderer) return;
      renderer
        .loadImage(loadedBackground)
        .then(function () {
          renderer.resize();
          renderer.renderFrame();
          renderer.setOptions({
            animationSpeed: state.isPlaying ? 0.82 : 0,
          });
        })
        .catch(function () {});
    });
  }

  function syncAudio() {
    if (!audio || !state.song || !state.song.audioUrl) return;
    if (playerManager) return;
    var sourceChanged = audio.dataset.songId !== String(state.song.id || "");
    if (sourceChanged) {
      audio.pause();
      audio.dataset.songId = String(state.song.id || "");
      audio.addEventListener(
        "loadedmetadata",
        function () {
          audio.currentTime = Math.min(
            Number(state.progress) || 0,
            Number(audio.duration) || Number(state.duration) || 0,
          );
          if (state.isPlaying) audio.play().catch(function () {});
        },
        { once: true },
      );
      audio.src = state.song.audioUrl;
      audio.load();
      return;
    }

    if (Math.abs(audio.currentTime - state.progress) > 1.25) {
      audio.currentTime = state.progress;
    }
    if (state.isPlaying && audio.paused) audio.play().catch(function () {});
    if (!state.isPlaying && !audio.paused) audio.pause();
  }

  function loadCastAudio(payload) {
    if (!state.song || !state.song.audioUrl) return;

    if (playerManager) {
      var media = {
        contentId: state.song.audioUrl,
        contentUrl: state.song.audioUrl,
        contentType: payload.audioMime || "audio/mpeg",
        streamType: "BUFFERED",
        metadata: {
          metadataType: 3,
          title: state.song.title || "Cloud",
          artist: state.song.artist || "",
          images: state.song.cover ? [{ url: state.song.cover }] : [],
        },
      };
      if (state.song.id) {
        media.entity = "cloud:song:" + state.song.id;
      }

      playerManager
        .load({
          media: media,
          autoplay: Boolean(state.isPlaying),
          currentTime: Math.max(0, Number(state.progress) || 0),
        })
        .catch(function (error) {
          console.error(
            "Cloud Cast Receiver: no se pudo cargar el audio.",
            error,
          );
        });
      return;
    }

    syncAudio();
  }

  document.addEventListener("visibilitychange", function () {
    if (!kawarp) return;
    if (document.hidden) {
      kawarp.stop();
    } else {
      kawarp.start();
    }
  });
  window.addEventListener("resize", function () {
    if (!kawarp) return;
    kawarp.resize();
    kawarp.renderFrame();
  });

  function renderFrame() {
    var currentTime = estimatedProgress();
    var total =
      state.duration || (state.song ? Number(state.song.duration) || 0 : 0);
    var percent = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0;
    progress.style.width = percent + "%";
    elapsed.textContent = formatTime(currentTime);
    duration.textContent = formatTime(total);
    renderLyrics(currentTime);

    var showNext =
      Boolean(state.nextSong) && total > 0 && total - currentTime <= 20;
    nextSong.hidden = !showNext;

    requestAnimationFrame(renderFrame);
  }

  function receiveMessage(event) {
    var payload = event.data;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        return;
      }
    }

    if (payload.type === "cloud-state") {
      var previousSongId = state.song && state.song.id;
      var incomingSongId = payload.song && payload.song.id;
      var songChanged =
        incomingSongId &&
        String(incomingSongId) !== String(previousSongId || "");
      state = Object.assign({}, state, payload, {
        requestedLayout: payload.layout || state.requestedLayout,
        updatedAt: performance.now(),
      });
      if (songChanged) {
        state.lyrics = [];
        state.credits = null;
        state.lyricsRevision += 1;
      }
      applyPresentation(true);
      return;
    }

    if (payload.type === "cloud-presentation") {
      state.requestedLayout = payload.layout || state.requestedLayout;
      state.lyricMotion = payload.lyricMotion || state.lyricMotion;
      state.lyricFormat = payload.lyricFormat || state.lyricFormat;
      state.interfaceTheme = payload.interfaceTheme || state.interfaceTheme;
      applyPresentation(true);
      syncNativeLyrics();
      return;
    }

    if (payload.type === "cloud-next") {
      state.nextSong = payload.nextSong || null;
      if (!state.nextSong) {
        nextSong.hidden = true;
      } else {
        nextTitle.textContent = state.nextSong.title || "";
        nextArtist.textContent = state.nextSong.artist || "";
      }
      return;
    }

    if (payload.type === "cloud-progress") {
      state.progress = Number(payload.progress) || 0;
      state.duration = Number(payload.duration) || state.duration;
      if (!playerManager) {
        state.isPlaying = Boolean(payload.isPlaying);
      }
      state.updatedAt = performance.now();
      if (kawarp) {
        kawarp.setOptions({ animationSpeed: state.isPlaying ? 0.82 : 0 });
      }
      syncAudio();
      if (lastLyricsPaused !== !state.isPlaying) syncNativeLyrics();
      return;
    }

    if (payload.type === "cloud-audio") {
      if (!state.song || String(state.song.id) !== String(payload.songId)) {
        return;
      }
      state.song.audioUrl = String(payload.audioUrl || "");
      state.progress = Number(payload.progress) || state.progress;
      state.isPlaying = Boolean(payload.isPlaying);
      state.updatedAt = performance.now();
      loadCastAudio(payload);
      return;
    }

    if (payload.type === "cloud-cover") {
      var target = payload.target === "next" ? "next" : "current";
      if (payload.reset) coverBuffers[target] = "";
      coverBuffers[target] += String(payload.chunk || "");
      if (!payload.final) return;

      if (
        target === "current" &&
        state.song &&
        String(state.song.id) === String(payload.songId)
      ) {
        state.song.cover = coverBuffers.current;
        applyCurrentCover(coverBuffers.current);
      }
      if (
        target === "next" &&
        state.nextSong &&
        String(state.nextSong.id) === String(payload.songId)
      ) {
        state.nextSong.cover = coverBuffers.next;
        nextCover.src = coverBuffers.next;
      }
      return;
    }

    if (payload.type === "cloud-lyrics") {
      if (!state.song || String(state.song.id) !== String(payload.songId)) {
        return;
      }
      if (payload.reset) state.lyrics = [];
      if (payload.reset) state.credits = payload.credits || null;
      if (Array.isArray(payload.lines)) {
        state.lyrics = state.lyrics.concat(payload.lines);
      }
      lastActiveLine = -1;
      if (payload.final) {
        state.lyricsRevision += 1;
        applyPresentation(true);
        syncNativeLyrics();
      }
      renderLyrics(estimatedProgress());
    }
  }

  window.__cloudCastPlaybackTime = estimatedProgress;
  window.addEventListener("cloud-lyrics-display-ready", syncNativeLyrics);

  function cycleLayout(direction) {
    var currentIndex = layouts.indexOf(state.requestedLayout);
    if (currentIndex < 0) currentIndex = 0;
    var nextIndex =
      (currentIndex + direction + layouts.length) % layouts.length;
    state.requestedLayout = layouts[nextIndex];
    applyPresentation(true);
  }

  function seekRemote(seconds) {
    var target = Math.max(
      0,
      Math.min(state.duration || Infinity, estimatedProgress() + seconds),
    );
    if (playerManager && typeof playerManager.seek === "function") {
      playerManager.seek(target);
    } else if (audio) {
      audio.currentTime = target;
    }
    state.progress = target;
    state.updatedAt = performance.now();
  }

  function toggleRemotePlayback() {
    if (playerManager) {
      var playerState =
        typeof playerManager.getPlayerState === "function"
          ? String(playerManager.getPlayerState() || "")
          : "";
      var isActuallyPlaying =
        playerState === "PLAYING" || playerState === "BUFFERING";
      if (isActuallyPlaying && typeof playerManager.pause === "function") {
        playerManager.pause();
      } else if (typeof playerManager.play === "function") {
        playerManager.play();
      }
    } else if (audio) {
      if (audio.paused) audio.play().catch(function () {});
      else audio.pause();
      setReceiverPlaying(!audio.paused);
    }
  }

  function setReceiverPlaying(isPlaying) {
    var nextPlaying = Boolean(isPlaying);
    if (state.isPlaying === nextPlaying && lastLyricsPaused === !nextPlaying) {
      return;
    }
    state.isPlaying = nextPlaying;
    state.updatedAt = performance.now();
    if (kawarp) {
      kawarp.setOptions({ animationSpeed: nextPlaying ? 0.82 : 0 });
    }
    syncNativeLyrics();
  }

  window.addEventListener("keydown", function (event) {
    if (event.repeat) return;
    var key = event.key || "";
    var code = Number(event.keyCode) || 0;
    if (key === "Enter" || key === "MediaPlayPause" || code === 13) {
      event.preventDefault();
      toggleRemotePlayback();
      return;
    }
    if (key === "ArrowLeft" || code === 37) {
      event.preventDefault();
      seekRemote(-10);
      return;
    }
    if (key === "ArrowRight" || code === 39) {
      event.preventDefault();
      seekRemote(10);
      return;
    }
    if (key === "ArrowUp" || code === 38) {
      event.preventDefault();
      cycleLayout(1);
      return;
    }
    if (key === "ArrowDown" || code === 40) {
      event.preventDefault();
      cycleLayout(-1);
    }
  });

  function enablePreview() {
    var previewParams = new URLSearchParams(window.location.search);
    var requestedLayout = previewParams.get("layout");
    var requestedLyrics = previewParams.get("lyrics");
    var previewWithoutLyrics = requestedLyrics === "none";
    var previewLyricMode = ["static", "line", "letters", "line-words"].includes(
      requestedLyrics,
    )
      ? requestedLyrics
      : "line-words";
    state = Object.assign({}, state, {
      layout: ["cover", "linear", "split"].includes(requestedLayout)
        ? requestedLayout
        : state.layout,
      requestedLayout: ["cover", "linear", "split"].includes(requestedLayout)
        ? requestedLayout
        : state.requestedLayout,
      lyricMotion: previewLyricMode === "static" ? "static" : "animated",
      lyricFormat: previewLyricMode === "static" ? "line" : previewLyricMode,
      song: {
        title: "Lifeline",
        artist: "KawaiiKittyKore",
        cover: "/album2.png",
        duration: 199,
      },
      nextSong: {
        title: "Popbobrobpotson",
        artist: "KawaiiKittyKore",
        cover: "/album1.png",
      },
      progress: 182,
      duration: 199,
      isPlaying: true,
      updatedAt: performance.now(),
      lyrics: previewWithoutLyrics
        ? []
        : [
            {
              begin: 178,
              end: 184,
              text: "Looking for another lifeline",
              words: [
                { begin: 178, end: 179, text: "Looking" },
                { begin: 179, end: 180, text: "for" },
                { begin: 180, end: 181, text: "another" },
                { begin: 181, end: 184, text: "lifeline" },
              ],
            },
            {
              begin: 184,
              end: 190,
              text: "Somewhere beyond the skyline",
              words: [],
            },
          ],
    });
    applyPresentation(false);
  }

  var previewMode = new URLSearchParams(window.location.search).has("preview");

  if (previewMode) {
    enablePreview();
  } else if (
    window.cast &&
    window.cast.framework &&
    window.cast.framework.CastReceiverContext
  ) {
    receiverContext = cast.framework.CastReceiverContext.getInstance();
    playerManager = receiverContext.getPlayerManager();
    var receiverEvents = cast.framework.events.EventType;
    [receiverEvents.PLAY, receiverEvents.PLAYING]
      .filter(Boolean)
      .forEach(function (eventType) {
        playerManager.addEventListener(eventType, function () {
          setReceiverPlaying(true);
        });
      });
    [
      receiverEvents.PAUSE,
      receiverEvents.ENDED,
      receiverEvents.MEDIA_FINISHED,
    ]
      .filter(Boolean)
      .forEach(function (eventType) {
        playerManager.addEventListener(eventType, function () {
          setReceiverPlaying(false);
        });
      });
    receiverContext.addCustomMessageListener(namespace, receiveMessage);
    receiverContext.start({
      disableIdleTimeout: true,
      statusText: "Cloud",
    });
  } else {
    enablePreview();
    console.info(
      "Cloud Cast Receiver: vista previa local activa; el SDK se iniciara en un Chromecast.",
    );
  }

  requestAnimationFrame(renderFrame);
})();
