import React, { Component, ErrorInfo, ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: "#000",
            padding: 20,
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: "#ff0000",
              fontSize: 24,
              fontWeight: "bold",
              marginBottom: 20,
            }}
          >
            Something went wrong
          </Text>
          <ScrollView>
            <Text style={{ color: "#fff", fontSize: 16, marginBottom: 10 }}>
              {this.state.error?.toString()}
            </Text>
            {this.state.errorInfo && (
              <Text style={{ color: "#888", fontSize: 12, marginTop: 10 }}>
                {this.state.errorInfo.componentStack}
              </Text>
            )}
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

// Add default export for Expo Router
export default ErrorBoundary;

