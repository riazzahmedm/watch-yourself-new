// ============================================================
// Media Detail Screen — app/media/[id].tsx
// Reachable from: Discover cards, Library rows, Log Sheet search
//
// Sections:
//   1. Hero — backdrop + title + trailer button
//   2. Quick stats — runtime, release, rating, episodes
//   3. Genre pills
//   4. Synopsis (collapsible)
//   5. Cast horizontal scroll
//   6. Where to Watch (streaming providers)
//   7. Episodes accordion (series only)
//   8. What draws you to this? (interest hook chips)
//   9. Sticky CTA — Log This / Already Logged
// ============================================================

import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Colors, Gradients } from "@/constants/colors";
import { useMediaDetail, type CastMember, type WatchProvider } from "@/hooks/useMediaDetail";
import { useSeasonEpisodes } from "@/hooks/useMediaDetail";
import { useLogs } from "@/hooks/useLogs";

const { width: SW, height: SH } = Dimensions.get("window");
const HERO_HEIGHT = SH * 0.48;
const BLURHASH    = "LGF5?xYk^6#M@-5c,1J5@[or[Q6.";

// ---- Interest hook options ----------------------------------

const INTEREST_HOOKS = [
  { key: "cast",      label: "The Cast",      emoji: "🎭" },
  { key: "premise",   label: "The Premise",   emoji: "💡" },
  { key: "creator",   label: "The Creator",   emoji: "🎬" },
  { key: "studio",    label: "The Studio",    emoji: "🏛️" },
  { key: "franchise", label: "The Franchise", emoji: "🌌" },
  { key: "other",     label: "Something Else",emoji: "✨" },
] as const;

type InterestHookKey = typeof INTEREST_HOOKS[number]["key"];

// ---- Component ----------------------------------------------

export default function MediaDetailScreen() {
  const { id, tmdbId, mediaType, interestHook: presetHook } = useLocalSearchParams<{
    id:           string;
    tmdbId:       string;
    mediaType:    "movie" | "series";
    interestHook?: string;
  }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  // Detect user's locale for watch providers
  const countryCode = Intl.DateTimeFormat().resolvedOptions().locale.split("-")[1]?.toUpperCase() ?? "US";

  const { data, isLoading } = useMediaDetail(
    id ?? null,
    tmdbId ? Number(tmdbId) : null,
    (mediaType as "movie" | "series") ?? "movie",
    countryCode
  );

  const { data: logs } = useLogs(200);
  const alreadyLogged  = (logs ?? []).some((l) => l.mediaId === id);

  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [expandedSeason,   setExpandedSeason]   = useState<number | null>(null);
  const [selectedHook,     setSelectedHook]     = useState<InterestHookKey | null>(
    (presetHook as InterestHookKey) ?? null
  );

  // Derive safe values from data (may be undefined until loaded)
  const media          = data?.media;
  const cast           = data?.cast           ?? [];
  const trailer        = data?.trailer        ?? null;
  const watchProviders = data?.watchProviders ?? { flatrate: [], rent: [], buy: [] };

  // All hooks must be declared before any early return
  const handleLog = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/log-sheet",
      params: {
        preSelectedMediaId:   id,
        preSelectedMediaType: mediaType,
        preSelectedTmdbId:    tmdbId,
        interestHook:         selectedHook ?? "",
      },
    });
  }, [id, mediaType, tmdbId, selectedHook, router]);

  const openTrailer = useCallback(async () => {
    if (!trailer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await WebBrowser.openBrowserAsync(
      `https://www.youtube.com/watch?v=${trailer.youtubeKey}`,
      { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET }
    );
  }, [trailer]);

  // Early return after all hooks
  if (isLoading || !media) {
    return <DetailSkeleton insetTop={insets.top} />;
  }

  const hasProviders =
    watchProviders.flatrate.length > 0 ||
    watchProviders.rent.length > 0 ||
    watchProviders.buy.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────── */}
        <View style={[styles.hero, { height: HERO_HEIGHT }]}>
          <Image
            source={{ uri: media.backdropUrl ?? media.posterUrl ?? undefined }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            placeholder={{ blurhash: BLURHASH }}
            transition={400}
          />
          <LinearGradient
            colors={["transparent", "rgba(8,8,16,0.5)", "#080810"]}
            locations={[0.35, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Trailer button */}
          {trailer && (
            <TouchableOpacity
              style={styles.trailerBtn}
              onPress={openTrailer}
              activeOpacity={0.8}
            >
              <View style={styles.trailerBtnInner}>
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={styles.trailerBtnText}>Trailer</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Title block */}
          <View style={styles.heroTitle}>
            <View style={styles.heroBadges}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {media.mediaType === "series" ? "Series" : "Movie"}
                </Text>
              </View>
              {media.releaseYear && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{media.releaseYear}</Text>
                </View>
              )}
            </View>
            <Text style={styles.title} numberOfLines={2}>{media.title}</Text>
          </View>
        </View>

        {/* ── Quick stats ──────────────────────────────────── */}
        <View style={styles.statsRow}>
          {media.runtimeMinutes != null && (
            <StatChip icon="time-outline" label={formatRuntime(media.runtimeMinutes)} />
          )}
          {media.tmdbRating != null && (
            <StatChip icon="star" label={`${media.tmdbRating.toFixed(1)} TMDB`} color={Colors.starActive} />
          )}
          {media.mediaType === "series" && media.numberOfSeasons != null && (
            <StatChip icon="albums-outline" label={`${media.numberOfSeasons} Season${media.numberOfSeasons !== 1 ? "s" : ""}`} />
          )}
          {media.mediaType === "series" && media.numberOfEpisodes != null && (
            <StatChip icon="list-outline" label={`${media.numberOfEpisodes} Episodes`} />
          )}
        </View>

        {/* ── Genre pills ──────────────────────────────────── */}
        {media.genres.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.genreRow}
          >
            {media.genres.map((g) => (
              <View key={g.id} style={styles.genrePill}>
                <Text style={styles.genreText}>{g.name}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── Synopsis ─────────────────────────────────────── */}
        {media.overview ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Synopsis</Text>
            <Text
              style={styles.synopsis}
              numberOfLines={synopsisExpanded ? undefined : 3}
            >
              {media.overview}
            </Text>
            <TouchableOpacity onPress={() => setSynopsisExpanded((v) => !v)}>
              <Text style={styles.readMore}>
                {synopsisExpanded ? "Show less" : "Read more"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Cast ─────────────────────────────────────────── */}
        {cast.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Top Cast</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.castRow}
            >
              {cast.map((member) => (
                <CastChip key={member.id} member={member} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Where to Watch ───────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Where to Watch</Text>
          {hasProviders ? (
            <>
              {watchProviders.flatrate.length > 0 && (
                <ProviderRow label="Stream" providers={watchProviders.flatrate} />
              )}
              {watchProviders.rent.length > 0 && (
                <ProviderRow label="Rent" providers={watchProviders.rent} />
              )}
              {watchProviders.buy.length > 0 && (
                <ProviderRow label="Buy" providers={watchProviders.buy} />
              )}
            </>
          ) : (
            <Text style={styles.noProviders}>Not currently streaming in your region</Text>
          )}
        </View>

        {/* ── Episodes (series only) ───────────────────────── */}
        {media.mediaType === "series" && media.numberOfSeasons != null && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Episodes</Text>
            {Array.from({ length: media.numberOfSeasons }, (_, i) => i + 1).map((season) => (
              <SeasonRow
                key={season}
                tmdbId={media.tmdbId}
                mediaId={media.id}
                seasonNumber={season}
                expanded={expandedSeason === season}
                onToggle={() => setExpandedSeason((v) => (v === season ? null : season))}
              />
            ))}
          </View>
        )}

        {/* ── What draws you to this? ───────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What draws you to this?</Text>
          <Text style={styles.sectionSubLabel}>Optional — pre-fills your log</Text>
          <View style={styles.hooksGrid}>
            {INTEREST_HOOKS.map((hook) => {
              const active = selectedHook === hook.key;
              return (
                <TouchableOpacity
                  key={hook.key}
                  style={[styles.hookChip, active && styles.hookChipActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedHook(active ? null : hook.key);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.hookEmoji}>{hook.emoji}</Text>
                  <Text style={[styles.hookLabel, active && styles.hookLabelActive]}>
                    {hook.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky CTA ───────────────────────────────────────── */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
        {alreadyLogged ? (
          <View style={styles.ctaRow}>
            <View style={styles.loggedBadge}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.loggedBadgeText}>Logged</Text>
            </View>
            <TouchableOpacity style={styles.logAgainBtn} onPress={handleLog}>
              <Text style={styles.logAgainText}>Log Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.logBtn} onPress={handleLog} activeOpacity={0.85}>
            <LinearGradient
              colors={Gradients.accentDeep}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logBtnGradient}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.logBtnText}>Log This</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ---- Sub-components -----------------------------------------

function StatChip({ icon, label, color }: { icon: string; label: string; color?: string }) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon as never} size={13} color={color ?? Colors.textSecondary} />
      <Text style={[styles.statChipText, color ? { color } : null]}>{label}</Text>
    </View>
  );
}

function CastChip({ member }: { member: CastMember }) {
  return (
    <View style={styles.castChip}>
      <View style={styles.castPhoto}>
        {member.profileUrl ? (
          <Image
            source={{ uri: member.profileUrl }}
            style={styles.castPhoto}
            contentFit="cover"
            placeholder={{ blurhash: BLURHASH }}
          />
        ) : (
          <View style={[styles.castPhoto, styles.castPhotoPlaceholder]}>
            <Ionicons name="person" size={24} color={Colors.textMuted} />
          </View>
        )}
      </View>
      <Text style={styles.castName} numberOfLines={1}>{member.name}</Text>
      {member.character && (
        <Text style={styles.castCharacter} numberOfLines={1}>{member.character}</Text>
      )}
    </View>
  );
}

function ProviderRow({ label, providers }: { label: string; providers: WatchProvider[] }) {
  return (
    <View style={styles.providerSection}>
      <Text style={styles.providerLabel}>{label}</Text>
      <View style={styles.providerLogos}>
        {providers.slice(0, 8).map((p, i) => (
          <View key={i} style={styles.providerLogo}>
            {p.logoUrl ? (
              <Image
                source={{ uri: p.logoUrl }}
                style={styles.providerLogoImg}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.providerLogoImg, styles.providerLogoPlaceholder]}>
                <Text style={styles.providerLogoText} numberOfLines={1}>
                  {p.name.substring(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function SeasonRow({
  tmdbId, mediaId, seasonNumber, expanded, onToggle,
}: {
  tmdbId: number; mediaId: string; seasonNumber: number;
  expanded: boolean; onToggle: () => void;
}) {
  const { data: episodes, isLoading } = useSeasonEpisodes(
    tmdbId, "series", expanded ? seasonNumber : null
  );

  return (
    <View style={styles.seasonRow}>
      <TouchableOpacity style={styles.seasonHeader} onPress={onToggle} activeOpacity={0.8}>
        <Text style={styles.seasonTitle}>Season {seasonNumber}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.episodeList}>
          {isLoading ? (
            <Text style={styles.episodeLoading}>Loading episodes…</Text>
          ) : (
            (episodes ?? []).map((ep) => (
              <View key={ep.id} style={styles.episodeRow}>
                {ep.stillUrl ? (
                  <Image
                    source={{ uri: ep.stillUrl }}
                    style={styles.episodeStill}
                    contentFit="cover"
                    placeholder={{ blurhash: BLURHASH }}
                  />
                ) : (
                  <View style={[styles.episodeStill, styles.episodeStillPlaceholder]}>
                    <Ionicons name="film-outline" size={20} color={Colors.textMuted} />
                  </View>
                )}
                <View style={styles.episodeInfo}>
                  <Text style={styles.episodeNum}>E{ep.episodeNumber}</Text>
                  <Text style={styles.episodeTitle} numberOfLines={1}>
                    {ep.title ?? `Episode ${ep.episodeNumber}`}
                  </Text>
                  {ep.airDate && (
                    <Text style={styles.episodeMeta}>{formatDate(ep.airDate)}</Text>
                  )}
                  {ep.runtimeMins != null && (
                    <Text style={styles.episodeMeta}>{ep.runtimeMins} min</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function DetailSkeleton({ insetTop }: { insetTop: number }) {
  return (
    <View style={styles.container}>
      <View style={[styles.skeletonHero, { height: HERO_HEIGHT }]} />
      <View style={[styles.skeletonBar, { marginTop: 20, width: SW * 0.6, marginLeft: 20 }]} />
      <View style={[styles.skeletonBar, { marginTop: 8,  width: SW * 0.4, marginLeft: 20 }]} />
      <View style={[styles.skeletonBar, { marginTop: 24, width: SW * 0.8, marginLeft: 20, height: 60 }]} />
    </View>
  );
}

// ---- Helpers ------------------------------------------------

function formatRuntime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ---- Styles -------------------------------------------------

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  scroll:       { flex: 1 },

  // Hero
  hero:         { position: "relative", overflow: "hidden" },
  backBtn: {
    position:        "absolute",
    left:            16,
    zIndex:          10,
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  trailerBtn: {
    position: "absolute",
    bottom:   40,
    alignSelf: "center",
  },
  trailerBtnInner: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             6,
    paddingHorizontal: 20,
    paddingVertical:   10,
    borderRadius:      24,
    backgroundColor:   "rgba(255,255,255,0.18)",
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.35)",
  },
  trailerBtnText: {
    color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 0.5,
  },
  heroTitle: {
    position: "absolute",
    bottom:   16,
    left:     20,
    right:    20,
  },
  heroBadges: {
    flexDirection: "row", gap: 6, marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      6,
    backgroundColor:   "rgba(124,106,245,0.4)",
    borderWidth:       1,
    borderColor:       "rgba(124,106,245,0.6)",
  },
  badgeText: {
    color: Colors.accentLight, fontSize: 11, fontWeight: "700",
  },
  title: {
    color: Colors.text, fontSize: 26, fontWeight: "800",
    lineHeight: 30,
  },

  // Stats
  statsRow: {
    flexDirection:  "row",
    flexWrap:       "wrap",
    gap:            8,
    paddingHorizontal: 20,
    paddingTop:     16,
    paddingBottom:  4,
  },
  statChip: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      20,
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  statChipText: {
    color: Colors.textSecondary, fontSize: 12, fontWeight: "600",
  },

  // Genre pills
  genreRow: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, gap: 8,
  },
  genrePill: {
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderRadius:      16,
    backgroundColor:   Colors.surfaceElevated,
    borderWidth:       1,
    borderColor:       Colors.glassBorder,
  },
  genreText: {
    color: Colors.textSecondary, fontSize: 12, fontWeight: "500",
  },

  // Section
  section: {
    paddingHorizontal: 20, paddingTop: 24, gap: 10,
  },
  sectionLabel: {
    color: Colors.text, fontSize: 17, fontWeight: "700",
  },
  sectionSubLabel: {
    color: Colors.textMuted, fontSize: 12, marginTop: -6,
  },

  // Synopsis
  synopsis: {
    color: Colors.textSecondary, fontSize: 14, lineHeight: 22,
  },
  readMore: {
    color: Colors.accent, fontSize: 13, fontWeight: "600",
  },

  // Cast
  castRow:  { gap: 14, paddingBottom: 4 },
  castChip: { alignItems: "center", width: 72 },
  castPhoto: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  castPhotoPlaceholder: {
    alignItems: "center", justifyContent: "center",
  },
  castName: {
    color: Colors.text, fontSize: 11, fontWeight: "600",
    textAlign: "center", marginTop: 6,
  },
  castCharacter: {
    color: Colors.textMuted, fontSize: 10,
    textAlign: "center", marginTop: 2,
  },

  // Providers
  noProviders: {
    color: Colors.textMuted, fontSize: 13,
  },
  providerSection: { gap: 8 },
  providerLabel:   {
    color: Colors.textSecondary, fontSize: 12, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  providerLogos: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  providerLogo:  { },
  providerLogoImg: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  providerLogoPlaceholder: {
    alignItems: "center", justifyContent: "center",
  },
  providerLogoText: {
    color: Colors.textMuted, fontSize: 10, fontWeight: "700",
  },

  // Season / episode
  seasonRow: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    overflow: "hidden", marginBottom: 8,
  },
  seasonHeader: {
    flexDirection:   "row",
    justifyContent:  "space-between",
    alignItems:      "center",
    padding:         14,
    backgroundColor: Colors.surface,
  },
  seasonTitle: {
    color: Colors.text, fontSize: 14, fontWeight: "600",
  },
  episodeList:    { backgroundColor: Colors.background },
  episodeLoading: {
    color: Colors.textMuted, fontSize: 13, padding: 14,
  },
  episodeRow: {
    flexDirection: "row",
    gap:           12,
    padding:       12,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  episodeStill:             { width: 100, height: 56, borderRadius: 6, backgroundColor: Colors.surface },
  episodeStillPlaceholder:  { alignItems: "center", justifyContent: "center" },
  episodeInfo:  { flex: 1, gap: 2 },
  episodeNum:   { color: Colors.textMuted, fontSize: 11, fontWeight: "600" },
  episodeTitle: { color: Colors.text, fontSize: 13, fontWeight: "600" },
  episodeMeta:  { color: Colors.textSecondary, fontSize: 11 },

  // Interest hooks
  hooksGrid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           8,
  },
  hookChip: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              6,
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderRadius:      20,
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  hookChipActive: {
    backgroundColor: Colors.accentDim,
    borderColor:     Colors.accent,
  },
  hookEmoji: { fontSize: 14 },
  hookLabel: {
    color: Colors.textSecondary, fontSize: 13, fontWeight: "500",
  },
  hookLabelActive: { color: Colors.accent },

  // Sticky CTA
  ctaBar: {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    paddingHorizontal: 20,
    paddingTop:      12,
    backgroundColor: "rgba(8,8,16,0.92)",
    borderTopWidth:  1,
    borderTopColor:  Colors.glassBorder,
  },
  ctaRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  loggedBadge: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    paddingHorizontal: 14,
    paddingVertical:   10,
    borderRadius:      12,
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.success + "44",
    flex:              1,
  },
  loggedBadgeText: {
    color: Colors.success, fontSize: 14, fontWeight: "600",
  },
  logAgainBtn: {
    paddingHorizontal: 20,
    paddingVertical:   12,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       Colors.accent,
  },
  logAgainText: {
    color: Colors.accent, fontSize: 14, fontWeight: "600",
  },
  logBtn:         { borderRadius: 16, overflow: "hidden" },
  logBtnGradient: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             8,
    paddingVertical: 14,
    borderRadius:    16,
  },
  logBtnText: {
    color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.3,
  },

  // Skeleton
  skeletonHero: {
    backgroundColor: Colors.surface,
  },
  skeletonBar: {
    height:          16,
    borderRadius:     8,
    backgroundColor: Colors.surface,
  },
});
