# Isabelly: BUILD SUCCESSFUL

Um jogo curto de **plataforma / runner** em **pixel art**, feito só com **HTML, CSS e JavaScript puro + Canvas**.
Sem áudio, sem frameworks, sem bibliotecas externas, sem CDN — roda 100% offline e todos os
assets ficam dentro deste repositório.

> Projeto **independente**. A única relação externa é o próprio GitHub e o repositório
> `madutiam/chata`. Sem Vercel, sem contas de terceiros, sem serviços externos. Publicação
> exclusivamente pelo **GitHub Pages** deste repositório.

## História

**Isabelly** precisa atravessar um cenário cheio de piadas de programação (`404`, `undefined`,
`merge conflict`, `npm install`, `git push`...), desviar de **bugs**, encarar o **Homem-Aranha**,
passar pela **Bedetti** e chegar ao **deploy**. No final, a Bedetti a
alcança para uma cutscene — e o build termina com **BUILD SUCCESSFUL**.

## Personagens

- **Isabelly** — a protagonista (sprite baseado na referência da garota).
- **Homem-Aranha (vermelho)** — inimigo/personagem que patrulha o caminho.
- **Bedetti** — a garota de jaqueta de couro preta e café na mão (com animação de caminhada);
  aparece no meio da fase perseguindo (`Bedetti.exe --stalk`) e na cutscene final.
- **Azul** e **Tigrão** — os gatos, itens colecionáveis que dão pontos (e às vezes curam).

As artes de referência originais ficam preservadas em [`assets/references/`](assets/references/).
A **Isabelly** usa o sprite [`assets/isabelly.png`](assets/isabelly.png) e a **Bedetti** usa uma
animação de 3 quadros (`assets/bedetti_walk1..3.png`), ambas recortadas direto das folhas de
referência (fundo removido, redimensionadas para o tamanho do jogo). Os demais elementos
(Homem-Aranha, gatos, bugs) são desenhados via código em [`js/sprites.js`](js/sprites.js).

## Controles

| Ação | Teclas |
|------|--------|
| Andar | `A` / `←`  e  `D` / `→` |
| Correr | **segurar a direção** (acelera sozinho) ou `Shift` |
| Pular | `Espaço` / `W` / `↑` |
| Eliminar bug | pular em cima dele |

### Celular / tablet

Funciona no navegador do celular: aparecem botões na tela — **`<` `>`** para andar
e **PULAR** — e a personagem **corre automaticamente** ao segurar a direção (não precisa
de Shift). O jogo pede para **virar o celular na horizontal** (modo paisagem) para ficar
maior e mais confortável.

## Como jogar / rodar localmente

Como é um site estático, basta abrir o `index.html`. Para evitar qualquer restrição do
navegador com arquivos locais, o ideal é servir por um servidor local simples:

```bash
# Python 3
python -m http.server 8099
```

Depois abra: <http://localhost:8099>

Alternativas equivalentes:

```bash
# Node (npx, sem instalar nada permanente)
npx serve .
```

Ou simplesmente dê duplo-clique em `index.html` (funciona na maioria dos navegadores).

## Como publicar no GitHub Pages (repositório `madutiam/chata`)

Existem duas formas — as duas usam **apenas o GitHub**, nada externo.

### Opção A — Servir os arquivos direto do branch (mais simples, recomendada)

1. Faça push do projeto para o branch `main` de `madutiam/chata`.
2. No GitHub: **Settings → Pages**.
3. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
4. Selecione o branch **`main`** e a pasta **`/ (root)`** e salve.
5. Aguarde ~1 min. O jogo ficará em `https://madutiam.github.io/chata/`.

### Opção B — GitHub Actions (deploy automático a cada push)

Este repositório já inclui [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml),
que sobe os arquivos estáticos (sem build) para o Pages.

1. No GitHub: **Settings → Pages → Source = GitHub Actions**.
2. Faça push para `main`. O workflow publica sozinho.
3. O endereço final é `https://madutiam.github.io/chata/`.

O arquivo [`.nojekyll`](.nojekyll) garante que a pasta `js/` e afins não sejam processadas pelo Jekyll.

## Estrutura

```
chata/
├─ index.html                 # telas (título, jogo, game over, vitória) + canvas
├─ css/style.css              # estilo pixel art, overlays, responsividade
├─ js/
│  ├─ sprites.js              # sprites em pixel art (desenhados por código)
│  └─ game.js                 # loop, física, fase, inimigos, HUD, cutscene
├─ assets/references/         # artes de referência originais (preservadas)
├─ .github/workflows/deploy-pages.yml
├─ .nojekyll
└─ README.md
```

## Mecânicas

- **Parkour**: além dos buracos, há pontes de plataformas para saltar (`// hop the callstack`).
- **Checkpoints** (`git commit`): ao passar por um, o progresso é salvo. Se você morrer,
  o Game Over oferece **CONTINUAR (checkpoint)** — você volta ao último checkpoint, com as
  vidas cheias e a pontuação mantida — ou **RECOMEÇAR** do zero.
- **Gatos que te seguem**: cada gato (Azul/Tigrão) coletado vira um **companheiro** que entra
  numa fila atrás da Isabelly e refaz o caminho dela (inclusive os pulos). Dão pontos também.
- **Vilões com comportamento próprio**:
  - **Homem-Aranha** patrulha e dá um **bote** (telegrafado) na sua direção quando você chega perto — dá pra desviar.
  - **Bedetti** te **persegue** dentro da zona dela (`Bedetti.exe --stalk`) e desiste quando você escapa pelo parkour.
  - **Bugs** andam e dão pequenos **pulos**. Pise neles para eliminá-los.
- **Moedas** `console.log` dão pontos.

## Notas

- **Sem áudio** por design (nenhuma trilha, efeito ou Web Audio API).
- A cutscene final é uma piada: a Bedetti se aproxima e a tela corta para preto **antes**
  de qualquer contato. Termina em `BUILD SUCCESSFUL` com o botão **JOGAR NOVAMENTE**.
