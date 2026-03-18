import React, { useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Camera } from 'lucide-react-native';
import { usePressAnimation } from '../../hooks/use-spring-animation';
import { hapticPatterns } from '../../theme/haptics';
import { colors } from '../../theme/colors';

interface PhotoGridProps {
  photos: { uri: string; caption?: string }[];
  columns?: number;
  onPhotoPress: (index: number) => void;
  onAddPress: () => void;
}

function AddButton({ onPress, size }: { onPress: () => void; size: number }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();

  const handlePress = () => {
    hapticPatterns.tap();
    onPress();
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.addButton, { width: size, height: size }]}
      >
        <Camera size={20} color={colors.inactive} />
        <Text style={styles.addText}>Voeg toe</Text>
      </Pressable>
    </Animated.View>
  );
}

function PhotoCell({
  uri,
  index,
  size,
  onPress,
}: {
  uri: string;
  index: number;
  size: number;
  onPress: (index: number) => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();

  const handlePress = () => {
    hapticPatterns.tap();
    onPress(index);
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <Image
          source={{ uri }}
          style={[styles.photo, { width: size, height: size }]}
        />
      </Pressable>
    </Animated.View>
  );
}

export function PhotoGrid({
  photos,
  columns = 3,
  onPhotoPress,
  onAddPress,
}: PhotoGridProps) {
  const { width: screenWidth } = useWindowDimensions();
  const gap = 2;
  const totalGap = gap * (columns - 1);
  const cellSize = (screenWidth - totalGap - 32) / columns; // 32 for horizontal padding

  type GridItem = { type: 'add' } | { type: 'photo'; uri: string; index: number };

  const data: GridItem[] = [
    { type: 'add' as const },
    ...photos.map((photo, index) => ({
      type: 'photo' as const,
      uri: photo.uri,
      index,
    })),
  ];

  const renderItem = useCallback(
    ({ item }: { item: GridItem }) => {
      if (item.type === 'add') {
        return <AddButton onPress={onAddPress} size={cellSize} />;
      }
      return (
        <PhotoCell
          uri={item.uri}
          index={item.index}
          size={cellSize}
          onPress={onPhotoPress}
        />
      );
    },
    [cellSize, onAddPress, onPhotoPress],
  );

  const keyExtractor = useCallback(
    (item: GridItem, idx: number) =>
      item.type === 'add' ? 'add' : `photo-${idx}`,
    [],
  );

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={columns}
      columnWrapperStyle={[styles.row, { gap }]}
      contentContainerStyle={[styles.grid, { gap }]}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: 16,
  },
  row: {
    justifyContent: 'flex-start',
  },
  addButton: {
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addText: {
    fontSize: 9,
    color: colors.inactive,
  },
  photo: {
    borderRadius: 4,
  },
});
