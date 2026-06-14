# DocBratus — сайт и приложение доктора Братуся

Монорепозиторий двух проектов под единым брендом **DocBratus** (врач-реабилитолог
Братусь Михаил Андреевич, Москва).

## Структура

```
/
├── site/        Сайт-визитка — одностраничный лендинг (HTML/CSS/JS)
│   ├── index.html
│   └── INSTRUCTION.md
└── rehabapp/    Конструктор протоколов реабилитации (React 19 + TS + Vite 6)
    ├── src/             App.tsx, db.ts, DatabaseModal.tsx, firebaseAuth.ts
    ├── server.ts        Express + ИИ-эндпоинт Gemini (/api/parseProtocol)
    └── .env.example     шаблон для GEMINI_API_KEY (реальный ключ — в .env, не в git)
```

## 1. Сайт-визитка (`/site`)

Готов. Одностраничный лендинг: запись на приём, акцент на болях в спине и плече,
блок «До/После», отзывы пациентов, контакты. Чистый HTML/CSS/JS без сборки —
разворачивается на GitHub Pages или Netlify. См. [site/INSTRUCTION.md](site/INSTRUCTION.md).

## 2. Rehabapp (`/rehabapp`)

Веб-приложение для генерации печатных протоколов реабилитации (А4 landscape) с фото
упражнений, QR-кодами и ИИ-сборкой из текста (Google Gemini). Стек: React 19 +
TypeScript + Vite 6 + Tailwind 4 + Firebase (авторизация).

### Запуск локально

```bash
cd rehabapp
npm install
# создайте файл .env (он в .gitignore) на основе .env.example:
#   GEMINI_API_KEY="ваш-ключ"
#   APP_URL="http://localhost:3000"
npm run dev          # http://localhost:3000
```

Прод-сборка: `npm run build` → `npm start`.

> **Безопасность:** `GEMINI_API_KEY` — серверный секрет, хранится только в `.env`
> (игнорируется git) и никогда не коммитится. Firebase Web-конфиг
> (`firebase-applet-config.json`) — клиентский идентификатор проекта, не секрет.

## Единый бренд

Оба проекта используют один источник правды о враче, общую палитру (navy + голубой),
единые контакты и QR. Сайт — точка входа для пациентов; протоколы Rehabapp ведут
обратно в Telegram/запись (виральность).

**Контакты:** Telegram [@Doc_Bratus](https://t.me/Doc_Bratus) · +7 965 761-65-43
