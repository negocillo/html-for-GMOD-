# LoadScreem para Garry's Mod

Esta pasta contem uma loadscreen web com videos do YouTube tocando em ordem aleatoria, nome do servidor e painel de admins.

## Como usar

1. Edite o arquivo `assets/videos.js`.
2. Defina o nome do servidor em `window.LOADSCREEN_SERVER.name`.
3. Defina o subtitulo em `window.LOADSCREEN_SERVER.subtitle`.
4. Adicione seus admins em `window.LOADSCREEN_SERVER.admins`.
5. Adicione seus links do YouTube no array `window.LOADSCREEN_VIDEOS`.
6. Hospede estes arquivos em um site ou webhost.
7. No seu servidor GMOD, configure a `sv_loadingurl` apontando para o `index.html`.

Exemplo:

```cfg
sv_loadingurl "https://seusite.com/loadscreen/index.html"
```

## Links aceitos

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`

## Observacoes

- A loadscreen escolhe um video aleatorio ao abrir.
- Quando o video termina, outro video aleatorio e carregado.
- O botao `Trocar video` permite pular manualmente para outro video.
- Alguns videos podem nao permitir embed fora do YouTube. Nesses casos, o script tenta carregar outro video da lista.
- Voce pode marcar admins manualmente com `online: true` ou `online: false`.
- Se quiser admins online de verdade, informe uma URL JSON em `window.LOADSCREEN_SERVER.adminsSource`.

## Exemplo de admins

```js
window.LOADSCREEN_SERVER = {
  name: "Cidade Alpha RP",
  subtitle: "Equipe online para te receber",
  adminsSource: "",
  adminsRefreshMs: 30000,
  admins: [
    { name: "Pedro", role: "Fundador", online: true, avatar: "https://site.com/pedro.png" },
    { name: "Julia", role: "Moderadora", online: false, avatar: "https://site.com/julia.png" }
  ]
};
```

## Exemplo de endpoint JSON

O endpoint pode retornar:

```json
{
  "admins": [
    { "name": "Pedro", "role": "Fundador", "online": true, "avatar": "https://site.com/pedro.png" },
    { "name": "Julia", "role": "Moderadora", "online": false, "avatar": "https://site.com/julia.png" }
  ]
}
```
