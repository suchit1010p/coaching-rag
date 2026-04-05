import React, { useCallback, useMemo, useRef, useState } from 'react';
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
    Linking,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from 'expo-router';
import * as XLSX from 'xlsx';
import {
    addStudentToSubject,
    changeStudentBatch as changeStudentBatchApi,
    deleteStudent as deleteStudentApi,
    getAllBatches,
    getStudentAttendanceForUser,
    getAllStudents,
    getAllSubjectsOfBatch,
    registerStudent as registerStudentApi,
    registerStudentsBulk as registerStudentsBulkApi,
    updateStudentDetails as updateStudentDetailsApi,
} from '../../../services/api';

type BulkStudentPayload = {
    name: string;
    mobile: string;
    email: string;
    dateOfBirth: string;
    parentName: string;
    fatherMobile: string;
    motherMobile: string;
};

type ParsedBulkStudent = BulkStudentPayload & {
    sourceRowNumber: number;
};

const BULK_STUDENT_HEADERS: Record<keyof BulkStudentPayload, string[]> = {
    name: ['name', 'student name', 'student'],
    mobile: ['mobile', 'mobile number', 'student mobile', 'phone', 'phone number'],
    email: ['email', 'email address', 'mail'],
    dateOfBirth: ['Date-of-birth', 'Date-of-Birth', 'date-of-birth', 'date of birth', 'dob', 'dateOfBirth'],
    parentName: ['parent name', 'parentName', 'parentname'],
    fatherMobile: ['father mobile number', 'father mobile', 'fatherMobile', 'father mobile no'],
    motherMobile: ['mother mobile number', 'mother mobile', 'motherMobile', 'mother mobile no'],
};

const normalizeSheetHeader = (value: unknown) =>
    String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');

const normalizeSheetCell = (value: unknown) => {
    if (value === undefined || value === null) {
        return '';
    }

    return String(value).trim();
};

const getSheetRowValue = (row: Record<string, unknown>, aliases: string[]) => {
    const rowEntries = Object.entries(row);

    for (const alias of aliases) {
        const normalizedAlias = normalizeSheetHeader(alias);
        const matchedEntry = rowEntries.find(([key]) => normalizeSheetHeader(key) === normalizedAlias);

        if (matchedEntry) {
            return normalizeSheetCell(matchedEntry[1]);
        }
    }

    return '';
};

const buildBulkStudentsFromSheet = (rows: Record<string, unknown>[]): ParsedBulkStudent[] =>
    rows
        .map((row, index) => ({
            sourceRowNumber: index + 2,
            name: getSheetRowValue(row, BULK_STUDENT_HEADERS.name),
            mobile: getSheetRowValue(row, BULK_STUDENT_HEADERS.mobile),
            email: getSheetRowValue(row, BULK_STUDENT_HEADERS.email),
            dateOfBirth: getSheetRowValue(row, BULK_STUDENT_HEADERS.dateOfBirth),
            parentName: getSheetRowValue(row, BULK_STUDENT_HEADERS.parentName),
            fatherMobile: getSheetRowValue(row, BULK_STUDENT_HEADERS.fatherMobile),
            motherMobile: getSheetRowValue(row, BULK_STUDENT_HEADERS.motherMobile),
        }))
        .filter((student) =>
            Object.entries(student).some(([key, value]) => key !== 'sourceRowNumber' && value !== '')
        );

const formatBulkRegistrationMessage = (resultData: any) => {
    const createdCount = Number(resultData?.createdCount || 0);
    const failedCount = Number(resultData?.failedCount || 0);
    const emailFailedCount = Number(resultData?.emailFailedCount || 0);
    const errors = Array.isArray(resultData?.errors)
        ? resultData.errors.filter((item: unknown) => typeof item === 'string' && item.trim())
        : [];

    const lines = [`Created: ${createdCount}`, `Failed: ${failedCount}`];

    if (emailFailedCount > 0) {
        lines.push(`Email failed: ${emailFailedCount}`);
    }

    if (errors.length > 0) {
        const issuePreview = errors.slice(0, 4).join('\n');
        lines.push(`Issues:\n${issuePreview}${errors.length > 4 ? '\n...' : ''}`);
    }

    return {
        createdCount,
        title: createdCount > 0 ? 'Bulk registration completed' : 'Bulk registration failed',
        message: lines.join('\n'),
    };
};

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
    const [editStudentModalVisible, setEditStudentModalVisible] = useState(false);
    const [updatingStudentDetails, setUpdatingStudentDetails] = useState(false);
    const [studentForEdit, setStudentForEdit] = useState<any | null>(null);
    const [bulkRegisterModalVisible, setBulkRegisterModalVisible] = useState(false);
    const [bulkParsingFile, setBulkParsingFile] = useState(false);
    const [bulkRegisteringStudents, setBulkRegisteringStudents] = useState(false);
    const [bulkBatchMenuOpen, setBulkBatchMenuOpen] = useState(false);
    const [bulkSubjectMenuOpen, setBulkSubjectMenuOpen] = useState(false);
    const [bulkSubjectLoading, setBulkSubjectLoading] = useState(false);
    const [bulkBatchId, setBulkBatchId] = useState('');
    const [bulkSubjectIds, setBulkSubjectIds] = useState<string[]>([]);
    const [bulkSubjects, setBulkSubjects] = useState<any[]>([]);
    const [bulkFileName, setBulkFileName] = useState('');
    const [bulkStudentsData, setBulkStudentsData] = useState<ParsedBulkStudent[]>([]);
    const [bulkParseError, setBulkParseError] = useState('');
    const [profileModalVisible, setProfileModalVisible] = useState(false);
    const [subjectLoading, setSubjectLoading] = useState(false);
    const [batchMenuOpen, setBatchMenuOpen] = useState(false);
    const [subjectMenuOpen, setSubjectMenuOpen] = useState(false);
    const [changeBatchModalVisible, setChangeBatchModalVisible] = useState(false);
    const [changeBatchMenuOpen, setChangeBatchMenuOpen] = useState(false);
    const [changeSubjectMenuOpen, setChangeSubjectMenuOpen] = useState(false);
    const [changeBatchSubjects, setChangeBatchSubjects] = useState<any[]>([]);
    const [changeBatchSubjectLoading, setChangeBatchSubjectLoading] = useState(false);
    const [studentForBatchChange, setStudentForBatchChange] = useState<any | null>(null);
    const [studentForProfile, setStudentForProfile] = useState<any | null>(null);
    const [profileAttendanceSubjects, setProfileAttendanceSubjects] = useState<any[]>([]);
    const [profileSelectedSubjectId, setProfileSelectedSubjectId] = useState<string | null>(null);
    const [profileAttendanceEntries, setProfileAttendanceEntries] = useState<any[]>([]);
    const [profileAttendanceStats, setProfileAttendanceStats] = useState<any | null>(null);
    const [profileAttendanceLoading, setProfileAttendanceLoading] = useState(false);
    const [profileAttendanceError, setProfileAttendanceError] = useState('');
    const profileAttendanceRequestRef = useRef(0);
    const [newBatchIdForStudent, setNewBatchIdForStudent] = useState('');
    const [newSubjectIdsForStudent, setNewSubjectIdsForStudent] = useState<string[]>([]);
    const [editForm, setEditForm] = useState({
        rollNumber: '',
        name: '',
        mobile: '',
        email: '',
        parentName: '',
        fatherMobile: '',
        motherMobile: '',
    });
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

    const resetEditForm = () => {
        setEditForm({
            rollNumber: '',
            name: '',
            mobile: '',
            email: '',
            parentName: '',
            fatherMobile: '',
            motherMobile: '',
        });
        setStudentForEdit(null);
    };

    const openEditStudentModal = (student: any) => {
        setStudentForEdit(student);
        setEditForm({
            rollNumber: String(student?.rollNumber ?? ''),
            name: student?.name || '',
            mobile: student?.mobile || '',
            email: student?.email || '',
            parentName: student?.parentName || '',
            fatherMobile: student?.fatherMobile || '',
            motherMobile: student?.motherMobile || '',
        });
        setEditStudentModalVisible(true);
    };

    const closeEditStudentModal = () => {
        if (updatingStudentDetails) {
            return;
        }

        setEditStudentModalVisible(false);
        resetEditForm();
    };

    const resetBulkRegisterForm = () => {
        setBulkBatchId('');
        setBulkSubjectIds([]);
        setBulkSubjects([]);
        setBulkFileName('');
        setBulkStudentsData([]);
        setBulkParseError('');
        setBulkBatchMenuOpen(false);
        setBulkSubjectMenuOpen(false);
    };

    const handleOpenBulkRegisterModal = () => {
        resetBulkRegisterForm();
        setBulkRegisterModalVisible(true);
    };

    const closeBulkRegisterModal = (force = false) => {
        if (!force && (bulkParsingFile || bulkRegisteringStudents)) {
            return;
        }

        setBulkRegisterModalVisible(false);
        resetBulkRegisterForm();
    };

    const handleCloseBulkRegisterModal = () => {
        closeBulkRegisterModal();
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

    const fetchBulkSubjectsForBatch = async (batchId: string) => {
        setBulkSubjectLoading(true);
        try {
            const response = await getAllSubjectsOfBatch(batchId);
            if (response.data?.success) {
                setBulkSubjects(response.data?.data || []);
            } else {
                setBulkSubjects([]);
            }
        } catch (error) {
            console.error('Error fetching bulk register subjects:', error);
            setBulkSubjects([]);
            Alert.alert('Error', 'Failed to load subjects for selected batch.');
        } finally {
            setBulkSubjectLoading(false);
        }
    };

    const updateField = (key: string, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const updateEditField = (key: string, value: string) => {
        setEditForm((prev) => ({ ...prev, [key]: value }));
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

    const handleSelectBulkBatch = async (batchId: string) => {
        setBulkBatchId(batchId);
        setBulkSubjectIds([]);
        setBulkBatchMenuOpen(false);
        setBulkSubjectMenuOpen(false);
        await fetchBulkSubjectsForBatch(batchId);
    };

    const handleToggleBulkSubject = (subjectId: string) => {
        setBulkSubjectIds((prev) =>
            prev.includes(subjectId)
                ? prev.filter((id) => id !== subjectId)
                : [...prev, subjectId]
        );
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

    const handleUpdateStudentDetails = async () => {
        if (
            !studentForEdit?._id ||
            !editForm.rollNumber.trim() ||
            !editForm.name.trim() ||
            !editForm.mobile.trim() ||
            !editForm.email.trim() ||
            !editForm.parentName.trim() ||
            !editForm.fatherMobile.trim() ||
            !editForm.motherMobile.trim()
        ) {
            Alert.alert('Error', 'Please fill all student details.');
            return;
        }

        setUpdatingStudentDetails(true);

        try {
            const payload = {
                studentId: studentForEdit._id,
                rollNumber: Number(editForm.rollNumber),
                name: editForm.name.trim(),
                mobile: editForm.mobile.trim(),
                email: editForm.email.trim(),
                parentName: editForm.parentName.trim(),
                fatherMobile: editForm.fatherMobile.trim(),
                motherMobile: editForm.motherMobile.trim(),
            };

            const response = await updateStudentDetailsApi(payload);

            if (!response.data?.success || !response.data?.data?._id) {
                throw new Error(response.data?.message || 'Failed to update student details.');
            }

            const updatedStudent = response.data.data;
            const batchName =
                (typeof updatedStudent.batch === 'object' && updatedStudent.batch !== null
                    ? updatedStudent.batch?.name
                    : null) ||
                studentForEdit.batchName ||
                studentForEdit.batch?.name ||
                'Unknown Batch';
            const mergedStudent = {
                ...studentForEdit,
                ...updatedStudent,
                batchName,
            };

            setStudents((prev) =>
                prev.map((student) => (student._id === mergedStudent._id ? mergedStudent : student))
            );

            if (studentForProfile?._id === mergedStudent._id) {
                setStudentForProfile(mergedStudent);
            }

            setEditStudentModalVisible(false);
            resetEditForm();
            Alert.alert(
                'Success',
                response.data?.message || 'Student details updated and verification email sent again.'
            );
        } catch (error: any) {
            Alert.alert(
                'Error',
                error.response?.data?.message || error.message || 'Failed to update student details.'
            );
        } finally {
            setUpdatingStudentDetails(false);
        }
    };

    const handlePickBulkRegisterFile = async () => {
        setBulkParsingFile(true);
        setBulkParseError('');

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                ],
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (result.canceled || !result.assets?.length) {
                return;
            }

            const selectedFile = result.assets[0];
            const fileName = selectedFile.name || 'students.xlsx';

            if (!/\.(xlsx|xls)$/i.test(fileName)) {
                throw new Error('Please select a valid .xlsx or .xls file.');
            }

            const fileContent = await FileSystem.readAsStringAsync(selectedFile.uri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            const workbook = XLSX.read(fileContent, { type: 'base64' });
            const firstSheetName = workbook.SheetNames[0];

            if (!firstSheetName) {
                throw new Error('The uploaded workbook does not contain any sheets.');
            }

            const worksheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
                defval: '',
                raw: false,
            });
            const parsedStudents = buildBulkStudentsFromSheet(rows);

            if (parsedStudents.length === 0) {
                throw new Error(
                    'No student rows were found. Use columns: name, mobile, email, Date-of-birth, parent name, father mobile number, mother mobile number.'
                );
            }

            setBulkFileName(fileName);
            setBulkStudentsData(parsedStudents);
        } catch (error: any) {
            const message = error.message || 'Failed to read the selected file.';
            setBulkFileName('');
            setBulkStudentsData([]);
            setBulkParseError(message);
            Alert.alert('File Error', message);
        } finally {
            setBulkParsingFile(false);
        }
    };

    const handleBulkRegisterStudents = async () => {
        if (!bulkBatchId) {
            Alert.alert('Error', 'Please select a batch.');
            return;
        }

        if (bulkSubjectIds.length === 0) {
            Alert.alert('Error', 'Please select at least one subject.');
            return;
        }

        if (bulkStudentsData.length === 0) {
            Alert.alert('Error', 'Please upload an XLSX file with student data.');
            return;
        }

        setBulkRegisteringStudents(true);

        try {
            const payload = bulkStudentsData.map((student) => ({
                sourceRowNumber: student.sourceRowNumber,
                name: student.name,
                mobile: student.mobile,
                email: student.email,
                dateOfBirth: student.dateOfBirth,
                parentName: student.parentName,
                fatherMobile: student.fatherMobile,
                motherMobile: student.motherMobile,
            }));

            const response = await registerStudentsBulkApi(payload, bulkBatchId, bulkSubjectIds);
            const summary = formatBulkRegistrationMessage(response.data?.data);

            Alert.alert(summary.title, summary.message);

            if (summary.createdCount > 0) {
                closeBulkRegisterModal(true);
                fetchStudents();
            }
        } catch (error: any) {
            const responseData = error.response?.data;
            const resultData = responseData?.data;

            if (resultData) {
                const summary = formatBulkRegistrationMessage(resultData);
                Alert.alert(summary.title, summary.message);

                if (summary.createdCount > 0) {
                    closeBulkRegisterModal(true);
                    fetchStudents();
                }
            } else {
                Alert.alert(
                    'Error',
                    responseData?.message || error.message || 'Failed to register students in bulk.'
                );
            }
        } finally {
            setBulkRegisteringStudents(false);
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

    const resetProfileAttendance = () => {
        setProfileAttendanceSubjects([]);
        setProfileSelectedSubjectId(null);
        setProfileAttendanceEntries([]);
        setProfileAttendanceStats(null);
        setProfileAttendanceLoading(false);
        setProfileAttendanceError('');
    };

    const fetchProfileAttendance = async (studentId: string, subjectId?: string) => {
        const requestId = profileAttendanceRequestRef.current + 1;
        profileAttendanceRequestRef.current = requestId;
        setProfileAttendanceLoading(true);
        setProfileAttendanceError('');

        try {
            const response = await getStudentAttendanceForUser(studentId, subjectId);

            if (profileAttendanceRequestRef.current !== requestId) {
                return;
            }

            if (response.data?.success) {
                const data = response.data?.data || {};
                setProfileAttendanceSubjects(data.subjects || []);
                setProfileSelectedSubjectId(data.selectedSubjectId || null);
                setProfileAttendanceEntries(data.attendanceEntries || []);
                setProfileAttendanceStats(data.statistics || null);
            } else {
                const message = response.data?.message || 'Failed to load attendance.';
                setProfileAttendanceError(message);
                setProfileAttendanceEntries([]);
                setProfileAttendanceStats(null);
            }
        } catch (error: any) {
            if (profileAttendanceRequestRef.current !== requestId) {
                return;
            }

            const message = error.response?.data?.message || 'Failed to load attendance.';
            setProfileAttendanceError(message);
            setProfileAttendanceEntries([]);
            setProfileAttendanceStats(null);
        } finally {
            if (profileAttendanceRequestRef.current === requestId) {
                setProfileAttendanceLoading(false);
            }
        }
    };

    const openProfileModal = (student: any) => {
        setStudentForProfile(student);
        resetProfileAttendance();
        setProfileModalVisible(true);
        void fetchProfileAttendance(student._id);
    };

    const closeProfileModal = () => {
        profileAttendanceRequestRef.current += 1;
        setProfileModalVisible(false);
        setStudentForProfile(null);
        resetProfileAttendance();
    };

    const handleCall = async (phoneNumber?: string) => {
        if (!phoneNumber?.trim()) {
            Alert.alert('Unavailable', 'Phone number is not available.');
            return;
        }

        const url = `tel:${phoneNumber.trim()}`;

        try {
            const supported = await Linking.canOpenURL(url);
            if (!supported) {
                Alert.alert('Unavailable', 'Calling is not supported on this device.');
                return;
            }

            await Linking.openURL(url);
        } catch {
            Alert.alert('Error', 'Failed to open the dialer.');
        }
    };

    const formatAttendanceDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const getAttendancePercentageColor = (percentage: number) => {
        if (percentage >= 75) return '#16A34A';
        if (percentage >= 50) return '#F59E0B';
        return '#DC2626';
    };

    const handleSelectProfileSubject = (subject: any) => {
        if (!studentForProfile?._id) {
            return;
        }

        setProfileAttendanceEntries([]);
        setProfileAttendanceStats(null);
        setProfileSelectedSubjectId(subject._id);
        void fetchProfileAttendance(studentForProfile._id, subject._id);
    };

    const handleShowAllProfileSubjects = () => {
        setProfileSelectedSubjectId(null);
        setProfileAttendanceEntries([]);
        setProfileAttendanceStats(null);
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

    const renderProfileSubjectChip = ({ item }: { item: any }) => {
        const isSelected = profileSelectedSubjectId === item._id;

        return (
            <TouchableOpacity
                style={[styles.profileAttendanceChip, isSelected && styles.profileAttendanceChipActive]}
                onPress={() => isSelected ? handleShowAllProfileSubjects() : handleSelectProfileSubject(item)}
            >
                <Text style={[styles.profileAttendanceChipText, isSelected && styles.profileAttendanceChipTextActive]}>
                    {item.name}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderProfileAttendanceItem = (item: any) => {
        const isPresent = item.status === 'PRESENT';
        const attendance = item.attendance;

        return (
            <View key={item._id} style={styles.profileAttendanceCard}>
                <View
                    style={[
                        styles.profileAttendanceStatusDot,
                        { backgroundColor: isPresent ? '#16A34A' : '#DC2626' },
                    ]}
                />
                <View style={styles.profileAttendanceInfo}>
                    <Text style={styles.profileAttendanceSubject}>
                        {attendance?.subject?.name || 'Unknown Subject'}
                    </Text>
                    <Text style={styles.profileAttendanceDate}>
                        {attendance?.date ? formatAttendanceDate(attendance.date) : 'Unknown Date'}
                    </Text>
                </View>
                <View
                    style={[
                        styles.profileAttendanceStatusBadge,
                        { backgroundColor: isPresent ? '#DCFCE7' : '#FEE2E2' },
                    ]}
                >
                    <Text
                        style={[
                            styles.profileAttendanceStatusText,
                            { color: isPresent ? '#16A34A' : '#DC2626' },
                        ]}
                    >
                        {item.status}
                    </Text>
                </View>
            </View>
        );
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
                                    style={styles.viewProfileButton}
                                    onPress={() => {
                                        openProfileModal(item);
                                    }}
                                >
                                    <Ionicons name="person-circle-outline" size={14} color="#FFFFFF" />
                                    <Text style={styles.actionButtonText}>View Profile</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.editStudentButton}
                                    onPress={() => openEditStudentModal(item)}
                                >
                                    <Ionicons name="create-outline" size={14} color="#FFFFFF" />
                                    <Text style={styles.actionButtonText}>Edit Details</Text>
                                </TouchableOpacity>
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

    const selectedProfileSubject = profileAttendanceSubjects.find(
        (subject) => subject._id === profileSelectedSubjectId
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
                <View style={styles.headerTextWrap}>
                    <Text style={styles.headerTitle}>Students</Text>
                    <Text style={styles.headerSubtitle}>
                        {filteredStudents.length} of {students.length} students
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.registerBtn, styles.bulkRegisterBtn]}
                        activeOpacity={0.85}
                        onPress={handleOpenBulkRegisterModal}
                    >
                        <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.registerBtnText}>Bulk</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.registerBtn}
                        activeOpacity={0.85}
                        onPress={handleOpenRegisterModal}
                    >
                        <Ionicons name="person-add" size={16} color="#FFFFFF" />
                        <Text style={styles.registerBtnText}>Add</Text>
                    </TouchableOpacity>
                </View>
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
                visible={profileModalVisible}
                onRequestClose={closeProfileModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Student Profile</Text>
                            <TouchableOpacity onPress={closeProfileModal}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
                            <View style={styles.profileAvatarWrap}>
                                <View style={styles.profileAvatar}>
                                    <Text style={styles.profileAvatarText}>
                                        {studentForProfile?.name?.charAt(0)?.toUpperCase() || 'S'}
                                    </Text>
                                </View>
                                <Text style={styles.profileName}>{studentForProfile?.name || '-'}</Text>
                                <Text style={styles.profileRoll}>Roll #{studentForProfile?.rollNumber ?? '-'}</Text>
                            </View>

                            <View style={styles.profileCard}>
                                <Text style={styles.profileSectionTitle}>Personal Details</Text>
                                <View style={styles.profileRow}>
                                    <Text style={styles.profileLabel}>Name</Text>
                                    <Text style={styles.profileValue}>{studentForProfile?.name || '-'}</Text>
                                </View>
                                <View style={styles.profileRow}>
                                    <Text style={styles.profileLabel}>Email</Text>
                                    <Text style={styles.profileValue}>{studentForProfile?.email || '-'}</Text>
                                </View>
                                <View style={styles.profileRow}>
                                    <Text style={styles.profileLabel}>Mobile</Text>
                                    <Text style={styles.profileValue}>{studentForProfile?.mobile || '-'}</Text>
                                </View>
                                <View style={styles.profileRow}>
                                    <Text style={styles.profileLabel}>Batch</Text>
                                    <Text style={styles.profileValue}>{studentForProfile?.batchName || studentForProfile?.batch?.name || '-'}</Text>
                                </View>
                                <View style={[styles.profileRow, styles.profileRowLast]}>
                                    <Text style={styles.profileLabel}>Verified</Text>
                                    <Text style={styles.profileValue}>{studentForProfile?.isVerified ? 'Yes' : 'No'}</Text>
                                </View>
                                <View style={styles.callActions}>
                                    <TouchableOpacity
                                        style={styles.callButton}
                                        onPress={() => handleCall(studentForProfile?.mobile)}
                                    >
                                        <Ionicons name="call-outline" size={16} color="#FFFFFF" />
                                        <Text style={styles.callButtonText}>Call Student</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.profileCard}>
                                <Text style={styles.profileSectionTitle}>Parent Details</Text>
                                <View style={styles.profileRow}>
                                    <Text style={styles.profileLabel}>Parent Name</Text>
                                    <Text style={styles.profileValue}>{studentForProfile?.parentName || '-'}</Text>
                                </View>
                                <View style={styles.profileRow}>
                                    <Text style={styles.profileLabel}>Father Mobile</Text>
                                    <Text style={styles.profileValue}>{studentForProfile?.fatherMobile || '-'}</Text>
                                </View>
                                <View style={[styles.profileRow, styles.profileRowLast]}>
                                    <Text style={styles.profileLabel}>Mother Mobile</Text>
                                    <Text style={styles.profileValue}>{studentForProfile?.motherMobile || '-'}</Text>
                                </View>
                                <View style={styles.callActions}>
                                    <TouchableOpacity
                                        style={styles.callButton}
                                        onPress={() => handleCall(studentForProfile?.fatherMobile)}
                                    >
                                        <Ionicons name="call-outline" size={16} color="#FFFFFF" />
                                        <Text style={styles.callButtonText}>Call Father</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.callButton}
                                        onPress={() => handleCall(studentForProfile?.motherMobile)}
                                    >
                                        <Ionicons name="call-outline" size={16} color="#FFFFFF" />
                                        <Text style={styles.callButtonText}>Call Mother</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.profileCard}>
                                <Text style={styles.profileSectionTitle}>Attendance</Text>

                                <View style={styles.profileAttendanceChipListWrapper}>
                                    <FlatList
                                        data={profileAttendanceSubjects}
                                        renderItem={renderProfileSubjectChip}
                                        keyExtractor={(item) => item._id}
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.profileAttendanceChipContainer}
                                        style={styles.profileAttendanceChipList}
                                    />
                                </View>

                                {profileAttendanceLoading ? (
                                    <View style={styles.profileAttendanceLoadingWrap}>
                                        <ActivityIndicator size="small" color="#007AFF" />
                                    </View>
                                ) : profileAttendanceError ? (
                                    <View style={styles.profileAttendanceEmptyState}>
                                        <Ionicons name="alert-circle-outline" size={28} color="#DC2626" />
                                        <Text style={styles.profileAttendanceEmptyText}>{profileAttendanceError}</Text>
                                    </View>
                                ) : profileAttendanceSubjects.length === 0 ? (
                                    <View style={styles.profileAttendanceEmptyState}>
                                        <Ionicons name="book-outline" size={28} color="#CBD5E1" />
                                        <Text style={styles.profileAttendanceEmptyText}>
                                            This student is not enrolled in any subject.
                                        </Text>
                                    </View>
                                ) : !profileSelectedSubjectId ? (
                                    <View style={styles.profileAttendanceEmptyState}>
                                        <Ionicons name="calendar-outline" size={28} color="#CBD5E1" />
                                        <Text style={styles.profileAttendanceEmptyText}>
                                            Select a subject above to view attendance history.
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        {profileAttendanceStats ? (
                                            <View style={styles.profileAttendanceStatsCard}>
                                                <Text style={styles.profileAttendanceStatsTitle}>
                                                    {selectedProfileSubject?.name || 'Selected Subject'}
                                                </Text>
                                                <View style={styles.profileAttendanceStatsRow}>
                                                    <View style={styles.profileAttendanceStatItem}>
                                                        <Text style={styles.profileAttendanceStatValue}>
                                                            {profileAttendanceStats.totalClasses}
                                                        </Text>
                                                        <Text style={styles.profileAttendanceStatLabel}>Total</Text>
                                                    </View>
                                                    <View style={styles.profileAttendanceStatDivider} />
                                                    <View style={styles.profileAttendanceStatItem}>
                                                        <Text style={[styles.profileAttendanceStatValue, { color: '#16A34A' }]}>
                                                            {profileAttendanceStats.present}
                                                        </Text>
                                                        <Text style={styles.profileAttendanceStatLabel}>Present</Text>
                                                    </View>
                                                    <View style={styles.profileAttendanceStatDivider} />
                                                    <View style={styles.profileAttendanceStatItem}>
                                                        <Text style={[styles.profileAttendanceStatValue, { color: '#DC2626' }]}>
                                                            {profileAttendanceStats.absent}
                                                        </Text>
                                                        <Text style={styles.profileAttendanceStatLabel}>Absent</Text>
                                                    </View>
                                                    <View style={styles.profileAttendanceStatDivider} />
                                                    <View style={styles.profileAttendanceStatItem}>
                                                        <Text
                                                            style={[
                                                                styles.profileAttendanceStatValue,
                                                                {
                                                                    color: getAttendancePercentageColor(
                                                                        profileAttendanceStats.attendancePercentage
                                                                    ),
                                                                },
                                                            ]}
                                                        >
                                                            {profileAttendanceStats.attendancePercentage}%
                                                        </Text>
                                                        <Text style={styles.profileAttendanceStatLabel}>Percentage</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        ) : null}

                                        {profileAttendanceEntries.length === 0 ? (
                                            <View style={styles.profileAttendanceEmptyState}>
                                                <Ionicons name="checkmark-circle-outline" size={28} color="#CBD5E1" />
                                                <Text style={styles.profileAttendanceEmptyText}>
                                                    No attendance records found for this subject.
                                                </Text>
                                            </View>
                                        ) : (
                                            <View style={styles.profileAttendanceListWrapper}>
                                                {profileAttendanceEntries.map((entry) => renderProfileAttendanceItem(entry))}
                                            </View>
                                        )}
                                    </>
                                )}
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={closeProfileModal}
                            >
                                <Text style={styles.saveButtonText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                animationType="slide"
                transparent
                visible={editStudentModalVisible}
                statusBarTranslucent
                onRequestClose={closeEditStudentModal}
            >
                <KeyboardAvoidingView
                    style={styles.modalKeyboardContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Student Details</Text>
                            <TouchableOpacity onPress={closeEditStudentModal} disabled={updatingStudentDetails}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.modalBody}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={styles.bulkInfoCard}>
                                <Text style={styles.bulkInfoTitle}>Update student details</Text>
                                <Text style={styles.bulkInfoText}>
                                    Saving changes will mark the student unverified and send a fresh verification email.
                                </Text>
                            </View>

                            <Text style={styles.label}>Roll Number</Text>
                            <TextInput
                                style={styles.input}
                                value={editForm.rollNumber}
                                onChangeText={(value) => updateEditField('rollNumber', value)}
                                keyboardType="number-pad"
                                placeholder="Enter roll number"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Student Name</Text>
                            <TextInput
                                style={styles.input}
                                value={editForm.name}
                                onChangeText={(value) => updateEditField('name', value)}
                                placeholder="Enter student name"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                value={editForm.email}
                                onChangeText={(value) => updateEditField('email', value)}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholder="Enter email"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Mobile</Text>
                            <TextInput
                                style={styles.input}
                                value={editForm.mobile}
                                onChangeText={(value) => updateEditField('mobile', value)}
                                keyboardType="phone-pad"
                                placeholder="Enter mobile number"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Parent Name</Text>
                            <TextInput
                                style={styles.input}
                                value={editForm.parentName}
                                onChangeText={(value) => updateEditField('parentName', value)}
                                placeholder="Enter parent name"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Father Mobile</Text>
                            <TextInput
                                style={styles.input}
                                value={editForm.fatherMobile}
                                onChangeText={(value) => updateEditField('fatherMobile', value)}
                                keyboardType="phone-pad"
                                placeholder="Enter father mobile"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>Mother Mobile</Text>
                            <TextInput
                                style={styles.input}
                                value={editForm.motherMobile}
                                onChangeText={(value) => updateEditField('motherMobile', value)}
                                keyboardType="phone-pad"
                                placeholder="Enter mother mobile"
                                placeholderTextColor="#94A3B8"
                            />
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={closeEditStudentModal}
                                disabled={updatingStudentDetails}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleUpdateStudentDetails}
                                disabled={updatingStudentDetails}
                            >
                                {updatingStudentDetails ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Update Details</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal
                animationType="slide"
                transparent
                visible={registerModalVisible}
                statusBarTranslucent
                onRequestClose={() => setRegisterModalVisible(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalKeyboardContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Register Student</Text>
                            <TouchableOpacity onPress={() => setRegisterModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.modalBody}
                            keyboardShouldPersistTaps="handled"
                        >
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
                </KeyboardAvoidingView>
            </Modal>

            <Modal
                animationType="slide"
                transparent
                visible={bulkRegisterModalVisible}
                onRequestClose={handleCloseBulkRegisterModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Bulk Register Students</Text>
                            <TouchableOpacity onPress={handleCloseBulkRegisterModal} disabled={bulkParsingFile || bulkRegisteringStudents}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
                            <View style={styles.bulkInfoCard}>
                                <Text style={styles.bulkInfoTitle}>Upload XLSX File</Text>
                                <Text style={styles.bulkInfoText}>
                                    Accepted columns: name, mobile, email, Date-of-birth, parent name, father mobile number, mother mobile number.
                                </Text>
                            </View>

                            <Text style={styles.label}>Batch</Text>
                            <TouchableOpacity
                                style={styles.selectInput}
                                onPress={() => {
                                    setBulkBatchMenuOpen((prev) => !prev);
                                    setBulkSubjectMenuOpen(false);
                                }}
                            >
                                <Text style={bulkBatchId ? styles.selectText : styles.placeholderText}>
                                    {bulkBatchId
                                        ? batches.find((batch) => batch._id === bulkBatchId)?.name || 'Select batch'
                                        : 'Select batch'}
                                </Text>
                                <Ionicons
                                    name={bulkBatchMenuOpen ? 'chevron-up' : 'chevron-down'}
                                    size={16}
                                    color="#64748B"
                                />
                            </TouchableOpacity>
                            {bulkBatchMenuOpen ? (
                                <View style={styles.selectMenu}>
                                    {batches.length === 0 ? (
                                        <Text style={styles.selectEmpty}>No batches found</Text>
                                    ) : (
                                        batches.map((batch) => (
                                            <TouchableOpacity
                                                key={batch._id}
                                                style={styles.selectItem}
                                                onPress={() => handleSelectBulkBatch(batch._id)}
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
                                disabled={!bulkBatchId || bulkSubjectLoading}
                                onPress={() => {
                                    if (bulkBatchId && !bulkSubjectLoading) {
                                        setBulkSubjectMenuOpen((prev) => !prev);
                                        setBulkBatchMenuOpen(false);
                                    }
                                }}
                            >
                                <Text style={bulkSubjectIds.length > 0 ? styles.selectText : styles.placeholderText}>
                                    {bulkSubjectLoading
                                        ? 'Loading subjects...'
                                        : bulkSubjectIds.length > 0
                                            ? `${bulkSubjectIds.length} subject(s) selected`
                                            : 'Select subjects'}
                                </Text>
                                <Ionicons
                                    name={bulkSubjectMenuOpen ? 'chevron-up' : 'chevron-down'}
                                    size={16}
                                    color="#64748B"
                                />
                            </TouchableOpacity>
                            {bulkSubjectMenuOpen ? (
                                <View style={styles.selectMenu}>
                                    {bulkSubjects.length === 0 ? (
                                        <Text style={styles.selectEmpty}>No subjects found in this batch</Text>
                                    ) : (
                                        bulkSubjects.map((subject) => {
                                            const isSelected = bulkSubjectIds.includes(subject._id);
                                            return (
                                                <TouchableOpacity
                                                    key={subject._id}
                                                    style={[styles.selectItem, isSelected && styles.selectItemActive]}
                                                    onPress={() => handleToggleBulkSubject(subject._id)}
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

                            <Text style={styles.label}>XLSX File</Text>
                            <TouchableOpacity
                                style={styles.fileUploadButton}
                                activeOpacity={0.85}
                                onPress={handlePickBulkRegisterFile}
                                disabled={bulkParsingFile || bulkRegisteringStudents}
                            >
                                {bulkParsingFile ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="document-attach-outline" size={18} color="#FFFFFF" />
                                        <Text style={styles.fileUploadButtonText}>
                                            {bulkFileName ? 'Replace File' : 'Upload XLSX File'}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            {bulkFileName ? (
                                <View style={styles.bulkFileCard}>
                                    <View style={styles.bulkFileHeader}>
                                        <Ionicons name="document-text-outline" size={18} color="#1D4ED8" />
                                        <Text style={styles.bulkFileName}>{bulkFileName}</Text>
                                    </View>
                                    <Text style={styles.bulkFileMeta}>
                                        {bulkStudentsData.length} student row(s) parsed into JSON payload
                                    </Text>
                                </View>
                            ) : null}

                            {bulkParseError ? (
                                <Text style={styles.bulkErrorText}>{bulkParseError}</Text>
                            ) : null}

                            {bulkStudentsData.length > 0 ? (
                                <View style={styles.bulkPreviewCard}>
                                    <View style={styles.bulkPreviewHeader}>
                                        <Text style={styles.bulkPreviewTitle}>Preview</Text>
                                        <Text style={styles.bulkPreviewCount}>{bulkStudentsData.length} rows</Text>
                                    </View>
                                    {bulkStudentsData.slice(0, 3).map((student) => (
                                        <View key={`${student.sourceRowNumber}-${student.email}-${student.mobile}`} style={styles.bulkPreviewRow}>
                                            <View style={styles.bulkPreviewTextWrap}>
                                                <Text style={styles.bulkPreviewName}>{student.name || 'Unnamed Student'}</Text>
                                                <Text style={styles.bulkPreviewMeta}>
                                                    Row {student.sourceRowNumber} | {student.email || 'No email'}
                                                </Text>
                                            </View>
                                        </View>
                                    ))}
                                    {bulkStudentsData.length > 3 ? (
                                        <Text style={styles.bulkPreviewMore}>
                                            + {bulkStudentsData.length - 3} more row(s) ready to send
                                        </Text>
                                    ) : null}
                                </View>
                            ) : null}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={handleCloseBulkRegisterModal}
                                disabled={bulkParsingFile || bulkRegisteringStudents}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleBulkRegisterStudents}
                                disabled={bulkParsingFile || bulkRegisteringStudents}
                            >
                                {bulkRegisteringStudents ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Submit</Text>
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
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
    bulkRegisterBtn: {
        backgroundColor: '#1D4ED8',
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
    viewProfileButton: {
        backgroundColor: '#0F766E',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: '100%',
    },
    editStudentButton: {
        backgroundColor: '#7C3AED',
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
    modalKeyboardContainer: {
        flex: 1,
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
    bulkInfoCard: {
        backgroundColor: '#EFF6FF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    bulkInfoTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1D4ED8',
    },
    bulkInfoText: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 19,
        color: '#475569',
    },
    profileAvatarWrap: {
        alignItems: 'center',
        marginBottom: 16,
    },
    profileAvatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    profileAvatarText: {
        fontSize: 28,
        fontWeight: '800',
        color: '#2563EB',
    },
    profileName: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
    },
    profileRoll: {
        marginTop: 4,
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    profileCard: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
    },
    profileSectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 10,
    },
    profileAttendanceChipListWrapper: {
        flexShrink: 0,
    },
    profileAttendanceChipList: {
        flexGrow: 0,
        minHeight: 52,
        marginBottom: 14,
    },
    profileAttendanceChipContainer: {
        gap: 8,
        paddingRight: 8,
        paddingVertical: 4,
    },
    profileAttendanceChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignSelf: 'flex-start',
        flexShrink: 0,
        maxWidth: 220,
    },
    profileAttendanceChipActive: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    profileAttendanceChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        lineHeight: 18,
    },
    profileAttendanceChipTextActive: {
        color: '#FFFFFF',
    },
    profileAttendanceLoadingWrap: {
        paddingVertical: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileAttendanceEmptyState: {
        paddingVertical: 24,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    profileAttendanceEmptyText: {
        color: '#94A3B8',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    profileAttendanceStatsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    profileAttendanceStatsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 14,
    },
    profileAttendanceStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    profileAttendanceStatItem: {
        alignItems: 'center',
        flex: 1,
    },
    profileAttendanceStatValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    profileAttendanceStatLabel: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 4,
        fontWeight: '500',
    },
    profileAttendanceStatDivider: {
        width: 1,
        height: 32,
        backgroundColor: '#E2E8F0',
    },
    profileAttendanceListWrapper: {
        gap: 10,
    },
    profileAttendanceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 14,
        borderRadius: 14,
        marginBottom: 10,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    profileAttendanceStatusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 12,
    },
    profileAttendanceInfo: {
        flex: 1,
    },
    profileAttendanceSubject: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
    },
    profileAttendanceDate: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    profileAttendanceStatusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    profileAttendanceStatusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    profileRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        gap: 12,
    },
    profileRowLast: {
        borderBottomWidth: 0,
    },
    profileLabel: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    profileValue: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
        textAlign: 'right',
    },
    callActions: {
        marginTop: 14,
        gap: 10,
    },
    callButton: {
        backgroundColor: '#059669',
        borderRadius: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    callButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
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
    fileUploadButton: {
        marginTop: 4,
        backgroundColor: '#0F766E',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    fileUploadButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    bulkFileCard: {
        marginTop: 10,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 14,
    },
    bulkFileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bulkFileName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    bulkFileMeta: {
        marginTop: 6,
        fontSize: 12,
        color: '#64748B',
        lineHeight: 18,
    },
    bulkErrorText: {
        marginTop: 10,
        color: '#DC2626',
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
    bulkPreviewCard: {
        marginTop: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 14,
    },
    bulkPreviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    bulkPreviewTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    bulkPreviewCount: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1D4ED8',
    },
    bulkPreviewRow: {
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    bulkPreviewTextWrap: {
        gap: 3,
    },
    bulkPreviewName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
    },
    bulkPreviewMeta: {
        fontSize: 12,
        color: '#64748B',
        lineHeight: 18,
    },
    bulkPreviewMore: {
        marginTop: 10,
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
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
