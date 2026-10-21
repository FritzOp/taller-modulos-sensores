import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { usePhotos } from '@/hooks/usePhotos';
import { useAlbums } from '@/hooks/useAlbums';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

export default function GaleriaScreen() {
  const [search, setSearch] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const { photos, removePhoto } = usePhotos({
    search: search.trim() || undefined,
    albumId: selectedAlbumId,
    onlyFavorites,
  });

  const { albums, createAlbum } = useAlbums();

  const handleCreateAlbum = () => {
    if (Alert.prompt) {
      Alert.prompt(
        'Nuevo Álbum',
        'Ingresa el nombre del álbum:',
        async (name) => {
          if (name && name.trim()) {
            try {
              await createAlbum(name.trim());
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'No se pudo crear el álbum');
            }
          }
        }
      );
    } else {
      (async () => {
        const defaultName = `Álbum ${albums.length + 1}`;
        await createAlbum(defaultName);
      })();
    }
  };

  const confirmDelete = (id: number) => {
    Alert.alert(
      'Eliminar Foto',
      '¿Deseas eliminar permanentemente esta foto y su archivo local?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => removePhoto(id) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Cloud & User Sync Status Header */}
      <View style={styles.headerBar}>
        <SyncStatusBadge />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nota..."
          placeholderTextColor="#71717a"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} style={styles.clearSearchBtn}>
            <Text style={styles.clearSearchText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Filter Chips Bar */}
      <View style={styles.filtersBar}>
        {/* Favorite filter toggle */}
        <Pressable
          onPress={() => setOnlyFavorites((prev) => !prev)}
          style={[styles.filterChip, onlyFavorites && styles.filterChipActiveGold]}
        >
          <Text style={[styles.filterChipText, onlyFavorites && styles.filterChipTextActiveGold]}>
            {onlyFavorites ? '★ Favoritas' : '☆ Favoritas'}
          </Text>
        </Pressable>

        {/* All album chip */}
        <Pressable
          onPress={() => setSelectedAlbumId(null)}
          style={[styles.filterChip, selectedAlbumId === null && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, selectedAlbumId === null && styles.filterChipTextActive]}>
            Todos
          </Text>
        </Pressable>

        {/* Dynamic Album Chips */}
        {albums.map((album) => (
          <Pressable
            key={album.id}
            onPress={() =>
              setSelectedAlbumId(selectedAlbumId === album.id ? null : album.id)
            }
            style={[styles.filterChip, selectedAlbumId === album.id && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedAlbumId === album.id && styles.filterChipTextActive,
              ]}
            >
              📁 {album.name}
            </Text>
          </Pressable>
        ))}

        {/* Add Album Button */}
        <Pressable onPress={handleCreateAlbum} style={styles.addAlbumChip}>
          <Text style={styles.addAlbumChipText}>+ Álbum</Text>
        </Pressable>
      </View>

      {/* Photos Grid */}
      <FlatList
        data={photos}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📷</Text>
            <Text style={styles.emptyTitle}>No se encontraron fotos</Text>
            <Text style={styles.emptySubtitle}>
              {search || selectedAlbumId || onlyFavorites
                ? 'Prueba cambiando los filtros o la búsqueda'
                : 'Captura una foto con la cámara para comenzar'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({ pathname: '/foto/[id]' as any, params: { id: String(item.id) } })
            }
            onLongPress={() => confirmDelete(item.id)}
          >
            <Image source={{ uri: item.uri }} style={styles.cardImage} />

            {/* Favorite badge */}
            {item.favorite ? (
              <View style={styles.favBadge}>
                <Text style={styles.favBadgeText}>★</Text>
              </View>
            ) : null}

            {/* Top Left Badges: GPS + Cloud Sync */}
            <View style={styles.topLeftBadges}>
              <View style={styles.badgeItem}>
                <Text style={styles.badgeText}>
                  {item.latitude !== null ? '📍' : '⚠️'}
                </Text>
              </View>
              <View style={styles.badgeItem}>
                <Text style={styles.badgeText}>
                  {item.syncStatus === 'synced'
                    ? '☁️'
                    : item.syncStatus === 'uploading'
                    ? '🔄'
                    : '⏳'}
                </Text>
              </View>
            </View>

            {/* Card Footer */}
            <View style={styles.cardFooter}>
              {item.albumName ? (
                <Text style={styles.cardAlbum} numberOfLines={1}>
                  📁 {item.albumName}
                </Text>
              ) : null}

              {item.note ? (
                <Text style={styles.cardNote} numberOfLines={1}>
                  📝 {item.note}
                </Text>
              ) : (
                <Text style={styles.cardDate}>
                  {new Date(item.createdAt).toLocaleDateString('es-CO')}
                </Text>
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingTop: 8,
  },
  headerBar: {
    paddingHorizontal: 16,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    color: '#a1a1aa',
    fontSize: 14,
  },
  filtersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  filterChipActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  filterChipActiveGold: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  filterChipText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#09090b',
    fontWeight: '700',
  },
  filterChipTextActiveGold: {
    color: '#09090b',
    fontWeight: '700',
  },
  addAlbumChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderStyle: 'dashed',
  },
  addAlbumChipText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    width: COLUMN_WIDTH,
    backgroundColor: '#18181b',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardImage: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH * 1.1,
    backgroundColor: '#27272a',
  },
  favBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  favBadgeText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 'bold',
  },
  topLeftBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 4,
    zIndex: 2,
  },
  badgeItem: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
  },
  cardFooter: {
    padding: 8,
    gap: 2,
  },
  cardAlbum: {
    fontSize: 11,
    color: '#34d399',
    fontWeight: '600',
  },
  cardNote: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  cardDate: {
    fontSize: 11,
    color: '#71717a',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptySubtitle: {
    color: '#71717a',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
