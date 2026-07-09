// FICHE DÉTAIL film/série : bannière, statut, note, saisons (séries)
import { useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { ArrowLeft, Star } from "lucide-react-native";
import { api, tmdbImage } from "../../../src/services/api";
import { StatusButtons } from "../../../src/components/media/StatusButtons";
import { StarRating } from "../../../src/components/ui/StarRating";
import { SeasonList, epKey, type TmdbSeason } from "../../../src/components/media/SeasonList";
import { colors } from "../../../src/theme/colors";
import { fonts, radius } from "../../../src/theme/typography";
import type { MediaType, TrackStatus } from "../../../src/types";

interface MediaDetail {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  runtime?: number;
  genres: { id: number; name: string }[];
  seasons?: TmdbSeason[];
}

interface WatchedEp {
  seasonNumber: number;
  episodeNumber: number;
}

export default function MediaDetailScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const router = useRouter();
  const mediaType: MediaType = type === "tv" ? "TV" : "MOVIE";
  const tmdbId = Number(id);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const [data, setData] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TrackStatus | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [watched, setWatched] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([
        api.get<MediaDetail>(`/tmdb/${type}/${id}`),
        api
          .get<{ tmdbId: number; mediaType: MediaType; status: TrackStatus }[]>("/library")
          .catch(() => [] as { tmdbId: number; mediaType: MediaType; status: TrackStatus }[]),
        api
          .get<{ myScore: number | null }>(`/ratings/${type}/${id}`)
          .catch(() => ({ myScore: null })),
        mediaType === "TV"
          ? api.get<WatchedEp[]>(`/episodes/${id}`).catch(() => [] as WatchedEp[])
          : Promise.resolve<WatchedEp[]>([]),
      ])
        .then(([detail, library, rating, eps]) => {
          if (!active) return;
          setData(detail);
          const tracked = library.find(
            (l) => l.tmdbId === tmdbId && l.mediaType === mediaType
          );
          setStatus(tracked?.status ?? null);
          setMyScore(rating.myScore ?? 0);
          setWatched(new Set(eps.map((e) => epKey(e.seasonNumber, e.episodeNumber))));
        })
        .catch(() => active && setData(null))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [type, id])
  );

  async function selectStatus(next: TrackStatus) {
    if (next === status) {
      setStatus(null); // retire de la bibliothèque
      await api.delete(`/library/${mediaType}/${tmdbId}`).catch(() => {});
    } else {
      setStatus(next);
      await api.post("/library", { tmdbId, mediaType, status: next }).catch(() => {});
    }
  }

  async function rate(score: number) {
    setMyScore(score);
    await api.put("/ratings", { tmdbId, mediaType, score }).catch(() => {});
  }

  async function toggleEpisode(season: number, ep: number, runtime: number | null) {
    const k = epKey(season, ep);
    setWatched((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
    await api
      .post("/episodes/toggle", {
        tmdbShowId: tmdbId,
        seasonNumber: season,
        episodeNumber: ep,
        ...(runtime ? { runtimeMin: runtime } : {}),
      })
      .catch(() => {});
  }

  async function markSeason(
    season: number,
    episodes: { episodeNumber: number; runtimeMin?: number }[]
  ) {
    setWatched((prev) => {
      const n = new Set(prev);
      episodes.forEach((e) => n.add(epKey(season, e.episodeNumber)));
      return n;
    });
    await api
      .post("/episodes/season", { tmdbShowId: tmdbId, seasonNumber: season, episodes })
      .catch(() => {});
  }

  async function unmarkSeason(season: number) {
    const toRemove: number[] = [];
    setWatched((prev) => {
      const n = new Set(prev);
      [...prev]
        .filter((k) => k.startsWith(`${season}-`))
        .forEach((k) => {
          toRemove.push(Number(k.split("-")[1]));
          n.delete(k);
        });
      return n;
    });
    for (const ep of toRemove) {
      await api
        .post("/episodes/toggle", { tmdbShowId: tmdbId, seasonNumber: season, episodeNumber: ep })
        .catch(() => {});
    }
  }

  // Marque comme vus tous les épisodes jusqu'à (targetSeason, maxEp) inclus.
  // maxEp = null => saison entière. Inclut les saisons régulières antérieures.
  async function markUpTo(targetSeason: number, maxEp: number | null) {
    const targets = (data?.seasons ?? []).filter(
      (s) => s.episode_count > 0 && s.season_number >= 1 && s.season_number <= targetSeason
    );
    const addKeys: string[] = [];
    for (const s of targets) {
      let eps: { episode_number: number; runtime: number | null }[];
      try {
        const res = await api.get<{ episodes: { episode_number: number; runtime: number | null }[] }>(
          `/tmdb/tv/${tmdbId}/season/${s.season_number}`
        );
        eps = res.episodes;
      } catch {
        continue;
      }
      const filtered =
        s.season_number === targetSeason && maxEp != null
          ? eps.filter((e) => e.episode_number <= maxEp)
          : eps;
      if (filtered.length === 0) continue;
      await api
        .post("/episodes/season", {
          tmdbShowId: tmdbId,
          seasonNumber: s.season_number,
          episodes: filtered.map((e) => ({
            episodeNumber: e.episode_number,
            runtimeMin: e.runtime ?? undefined,
          })),
        })
        .catch(() => {});
      filtered.forEach((e) => addKeys.push(epKey(s.season_number, e.episode_number)));
    }
    setWatched((prev) => {
      const n = new Set(prev);
      addKeys.forEach((k) => n.add(k));
      return n;
    });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Impossible de charger cette fiche.</Text>
        <Pressable onPress={goBack} style={styles.backInline}>
          <Text style={styles.backInlineText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const title = data.title ?? data.name ?? "";
  const year = (data.release_date ?? data.first_air_date ?? "").slice(0, 4);
  const backdrop = tmdbImage(data.backdrop_path, "w780");
  const seasons = (data.seasons ?? []).filter((s) => s.episode_count > 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Bannière */}
        <View style={styles.banner}>
          {backdrop && (
            <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
          <LinearGradient
            colors={["rgba(15,17,21,0.2)", "rgba(15,17,21,0.65)", colors.bg]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable style={styles.back} onPress={goBack} hitSlop={10}>
            <ArrowLeft size={22} color="#fff" />
          </Pressable>
          <View style={styles.bannerText}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.metaRow}>
              {!!year && <Text style={styles.meta}>{year}</Text>}
              <View style={styles.voteBadge}>
                <Star size={12} color={colors.accent} fill={colors.accent} />
                <Text style={styles.voteText}>{`${(data.vote_average / 2).toFixed(1)} /5`}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Genres */}
          {data.genres.length > 0 && (
            <View style={styles.genres}>
              {data.genres.map((g) => (
                <View key={g.id} style={styles.genre}>
                  <Text style={styles.genreText}>{g.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Statut (dont "À voir" = plus tard) */}
          <StatusButtons mediaType={mediaType} status={status} onSelect={selectStatus} />

          {/* Note perso */}
          <View style={styles.rateBlock}>
            <Text style={styles.sectionLabel}>Ma note</Text>
            <StarRating value={myScore} onChange={rate} />
          </View>

          {/* Synopsis */}
          {!!data.overview && (
            <>
              <Text style={styles.sectionLabel}>Synopsis</Text>
              <Text style={styles.overview}>{data.overview}</Text>
            </>
          )}

          {/* Saisons (séries) */}
          {mediaType === "TV" && seasons.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 22 }]}>Saisons</Text>
              <SeasonList
                showId={tmdbId}
                seasons={seasons}
                watched={watched}
                onToggle={toggleEpisode}
                onMarkSeason={markSeason}
                onUnmarkSeason={unmarkSeason}
                onMarkUpTo={markUpTo}
              />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", gap: 14 },
  error: { fontFamily: fonts.body, fontSize: 14, color: colors.dim },
  backInline: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.surface },
  backInlineText: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.accentPastel },

  banner: { height: 300, justifyContent: "flex-end", backgroundColor: colors.surface },
  back: {
    position: "absolute",
    top: 44,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(15,17,21,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: { padding: 16 },
  title: { fontFamily: fonts.heading, fontSize: 26, color: "#fff" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 13, color: "#E5E7EB" },
  voteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(15,17,21,0.6)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  voteText: { fontFamily: fonts.headingSemi, fontSize: 12, color: "#fff" },

  body: { padding: 16 },
  genres: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  genre: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  genreText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.accentPastel },

  rateBlock: { marginBottom: 18, alignItems: "flex-start", gap: 10 },
  sectionLabel: { fontFamily: fonts.heading, fontSize: 14, color: colors.text, marginBottom: 8 },
  overview: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.dim, marginBottom: 4 },
});
