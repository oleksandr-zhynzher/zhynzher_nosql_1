use("spotify");

// ─────────────────────────────────────────────
// Завдання 1. Треки для вечірки
// danceability > 0.7, energy > 0.7, duration 3–5 хв
// ─────────────────────────────────────────────
print("\n=== Завдання 1: Треки для вечірки ===");
const partyTracks = db.tracks.find(
  {
    "audio_features.danceability": { $gt: 0.7 },
    "audio_features.energy": { $gt: 0.7 },
    duration_ms: { $gte: 180000, $lte: 300000 }
  },
  {
    _id: 0,
    track_name: 1,
    artists: 1,
    "audio_features.danceability": 1,
    "audio_features.energy": 1,
    duration_ms: 1,
    popularity: 1
  }
).limit(10).toArray();
printjson(partyTracks);
print("Знайдено треків:", db.tracks.countDocuments({
  "audio_features.danceability": { $gt: 0.7 },
  "audio_features.energy": { $gt: 0.7 },
  duration_ms: { $gte: 180000, $lte: 300000 }
}));


// ─────────────────────────────────────────────
// Завдання 2. Виконавці, у яких усі треки популярні
// ≥3 треків, мінімальна популярність ≥60
// ─────────────────────────────────────────────
print("\n=== Завдання 2: Артисти з мінімальною популярністю ≥60 (топ-20) ===");
const popularArtists = db.tracks.aggregate([
  { $unwind: "$artists" },
  {
    $group: {
      _id: "$artists",
      track_count: { $sum: 1 },
      min_popularity: { $min: "$popularity" },
      avg_popularity: { $avg: "$popularity" }
    }
  },
  {
    $match: {
      track_count: { $gte: 3 },
      min_popularity: { $gte: 60 }
    }
  },
  {
    $project: {
      _id: 0,
      artist: "$_id",
      track_count: 1,
      min_popularity: 1,
      avg_popularity: { $round: ["$avg_popularity", 1] }
    }
  },
  { $sort: { avg_popularity: -1 } },
  { $limit: 20 }
]).toArray();
printjson(popularArtists);


// ─────────────────────────────────────────────
// Завдання 3. Нетипові треки (outliers по tempo)
// tempo > mean + 2 * stdDev для свого жанру
// ─────────────────────────────────────────────
print("\n=== Завдання 3: Нетипові треки за темпом ===");
const tempoOutliers = db.tracks.aggregate([
  // Крок 1: Розраховуємо середнє та stdDev по кожному жанру
  // і одночасно збираємо всі треки жанру
  {
    $group: {
      _id: "$track_genre",
      avg_tempo: { $avg: "$audio_features.tempo" },
      std_tempo: { $stdDevPop: "$audio_features.tempo" },
      tracks: {
        $push: {
          _id: "$_id",
          track_name: "$track_name",
          popularity: "$popularity",
          artists: "$artists",
          audio_features: { tempo: "$audio_features.tempo" }
        }
      }
    }
  },
  // Крок 2: Додаємо поріг
  {
    $addFields: {
      outlier_threshold: {
        $round: [
          { $add: ["$avg_tempo", { $multiply: [2, "$std_tempo"] }] },
          1
        ]
      }
    }
  },
  // Крок 3: Фільтруємо треки, що перевищують поріг
  {
    $addFields: {
      outlier_tracks: {
        $filter: {
          input: "$tracks",
          as: "t",
          cond: { $gt: ["$$t.audio_features.tempo", "$outlier_threshold"] }
        }
      }
    }
  },
  // Крок 4: Формуємо вивід
  {
    $project: {
      _id: 0,
      genre: "$_id",
      avg_tempo: { $round: ["$avg_tempo", 0] },
      outlier_threshold: 1,
      outlier_tracks: 1
    }
  },
  // Залишаємо тільки жанри, де є аутлаєри
  { $match: { "outlier_tracks.0": { $exists: true } } },
  { $sort: { genre: 1 } }
]).toArray();
printjson(tempoOutliers);


// ─────────────────────────────────────────────
// Завдання 4. Треки для фонової роботи
// loudness < -10, speechiness < 0.1, instrumentalness > 0.5, explicit = false
// ─────────────────────────────────────────────
print("\n=== Завдання 4: Треки для фонової роботи ===");
const workTracks = db.tracks.find(
  {
    "audio_features.loudness": { $lt: -10 },
    "audio_features.speechiness": { $lt: 0.1 },
    "audio_features.instrumentalness": { $gt: 0.5 },
    explicit: false
  },
  {
    _id: 0,
    track_name: 1,
    artists: 1,
    "audio_features.loudness": 1,
    "audio_features.speechiness": 1,
    "audio_features.instrumentalness": 1,
    popularity: 1
  }
).limit(10).toArray();
printjson(workTracks);
print("Знайдено треків:", db.tracks.countDocuments({
  "audio_features.loudness": { $lt: -10 },
  "audio_features.speechiness": { $lt: 0.1 },
  "audio_features.instrumentalness": { $gt: 0.5 },
  explicit: false
}));
