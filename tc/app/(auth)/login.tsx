import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { loginStudent, loginUser } from '../../services/api';
import { Stack } from 'expo-router';

export default function Login() {
    const [role, setRole] = useState<'student' | 'user'>('student');
    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleLogin = async () => {
        if (!mobile || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            let response;
            if (role === 'student') {
                response = await loginStudent(mobile, password);
                console.log("Student Login response:", response.data);

                if (response.data?.success && response.data?.data) {
                    const { student, accessToken, refreshToken } = response.data.data;
                    await login('student', student, accessToken, refreshToken);
                } else {
                    throw new Error(response.data?.message || 'Login failed');
                }
            } else {
                response = await loginUser(mobile, password);
                console.log("User Login response:", response.data);

                if (response.data?.success && response.data?.data) {
                    const { user: userData, accessToken, refreshToken } = response.data.data;
                    await login('user', userData, accessToken, refreshToken);
                } else {
                    throw new Error(response.data?.message || 'Login failed');
                }
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || error.message || 'Something went wrong';
            Alert.alert('Login Failed', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.appTitle}>Coaching App</Text>
                    <Text style={styles.subtitle}>Welcome back!</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.toggleContainer}>
                        <TouchableOpacity
                            style={[styles.toggleButton, role === 'student' && styles.activeToggle]}
                            onPress={() => setRole('student')}
                        >
                            <Text style={[styles.toggleText, role === 'student' && styles.activeToggleText]}>Student</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleButton, role === 'user' && styles.activeToggle]}
                            onPress={() => setRole('user')}
                        >
                            <Text style={[styles.toggleText, role === 'user' && styles.activeToggleText]}>Teacher</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.roleTitle}>{role === 'student' ? 'Student Login' : 'Teacher Login'}</Text>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Mobile Number</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your mobile number"
                            placeholderTextColor="#A0A0A0"
                            keyboardType="phone-pad"
                            value={mobile}
                            onChangeText={setMobile}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.passwordInputWrapper}>
                            <TextInput
                                style={[styles.input, styles.passwordInput]}
                                placeholder="Enter your password"
                                placeholderTextColor="#A0A0A0"
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={setPassword}
                            />
                            <TouchableOpacity
                                style={styles.passwordToggle}
                                onPress={() => setShowPassword((current) => !current)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={22}
                                    color="#3182CE"
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.loginButtonText}>Login</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        marginBottom: 30,
        alignItems: 'center',
    },
    appTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        color: '#718096',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#EDF2F7',
        borderRadius: 12,
        padding: 4,
        marginBottom: 24,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeToggle: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#718096',
    },
    activeToggleText: {
        color: '#4A5568',
    },
    roleTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 20,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4A5568',
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: '#F7FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#2D3748',
    },
    passwordInputWrapper: {
        position: 'relative',
        justifyContent: 'center',
    },
    passwordInput: {
        paddingRight: 72,
    },
    passwordToggle: {
        position: 'absolute',
        right: 16,
        paddingVertical: 4,
    },
    loginButton: {
        backgroundColor: '#3182CE',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#3182CE',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
