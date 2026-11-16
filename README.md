# Get Into Bunker

Игра по мотивам настольной игры «Бункер». Концепция — в процессе.

## Скиллы для Claude Code

Папка `.claude/skills/` подхватывается Claude Code автоматически при работе в этом репозитории.
Полный разбор 30 инструментов из видео GitHub Radar и почему выбраны именно эти — в [SKILLS.md](SKILLS.md).

## Проба стиля: как открыть

```bash
npm install
npm run dev        # http://localhost:5173 — обзор, «У костра», «От первого лица», микрофон
npm test           # тесты логики (материалы, тело, рот, движение)
```

3D-ассеты собираются скриптами Blender (нужен `pip install bpy==5.3.0` и распакованная Quaternius UAL в `art/vendor/ual/`):

```bash
cd art/blender
python3 rig.py && python3 character.py && python3 island.py
python3 check_rig.py && python3 check_character.py && python3 check_island.py
```
