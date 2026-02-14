import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Modal,
    TextInput,
    Alert,
    FlatList,
    BackHandler,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { createBatch, createSubject, getAllBatches, getAllSubjectsOfBatch } from '../../services/api';

export default function UserDashboard() {
    const { user } = useAuth();
    const router = useRouter();

    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [batches, setBatches] = useState<any[]>([]);

    const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [subjectsLoading, setSubjectsLoading] = useState(false);

    const [createBatchModalVisible, setCreateBatchModalVisible] = useState(false);
    const [newBatchName, setNewBatchName] = useState('');
    const [creatingBatch, setCreatingBatch] = useState(false);

    const [createSubjectModalVisible, setCreateSubjectModalVisible] = useState(false);
    const [newSubjectName, setNewSubjectName] = useState('');
    const [creatingSubject, setCreatingSubject] = useState(false);

    const fetchBatches = async () => {
        try {
            const response = await getAllBatches();
            if (response.data?.success) {
                const fetchedBatches = response.data.data || [];

                const sortedBatches = fetchedBatches.sort((a: any, b: any) => {
                    const getNumber = (str: string) => {
                        const match = str.match(/\d+/);
                        return match ? parseInt(match[0], 10) : Infinity;
                    };

                    const numA = getNumber(a.name);
                    const numB = getNumber(b.name);

                    if (numA !== numB) return numB - numA;
                    return a.name.localeCompare(b.name);
                });

                setBatches(sortedBatches);
            }
        } catch (error) {
            console.error('Error fetching batches:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchSubjects = async (batchId: string) => {
        setSubjectsLoading(true);
        try {
            const response = await getAllSubjectsOfBatch(batchId);
            if (response.data?.success) {
                setSubjects(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching subjects:', error);
        } finally {
            setSubjectsLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchBatches();
        }, [])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (createSubjectModalVisible) {
                    setCreateSubjectModalVisible(false);
                    return true;
                }

                if (createBatchModalVisible) {
                    setCreateBatchModalVisible(false);
                    return true;
                }

                if (selectedBatch) {
                    handleBackToHome();
                    return true;
                }

                return false;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [selectedBatch, createSubjectModalVisible, createBatchModalVisible])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        if (selectedBatch?._id) {
            fetchSubjects(selectedBatch._id);
        } else {
            fetchBatches();
        }
    }, [selectedBatch]);

    const handleOpenBatch = (batch: any) => {
        setSelectedBatch(batch);
        setSubjects([]);
        fetchSubjects(batch._id);
    };

    const handleBackToHome = () => {
        setSelectedBatch(null);
        setSubjects([]);
        setCreateSubjectModalVisible(false);
    };

    const handleCreateBatch = async () => {
        if (!newBatchName.trim()) {
            Alert.alert('Error', 'Please enter a batch name');
            return;
        }

        setCreatingBatch(true);
        try {
            const response = await createBatch(newBatchName);
            if (response.data?.success) {
                Alert.alert('Success', 'Batch created successfully');
                setCreateBatchModalVisible(false);
                setNewBatchName('');
                fetchBatches();
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to create batch');
        } finally {
            setCreatingBatch(false);
        }
    };

    const handleCreateSubject = async () => {
        if (!newSubjectName.trim() || !selectedBatch?._id) {
            Alert.alert('Error', 'Please enter a subject name');
            return;
        }

        setCreatingSubject(true);
        try {
            const response = await createSubject(newSubjectName, selectedBatch._id);
            if (response.data?.success) {
                Alert.alert('Success', 'Subject created successfully');
                setCreateSubjectModalVisible(false);
                setNewSubjectName('');
                fetchSubjects(selectedBatch._id);
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to create subject');
        } finally {
            setCreatingSubject(false);
        }
    };

    const renderBatchItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.batchCard} onPress={() => handleOpenBatch(item)}>
            <View style={styles.batchIcon}>
                <Ionicons name="people" size={24} color="#007AFF" />
            </View>
            <View style={styles.batchInfo}>
                <Text style={styles.batchName}>{item.name}</Text>
                <Text style={styles.batchDetails}>Tap to view subjects</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>
    );

    const renderSubjectItem = ({ item }: { item: any }) => (
        <View style={styles.subjectCard}>
            <View style={styles.subjectIcon}>
                <Ionicons name="book" size={20} color="#007AFF" />
            </View>
            <Text style={styles.subjectName}>{item.name}</Text>
        </View>
    );

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
                <View>
                    <Text style={styles.welcomeText}>Welcome back,</Text>
                    <Text style={styles.nameText}>{user?.name?.split(' ')[0] || 'Teacher'}</Text>
                </View>
                <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/(user)/profile')}>
                    <Ionicons name="person-circle-outline" size={40} color="#CBD5E1" />
                </TouchableOpacity>
            </View>

            {selectedBatch ? (
                <View style={styles.backRow}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBackToHome}>
                        <Ionicons name="arrow-back" size={18} color="#1E293B" />
                        <Text style={styles.backText}>Home</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            <View style={styles.contentHeader}>
                <Text style={styles.sectionTitle}>
                    {selectedBatch ? `${selectedBatch.name} Subjects` : 'Your Batches'}
                </Text>

                {selectedBatch ? (
                    <TouchableOpacity style={styles.createButton} onPress={() => setCreateSubjectModalVisible(true)}>
                        <Ionicons name="add" size={18} color="#FFF" />
                        <Text style={styles.createButtonText}>Add Subject</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.createButton} onPress={() => setCreateBatchModalVisible(true)}>
                        <Ionicons name="add" size={20} color="#FFF" />
                        <Text style={styles.createButtonText}>Create Batch</Text>
                    </TouchableOpacity>
                )}
            </View>

            {selectedBatch && subjectsLoading ? (
                <View style={styles.loadingSubjectsContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : (
                <FlatList
                    data={selectedBatch ? subjects : batches}
                    renderItem={selectedBatch ? renderSubjectItem : renderBatchItem}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>
                                {selectedBatch
                                    ? 'No subjects found in this batch.'
                                    : 'No batches found. Create one to get started.'}
                            </Text>
                        </View>
                    }
                />
            )}

            <Modal
                animationType="slide"
                transparent={true}
                visible={createBatchModalVisible}
                onRequestClose={() => setCreateBatchModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Create New Batch</Text>
                            <TouchableOpacity onPress={() => setCreateBatchModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Batch Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Class 10 - Science"
                                value={newBatchName}
                                onChangeText={setNewBatchName}
                                autoFocus={true}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setCreateBatchModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleCreateBatch}
                                disabled={creatingBatch}
                            >
                                {creatingBatch ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Create Batch</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                animationType="slide"
                transparent={true}
                visible={createSubjectModalVisible}
                onRequestClose={() => setCreateSubjectModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add New Subject</Text>
                            <TouchableOpacity onPress={() => setCreateSubjectModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Subject Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Mathematics"
                                value={newSubjectName}
                                onChangeText={setNewSubjectName}
                                autoFocus={true}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setCreateSubjectModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleCreateSubject}
                                disabled={creatingSubject}
                            >
                                {creatingSubject ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Add</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    loadingSubjectsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        marginTop: 20,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    welcomeText: {
        fontSize: 16,
        color: '#64748B',
    },
    nameText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    profileButton: {
        padding: 4,
    },
    backRow: {
        marginBottom: 8,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        width: 70,
    },
    backText: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '600',
    },
    contentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#007AFF',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        gap: 6,
    },
    createButtonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 14,
    },
    listContent: {
        paddingBottom: 20,
    },
    batchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    batchIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    batchInfo: {
        flex: 1,
    },
    batchName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 4,
    },
    batchDetails: {
        fontSize: 13,
        color: '#64748B',
    },
    subjectCard: {
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
    subjectIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    subjectName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: '#94A3B8',
        fontSize: 16,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    inputContainer: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1E293B',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#F1F5F9',
    },
    saveButton: {
        backgroundColor: '#007AFF',
    },
    cancelButtonText: {
        color: '#64748B',
        fontWeight: '600',
        fontSize: 16,
    },
    saveButtonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 16,
    },
});
