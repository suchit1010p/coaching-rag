import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aiChat } from '../../services/api';

const INPUT_PLACEHOLDER_COLOR = '#94A3B8';

type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
};

const renderAssistantText = (text: string) => {
    const nodes: React.ReactNode[] = [];
    const boldPattern = /\*\*([\s\S]+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = boldPattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(text.slice(lastIndex, match.index));
        }

        nodes.push(
            <Text key={`bold-${match.index}`} style={styles.boldMessageText}>
                {match[1]}
            </Text>
        );

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }

    return nodes.length ? nodes : text;
};

export default function AiChatScreen() {
    const router = useRouter();
    const { unitId } = useLocalSearchParams<{ unitId?: string }>();
    const insets = useSafeAreaInsets();
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [sending, setSending] = useState(false);

    const normalizedUnitId = Array.isArray(unitId) ? unitId[0] : unitId;

    const handleSend = async () => {
        const trimmedQuestion = question.trim();

        if (!normalizedUnitId) {
            Alert.alert('Error', 'Unit id is missing.');
            return;
        }

        if (!trimmedQuestion || sending) return;

        const userMessage: ChatMessage = {
            id: `${Date.now()}-user`,
            role: 'user',
            text: trimmedQuestion,
        };

        setMessages((prev) => [userMessage, ...prev]);
        setQuestion('');
        setSending(true);

        try {
            const response = await aiChat(trimmedQuestion, normalizedUnitId);
            const answer =
                response.data?.data?.response ||
                response.data?.data?.answer ||
                response.data?.answer ||
                response.data?.message ||
                'No answer returned.';

            setMessages((prev) => [
                {
                    id: `${Date.now()}-assistant`,
                    role: 'assistant',
                    text: String(answer),
                },
                ...prev,
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to get AI answer.');
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isUser = item.role === 'user';

        return (
            <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.assistantMessageText]}>
                    {isUser ? item.text : renderAssistantText(item.text)}
                </Text>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
        >
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 18) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={20} color="#1E293B" />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <MaterialCommunityIcons name="robot-outline" size={24} color="#007AFF" />
                    <Text style={styles.headerTitle}>AI Chat</Text>
                </View>
            </View>

            <FlatList
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                inverted={true}
                contentContainerStyle={styles.messagesContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="robot-outline" size={46} color="#CBD5E1" />
                        <Text style={styles.emptyText}>Ask anything about this unit material.</Text>
                    </View>
                }
            />

            <View style={[styles.inputRow, { paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 8 }]}>
                <TextInput
                    style={styles.input}
                    placeholder="Ask a question"
                    placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                    value={question}
                    onChangeText={setQuestion}
                    multiline={true}
                />
                <TouchableOpacity
                    style={[styles.sendButton, (!question.trim() || sending) && styles.sendButtonDisabled]}
                    onPress={handleSend}
                    disabled={!question.trim() || sending}
                >
                    {sending ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <Ionicons name="send" size={20} color="#FFF" />
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 18,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF',
        marginRight: 12,
    },
    headerTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1E293B',
    },
    messagesContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    messageBubble: {
        maxWidth: '86%',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 10,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#007AFF',
    },
    assistantBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 21,
    },
    boldMessageText: {
        fontWeight: '700',
    },
    userMessageText: {
        color: '#FFF',
    },
    assistantMessageText: {
        color: '#1E293B',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        gap: 10,
    },
    emptyText: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
        paddingTop: 8,
        paddingHorizontal: 20,
        backgroundColor: '#F8FAFC',
    },
    input: {
        flex: 1,
        maxHeight: 120,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1E293B',
    },
    sendButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007AFF',
    },
    sendButtonDisabled: {
        backgroundColor: '#93C5FD',
    },
});
