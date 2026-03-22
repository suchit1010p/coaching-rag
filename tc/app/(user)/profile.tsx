import { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, getAllBatches, deleteBatch, deleteAllStudentsFromBatch, deleteAllAttendanceFromBatch, registerUser, getAllSubjectsOfBatch, changeAllStudentsBatch, changeUserPassword } from '../../services/api';

interface Batch {
    _id: string;
    name: string;
}

interface Subject {
    _id: string;
    name: string;
}

export default function Profile() {
    const { logout, user } = useAuth();

    const [batches, setBatches] = useState<Batch[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
    const [batchMenuOpen, setBatchMenuOpen] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [selectedBatchForStudentDelete, setSelectedBatchForStudentDelete] = useState<Batch | null>(null);
    const [studentDeleteMenuOpen, setStudentDeleteMenuOpen] = useState(false);
    const [studentDeleteConfirmText, setStudentDeleteConfirmText] = useState('');
    const [showStudentDeleteConfirm, setShowStudentDeleteConfirm] = useState(false);
    const [deletingStudents, setDeletingStudents] = useState(false);
    const [selectedBatchForAttendanceDelete, setSelectedBatchForAttendanceDelete] = useState<Batch | null>(null);
    const [attendanceDeleteMenuOpen, setAttendanceDeleteMenuOpen] = useState(false);
    const [attendanceDeleteConfirmText, setAttendanceDeleteConfirmText] = useState('');
    const [showAttendanceDeleteConfirm, setShowAttendanceDeleteConfirm] = useState(false);
    const [deletingAttendance, setDeletingAttendance] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [profileData, setProfileData] = useState<any>(user);
    const scrollViewRef = useRef<ScrollView>(null);

    // Register User state
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regMobile, setRegMobile] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [registering, setRegistering] = useState(false);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);

    // Change All Students Batch state
    const [showChangeBatchForm, setShowChangeBatchForm] = useState(false);
    const [oldBatch, setOldBatch] = useState<Batch | null>(null);
    const [newBatch, setNewBatch] = useState<Batch | null>(null);
    const [oldBatchMenuOpen, setOldBatchMenuOpen] = useState(false);
    const [newBatchMenuOpen, setNewBatchMenuOpen] = useState(false);
    const [newBatchSubjects, setNewBatchSubjects] = useState<Subject[]>([]);
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
    const [loadingSubjects, setLoadingSubjects] = useState(false);
    const [changingBatch, setChangingBatch] = useState(false);

    const fetchData = async () => {
        try {
            const [profileRes, batchesRes] = await Promise.all([
                getUserProfile(),
                getAllBatches(),
            ]);
            if (profileRes?.data?.success) {
                setProfileData(profileRes.data.data);
            }
            if (batchesRes?.data?.success) {
                setBatches(batchesRes.data.data || []);
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, []);

    const handleSelectBatch = (batch: Batch) => {
        setSelectedBatch(batch);
        setBatchMenuOpen(false);
        setShowConfirm(false);
        setConfirmText('');
    };

    const handleDeletePress = () => {
        if (!selectedBatch) {
            Alert.alert('Error', 'Please select a batch first');
            return;
        }
        setShowConfirm(true);
        setConfirmText('');
    };

    const handleConfirmDelete = async () => {
        if (!selectedBatch) return;

        const expectedText = `${selectedBatch.name} delete`;
        if (confirmText.trim() !== expectedText) {
            Alert.alert('Error', `Please type "${expectedText}" to confirm deletion`);
            return;
        }

        setDeleting(true);
        try {
            const res = await deleteBatch(selectedBatch._id);
            if (res?.data?.success) {
                Alert.alert('Success', 'Batch deleted successfully');
                setSelectedBatch(null);
                setShowConfirm(false);
                setConfirmText('');
                setBatches((prev) => prev.filter((b) => b._id !== selectedBatch._id));
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to delete batch');
        } finally {
            setDeleting(false);
        }
    };

    const handleCancelDelete = () => {
        setShowConfirm(false);
        setConfirmText('');
    };

    const handleSelectBatchForStudentDelete = (batch: Batch) => {
        setSelectedBatchForStudentDelete(batch);
        setStudentDeleteMenuOpen(false);
        setShowStudentDeleteConfirm(false);
        setStudentDeleteConfirmText('');
    };

    const handleDeleteAllStudentsPress = () => {
        if (!selectedBatchForStudentDelete) {
            Alert.alert('Error', 'Please select a batch first');
            return;
        }
        setShowStudentDeleteConfirm(true);
        setStudentDeleteConfirmText('');
    };

    const handleConfirmDeleteAllStudents = async () => {
        if (!selectedBatchForStudentDelete) return;

        const expectedText = `${selectedBatchForStudentDelete.name} delete students`;
        if (studentDeleteConfirmText.trim() !== expectedText) {
            Alert.alert('Error', `Please type "${expectedText}" to confirm deletion`);
            return;
        }

        setDeletingStudents(true);
        try {
            const res = await deleteAllStudentsFromBatch(selectedBatchForStudentDelete._id);
            if (res?.data?.success) {
                Alert.alert('Success', res.data.message || 'All students deleted successfully');
                setSelectedBatchForStudentDelete(null);
                setShowStudentDeleteConfirm(false);
                setStudentDeleteConfirmText('');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to delete students from batch');
        } finally {
            setDeletingStudents(false);
        }
    };

    const handleCancelDeleteAllStudents = () => {
        setShowStudentDeleteConfirm(false);
        setStudentDeleteConfirmText('');
    };

    const handleSelectBatchForAttendanceDelete = (batch: Batch) => {
        setSelectedBatchForAttendanceDelete(batch);
        setAttendanceDeleteMenuOpen(false);
        setShowAttendanceDeleteConfirm(false);
        setAttendanceDeleteConfirmText('');
    };

    const handleDeleteAllAttendancePress = () => {
        if (!selectedBatchForAttendanceDelete) {
            Alert.alert('Error', 'Please select a batch first');
            return;
        }
        setShowAttendanceDeleteConfirm(true);
        setAttendanceDeleteConfirmText('');
    };

    const handleConfirmDeleteAllAttendance = async () => {
        if (!selectedBatchForAttendanceDelete) return;

        const expectedText = `${selectedBatchForAttendanceDelete.name} delete attendance`;
        if (attendanceDeleteConfirmText.trim() !== expectedText) {
            Alert.alert('Error', `Please type "${expectedText}" to confirm deletion`);
            return;
        }

        setDeletingAttendance(true);
        try {
            const res = await deleteAllAttendanceFromBatch(selectedBatchForAttendanceDelete._id);
            if (res?.data?.success) {
                Alert.alert('Success', res.data.message || 'All attendance deleted successfully');
                setSelectedBatchForAttendanceDelete(null);
                setShowAttendanceDeleteConfirm(false);
                setAttendanceDeleteConfirmText('');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to delete attendance from batch');
        } finally {
            setDeletingAttendance(false);
        }
    };

    const handleCancelDeleteAllAttendance = () => {
        setShowAttendanceDeleteConfirm(false);
        setAttendanceDeleteConfirmText('');
    };

    const handleSelectOldBatch = (batch: Batch) => {
        setOldBatch(batch);
        setOldBatchMenuOpen(false);
    };

    const handleSelectNewBatch = async (batch: Batch) => {
        setNewBatch(batch);
        setNewBatchMenuOpen(false);
        setSelectedSubjectIds([]);
        setNewBatchSubjects([]);
        setLoadingSubjects(true);
        try {
            const res = await getAllSubjectsOfBatch(batch._id);
            if (res?.data?.success) {
                setNewBatchSubjects(res.data.data || []);
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch subjects');
        } finally {
            setLoadingSubjects(false);
        }
    };

    const toggleSubjectSelection = (subjectId: string) => {
        setSelectedSubjectIds((prev) =>
            prev.includes(subjectId)
                ? prev.filter((id) => id !== subjectId)
                : [...prev, subjectId]
        );
    };

    const handleChangeAllStudentsBatch = async () => {
        if (!oldBatch) {
            Alert.alert('Error', 'Please select the old batch');
            return;
        }
        if (!newBatch) {
            Alert.alert('Error', 'Please select the new batch');
            return;
        }
        if (oldBatch._id === newBatch._id) {
            Alert.alert('Error', 'Old and new batch cannot be the same');
            return;
        }
        if (selectedSubjectIds.length === 0) {
            Alert.alert('Error', 'Please select at least one subject');
            return;
        }

        Alert.alert(
            'Confirm',
            `Move all students from "${oldBatch.name}" to "${newBatch.name}"? This will delete their old attendance records.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Change',
                    style: 'destructive',
                    onPress: async () => {
                        setChangingBatch(true);
                        try {
                            const res = await changeAllStudentsBatch(oldBatch._id, newBatch._id, selectedSubjectIds);
                            if (res?.data?.success) {
                                Alert.alert('Success', res.data.message || 'All students batch updated successfully');
                                setOldBatch(null);
                                setNewBatch(null);
                                setNewBatchSubjects([]);
                                setSelectedSubjectIds([]);
                            }
                        } catch (error: any) {
                            Alert.alert('Error', error.response?.data?.message || 'Failed to change batch');
                        } finally {
                            setChangingBatch(false);
                        }
                    },
                },
            ]
        );
    };

    const handleRegisterUser = async () => {
        if (!regName.trim() || !regEmail.trim() || !regMobile.trim() || !regPassword.trim()) {
            Alert.alert('Error', 'All fields are required');
            return;
        }

        setRegistering(true);
        try {
            const res = await registerUser({
                name: regName.trim(),
                email: regEmail.trim(),
                mobile: regMobile.trim(),
                password: regPassword.trim(),
            });
            if (res?.data?.success) {
                Alert.alert('Success', 'User registered successfully');
                setRegName('');
                setRegEmail('');
                setRegMobile('');
                setRegPassword('');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to register user');
        } finally {
            setRegistering(false);
        }
    };

    const resetPasswordForm = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    const handleChangePassword = async () => {
        if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
            Alert.alert('Error', 'All password fields are required');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New password and confirm password must match');
            return;
        }

        setChangingPassword(true);
        try {
            const res = await changeUserPassword(currentPassword, newPassword);
            if (res?.data?.success) {
                resetPasswordForm();
                Alert.alert('Success', res.data.message || 'Password changed successfully', [
                    {
                        text: 'OK',
                        onPress: async () => {
                            await logout();
                        },
                    },
                ]);
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to change password');
        } finally {
            setChangingPassword(false);
        }
    };

    const handleLogout = async () => {
        if (Platform.OS === 'web') {
            const confirmed = window.confirm('Are you sure you want to logout?');
            if (confirmed) {
                await logout();
            }
            return;
        }
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

    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
        <ScrollView
            ref={scrollViewRef}
            style={styles.container}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Profile Section */}
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {profileData?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                </View>
                <Text style={styles.name}>{profileData?.name || 'Teacher'}</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Profile Details</Text>

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
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Delete All Students From Batch</Text>
                <Text style={styles.cardSubtitle}>
                    This removes all students and their attendance data from the selected batch
                </Text>

                <Text style={styles.fieldLabel}>Select Batch</Text>
                <TouchableOpacity
                    style={styles.selectInput}
                    onPress={() => setStudentDeleteMenuOpen((prev) => !prev)}
                >
                    <Text
                        style={[
                            styles.selectInputText,
                            !selectedBatchForStudentDelete && styles.selectPlaceholder,
                        ]}
                    >
                        {selectedBatchForStudentDelete ? selectedBatchForStudentDelete.name : 'Select a batch'}
                    </Text>
                    <Text style={styles.selectArrow}>{studentDeleteMenuOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {studentDeleteMenuOpen && (
                    <ScrollView
                        style={styles.selectMenu}
                        nestedScrollEnabled={true}
                    >
                        {batches.length === 0 ? (
                            <View style={styles.selectItem}>
                                <Text style={styles.selectItemText}>No batches found</Text>
                            </View>
                        ) : (
                            batches.map((batch) => (
                                <TouchableOpacity
                                    key={batch._id}
                                    style={[
                                        styles.selectItem,
                                        selectedBatchForStudentDelete?._id === batch._id && styles.selectItemActive,
                                    ]}
                                    onPress={() => handleSelectBatchForStudentDelete(batch)}
                                >
                                    <Text
                                        style={[
                                            styles.selectItemText,
                                            selectedBatchForStudentDelete?._id === batch._id &&
                                                styles.selectItemTextActive,
                                        ]}
                                    >
                                        {batch.name}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>
                )}

                {selectedBatchForStudentDelete && !showStudentDeleteConfirm && (
                    <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAllStudentsPress}>
                        <Text style={styles.deleteButtonText}>Delete All Students</Text>
                    </TouchableOpacity>
                )}

                {showStudentDeleteConfirm && selectedBatchForStudentDelete && (
                    <View style={styles.confirmSection}>
                        <Text style={styles.confirmLabel}>
                            Type "<Text style={styles.confirmHighlight}>{selectedBatchForStudentDelete.name} delete students</Text>" to confirm
                        </Text>
                        <TextInput
                            style={styles.confirmInput}
                            value={studentDeleteConfirmText}
                            onChangeText={setStudentDeleteConfirmText}
                            placeholder={`${selectedBatchForStudentDelete.name} delete students`}
                            placeholderTextColor="#CBD5E1"
                            autoCapitalize="none"
                            onFocus={() => {
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                }, 300);
                            }}
                        />
                        <View style={styles.confirmButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={handleCancelDeleteAllStudents}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.confirmDeleteButton,
                                    studentDeleteConfirmText.trim() !== `${selectedBatchForStudentDelete.name} delete students` &&
                                        styles.confirmDeleteButtonDisabled,
                                ]}
                                onPress={handleConfirmDeleteAllStudents}
                                disabled={
                                    deletingStudents ||
                                    studentDeleteConfirmText.trim() !== `${selectedBatchForStudentDelete.name} delete students`
                                }
                            >
                                {deletingStudents ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.confirmDeleteButtonText}>
                                        Confirm Delete
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Delete All Attendance From Batch</Text>
                <Text style={styles.cardSubtitle}>
                    This removes all attendance sessions and attendance entries of the selected batch
                </Text>

                <Text style={styles.fieldLabel}>Select Batch</Text>
                <TouchableOpacity
                    style={styles.selectInput}
                    onPress={() => setAttendanceDeleteMenuOpen((prev) => !prev)}
                >
                    <Text
                        style={[
                            styles.selectInputText,
                            !selectedBatchForAttendanceDelete && styles.selectPlaceholder,
                        ]}
                    >
                        {selectedBatchForAttendanceDelete ? selectedBatchForAttendanceDelete.name : 'Select a batch'}
                    </Text>
                    <Text style={styles.selectArrow}>{attendanceDeleteMenuOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {attendanceDeleteMenuOpen && (
                    <ScrollView
                        style={styles.selectMenu}
                        nestedScrollEnabled={true}
                    >
                        {batches.length === 0 ? (
                            <View style={styles.selectItem}>
                                <Text style={styles.selectItemText}>No batches found</Text>
                            </View>
                        ) : (
                            batches.map((batch) => (
                                <TouchableOpacity
                                    key={batch._id}
                                    style={[
                                        styles.selectItem,
                                        selectedBatchForAttendanceDelete?._id === batch._id && styles.selectItemActive,
                                    ]}
                                    onPress={() => handleSelectBatchForAttendanceDelete(batch)}
                                >
                                    <Text
                                        style={[
                                            styles.selectItemText,
                                            selectedBatchForAttendanceDelete?._id === batch._id &&
                                                styles.selectItemTextActive,
                                        ]}
                                    >
                                        {batch.name}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>
                )}

                {selectedBatchForAttendanceDelete && !showAttendanceDeleteConfirm && (
                    <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAllAttendancePress}>
                        <Text style={styles.deleteButtonText}>Delete All Attendance</Text>
                    </TouchableOpacity>
                )}

                {showAttendanceDeleteConfirm && selectedBatchForAttendanceDelete && (
                    <View style={styles.confirmSection}>
                        <Text style={styles.confirmLabel}>
                            Type "<Text style={styles.confirmHighlight}>{selectedBatchForAttendanceDelete.name} delete attendance</Text>" to confirm
                        </Text>
                        <TextInput
                            style={styles.confirmInput}
                            value={attendanceDeleteConfirmText}
                            onChangeText={setAttendanceDeleteConfirmText}
                            placeholder={`${selectedBatchForAttendanceDelete.name} delete attendance`}
                            placeholderTextColor="#CBD5E1"
                            autoCapitalize="none"
                            onFocus={() => {
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                }, 300);
                            }}
                        />
                        <View style={styles.confirmButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={handleCancelDeleteAllAttendance}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.confirmDeleteButton,
                                    attendanceDeleteConfirmText.trim() !== `${selectedBatchForAttendanceDelete.name} delete attendance` &&
                                        styles.confirmDeleteButtonDisabled,
                                ]}
                                onPress={handleConfirmDeleteAllAttendance}
                                disabled={
                                    deletingAttendance ||
                                    attendanceDeleteConfirmText.trim() !== `${selectedBatchForAttendanceDelete.name} delete attendance`
                                }
                            >
                                {deletingAttendance ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.confirmDeleteButtonText}>
                                        Confirm Delete
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Delete Batch Section */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Delete Batch</Text>
                <Text style={styles.cardSubtitle}>
                    Deleting a batch will remove all its students and subjects
                </Text>

                {/* Batch Dropdown */}
                <Text style={styles.fieldLabel}>Select Batch</Text>
                <TouchableOpacity
                    style={styles.selectInput}
                    onPress={() => setBatchMenuOpen((prev) => !prev)}
                >
                    <Text
                        style={[
                            styles.selectInputText,
                            !selectedBatch && styles.selectPlaceholder,
                        ]}
                    >
                        {selectedBatch ? selectedBatch.name : 'Select a batch'}
                    </Text>
                    <Text style={styles.selectArrow}>{batchMenuOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {batchMenuOpen && (
                    <ScrollView
                        style={styles.selectMenu}
                        nestedScrollEnabled={true}
                    >
                        {batches.length === 0 ? (
                            <View style={styles.selectItem}>
                                <Text style={styles.selectItemText}>No batches found</Text>
                            </View>
                        ) : (
                            batches.map((batch) => (
                                <TouchableOpacity
                                    key={batch._id}
                                    style={[
                                        styles.selectItem,
                                        selectedBatch?._id === batch._id && styles.selectItemActive,
                                    ]}
                                    onPress={() => handleSelectBatch(batch)}
                                >
                                    <Text
                                        style={[
                                            styles.selectItemText,
                                            selectedBatch?._id === batch._id &&
                                                styles.selectItemTextActive,
                                        ]}
                                    >
                                        {batch.name}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>
                )}

                {/* Delete Button */}
                {selectedBatch && !showConfirm && (
                    <TouchableOpacity style={styles.deleteButton} onPress={handleDeletePress}>
                        <Text style={styles.deleteButtonText}>Delete Batch</Text>
                    </TouchableOpacity>
                )}

                {/* Confirmation Section */}
                {showConfirm && selectedBatch && (
                    <View style={styles.confirmSection}>
                        <Text style={styles.confirmLabel}>
                            Type "<Text style={styles.confirmHighlight}>{selectedBatch.name} delete</Text>" to confirm
                        </Text>
                        <TextInput
                            style={styles.confirmInput}
                            value={confirmText}
                            onChangeText={setConfirmText}
                            placeholder={`${selectedBatch.name} delete`}
                            placeholderTextColor="#CBD5E1"
                            autoCapitalize="none"
                            onFocus={() => {
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                }, 300);
                            }}
                        />
                        <View style={styles.confirmButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={handleCancelDelete}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.confirmDeleteButton,
                                    confirmText.trim() !== `${selectedBatch.name} delete` &&
                                        styles.confirmDeleteButtonDisabled,
                                ]}
                                onPress={handleConfirmDelete}
                                disabled={
                                    deleting ||
                                    confirmText.trim() !== `${selectedBatch.name} delete`
                                }
                            >
                                {deleting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.confirmDeleteButtonText}>
                                        Confirm Delete
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Change All Students Batch Section */}
            <View style={styles.card}>
                <TouchableOpacity
                    style={styles.collapseHeader}
                    onPress={() => setShowChangeBatchForm((prev) => !prev)}
                >
                    <View>
                        <Text style={styles.cardTitle}>Change All Students Batch</Text>
                        <Text style={[styles.cardSubtitle, { marginBottom: 0 }]}>
                            Move all students from one batch to another
                        </Text>
                    </View>
                    <Text style={styles.collapseArrow}>{showChangeBatchForm ? '↑' : '↓'}</Text>
                </TouchableOpacity>

                {showChangeBatchForm && (
                    <View style={styles.collapseBody}>
                        {/* Old Batch Dropdown */}
                        <Text style={styles.fieldLabel}>Old Batch</Text>
                        <TouchableOpacity
                            style={styles.selectInput}
                            onPress={() => { setOldBatchMenuOpen((prev) => !prev); setNewBatchMenuOpen(false); }}
                        >
                            <Text style={[styles.selectInputText, !oldBatch && styles.selectPlaceholder]}>
                                {oldBatch ? oldBatch.name : 'Select old batch'}
                            </Text>
                            <Text style={styles.selectArrow}>{oldBatchMenuOpen ? '▲' : '▼'}</Text>
                        </TouchableOpacity>

                        {oldBatchMenuOpen && (
                            <ScrollView style={styles.selectMenu} nestedScrollEnabled={true}>
                                {batches.length === 0 ? (
                                    <View style={styles.selectItem}>
                                        <Text style={styles.selectItemText}>No batches found</Text>
                                    </View>
                                ) : (
                                    batches.map((batch) => (
                                        <TouchableOpacity
                                            key={batch._id}
                                            style={[styles.selectItem, oldBatch?._id === batch._id && styles.selectItemActive]}
                                            onPress={() => handleSelectOldBatch(batch)}
                                        >
                                            <Text style={[styles.selectItemText, oldBatch?._id === batch._id && styles.selectItemTextActive]}>
                                                {batch.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>
                        )}

                        {/* New Batch Dropdown */}
                        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>New Batch</Text>
                        <TouchableOpacity
                            style={styles.selectInput}
                            onPress={() => { setNewBatchMenuOpen((prev) => !prev); setOldBatchMenuOpen(false); }}
                        >
                            <Text style={[styles.selectInputText, !newBatch && styles.selectPlaceholder]}>
                                {newBatch ? newBatch.name : 'Select new batch'}
                            </Text>
                            <Text style={styles.selectArrow}>{newBatchMenuOpen ? '▲' : '▼'}</Text>
                        </TouchableOpacity>

                        {newBatchMenuOpen && (
                            <ScrollView style={styles.selectMenu} nestedScrollEnabled={true}>
                                {batches.length === 0 ? (
                                    <View style={styles.selectItem}>
                                        <Text style={styles.selectItemText}>No batches found</Text>
                                    </View>
                                ) : (
                                    batches.map((batch) => (
                                        <TouchableOpacity
                                            key={batch._id}
                                            style={[styles.selectItem, newBatch?._id === batch._id && styles.selectItemActive]}
                                            onPress={() => handleSelectNewBatch(batch)}
                                        >
                                            <Text style={[styles.selectItemText, newBatch?._id === batch._id && styles.selectItemTextActive]}>
                                                {batch.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>
                        )}

                        {/* Subjects Multi-Select */}
                        {newBatch && (
                            <View style={{ marginTop: 14 }}>
                                <Text style={styles.fieldLabel}>Select Subjects of New Batch</Text>
                                {loadingSubjects ? (
                                    <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 10 }} />
                                ) : newBatchSubjects.length === 0 ? (
                                    <Text style={styles.cardSubtitle}>No subjects found for this batch</Text>
                                ) : (
                                    <View style={styles.subjectList}>
                                        {newBatchSubjects.map((subject) => {
                                            const isSelected = selectedSubjectIds.includes(subject._id);
                                            return (
                                                <TouchableOpacity
                                                    key={subject._id}
                                                    style={[styles.subjectChip, isSelected && styles.subjectChipActive]}
                                                    onPress={() => toggleSubjectSelection(subject._id)}
                                                >
                                                    <Text style={[styles.subjectChipText, isSelected && styles.subjectChipTextActive]}>
                                                        {subject.name}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Change Button */}
                        <TouchableOpacity
                            style={[styles.changeBatchButton, changingBatch && styles.changeBatchButtonDisabled]}
                            onPress={handleChangeAllStudentsBatch}
                            disabled={changingBatch}
                        >
                            {changingBatch ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.changeBatchButtonText}>Change Batch</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Register User Section */}
            <View style={styles.card}>
                <TouchableOpacity
                    style={styles.collapseHeader}
                    onPress={() => setShowRegisterForm((prev) => !prev)}
                >
                    <View>
                        <Text style={styles.cardTitle}>Register New User</Text>
                        <Text style={[styles.cardSubtitle, { marginBottom: 0 }]}>
                            Create a new teacher/admin account
                        </Text>
                    </View>
                    <Text style={styles.collapseArrow}>{showRegisterForm ? '↑' : '↓'}</Text>
                </TouchableOpacity>

                {showRegisterForm && (
                    <View style={styles.collapseBody}>
                        <Text style={styles.fieldLabel}>Name</Text>
                        <TextInput
                            style={styles.formInput}
                            value={regName}
                            onChangeText={setRegName}
                            placeholder="Enter name"
                            placeholderTextColor="#CBD5E1"
                            onFocus={() => {
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                }, 300);
                            }}
                        />

                        <Text style={styles.fieldLabel}>Email</Text>
                        <TextInput
                            style={styles.formInput}
                            value={regEmail}
                            onChangeText={setRegEmail}
                            placeholder="Enter email"
                            placeholderTextColor="#CBD5E1"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            onFocus={() => {
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                }, 300);
                            }}
                        />

                        <Text style={styles.fieldLabel}>Mobile</Text>
                        <TextInput
                            style={styles.formInput}
                            value={regMobile}
                            onChangeText={setRegMobile}
                            placeholder="Enter mobile number"
                            placeholderTextColor="#CBD5E1"
                            keyboardType="phone-pad"
                            onFocus={() => {
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                }, 300);
                            }}
                        />

                        <Text style={styles.fieldLabel}>Password</Text>
                        <TextInput
                            style={styles.formInput}
                            value={regPassword}
                            onChangeText={setRegPassword}
                            placeholder="Enter password"
                            placeholderTextColor="#CBD5E1"
                            secureTextEntry
                            onFocus={() => {
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                }, 300);
                            }}
                        />

                        <TouchableOpacity
                            style={[styles.registerButton, registering && styles.registerButtonDisabled]}
                            onPress={handleRegisterUser}
                            disabled={registering}
                        >
                            {registering ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.registerButtonText}>Register User</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <View style={styles.card}>
                <TouchableOpacity
                    style={styles.collapseHeader}
                    onPress={() => setShowChangePasswordForm((prev) => !prev)}
                >
                    <View>
                        <Text style={styles.cardTitle}>Change Password</Text>
                        <Text style={[styles.cardSubtitle, { marginBottom: 0 }]}>
                            You will be asked to login again after updating it
                        </Text>
                    </View>
                    <Text style={styles.collapseArrow}>{showChangePasswordForm ? '↑' : '↓'}</Text>
                </TouchableOpacity>

                {showChangePasswordForm && (
                    <View style={styles.collapseBody}>
                        <TouchableOpacity
                            style={styles.passwordToggleRow}
                            onPress={() => setShowPasswords((prev) => !prev)}
                        >
                            <View style={[styles.passwordToggleBox, showPasswords && styles.passwordToggleBoxActive]}>
                                {showPasswords ? <Text style={styles.passwordToggleCheck}>✓</Text> : null}
                            </View>
                            <Text style={styles.passwordToggleLabel}>Show passwords</Text>
                        </TouchableOpacity>

                        <Text style={styles.fieldLabel}>Current Password</Text>
                        <TextInput
                            style={styles.formInput}
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            placeholder="Enter current password"
                            placeholderTextColor="#CBD5E1"
                            secureTextEntry={!showPasswords}
                            autoCapitalize="none"
                            onFocus={() => {
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                }, 300);
                            }}
                        />

                        <Text style={styles.fieldLabel}>New Password</Text>
                        <TextInput
                            style={styles.formInput}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="Enter new password"
                            placeholderTextColor="#CBD5E1"
                            secureTextEntry={!showPasswords}
                            autoCapitalize="none"
                            onFocus={() => {
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                }, 300);
                            }}
                        />

                        <Text style={styles.fieldLabel}>Confirm New Password</Text>
                        <TextInput
                            style={styles.formInput}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Confirm new password"
                            placeholderTextColor="#CBD5E1"
                            secureTextEntry={!showPasswords}
                            autoCapitalize="none"
                            onFocus={() => {
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                }, 300);
                            }}
                        />

                        <TouchableOpacity
                            style={[styles.registerButton, changingPassword && styles.registerButtonDisabled]}
                            onPress={handleChangePassword}
                            disabled={changingPassword}
                        >
                            {changingPassword ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.registerButtonText}>Update Password</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Logout Section */}
            <View style={styles.section}>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
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
        padding: 20,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F7FA',
    },
    header: {
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 20,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#2563EB',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarText: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0F172A',
        marginBottom: 4,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 13,
        color: '#94A3B8',
        marginBottom: 16,
    },
    collapseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    collapseArrow: {
        fontSize: 14,
        color: '#94A3B8',
    },
    collapseBody: {
        marginTop: 16,
    },
    passwordToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    passwordToggleBox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    passwordToggleBoxActive: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
    },
    passwordToggleCheck: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    passwordToggleLabel: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '500',
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
        fontSize: 15,
        color: '#64748B',
        fontWeight: '500',
    },
    infoValue: {
        fontSize: 15,
        color: '#0F172A',
        fontWeight: '600',
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 8,
    },
    selectInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectInputText: {
        fontSize: 15,
        color: '#0F172A',
    },
    selectPlaceholder: {
        color: '#94A3B8',
    },
    selectArrow: {
        fontSize: 12,
        color: '#94A3B8',
    },
    selectMenu: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        marginTop: 6,
        overflow: 'hidden',
        maxHeight: 300,
    },
    selectItem: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    selectItemActive: {
        backgroundColor: '#EFF6FF',
    },
    selectItemText: {
        fontSize: 15,
        color: '#0F172A',
    },
    selectItemTextActive: {
        color: '#2563EB',
        fontWeight: '600',
    },
    deleteButton: {
        backgroundColor: '#FEE2E2',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    deleteButtonText: {
        color: '#DC2626',
        fontSize: 15,
        fontWeight: '700',
    },
    confirmSection: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    confirmLabel: {
        fontSize: 14,
        color: '#0F172A',
        marginBottom: 10,
        lineHeight: 20,
    },
    confirmHighlight: {
        fontWeight: '700',
        color: '#DC2626',
    },
    confirmInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
        color: '#0F172A',
        marginBottom: 14,
    },
    confirmButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#64748B',
        fontSize: 15,
        fontWeight: '600',
    },
    confirmDeleteButton: {
        flex: 1,
        backgroundColor: '#DC2626',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    confirmDeleteButtonDisabled: {
        backgroundColor: '#F87171',
        opacity: 0.6,
    },
    confirmDeleteButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    section: {
        marginBottom: 40,
    },
    formInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
        color: '#0F172A',
        marginBottom: 14,
    },
    registerButton: {
        backgroundColor: '#2563EB',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    registerButtonDisabled: {
        opacity: 0.6,
    },
    registerButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    subjectList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    subjectChip: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    subjectChipActive: {
        backgroundColor: '#DBEAFE',
        borderColor: '#2563EB',
    },
    subjectChipText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    subjectChipTextActive: {
        color: '#2563EB',
        fontWeight: '600',
    },
    changeBatchButton: {
        backgroundColor: '#F59E0B',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    changeBatchButtonDisabled: {
        opacity: 0.6,
    },
    changeBatchButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
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
