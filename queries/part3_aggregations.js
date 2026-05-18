use("spotify");

// ─────────────────────────────────────────────
// Завдання 1. Топ-10 виконавців за середньою популярністю
// Враховуємо лише виконавців із ≥5 треків
// ─────────────────────────────────────────────
print("\n=== Завдання 1: Топ-10 виконавців за середньою популярністю ===");
const topArtists = db.tracks.aggregate([
  { $unwind: "$artists" },
  {
    $group: {
      _id: "$artists",
      track_count: { $sum: 1 },
      avg_popularity: { $avg: "$popularity" }
    }
  },
  { $match: { track_count: { $gte: 5 } } },
  { $sort: { avg_popularity: -1 } },
  { $limit: 10 },
  {
    $project: {
      _id: 0,
      artist: "$_id",
      track_count: 1,
      avg_popularity: { $round: ["$avg_popularity", 1] }
    }
  }
]).toArray();
printjson(topArtists);


// ─────────────────────────────────────────────
// Завдання 2. Розподіл треків за настроєм
// valence + energy → happy / angry / calm / sad
// ─────────────────────────────────────────────
print("\n=== Завдання 2: Розподіл треків за настроєм ===");
const moodDistribution = db.tracks.aggregate([
  // Присвоюємо настрій кожному треку
  {
    $addFields: {
      mood: {
        $switch: {
          branches: [
            {
              case: {
                $and: [
                  { $gte: ["$audio_features.valence", 0.5] },
                  { $gte: ["$audio_features.energy", 0.5] }
                ]
              },
              then: "happy"
            },
            {
              case: {
                $and: [
                  { $lt: ["$audio_features.valence", 0.5] },
                  { $gte: ["$audio_features.energy", 0.5] }
                ]
              },
              then: "angry"
            },
            {
              case: {
                $and: [
                  { $gte: ["$audio_features.valence", 0.5] },
                  { $lt: ["$audio_features.energy", 0.5] }
                ]
              },
              then: "calm"
            }
          ],
          default: "sad"
        }
      }
    }
  },
  {
    $group: {
      _id: "$mood",
      count: { $sum: 1 }
    }
  },
  {
    $project: {
      _id: 0,
      mood: "$_id",
      count: 1
    }
  },
  { $sort: { count: -1 } }
]).toArray();
printjson(moodDistribution);


// ─────────────────────────────────────────────
// Завдання 3. Найбільш «танцювальний» жанр
// Групування по жанру, середні danceability / energy / valence
// Фільтр: жанри з ≥100 треків
// ─────────────────────────────────────────────
print("\n=== Завдання 3: Найбільш танцювальний жанр ===");
const topDanceGenres = db.tracks.aggregate([
  {
    $group: {
      _id: "$track_genre",
      avg_danceability: { $avg: "$audio_features.danceability" },
      avg_energy: { $avg: "$audio_features.energy" },
      avg_valence: { $avg: "$audio_features.valence" },
      track_count: { $sum: 1 }
    }
  },
  { $match: { track_count: { $gte: 100 } } },
  {
    $project: {
      _id: 0,
      genre: "$_id",
      avg_danceability: { $round: ["$avg_danceability", 3] },
      avg_energy: { $round: ["$avg_energy", 3] },
      avg_valence: { $round: ["$avg_valence", 3] },
      track_count: 1
    }
  },
  { $sort: { avg_danceability: -1 } }
]).toArray();
printjson(topDanceGenres);
