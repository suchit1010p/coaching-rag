import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    FlatList,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import {
    getStudentSubjects,
    getStudentAttendanceHistory,
} from '../../services/api';

export default function StudentAttendance() {
    const { user } = useAuth();

    const [subjects, setSubjects] = useState<any[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [attendanceEntries, setAttendanceEntries] = useState<any[]>([]);
    const [statistics, setStatistics] = useState<any>(null);

    const fetchSubjects = async () => {
        try {
            const response = await getStudentSubjects();
            if (response.data?.success) {
                const subjectList = response.data.data || [];
                setSubjects(subjectList);
                if (subjectList.length > 0 && !selectedSubject) {
                    setSelectedSubject(subjectList[0]);
                    fetchAttendance(subjectList[0]._id);
                }
            }
        } catch (error) {
            console.error('Error fetching subjects:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchAttendance = async (subjectId?: string) => {
        setAttendanceLoading(true);
        try {
            const response = await getStudentAttendanceHistory(subjectId);
            if (response.data?.success) {
                const data = response.data.data;
                setAttendanceEntries(data.attendanceEntries || []);
                setStatistics(data.statistics || null);
            }
        } catch (error) {
            console.error('Error fetching attendance:', error);
            setAttendanceEntries([]);
            setStatistics(null);
        } finally {
            setAttendanceLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchSubjects();
        }, [])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        if (selectedSubject) {
            fetchAttendance(selectedSubject._id);
        } else {
            fetchSubjects();
        }
    }, [selectedSubject]);

    const handleSelectSubject = (subject: any) => {
        setSelectedSubject(subject);
        setAttendanceEntries([]);
        setStatistics(null);
        fetchAttendance(subject._id);
    };

    const handleShowAll = () => {
        setSelectedSubject(null);
        setAttendanceEntries([]);
        setStatistics(null);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const getPercentageColor = (percentage: number) => {
        if (percentage >= 75) return '#16A34A';
        if (percentage >= 50) return '#F59E0B';
        return '#DC2626';
    };

    const renderSubjectChip = ({ item }: { item: any }) => {
        const isSelected = selectedSubject?._id === item._id;
        return (
            <TouchableOpacity
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => isSelected ? handleShowAll() : handleSelectSubject(item)}
            >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {item.name}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderAttendanceItem = ({ item }: { item: any }) => {
        const isPresent = item.status === 'PRESENT';
        const attendance = item.attendance;

        return (
            <View style={styles.attendanceCard}>
                <View style={[styles.statusDot, { backgroundColor: isPresent ? '#16A34A' : '#DC2626' }]} />
                <View style={styles.attendanceInfo}>
                    <Text style={styles.attendanceSubject}>
                        {attendance?.subject?.name || 'Unknown Subject'}
                    </Text>
                    <Text style={styles.attendanceDate}>
                        {attendance?.date ? formatDate(attendance.date) : 'Unknown Date'}
                    </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isPresent ? '#DCFCE7' : '#FEE2E2' }]}>
                    <Text style={[styles.statusText, { color: isPresent ? '#16A34A' : '#DC2626' }]}>
                        {item.status}
                    </Text>
                </View>
            </View>
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
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Attendance</Text>
                <Text style={styles.headerSubtitle}>{user?.name || 'Student'}</Text>
            </View>

            {/* Subject Filter Chips */}
            <View style={styles.chipListWrapper}>
                <FlatList
                    data={subjects}
                    renderItem={renderSubjectChip}
                    keyExtractor={(item) => item._id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipContainer}
                    style={styles.chipList}
                />
            </View>

            {/* Statistics Card */}
            {selectedSubject && statistics && !attendanceLoading && (
                <View style={styles.statsCard}>
                    <Text style={styles.statsTitle}>{selectedSubject.name}</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{statistics.totalClasses}</Text>
                            <Text style={styles.statLabel}>Total</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: '#16A34A' }]}>{statistics.present}</Text>
                            <Text style={styles.statLabel}>Present</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: '#DC2626' }]}>{statistics.absent}</Text>
                            <Text style={styles.statLabel}>Absent</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={[
                                styles.statValue,
                                { color: getPercentageColor(statistics.attendancePercentage) }
                            ]}>
                                {statistics.attendancePercentage}%
                            </Text>
                            <Text style={styles.statLabel}>Percentage</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Attendance List or Prompt */}
            {!selectedSubject ? (
                <View style={styles.promptContainer}>
                    <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.promptText}>
                        Select a subject above to view your attendance history.
                    </Text>
                </View>
            ) : attendanceLoading ? (
                <View style={styles.loadingSubContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : (
                <View style={styles.attendanceListWrapper}>
                    <FlatList
                        data={attendanceEntries}
                        renderItem={renderAttendanceItem}
                        keyExtractor={(item) => item._id}
                        contentContainerStyle={styles.listContent}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="checkmark-circle-outline" size={48} color="#CBD5E1" />
                                <Text style={styles.emptyText}>No attendance records found.</Text>
                            </View>
                        }
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        paddingTop: 20,
        paddingHorizontal: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    loadingSubContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        marginTop: 20,
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 2,
    },
    chipListWrapper: {
        flexShrink: 0,
    },
    chipList: {
        flexGrow: 0,
        minHeight: 52,
        marginBottom: 16,
    },
    chipContainer: {
        gap: 8,
        paddingRight: 8,
        paddingVertical: 4,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignSelf: 'flex-start',
        flexShrink: 0,
        maxWidth: 220,
    },
    chipActive: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    chipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        lineHeight: 18,
    },
    chipTextActive: {
        color: '#FFF',
    },
    statsCard: {
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
    statsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    statLabel: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 4,
        fontWeight: '500',
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: '#E2E8F0',
    },
    promptContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    attendanceListWrapper: {
        flex: 1,
        minHeight: 0,
    },
    promptText: {
        color: '#94A3B8',
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    listContent: {
        paddingBottom: 20,
    },
    attendanceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 14,
        borderRadius: 14,
        marginBottom: 10,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 12,
    },
    attendanceInfo: {
        flex: 1,
    },
    attendanceSubject: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
    },
    attendanceDate: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    emptyState: {
        padding: 60,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    emptyText: {
        color: '#94A3B8',
        fontSize: 16,
        textAlign: 'center',
    },
});
