import React, { useRef, useState, useCallback } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  ImageSourcePropType,
  FlatList,
  Dimensions,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PinchGestureHandler,
  PinchGestureHandlerGestureEvent,
  PinchGestureHandlerStateChangeEvent,
  GestureHandlerRootView,
  State,
} from "react-native-gesture-handler";
import VectorIcon from "@/components/VectorIcon";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface Props {
  visible: boolean;
  sources: ImageSourcePropType[];
  initialIndex?: number;
  onClose: () => void;
}

function PhotoItem({
  source,
  onScaleChange,
}: {
  source: ImageSourcePropType;
  onScaleChange?: (zoomed: boolean) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);

  const onPinchEvent = ({ nativeEvent }: PinchGestureHandlerGestureEvent) => {
    const newScale = Math.max(1, Math.min(lastScale.current * nativeEvent.scale, 5));
    scale.setValue(newScale);
  };

  const onPinchStateChange = ({ nativeEvent }: PinchGestureHandlerStateChangeEvent) => {
    if (
      nativeEvent.state === State.END ||
      nativeEvent.state === State.CANCELLED ||
      nativeEvent.state === State.FAILED
    ) {
      lastScale.current = Math.max(1, Math.min(lastScale.current * nativeEvent.scale, 5));
      if (lastScale.current <= 1) {
        lastScale.current = 1;
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
        onScaleChange?.(false);
      } else {
        onScaleChange?.(true);
      }
    }
  };

  return (
    <View style={photoItemStyles.container}>
      <PinchGestureHandler
        onGestureEvent={onPinchEvent}
        onHandlerStateChange={onPinchStateChange}
      >
        <Animated.Image
          source={source}
          style={[photoItemStyles.image, { transform: [{ scale }] }]}
          resizeMode="contain"
        />
      </PinchGestureHandler>
    </View>
  );
}

const photoItemStyles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
});

export default function ImageLightbox({
  visible,
  sources,
  initialIndex = 0,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleClose = () => {
    setIsZoomed(false);
    onClose();
  };

  const onMomentumScrollEnd = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(idx);
    setIsZoomed(false);
  }, []);

  const onModalShow = useCallback(() => {
    const safeIndex = Math.max(0, Math.min(initialIndex, sources.length - 1));
    setCurrentIndex(safeIndex);
    setIsZoomed(false);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: safeIndex, animated: false });
    }, 50);
  }, [initialIndex, sources.length]);

  const total = sources.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      onShow={onModalShow}
    >
      <StatusBar hidden />
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.backdrop}>
          <FlatList
            ref={flatListRef}
            data={sources}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            scrollEnabled={!isZoomed}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onMomentumScrollEnd={onMomentumScrollEnd}
            renderItem={({ item }) => (
              <PhotoItem
                source={item}
                onScaleChange={setIsZoomed}
              />
            )}
          />

          {total > 1 && (
            <View style={[styles.indicator, { bottom: Math.max(insets.bottom + 16, 28) }]}>
              <Text style={styles.indicatorText}>
                {currentIndex + 1} / {total}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.closeButton, { top: Math.max(insets.top + 12, 20) }]}
            onPress={handleClose}
            hitSlop={12}
          >
            <View style={styles.closeCircle}>
              <VectorIcon name="x" size={20} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
  },
  closeButton: {
    position: "absolute",
    right: 20,
    zIndex: 10,
  },
  closeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  indicator: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    zIndex: 10,
  },
  indicatorText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
