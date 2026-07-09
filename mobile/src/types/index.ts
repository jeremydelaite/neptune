export type MediaType = "MOVIE" | "TV";
export type TrackStatus = "TO_WATCH" | "WATCHING" | "COMPLETED" | "DROPPED";

// Sous-ensemble utile des réponses TMDB
export interface TmdbMedia {
  id: number;
  title?: string;        // films
  name?: string;         // séries
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  popularity?: number;
  overview: string;
  genre_ids?: number[];
}

export interface TrackedItem {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  status: TrackStatus;
  addedAt: string;
}

export interface UserComment {
  id: string;
  content: string;
  createdAt: string;
  user: { username: string; avatarUrl: string | null };
}
