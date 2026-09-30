# Imagens do jogo

| Ficheiro | O que é |
|---|---|
| `kaneki.png` | spritesheet do Kaneki, 4 frames de 23×55 px lado a lado (92×55) |
| `Kaneki_JUS_v2_by_TrafalgarLaw_4255.gif` | o GIF original de onde a folha foi gerada |

O jogo carrega o `kaneki.png`. O GIF fica guardado só como fonte — podes
apagá-lo sem partir nada.

## Converter um GIF numa spritesheet

O jogo não lê GIFs animados: precisa dos frames lado a lado numa imagem. Há um
conversor no projecto que faz isso sem instalar nada:

```
node tools/gif2sheet.mjs assets/o-teu.gif assets/o-teu.png
```

Ele imprime quantos frames encontrou e o tamanho da folha — são esses números
que vais precisar a seguir.

## Ligar uma animação nova

Em `js/Kaneki.js`, dentro de `KANEKI_ANIMATIONS`:

```js
walk: {
  src: 'assets/kaneki-walk.png',
  frameCount: 6,        // quantos frames a folha tem
  ticksPerFrame: 6,     // maior = mais lento (60 ticks ≈ 1 segundo)
},
```

O tamanho de cada frame é medido a partir da imagem, por isso não há nada para
medir à mão. Os nomes que o jogo procura são `idle`, `walk` e `attack`;
enquanto um deles não existir, esse estado usa o `idle`.

## Requisitos da arte

- **PNG com fundo transparente**
- **Virado para a direita** — o código espelha-o sozinho
- Frames **todos do mesmo tamanho**, numa única linha, sem espaçamento
- Personagem **centrado na largura** e com os **pés no fundo** do frame

## Tamanho no ecrã

A escala sai da altura do lutador, definida em `js/main.js`. Está em
`height: 165`, que dá exactamente 3× para uma arte de 55 px — em pixel art,
uma escala inteira é o que mantém todos os pixels do mesmo tamanho. Se
mudares de arte, escolhe uma altura que seja múltiplo da altura do frame.
