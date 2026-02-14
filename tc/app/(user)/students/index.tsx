import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    TextInput,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { deleteStudent as deleteStudentApi, getAllBatches, getAllStudents } from '../../../services/api';

export default function StudentsScreen() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

    const fetchStudents = useCallback(async () => {
        try {
            const [studentsResponse, batchesResponse] = await Promise.all([
                getAllStudents(),
                getAllBatches(),
            ]);

            const studentsData = studentsResponse.data?.data || [];
            const batchesData = batchesResponse.data?.data || [];

            const batchMap = batchesData.reduce((acc: Record<string, string>, batch: any) => {
                acc[batch._id] = batch.name;
                return acc;
            }, {});

            const normalizedStudents = studentsData.map((student: any) => {
                const isBatchObject = typeof student.batch === 'object' && student.batch !== null;
                const batchId = isBatchObject ? student.batch?._id : student.batch;
                const batchName = isBatchObject
                    ? student.batch?.name || batchMap[batchId] || 'Unknown Batch'
                    : batchMap[batchId] || 'Unknown Batch';

                return {
                    ...student,
                    batchName,
                };
            });

            if (studentsResponse.data?.success) {
                setStudents(normalizedStudents);
            }
        } catch (error) {
            console.error('Error fetching students:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchStudents();
        }, [fetchStudents])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchStudents();
    }, [fetchStudents]);

    const filteredStudents = useMemo(() => {
        const query = searchText.trim().toLowerCase();
        if (!query) return students;

        return students.filter((student) => {
            const name = (student.name || '').toLowerCase();
            const mobile = (student.mobile || '').toLowerCase();
            const rollNumber = String(student.rollNumber || '').toLowerCase();
            const batchName = (student.batchName || '').toLowerCase();

            return (
                name.includes(query) ||
                mobile.includes(query) ||
                rollNumber.includes(query) ||
                batchName.includes(query)
            );
        });
    }, [students, searchText]);

    const handleDeleteStudent = async (student: any) => {
        setDeletingStudentId(student._id);
        try {
            const response = await deleteStudentApi(student._id);
            if (response.data?.success) {
                setStudents((prev) => prev.filter((s) => s._id !== student._id));
                setSelectedStudentId(null);
                Alert.alert('Deleted', `${student.name} has been deleted.`);
            } else {
                Alert.alert('Error', response.data?.message || 'Failed to delete student.');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to delete student.');
        } finally {
            setDeletingStudentId(null);
        }
    };

    const confirmDeleteStudent = (student: any) => {
        Alert.alert(
            'Delete Student',
            `Are you sure you want to delete ${student.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => handleDeleteStudent(student),
                },
            ]
        );
    };

    const renderStudentItem = ({ item }: { item: any }) => {
        const isSelected = selectedStudentId === item._id;
        const isDeleting = deletingStudentId === item._id;

        return (
            <TouchableOpacity
                style={styles.studentCard}
                activeOpacity={0.9}
                onPress={() => setSelectedStudentId(isSelected ? null : item._id)}
            >
                <View style={styles.cardTopRow}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{item.name?.charAt(0) || 'S'}</Text>
                    </View>
                    <View style={styles.studentInfo}>
                        <Text style={styles.studentName}>{item.name}</Text>
                        <Text style={styles.studentMeta}>Mobile: {item.mobile}</Text>
                        <Text style={styles.batchText}>Batch: {item.batchName}</Text>

                        {isSelected ? (
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => confirmDeleteStudent(item)}
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="trash" size={14} color="#FFFFFF" />
                                        <Text style={styles.deleteButtonText}>Delete Student</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        ) : null}
                    </View>
                    <View style={styles.rightWrap}>
                        <Text style={styles.rollText}>#{item.rollNumber ?? '-'}</Text>
                        <Ionicons
                            name={isSelected ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color="#64748B"
                        />
                    </View>
                </View>

            </TouchableOpacity>
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
                <View style={styles.headerTextWrap}>
                    <Text style={styles.headerTitle}>Students</Text>
                    <Text style={styles.headerSubtitle}>
                        {filteredStudents.length} of {students.length} students
                    </Text>
                </View>
                <TouchableOpacity style={styles.registerBtn} activeOpacity={0.85}>
                    <Ionicons name="person-add" size={16} color="#FFFFFF" />
                    <Text style={styles.registerBtnText}>Register</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchWrap}>
                <Ionicons name="search" size={18} color="#64748B" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name, roll no, mobile, batch"
                    placeholderTextColor="#94A3B8"
                    value={searchText}
                    onChangeText={setSearchText}
                />
                {searchText ? (
                    <TouchableOpacity onPress={() => setSearchText('')}>
                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                ) : null}
            </View>

            <FlatList
                data={filteredStudents}
                renderItem={renderStudentItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>
                            {students.length === 0 ? 'No students found.' : 'No students match your search.'}
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 20,
        paddingTop: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerTextWrap: {
        flex: 1,
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
    },
    headerSubtitle: {
        marginTop: 2,
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
    },
    registerBtn: {
        backgroundColor: '#007AFF',
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    registerBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    searchWrap: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: '#0F172A',
        paddingVertical: 0,
    },
    listContent: {
        paddingBottom: 16,
    },
    studentCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#007AFF',
    },
    studentInfo: {
        flex: 1,
    },
    studentName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
    },
    studentMeta: {
        marginTop: 2,
        fontSize: 12,
        color: '#64748B',
    },
    batchText: {
        marginTop: 2,
        fontSize: 12,
        color: '#475569',
        fontWeight: '600',
    },
    rollText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
    },
    rightWrap: {
        alignItems: 'flex-end',
        gap: 6,
    },
    deleteButton: {
        backgroundColor: '#DC2626',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 10,
        alignSelf: 'flex-start',
    },
    deleteButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    emptyState: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#94A3B8',
    },
});
