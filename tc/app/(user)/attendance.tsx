import React, { useCallback, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
    FlatList,
    BackHandler,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import {
    getAllAttendance,
    getAttendanceById,
    deleteAttendance,
    getAllBatches,
    getAllSubjectsOfBatch,
    getAllStudentsOfSubject,
    createAttendance,
    markAttendance as markAttendanceApi,
} from '../../services/api';

type Step = 'list' | 'viewAttendance' | 'selectBatch' | 'selectSubject' | 'selectDate' | 'markAttendance';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function getToday() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getCalendarDays(year: number, month: number) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
}

export default function AttendanceScreen() {
    // --- List step state ---
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [attendanceList, setAttendanceList] = useState<any[]>([]);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // --- Flow step state ---
    const [step, setStep] = useState<Step>('list');
    const [attendanceDetails, setAttendanceDetails] = useState<any | null>(null);
    const [attendanceDetailsLoading, setAttendanceDetailsLoading] = useState(false);
    const [viewingAttendanceId, setViewingAttendanceId] = useState<string | null>(null);
    const attendanceDetailsRequestRef = useRef<string | null>(null);

    // --- Select batch ---
    const [batches, setBatches] = useState<any[]>([]);
    const [batchesLoading, setBatchesLoading] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState<any | null>(null);

    // --- Select subject ---
    const [subjects, setSubjects] = useState<any[]>([]);
    const [subjectsLoading, setSubjectsLoading] = useState(false);
    const [selectedSubject, setSelectedSubject] = useState<any | null>(null);

    // --- Select date ---
    const [selectedDate, setSelectedDate] = useState<Date>(getToday());
    const [calendarMonth, setCalendarMonth] = useState(getToday().getMonth());
    const [calendarYear, setCalendarYear] = useState(getToday().getFullYear());
    const [creatingAttendance, setCreatingAttendance] = useState(false);

    // --- Mark attendance ---
    const [attendanceId, setAttendanceId] = useState<string | null>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [studentsLoading, setStudentsLoading] = useState(false);
    const [statusMap, setStatusMap] = useState<Record<string, 'PRESENT' | 'ABSENT'>>({});
    const [savingAttendance, setSavingAttendance] = useState(false);

    // ===================== DATA FETCHING =====================

    const fetchAttendance = async () => {
        try {
            const response = await getAllAttendance({});
            if (response.data?.success) {
                setAttendanceList(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchBatches = async () => {
        setBatchesLoading(true);
        try {
            const response = await getAllBatches();
            if (response.data?.success) {
                const fetched = response.data.data || [];
                const sorted = fetched.sort((a: any, b: any) => {
                    const getNum = (s: string) => { const m = s.match(/\d+/); return m ? parseInt(m[0], 10) : Infinity; };
                    const nA = getNum(a.name), nB = getNum(b.name);
                    if (nA !== nB) return nB - nA;
                    return a.name.localeCompare(b.name);
                });
                setBatches(sorted);
            }
        } catch (error) {
            console.error('Error fetching batches:', error);
        } finally {
            setBatchesLoading(false);
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
        }
    };

    const fetchStudents = async (subjectId: string) => {
        setStudentsLoading(true);
        try {
            const response = await getAllStudentsOfSubject(subjectId);
            if (response.data?.success) {
                const list = response.data.data || [];
                setStudents(list);
                const map: Record<string, 'PRESENT' | 'ABSENT'> = {};
                list.forEach((s: any) => {
                    const id = s.studentDetails?._id || s._id;
                    if (id) map[id] = 'PRESENT';
                });
                setStatusMap(map);
            }
        } catch (error) {
            console.error('Error fetching students:', error);
        } finally {
            setStudentsLoading(false);
        }
    };

    // ===================== LIFECYCLE =====================

    useFocusEffect(
        useCallback(() => {
            fetchAttendance();
        }, [])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (step === 'viewAttendance') {
                    closeAttendanceDetails();
                    return true;
                }
                if (step === 'markAttendance') {
                    Alert.alert(
                        'Discard Attendance?',
                        'Going back will discard your marking progress.',
                        [
                            { text: 'Stay', style: 'cancel' },
                            { text: 'Discard', style: 'destructive', onPress: () => setStep('selectDate') },
                        ]
                    );
                    return true;
                }
                if (step === 'selectDate') { setStep('selectSubject'); return true; }
                if (step === 'selectSubject') { setStep('selectBatch'); return true; }
                if (step === 'selectBatch') { resetFlow(); return true; }
                return false;
            };
            const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => sub.remove();
        }, [step])
    );

    // ===================== ACTIONS =====================

    const resetFlow = () => {
        setStep('list');
        setAttendanceDetails(null);
        setAttendanceDetailsLoading(false);
        setViewingAttendanceId(null);
        setSelectedBatch(null);
        setBatches([]);
        setSelectedSubject(null);
        setSubjects([]);
        setSelectedDate(getToday());
        setCalendarMonth(getToday().getMonth());
        setCalendarYear(getToday().getFullYear());
        setAttendanceId(null);
        setStudents([]);
        setStatusMap({});
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAttendance();
    }, []);

    const handleTakeAttendance = () => {
        setStep('selectBatch');
        fetchBatches();
    };

    const closeAttendanceDetails = () => {
        attendanceDetailsRequestRef.current = null;
        setStep('list');
        setAttendanceDetails(null);
        setAttendanceDetailsLoading(false);
        setViewingAttendanceId(null);
    };

    const handleOpenAttendance = async (item: any) => {
        attendanceDetailsRequestRef.current = item._id;
        setStep('viewAttendance');
        setAttendanceDetails(null);
        setAttendanceDetailsLoading(true);
        setViewingAttendanceId(item._id);

        try {
            const response = await getAttendanceById(item._id);
            if (attendanceDetailsRequestRef.current !== item._id) {
                return;
            }

            if (response.data?.success) {
                setAttendanceDetails(response.data.data || null);
            } else {
                Alert.alert('Error', response.data?.message || 'Failed to fetch attendance details');
                closeAttendanceDetails();
            }
        } catch (error: any) {
            if (attendanceDetailsRequestRef.current !== item._id) {
                return;
            }

            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch attendance details');
            closeAttendanceDetails();
        } finally {
            if (attendanceDetailsRequestRef.current === item._id) {
                setAttendanceDetailsLoading(false);
                setViewingAttendanceId(null);
            }
        }
    };

    const handleSelectBatch = (batch: any) => {
        setSelectedBatch(batch);
        setStep('selectSubject');
        fetchSubjects(batch._id);
    };

    const handleSelectSubject = (subject: any) => {
        setSelectedSubject(subject);
        setSelectedDate(getToday());
        setCalendarMonth(getToday().getMonth());
        setCalendarYear(getToday().getFullYear());
        setStep('selectDate');
    };

    const handleCreateAttendance = async () => {
        if (!selectedSubject?._id || !selectedBatch?._id) return;
        setCreatingAttendance(true);
        try {
            const dateStr = selectedDate.toISOString();
            const response = await createAttendance(selectedSubject._id, selectedBatch._id, dateStr);
            if (response.data?.success) {
                const id = response.data.data?._id;
                setAttendanceId(id);
                await fetchStudents(selectedSubject._id);
                setStep('markAttendance');
            } else {
                Alert.alert('Error', response.data?.message || 'Failed to create attendance');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to create attendance');
        } finally {
            setCreatingAttendance(false);
        }
    };

    const toggleStatus = (studentId: string) => {
        setStatusMap((prev) => ({
            ...prev,
            [studentId]: prev[studentId] === 'PRESENT' ? 'ABSENT' : 'PRESENT',
        }));
    };

    const handleSaveAttendance = async () => {
        if (!attendanceId) return;
        const entries = Object.entries(statusMap)
            .filter(([, status]) => status === 'ABSENT')
            .map(([studentId, status]) => ({ studentId, status }));
        setSavingAttendance(true);
        try {
            const response = await markAttendanceApi(attendanceId, entries);
            if (response.data?.success) {
                Alert.alert('Success', 'Attendance saved successfully');
                resetFlow();
                fetchAttendance();
            } else {
                Alert.alert('Error', response.data?.message || 'Failed to save attendance');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to save attendance');
        } finally {
            setSavingAttendance(false);
        }
    };

    // ===================== DELETE =====================

    const handleDelete = async (item: any) => {
        setDeletingId(item._id);
        try {
            const response = await deleteAttendance(item._id);
            if (response.data?.success) {
                setAttendanceList((prev) => prev.filter((a) => a._id !== item._id));
                Alert.alert('Deleted', 'Attendance session deleted successfully');
            } else {
                Alert.alert('Error', response.data?.message || 'Failed to delete attendance');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to delete attendance');
        } finally {
            setDeletingId(null);
        }
    };

    const confirmDelete = (item: any) => {
        const subjectName = item.subject?.name || 'Unknown';
        const dateStr = formatDate(item.date);
        Alert.alert(
            'Delete Attendance',
            `Are you sure you want to delete the attendance for "${subjectName}" on ${dateStr}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
            ]
        );
    };

    // ===================== HELPERS =====================

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatSelectedDate = (date: Date) => {
        return date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    };

    // ===================== CALENDAR =====================

    const calendarDays = getCalendarDays(calendarYear, calendarMonth);

    const goToPrevMonth = () => {
        if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(calendarYear - 1); }
        else setCalendarMonth(calendarMonth - 1);
    };

    const goToNextMonth = () => {
        if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(calendarYear + 1); }
        else setCalendarMonth(calendarMonth + 1);
    };

    const selectCalendarDay = (day: number) => {
        setSelectedDate(new Date(calendarYear, calendarMonth, day));
    };

    const selectQuickDate = (date: Date) => {
        setSelectedDate(date);
        setCalendarMonth(date.getMonth());
        setCalendarYear(date.getFullYear());
    };

    // ===================== RENDER ITEMS =====================

    const renderAttendanceItem = ({ item }: { item: any }) => {
        const stats = item.statistics || {};
        const percentage = parseFloat(stats.attendancePercentage || 0);
        const viewingThisAttendance = viewingAttendanceId === item._id;
        const deletingThisAttendance = deletingId === item._id;

        return (
            <View style={styles.card}>
                <View style={styles.cardTop}>
                    <View style={styles.cardIconContainer}>
                        <Ionicons name="calendar-outline" size={22} color="#007AFF" />
                    </View>
                    <View style={styles.cardInfo}>
                        <Text style={styles.cardSubject}>{item.subject?.name || 'Unknown Subject'}</Text>
                        <Text style={styles.cardBatch}>{item.batch?.name || 'Unknown Batch'}</Text>
                    </View>
                    <View style={styles.cardActions}>
                        <TouchableOpacity
                            style={styles.viewButton}
                            onPress={() => handleOpenAttendance(item)}
                            disabled={viewingThisAttendance || deletingThisAttendance}
                            activeOpacity={0.8}
                        >
                            {viewingThisAttendance ? (
                                <ActivityIndicator size="small" color="#1D4ED8" />
                            ) : (
                                <>
                                    <Ionicons name="eye-outline" size={16} color="#1D4ED8" />
                                    <Text style={styles.viewButtonText}>View</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => confirmDelete(item)}
                            disabled={deletingThisAttendance || viewingThisAttendance}
                        >
                            {deletingThisAttendance ? (
                                <ActivityIndicator size="small" color="#DC2626" />
                            ) : (
                                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.cardDivider} />
                <View style={styles.cardBottom}>
                    <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={14} color="#64748B" />
                        <Text style={styles.metaText}>{formatDate(item.date)}</Text>
                    </View>
                    <View style={styles.statsRow}>
                        <View style={[styles.statBadge, styles.presentBadge]}>
                            <Text style={styles.presentBadgeText}>P: {stats.present ?? 0}</Text>
                        </View>
                        <View style={[styles.statBadge, styles.absentBadge]}>
                            <Text style={styles.absentBadgeText}>A: {stats.absent ?? 0}</Text>
                        </View>
                        <View style={[styles.statBadge, styles.percentBadge]}>
                            <Text style={styles.percentBadgeText}>{percentage}%</Text>
                        </View>
                    </View>
                </View>
                {item.takenBy?.name && (
                    <View style={styles.cardFooter}>
                        <Text style={styles.takenByText}>by {item.takenBy.name}</Text>
                    </View>
                )}
            </View>
        );
    };

    const renderBatchItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.selectCard} onPress={() => handleSelectBatch(item)} activeOpacity={0.8}>
            <View style={styles.selectCardIcon}>
                <Ionicons name="people" size={22} color="#007AFF" />
            </View>
            <View style={styles.selectCardInfo}>
                <Text style={styles.selectCardTitle}>{item.name}</Text>
                <Text style={styles.selectCardMeta}>Tap to select</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>
    );

    const renderSubjectItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.selectCard} onPress={() => handleSelectSubject(item)} activeOpacity={0.8}>
            <View style={styles.selectCardIcon}>
                <Ionicons name="book" size={20} color="#007AFF" />
            </View>
            <View style={styles.selectCardInfo}>
                <Text style={styles.selectCardTitle}>{item.name}</Text>
                <Text style={styles.selectCardMeta}>Tap to select</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>
    );

    const renderStudentItem = ({ item }: { item: any }) => {
        const details = item.studentDetails || item;
        const studentId = details._id;
        const status = statusMap[studentId] || 'PRESENT';
        const isPresent = status === 'PRESENT';

        return (
            <View style={styles.studentCard}>
                <View style={styles.studentInfo}>
                    <View style={styles.rollBadge}>
                        <Text style={styles.rollBadgeText}>{details.rollNumber ?? '-'}</Text>
                    </View>
                    <View style={styles.studentTextWrap}>
                        <Text style={styles.studentName}>{details.name}</Text>
                        <Text style={styles.studentMobile}>{details.mobile || ''}</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={[styles.toggleButton, isPresent ? styles.togglePresent : styles.toggleAbsent]}
                    onPress={() => toggleStatus(studentId)}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.toggleText, isPresent ? styles.togglePresentText : styles.toggleAbsentText]}>
                        {isPresent ? 'P' : 'A'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderAttendanceEntryItem = ({ item }: { item: any }) => {
        const student = item.student || {};
        const isPresent = item.status === 'PRESENT';

        return (
            <View style={styles.studentCard}>
                <View style={styles.studentInfo}>
                    <View style={styles.rollBadge}>
                        <Text style={styles.rollBadgeText}>{student.rollNumber ?? '-'}</Text>
                    </View>
                    <View style={styles.studentTextWrap}>
                        <Text style={styles.studentName}>{student.name || 'Unknown Student'}</Text>
                        <Text style={styles.studentMobile}>
                            {student.mobile || student.fatherMobile || student.motherMobile || 'No contact available'}
                        </Text>
                    </View>
                </View>
                <View style={[styles.entryStatusBadge, isPresent ? styles.entryStatusPresent : styles.entryStatusAbsent]}>
                    <Text style={[styles.entryStatusText, isPresent ? styles.entryStatusPresentText : styles.entryStatusAbsentText]}>
                        {item.status}
                    </Text>
                </View>
            </View>
        );
    };

    // ===================== STEP HEADER =====================

    const renderStepHeader = (title: string, onBack: () => void) => (
        <View style={styles.header}>
            <View style={styles.stepHeaderLeft}>
                <TouchableOpacity onPress={onBack} style={styles.backButtonTouch}>
                    <Ionicons name="arrow-back" size={20} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
            </View>
        </View>
    );

    // ===================== LOADING =====================

    if (loading && !refreshing && step === 'list') {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    // ===================== STEP: SELECT BATCH =====================

    if (step === 'selectBatch') {
        return (
            <View style={styles.container}>
                {renderStepHeader('Select Batch', resetFlow)}
                {batchesLoading ? (
                    <View style={styles.loadingInner}><ActivityIndicator size="large" color="#007AFF" /></View>
                ) : (
                    <FlatList
                        data={batches}
                        renderItem={renderBatchItem}
                        keyExtractor={(item) => item._id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No batches found.</Text>
                            </View>
                        }
                    />
                )}
            </View>
        );
    }

    // ===================== STEP: SELECT SUBJECT =====================

    if (step === 'selectSubject') {
        return (
            <View style={styles.container}>
                {renderStepHeader(`${selectedBatch?.name || 'Batch'} - Subjects`, () => setStep('selectBatch'))}
                {subjectsLoading ? (
                    <View style={styles.loadingInner}><ActivityIndicator size="large" color="#007AFF" /></View>
                ) : (
                    <FlatList
                        data={subjects}
                        renderItem={renderSubjectItem}
                        keyExtractor={(item) => item._id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No subjects found in this batch.</Text>
                            </View>
                        }
                    />
                )}
            </View>
        );
    }

    // ===================== STEP: SELECT DATE =====================

    if (step === 'selectDate') {
        const today = getToday();
        const yesterday = addDays(today, -1);
        const tomorrow = addDays(today, 1);

        return (
            <View style={styles.container}>
                {renderStepHeader('Select Date', () => setStep('selectSubject'))}
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dateScrollContent}>
                    <View style={styles.dateContextCard}>
                        <Text style={styles.dateContextLabel}>
                            {selectedBatch?.name}  /  {selectedSubject?.name}
                        </Text>
                    </View>

                    {/* Quick date buttons */}
                    <View style={styles.quickDatesRow}>
                        <TouchableOpacity
                            style={[styles.quickDateBtn, isSameDay(selectedDate, yesterday) && styles.quickDateBtnActive]}
                            onPress={() => selectQuickDate(yesterday)}
                        >
                            <Text style={[styles.quickDateText, isSameDay(selectedDate, yesterday) && styles.quickDateTextActive]}>
                                Yesterday
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.quickDateBtn, isSameDay(selectedDate, today) && styles.quickDateBtnActive]}
                            onPress={() => selectQuickDate(today)}
                        >
                            <Text style={[styles.quickDateText, isSameDay(selectedDate, today) && styles.quickDateTextActive]}>
                                Today
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.quickDateBtn, isSameDay(selectedDate, tomorrow) && styles.quickDateBtnActive]}
                            onPress={() => selectQuickDate(tomorrow)}
                        >
                            <Text style={[styles.quickDateText, isSameDay(selectedDate, tomorrow) && styles.quickDateTextActive]}>
                                Tomorrow
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Calendar */}
                    <View style={styles.calendarCard}>
                        <View style={styles.calendarHeader}>
                            <TouchableOpacity onPress={goToPrevMonth} style={styles.calendarArrow}>
                                <Ionicons name="chevron-back" size={22} color="#1E293B" />
                            </TouchableOpacity>
                            <Text style={styles.calendarMonthText}>{MONTHS[calendarMonth]} {calendarYear}</Text>
                            <TouchableOpacity onPress={goToNextMonth} style={styles.calendarArrow}>
                                <Ionicons name="chevron-forward" size={22} color="#1E293B" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.calendarDaysHeader}>
                            {DAYS.map((d) => (
                                <Text key={d} style={styles.calendarDayLabel}>{d}</Text>
                            ))}
                        </View>

                        <View style={styles.calendarGrid}>
                            {calendarDays.map((day, idx) => {
                                if (day === null) {
                                    return <View key={`empty-${idx}`} style={styles.calendarCell} />;
                                }
                                const cellDate = new Date(calendarYear, calendarMonth, day);
                                const isSelected = isSameDay(selectedDate, cellDate);
                                const isToday = isSameDay(today, cellDate);
                                return (
                                    <TouchableOpacity
                                        key={`day-${day}`}
                                        style={[
                                            styles.calendarCell,
                                            isSelected && styles.calendarCellSelected,
                                        ]}
                                        onPress={() => selectCalendarDay(day)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[
                                            styles.calendarDayText,
                                            isToday && !isSelected && styles.calendarDayToday,
                                            isSelected && styles.calendarDayTextSelected,
                                        ]}>
                                            {day}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.selectedDateDisplay}>
                        <Ionicons name="calendar" size={18} color="#007AFF" />
                        <Text style={styles.selectedDateText}>{formatSelectedDate(selectedDate)}</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleCreateAttendance}
                        disabled={creatingAttendance}
                        activeOpacity={0.8}
                    >
                        {creatingAttendance ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                                <Text style={styles.primaryButtonText}>Create Attendance</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    // ===================== STEP: MARK ATTENDANCE =====================

    if (step === 'markAttendance') {
        const presentCount = Object.values(statusMap).filter((s) => s === 'PRESENT').length;
        const absentCount = Object.values(statusMap).filter((s) => s === 'ABSENT').length;

        return (
            <View style={styles.container}>
                {renderStepHeader('Mark Attendance', () => {
                    Alert.alert(
                        'Discard Attendance?',
                        'Going back will discard your marking progress.',
                        [
                            { text: 'Stay', style: 'cancel' },
                            { text: 'Discard', style: 'destructive', onPress: () => setStep('selectDate') },
                        ]
                    );
                })}

                <View style={styles.markInfoBar}>
                    <Text style={styles.markInfoText}>
                        {selectedSubject?.name}  |  {formatSelectedDate(selectedDate)}
                    </Text>
                    <View style={styles.markCountsRow}>
                        <View style={[styles.statBadge, styles.presentBadge]}>
                            <Text style={styles.presentBadgeText}>P: {presentCount}</Text>
                        </View>
                        <View style={[styles.statBadge, styles.absentBadge]}>
                            <Text style={styles.absentBadgeText}>A: {absentCount}</Text>
                        </View>
                    </View>
                </View>

                {studentsLoading ? (
                    <View style={styles.loadingInner}><ActivityIndicator size="large" color="#007AFF" /></View>
                ) : (
                    <FlatList
                        data={students}
                        renderItem={renderStudentItem}
                        keyExtractor={(item) => item.studentDetails?._id || item._id}
                        contentContainerStyle={styles.studentListContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No students enrolled in this subject.</Text>
                            </View>
                        }
                    />
                )}

                <View style={styles.saveButtonContainer}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleSaveAttendance}
                        disabled={savingAttendance || students.length === 0}
                        activeOpacity={0.8}
                    >
                        {savingAttendance ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                                <Text style={styles.primaryButtonText}>Save Attendance</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ===================== STEP: VIEW ATTENDANCE =====================

    if (step === 'viewAttendance') {
        const session = attendanceDetails?.attendance;
        const stats = attendanceDetails?.statistics || {};
        const entries = attendanceDetails?.entries || [];

        return (
            <View style={styles.container}>
                {renderStepHeader('Attendance Details', closeAttendanceDetails)}

                {attendanceDetailsLoading ? (
                    <View style={styles.loadingInner}>
                        <ActivityIndicator size="large" color="#007AFF" />
                    </View>
                ) : (
                    <FlatList
                        data={entries}
                        renderItem={renderAttendanceEntryItem}
                        keyExtractor={(item) => item.student?._id || item._id}
                        contentContainerStyle={styles.detailListContent}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={
                            <View style={styles.detailSummaryCard}>
                                <Text style={styles.detailSummaryTitle}>{session?.subject?.name || 'Unknown Subject'}</Text>
                                <Text style={styles.detailSummarySubtitle}>{session?.batch?.name || 'Unknown Batch'}</Text>

                                <View style={styles.detailMetaRow}>
                                    <View style={styles.detailMetaBadge}>
                                        <Ionicons name="calendar-outline" size={14} color="#475569" />
                                        <Text style={styles.detailMetaText}>
                                            {session?.date ? formatDate(session.date) : 'Unknown Date'}
                                        </Text>
                                    </View>
                                    {session?.takenBy?.name ? (
                                        <View style={styles.detailMetaBadge}>
                                            <Ionicons name="person-outline" size={14} color="#475569" />
                                            <Text style={styles.detailMetaText}>{session.takenBy.name}</Text>
                                        </View>
                                    ) : null}
                                </View>

                                <View style={styles.detailStatsRow}>
                                    <View style={[styles.detailStatCard, styles.presentBadge]}>
                                        <Text style={styles.presentBadgeText}>{stats.present ?? 0}</Text>
                                        <Text style={styles.detailStatLabel}>Present</Text>
                                    </View>
                                    <View style={[styles.detailStatCard, styles.absentBadge]}>
                                        <Text style={styles.absentBadgeText}>{stats.absent ?? 0}</Text>
                                        <Text style={styles.detailStatLabel}>Absent</Text>
                                    </View>
                                    <View style={[styles.detailStatCard, styles.percentBadge]}>
                                        <Text style={styles.percentBadgeText}>{stats.attendancePercentage ?? 0}%</Text>
                                        <Text style={styles.detailStatLabel}>Attendance</Text>
                                    </View>
                                </View>

                                <Text style={styles.detailSectionTitle}>Student-wise status</Text>
                            </View>
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No students found for this attendance session.</Text>
                            </View>
                        }
                    />
                )}
            </View>
        );
    }

    // ===================== STEP: LIST (DEFAULT) =====================

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Attendance</Text>
                <TouchableOpacity style={styles.takeAttendanceButton} activeOpacity={0.8} onPress={handleTakeAttendance}>
                    <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                    <Text style={styles.takeAttendanceText}>Take Attendance</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={attendanceList}
                renderItem={renderAttendanceItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="clipboard-outline" size={56} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>No Attendance Records</Text>
                        <Text style={styles.emptyText}>
                            Tap "Take Attendance" to create your first attendance session.
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
        paddingTop: 30,
        paddingHorizontal: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    loadingInner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // --- Header ---
    header: {
        marginTop: 20,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    stepHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    backButtonTouch: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    takeAttendanceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        gap: 6,
    },
    takeAttendanceText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 15,
    },

    // --- List ---
    listContent: {
        paddingBottom: 20,
    },
    detailListContent: {
        paddingBottom: 20,
    },
    detailSummaryCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 18,
        marginBottom: 14,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    detailSummaryTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
    },
    detailSummarySubtitle: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 4,
    },
    detailMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 14,
    },
    detailMetaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F8FAFC',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    detailMetaText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    detailStatsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
    },
    detailStatCard: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    detailStatLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 4,
    },
    detailSectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
        marginTop: 18,
    },

    // --- Attendance Card ---
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardInfo: {
        flex: 1,
    },
    cardSubject: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    cardBatch: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 2,
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    viewButton: {
        minWidth: 72,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 12,
    },
    viewButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1D4ED8',
    },
    deleteButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 12,
    },
    cardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    statBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    presentBadge: {
        backgroundColor: '#F0FDF4',
    },
    presentBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#15803D',
    },
    absentBadge: {
        backgroundColor: '#FEF2F2',
    },
    absentBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    percentBadge: {
        backgroundColor: '#EFF6FF',
    },
    percentBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1D4ED8',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 10,
    },
    takenByText: {
        fontSize: 12,
        color: '#94A3B8',
        fontStyle: 'italic',
    },

    // --- Empty ---
    emptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1E293B',
        marginTop: 16,
        marginBottom: 6,
    },
    emptyText: {
        color: '#94A3B8',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },

    // --- Select Cards (Batch / Subject) ---
    selectCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 10,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    selectCardIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    selectCardInfo: {
        flex: 1,
    },
    selectCardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    selectCardMeta: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2,
    },

    // --- Date Selection ---
    dateScrollContent: {
        paddingBottom: 30,
    },
    dateContextCard: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        alignItems: 'center',
    },
    dateContextLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1D4ED8',
    },
    quickDatesRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    quickDateBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        backgroundColor: '#FFF',
    },
    quickDateBtnActive: {
        borderColor: '#007AFF',
        backgroundColor: '#EFF6FF',
    },
    quickDateText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    quickDateTextActive: {
        color: '#007AFF',
    },

    // --- Calendar ---
    calendarCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    calendarArrow: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarMonthText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
    },
    calendarDaysHeader: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    calendarDayLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    calendarCell: {
        width: '14.28%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarCellSelected: {
        backgroundColor: '#007AFF',
        borderRadius: 100,
    },
    calendarDayText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1E293B',
    },
    calendarDayToday: {
        color: '#007AFF',
        fontWeight: '700',
    },
    calendarDayTextSelected: {
        color: '#FFF',
        fontWeight: '700',
    },
    selectedDateDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 20,
    },
    selectedDateText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
    },

    // --- Primary Button ---
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007AFF',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    primaryButtonText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 16,
    },

    // --- Mark Attendance ---
    markInfoBar: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    markInfoText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1E293B',
        flex: 1,
    },
    markCountsRow: {
        flexDirection: 'row',
        gap: 6,
    },

    // --- Student Card ---
    studentListContent: {
        paddingBottom: 80,
    },
    studentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: 14,
        marginBottom: 8,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    studentInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    rollBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    rollBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
    },
    studentTextWrap: {
        flex: 1,
    },
    studentName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
    },
    studentMobile: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 1,
    },
    toggleButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    togglePresent: {
        backgroundColor: '#F0FDF4',
    },
    toggleAbsent: {
        backgroundColor: '#FEF2F2',
    },
    toggleText: {
        fontSize: 18,
        fontWeight: '800',
    },
    togglePresentText: {
        color: '#15803D',
    },
    toggleAbsentText: {
        color: '#DC2626',
    },
    entryStatusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        minWidth: 86,
        alignItems: 'center',
    },
    entryStatusPresent: {
        backgroundColor: '#DCFCE7',
    },
    entryStatusAbsent: {
        backgroundColor: '#FEE2E2',
    },
    entryStatusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    entryStatusPresentText: {
        color: '#15803D',
    },
    entryStatusAbsentText: {
        color: '#DC2626',
    },

    // --- Save Button Container ---
    saveButtonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: '#F8FAFC',
    },
});
