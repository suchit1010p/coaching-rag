import React, { useCallback, useState } from 'react';
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
    Linking,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import {
    getStudentSubjects,
    getStudentSubjectUnits,
    getStudentUnitMaterials,
    getMaterialDownloadUrl,
} from '../../services/api';

export default function StudentDashboard() {
    const { user } = useAuth();
    const router = useRouter();

    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [subjects, setSubjects] = useState<any[]>([]);

    const [selectedSubject, setSelectedSubject] = useState<any | null>(null);
    const [units, setUnits] = useState<any[]>([]);
    const [unitsLoading, setUnitsLoading] = useState(false);

    const [selectedUnit, setSelectedUnit] = useState<any | null>(null);
    const [materials, setMaterials] = useState<any[]>([]);
    const [materialsLoading, setMaterialsLoading] = useState(false);
    const canOpenAiChat = Boolean(selectedUnit?._id && materials.length > 0);

    const openAiChat = () => {
        if (!selectedUnit?._id) return;

        router.push({
            pathname: '/(student)/ai-chat',
            params: { unitId: selectedUnit._id },
        } as any);
    };

    const fetchSubjects = async () => {
        try {
            const response = await getStudentSubjects();
            if (response.data?.success) {
                setSubjects(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching subjects:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchUnits = async (subjectId: string) => {
        setUnitsLoading(true);
        try {
            const response = await getStudentSubjectUnits(subjectId);
            if (response.data?.success) {
                setUnits(response.data.data || []);
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

    const fetchMaterials = async (unitId: string) => {
        setMaterialsLoading(true);
        try {
            const response = await getStudentUnitMaterials(unitId);
            if (response.data?.success) {
                setMaterials(response.data.data || []);
            } else {
                setMaterials([]);
            }
        } catch (error) {
            console.error('Error fetching materials:', error);
            setMaterials([]);
        } finally {
            setMaterialsLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchSubjects();
        }, [])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (selectedUnit) {
                    handleBackToUnits();
                    return true;
                }
                if (selectedSubject) {
                    handleBackToSubjects();
                    return true;
                }
                return false;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [selectedSubject, selectedUnit])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        if (selectedUnit?._id) {
            fetchMaterials(selectedUnit._id);
        } else if (selectedSubject?._id) {
            fetchUnits(selectedSubject._id);
        } else {
            fetchSubjects();
        }
    }, [selectedSubject, selectedUnit]);

    const handleSubjectPress = (subject: any) => {
        setSelectedSubject(subject);
        setUnits([]);
        fetchUnits(subject._id);
    };

    const handleUnitPress = (unit: any) => {
        setSelectedUnit(unit);
        setMaterials([]);
        fetchMaterials(unit._id);
    };

    const handleBackToSubjects = () => {
        setSelectedSubject(null);
        setUnits([]);
        setSelectedUnit(null);
        setMaterials([]);
    };

    const handleBackToUnits = () => {
        setSelectedUnit(null);
        setMaterials([]);
    };

    const handleOpenMaterial = async (material: any) => {
        try {
            const response = await getMaterialDownloadUrl(material._id);
            const url = response.data?.data?.url;
            if (!url) {
                throw new Error('Unable to generate download link');
            }
            await Linking.openURL(url);
        } catch {
            Alert.alert('Error', 'Failed to open material');
        }
    };

    const renderSubjectItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.card} onPress={() => handleSubjectPress(item)} activeOpacity={0.88}>
            <View style={styles.cardIcon}>
                <Ionicons name="book" size={20} color="#007AFF" />
            </View>
            <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>Tap to view units</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>
    );

    const renderUnitItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.card} onPress={() => handleUnitPress(item)} activeOpacity={0.88}>
            <View style={styles.cardIcon}>
                <Ionicons name="layers-outline" size={20} color="#007AFF" />
            </View>
            <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>Tap to view materials</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>
    );

    const renderMaterialItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.card} onPress={() => handleOpenMaterial(item)} activeOpacity={0.88}>
            <View style={styles.cardIcon}>
                <Ionicons name="document-outline" size={20} color="#007AFF" />
            </View>
            <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>Tap to open</Text>
            </View>
            <Ionicons name="open-outline" size={18} color="#0EA5E9" />
        </TouchableOpacity>
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
                    <Text style={styles.nameText}>{user?.name?.split(' ')[0] || 'Student'}</Text>
                </View>
                <View style={styles.rollBadge}>
                    <Text style={styles.rollText}>Roll #{user?.rollNumber}</Text>
                </View>
            </View>

            {selectedSubject ? (
                <View style={styles.backRow}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={selectedUnit ? handleBackToUnits : handleBackToSubjects}
                    >
                        <Ionicons name="arrow-back" size={18} color="#1E293B" />
                        <Text style={styles.backText}>{selectedUnit ? 'Units' : 'Subjects'}</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            <View style={styles.contentHeader}>
                <Text style={styles.sectionTitle}>
                    {selectedUnit
                        ? `${selectedUnit.title}`
                        : selectedSubject
                            ? `${selectedSubject.name}`
                            : 'Your Subjects'}
                </Text>
            </View>

            {(selectedSubject && unitsLoading && !selectedUnit) || (selectedUnit && materialsLoading) ? (
                <View style={styles.loadingSubContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : (
                <FlatList
                    data={selectedUnit ? materials : selectedSubject ? units : subjects}
                    renderItem={selectedUnit ? renderMaterialItem : selectedSubject ? renderUnitItem : renderSubjectItem}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons
                                name={selectedUnit ? 'document-outline' : selectedSubject ? 'layers-outline' : 'book-outline'}
                                size={48}
                                color="#CBD5E1"
                            />
                            <Text style={styles.emptyText}>
                                {selectedUnit
                                    ? 'No materials in this unit yet.'
                                    : selectedSubject
                                        ? 'No units in this subject yet.'
                                        : 'No subjects enrolled yet.'}
                            </Text>
                        </View>
                    }
                />
            )}

            {canOpenAiChat ? (
                <TouchableOpacity
                    style={styles.aiFloatingButton}
                    onPress={openAiChat}
                    activeOpacity={0.86}
                    accessibilityRole="button"
                    accessibilityLabel="Open AI chat for this unit"
                >
                    <MaterialCommunityIcons name="robot-outline" size={30} color="#FFF" />
                </TouchableOpacity>
            ) : null}
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
    rollBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    rollText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#007AFF',
    },
    backRow: {
        marginBottom: 8,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        width: 100,
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
    listContent: {
        paddingBottom: 20,
    },
    aiFloatingButton: {
        position: 'absolute',
        right: 20,
        bottom: 88,
        zIndex: 1,
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6,
    },
    card: {
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
    cardIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardInfo: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    cardMeta: {
        marginTop: 2,
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
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
