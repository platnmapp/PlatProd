import React, { useEffect, useState } from "react";
import { Modal } from "react-native";
import ShareExtension from "../components/ShareExtension";
import "../global.css";

// This would be called by the iOS share extension
export default function ShareExtensionApp() {
  const [sharedText, setSharedText] = useState<string>("");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // This would be replaced by actual share extension data handling
    // For now, we'll simulate receiving shared data
    handleIncomingShare();
  }, []);

  const handleIncomingShare = async () => {
    // In a real implementation, this would get data from iOS share extension
    // For demonstration, we'll show how it would work

    // Example: const sharedData = await getSharedData();
    // setSharedText(sharedData.text || "");
    // setIsVisible(true);

    console.log("Share extension would handle incoming share here");
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Close the share extension
    // In iOS, this would call the completion handler
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDismiss}
    >
      <ShareExtension sharedText={sharedText} onDismiss={handleDismiss} />
    </Modal>
  );
}
