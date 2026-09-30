# Imagens e sons do jogo

| Ficheiro | O que é |
|---|---|
| `kaneki/atlas-0.png` | todos os sprites do corpo do Kaneki (645), numa só imagem |
| `kaneki/character.json` | onde está cada sprite no atlas, e as 353 animações: frames, tempos e caixas de colisão |
| `kaneki/snd/` | os 176 sons do personagem, um `.wav` por som |
| `kaneki/fx-common/` | poeira, faíscas, vento e o chão a rachar, no mesmo formato |
| `kaneki/fx-ultimate/` | os efeitos da cena do ultimate, no mesmo formato (atlas + `character.json`) |
| `tanjiro/` | o adversário: as animações que o jogo usa do Tanjiro, os retratos e os sons dos golpes normais |
| `hud/` | a arte das barras de vida e de energia |
| `music.mp3` | a música de fundo |
| `arena-bg.jpg` | a fotografia de fundo da arena (por cima do chão, que continua desenhado) |
| `ultimate-bg.jpg` | a fotografia de fundo da transformação do ultimate |
| `b0942d7754ac3ac7bfef92481275167e.jpg` | a fotografia de fundo do ultimate dos quatro cortes do Tanjiro (↓ + 5), um pouco escurecida |
| `Demon Slayer_ Mugen Train Arc.jpg` | a fotografia de fundo do ultimate do dragão de água do Tanjiro (↓ + 6), um pouco escurecida |
| `1e86b0d4fdc92e11a2dc4f279c31a658.jpg` | a fotografia de fundo, com a câmara no Tanjiro, quando ele liga a Dança do Deus do Fogo (↓ + 1) |
| `kaneki.png` e o `.gif` | a primeira arte do Kaneki, já não usada pelo jogo |

A pasta `kaneki/` vem do personagem de MUGEN "All-Stars: Ken Kaneki", de
Rivelio, com sprites de Aagus e MattFV. A `tanjiro/` vem do "ChaosTanjiro",
de DrAnimation, e a `hud/` de um pacote de lifebars no estilo do Street
Fighter 6. Os pacotes originais (`ChaosTanjiro/` e `Lifebar/`, na raiz do
projecto) são só a fonte: o jogo não os lê, e estão fora do git.

## Trazer um personagem do MUGEN

O jogo não lê os ficheiros do MUGEN, por isso há um conversor que os passa
para o formato dele, de uma vez:

```
node tools/mugen2game.mjs Kaneki.sff Kaneki.air Kaneki.snd assets/kaneki
```

O `.sff` guarda os sprites, o `.air` diz quais formam cada animação e o `.snd`
tem os sons. Só lê SFF v2 (MUGEN 1.0/1.1). A pasta original do personagem não
precisa de estar no projecto.

O que fica de fora:

- **Os efeitos grandes** (rastros, auras, cenários dos supers): são 30 MB, e
  carregá-los todos de uma vez pesava demais. O conversor diz quantas
  animações saltou por serem de efeitos; as que um golpe usa exportam-se à
  parte, para uma pasta só dele:

  ```
  node tools/mugenfx.mjs Kaneki.sff Kaneki.air assets/kaneki/fx-ultimate 3007 3032 3044
  ```

  Os números são as acções do `.air`. Quem as desenha é a camada de efeitos,
  `js/Effects.js`.
- **A lógica dos golpes** (`.cns`, `.cmd`): é código do MUGEN. Serve de
  consulta — dano, tempos, encadeamentos — mas o comportamento escreve-se no
  jogo.

## Os golpes do Kaneki

Os golpes estão em `js/kanekiMoves.js`, transcritos um a um do `.cns` do
personagem: cada entrada tem o número do estado original e diz que animação
usa, como o lutador se mexe, o que faz ao acertar (dano, empurrão, pausa do
impacto), que sons toca e para que golpes encadeia. O cabeçalho desse
ficheiro explica os campos. Quem executa a tabela é o `js/MoveFighter.js`.

| Tecla | O que faz |
|---|---|
| A / D | andar |
| K | saltar; com A ou D em baixo, avança um pouco (uma segunda vez no ar: salto duplo) |
| L | correr (no ar: investida); dois toques em A ou D fazem o mesmo |
| J | soco · W + J gancho que levanta · S + J avanço com o kakugan |
| O | golpe pesado · S + O kagune que rebenta do chão |
| U | kagune · W + U leque que levanta · S + U chicote longo |
| I | especial 1, Binge Strike (gasta um nível de energia) |
| W + I, ou I no ar | especial 2, Rinkaku Assault (um nível) |
| S + I | ultimate (barra de energia cheia) |
| Q (segurar) | carregar a energia; ao encher com a tecla em baixo, descarga |
| Esc | pausar e retomar |
| Enter | saltar a apresentação do início; recomeçar, quando aparece "Tentar novamente?" |

W e S não fazem nada sozinhas (S agacha): escolhem a variante do golpe. No
ar, J, O e U dão os golpes aéreos, e S + U o da kagune a rodar.

As teclas estão em `js/main.js` (`CONTROLS`) e o que cada combinação faz em
`KANEKI_COMMANDS`, no fim do `js/kanekiMoves.js`.

Os combos são os do original: carregar em J a seguir a um golpe que acertou
passa ao seguinte — também no combo pesado, que começa com O e continua com
J. A correr, J, O e U dão golpes próprios. Correr ou saltar a meio de um
combo só dá depois de acertar, e correr gasta energia.

As medidas da tabela são as do MUGEN; o `MoveFighter` multiplica-as pela
ampliação da arte. O dano também é o do original, dividido por 10 (a vida do
MUGEN vai até 1000, a do jogo até 100).

## Efeitos de impacto

Poeira ao saltar, aterrar e correr; faíscas onde um golpe acerta; o chão a
rachar nos golpes que levantam o adversário e nos mais fortes; um rasto
atrás do Kaneki nos golpes de kagune e nos especiais; um borrão nos dois
quando correm ou investem pelo ar (o corpo desfocado, com cópias a ficar para
trás, desenhado em `js/SpriteFighter.js`); e, a carregar a
energia, pó e pontos de luz à volta dele, com uma descarga (e o ecrã a
tremer) quando a barra enche. Os sprites são os do
personagem (`kaneki/fx-common/`).

O que aparece em cada momento está em `js/kanekiFx.js`; quando, em
`js/Kaneki.js` (os métodos `onLeap`, `onLand`, `onMoveStart`, `onMoveTick`,
`onHitLanded`). A poeira e a racha desenham-se atrás dos lutadores, as
faíscas à frente; tudo se apaga sozinho. A camada que os desenha é o
`js/Effects.js`, a mesma do ultimate.

## O adversário

O Tanjiro é um lutador como o Kaneki: a tabela de golpes dele está em
`js/tanjiroMoves.js` (os três combos de espada, os golpes aéreos, as
corridas, o carregar da respiração, dez especiais, dois ultimates e a Dança
do Deus do Fogo) e a classe em `js/Tanjiro.js`. Só se mexe com as teclas
dele (a tabela abaixo). Para ser a máquina a jogar por ele, põe-se
`PLAYER2_AI = true` em `js/main.js`: aí quem o controla é o
`js/EnemyAi.js`, que não mexe no lutador: devolve, a cada tick, as teclas que
um jogador premiria. Aproxima-se, ataca ao chegar ao alcance, continua o
combo se acertou, de vez em quando recua ou salta, carrega a respiração
quando está longe e usa os especiais e o ultimate quando tem energia. Os números que o tornam
mais ou menos agressivo estão no cimo desse ficheiro.

O personagem original pesa 100 MB e tem centenas de animações; para o jogo
vieram só as que ele usa:

```
node tools/mugenfx.mjs ChaosTanjiro.sff ChaosTanjiro.air assets/tanjiro 0 20 200 ... s:9000,1
node tools/mugensnd.mjs ChaosTanjiro.snd assets/tanjiro 0,26 1,34 ...
```

O primeiro leva as acções (e, com `s:`, sprites soltos como o retrato); o
segundo os sons, um a um. Um `c:accao:grupo,numero:nova` no primeiro junta
uma cópia da acção pintada com outra paleta do `.sff`: é assim que os arcos
da espada existem em azul (água) e em laranja (fogo).

O `mugenfx` reescreve o `character.json` e esquece os sons: depois dele,
volta-se a correr o `mugensnd` com todos os que estão em `tanjiro/snd/`.

Do original ficaram por transcrever o corte em queda, o reforço e os
especiais que só existem dentro da Dança do Deus do Fogo.

Joga-se com ele a dois: as setas andam e agacham, e os números (os de cima
ou os do teclado numérico) são os botões.

Na apresentação, a câmara passa para ele depois da entrada do Kaneki e fica
lá até a dele acabar: a do original é uma pose de espada na mão, com a fala
dele, durante pouco mais de três segundos.

Quando ganha, fica a respirar fundo de espada na mão e diz a fala de vitória
do original. Se ganhar com a Dança do Deus do Fogo ligada, a pose e a fala
são as outras do original: cai no chão, esgotado.

| Tecla | O que faz | Energia |
|---|---|---|
| ← / → | andar · ↓ agachar | |
| 1 | soco (combo A) | |
| 2 | saltar | |
| 3 | correr; no ar, investida | |
| 4 | espada (combo C) | |
| 6 | golpe pesado (combo B) | |
| 9 (segurar) | carregar a respiração | enche |
| ↓ + 1 | liga e desliga a Dança do Deus do Fogo | 1 nível para ligar |
| 5 | especial 1: quatro cortes seguidos | 1 nível |
| ↑ + 5 | especial 2: corte a subir | 1 nível |
| ← ou → + 5 | especial 3: investida em quatro tempos | 1 nível |
| ↑ + 6 | especial 4: três cortes pesados | 1 nível |
| ← ou → + 6 | investida pelo ar com a espada | 1 nível |
| ← ou → + 4 | a roda de água (com o adversário perto) | 1 nível |
| ↑ + 4 | super: os cortes pesados a dobrar | 1,5 (precisa de 2) |
| ↓ + 4 | agarrão: tira um décimo da vida | meio nível |
| 5 no ar | especial do ar: um corte forte | 1 nível |
| ↓ + 4 no ar | a rodar com a espada | |
| ↓ + 5 | ultimate: os quatro cortes | a barra cheia |
| ↓ + 6 | ultimate: o dragão de água | a barra cheia |

Com a Dança do Deus do Fogo ligada, os arcos da espada passam de água a
fogo e os especiais tiram metade a mais.

As teclas base espelham as do Kaneki: 1 = J, 2 = K, 3 = L, 4 = U, 5 = I,
6 = O e 9 = Q.

Na consola, `game.ai.enabled = false` deixa-o parado, para treinar combos.

## O HUD

As barras de vida com retrato e nome, o relógio e as barras de energia são
desenhados pelo `js/Hud.js` com a arte de `hud/`, na disposição que o
`fight.def` do pacote define. O retrato é o grande de cada personagem (o
sprite `9000,1`), de que se mostra uma faixa; a altura dessa faixa acerta-se
no `top` de cada jogador, em `js/main.js`.

```
node tools/sff2atlas.mjs fight.sff assets/hud 10 11 25 30 31 35 36 39
```

exporta os grupos de sprites de um `.sff` sem animações, como o de um HUD.
Sem a pasta `hud/` o jogo usa as barras simples de `js/HealthBar.js` e
`js/PowerBar.js`.

## O ultimate

Rinkaku Kakuja – Full Kill. Só sai no chão e com a barra de energia cheia
(no original exige também o adversário abaixo de um terço da vida). Em modo
de treino — `game.player1.training = true`, na consola — sai sempre e não
gasta energia. Começa por um golpe
de kagune (o estado `3000`, em `js/kanekiMoves.js`); se acertar, o combate
pára e corre a cena de `js/kanekiUltimate.js`, um guião com o que os dois
lutadores, os efeitos e os sons fazem em cada tick. No fim o adversário perde
um terço da vida.

A primeira parte da cena, a transformação, tem por fundo a fotografia
`assets/ultimate-bg.jpg`: enche o ecrã, cortando o que sobrar, e aproxima-se
devagar. Para a trocar basta pôr outra com o mesmo nome; sem ela o fundo é
branco, como no original. A opacidade é o `BACKDROP_ALPHA`.

O guião segue os estados `3005` a `3031` do personagem. O cabeçalho do
ficheiro diz o que foi adaptado.

## A máscara

Quando a vida do Kaneki chega a metade, ele põe a máscara: toca uma animação
curta e passa à segunda forma do personagem, que é a mesma arte de máscara
posta (as acções somadas de `10000`). Os golpes não mudam. O limiar é o
`MASK_HEALTH`, em `js/Kaneki.js`.

## Animações de estar e reagir

As que não são golpes (parado, andar, saltar, agachar, apanhar, entrada,
vitória) estão em `js/Kaneki.js`, em `KANEKI_ACTIONS`, pelo número da acção:

```js
walk: { action: 20 },
intro: { action: 192, loop: false, sounds: [{ at: 1, sound: [0, 43] }] },
```

Os tempos de cada frame vêm do `character.json`. Um som é
`[grupo, número]`, o ficheiro `kaneki/snd/0_43.wav`, e `at` o tick da
animação em que toca.

Acções habituais: `0` parado, `20` andar, `41` salto, `120` a `152` defesa,
`191` a `193` entradas, `200` em diante golpes, `5000` em diante apanhar e
cair. Somar `10000` dá a mesma animação na segunda forma do personagem.

## Música de fundo

O jogo toca em ciclo o ficheiro `assets/music.mp3`, se existir (`.mp3`,
`.ogg` e `.wav` funcionam, desde que o nome seja o que está em
`startMusic`, no `js/main.js`). O volume é o `MUSIC_VOLUME`, no mesmo
sítio, e a tecla M liga e desliga.

## Ver o que o personagem tem

Na consola do browser (F12), com o jogo aberto:

```js
game.player1.character.actionNumbers     // os números que existem
game.player1.playAction(405)             // toca uma, para ver
game.player1.showBoxes = true            // mostra as caixas de colisão
game.player1.character.playSound(0, 43)  // toca um som
```

As caixas vermelhas são as de ataque (onde o golpe acerta) e as azuis as do
corpo (onde o lutador pode ser atingido).

As caixas de ataque do Kaneki original vão muito além do desenho (acertava de
longe, até no ar por cima do adversário). No jogo, cada uma é cortada ao
rectângulo da arte do frame, com uma folga de 4 píxeis da arte
(`clipHitsToArt` em `js/SpriteFighter.js`): o golpe só acerta onde se vê o
braço, a perna ou a kagune. As caixas que o `showBoxes` mostra são as do
original, antes do corte.

## Arte solta, sem MUGEN

Um lutador também pode usar imagens PNG soltas: uma imagem única, ou uma
spritesheet com os frames lado a lado numa linha. Em vez de um número de
acção, a animação leva o ficheiro:

```js
walk: {
  src: 'assets/o-teu-walk.png',
  frameCount: 6,        // quantos frames a folha tem
  ticksPerFrame: 6,     // maior = mais lento (60 ticks ≈ 1 segundo)
},
```

Requisitos dessa arte: PNG com fundo transparente, virado para a direita (o
código espelha-o sozinho), frames todos do mesmo tamanho, personagem centrado
na largura e com os pés no fundo do frame.

Dois conversores fazem folhas destas:

```
node tools/gif2sheet.mjs assets/o-teu.gif assets/o-teu.png
node tools/sff2sheet.mjs Kaneki.sff Kaneki.air 20 assets/walk.png
```

O primeiro desmonta um GIF animado; o segundo tira uma única acção de um
personagem de MUGEN. Ambos imprimem o `frameCount` e os tempos a usar.

## Tamanho no ecrã

A escala está fixa em `spriteScale: 3`, em `js/main.js` — em pixel art, uma
escala inteira é o que mantém todos os pixels do mesmo tamanho. A altura do
lutador (`height: 165`) é a da arte parada vezes essa escala: 55 px × 3. Se
mudares de arte, acerta os dois.
