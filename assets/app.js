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
  var retryTimer = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderServerInfo() {
    serverNameElement.textContent =
      serverConfig.name || "Sua conexao esta carregando";

    serverSubtitleElement.textContent =
      serverConfig.subtitle || "Carregando informacoes do servidor.";
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

        return shortId
          ? { id: shortId }
          : null;
      }

      if (
        host === "youtube.com" ||
        host === "m.youtube.com"
      ) {
        if (parsedUrl.pathname === "/watch") {
          var videoId = parsedUrl.searchParams.get("v");

          return videoId
            ? { id: videoId }
            : null;
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
    errorBanner.textContent = message;
    errorBanner.classList.remove("hidden");
  }

  function hideError() {
    errorBanner.classList.add("hidden");
  }

  function updateStatus() {
    if (
      currentIndex < 0 ||
      !parsedVideos[currentIndex]
    ) {
      titleElement.textContent =
        "Nenhum video selecionado";

      positionElement.textContent =
        "Adicione URLs validas em assets/videos.js";

      return;
    }

    titleElement.textContent =
      parsedVideos[currentIndex].label;

    positionElement.textContent =
      "Tocando " +
      (currentIndex + 1) +
      " de " +
      parsedVideos.length;
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

  function startPlayback() {
    if (!player) {
      return;
    }

    try {
      player.mute();
      player.setVolume(0);
      player.playVideo();

      setTimeout(function () {
        try {
          var state = player.getPlayerState();

          if (
            state !== YT.PlayerState.PLAYING &&
            state !== YT.PlayerState.BUFFERING
          ) {
            player.mute();
            player.setVolume(0);
            player.playVideo();
          }
        } catch (error) {
          console.log("Erro na segunda tentativa:", error);
        }
      }, 1200);

      setTimeout(function () {
        try {
          var state = player.getPlayerState();

          if (
            state !== YT.PlayerState.PLAYING &&
            state !== YT.PlayerState.BUFFERING
          ) {
            player.mute();
            player.playVideo();
          }
        } catch (error) {
          console.log("Erro na terceira tentativa:", error);
        }
      }, 2500);

      hideError();
    } catch (error) {
      console.log(
        "Nao foi possivel iniciar o video:",
        error
      );
    }
  }

  function loadCurrentVideo() {
    if (
      !player ||
      !parsedVideos[currentIndex]
    ) {
      return;
    }

    try {
      player.mute();
      player.setVolume(0);

      player.loadVideoById({
        videoId: parsedVideos[currentIndex].id,
        startSeconds: 0
      });

      setTimeout(function () {
        startPlayback();
      }, 500);
    } catch (error) {
      console.log(
        "Erro ao carregar video:",
        error
      );
    }
  }

  function playRandomVideo() {
    var nextIndex = currentIndex;

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

      skipButton.disabled = true;

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
        mute: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        rel: 0,
        playsinline: 1,
        enablejsapi: 1
      },

      events: {
        onReady: function (event) {
          console.log("YouTube player pronto.");

          try {
            event.target.mute();
            event.target.setVolume(0);

            event.target.loadVideoById({
              videoId:
                parsedVideos[currentIndex].id,
              startSeconds: 0
            });

            setTimeout(function () {
              try {
                event.target.mute();
                event.target.setVolume(0);
                event.target.playVideo();
              } catch (error) {
                console.log(
                  "Erro no autoplay:",
                  error
                );
              }
            }, 300);

            setTimeout(function () {
              try {
                var state =
                  event.target.getPlayerState();

                if (
                  state !==
                    YT.PlayerState.PLAYING &&
                  state !==
                    YT.PlayerState.BUFFERING
                ) {
                  event.target.mute();
                  event.target.playVideo();
                }
              } catch (error) {
                console.log(
                  "Erro na segunda tentativa:",
                  error
                );
              }
            }, 1500);

            setTimeout(function () {
              try {
                var state =
                  event.target.getPlayerState();

                if (
                  state !==
                    YT.PlayerState.PLAYING &&
                  state !==
                    YT.PlayerState.BUFFERING
                ) {
                  event.target.mute();
                  event.target.playVideo();
                }
              } catch (error) {
                console.log(
                  "Erro na terceira tentativa:",
                  error
                );
              }
            }, 3000);

          } catch (error) {
            console.log(
              "Erro preparando autoplay:",
              error
            );
          }
        },

        onStateChange: function (event) {
          if (
            event.data ===
            YT.PlayerState.PLAYING
          ) {
            hideError();
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
            "Autoplay bloqueado pelo navegador/CEF."
          );

          try {
            player.mute();
            player.setVolume(0);
            player.playVideo();
          } catch (error) {
            console.log(
              "Falha ao tentar liberar autoplay:",
              error
            );
          }
        },

        onError: function (event) {
          console.log(
            "Erro YouTube:",
            event.data
          );

          var code = event.data;

          if (
            code === 2 ||
            code === 5 ||
            code === 100 ||
            code === 101 ||
            code === 150 ||
            code === 153
          ) {
            clearTimeout(retryTimer);

            retryTimer = setTimeout(
              function () {
                playRandomVideo();
              },
              1000
            );

            return;
          }

          showError(
            "Erro ao carregar video. Codigo: " +
            code
          );
        }
      }
    });
  };

  skipButton.addEventListener(
    "click",
    function () {
      playRandomVideo();
    }
  );

  renderServerInfo();

  fetchAdmins();

  if (serverConfig.adminsSource) {
    setInterval(
      fetchAdmins,
      Number(
        serverConfig.adminsRefreshMs
      ) || 30000
    );
  }

  updateStatus();
})();
