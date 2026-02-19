import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getStudentProfile } from '../../services/api';

export default function StudentProfile() {
    const { logout, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [profileData, setProfileData] = useState<any>(user);

    const fetchProfile = async () => {
        try {
            const res = await getStudentProfile();
            if (res?.data?.success) {
                setProfileData(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [])
    );

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                    },
                },
            ]
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} />}
            showsVerticalScrollIndicator={false}
        >
            {/* Profile Header */}
            <View style={styles.profileHeader}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {profileData?.name?.charAt(0)?.toUpperCase() || 'S'}
                    </Text>
                </View>
                <Text style={styles.profileName}>{profileData?.name || 'Student'}</Text>
                <View style={styles.rollBadge}>
                    <Text style={styles.rollText}>Roll #{profileData?.rollNumber}</Text>
                </View>
            </View>

            {/* Personal Details Card */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Personal Details</Text>
                <Text style={styles.cardSubtitle}>Your account information</Text>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Name</Text>
                    <Text style={styles.infoValue}>{profileData?.name || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{profileData?.email || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Mobile</Text>
                    <Text style={styles.infoValue}>{profileData?.mobile || '-'}</Text>
                </View>
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoLabel}>Batch</Text>
                    <Text style={styles.infoValue}>{profileData?.batch?.name || '-'}</Text>
                </View>
            </View>

            {/* Parent Details Card */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Parent Details</Text>
                <Text style={styles.cardSubtitle}>Guardian information</Text>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Parent Name</Text>
                    <Text style={styles.infoValue}>{profileData?.parentName || '-'}</Text>
                </View>
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoLabel}>Parent Mobile</Text>
                    <Text style={styles.infoValue}>{profileData?.parentMobile || '-'}</Text>
                </View>
            </View>

            {/* Verification Status */}
            <View style={styles.card}>
                <View style={styles.verificationRow}>
                    <Text style={styles.cardTitle}>Email Verification</Text>
                    <View style={[
                        styles.verificationBadge,
                        { backgroundColor: profileData?.isVerified ? '#DCFCE7' : '#FEF3C7' }
                    ]}>
                        <Text style={[
                            styles.verificationText,
                            { color: profileData?.isVerified ? '#16A34A' : '#D97706' }
                        ]}>
                            {profileData?.isVerified ? 'Verified' : 'Pending'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Logout */}
            <View style={styles.section}>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    contentContainer: {
        padding: 20,
        paddingTop: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFF',
    },
    profileName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 8,
    },
    rollBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
    },
    rollText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#007AFF',
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 13,
        color: '#94A3B8',
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    infoLabel: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    infoValue: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '600',
        maxWidth: '55%',
        textAlign: 'right',
    },
    verificationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    verificationBadge: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 12,
    },
    verificationText: {
        fontSize: 13,
        fontWeight: '700',
    },
    section: {
        marginBottom: 40,
    },
    logoutButton: {
        backgroundColor: '#FEB2B2',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    logoutText: {
        color: '#C53030',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
