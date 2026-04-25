import React, { useRef } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  ImageSourcePropType,
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

interface Props {
  visible: boolean;
  source: ImageSourcePropType;
  onClose: () => void;
}

export default function ImageLightbox({ visible, source, onClose }: Props) {
  const insets = useSafeAreaInsets();
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
      }
    }
  };

  const handleClose = () => {
    scale.setValue(1);
    lastScale.current = 1;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.backdrop}>
          <PinchGestureHandler
            onGestureEvent={onPinchEvent}
            onHandlerStateChange={onPinchStateChange}
          >
            <Animated.Image
              source={source}
              style={[styles.image, { transform: [{ scale }] }]}
              resizeMode="contain"
            />
          </PinchGestureHandler>

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
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
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
});
