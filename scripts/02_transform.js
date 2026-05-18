use("spotify");

db.tracks.drop();

db.tracks_raw.aggregate([
  // Крок 1: Проєкція — залишаємо тільки потрібні поля
  {
    $project: {
      _id: 1,
      track_id: 1,
      track_name: 1,
      album_name: 1,
      explicit: 1,
      popularity: 1,
      duration_ms: 1,
      track_genre: 1,
      artists_raw: "$artists",
      // Аудіо-фічі залишаємо тимчасово для наступного кроку
      danceability: 1,
      energy: 1,
      loudness: 1,
      speechiness: 1,
      acousticness: 1,
      instrumentalness: 1,
      liveness: 1,
      valence: 1,
      tempo: 1,
      key: 1,
      mode: 1,
      time_signature: 1
    }
  },

  // Крок 2: Формуємо вкладені об'єкти та обчислювані поля
  {
    $addFields: {
      // Розбиваємо рядок артистів по ";" та прибираємо пробіли
      artists: {
        $map: {
          input: { $split: ["$artists_raw", ";"] },
          as: "a",
          in: { $trim: { input: "$$a" } }
        }
      },
      // Вкладений об'єкт з аудіо-характеристиками
      audio_features: {
        danceability: "$danceability",
        energy: "$energy",
        loudness: "$loudness",
        speechiness: "$speechiness",
        acousticness: "$acousticness",
        instrumentalness: "$instrumentalness",
        liveness: "$liveness",
        valence: "$valence",
        tempo: "$tempo",
        key: "$key",
        mode: "$mode",
        time_signature: "$time_signature"
      },
      // Тривалість у секундах, округлена до 1 знака
      duration_sec: {
        $round: [{ $divide: ["$duration_ms", 1000] }, 1]
      },
      // Рівень популярності
      popularity_tier: {
        $switch: {
          branches: [
            { case: { $gte: ["$popularity", 70] }, then: "high" },
            {
              case: {
                $and: [
                  { $gte: ["$popularity", 40] },
                  { $lt: ["$popularity", 70] }
                ]
              },
              then: "medium"
            }
          ],
          default: "low"
        }
      }
    }
  },

  // Крок 3: Прибираємо зайві поля
  {
    $unset: [
      "artists_raw",
      "danceability", "energy", "loudness", "speechiness",
      "acousticness", "instrumentalness", "liveness", "valence",
      "tempo", "key", "mode", "time_signature"
    ]
  },

  // Крок 4: Зберігаємо результат у колекцію tracks
  { $out: "tracks" }
]);

print("Документів у tracks:", db.tracks.countDocuments());
print("Приклад документа:");
printjson(db.tracks.findOne());
