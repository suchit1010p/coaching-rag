import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function Index() {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (user && role === 'student') return <Redirect href={"/(student)/dashboard" as any} />;
  if (user && role === 'user') return <Redirect href={"/(user)/dashboard" as any} />;

  return <Redirect href={"/(auth)/login" as any} />;
}
