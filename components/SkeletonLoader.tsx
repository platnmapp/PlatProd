import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");

const SkeletonLoader = () => {
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 1000 }), -1);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: interpolate(x.value, [0, 1], [-width, width]),
        },
      ],
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.skeletonRow}>
        <View style={styles.avatar} />
        <View style={styles.textContainer}>
          <View style={styles.textLine} />
          <View style={[styles.textLine, { width: "70%" }]} />
        </View>
      </View>
      <View style={styles.skeletonItem} />
      <View style={styles.skeletonItem} />
      <View style={styles.skeletonItem} />
      <Animated.View style={[styles.shimmer, animatedStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
    padding: 20,
    justifyContent: "center",
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#222",
  },
  textContainer: {
    marginLeft: 10,
    flex: 1,
  },
  textLine: {
    width: "90%",
    height: 10,
    backgroundColor: "#222",
    borderRadius: 4,
    marginBottom: 10,
  },
  skeletonItem: {
    width: "100%",
    height: 80,
    backgroundColor: "#222",
    borderRadius: 10,
    marginBottom: 10,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    transform: [{ translateX: -width }],
  },
});

export default SkeletonLoader;
