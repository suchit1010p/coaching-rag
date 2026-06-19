import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function UserLayout() {
    const { role, isLoading } = useAuth();

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    if (role !== 'user') {
        return <Redirect href="/" />;
    }

    return (
        <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#007AFF' }}>
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="students/index" // Note: file is at app/(user)/students/index.tsx, but routed as students/index or students? Expo router file based routing. Let's check listing again.

                options={{
                    title: 'Students',
                    tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="attendance"
                options={{
                    title: 'Attendance',
                    tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="ai-chat"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}
