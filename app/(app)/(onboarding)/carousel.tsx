// App.tsx or CarouselScreen.tsx
import React, { useRef, useState } from "react";
import { Dimensions, Pressable, Text, View } from "react-native";
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel";
import SlideOne from "./first";
import SlideTwo from "./second";
import SlideThree from "./third";

const windowWidth = Dimensions.get("window").width;

export default function CarouselScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<ICarouselInstance>(null);

  const carouselData = [
    { key: "slide1", component: <SlideOne /> },
    { key: "slide2", component: <SlideTwo /> },
    { key: "slide3", component: <SlideThree currentIndex={currentIndex} /> },
  ];

  const renderIndicators = () => {
    return (
      <View className="flex-row justify-center items-center mb-8">
        {carouselData.map((_, index) => (
          <View
            key={index}
            className={`mx-1 ${
              index === currentIndex
                ? "w-6 h-2 bg-white rounded-full" // Dash for current page
                : "w-2 h-2 bg-gray-500 rounded-full" // Dot for other pages
            }`}
          />
        ))}
      </View>
    );
  };

  return (
    <View className="flex-1">
      <Carousel
        ref={carouselRef}
        loop={false}
        width={windowWidth}
        autoPlay={false}
        enabled={true}
        data={carouselData}
        onSnapToItem={(index) => setCurrentIndex(index)}
        renderItem={({ item }) => (
          <View className="flex-1" style={{ width: windowWidth }}>
            {item.component}
          </View>
        )}
        withAnimation={{
          type: "spring",
          config: {
            damping: 20,
            stiffness: 90,
          },
        }}
        panGestureHandlerProps={{
          activeOffsetX: [-10, 10],
          failOffsetY: [-5, 5],
        }}
      />

      {/* Indicators */}
      <View className="absolute bottom-4 left-0 right-0">
        {renderIndicators()}
      </View>
    </View>
  );
}
