import React from "react";
import { Text } from "react-native";
import * as Animatable from "react-native-animatable";

export default function Search() {
  return (
    <Animatable.View
      animation="fadeIn"
      duration={500}
      style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
    >
      <Text>Search</Text>
    </Animatable.View>
  );
}
