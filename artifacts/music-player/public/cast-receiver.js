(function () {
  "use strict";

  var namespace = "urn:x-cast:com.cloudapp.player";
  var state = {
    layout: "cover",
    lyricMotion: "animated",
    lyricFormat: "line-words",
    interfaceTheme: "crystalized",
    song: null,
    nextSong: null,
    lyrics: [],
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
  var lastActiveLine = -1;
  var layoutTransitionTimer = 0;
  var pendingStatePayload = null;
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

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    var safe = Math.max(0, Math.floor(seconds));
    return Math.floor(safe / 60) + ":" + String(safe % 60).padStart(2, "0");
  }

  function estimatedProgress() {
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
      renderer
        ?.loadImage(loadedBackground)
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
    if (!audio || !state.song?.audioUrl) return;
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

  document.addEventListener("visibilitychange", function () {
    if (!kawarp) return;
    if (document.hidden) {
      kawarp.stop();
    } else {
      kawarp.start();
    }
  });
  window.addEventListener("resize", function () {
    kawarp?.resize();
    kawarp?.renderFrame();
  });

  function renderFrame() {
    var currentTime = estimatedProgress();
    var total = state.duration || state.song?.duration || 0;
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
      if (payload.layout && payload.layout !== state.layout) {
        state = Object.assign({}, state, payload, {
          updatedAt: performance.now(),
        });
        pendingStatePayload = state;
        stage.classList.add("is-layout-changing");
        window.clearTimeout(layoutTransitionTimer);
        layoutTransitionTimer = window.setTimeout(function () {
          state = pendingStatePayload || state;
          pendingStatePayload = null;
          renderState();
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              stage.classList.remove("is-layout-changing");
            });
          });
        }, 180);
        return;
      }
      state = Object.assign({}, state, payload, {
        updatedAt: performance.now(),
      });
      renderState();
      return;
    }

    if (payload.type === "cloud-progress") {
      state.progress = Number(payload.progress) || 0;
      state.duration = Number(payload.duration) || state.duration;
      state.isPlaying = Boolean(payload.isPlaying);
      state.updatedAt = performance.now();
      kawarp?.setOptions({ animationSpeed: state.isPlaying ? 0.82 : 0 });
      syncAudio();
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
      if (Array.isArray(payload.lines)) {
        state.lyrics = state.lyrics.concat(payload.lines);
      }
      lastActiveLine = -1;
      renderLyrics(estimatedProgress());
    }
  }

  function enablePreview() {
    var previewParams = new URLSearchParams(window.location.search);
    var requestedLayout = previewParams.get("layout");
    var requestedLyrics = previewParams.get("lyrics");
    var previewLyricMode = ["static", "line", "letters", "line-words"].includes(
      requestedLyrics,
    )
      ? requestedLyrics
      : "line-words";
    state = Object.assign({}, state, {
      layout: ["cover", "linear", "split"].includes(requestedLayout)
        ? requestedLayout
        : state.layout,
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
      lyrics: [
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
    renderState();
  }

  var previewMode = new URLSearchParams(window.location.search).has("preview");

  if (previewMode) {
    enablePreview();
  } else if (window.cast?.framework?.CastReceiverContext) {
    var receiverContext = cast.framework.CastReceiverContext.getInstance();
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
