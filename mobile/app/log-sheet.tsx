// ============================================================
// Log Sheet — app/log-sheet.tsx
// 4-step modal flow:
//   Step 1: Search (or skipped if pre-selected from media detail)
//   Step 2: Pre-watch mood check-in (evocative question)
//   Step 3: Log form (stamp · platform · cast · review · date)
//   Step 4: Post-watch check-in (non-blocking overlay after submit)
// ============================================================

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { toast } from "sonner-native";

import { Colors, Gradients } from "@/constants/colors";
import { useSearch, type SearchResult } from "@/hooks/useSearch";
import { useCreateLog, type LogEntry } from "@/hooks/useLogs";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/lib/supabase";
import {
  getRandomMoodQuestion,
  type MoodQuestion,
  type MoodQuestionOption,
} from "@/hooks/useMoodQuestion";
import { useMediaDetail, useSeasonEpisodes, type CastMember, type Episode } from "@/hooks/useMediaDetail";
import {
  ENERGY_OPTIONS,
  MIND_OPTIONS,
  useResolveEmotion,
} from "@/hooks/useResolveEmotion";

const { width: SW } = Dimensions.get("window");
const BLURHASH = "LGF5?xYk^6#M@-5c,1J5@[or[Q6.";

// ---- Constants ----------------------------------------------

const REACTION_STAMPS = [
  { key: "meh",          label: "Meh",          emoji: "😑", color: "#44445a", large: false },
  { key: "decent",       label: "Decent",       emoji: "👌", color: "#6ea8fe", large: false },
  { key: "liked_it",     label: "Liked It",     emoji: "😊", color: "#86efac", large: false },
  { key: "loved_it",     label: "Loved It",     emoji: "❤️",  color: "#f87171", large: false },
  { key: "mind_shifted", label: "Mind-Shifted", emoji: "🤯", color: "#c084fc", large: false },
  { key: "life_film",    label: "Life Film",    emoji: "🎖️", color: "#facc15", large: true  },
] as const;

type StampKey = typeof REACTION_STAMPS[number]["key"];

const PLATFORMS = [
  { key: "netflix",     label: "Netflix",    emoji: "🎬" },
  { key: "prime",       label: "Prime",      emoji: "📦" },
  { key: "disney_plus", label: "Disney+",    emoji: "🏰" },
  { key: "apple_tv",    label: "Apple TV+",  emoji: "🍎" },
  { key: "hbo_max",     label: "HBO Max",    emoji: "📺" },
  { key: "hulu",        label: "Hulu",       emoji: "🟢" },
  { key: "youtube",     label: "YouTube",    emoji: "▶️"  },
  { key: "cinema",      label: "Cinema",     emoji: "🎞️" },
  { key: "tv",          label: "Live TV",    emoji: "📡" },
  { key: "other",       label: "Other",      emoji: "🔗" },
  { key: "unofficial",  label: "Unofficial", emoji: "👁️" },
] as const;

type PlatformKey = typeof PLATFORMS[number]["key"];

const INTEREST_HOOKS = [
  { key: "cast",      label: "Cast",      emoji: "🎭" },
  { key: "premise",   label: "Premise",   emoji: "💡" },
  { key: "creator",   label: "Creator",   emoji: "🎬" },
  { key: "studio",    label: "Studio",    emoji: "🏛️" },
  { key: "franchise", label: "Franchise", emoji: "🌌" },
  { key: "other",     label: "Other",     emoji: "✨" },
] as const;

type InterestHookKey = typeof INTEREST_HOOKS[number]["key"];

type Step = 1 | 2 | 3;

interface SelectedMedia {
  id:          string;
  tmdbId:      number;
  title:       string;
  posterUrl:   string | null;
  releaseYear: number | null;
  mediaType:   "movie" | "series";
}

// ============================================================
// Root component
// ============================================================

export default function LogSheet() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    preSelectedMediaId?:   string;
    preSelectedTmdbId?:    string;
    preSelectedMediaType?: string;
    interestHook?:         string;
  }>();

  const preSelected: SelectedMedia | null = params.preSelectedMediaId
    ? {
        id:          params.preSelectedMediaId,
        tmdbId:      Number(params.preSelectedTmdbId ?? "0"),
        title:       "",
        posterUrl:   null,
        releaseYear: null,
        mediaType:   (params.preSelectedMediaType ?? "movie") as "movie" | "series",
      }
    : null;

  const [step,          setStep]          = useState<Step>(preSelected ? 2 : 1);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(preSelected);
  const [moodQuestion,  setMoodQuestion]  = useState<MoodQuestion>(() => getRandomMoodQuestion());
  const [preEmotion,    setPreEmotion]    = useState<{
    slug: string; questionId: string; answer: string;
  } | null>(null);

  // Episode / season selection (series only)
  const [selectedSeason,    setSelectedSeason]    = useState<number | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [selectedEpisodeSeason, setSelectedEpisodeSeason] = useState<number | null>(null);

  // Log form state
  const [stamp,        setStamp]        = useState<StampKey | null>(null);
  const [platform,     setPlatform]     = useState<PlatformKey | null>(null);
  const [interestHook, setInterestHook] = useState<InterestHookKey | null>(
    (params.interestHook as InterestHookKey) ?? null
  );
  const [favCastId,    setFavCastId]    = useState<string | null>(null);
  const [review,       setReview]       = useState("");
  const [watchedAt,    setWatchedAt]    = useState<"today" | "yesterday" | "other">("today");
  const [customDate,   setCustomDate]   = useState("");
  const [isRewatch,    setIsRewatch]    = useState(false);
  const [isPrivate,    setIsPrivate]    = useState(false);

  // Post-watch check-in
  const [showPostCheckin, setShowPostCheckin] = useState(false);
  const [submittedLogId,  setSubmittedLogId]  = useState<string | null>(null);
  const [energyLevel,     setEnergyLevel]     = useState<number | null>(null);
  const [mindLevel,       setMindLevel]       = useState<number | null>(null);

  const createLog      = useCreateLog();
  const resolveEmotion = useResolveEmotion();
  const { user }       = useAuthStore();

  // Prefetch media detail as soon as we have any selected media.
  // Using selectedMedia (which covers both search-selected and pre-selected paths)
  // means the fetch starts at Step 1 selection, so data is ready by Step 3.
  // Step3LogForm uses the same query key → gets instant cache hit.
  const { data: preDetail } = useMediaDetail(
    selectedMedia?.id   ?? null,
    selectedMedia?.tmdbId ?? null,
    selectedMedia?.mediaType ?? "movie"
  );

  useEffect(() => {
    if (preDetail?.media && selectedMedia && !selectedMedia.title) {
      setSelectedMedia({
        id:          preDetail.media.id,
        tmdbId:      preDetail.media.tmdbId,
        title:       preDetail.media.title,
        posterUrl:   preDetail.media.posterUrl,
        releaseYear: preDetail.media.releaseYear,
        mediaType:   preDetail.media.mediaType,
      });
    }
  }, [preDetail]);

  const handleMediaSelect = useCallback((result: SearchResult) => {
    setSelectedMedia({
      id:          result.id,
      tmdbId:      result.tmdbId,
      title:       result.title,
      posterUrl:   result.posterUrl,
      releaseYear: result.releaseYear,
      mediaType:   result.mediaType,
    });
    setStep(2);
    setMoodQuestion(getRandomMoodQuestion());
  }, []);

  const handlePreMoodSelect = useCallback(
    (option: MoodQuestionOption) => {
      setPreEmotion({
        slug:       option.emotionSlug,
        questionId: moodQuestion.id,
        answer:     option.label,
      });
      setTimeout(() => setStep(3), 300);
    },
    [moodQuestion]
  );

  const getWatchedAtDate = useCallback((): string => {
    if (watchedAt === "today") return new Date().toISOString().split("T")[0];
    if (watchedAt === "yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    }
    return customDate || new Date().toISOString().split("T")[0];
  }, [watchedAt, customDate]);

  const handleSubmit = useCallback(async () => {
    if (!selectedMedia || !user) return;

    let preEmotionId: string | undefined;
    if (preEmotion) {
      const { data } = await supabase
        .from("emotions")
        .select("id")
        .eq("slug", preEmotion.slug)
        .single();
      preEmotionId = data?.id;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const derivedLogType: LogEntry["logType"] =
      selectedMedia.mediaType === "movie" ? "movie"
        : selectedEpisodeId ? "series_episode"
        : selectedSeason    ? "series_season"
        : "series_full";

    const derivedSeasonNumber =
      selectedEpisodeId ? selectedEpisodeSeason : selectedSeason;

    createLog.mutate(
      {
        mediaId:             selectedMedia.id,
        logType:             derivedLogType,
        episodeId:           selectedEpisodeId ?? undefined,
        seasonNumber:        derivedSeasonNumber ?? undefined,
        watchedAt:           getWatchedAtDate(),
        reactionStamp:       stamp ?? undefined,
        watchPlatform:       platform ?? undefined,
        interestHook:        interestHook ?? undefined,
        preWatchEmotionId:   preEmotionId,
        preWatchAnswer:      preEmotion?.answer,
        favoriteCastId:      favCastId ?? undefined,
        review:              review.trim() || undefined,
        isRewatch,
        isPrivate,
      },
      {
        onSuccess: (logId: string) => {
          setSubmittedLogId(logId);
          router.back();
          // Show post-checkin after a brief delay
          setTimeout(() => setShowPostCheckin(true), 400);
        },
        onError: () => {
          toast.info("Saved offline — will sync when back online");
          router.back();
        },
      }
    );
  }, [
    selectedMedia, user, stamp, platform, interestHook, preEmotion,
    favCastId, review, isRewatch, isPrivate, getWatchedAtDate, createLog, router,
    selectedSeason, selectedEpisodeId, selectedEpisodeSeason,
  ]);

  const handlePostCheckinSubmit = useCallback(async () => {
    if (!submittedLogId || !energyLevel || !mindLevel) return;
    try {
      const result = await resolveEmotion.mutateAsync({
        logId: submittedLogId,
        energyLevel,
        mindLevel,
      });
      toast.success(`You're feeling ${result.emotion.label} ${result.emotion.emoji}`);
    } catch {
      // Silently fail — post checkin is optional
    }
    setShowPostCheckin(false);
  }, [submittedLogId, energyLevel, mindLevel, resolveEmotion]);

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          {step > 1 ? (
            <TouchableOpacity
              onPress={() => setStep((s) => (s - 1) as Step)}
              style={styles.headerSide}
            >
              <Ionicons name="chevron-back" size={22} color={Colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSide} />
          )}
          <Text style={styles.headerTitle}>
            {step === 1 ? "Search" : step === 2 ? "Quick check-in" : "Log"}
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerSide}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Step indicator */}
        <View style={styles.stepDots}>
          {([1, 2, 3] as const).map((s) => (
            <View key={s} style={[styles.dot, step >= s && styles.dotActive]} />
          ))}
        </View>

        {/* Step content */}
        {step === 1 && <Step1Search onSelect={handleMediaSelect} />}
        {step === 2 && (
          <Step2PreMood
            question={moodQuestion}
            onSelect={handlePreMoodSelect}
            onSkip={() => setStep(3)}
          />
        )}
        {step === 3 && selectedMedia && (
          <Step3LogForm
            media={selectedMedia}
            selectedSeason={selectedSeason}
            selectedEpisodeId={selectedEpisodeId}
            onSeasonChange={(s) => {
              setSelectedSeason(s);
              setSelectedEpisodeId(null);
              setSelectedEpisodeSeason(null);
            }}
            onEpisodeChange={(epId, epSeason) => {
              setSelectedEpisodeId(epId);
              setSelectedEpisodeSeason(epSeason);
            }}
            stamp={stamp}               onStampChange={setStamp}
            platform={platform}         onPlatformChange={setPlatform}
            interestHook={interestHook} onInterestHookChange={setInterestHook}
            favCastId={favCastId}       onFavCastChange={setFavCastId}
            review={review}             onReviewChange={setReview}
            watchedAt={watchedAt}       onWatchedAtChange={setWatchedAt}
            customDate={customDate}     onCustomDateChange={setCustomDate}
            isRewatch={isRewatch}       onRewatchChange={setIsRewatch}
            isPrivate={isPrivate}       onPrivateChange={setIsPrivate}
            onSubmit={handleSubmit}
            isSubmitting={createLog.isPending}
          />
        )}
      </KeyboardAvoidingView>

      {/* Post-watch check-in overlay */}
      {showPostCheckin && (
        <PostCheckin
          energyLevel={energyLevel}
          mindLevel={mindLevel}
          onEnergyChange={setEnergyLevel}
          onMindChange={setMindLevel}
          onSubmit={handlePostCheckinSubmit}
          onDismiss={() => setShowPostCheckin(false)}
          isSubmitting={resolveEmotion.isPending}
          insetBottom={insets.bottom}
        />
      )}
    </>
  );
}

// ============================================================
// Step 1 — Search
// ============================================================

function Step1Search({ onSelect }: { onSelect: (r: SearchResult) => void }) {
  const { query, setQuery, results, isLoading, getHistory } = useSearch();
  const history = getHistory();

  return (
    <View style={styles.stepWrap}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search movies & series…"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {query.length === 0 && history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyLabel}>Recent</Text>
            {history.map((item: string, i: number) => (
              <TouchableOpacity
                key={i}
                style={styles.historyItem}
                onPress={() => setQuery(item)}
              >
                <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.historyText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {results.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={styles.resultRow}
            onPress={() => onSelect(r)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: r.posterUrl ?? undefined }}
              style={styles.resultPoster}
              contentFit="cover"
              placeholder={{ blurhash: BLURHASH }}
            />
            <View style={styles.resultInfo}>
              <Text style={styles.resultTitle} numberOfLines={1}>{r.title}</Text>
              <View style={styles.resultMeta}>
                <View style={styles.resultBadge}>
                  <Text style={styles.resultBadgeText}>
                    {r.mediaType === "series" ? "Series" : "Movie"}
                  </Text>
                </View>
                {r.releaseYear && (
                  <Text style={styles.resultYear}>{r.releaseYear}</Text>
                )}
              </View>
              {r.overview ? (
                <Text style={styles.resultOverview} numberOfLines={2}>{r.overview}</Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}

        {isLoading && (
          <View style={styles.searchLoading}>
            <Text style={styles.searchLoadingText}>Searching…</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// Step 2 — Pre-watch Mood Check-in
// ============================================================

function Step2PreMood({
  question,
  onSelect,
  onSkip,
}: {
  question: MoodQuestion;
  onSelect: (option: MoodQuestionOption) => void;
  onSkip:   () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => {
    const opts = question.options;
    const pairs: MoodQuestionOption[][] = [];
    for (let i = 0; i < opts.length; i += 2) {
      pairs.push(opts.slice(i, i + 2));
    }
    return pairs;
  }, [question]);

  const handleSelect = (option: MoodQuestionOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(option.emotionSlug);
    setTimeout(() => onSelect(option), 280);
  };

  return (
    <View style={styles.stepWrap}>
      <Text style={styles.moodQuestion}>{question.questionText}</Text>
      <View style={styles.moodGrid}>
        {rows.map((pair, ri) => (
          <View key={ri} style={styles.moodRow}>
            {pair.map((opt) => {
              const active = selected === opt.emotionSlug;
              return (
                <TouchableOpacity
                  key={opt.emotionSlug}
                  style={[styles.moodTile, active && styles.moodTileActive]}
                  onPress={() => handleSelect(opt)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.moodEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
        <Text style={styles.skipText}>Skip →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// Step 3 — Log Form
// ============================================================

interface Step3Props {
  media:                SelectedMedia;
  // Episode picker (series only)
  selectedSeason:       number | null;
  selectedEpisodeId:    string | null;
  onSeasonChange:       (s: number | null) => void;
  onEpisodeChange:      (episodeId: string | null, seasonNumber: number | null) => void;
  // Log fields
  stamp:                StampKey | null;
  onStampChange:        (s: StampKey) => void;
  platform:             PlatformKey | null;
  onPlatformChange:     (p: PlatformKey) => void;
  interestHook:         InterestHookKey | null;
  onInterestHookChange: (h: InterestHookKey) => void;
  favCastId:            string | null;
  onFavCastChange:      (id: string) => void;
  review:               string;
  onReviewChange:       (r: string) => void;
  watchedAt:            "today" | "yesterday" | "other";
  onWatchedAtChange:    (v: "today" | "yesterday" | "other") => void;
  customDate:           string;
  onCustomDateChange:   (v: string) => void;
  isRewatch:            boolean;
  onRewatchChange:      (v: boolean) => void;
  isPrivate:            boolean;
  onPrivateChange:      (v: boolean) => void;
  onSubmit:             () => void;
  isSubmitting:         boolean;
}

function Step3LogForm(p: Step3Props) {
  const { data: mediaDetail, isLoading: isDetailLoading } = useMediaDetail(
    p.media.id, p.media.tmdbId, p.media.mediaType
  );
  const cast:            CastMember[] = mediaDetail?.cast ?? [];
  const numberOfSeasons: number | null = mediaDetail?.media.numberOfSeasons ?? null;

  return (
    <ScrollView style={styles.stepWrap} showsVerticalScrollIndicator={false}>

      {/* Media card */}
      <View style={styles.mediaCard}>
        <Image
          source={{ uri: p.media.posterUrl ?? undefined }}
          style={styles.mediaCardPoster}
          contentFit="cover"
          placeholder={{ blurhash: BLURHASH }}
        />
        <View style={styles.mediaCardInfo}>
          <Text style={styles.mediaCardTitle} numberOfLines={2}>{p.media.title}</Text>
          {p.media.releaseYear && (
            <Text style={styles.mediaCardYear}>{p.media.releaseYear}</Text>
          )}
          <View style={styles.mediaBadge}>
            <Text style={styles.mediaBadgeText}>
              {p.media.mediaType === "series" ? "Series" : "Movie"}
            </Text>
          </View>
        </View>
      </View>

      {/* Episode Picker — series only */}
      {p.media.mediaType === "series" && (
        isDetailLoading ? (
          // Show skeleton while detail is loading so the user knows it's coming
          <View style={styles.epLoadingWrap}>
            <Text style={styles.formLabel}>What did you watch?</Text>
            <ActivityIndicator
              size="small"
              color={Colors.accent}
              style={styles.epLoadingSpinner}
            />
          </View>
        ) : numberOfSeasons != null && numberOfSeasons > 0 ? (
          <EpisodePicker
            tmdbId={p.media.tmdbId}
            numberOfSeasons={numberOfSeasons}
            selectedSeason={p.selectedSeason}
            selectedEpisodeId={p.selectedEpisodeId}
            onSeasonChange={p.onSeasonChange}
            onEpisodeChange={p.onEpisodeChange}
          />
        ) : null
      )}

      {/* Reaction Stamp */}
      <FormSection label="How was it?">
        <View style={styles.stampGrid}>
          {REACTION_STAMPS.map((s) => {
            const active = p.stamp === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.stampCard,
                  s.large ? styles.stampCardLarge : null,
                  { borderColor: active ? s.color : Colors.border },
                  active ? { backgroundColor: s.color + "18" } : null,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  p.onStampChange(s.key);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.stampEmoji}>{s.emoji}</Text>
                <Text style={[styles.stampLabel, active ? { color: s.color } : null]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </FormSection>

      {/* Watch Platform */}
      <FormSection label="Where did you watch?">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.platformRow}>
            {PLATFORMS.map((pl) => {
              const active     = p.platform === pl.key;
              const unofficial = pl.key === "unofficial";
              return (
                <TouchableOpacity
                  key={pl.key}
                  style={[
                    styles.platformChip,
                    active       ? styles.platformChipActive      : null,
                    unofficial   ? styles.platformChipUnofficial  : null,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    p.onPlatformChange(pl.key);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.platformEmoji}>{pl.emoji}</Text>
                  <Text style={[
                    styles.platformLabel,
                    active     ? styles.platformLabelActive     : null,
                    unofficial ? styles.platformLabelUnofficial : null,
                  ]}>
                    {pl.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </FormSection>

      {/* Interest hook */}
      <FormSection label="What drew you to this?">
        <View style={styles.hookRow}>
          {INTEREST_HOOKS.map((h) => {
            const active = p.interestHook === h.key;
            return (
              <TouchableOpacity
                key={h.key}
                style={[styles.hookChip, active && styles.hookChipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  p.onInterestHookChange(h.key);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.hookEmoji}>{h.emoji}</Text>
                <Text style={[styles.hookLabel, active && styles.hookLabelActive]}>
                  {h.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </FormSection>

      {/* Favourite cast */}
      {cast.length > 0 && (
        <FormSection label="Who stood out?">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.castRow}>
              {cast.map((member) => {
                const active = p.favCastId === member.id;
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.castItem}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      p.onFavCastChange(member.id);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.castPhoto, active && styles.castPhotoActive]}>
                      {member.profileUrl ? (
                        <Image
                          source={{ uri: member.profileUrl }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          placeholder={{ blurhash: BLURHASH }}
                        />
                      ) : (
                        <View style={styles.castPhotoPlaceholder}>
                          <Ionicons name="person" size={22} color={Colors.textMuted} />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.castName, active && styles.castNameActive]} numberOfLines={1}>
                      {member.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </FormSection>
      )}

      {/* Review */}
      <FormSection label="Your thoughts">
        <View style={styles.reviewBox}>
          <TextInput
            style={styles.reviewInput}
            placeholder="What stayed with you? (optional)"
            placeholderTextColor={Colors.textMuted}
            value={p.review}
            onChangeText={p.onReviewChange}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
          <Text style={styles.reviewCount}>{p.review.length}/300</Text>
        </View>
      </FormSection>

      {/* Date */}
      <FormSection label="When did you watch?">
        <View style={styles.datePills}>
          {(["today", "yesterday", "other"] as const).map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.datePill, p.watchedAt === v && styles.datePillActive]}
              onPress={() => p.onWatchedAtChange(v)}
            >
              <Text style={[
                styles.datePillText,
                p.watchedAt === v && styles.datePillTextActive,
              ]}>
                {v === "today" ? "Today" : v === "yesterday" ? "Yesterday" : "Other"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {p.watchedAt === "other" && (
          <TextInput
            style={styles.dateInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
            value={p.customDate}
            onChangeText={p.onCustomDateChange}
            keyboardType="numbers-and-punctuation"
          />
        )}
      </FormSection>

      {/* Toggles */}
      <View style={styles.toggleRow}>
        <Toggle
          label="Rewatch"
          icon="refresh-outline"
          value={p.isRewatch}
          onToggle={() => p.onRewatchChange(!p.isRewatch)}
        />
        <Toggle
          label="Private"
          icon="lock-closed-outline"
          value={p.isPrivate}
          onToggle={() => p.onPrivateChange(!p.isPrivate)}
        />
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={styles.submitBtn}
        onPress={p.onSubmit}
        disabled={p.isSubmitting}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={Gradients.accentDeep}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.submitGradient}
        >
          <Text style={styles.submitText}>
            {p.isSubmitting ? "Saving…" : "Save Log"}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ============================================================
// Episode Picker
// ============================================================

interface EpisodePickerProps {
  tmdbId:           number;
  numberOfSeasons:  number;
  selectedSeason:   number | null;
  selectedEpisodeId: string | null;
  onSeasonChange:   (s: number | null) => void;
  onEpisodeChange:  (episodeId: string | null, seasonNumber: number | null) => void;
}

function EpisodePicker(p: EpisodePickerProps) {
  const seasons = Array.from({ length: p.numberOfSeasons }, (_, i) => i + 1);

  const { data: episodes = [], isLoading, isError, refetch } = useSeasonEpisodes(
    p.tmdbId,
    "series",
    p.selectedSeason
  );

  return (
    <View style={styles.epPickerWrap}>
      <Text style={styles.formLabel}>What did you watch?</Text>

      {/* Season pill row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.epSeasonScroll}
        contentContainerStyle={styles.epSeasonRow}
      >
        {/* Whole Series pill */}
        <TouchableOpacity
          style={[
            styles.epSeasonPill,
            p.selectedSeason === null && styles.epSeasonPillActive,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            p.onSeasonChange(null);
            p.onEpisodeChange(null, null);
          }}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.epSeasonPillText,
            p.selectedSeason === null && styles.epSeasonPillTextActive,
          ]}>
            Whole Series
          </Text>
        </TouchableOpacity>

        {/* Season pills */}
        {seasons.map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.epSeasonPill,
              p.selectedSeason === s && styles.epSeasonPillActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              p.onSeasonChange(s);
              p.onEpisodeChange(null, null);
            }}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.epSeasonPillText,
              p.selectedSeason === s && styles.epSeasonPillTextActive,
            ]}>
              S{s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Episode list — only when a season is selected */}
      {p.selectedSeason !== null && (
        <View style={styles.epList}>
          {isLoading ? (
            // Loading skeleton
            [0, 1, 2].map((i) => (
              <View key={i} style={styles.epRowSkeleton} />
            ))
          ) : isError ? (
            <TouchableOpacity style={styles.epErrorRow} onPress={() => refetch()}>
              <Text style={styles.epErrorText}>Couldn't load episodes. Tap to retry.</Text>
            </TouchableOpacity>
          ) : (
            <>
              {/* Whole Season row */}
              <TouchableOpacity
                style={[
                  styles.epRow,
                  p.selectedEpisodeId === null && styles.epRowActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  p.onEpisodeChange(null, null);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.epNumBadge}>
                  <Text style={styles.epNumText}>All</Text>
                </View>
                <Text style={[
                  styles.epTitle,
                  p.selectedEpisodeId === null && styles.epTitleActive,
                ]}>
                  Whole Season
                </Text>
              </TouchableOpacity>

              {/* Individual episodes */}
              {episodes.length === 0 ? (
                <View style={styles.epEmptyRow}>
                  <Text style={styles.epEmptyText}>No episodes available</Text>
                </View>
              ) : (
                episodes.map((ep) => {
                  const active = p.selectedEpisodeId === ep.id;
                  return (
                    <TouchableOpacity
                      key={ep.id}
                      style={[styles.epRow, active && styles.epRowActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        p.onEpisodeChange(ep.id, ep.seasonNumber);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.epNumBadge, active && styles.epNumBadgeActive]}>
                        <Text style={[styles.epNumText, active && styles.epNumTextActive]}>
                          E{ep.episodeNumber}
                        </Text>
                      </View>
                      <View style={styles.epInfo}>
                        <Text style={[styles.epTitle, active && styles.epTitleActive]} numberOfLines={1}>
                          {ep.title ?? `Episode ${ep.episodeNumber}`}
                        </Text>
                        {ep.airDate && (
                          <Text style={styles.epMeta}>{ep.airDate}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ============================================================
// Post-watch Check-in
// ============================================================

function PostCheckin({
  energyLevel, mindLevel,
  onEnergyChange, onMindChange,
  onSubmit, onDismiss, isSubmitting, insetBottom,
}: {
  energyLevel:    number | null;
  mindLevel:      number | null;
  onEnergyChange: (v: number) => void;
  onMindChange:   (v: number) => void;
  onSubmit:       () => void;
  onDismiss:      () => void;
  isSubmitting:   boolean;
  insetBottom:    number;
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 80, friction: 10,
    }).start();
  }, []);

  const bothSelected = energyLevel !== null && mindLevel !== null;

  return (
    <Animated.View
      style={[
        styles.postCheckin,
        { paddingBottom: insetBottom + 12 },
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.postHandle} />
      <Text style={styles.postTitle}>How are you feeling now?</Text>

      <Text style={styles.postLabel}>Energy</Text>
      <View style={styles.postRow}>
        {ENERGY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.level}
            style={[styles.postPill, energyLevel === opt.level && styles.postPillActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onEnergyChange(opt.level);
            }}
          >
            <Text style={styles.postPillEmoji}>{opt.emoji}</Text>
            <Text style={[
              styles.postPillLabel,
              energyLevel === opt.level && styles.postPillLabelActive,
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.postLabel}>Mind</Text>
      <View style={styles.postRow}>
        {MIND_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.level}
            style={[styles.postPill, mindLevel === opt.level && styles.postPillActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onMindChange(opt.level);
            }}
          >
            <Text style={styles.postPillEmoji}>{opt.emoji}</Text>
            <Text style={[
              styles.postPillLabel,
              mindLevel === opt.level && styles.postPillLabelActive,
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.postActions}>
        {bothSelected && (
          <TouchableOpacity
            style={styles.postSubmit}
            onPress={onSubmit}
            disabled={isSubmitting}
          >
            <LinearGradient
              colors={Gradients.accentDeep}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.postSubmitGradient}
            >
              <Text style={styles.postSubmitText}>
                {isSubmitting ? "Saving…" : "Done"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.postDismiss} onPress={onDismiss}>
          <Text style={styles.postDismissText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ============================================================
// Helpers
// ============================================================

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.formLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Toggle({
  label, icon, value, onToggle,
}: {
  label: string; icon: string; value: boolean; onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.toggle, value && styles.toggleActive]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      activeOpacity={0.8}
    >
      <Ionicons name={icon as never} size={16} color={value ? Colors.accent : Colors.textSecondary} />
      <Text style={[styles.toggleText, value && styles.toggleTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:      Colors.surfaceElevated,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    overflow:             "hidden",
  },
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingBottom:     12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  headerSide: { width: 36 },
  headerTitle: {
    flex: 1, textAlign: "center",
    color: Colors.text, fontSize: 16, fontWeight: "700",
  },
  stepDots: {
    flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 10,
  },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.surface },
  dotActive: { backgroundColor: Colors.accent, width: 18 },
  stepWrap:  { flex: 1, paddingHorizontal: 20 },

  // Search
  searchBar: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               10,
    backgroundColor:   Colors.glass,
    borderWidth:       1,
    borderColor:       Colors.glassBorder,
    borderRadius:      14,
    paddingHorizontal: 14,
    paddingVertical:   11,
    marginTop:         8,
    marginBottom:      16,
  },
  searchInput:    { flex: 1, color: Colors.text, fontSize: 15 },
  historySection: { marginBottom: 12 },
  historyLabel: {
    color: Colors.textMuted, fontSize: 11, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8,
  },
  historyItem:  { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  historyText:  { color: Colors.textSecondary, fontSize: 14 },
  resultRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
  },
  resultPoster:    { width: 44, height: 66, borderRadius: 6, backgroundColor: Colors.surface },
  resultInfo:      { flex: 1 },
  resultTitle:     { color: Colors.text, fontSize: 14, fontWeight: "600", marginBottom: 4 },
  resultMeta:      { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  resultBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: Colors.accentDim },
  resultBadgeText: { color: Colors.accentLight, fontSize: 10, fontWeight: "700" },
  resultYear:      { color: Colors.textMuted, fontSize: 12 },
  resultOverview:  { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
  searchLoading:   { alignItems: "center", paddingVertical: 20 },
  searchLoadingText: { color: Colors.textMuted, fontSize: 13 },

  // Pre-mood
  moodQuestion: {
    color: Colors.text, fontSize: 20, fontWeight: "700",
    lineHeight: 28, marginTop: 12, marginBottom: 28, textAlign: "center",
  },
  moodGrid:        { gap: 10 },
  moodRow:         { flexDirection: "row", gap: 10 },
  moodTile: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 18, borderRadius: 16,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  moodTileActive:  { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  moodEmoji:       { fontSize: 28 },
  moodLabel:       { color: Colors.textSecondary, fontSize: 13, fontWeight: "500" },
  moodLabelActive: { color: Colors.accent },
  skipBtn:         { alignSelf: "flex-end", marginTop: 20, padding: 8 },
  skipText:        { color: Colors.textMuted, fontSize: 14 },

  // Form
  mediaCard: {
    flexDirection: "row", gap: 12, padding: 14,
    backgroundColor: Colors.glass,
    borderWidth: 1, borderColor: Colors.glassBorder,
    borderRadius: 14, marginTop: 8, marginBottom: 4,
  },
  mediaCardPoster: { width: 48, height: 72, borderRadius: 6, backgroundColor: Colors.surface },
  mediaCardInfo:   { flex: 1, gap: 4, justifyContent: "center" },
  mediaCardTitle:  { color: Colors.text, fontSize: 15, fontWeight: "700" },
  mediaCardYear:   { color: Colors.textSecondary, fontSize: 13 },
  mediaBadge:      {
    alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, backgroundColor: Colors.accentDim,
  },
  mediaBadgeText:  { color: Colors.accentLight, fontSize: 10, fontWeight: "700" },

  formSection:     { paddingTop: 20, gap: 10 },
  formLabel:       { color: Colors.text, fontSize: 15, fontWeight: "600" },

  // Stamps
  stampGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stampCard: {
    width: (SW - 56) / 3, alignItems: "center",
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.surface, borderWidth: 1.5, gap: 6,
  },
  stampCardLarge:  { width: (SW - 48) / 2 },
  stampEmoji:      { fontSize: 24 },
  stampLabel:      { color: Colors.textSecondary, fontSize: 11, fontWeight: "600" },

  // Platform
  platformRow:            { flexDirection: "row", gap: 8, paddingBottom: 4 },
  platformChip: {
    alignItems: "center", paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, gap: 4,
  },
  platformChipActive:     { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  platformChipUnofficial: { borderStyle: "dashed", borderColor: Colors.textMuted },
  platformEmoji:          { fontSize: 18 },
  platformLabel:          { color: Colors.textSecondary, fontSize: 10, fontWeight: "500" },
  platformLabelActive:    { color: Colors.accent },
  platformLabelUnofficial:{ color: Colors.textMuted },

  // Hooks
  hookRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hookChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  hookChipActive:  { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  hookEmoji:       { fontSize: 13 },
  hookLabel:       { color: Colors.textSecondary, fontSize: 12, fontWeight: "500" },
  hookLabelActive: { color: Colors.accent },

  // Cast
  castRow:            { flexDirection: "row", gap: 12, paddingBottom: 4 },
  castItem:           { alignItems: "center", width: 64 },
  castPhoto: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.surface, overflow: "hidden",
  },
  castPhotoActive:      { borderWidth: 2.5, borderColor: Colors.accent },
  castPhotoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  castName:             { color: Colors.textSecondary, fontSize: 10, textAlign: "center", marginTop: 4 },
  castNameActive:       { color: Colors.accent },

  // Review
  reviewBox: {
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 12,
  },
  reviewInput:  { color: Colors.text, fontSize: 14, lineHeight: 20, minHeight: 72 },
  reviewCount:  { color: Colors.textMuted, fontSize: 11, alignSelf: "flex-end", marginTop: 4 },

  // Date
  datePills:           { flexDirection: "row", gap: 8 },
  datePill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  datePillActive:      { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  datePillText:        { color: Colors.textSecondary, fontSize: 13, fontWeight: "500" },
  datePillTextActive:  { color: Colors.accent },
  dateInput: {
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    padding: 12, color: Colors.text, fontSize: 14, marginTop: 4,
  },

  // Toggles
  toggleRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  toggle: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  toggleActive:     { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  toggleText:       { color: Colors.textSecondary, fontSize: 13, fontWeight: "500" },
  toggleTextActive: { color: Colors.accent },

  // Submit
  submitBtn:      { borderRadius: 16, overflow: "hidden", marginTop: 24 },
  submitGradient: { alignItems: "center", justifyContent: "center", paddingVertical: 15 },
  submitText:     { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },

  // Episode picker
  epLoadingWrap:       { paddingTop: 20, gap: 10 },
  epLoadingSpinner:    { marginTop: 8 },
  epPickerWrap:        { paddingTop: 20, gap: 10 },
  epSeasonScroll:      { marginHorizontal: -20 },
  epSeasonRow:         { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 4 },
  epSeasonPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  epSeasonPillActive:  { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  epSeasonPillText:    { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  epSeasonPillTextActive: { color: Colors.accent },
  epList:              { gap: 2, marginTop: 4 },
  epRowSkeleton: {
    height: 48, borderRadius: 10,
    backgroundColor: Colors.surface, marginBottom: 4,
  },
  epErrorRow: {
    paddingVertical: 14, alignItems: "center",
    backgroundColor: Colors.surface, borderRadius: 10,
  },
  epErrorText:         { color: Colors.textMuted, fontSize: 13 },
  epEmptyRow:          { paddingVertical: 14, alignItems: "center" },
  epEmptyText:         { color: Colors.textMuted, fontSize: 13 },
  epRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  epRowActive:         { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  epNumBadge: {
    width: 36, height: 24, borderRadius: 6,
    backgroundColor: Colors.glass, alignItems: "center", justifyContent: "center",
  },
  epNumBadgeActive:    { backgroundColor: Colors.accent + "33" },
  epNumText:           { color: Colors.textMuted, fontSize: 11, fontWeight: "700" },
  epNumTextActive:     { color: Colors.accent },
  epInfo:              { flex: 1 },
  epTitle:             { color: Colors.textSecondary, fontSize: 13, fontWeight: "500" },
  epTitleActive:       { color: Colors.text, fontWeight: "600" },
  epMeta:              { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  // Post check-in
  postCheckin: {
    position:             "absolute",
    bottom:               0, left: 0, right: 0,
    backgroundColor:      Colors.surfaceElevated,
    borderTopLeftRadius:  24, borderTopRightRadius: 24,
    paddingHorizontal:    20, paddingTop: 16,
    borderTopWidth:       1, borderTopColor: Colors.glassBorder,
  },
  postHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.textMuted,
    alignSelf: "center", marginBottom: 16,
  },
  postTitle:  {
    color: Colors.text, fontSize: 18, fontWeight: "700",
    marginBottom: 18, textAlign: "center",
  },
  postLabel:  {
    color: Colors.textSecondary, fontSize: 12, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8,
  },
  postRow:    { flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" },
  postPill: {
    alignItems: "center", flex: 1, minWidth: (SW - 88) / 5,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, gap: 4,
  },
  postPillActive:      { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  postPillEmoji:       { fontSize: 18 },
  postPillLabel:       { color: Colors.textMuted, fontSize: 9, fontWeight: "500", textAlign: "center" },
  postPillLabelActive: { color: Colors.accent },
  postActions:         { gap: 10, marginTop: 4 },
  postSubmit:          { borderRadius: 14, overflow: "hidden" },
  postSubmitGradient:  { alignItems: "center", paddingVertical: 13 },
  postSubmitText:      { color: "#fff", fontSize: 15, fontWeight: "700" },
  postDismiss:         { alignItems: "center", paddingVertical: 10 },
  postDismissText:     { color: Colors.textMuted, fontSize: 13 },
});
