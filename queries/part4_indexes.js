use("spotify");

// Допоміжна функція: друкує ключові метрики плану виконання з explain("executionStats").
// Саме за цими полями ми робимо висновок, який план обрала MongoDB і чи використано індекс.
function explainSummary(label, cursor) {
  const exp = cursor.explain("executionStats");
  const plan = exp.queryPlanner.winningPlan;
  const es = exp.executionStats;

  // Збираємо ланцюжок стадій від кореня плану до листка (напр. FETCH -> IXSCAN).
  const stages = [];
  let s = plan;
  while (s) {
    stages.push(s.stage);
    s = s.inputStage;
  }

  // Знаходимо стадію IXSCAN (якщо є), щоб дізнатися ім'я використаного індексу.
  let ixscan = plan;
  while (ixscan && ixscan.stage !== "IXSCAN") ixscan = ixscan.inputStage;

  print(label);
  print("  Ланцюжок стадій     :", stages.join(" -> "));
  print("  Індекс              :", ixscan ? ixscan.indexName : "—  (COLLSCAN, індекс не використано)");
  print("  nReturned           :", es.nReturned);
  print("  totalKeysExamined   :", es.totalKeysExamined);
  print("  totalDocsExamined   :", es.totalDocsExamined);
  print("  executionTimeMillis :", es.executionTimeMillis);
  return exp;
}

// ─────────────────────────────────────────────
// Завдання 1. Аналіз запиту та індексація
// Запит поєднує точний збіг (track_genre) + діапазон (danceability) + сортування (popularity).
// ─────────────────────────────────────────────

print("\n========== ЗАВДАННЯ 1 ==========");

print("\n--- explain() ДО створення індексу ---");
const before = explainSummary(
  "Запит без індексу:",
  db.tracks
    .find({ track_genre: "pop", "audio_features.danceability": { $gte: 0.7 } })
    .sort({ popularity: -1 })
);
print("  winningPlan:");
printjson(before.queryPlanner.winningPlan);

// Складений індекс під фільтрацію та сортування цього запиту.
db.tracks.createIndex(
  { track_genre: 1, "audio_features.danceability": 1, popularity: -1 },
  { name: "genre_danceability_popularity" }
);
print("\nІндекс genre_danceability_popularity створено.");

print("\n--- explain() ПІСЛЯ створення індексу ---");
const after = explainSummary(
  "Запит з індексом:",
  db.tracks
    .find({ track_genre: "pop", "audio_features.danceability": { $gte: 0.7 } })
    .sort({ popularity: -1 })
);
print("  winningPlan:");
printjson(after.queryPlanner.winningPlan);

// ─────────────────────────────────────────────
// Завдання 2. Складений індекс для пошуку музики для роботи
// Поля з умови задачі: instrumentalness, speechiness, explicit.
// ─────────────────────────────────────────────

print("\n========== ЗАВДАННЯ 2 ==========");

db.tracks.createIndex(
  {
    "audio_features.instrumentalness": 1,
    "audio_features.speechiness": 1,
    explicit: 1
  },
  { name: "work_music_index" }
);
print("Індекс work_music_index створено.");

print("");
const work = explainSummary(
  "Пошук музики для роботи:",
  db.tracks.find({
    "audio_features.instrumentalness": { $gt: 0.5 },
    "audio_features.speechiness": { $lt: 0.1 },
    explicit: false
  })
);
print("  winningPlan:");
printjson(work.queryPlanner.winningPlan);

// ─────────────────────────────────────────────
// Завдання 3. Аналіз покривного запиту (covered query)
// Індекс genre_danceability_popularity із Завдання 1 уже існує.
// ─────────────────────────────────────────────

print("\n========== ЗАВДАННЯ 3 ==========");

// Запит у тому вигляді, як він наведений в умові — БЕЗ проєкції.
// Очікуємо стадію FETCH і totalDocsExamined > 0  =>  запит НЕ покривний.
print("\n--- Запит з умови (без проєкції) ---");
const covA = explainSummary(
  "find({track_genre:'pop', popularity:{$gte:70}}):",
  db.tracks.find({ track_genre: "pop", popularity: { $gte: 70 } })
);
print("  => totalDocsExamined =", covA.executionStats.totalDocsExamined,
      "=> Покривний?", covA.executionStats.totalDocsExamined === 0 ? "ТАК" : "НІ (є стадія FETCH)");

// Той самий запит, але з проєкцією лише на індексовані поля та з виключенням _id.
// Очікуємо стадію PROJECTION_COVERED і totalDocsExamined = 0  =>  запит ПОКРИВНИЙ.
print("\n--- Той самий запит з проєкцією {_id:0, track_genre:1, popularity:1} ---");
const covB = explainSummary(
  "find(..., {_id:0, track_genre:1, popularity:1}):",
  db.tracks.find(
    { track_genre: "pop", popularity: { $gte: 70 } },
    { _id: 0, track_genre: 1, popularity: 1 }
  )
);
print("  => totalDocsExamined =", covB.executionStats.totalDocsExamined,
      "=> Покривний?", covB.executionStats.totalDocsExamined === 0 ? "ТАК (PROJECTION_COVERED)" : "НІ");

// Контрприклад: якщо НЕ виключити _id, покриття ламається (бо _id немає в цьому індексі).
print("\n--- Контрприклад: проєкція з _id ({track_genre:1, popularity:1}) ---");
const covC = explainSummary(
  "find(..., {track_genre:1, popularity:1}) (з _id):",
  db.tracks.find(
    { track_genre: "pop", popularity: { $gte: 70 } },
    { track_genre: 1, popularity: 1 }
  )
);
print("  => totalDocsExamined =", covC.executionStats.totalDocsExamined,
      "=> Покривний?", covC.executionStats.totalDocsExamined === 0 ? "ТАК" : "НІ (FETCH через _id)");
