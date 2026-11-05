import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/SearchField';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useCloudFeed, type CloudFeedItem } from '@/hooks/useCloudFeed';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useIsOnline } from '@/lib/queryClient';

function CloudCard({ item, index }: { item: CloudFeedItem; index: number }) {
  const hasLocation = item.latitude !== null && item.longitude !== null;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index % 10, 5) * 45).duration(280)}>
      <AnimatedPressable
        accessibilityRole={item.localId !== null ? 'button' : undefined}
        disabled={item.localId === null}
        scaleTo={0.98}
        style={styles.card}
        onPress={() =>
          router.push({ pathname: '/foto/[id]', params: { id: String(item.localId) } })
        }
      >
        {item.displayUri ? (
          <Image
            testID={`cloud-image-${item.client_id}`}
            source={{ uri: item.displayUri }}
            style={styles.image}
            contentFit="cover"
            transition={220}
            recyclingKey={item.client_id}
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={28} color={colors.textFaint} />
            <Text style={styles.placeholderText}>Imagen no disponible</Text>
          </View>
        )}

        {item.favorite ? (
          <View style={styles.favorite}>
            <Ionicons name="star" size={14} color={colors.favorite} />
          </View>
        ) : null}

        <View style={styles.cardBody}>
          <Text style={[styles.note, !item.note && styles.noteEmpty]} numberOfLines={2}>
            {item.note || 'Sin nota'}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={colors.textFaint} />
            <Text style={styles.meta}>
              {new Date(item.client_created_at).toLocaleString('es-CO', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons
              name={hasLocation ? 'location-outline' : 'location'}
              size={13}
              color={colors.textFaint}
            />
            <Text style={styles.meta}>
              {hasLocation
                ? `${item.latitude!.toFixed(4)}, ${item.longitude!.toFixed(4)}`
                : 'Sin ubicación'}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function LoadingFeed() {
  return (
    <View testID="cloud-loading" style={styles.list}>
      {[0, 1].map((key) => (
        <View key={key} style={styles.card}>
          <Skeleton height={220} borderRadius={0} />
          <View style={styles.cardBody}>
            <Skeleton width="70%" height={16} />
            <Skeleton width="45%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function NubeScreen() {
  const { isGuest } = useAuth();
  const isOnline = useIsOnline();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const feed = useCloudFeed(debouncedSearch);

  if (isGuest) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="cloud-outline"
          title="Tus fotos en la nube"
          detail="Inicia sesión para respaldar tus fotos y verlas en todos tus teléfonos."
          action="Iniciar sesión"
          onAction={() => router.push('/auth')}
        />
      </View>
    );
  }

  // status pasa a 'error' también cuando falla una recarga o la página siguiente.
  // Si ya hay datos, la lista se conserva y el error se muestra sin taparla.
  const hasData = feed.data !== undefined;
  const hasBackgroundError = hasData && feed.isError && !feed.isFetchNextPageError;
  const searchIsWaiting = feed.isPlaceholderData && feed.fetchStatus === 'paused';
  const isSearching = debouncedSearch.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* Estado: sin conexión, con los últimos datos guardados */}
      {!isOnline && (
        <Banner icon="cloud-offline-outline" text="Sin conexión. Se muestran los datos guardados." />
      )}

      <View style={styles.searchRow}>
        <SearchField value={search} onChangeText={setSearch} placeholder="Buscar por nota..." />
      </View>

      {searchIsWaiting && (
        <Banner
          icon="time-outline"
          tone="info"
          text="La búsqueda se hará cuando vuelva la conexión."
        />
      )}

      {hasBackgroundError && (
        <Banner
          icon="refresh"
          tone="danger"
          text="No se pudo actualizar. Toca para reintentar."
          onPress={() => feed.refetch()}
        />
      )}

      {!hasData && feed.isError ? (
        /* Estado: error, con opción de reintentar */
        <EmptyState
          icon="alert-circle-outline"
          tone="danger"
          title="No se pudo cargar la nube"
          detail={feed.error.message}
          action="Reintentar"
          onAction={() => feed.refetch()}
        />
      ) : !hasData && feed.fetchStatus === 'paused' ? (
        /* Estado: sin datos y sin red (nunca se pudo cargar) */
        <EmptyState
          icon="cloud-offline-outline"
          tone="warning"
          title="Sin conexión"
          detail="Conéctate a internet para cargar tus fotos de la nube."
        />
      ) : !hasData ? (
        /* Estado: primera carga */
        <LoadingFeed />
      ) : (
        <FlatList
          testID="cloud-list"
          data={feed.items}
          keyExtractor={(item) => item.client_id}
          renderItem={({ item, index }) => <CloudCard item={item} index={index} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          // Estado: vacío, distinto según haya búsqueda o no
          ListEmptyComponent={
            <EmptyState
              icon={isSearching ? 'search-outline' : 'cloud-upload-outline'}
              title={isSearching ? 'Ninguna foto coincide' : 'Aún no hay fotos en la nube'}
              detail={
                isSearching
                  ? 'Prueba con otra palabra de la nota.'
                  : 'Las fotos que tomes se subirán solas.'
              }
            />
          }
          // Deslizar hacia abajo para refrescar
          refreshing={feed.isRefetching && !feed.isFetchingNextPage && !feed.isPlaceholderData}
          onRefresh={() => feed.refetch()}
          // Infinite scroll
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage && !feed.isFetchNextPageError) {
              feed.fetchNextPage();
            }
          }}
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <ActivityIndicator style={styles.footer} color={colors.primary} />
            ) : feed.isFetchNextPageError ? (
              <Pressable
                accessibilityRole="button"
                style={styles.footer}
                onPress={() => feed.fetchNextPage()}
              >
                <Text style={styles.footerError}>
                  No se pudieron cargar más. Toca para reintentar.
                </Text>
              </Pressable>
            ) : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1, paddingTop: spacing.sm },
  searchRow: { marginBottom: spacing.md },
  list: { flexGrow: 1, gap: spacing.lg, padding: spacing.lg, paddingTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: { aspectRatio: 4 / 3, backgroundColor: colors.surfaceRaised, width: '100%' },
  imagePlaceholder: { alignItems: 'center', gap: spacing.sm, justifyContent: 'center' },
  placeholderText: { ...type.caption, color: colors.textFaint },
  favorite: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderRadius: radius.full,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 30,
  },
  cardBody: { gap: spacing.xs + 2, padding: spacing.md + 2 },
  note: { ...type.body, color: colors.text, fontWeight: '600', marginBottom: 2 },
  noteEmpty: { color: colors.textFaint, fontWeight: '400' },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs + 2 },
  meta: { ...type.caption, color: colors.textMuted },
  footer: { padding: spacing.lg },
  footerError: { ...type.label, color: colors.danger, textAlign: 'center' },
});
