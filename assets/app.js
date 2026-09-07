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

  // =====================================================
  // FUNCOES GERAIS
  // =====================================================

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  // =====================================================
  // INFORMACOES DO SERVIDOR
  // =====================================================

  function renderServerInfo() {
    if (serverNameElement) {
      serverNameElement.textContent =
        serverConfig.name ||
        "Sua conexao esta carregando";
    }

    if (serverSubtitleElement) {
      serverSubtitleElement.textContent =
        serverConfig.subtitle ||
        "Carregando informacoes do servidor.";
    }
  }

  // =====================================================
  // ADMINS
  // =====================================================

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

    adminsCounterElement.textContent =
      onlineCount + " online";

    if (!normalized.length) {
      adminsListElement.innerHTML =
        '<p class="admins-empty">' +
        'Nenhum admin configurado ainda.' +
        "</p>";

      return;
    }

    adminsListElement.innerHTML = normalized
      .map(function (admin) {
        var avatar;

        if (admin.avatar) {
          avatar =
            '<img class="admin-avatar" src="' +
            escapeHtml(admin.avatar) +
            '" alt="' +
            escapeHtml(admin.name) +
            '">';
        } else {
          avatar =
            '<div class="admin-avatar"></div>';
        }

        var statusLabel =
          admin.online ? "Online" : "Offline";

        var statusClass =
          admin.online
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
          throw new Error(
            "Falha ao carregar admins"
          );
        }

        return response.json();
      })
      .then(function (payload) {
        if (Array.isArray(payload)) {
          renderAdmins(payload);
          return;
        }

        if (
          payload &&
          Array.isArray(payload.admins)
        ) {
          renderAdmins(payload.admins);
          return;
        }

        applyAdminsFromConfig();
      })
      .catch(function () {
        applyAdminsFromConfig();
      });
  }

  // =====================================================
  // YOUTUBE
  // =====================================================

  function parseYouTubeUrl(url) {
    if (
      typeof url !== "string" ||
      !url.trim()
    ) {
      return null;
    }

    try {
      var parsedUrl = new URL(url.trim());

      var host = parsedUrl.hostname
        .replace(/^www\./i, "")
        .toLowerCase();

      // youtu.be/VIDEO_ID
      if (host === "youtu.be") {
        var shortId = parsedUrl.pathname
          .replace(/^\/+/, "")
          .split("/")[0];

        return shortId
          ? { id: shortId }
          : null;
      }

      // youtube.com
      if (
        host === "youtube.com" ||
        host === "m.youtube.com"
      ) {

        // youtube.com/watch?v=VIDEO_ID
        if (parsedUrl.pathname === "/watch") {
          var videoId =
            parsedUrl.searchParams.get("v");

          return videoId
            ? { id: videoId }
            : null;
        }

        // youtube.com/shorts/VIDEO_ID
        // youtube.com/embed/VIDEO_ID
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
      console.log(
        "URL do YouTube invalida:",
        url
      );

      return null;
    }

    return null;
  }

  // =====================================================
  // STATUS DO VIDEO
  // =====================================================

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

  // =====================================================
  // ESCOLHER PROXIMO VIDEO
  // =====================================================

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

  // =====================================================
  // CONFIGURAR AUDIO
  // =====================================================

  function setPlayerVolume() {
    if (!player) {
      return;
    }

    try {
      // DESMUTA
      player.unMute();

      // VOLUME 50%
      player.setVolume(50);

    } catch (error) {
      console.log(
        "Nao foi possivel configurar o volume:",
        error
      );
    }
  }

  // =====================================================
  // INICIAR REPRODUCAO
  // =====================================================

  function startPlayback() {
    if (!player) {
      return;
    }

    try {
      // Volume 50%
      setPlayerVolume();

      // Autoplay
      player.playVideo();

      // Segunda tentativa
      setTimeout(function () {
        try {
          var state =
            player.getPlayerState();

          if (
            state !==
              YT.PlayerState.PLAYING &&
            state !==
              YT.PlayerState.BUFFERING
          ) {
            setPlayerVolume();
            player.playVideo();
          }
        } catch (error) {
          console.log(
            "Erro na segunda tentativa:",
            error
          );
        }
      }, 1000);

      // Terceira tentativa
      setTimeout(function () {
        try {
          var state =
            player.getPlayerState();

          if (
            state !==
              YT.PlayerState.PLAYING &&
            state !==
              YT.PlayerState.BUFFERING
          ) {
            setPlayerVolume();
            player.playVideo();
          }
        } catch (error) {
          console.log(
            "Erro na terceira tentativa:",
            error
          );
        }
      }, 2500);

    } catch (error) {
      console.log(
        "Nao foi possivel iniciar o video:",
        error
      );
    }
  }

  // =====================================================
  // CARREGAR VIDEO
  // =====================================================

  function loadCurrentVideo() {
    if (
      !player ||
      !parsedVideos[currentIndex]
    ) {
      return;
    }

    try {
      setPlayerVolume();

      player.loadVideoById({
        videoId:
          parsedVideos[currentIndex].id,

        startSeconds: 0
      });

      setTimeout(function () {
        setPlayerVolume();
        player.playVideo();
      }, 300);

      setTimeout(function () {
        setPlayerVolume();
        player.playVideo();
      }, 1200);

    } catch (error) {
      console.log(
        "Erro ao carregar video:",
        error
      );
    }
  }

  // =====================================================
  // VIDEO ALEATORIO
  // =====================================================

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

  // =====================================================
  // YOUTUBE IFRAME API
  // =====================================================

  window.onYouTubeIframeAPIReady =
    function () {

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

      // Escolhe video inicial
      if (
        settings.shuffleOnStart === false
      ) {
        currentIndex = 0;
      } else {
        currentIndex = Math.floor(
          Math.random() *
          parsedVideos.length
        );
      }

      updateStatus();

      // =================================================
      // CRIAR PLAYER
      // =================================================

      player = new YT.Player("player", {

        width: "100%",
        height: "100%",

        videoId:
          parsedVideos[currentIndex].id,

        playerVars: {

          // AUTOPLAY
          autoplay: 1,

          // NAO INICIA MUTADO
          mute: 0,

          // Esconde controles do YouTube
          controls: 0,

          // Desativa teclado
          disablekb: 1,

          // Sem fullscreen
          fs: 0,

          // Nao mostra relacionados
          rel: 0,

          // Importante para navegadores incorporados
          playsinline: 1,

          // Permite controle via JavaScript
          enablejsapi: 1
        },

        events: {

          // =============================================
          // PLAYER PRONTO
          // =============================================

          onReady: function (event) {
            console.log(
              "YouTube Player pronto."
            );

            try {

              // VOLUME 50%
              event.target.unMute();
              event.target.setVolume(50);

              // INICIA VIDEO
              event.target.playVideo();

              // Segunda tentativa
              setTimeout(function () {
                try {
                  event.target.unMute();
                  event.target.setVolume(50);
                  event.target.playVideo();
                } catch (error) {
                  console.log(error);
                }
              }, 700);

              // Terceira tentativa
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
                    event.target.unMute();
                    event.target.setVolume(50);
                    event.target.playVideo();
                  }
                } catch (error) {
                  console.log(error);
                }
              }, 2000);

            } catch (error) {
              console.log(
                "Erro no autoplay:",
                error
              );
            }
          },

          // =============================================
          // ESTADO DO PLAYER
          // =============================================

          onStateChange: function (event) {

            // VIDEO COMECOU
            if (
              event.data ===
              YT.PlayerState.PLAYING
            ) {
              hideError();

              try {
                // GARANTE SOM
                event.target.unMute();

                // GARANTE 50%
                event.target.setVolume(50);

              } catch (error) {
                console.log(
                  "Erro configurando audio:",
                  error
                );
              }
            }

            // VIDEO TERMINOU
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

          // =============================================
          // AUTOPLAY BLOQUEADO
          // =============================================

          onAutoplayBlocked: function () {
            console.log(
              "Autoplay com audio foi bloqueado."
            );

            /*
              Alguns navegadores e o CEF podem impedir
              autoplay com audio.

              Tentamos novamente.
            */

            try {
              player.unMute();
              player.setVolume(50);
              player.playVideo();
            } catch (error) {
              console.log(
                "Falha no autoplay:",
                error
              );
            }
          },

          // =============================================
          // ERRO NO VIDEO
          // =============================================

          onError: function (event) {
            console.log(
              "Erro YouTube:",
              event.data
            );

            clearTimeout(retryTimer);

            // Tenta outro video
            retryTimer = setTimeout(
              function () {
                playRandomVideo();
              },
              1000
            );
          }
        }
      });
    };

  // =====================================================
  // BOTAO TROCAR VIDEO
  // =====================================================

  if (skipButton) {
    skipButton.addEventListener(
      "click",
      function () {
        playRandomVideo();
      }
    );
  }

  // =====================================================
  // INICIALIZACAO
  // =====================================================

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
