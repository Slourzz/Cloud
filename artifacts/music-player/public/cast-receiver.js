(function () {
  "use strict";

  var namespace = "urn:x-cast:com.cloudapp.player";
  var state = {
    layout: "cover",
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
  var lastActiveLine = -1;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    var safe = Math.max(0, Math.floor(seconds));
    return Math.floor(safe / 60) + ":" + String(safe % 60).padStart(2, "0");
  }

  function estimatedProgress() {
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
      index === activeIndex &&
      state.lyricFormat !== "line" &&
      Array.isArray(line.words) &&
      line.words.length
    ) {
      line.words.forEach(function (word, wordIndex) {
        var span = document.createElement("span");
        span.className = "lyric-word";
        if (currentTime >= word.begin) span.classList.add("is-active");
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
      if (state.lyricFormat !== "line") {
        var activeLine = state.lyrics[activeIndex];
        var words = lyrics.querySelectorAll(
          ".lyric-line.is-active .lyric-word",
        );
        words.forEach(function (wordElement, index) {
          wordElement.classList.toggle(
            "is-active",
            currentTime >= (activeLine.words[index]?.begin || Infinity),
          );
        });
      }
      return;
    }

    lastActiveLine = activeIndex;
    var from = Math.max(0, activeIndex - 1);
    var to = Math.min(state.lyrics.length, activeIndex + 4);
    var fragment = document.createDocumentFragment();
    for (var index = from; index < to; index += 1) {
      fragment.appendChild(
        renderLine(state.lyrics[index], index, activeIndex, currentTime),
      );
    }
    lyrics.replaceChildren(fragment);
  }

  function renderState() {
    stage.className =
      "cast-stage layout-" + state.layout + " theme-" + state.interfaceTheme;

    if (state.song) {
      title.textContent = state.song.title || "Cloud";
      artist.textContent = state.song.artist || "Artista desconocido";
      cover.src = state.song.cover || "";
      background.style.backgroundImage = state.song.cover
        ? 'url("' + state.song.cover.replace(/"/g, "%22") + '")'
        : "";
    }

    if (state.nextSong) {
      nextCover.src = state.nextSong.cover || "";
      nextTitle.textContent = state.nextSong.title || "";
      nextArtist.textContent = state.nextSong.artist || "";
    }

    lastActiveLine = -1;
  }

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
      state = Object.assign({}, state, payload);
      renderState();
      return;
    }

    if (payload.type === "cloud-progress") {
      state.progress = Number(payload.progress) || 0;
      state.duration = Number(payload.duration) || state.duration;
      state.isPlaying = Boolean(payload.isPlaying);
      state.updatedAt = performance.now();
    }
  }

  function enablePreview() {
    state = Object.assign({}, state, {
      song: {
        title: "Lifeline",
        artist: "KawaiiKittyKore",
        cover: "/cloud-cast-mark.png",
        duration: 199,
      },
      nextSong: {
        title: "Popbobrobpotson",
        artist: "KawaiiKittyKore",
        cover: "/cloud-cast-mark.png",
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
