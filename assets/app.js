(function () {
  var titleElement = document.getElementById("video-title");
  var positionElement = document.getElementById("video-position");
  var errorBanner = document.getElementById("error-banner");
  var skipButton = document.getElementById("skip-button");
  var serverNameElement = document.getElementById("server-name");
  var serverSubtitleElement = document.getElementById("server-subtitle");
  var adminsListElement = document.getElementById("admins-list");
  var adminsCounterElement = document.getElementById("admins-counter");

  var rawVideos = Array.isArray(window.LOADSCREEN_VIDEOS)
    ? window.LOADSCREEN_VIDEOS
    : [];

  var settings = window.LOADSCREEN_SETTINGS || {};
  var serverConfig = window.LOADSCREEN_SERVER || {};

  var parsedVideos = rawVideos
    .map(function (url, index) {
      var parsed = parseYouTubeUrl(url);

      if (!parsed) {
        return null;
      }

      return {
        id: parsed.id,
        label: "Video " + (index + 1),
        sourceUrl: url
      };
    })
    .filter(Boolean);

  var currentIndex = -1;
  var player = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderServerInfo() {
    if (serverNameElement) {
      serverNameElement.textContent =
        serverConfig.name || "Sua conexao esta carregando";
    }

    if (serverSubtitleElement) {
      serverSubtitleElement.textContent =
        serverConfig.subtitle || "Carregando informacoes do servidor.";
    }
  }

  function normalizeAdmins(admins) {
    if (!Array.isArray(admins)) {
      return [];
    }

    return admins.map(function (admin, index) {
      return {
        name:
          admin && admin.name
            ? String(admin.name)
            : "Admin " + (index + 1),

        role:
          admin && admin.role
            ? String(admin.role)
            : "Equipe",

        online: Boolean(admin && admin.online),

        avatar:
          admin && admin.avatar
            ? String(admin.avatar)
            : ""
      };
    });
  }

  function renderAdmins(admins) {
    if (!adminsListElement || !adminsCounterElement) {
      return;
    }

    var normalized = normalizeAdmins(admins);

    var onlineCount = normalized.filter(function (admin) {
      return admin.online;
    }).length;

    adminsCounterElement.textContent = onlineCount + " online";

    if (!normalized.length) {
      adminsListElement.innerHTML =
        '<p class="admins-empty">Nenhum admin configurado ainda.</p>';
      return;
    }

    adminsListElement.innerHTML = normalized
      .map(function (admin) {
        var avatar = admin.avatar
          ? '<img class="admin-avatar" src="' +
            escapeHtml(admin.avatar) +
            '" alt="' +
            escapeHtml(admin.name) +
            '">'
          : '<div class="admin-avatar"></div>';

        var statusLabel = admin.online ? "Online" : "Offline";

        var statusClass = admin.online
          ? "admin-status-online"
          : "admin-status-offline";

        return (
          '<article class="admin-item">' +
          avatar +
          "<div>" +
          '<p class="admin-name">' +
          escapeHtml(admin.name) +
          "</p>" +
          '<p class="admin-role">' +
          escapeHtml(admin.role) +
          "</p>" +
          "</div>" +
          '<span class="admin-status ' +
          statusClass +
          '">' +
          statusLabel +
          "</span>" +
          "</article>"
        );
      })
      .join("");
  }

  function applyAdminsFromConfig() {
    renderAdmins(serverConfig.admins || []);
  }

  function fetchAdmins() {
    if (!serverConfig.adminsSource) {
      applyAdminsFromConfig();
      return;
    }

    fetch(serverConfig.adminsSource, {
      cache: "no-store"
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Falha ao carregar admins");
        }

        return response.json();
      })
      .then(function (payload) {
        if (Array.isArray(payload)) {
          renderAdmins(payload);
          return;
        }

        if (payload && Array.isArray(payload.admins)) {
          renderAdmins(payload.admins);
          return;
        }

        applyAdminsFromConfig();
      })
      .catch(function () {
        applyAdminsFromConfig();
      });
  }

  function parseYouTubeUrl(url) {
    if (typeof url !== "string" || !url.trim()) {
      return null;
    }

    try {
      var parsedUrl = new URL(url.trim());
      var host = parsedUrl.hostname
        .replace(/^www\./i, "")
        .toLowerCase();

      if (host === "youtu.be") {
        var shortId = parsedUrl.pathname
          .replace(/^\/+/, "")
          .split("/")[0];

        return shortId ? { id: shortId } : null;
      }

      if (
        host === "youtube.com" ||
        host === "m.youtube.com"
      ) {
        if (parsedUrl.pathname === "/watch") {
          var videoId = parsedUrl.searchParams.get("v");

          return videoId ? { id: videoId } : null;
        }

        if (
          parsedUrl.pathname.indexOf("/shorts/") === 0 ||
          parsedUrl.pathname.indexOf("/embed/") === 0
        ) {
          var parts = parsedUrl.pathname
            .split("/")
            .filter(Boolean);

          return parts.length >= 2
            ? { id: parts[1] }
            : null;
        }
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  function showError(message) {
    if (!errorBanner) {
      return;
    }

    errorBanner.textContent = message;
    errorBanner.classList.remove("hidden");
  }

  function hideError() {
    if (!errorBanner) {
      return;
    }

    errorBanner.classList.add("hidden");
  }

  function updateStatus() {
    if (
      currentIndex < 0 ||
      !parsedVideos[currentIndex]
    ) {
      if (titleElement) {
        titleElement.textContent =
          "Nenhum video selecionado";
      }

      if (positionElement) {
        positionElement.textContent =
          "Adicione URLs validas em assets/videos.js";
      }

      return;
    }

    if (titleElement) {
      titleElement.textContent =
        parsedVideos[currentIndex].label;
    }

    if (positionElement) {
      positionElement.textContent =
        "Tocando " +
        (currentIndex + 1) +
        " de " +
        parsedVideos.length;
    }
  }

  function getNextIndex() {
    if (!parsedVideos.length) {
      return -1;
    }

    if (parsedVideos.length === 1) {
      return 0;
    }

    var nextIndex = currentIndex;

    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(
        Math.random() * parsedVideos.length
      );
    }

    return nextIndex;
  }

  function setVolume50(target) {
    try {
      target.unMute();
      target.setVolume(50);
    } catch (error) {
      console.log("Erro ao configurar volume:", error);
    }
  }

  function loadCurrentVideo() {
    if (!player || !parsedVideos[currentIndex]) {
      return;
    }

    try {
      player.loadVideoById({
        videoId: parsedVideos[currentIndex].id,
        startSeconds: 0
      });

      setVolume50(player);

      player.playVideo();

      setTimeout(function () {
        setVolume50(player);
        player.playVideo();
      }, 500);

      setTimeout(function () {
        setVolume50(player);
        player.playVideo();
      }, 1500);

    } catch (error) {
      console.log("Erro ao carregar video:", error);
    }
  }

  function playRandomVideo() {
    var nextIndex;

    if (
      currentIndex === -1 &&
      settings.shuffleOnStart === false
    ) {
      nextIndex = 0;
    } else {
      nextIndex = getNextIndex();
    }

    if (nextIndex === -1) {
      return;
    }

    currentIndex = nextIndex;

    updateStatus();

    loadCurrentVideo();
  }

  window.onYouTubeIframeAPIReady = function () {
    if (!parsedVideos.length) {
      updateStatus();

      showError(
        "Nenhuma URL valida foi encontrada em assets/videos.js."
      );

      if (skipButton) {
        skipButton.disabled = true;
      }

      return;
    }

    currentIndex =
      settings.shuffleOnStart === false
        ? 0
        : Math.floor(
            Math.random() * parsedVideos.length
          );

    updateStatus();

    player = new YT.Player("player", {
      width: "100%",
      height: "100%",

      videoId: parsedVideos[currentIndex].id,

      playerVars: {
        autoplay: 1,
        mute: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        rel: 0,
        playsinline: 1,
        enablejsapi: 1
      },

      events: {
        onReady: function (event) {
          try {
            event.target.unMute();
            event.target.setVolume(50);
            event.target.playVideo();

            setTimeout(function () {
              event.target.unMute();
              event.target.setVolume(50);
              event.target.playVideo();
            }, 500);

            setTimeout(function () {
              event.target.unMute();
              event.target.setVolume(50);
              event.target.playVideo();
            }, 1500);

          } catch (error) {
            console.log("Erro no autoplay:", error);
          }
        },

        onStateChange: function (event) {
          if (
            event.data ===
            YT.PlayerState.PLAYING
          ) {
            hideError();

            try {
              event.target.unMute();
              event.target.setVolume(50);
            } catch (error) {
              console.log(
                "Erro configurando audio:",
                error
              );
            }
          }

          if (
            event.data ===
            YT.PlayerState.ENDED
          ) {
            if (
              settings.allowRepeat === false &&
              parsedVideos.length === 1
            ) {
              return;
            }

            playRandomVideo();
          }
        },

        onAutoplayBlocked: function () {
          console.log(
            "O navegador bloqueou autoplay com som."
          );

          /*
            Aqui NAO vamos mutar.
            Apenas tentamos novamente com audio.
          */

          try {
            player.unMute();
            player.setVolume(50);
            player.playVideo();
          } catch (error) {
            console.log(
              "Nao foi possivel iniciar:",
              error
            );
          }
        },

        onError: function (event) {
          console.log(
            "Erro YouTube:",
            event.data
          );

          setTimeout(function () {
            playRandomVideo();
          }, 1000);
        }
      }
    });
  };

  if (skipButton) {
    skipButton.addEventListener(
      "click",
      function () {
        playRandomVideo();
      }
    );
  }

  renderServerInfo();
  fetchAdmins();

  if (serverConfig.adminsSource) {
    setInterval(
      fetchAdmins,
      Number(serverConfig.adminsRefreshMs) || 30000
    );
  }

  updateStatus();

})();
