# Imagens e sons do jogo

| Ficheiro | O que é |
|---|---|
| `kaneki/atlas-0.png` | todos os sprites do corpo do Kaneki (645), numa só imagem |
| `kaneki/character.json` | onde está cada sprite no atlas, e as 353 animações: frames, tempos e caixas de colisão |
| `kaneki/snd/` | os 176 sons do personagem, um `.wav` por som |
| `kaneki/fx-common/` | poeira, faíscas, vento e o chão a rachar, no mesmo formato |
| `kaneki/fx-ultimate/` | os efeitos da cena do ultimate, no mesmo formato (atlas + `character.json`) |
| `tanjiro/` | o adversário: as animações que o jogo usa do Tanjiro, os retratos e os sons dos golpes normais |
| `hud/` | a arte das barras de vida e de energia; em `hud/announcer/`, os anúncios ("Round 1", "Fight", "K.O.") e as vozes deles |
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
| S, D + J | Binge Strike (como o I) · S, A + J: Quarter Kill, a postura que responde a um golpe com cortes invisíveis (um nível) |
| S, D + O | Eater Hunt, investida de muitos toques · S, A + O: Rising Pierce, a kagune que rebenta do chão (um nível) |
| S, D + U | Rinkaku Assault (como o W + I) · S, A + U: Rinkaku Crawling, a kagune que avança pelo chão (um nível) |
| S, D, S, D + J | super Half Kill: agarra e tira quase metade da vida (1,5 níveis) |
| S, D, S, D + O | super Devouring Hunt (1,5 níveis) |
| S, D, S, D + U | super Rinkaku Overkill (2 níveis) |
| Q (segurar) | carregar a energia; ao encher com a tecla em baixo, descarga |
| Esc | pausar e retomar (a pausa mostra a lista de comandos dos dois) |
| Enter | saltar a apresentação do início; revanche, quando aparece "Tentar novamente?" |
| Backspace | voltar ao menu, no fim da partida |

W e S não fazem nada sozinhas (S agacha): escolhem a variante do golpe. Os
comandos com vírgula são sequências, como no MUGEN: S, depois D (ou A), e o
botão; os supers repetem a sequência duas vezes. A e D contam para a frente
e para trás do Kaneki, e o golpe sai para onde ele olhava quando começou.
Os especiais estão em `js/kanekiSpecials.js` e os supers em
`js/kanekiSupers.js`, com os mesmos campos da tabela principal; os efeitos
grandes deles, em `kaneki/fx-specials/` e `kaneki/fx-supers/`. No
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

Poeira ao saltar e aterrar; faíscas onde um golpe acerta; o chão a
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

Por cima do combate:

- **O contador de combo** (`js/ComboCounter.js`): "5 HITS" do lado de quem
  bate, enquanto o outro não recupera (atordoado, no ar, no chão). Só contam
  os toques que tiram vida, e só aparece a partir de dois.
- **A barra de dano recente**: a parte da vida que acabou de sair fica à
  vista atrás da barra enquanto o combo dura, e só depois desce devagar
  (`js/Hud.js`).
- **O K.O. em câmara lenta**: o golpe que decide o round passa a um quarto
  da velocidade durante uns dois terços de segundo (`KO_SLOW_FRAMES` em
  `js/main.js`).

## O adversário

O Tanjiro é um lutador como o Kaneki: a tabela de golpes dele está em
`js/tanjiroMoves.js` (os três combos de espada, os golpes aéreos, as
corridas, o carregar da respiração, dez especiais, dois ultimates e a Dança
do Deus do Fogo), os que faltavam em `js/tanjiroExtraMoves.js` (o corte em
queda, o reforço, os especiais que só existem dentro da Dança e o atirar a
espada), os que ele tem sem espada em `js/tanjiroSwordless.js` e a classe
em `js/Tanjiro.js` (que trata também da espada atirada). Com "2 JOGADORES" no menu
só se mexe com as teclas dele (a tabela abaixo); com "1 JOGADOR" quem o
controla é o `js/EnemyAi.js`, que não mexe no lutador: devolve, a cada tick, as teclas que
um jogador premiria. Aproxima-se, ataca ao chegar ao alcance, continua o
combo se acertou, de vez em quando recua ou salta, carrega a respiração
quando está longe e usa os especiais e o ultimate quando tem energia. Os números que o tornam
mais ou menos agressivo estão no cimo desse ficheiro.

O personagem original pesa 100 MB e tem centenas de animações; para o jogo
vieram só as que ele usa:

```
node tools/mugenfx.mjs ChaosTanjiro.sff ChaosTanjiro.air assets/tanjiro 0 10 11 12 20 40 41 44 47 100 101 102 103 105 170 180 181 182 190 200 210 220 230 235 240 250 300 310 320 330 340 400 410 420 500 501 600 610 611 620 630 900 1003 1058 1200 1201 1202 1203 1208 1304 1400 1402 1410 1411 1500 1550 1557 1602 1700 1702 1722 1800 1801 1810 1811 1820 1821 1900 3000 3006 4000 4001 4002 4003 4004 4012 4013 4100 4101 4102 5000 5001 5002 5005 5010 5020 5030 5035 5040 5050 5070 5080 5100 5110 5120 5150 6120 6280 7031 7210 7652 7653 8000 8109 9000 41002 41003 41101 41150 41280 41300 41301 41500 41501 41502 41503 41600 41700 41701 41800 41801 41900 64310 64316 96178 96179 232360 11000 11011 11020 11041 11100 11102 11500 11501 11200 11210 11220 11230 11237 11300 11310 11320 11325 11330 11600 11601 11602 11610 28287 11301 15678 113330 14156 267821 78942 72928 72929 15500 41180 1874 1875 1876 1877 c:1058:3,8:11058 c:7210:3,8:17210 c:1058:3,3:21058 c:7210:3,3:27210 s:9000,0 s:9000,1
node tools/mugensnd.mjs ChaosTanjiro.snd assets/tanjiro 0,26 1,34 ...   (todos os de tanjiro/snd/)
```

O primeiro leva as acções (e, com `s:`, sprites soltos como o retrato); o
segundo os sons, um a um. Um `c:accao:grupo,numero:nova` no primeiro junta
uma cópia da acção pintada com outra paleta do `.sff`: é assim que os arcos
da espada existem em azul (água) e em laranja (fogo).

O `mugenfx` reescreve o `character.json` e esquece os sons: depois dele,
volta-se a correr o `mugensnd` com todos os que estão em `tanjiro/snd/`.

As chamas dos golpes da Dança são grandes de mais para o atlas do corpo e
vão para `tanjiro/fx-extra/`, a meia resolução e com menos frames (cada
frame leva ampliação 2, para se desenhar do mesmo tamanho):

```
node tools/mugenfxsmall.mjs ChaosTanjiro.sff ChaosTanjiro.air assets/tanjiro/fx-extra 951/2 973/2 987/2 988/2 10065/2 1750 1708/4 41710 14020/2 10126/4 992/2 10072/2 3683 6599/2 6600/2 4026 8043 4150/2 3903/2 4270
```

`accao/2` fica com um frame em cada dois. O que ficou de fora do original
está no cimo do `js/tanjiroExtraMoves.js`.

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
| ← ou → + 5 no ar | o corte em queda: se a aura o apanhar, cai-lhe em cima e tira um terço da vida | 1 nível |
| ↑ + 1 | o reforço: 20 s em que cada golpe recebido vira esquiva e a corrida vira relâmpago (repete-se 40 s depois de começar) | 1 nível |

Com a Dança do Deus do Fogo ligada, os arcos da espada passam de água a
fogo e os especiais tiram metade a mais. As mesmas teclas dão então os
golpes que só existem na Dança, os que substituem os de água no original:

| Tecla (com a Dança) | O que faz | Energia |
|---|---|---|
| 5 | a postura: depois 1 (ou nada) estocada, ↑ corte a subir, ↓ no ar corte a descer | 1 nível |
| ↑ + 5 | cinco cortes em chamas | 1 nível |
| ← ou → + 5 | carrega e atravessa-o; se acertar, colunas de fogo | 1 nível |
| ↑ + 6 | dois cortes pesados a correr | 1 nível |
| ← ou → + 6 | dois cortes: o primeiro segura-o, o segundo tira um nono da vida | 1 nível |
| ↑ + 4 | a roda de fogo, a saltar | 1 nível |
| ← ou → + 4 | a estocada que o prende | 1 nível |
| ↓ + 4 | o corte que o levanta, três no ar e o último lá de cima | 1,5 |
| ↑ + 1 | a investida-relâmpago, de um lado ao outro | 1 nível |
| ← ou → + 1 | o contra-ataque: se lhe baterem, surge por trás e corta | 1 nível |
| ↑ + 9, ou ↓ + 6 no ar | voa até ele, leva-o e fecha com um corte | 1 nível |
| 5 no ar | a postura no ar (a estocada é o corte do ar) | 1 nível |
| ↓ + 5 | ultimate: os cortes em chamas, com uma roda de cinco segundos | a barra cheia |
| ↓ + 6 | ultimate: prende-o, sobe ao céu e cai sobre ele (metade da vida) | a barra cheia |
| ↓ + 9 | atira a espada: se o apanha, fica-lhe espetada e salta dele a rodar; ele fica sem espada (a tabela abaixo) | meio nível |

Com a Dança ligada, cada golpe que o apanhe tem ainda 15% de virar uma
esquiva (some e aparece por trás do adversário) e outros 15% de virar a
guarda do contra-ataque, como no original.

Sem espada, o Tanjiro fica com outra arte (parado, a andar, a saltar, a
correr, a carregar) e com os golpes do original para esse caso; os de
espada deixam de sair. A espada fica espetada no chão onde caiu: ao pé
dela, o 4 apanha-a; depois de um golpe sem espada que acertou, o 4
fá-la voltar à mão esteja onde estiver. O computador, se não a apanhar,
recupera-a sozinho ao fim de 20 s. Sem espada, 15% dos golpes que o
apanhem viram a defesa (↓ + 6).

| Tecla (sem espada) | O que faz | Energia |
|---|---|---|
| 1 · 6 | socos e pontapés, que encadeiam se acertarem | |
| ↓ + 1 | o gancho que levanta | |
| ↓ + 6 | a defesa: se lhe baterem logo a seguir, empurra-o | |
| 1 · 6 no ar | socos e pontapé do ar | |
| 5 | pára o tempo, corre para ele, agarra-o e derruba-o | 1 nível |
| ↑ + 5 | a cabeçada (segurando o 5, a que o deixa mais tempo atordoado) | 1 nível |
| ← ou → + 5 | dez golpes seguidos, se o primeiro acertar | precisa de 1 |
| ↑ + 6 | um segundo em guarda: se lhe baterem, tira-lhe um décimo da vida | 1 nível |
| 4 | apanha a espada (ao pé dela, ou a seguir a um golpe que acertou) | |

As teclas base espelham as do Kaneki: 1 = J, 2 = K, 3 = L, 4 = U, 5 = I,
6 = O e 9 = Q.

Na consola, `game.ai.enabled = false` deixa-o parado, para treinar combos.

## A partida

O jogo abre num menu (`js/Menu.js`): "1 JOGADOR" é o Kaneki contra o Tanjiro
do computador, "2 JOGADORES" os dois no mesmo teclado. Escolhe-se com W/S ou
com as setas, e o Enter começa.

Cada partida é à melhor de 3 rounds, de 99 segundos cada. O primeiro abre com
as entradas dos dois; todos com o anúncio ("Round 1", "Round 2", ou "Final
Round" no que decide) e o "Fight", e só aí as teclas passam a contar. Um
round acaba por K.O. ou quando o tempo chega a zero: aí ganha quem tiver mais
vida, em fracção da vida máxima (o Tanjiro tem mais do que o Kaneki), e
empate é "Draw Game", sem vitória para ninguém. A energia passa de um round
para o seguinte. Quem ganhar dois vence a partida; a seguir vem o "Tentar
novamente?". O relógio pára durante a cena do ultimate.

Os rounds ganhos aparecem ao lado do relógio, um ícone por round (apagado o
que falta ganhar). As regras estão no cimo da secção "partida" de
`js/main.js`: `WINS_NEEDED`, `ROUND_SECONDS`, `ROUND_END_TICKS`.

Os anúncios e as vozes são os do pacote de lifebars (`hud/announcer/`). Das
animações dele ficou só o frame já formado de cada uma, para não pesarem 29
MB; a entrada e a saída fazem-se em `js/Announcer.js`:

```
node tools/mugenfx.mjs fight.sff fight.def assets/hud/announcer s:101,14 s:102,14 s:103,14 s:108,17 s:110,15 s:111,23
node tools/mugensnd.mjs fight.snd assets/hud/announcer 0,1 0,2 0,3 0,8 1,0 2,0 2,2 2,3
```

"Time Over", "Draw Game" e quem venceu não têm arte no pacote: são texto.

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
