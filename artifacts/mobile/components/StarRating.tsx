import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  onRate?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
}

export default function StarRating({
  rating,
  maxStars = 5,
  onRate,
  size = 24,
  readonly = false,
}: StarRatingProps) {
  const colors = useColors();

  const handlePress = (star: number) => {
    if (!readonly && onRate) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onRate(star);
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: maxStars }, (_, i) => i + 1).map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => handlePress(star)}
          disabled={readonly}
          activeOpacity={0.7}
        >
          <Feather
            name={star <= rating ? "star" : "star"}
            size={size}
            color={star <= rating ? colors.primary : colors.border}
            style={styles.star}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  star: {
    marginHorizontal: 2,
  },
});
