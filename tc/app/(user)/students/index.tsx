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
    Modal,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import {
    addStudentToSubject,
    changeStudentBatch as changeStudentBatchApi,
    deleteStudent as deleteStudentApi,
    getAllBatches,
    getAllStudents,
    getAllSubjectsOfBatch,
    registerStudent as registerStudentApi,
} from '../../../services/api';

export default function StudentsScreen() {
    const [students, setStudents] = useState<any[]>([]);
    const [batches, setBatches] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
    const [changingBatchStudentId, setChangingBatchStudentId] = useState<string | null>(null);
    const [registerModalVisible, setRegisterModalVisible] = useState(false);
    const [registeringStudent, setRegisteringStudent] = useState(false);
    const [subjectLoading, setSubjectLoading] = useState(false);
    const [batchMenuOpen, setBatchMenuOpen] = useState(false);
    const [subjectMenuOpen, setSubjectMenuOpen] = useState(false);
    const [changeBatchModalVisible, setChangeBatchModalVisible] = useState(false);
    const [changeBatchMenuOpen, setChangeBatchMenuOpen] = useState(false);
    const [changeSubjectMenuOpen, setChangeSubjectMenuOpen] = useState(false);
    const [changeBatchSubjects, setChangeBatchSubjects] = useState<any[]>([]);
    const [changeBatchSubjectLoading, setChangeBatchSubjectLoading] = useState(false);
    const [studentForBatchChange, setStudentForBatchChange] = useState<any | null>(null);
    const [newBatchIdForStudent, setNewBatchIdForStudent] = useState('');
    const [newSubjectIdsForStudent, setNewSubjectIdsForStudent] = useState<string[]>([]);
    const [form, setForm] = useState({
        rollNumber: '',
        name: '',
        mobile: '',
        email: '',
        password: '',
        parentName: '',
        fatherMobile: '',
        motherMobile: '',
        batchId: '',
        subjectIds: [] as string[],
    });

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

            setBatches(batchesData);

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

    const resetRegisterForm = () => {
        setForm({
            rollNumber: '',
            name: '',
            mobile: '',
            email: '',
            password: '',
            parentName: '',
            fatherMobile: '',
            motherMobile: '',
            batchId: '',
            subjectIds: [],
        });
        setSubjects([]);
        setBatchMenuOpen(false);
        setSubjectMenuOpen(false);
    };

    const handleOpenRegisterModal = () => {
        resetRegisterForm();
        setRegisterModalVisible(true);
    };

    const fetchSubjectsForBatch = async (batchId: string) => {
        setSubjectLoading(true);
        try {
            const response = await getAllSubjectsOfBatch(batchId);
            if (response.data?.success) {
                setSubjects(response.data?.data || []);
            } else {
                setSubjects([]);
            }
        } catch (error) {
            console.error('Error fetching subjects:', error);
            setSubjects([]);
            Alert.alert('Error', 'Failed to load subjects for selected batch.');
        } finally {
            setSubjectLoading(false);
        }
    };

    const updateField = (key: string, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSelectBatch = async (batchId: string) => {
        setForm((prev) => ({ ...prev, batchId, subjectIds: [] }));
        setBatchMenuOpen(false);
        setSubjectMenuOpen(false);
        await fetchSubjectsForBatch(batchId);
    };

    const handleToggleSubject = (subjectId: string) => {
        setForm((prev) => ({
            ...prev,
            subjectIds: prev.subjectIds.includes(subjectId)
                ? prev.subjectIds.filter((id) => id !== subjectId)
                : [...prev.subjectIds, subjectId],
        }));
    };

    const handleRegisterStudent = async () => {
        if (
            !form.rollNumber.trim() ||
            !form.name.trim() ||
            !form.mobile.trim() ||
            !form.email.trim() ||
            !form.password.trim() ||
            !form.parentName.trim() ||
            !form.fatherMobile.trim() ||
            !form.motherMobile.trim() ||
            !form.batchId ||
            form.subjectIds.length === 0
        ) {
            Alert.alert('Error', 'Please fill all fields and select batch/subject(s).');
            return;
        }

        setRegisteringStudent(true);

        try {
            const payload = {
                rollNumber: Number(form.rollNumber),
                name: form.name.trim(),
                mobile: form.mobile.trim(),
                email: form.email.trim(),
                password: form.password,
                parentName: form.parentName.trim(),
                fatherMobile: form.fatherMobile.trim(),
                motherMobile: form.motherMobile.trim(),
                batchId: form.batchId,
            };

            const registerResponse = await registerStudentApi(payload);
            if (!registerResponse.data?.success || !registerResponse.data?.data?._id) {
                throw new Error(registerResponse.data?.message || 'Failed to register student.');
            }

            const studentId = registerResponse.data.data._id;
            for (const subjectId of form.subjectIds) {
                const enrollResponse = await addStudentToSubject(subjectId, studentId);
                if (!enrollResponse.data?.success) {
                    throw new Error(enrollResponse.data?.message || `Subject enrollment failed for subject ${subjectId}.`);
                }
            }

            Alert.alert('Success', `Student registered and added to ${form.subjectIds.length} subject(s) successfully.`);
            setRegisterModalVisible(false);
            resetRegisterForm();
            fetchStudents();
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to register student.');
        } finally {
            setRegisteringStudent(false);
        }
    };

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

    const openChangeBatchModal = (student: any) => {
        const currentBatchId = student?.batch?._id || student?.batch || '';
        setStudentForBatchChange(student);
        setNewBatchIdForStudent(currentBatchId);
        setNewSubjectIdsForStudent([]);
        setChangeBatchSubjects([]);
        setChangeBatchMenuOpen(false);
        setChangeSubjectMenuOpen(false);
        setChangeBatchModalVisible(true);
        if (currentBatchId) {
            void fetchChangeBatchSubjects(currentBatchId);
        }
    };

    const closeChangeBatchModal = () => {
        setChangeBatchModalVisible(false);
        setChangeBatchMenuOpen(false);
        setChangeSubjectMenuOpen(false);
        setStudentForBatchChange(null);
        setNewBatchIdForStudent('');
        setNewSubjectIdsForStudent([]);
        setChangeBatchSubjects([]);
    };

    const fetchChangeBatchSubjects = async (batchId: string) => {
        setChangeBatchSubjectLoading(true);
        try {
            const response = await getAllSubjectsOfBatch(batchId);
            if (response.data?.success) {
                setChangeBatchSubjects(response.data?.data || []);
            } else {
                setChangeBatchSubjects([]);
            }
        } catch (error) {
            console.error('Error fetching subjects for batch change:', error);
            setChangeBatchSubjects([]);
            Alert.alert('Error', 'Failed to load subjects for selected batch.');
        } finally {
            setChangeBatchSubjectLoading(false);
        }
    };

    const handleChangeBatch = async () => {
        if (!studentForBatchChange?._id || !newBatchIdForStudent || newSubjectIdsForStudent.length === 0) {
            Alert.alert('Error', 'Please select batch and at least one subject.');
            return;
        }

        setChangingBatchStudentId(studentForBatchChange._id);
        try {
            const response = await changeStudentBatchApi(
                studentForBatchChange._id,
                newBatchIdForStudent,
                newSubjectIdsForStudent
            );
            if (!response.data?.success) {
                throw new Error(response.data?.message || 'Failed to change batch.');
            }

            const selectedBatch = batches.find((batch) => batch._id === newBatchIdForStudent);

            setStudents((prev) =>
                prev.map((student) =>
                    student._id === studentForBatchChange._id
                        ? {
                            ...student,
                            batch: newBatchIdForStudent,
                            batchName: selectedBatch?.name || student.batchName,
                        }
                        : student
                )
            );

            closeChangeBatchModal();
            setSelectedStudentId(null);
            Alert.alert('Success', `Student batch and ${newSubjectIdsForStudent.length} subject(s) updated successfully.`);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to change student batch/subject.');
        } finally {
            setChangingBatchStudentId(null);
        }
    };

    const renderStudentItem = ({ item }: { item: any }) => {
        const isSelected = selectedStudentId === item._id;
        const isDeleting = deletingStudentId === item._id;
        const isChangingBatch = changingBatchStudentId === item._id;

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
                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={styles.changeBatchButton}
                                    onPress={() => openChangeBatchModal(item)}
                                    disabled={isChangingBatch}
                                >
                                    {isChangingBatch ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <Ionicons name="swap-horizontal" size={14} color="#FFFFFF" />
                                            <Text style={styles.actionButtonText}>Change Batch</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
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
                                            <Text style={styles.actionButtonText}>Delete Student</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
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
                <TouchableOpacity
                    style={styles.registerBtn}
                    activeOpacity={0.85}
                    onPress={handleOpenRegisterModal}
                >
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

            <Modal
                animationType="slide"
                transparent
                visible={registerModalVisible}
                onRequestClose={() => setRegisterModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Register Student</Text>
                            <TouchableOpacity onPress={() => setRegisterModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
                            <Text style={styles.label}>Roll Number</Text>
                            <TextInput
                                style={styles.input}
                                value={form.rollNumber}
                                onChangeText={(value) => updateField('rollNumber', value)}
                                keyboardType="number-pad"
                                placeholder="Enter roll number"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Student Name</Text>
                            <TextInput
                                style={styles.input}
                                value={form.name}
                                onChangeText={(value) => updateField('name', value)}
                                placeholder="Enter student name"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Mobile</Text>
                            <TextInput
                                style={styles.input}
                                value={form.mobile}
                                onChangeText={(value) => updateField('mobile', value)}
                                keyboardType="phone-pad"
                                placeholder="Enter mobile number"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                value={form.email}
                                onChangeText={(value) => updateField('email', value)}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholder="Enter email"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                style={styles.input}
                                value={form.password}
                                onChangeText={(value) => updateField('password', value)}
                                secureTextEntry
                                placeholder="Enter password"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Parent Name</Text>
                            <TextInput
                                style={styles.input}
                                value={form.parentName}
                                onChangeText={(value) => updateField('parentName', value)}
                                placeholder="Enter parent name"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Father Mobile</Text>
                            <TextInput
                                style={styles.input}
                                value={form.fatherMobile}
                                onChangeText={(value) => updateField('fatherMobile', value)}
                                keyboardType="phone-pad"
                                placeholder="Enter father mobile"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Mother Mobile</Text>
                            <TextInput
                                style={styles.input}
                                value={form.motherMobile}
                                onChangeText={(value) => updateField('motherMobile', value)}
                                keyboardType="phone-pad"
                                placeholder="Enter mother mobile"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Batch</Text>
                            <TouchableOpacity
                                style={styles.selectInput}
                                onPress={() => {
                                    setBatchMenuOpen((prev) => !prev);
                                    setSubjectMenuOpen(false);
                                }}
                            >
                                <Text style={form.batchId ? styles.selectText : styles.placeholderText}>
                                    {form.batchId
                                        ? batches.find((batch) => batch._id === form.batchId)?.name || 'Select batch'
                                        : 'Select batch'}
                                </Text>
                                <Ionicons
                                    name={batchMenuOpen ? 'chevron-up' : 'chevron-down'}
                                    size={16}
                                    color="#64748B"
                                />
                            </TouchableOpacity>
                            {batchMenuOpen ? (
                                <View style={styles.selectMenu}>
                                    {batches.length === 0 ? (
                                        <Text style={styles.selectEmpty}>No batches found</Text>
                                    ) : (
                                        batches.map((batch) => (
                                            <TouchableOpacity
                                                key={batch._id}
                                                style={styles.selectItem}
                                                onPress={() => handleSelectBatch(batch._id)}
                                            >
                                                <Text style={styles.selectItemText}>{batch.name}</Text>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </View>
                            ) : null}

                            <Text style={styles.label}>Subject(s)</Text>
                            <TouchableOpacity
                                style={styles.selectInput}
                                disabled={!form.batchId || subjectLoading}
                                onPress={() => {
                                    if (form.batchId && !subjectLoading) {
                                        setSubjectMenuOpen((prev) => !prev);
                                        setBatchMenuOpen(false);
                                    }
                                }}
                            >
                                <Text style={form.subjectIds.length > 0 ? styles.selectText : styles.placeholderText}>
                                    {subjectLoading
                                        ? 'Loading subjects...'
                                        : form.subjectIds.length > 0
                                            ? `${form.subjectIds.length} subject(s) selected`
                                            : 'Select subjects'}
                                </Text>
                                <Ionicons
                                    name={subjectMenuOpen ? 'chevron-up' : 'chevron-down'}
                                    size={16}
                                    color="#64748B"
                                />
                            </TouchableOpacity>
                            {subjectMenuOpen ? (
                                <View style={styles.selectMenu}>
                                    {subjects.length === 0 ? (
                                        <Text style={styles.selectEmpty}>No subjects found in this batch</Text>
                                    ) : (
                                        subjects.map((subject) => {
                                            const isSelected = form.subjectIds.includes(subject._id);
                                            return (
                                                <TouchableOpacity
                                                    key={subject._id}
                                                    style={[styles.selectItem, isSelected && styles.selectItemActive]}
                                                    onPress={() => handleToggleSubject(subject._id)}
                                                >
                                                    <Ionicons
                                                        name={isSelected ? 'checkbox' : 'square-outline'}
                                                        size={18}
                                                        color={isSelected ? '#007AFF' : '#94A3B8'}
                                                        style={{ marginRight: 8 }}
                                                    />
                                                    <Text style={[styles.selectItemText, isSelected && styles.selectItemTextActive]}>
                                                        {subject.name}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })
                                    )}
                                </View>
                            ) : null}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setRegisterModalVisible(false)}
                                disabled={registeringStudent}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleRegisterStudent}
                                disabled={registeringStudent}
                            >
                                {registeringStudent ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Register</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                animationType="slide"
                transparent
                visible={changeBatchModalVisible}
                onRequestClose={closeChangeBatchModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Change Batch</Text>
                            <TouchableOpacity onPress={closeChangeBatchModal}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Student</Text>
                        <Text style={styles.studentNameInModal}>{studentForBatchChange?.name || '-'}</Text>

                        <Text style={styles.label}>Select New Batch</Text>
                            <TouchableOpacity
                                style={styles.selectInput}
                                onPress={() => setChangeBatchMenuOpen((prev) => !prev)}
                            >
                            <Text style={newBatchIdForStudent ? styles.selectText : styles.placeholderText}>
                                {newBatchIdForStudent
                                    ? batches.find((batch) => batch._id === newBatchIdForStudent)?.name || 'Select batch'
                                    : 'Select batch'}
                            </Text>
                            <Ionicons
                                name={changeBatchMenuOpen ? 'chevron-up' : 'chevron-down'}
                                size={16}
                                color="#64748B"
                            />
                        </TouchableOpacity>
                        {changeBatchMenuOpen ? (
                            <ScrollView style={styles.batchMenuScroll} nestedScrollEnabled>
                                <View style={styles.selectMenu}>
                                    {batches.length === 0 ? (
                                        <Text style={styles.selectEmpty}>No batches found</Text>
                                    ) : (
                                        batches.map((batch) => (
                                            <TouchableOpacity
                                                key={batch._id}
                                                style={styles.selectItem}
                                                onPress={async () => {
                                                    setNewBatchIdForStudent(batch._id);
                                                    setNewSubjectIdsForStudent([]);
                                                    setChangeBatchMenuOpen(false);
                                                    setChangeSubjectMenuOpen(false);
                                                    await fetchChangeBatchSubjects(batch._id);
                                                }}
                                            >
                                                <Text style={styles.selectItemText}>{batch.name}</Text>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </View>
                            </ScrollView>
                        ) : null}

                        <Text style={styles.label}>Select Subject(s)</Text>
                        <TouchableOpacity
                            style={styles.selectInput}
                            disabled={!newBatchIdForStudent || changeBatchSubjectLoading}
                            onPress={() => {
                                if (newBatchIdForStudent && !changeBatchSubjectLoading) {
                                    setChangeSubjectMenuOpen((prev) => !prev);
                                    setChangeBatchMenuOpen(false);
                                }
                            }}
                        >
                            <Text style={newSubjectIdsForStudent.length > 0 ? styles.selectText : styles.placeholderText}>
                                {changeBatchSubjectLoading
                                    ? 'Loading subjects...'
                                    : newSubjectIdsForStudent.length > 0
                                        ? `${newSubjectIdsForStudent.length} subject(s) selected`
                                        : 'Select subjects'}
                            </Text>
                            <Ionicons
                                name={changeSubjectMenuOpen ? 'chevron-up' : 'chevron-down'}
                                size={16}
                                color="#64748B"
                            />
                        </TouchableOpacity>
                        {changeSubjectMenuOpen ? (
                            <ScrollView style={styles.batchMenuScroll} nestedScrollEnabled>
                                <View style={styles.selectMenu}>
                                    {changeBatchSubjects.length === 0 ? (
                                        <Text style={styles.selectEmpty}>No subjects found in this batch</Text>
                                    ) : (
                                        changeBatchSubjects.map((subject) => {
                                            const isSubjectSelected = newSubjectIdsForStudent.includes(subject._id);
                                            return (
                                                <TouchableOpacity
                                                    key={subject._id}
                                                    style={[styles.selectItem, isSubjectSelected && styles.selectItemActive]}
                                                    onPress={() => {
                                                        setNewSubjectIdsForStudent((prev) =>
                                                            prev.includes(subject._id)
                                                                ? prev.filter((id) => id !== subject._id)
                                                                : [...prev, subject._id]
                                                        );
                                                    }}
                                                >
                                                    <Ionicons
                                                        name={isSubjectSelected ? 'checkbox' : 'square-outline'}
                                                        size={18}
                                                        color={isSubjectSelected ? '#007AFF' : '#94A3B8'}
                                                        style={{ marginRight: 8 }}
                                                    />
                                                    <Text style={[styles.selectItemText, isSubjectSelected && styles.selectItemTextActive]}>
                                                        {subject.name}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })
                                    )}
                                </View>
                            </ScrollView>
                        ) : null}

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={closeChangeBatchModal}
                                disabled={Boolean(changingBatchStudentId)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleChangeBatch}
                                disabled={Boolean(changingBatchStudentId)}
                            >
                                {Boolean(changingBatchStudentId) ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Update Batch</Text>
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
        paddingHorizontal: 20,
        paddingTop: 45,
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
        fontSize: 18,
        fontWeight: '600',
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
    actionRow: {
        marginTop: 10,
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 8,
        width: '100%',
    },
    changeBatchButton: {
        backgroundColor: '#2563EB',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: '100%',
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
        width: '100%',
    },
    actionButtonText: {
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 20,
        maxHeight: '92%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
    },
    modalBody: {
        paddingBottom: 6,
    },
    label: {
        marginTop: 10,
        marginBottom: 6,
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 14,
        color: '#0F172A',
    },
    selectInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectText: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '600',
    },
    placeholderText: {
        color: '#94A3B8',
        fontSize: 14,
    },
    selectMenu: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        marginTop: 6,
        overflow: 'hidden',
    },
    selectItem: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectItemActive: {
        backgroundColor: '#EFF6FF',
    },
    selectItemText: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '600',
    },
    selectItemTextActive: {
        color: '#007AFF',
    },
    selectEmpty: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#94A3B8',
        fontSize: 13,
    },
    batchMenuScroll: {
        maxHeight: 220,
        marginTop: 6,
    },
    studentNameInModal: {
        fontSize: 14,
        color: '#0F172A',
        fontWeight: '700',
        marginBottom: 10,
    },
    modalActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 14,
    },
    modalButton: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#E2E8F0',
    },
    saveButton: {
        backgroundColor: '#007AFF',
    },
    cancelButtonText: {
        color: '#334155',
        fontSize: 14,
        fontWeight: '700',
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
});
