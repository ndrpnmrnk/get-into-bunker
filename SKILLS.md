# Скиллы проекта

Источник: видео GitHub Radar «30 инструментов для Claude». Все 30 репозиториев проверены 16.11.2026: существуют, открыты и бесплатны (MIT / Apache-2.0; OpenMontage — AGPL-3.0).

## Установлено в `.claude/skills/` (14 скиллов)

| Скилл | Откуда | Зачем в «Бункере» |
|---|---|---|
| brainstorming | obra/superpowers (MIT) | Сначала обсуждаем идею и дизайн, потом код |
| writing-plans | obra/superpowers | План изменений до реализации |
| executing-plans | obra/superpowers | Реализация плана целиком, одной сборкой |
| systematic-debugging | obra/superpowers | Поиск причины бага, а не угадывание |
| verification-before-completion | obra/superpowers | Одна проверка перед «готово» |
| test-driven-development | obra/superpowers | Тесты для правил игры (раунды, голосование, карты) |
| karpathy-guidelines | multica-ai/andrej-karpathy-skills (MIT) | Точечные правки, без лишнего кода |
| grill-me | mattpocock/skills (MIT) | Допрос по геймдизайну перед стартом (вызов вручную: `/grill-me`) |
| frontend-design | anthropics/skills (Apache-2.0) | Интерфейс без шаблонного вида |
| impeccable | pbakaus/impeccable (Apache-2.0) | Аудит и полировка UI |
| ui-ux-pro-max | nextlevelbuilder/ui-ux-pro-max-skill (MIT) | База стилей, палитр, шрифтов для UI |
| webapp-testing | anthropics/skills (Apache-2.0) | Проверка игры в браузере через Playwright |
| performance-optimization | addyosmani/agent-skills (MIT) | FPS, загрузка, сеть |
| caveman | JuliusBrussee/caveman (Apache-2.0) | Режим экономии токенов (включается `/caveman`, выключается «normal mode») |

Лицензии исходных репозиториев — в `.claude/skills/_licenses/` (karpathy-guidelines — MIT, указано в его SKILL.md).

## Ставить отдельно как плагин (не копируется в репо)

- **claude-mem** (thedotmack/claude-mem, Apache-2.0) — память между сессиями. Работает как плагин с фоновым процессом, ставится в Claude Code через `/plugin`.

## Отложено — пригодится позже

- **Graphify**, **Understand Anything** — карта кода, когда проект вырастет.
- **HyperFrames**, **OpenMontage** — трейлер/промо-видео игры.
- **Marketing Skills**, **Humanizer** — тексты для страницы игры и продвижения.

## Не ставим (пересекаются или не про игру)

- **GSD**, **BMAD Method**, **gstack**, **ECC** (1000+ скиллов), **Agent Skills** целиком — свои фреймворки процесса, дублируют Superpowers и съедают контекст.
- **Matt Pocock Skills** целиком — взят только grill-me.
- **Taste** — заточен под сайты компаний, не под игры.
- **Ponytail**, **Headroom** — экономия токенов, дублирует caveman (Headroom — отдельный прокси-сервис).
- **Agent Reach**, **Last 30 Days**, **Career Ops**, **REA**, **PPT Master**, **Diagram Design**, **Archify**, **I Have ADHD** — не по задачам проекта.
