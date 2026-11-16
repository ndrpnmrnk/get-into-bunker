# Проба стиля — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Браузерная сцена, по которой автор утверждает стиль игры: кусок острова с костром и тремя персонажами в стиле PEAK, плюс режим от первого лица с ходьбой и рот, который двигается от микрофона.

**Architecture:** 3D-ассеты создаются Python-скриптами Blender (bpy) и экспортируются в glTF. Персонаж моделируется прямо на скелете Quaternius UAL, поэтому анимации подходят без ретаргетинга. Сцена — Vite + Three.js: toon-материалы из общей палитры, контур пост-эффектом по глубине и нормалям. Сети, Discord и физики Rapier в этой сборке нет.

**Tech Stack:** Blender 5.3 как Python-модуль (`pip install bpy==5.3.0`), Quaternius Universal Animation Library (CC0), Node 22, Vite, three, Vitest, Playwright (скриншоты для проверки).

**Spec:** `docs/concept.md` (разделы «Стиль», «Решения допроса» — раунды 3–5).

## Global Constraints
- Только ПК-браузер (Chrome/Edge/Firefox последних версий), экран от 1280×720.
- Стиль: мультяшный 3D, мягкие «надутые» формы, контур на всех 3D-объектах, пастельные тона — не кислотные и не тусклые. Цвета только из `art/palette.json`.
- Персонаж — одна цельная skinned-модель на одном скелете (скелет UAL), сделанная в Blender, не собранная из примитивов в коде. Лицо, волосы, футболка, шорты, кисти с пальцами (3 пальца + большой).
- Вид от первого лица: камера на месте глаз, свои руки, ноги и туловище видны, своя шея и голова — нет.
- Рот двигается в такт голосу с микрофона.
- Все тексты интерфейса — по-русски, в `src/i18n/ru.json`, не в коде.
- Качество важнее количества: элемент, который не дотягивает до референсов, убираем, а не оставляем.
- Не добавлять ничего сверх плана. Панель пробы (переключатели вида и вариантов, кнопка микрофона) — тестовый стенд, а не игровой интерфейс.
- Бюджеты: персонаж ≤ 20 000 треугольников, остров ≤ 150 000, сцена держит 60 FPS на встроенной графике ноутбука при 1080p.

## Review Focus
1. Микрофон запрещён или его нет → страница работает, рот закрыт, внизу короткое сообщение по-русски (тест в Task 6).
2. Тишина и фоновый шум → рот не «дребезжит» от шума ниже порога (тест в Task 6).
3. Высокий или широкий вариант тела → камера от первого лица на высоте его глаз, ноги стоят на земле (тест в Task 5 и Task 7).
4. Ресайз окна и экран с devicePixelRatio 2 → толщина контура в CSS-пикселях не меняется (тест в Task 4).
5. Шаг к обрыву или в костёр → движение блокируется, сквозь землю не проваливаемся (тест в Task 7).

---

### Task 0: Предусловие от автора
- [ ] **Step 1:** Автор скачивает **Universal Animation Library [Standard]** (бесплатно, «name your price» → 0) с quaternius.itch.io/universal-animation-library и прикрепляет zip в чат. Из рабочей среды сайт недоступен.
- [ ] **Step 2:** Распаковать в `art/vendor/ual/` (папка в `.gitignore`; в репозиторий попадают только наши экспортированные `.glb`). Лицензию CC0 скопировать в `art/vendor/UAL-LICENSE.txt` (коммитится).

### Task 1: Скелет и клипы UAL

**Files:**
- Create: `art/blender/requirements.txt` (`bpy==5.3.0`), `art/blender/common.py`, `art/blender/rig.py`, `art/blender/check_rig.py`, `art/palette.json`, `.gitignore`
- Output: `art/build/rig.json`

**Interfaces:**
- Produces: `common.load_palette() -> dict[str, str]`, `common.reset_scene()`, `common.export_glb(path: str, animations: bool)`; `rig.py` пишет `art/build/rig.json` = `{"bones": [...], "head": str, "neck": str, "eyeHeightCm": float, "clips": {"idle": str, "walk": str, "jump": str, "crouchIdle": str, "crouchWalk": str, "sit": str}}` — имена исходных клипов UAL под нашими ключами.
- `art/palette.json` (стартовые значения, правятся на ревью): `sky #BFE3F0, fog #DCEEF2, water #7FC8D6, waterFoam #F2FAFA, grass #A8D69A, grassDark #86BD7C, rock #B9B2A8, cliff #9E9488, wood #B98B6A, woodDark #8E6A52, fire #FFB25E, fireCore #FFF1C2, skin1 #F2CBA8, skin2 #D9A07A, skin3 #8D5B3F, shirt1 #F4A6A0, shirt2 #9CC5E8, shirt3 #F6D98B, shorts1 #6F8FAF, shorts2 #8C7A6B, hair1 #4A3B35, hair2 #C98B5B, eyeWhite #FFFFFF, pupil #2B2530, mouth #7A3B3F, outline #3B3340`.

- [ ] **Step 1: Проверка (падает):** `check_rig.py` проверяет, что `rig.json` существует, кости `head` и `neck` в списке, все 6 клипов найдены, `eyeHeightCm` в диапазоне 150–185.
Run: `python art/blender/check_rig.py` → FAIL «rig.json not found».
- [ ] **Step 2:** `rig.py` импортирует скелет и клипы UAL из `art/vendor/ual/`, выбирает клипы под 6 ключей (по названию, при неоднозначности — первый, без суффиксов вроде `_RM` root motion), пишет `rig.json`.
- [ ] **Step 3:** Run: `python art/blender/rig.py && python art/blender/check_rig.py` → PASS.
- [ ] **Step 4:** Commit `feat(art): UAL rig extraction`.

### Task 2: Базовый персонаж

**Files:**
- Create: `art/blender/character.py`, `art/blender/check_character.py`
- Output: `public/models/character.glb`

**Interfaces:**
- Consumes: `rig.json`, `common.*`.
- Produces: `character.glb` — один skinned-меш `Body` на скелете UAL; слоты материалов ровно `skin, shirt, shorts, hair, eyeWhite, pupil, mouth`; shape key `mouthOpen` (0 — закрыт, 1 — открыт ~1,5 см); 6 клипов, переименованных в ключи из `rig.json` (`idle`, `walk`, `jump`, `crouchIdle`, `crouchWalk`, `sit`).

Форма: объёмные «надутые» части (капсульное туловище, толстые мягкие конечности без суставов-шаров, круглая голова), слитые в один меш (remesh + сглаживание), большие круглые глаза со зрачками, полость рта под shape key, прическа одним объёмным куском, футболка и шорты — отдельные материальные зоны того же меша. Кисти: 3 пальца + большой, на костях пальцев UAL. Веса — автоматические, затем правка у шеи, плеч и паха.

- [ ] **Step 1: Проверка (падает):** `check_character.py` открывает glb и проверяет: один skinned-меш; треугольников ≤ 15 000; набор материалов ровно из списка выше; shape key `mouthOpen` есть; 6 клипов с нужными именами; при проигрывании `walk` ни одна вершина не уходит дальше 5 см от кожи соседних костей (грубая проверка на «рваные» веса — сэмплить 10 кадров).
Run: `python art/blender/check_character.py` → FAIL.
- [ ] **Step 2:** Реализовать `character.py`.
- [ ] **Step 3:** Run: `python art/blender/character.py && python art/blender/check_character.py` → PASS.
- [ ] **Step 4:** Отрендерить в Blender (Eevee, toon-подобный свет) `art/build/character_preview.png` — спереди, сбоку, 3/4 — и посмотреть самому. Если формы не дотягивают до референсов (PEAK) — доработать до коммита.
- [ ] **Step 5:** Commit `feat(art): base character`.

### Task 3: Кусок острова

**Files:**
- Create: `art/blender/island.py`, `art/blender/check_island.py`
- Output: `public/models/island.glb`

**Interfaces:**
- Produces: узлы с точными именами: `Ground` (рельеф, по нему ходят), `Cliffs`, `Campfire`, `FirePoint` (empty в центре пламени), `Seat_0`…`Seat_7` (empties: позиция таза сидящего и поворот лицом к костру), `Spawn` (empty), `Rocks`, `Grass`, `Trees`, `WalkBlockers` (невидимый меш: камни костра, стволы деревьев). Материалы названы ключами палитры.

Форма: холм-остров ~40 м в диаметре, плоская верхушка ~16 м с костром в центре, кольцо из камней, 4 бревна-скамьи на 8 мест по кругу, по краям мягкие скалистые обрывы до воды, валуны, пучки травы, 2 стилизованные ели. Ели делаем только если дотягивают до референса 3 (объёмные пушистые ярусы); иначе убираем.

- [ ] **Step 1: Проверка (падает):** `check_island.py`: все узлы из списка есть; треугольников ≤ 150 000; у каждого `Seat_n` прямая к `FirePoint` горизонтальна (±5°) и расстояние 3,0–4,5 м; `Ground` под `Spawn` есть (raycast вниз).
Run → FAIL.
- [ ] **Step 2:** Реализовать `island.py`.
- [ ] **Step 3:** Run `island.py` + `check_island.py` → PASS.
- [ ] **Step 4:** Commit `feat(art): island chunk`.

### Task 4: Сцена и стиль рендера

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/i18n/ru.json`, `src/style/palette.js` (импортирует `art/palette.json`), `src/render/toon.js`, `src/render/outline.js`, `src/world/water.js`, `src/world/campfire.js`, `tools/screenshot.mjs`, `tests/render.test.js`

**Interfaces:**
- Produces: `createToonMaterial(colorKey: string): THREE.MeshToonMaterial` (3-ступенчатая gradient-map, цвет из палитры; неизвестный ключ → ошибка); `applyToonMaterials(root: THREE.Object3D): void` (заменяет материалы по имени слота/материала); `createOutlinePass(renderer, scene, camera, {color, thicknessCssPx}): Pass` — контур по разрывам глубины и нормалей, `thicknessCssPx` по умолчанию 1.5, цвет `outline`; `outlineThicknessPx(cssPx: number, dpr: number): number`; `t(key: string): string` из `ru.json`.
- `tools/screenshot.mjs <url> <out.png> [view]` — Playwright, Chromium с `--use-gl=swiftshader`, ждёт `window.__probeReady === true`.

- [ ] **Step 1: Тесты (падают)** в `tests/render.test.js`:
  - `createToonMaterial('grass').color.getHexString() === 'a8d69a'`; `createToonMaterial('nope')` бросает ошибку.
  - `outlineThicknessPx(1.5, 1) === 1.5`, `outlineThicknessPx(1.5, 2) === 3` (Review Focus 4).
  - `t('probe.micDenied')` возвращает непустую строку.
Run: `npx vitest run tests/render.test.js` → FAIL.
- [ ] **Step 2:** Реализовать. Сцена: небо `sky`, туман `fog`, тёплый направленный свет + мягкий hemisphere, тени у персонажей и деревьев. Вода — плоскость `water` с пенным кольцом `waterFoam` у берега (по глубине) и лёгкой волной. Костёр — пламя шейдером (`fire` → `fireCore`), мерцающий PointLight в `FirePoint`.
- [ ] **Step 3:** Run tests → PASS.
- [ ] **Step 4:** `npm run build && npx vite preview` + `node tools/screenshot.mjs http://localhost:4173 art/build/shot_overview.png overview` — посмотреть снимок: контур на всех объектах, пастель, нет «пластика».
- [ ] **Step 5:** Commit `feat(probe): scene and toon/outline rendering`.

### Task 5: Персонажи в сцене

**Files:**
- Create: `src/character/character.js`, `src/character/variants.js`, `tests/character.test.js`

**Interfaces:**
- Consumes: `character.glb`, `rig.json` (`head`, `eyeHeightCm`), `applyToonMaterials`.
- Produces: `loadCharacter(): Promise<Character>`; `class Character { root; mixer; play(clip: 'idle'|'walk'|'jump'|'crouchIdle'|'crouchWalk'|'sit'); setAppearance({skin, shirt, shorts, hair}: palette keys); setBody({height, width}); eyeHeight(): number /* метры, с учётом setBody */; setMouth(open: 0..1) }`; `bodyScale({height, width}) -> {x, y, z}` — `height` в см (150–200, база 175 → y = height/175), `width` 0.85–1.3 (x = z = width).
- `variants.js`: 3 варианта для пробы — `{height:160,width:1.0, skin1, shirt1, shorts1, hair1}`, `{height:175,width:1.25, skin2, shirt2, shorts2, hair2}`, `{height:195,width:0.9, skin3, shirt3, shorts1, hair1}`.

- [ ] **Step 1: Тесты (падают):** `bodyScale({height:175,width:1})` → `{x:1,y:1,z:1}`; `bodyScale({height:195,width:0.9}).y ≈ 1.114`; значения вне диапазона зажимаются (`height:300` → y = 200/175); `eyeHeight()` после `setBody({height:195})` = `eyeHeightCm/100 * 195/175` (±1 см) (Review Focus 3).
- [ ] **Step 2:** Реализовать; в сцене три персонажа на `Seat_0`, `Seat_3`, `Seat_5` в `sit`, анимации со случайным сдвигом фазы.
- [ ] **Step 3:** Тесты PASS; скриншот `closeup` — три персонажа у костра.
- [ ] **Step 4:** Commit `feat(probe): characters with variants`.

### Task 6: Рот от микрофона

**Files:**
- Create: `src/voice/mouth.js`, `src/voice/mic.js`, `tests/mouth.test.js`

**Interfaces:**
- Produces: `mouthOpenFromLevel(rms: number, prevOpen: number, dt: number): number` — порог шума 0.02 RMS (ниже → цель 0), выше — цель `min(1, (rms-0.02)/0.15)`; сглаживание: открытие за ~60 мс, закрытие за ~120 мс; результат 0..1. `startMic(): Promise<{level(): number, stop()} | null>` — Web Audio AnalyserNode; при отказе/отсутствии микрофона возвращает `null`.

- [ ] **Step 1: Тесты (падают):**
  - тишина: `rms=0.01` много кадров подряд → результат остаётся 0 (Review Focus 2);
  - громкая речь `rms=0.2` в течение 0.1 с от 0 → > 0.8;
  - после речи `rms=0` в течение 0.3 с → < 0.05;
  - результат никогда не выходит за 0..1.
- [ ] **Step 2:** Реализовать. На панели пробы — кнопка «Включить микрофон» (текст из `ru.json`); голос двигает рот персонажа ближе к камере (и своего — в режиме от первого лица его не видно, поэтому в пробе рот показывается на персонаже напротив). При `null` — сообщение `probe.micDenied`, рот закрыт, сцена работает (Review Focus 1).
- [ ] **Step 3:** Тесты PASS.
- [ ] **Step 4:** Commit `feat(probe): mic-driven mouth`.

### Task 7: Режим от первого лица

**Files:**
- Create: `src/player/movement.js`, `src/player/firstPerson.js`, `src/player/input.js`, `tests/movement.test.js`

**Interfaces:**
- Consumes: `Character` (Task 5), узлы `Ground`, `Cliffs`, `WalkBlockers`, `Spawn` (Task 3).
- Produces: `stepMovement(state, input, dt, world): state` — чистая функция; `state = {pos: Vector3, velY: number, yaw, pitch, crouch: boolean, grounded: boolean}`; `input = {forward, back, left, right, jump, crouch, dYaw, dPitch}`; `world = {groundHeightAt(x,z): number|null, blocked(from: Vector3, to: Vector3): boolean}`. Константы: ходьба 3.5 м/с, присед 1.6 м/с, прыжок 5 м/с вверх, гравитация 18 м/с², pitch зажат в ±85°. `enableFirstPerson(character, camera)` — сжимает кость `head` в масштаб 0.001 только у своего персонажа (голова и шея не видны в своей камере), камера крепится к позиции глаз = `eyeHeight()` над ногами по оси персонажа, со сдвигом вперёд 8 см; при приседе опускается вместе с анимацией.

- [ ] **Step 1: Тесты (падают)** в `tests/movement.test.js` (мир-заглушка — ровная земля высотой 0, обрыв: `groundHeightAt` → `null` при x > 10):
  - вперёд 1 с → смещение 3.5 м ±0.05;
  - с `crouch` → 1.6 м;
  - прыжок с земли → через 0.28 с `pos.y` > 0.6, через 0.7 с снова `grounded`;
  - шаг за обрыв (`x` из 9.9 к 10.5) → позиция остаётся ≤ 10 (Review Focus 5);
  - `blocked` возвращает true → позиция не меняется по горизонтали (костёр, Review Focus 5);
  - `pos.y` никогда не ниже `groundHeightAt` под ногами;
  - высокий вариант: камера (`eyeHeight`) у `{height:195}` выше, чем у `{height:160}` (Review Focus 3).
- [ ] **Step 2:** Реализовать `movement.js`; `input.js` — WASD, мышь через Pointer Lock, Space — прыжок, Ctrl или C — присед; анимации своего персонажа переключаются idle/walk/jump/crouchIdle/crouchWalk.
- [ ] **Step 3:** Тесты PASS; скриншот `fpv-down` (камера смотрит вниз: видны туловище, руки, ноги, нет шеи и головы).
- [ ] **Step 4:** Commit `feat(probe): first-person walk`.

### Task 8: Сборка пробы и показ

**Files:**
- Modify: `README.md` (раздел «Проба стиля: как открыть»)

- [ ] **Step 1:** `npx vitest run` и все `art/blender/check_*.py` → всё PASS.
- [ ] **Step 2:** `npm run build`; три скриншота: `overview`, `closeup`, `fpv-down` — одна внимательная проверка глазами по референсам.
- [ ] **Step 3:** Опубликовать `dist/` как артефакт (несколько файлов) и отправить автору ссылку и три скриншота. Если в артефакте браузер не даёт доступ к микрофону, сказать об этом — микрофон проверим в сборке 2 на Cloudflare.
- [ ] **Step 4:** Commit + push `feat(probe): style probe build`.
- [ ] **Step 5:** Ревью автора. Правки собираем в один список и делаем одной сборкой.
