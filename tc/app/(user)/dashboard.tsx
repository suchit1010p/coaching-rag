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
import {
    addUnitToSubject,
    createBatch,
    createSubject,
    deleteSubjectFromBatch,
    deleteUnitFromSubject as deleteUnitFromSubjectApi,
    getAllBatches,
    getAllSubjectsOfBatch,
    getAllUnitsOfSubject,
    updateUnitName,
    updateSubjectName,
} from '../../services/api';

export default function UserDashboard() {
    const { user } = useAuth();
    const router = useRouter();

    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [batches, setBatches] = useState<any[]>([]);

    const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [subjectsLoading, setSubjectsLoading] = useState(false);
    const [selectedSubject, setSelectedSubject] = useState<any | null>(null);
    const [units, setUnits] = useState<any[]>([]);
    const [unitsLoading, setUnitsLoading] = useState(false);

    const [createBatchModalVisible, setCreateBatchModalVisible] = useState(false);
    const [newBatchName, setNewBatchName] = useState('');
    const [creatingBatch, setCreatingBatch] = useState(false);

    const [createSubjectModalVisible, setCreateSubjectModalVisible] = useState(false);
    const [newSubjectName, setNewSubjectName] = useState('');
    const [creatingSubject, setCreatingSubject] = useState(false);

    const [renameSubjectModalVisible, setRenameSubjectModalVisible] = useState(false);
    const [editingSubject, setEditingSubject] = useState<any | null>(null);
    const [updatedSubjectName, setUpdatedSubjectName] = useState('');
    const [renamingSubject, setRenamingSubject] = useState(false);
    const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);

    const [createUnitModalVisible, setCreateUnitModalVisible] = useState(false);
    const [newUnitName, setNewUnitName] = useState('');
    const [creatingUnit, setCreatingUnit] = useState(false);

    const [renameUnitModalVisible, setRenameUnitModalVisible] = useState(false);
    const [editingUnit, setEditingUnit] = useState<any | null>(null);
    const [updatedUnitName, setUpdatedUnitName] = useState('');
    const [renamingUnit, setRenamingUnit] = useState(false);
    const [deletingUnitId, setDeletingUnitId] = useState<string | null>(null);

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

                if (renameSubjectModalVisible) {
                    setRenameSubjectModalVisible(false);
                    return true;
                }

                if (renameUnitModalVisible) {
                    setRenameUnitModalVisible(false);
                    return true;
                }

                if (createUnitModalVisible) {
                    setCreateUnitModalVisible(false);
                    return true;
                }

                if (selectedSubject) {
                    handleBackToSubjects();
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
        }, [selectedBatch, selectedSubject, createSubjectModalVisible, createBatchModalVisible, renameSubjectModalVisible, renameUnitModalVisible, createUnitModalVisible])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        if (selectedSubject?._id) {
            fetchUnits(selectedSubject._id);
        } else if (selectedBatch?._id) {
            fetchSubjects(selectedBatch._id);
        } else {
            fetchBatches();
        }
    }, [selectedBatch, selectedSubject]);

    const handleOpenBatch = (batch: any) => {
        setSelectedBatch(batch);
        setSubjects([]);
        fetchSubjects(batch._id);
    };

    const handleBackToHome = () => {
        setSelectedBatch(null);
        setSubjects([]);
        setSelectedSubject(null);
        setUnits([]);
        setCreateSubjectModalVisible(false);
        setRenameSubjectModalVisible(false);
        setEditingSubject(null);
        setUpdatedSubjectName('');
        setCreateUnitModalVisible(false);
        setRenameUnitModalVisible(false);
        setEditingUnit(null);
        setUpdatedUnitName('');
    };

    const handleBackToSubjects = () => {
        setSelectedSubject(null);
        setUnits([]);
        setCreateUnitModalVisible(false);
        setRenameUnitModalVisible(false);
        setEditingUnit(null);
        setUpdatedUnitName('');
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

    const fetchUnits = async (subjectId: string) => {
        setUnitsLoading(true);
        try {
            const response = await getAllUnitsOfSubject(subjectId);
            if (response.data?.success) {
                setUnits(response.data?.data || []);
            } else {
                setUnits([]);
            }
        } catch (error) {
            console.error('Error fetching units:', error);
            setUnits([]);
        } finally {
            setUnitsLoading(false);
            setRefreshing(false);
        }
    };

    const handleSubjectPress = (subject: any) => {
        setSelectedSubject(subject);
        setUnits([]);
        fetchUnits(subject._id);
    };

    const openRenameSubjectModal = (subject: any) => {
        setEditingSubject(subject);
        setUpdatedSubjectName(subject?.name || '');
        setRenameSubjectModalVisible(true);
    };

    const handleRenameSubject = async () => {
        if (!editingSubject?._id || !updatedSubjectName.trim()) {
            Alert.alert('Error', 'Please enter a valid subject name.');
            return;
        }

        setRenamingSubject(true);
        try {
            const response = await updateSubjectName(editingSubject._id, updatedSubjectName.trim());
            if (response.data?.success) {
                Alert.alert('Success', 'Subject name updated successfully');
                setRenameSubjectModalVisible(false);
                setEditingSubject(null);
                setUpdatedSubjectName('');
                if (selectedBatch?._id) {
                    fetchSubjects(selectedBatch._id);
                }
            } else {
                Alert.alert('Error', response.data?.message || 'Failed to update subject name');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to update subject name');
        } finally {
            setRenamingSubject(false);
        }
    };

    const handleDeleteSubject = async (subject: any) => {
        setDeletingSubjectId(subject._id);
        try {
            const response = await deleteSubjectFromBatch(subject._id);
            if (response.data?.success) {
                setSubjects((prev) => prev.filter((s) => s._id !== subject._id));
                Alert.alert('Deleted', 'Subject deleted successfully');
            } else {
                Alert.alert('Error', response.data?.message || 'Failed to delete subject');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to delete subject');
        } finally {
            setDeletingSubjectId(null);
        }
    };

    const confirmDeleteSubject = (subject: any) => {
        Alert.alert(
            'Delete Subject',
            `Are you sure you want to delete "${subject.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => handleDeleteSubject(subject),
                },
            ]
        );
    };

    const handleCreateUnit = async () => {
        if (!newUnitName.trim() || !selectedSubject?._id) {
            Alert.alert('Error', 'Please enter a unit name');
            return;
        }

        setCreatingUnit(true);
        try {
            const response = await addUnitToSubject(selectedSubject._id, newUnitName.trim());
            if (response.data?.success) {
                Alert.alert('Success', 'Unit added successfully');
                setCreateUnitModalVisible(false);
                setNewUnitName('');
                fetchUnits(selectedSubject._id);
            } else {
                Alert.alert('Error', response.data?.message || 'Failed to add unit');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to add unit');
        } finally {
            setCreatingUnit(false);
        }
    };

    const openRenameUnitModal = (unit: any) => {
        setEditingUnit(unit);
        setUpdatedUnitName(unit?.title || '');
        setRenameUnitModalVisible(true);
    };

    const handleRenameUnit = async () => {
        if (!editingUnit?._id || !updatedUnitName.trim()) {
            Alert.alert('Error', 'Please enter a valid unit name.');
            return;
        }

        setRenamingUnit(true);
        try {
            const response = await updateUnitName(editingUnit._id, updatedUnitName.trim());
            if (response.data?.success) {
                Alert.alert('Success', 'Unit name updated successfully');
                setRenameUnitModalVisible(false);
                setEditingUnit(null);
                setUpdatedUnitName('');
                if (selectedSubject?._id) {
                    fetchUnits(selectedSubject._id);
                }
            } else {
                Alert.alert('Error', response.data?.message || 'Failed to update unit name');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to update unit name');
        } finally {
            setRenamingUnit(false);
        }
    };

    const handleDeleteUnit = async (unit: any) => {
        setDeletingUnitId(unit._id);
        try {
            const response = await deleteUnitFromSubjectApi(unit._id);
            if (response.data?.success) {
                setUnits((prev) => prev.filter((u) => u._id !== unit._id));
                Alert.alert('Deleted', 'Unit deleted successfully');
            } else {
                Alert.alert('Error', response.data?.message || 'Failed to delete unit');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to delete unit');
        } finally {
            setDeletingUnitId(null);
        }
    };

    const confirmDeleteUnit = (unit: any) => {
        Alert.alert(
            'Delete Unit',
            `Are you sure you want to delete "${unit.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => handleDeleteUnit(unit),
                },
            ]
        );
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
        <TouchableOpacity style={styles.subjectCard} onPress={() => handleSubjectPress(item)} activeOpacity={0.88}>
            <View style={styles.subjectIcon}>
                <Ionicons name="book" size={20} color="#007AFF" />
            </View>
            <View style={styles.subjectInfo}>
                <Text style={styles.subjectName}>{item.name}</Text>
                <Text style={styles.subjectMeta}>Tap to view units</Text>
            </View>
            <View style={styles.subjectActions}>
                <TouchableOpacity
                    style={styles.subjectActionButton}
                    onPress={() => openRenameSubjectModal(item)}
                    disabled={deletingSubjectId === item._id}
                >
                    <Ionicons name="create-outline" size={18} color="#0EA5E9" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.subjectActionButton}
                    onPress={() => confirmDeleteSubject(item)}
                    disabled={deletingSubjectId === item._id}
                >
                    {deletingSubjectId === item._id ? (
                        <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    )}
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </View>
        </TouchableOpacity>
    );

    const renderUnitItem = ({ item }: { item: any }) => (
        <View style={styles.subjectCard}>
            <View style={styles.subjectIcon}>
                <Ionicons name="layers-outline" size={20} color="#007AFF" />
            </View>
            <View style={styles.subjectInfo}>
                <Text style={styles.subjectName}>{item.title}</Text>
                <Text style={styles.subjectMeta}>Materials view will open here</Text>
            </View>
            <View style={styles.subjectActions}>
                <TouchableOpacity
                    style={styles.subjectActionButton}
                    onPress={() => openRenameUnitModal(item)}
                    disabled={deletingUnitId === item._id}
                >
                    <Ionicons name="create-outline" size={18} color="#0EA5E9" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.subjectActionButton}
                    onPress={() => confirmDeleteUnit(item)}
                    disabled={deletingUnitId === item._id}
                >
                    {deletingUnitId === item._id ? (
                        <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    )}
                </TouchableOpacity>
            </View>
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
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={selectedSubject ? handleBackToSubjects : handleBackToHome}
                    >
                        <Ionicons name="arrow-back" size={18} color="#1E293B" />
                        <Text style={styles.backText}>{selectedSubject ? 'Subjects' : 'Home'}</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            <View style={styles.contentHeader}>
                <Text style={styles.sectionTitle}>
                    {selectedSubject
                        ? `${selectedSubject.name} Units`
                        : selectedBatch
                            ? `${selectedBatch.name} Subjects`
                            : 'Your Batches'}
                </Text>

                {selectedSubject ? (
                    <TouchableOpacity style={styles.createButton} onPress={() => setCreateUnitModalVisible(true)}>
                        <Ionicons name="add" size={18} color="#FFF" />
                        <Text style={styles.createButtonText}>Add Unit</Text>
                    </TouchableOpacity>
                ) : selectedBatch ? (
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

            {(selectedBatch && subjectsLoading && !selectedSubject) || (selectedSubject && unitsLoading) ? (
                <View style={styles.loadingSubjectsContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : (
                <FlatList
                    data={selectedSubject ? units : selectedBatch ? subjects : batches}
                    renderItem={selectedSubject ? renderUnitItem : selectedBatch ? renderSubjectItem : renderBatchItem}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>
                                {selectedBatch
                                    ? selectedSubject
                                        ? 'No units found in this subject.'
                                        : 'No subjects found in this batch.'
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

            <Modal
                animationType="slide"
                transparent={true}
                visible={renameSubjectModalVisible}
                onRequestClose={() => setRenameSubjectModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Rename Subject</Text>
                            <TouchableOpacity onPress={() => setRenameSubjectModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>New Subject Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter new subject name"
                                value={updatedSubjectName}
                                onChangeText={setUpdatedSubjectName}
                                autoFocus={true}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setRenameSubjectModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleRenameSubject}
                                disabled={renamingSubject}
                            >
                                {renamingSubject ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Update</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                animationType="slide"
                transparent={true}
                visible={createUnitModalVisible}
                onRequestClose={() => setCreateUnitModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add New Unit</Text>
                            <TouchableOpacity onPress={() => setCreateUnitModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Unit Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Unit 1"
                                value={newUnitName}
                                onChangeText={setNewUnitName}
                                autoFocus={true}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setCreateUnitModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleCreateUnit}
                                disabled={creatingUnit}
                            >
                                {creatingUnit ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Add</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                animationType="slide"
                transparent={true}
                visible={renameUnitModalVisible}
                onRequestClose={() => setRenameUnitModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Rename Unit</Text>
                            <TouchableOpacity onPress={() => setRenameUnitModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>New Unit Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter new unit name"
                                value={updatedUnitName}
                                onChangeText={setUpdatedUnitName}
                                autoFocus={true}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setRenameUnitModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleRenameUnit}
                                disabled={renamingUnit}
                            >
                                {renamingUnit ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Update</Text>
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
    subjectInfo: {
        flex: 1,
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
    subjectMeta: {
        marginTop: 2,
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
    subjectActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    subjectActionButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
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
