import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';

export default function FlashcardsScreen({ onBack }) {
  const { theme } = useTheme();

  // Screen modes: 'decks' | 'study' | 'complete'
  const [viewMode, setViewMode] = useState('decks');

  // Decks state
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active study deck state
  const [activeDeck, setActiveDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studiedCount, setStudiedCount] = useState(0);

  // Create deck modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [creatingDeck, setCreatingDeck] = useState(false);

  // Load decks from API
  const loadDecks = useCallback(async () => {
    try {
      const res = await apiClient.get('/flashcards/decks');
      setDecks(res.data?.data?.decks || []);
    } catch (err) {
      console.warn('[Flashcards] Error loading decks:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  // Start study session for a deck
  const handleStartStudy = async (deck) => {
    try {
      triggerHaptic('medium');
      const res = await apiClient.get(`/flashcards/decks/${deck.id}`);
      const deckData = res.data?.data?.deck || deck;
      const loadedCards = deckData.cards || [];

      if (loadedCards.length === 0) {
        Alert.alert('Empty Deck', 'This deck does not have any cards yet.');
        return;
      }

      setActiveDeck(deckData);
      setCards(loadedCards);
      setCardIndex(0);
      setIsFlipped(false);
      setStudiedCount(0);
      setViewMode('study');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not load flashcard deck.');
    }
  };

  // Flip active card
  const handleFlipCard = () => {
    triggerHaptic('selection');
    setIsFlipped((prev) => !prev);
  };

  // Submit spaced repetition rating
  const handleRateCard = async (rating) => {
    triggerHaptic('light');
    const currentCard = cards[cardIndex];

    // Post review telemetry to backend
    if (currentCard?.id) {
      apiClient
        .post(`/flashcards/cards/${currentCard.id}/review`, { rating })
        .catch(() => {});
    }

    const nextCount = studiedCount + 1;
    setStudiedCount(nextCount);

    if (cardIndex < cards.length - 1) {
      setIsFlipped(false);
      setCardIndex((c) => c + 1);
    } else {
      triggerHaptic('success');
      setViewMode('complete');
    }
  };

  // Create a new deck via AI or manual
  const handleCreateDeck = async () => {
    if (!newTitle.trim()) return;
    try {
      triggerHaptic('medium');
      setCreatingDeck(true);

      await apiClient.post('/flashcards/generate-ai', {
        topic: newTopic.trim() || newTitle.trim(),
        numCards: 8,
      });

      setModalVisible(false);
      setNewTitle('');
      setNewTopic('');
      triggerHaptic('success');
      Alert.alert('Deck Created! 🎉', 'Your AI-powered flashcard deck is ready for study.');
      loadDecks();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create deck.');
    } finally {
      setCreatingDeck(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: Completion Screen
  // ----------------------------------------------------
  if (viewMode === 'complete') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title="Session Complete"
          subtitle={activeDeck?.title}
          showBack
          onBack={() => setViewMode('decks')}
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.completeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={{ fontSize: 50, marginBottom: 12 }}>🎉</Text>
            <Text style={[styles.completeTitle, { color: theme.text }]}>Deck Mastered!</Text>
            <Text style={[styles.completeSub, { color: theme.textMuted }]}>
              You reviewed {studiedCount} cards in this spaced repetition session.
            </Text>

            <View style={[styles.xpChip, { backgroundColor: `${theme.accentGold}20` }]}>
              <Text style={{ fontSize: 16, marginRight: 6 }}>⚡</Text>
              <Text style={[styles.xpText, { color: theme.accentGold }]}>+25 XP Boost Added</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
              onPress={() => setViewMode('decks')}
            >
              <Text style={styles.primaryBtnText}>Back to All Decks</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Active Study Mode
  // ----------------------------------------------------
  if (viewMode === 'study' && cards.length > 0) {
    const currentCard = cards[cardIndex];
    const totalCards = cards.length;

    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title={activeDeck?.title || 'Flashcards'}
          subtitle={`Card ${cardIndex + 1} of ${totalCards}`}
          showBack
          onBack={() => setViewMode('decks')}
        />

        <ScrollView contentContainerStyle={styles.studyScroll}>
          {/* Progress bar */}
          <View style={[styles.progressBarTrack, { backgroundColor: theme.cardHover }]}>
            <View
              style={[
                styles.progressBarFill,
                { backgroundColor: theme.primary, width: `${((cardIndex + 1) / totalCards) * 100}%` },
              ]}
            />
          </View>

          {/* 3D Flip Card Container */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleFlipCard}
            style={[
              styles.flashcard,
              {
                backgroundColor: theme.card,
                borderColor: isFlipped ? `${theme.primary}60` : theme.cardBorder,
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardSideLabel, { color: theme.primary }]}>
                {isFlipped ? '💡 ANSWER' : '❓ QUESTION'}
              </Text>
              <Text style={[styles.tapHint, { color: theme.textMuted }]}>Tap card to flip</Text>
            </View>

            <View style={styles.cardContentBox}>
              <Text style={[styles.cardText, { color: theme.text }]}>
                {isFlipped ? currentCard?.back : currentCard?.front}
              </Text>
            </View>

            <View style={styles.cardFooterRow}>
              <Text style={[styles.cardCounterText, { color: theme.textMuted }]}>
                {cardIndex + 1} / {totalCards}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Spaced Repetition Rating Buttons */}
          <Text style={[styles.ratingPrompt, { color: theme.textMuted }]}>Rate your recall</Text>
          <View style={styles.ratingButtonsRow}>
            <TouchableOpacity
              onPress={() => handleRateCard('HARD')}
              style={[styles.ratingBtn, { backgroundColor: `${theme.error}18`, borderColor: theme.error }]}
            >
              <Text style={[styles.ratingLabel, { color: theme.error }]}>Hard</Text>
              <Text style={[styles.ratingSub, { color: theme.error }]}>1 Day</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleRateCard('MEDIUM')}
              style={[styles.ratingBtn, { backgroundColor: `${theme.warning}18`, borderColor: theme.warning }]}
            >
              <Text style={[styles.ratingLabel, { color: theme.warning }]}>Good</Text>
              <Text style={[styles.ratingSub, { color: theme.warning }]}>3 Days</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleRateCard('EASY')}
              style={[styles.ratingBtn, { backgroundColor: `${theme.success}18`, borderColor: theme.success }]}
            >
              <Text style={[styles.ratingLabel, { color: theme.success }]}>Easy</Text>
              <Text style={[styles.ratingSub, { color: theme.success }]}>7 Days</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Decks Overview (Default)
  // ----------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Flashcards"
        subtitle="Spaced Repetition System (SRS)"
        showBack={Boolean(onBack)}
        onBack={onBack}
        rightElement={
          <TouchableOpacity onPress={() => setModalVisible(true)} style={[styles.addDeckBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.addDeckBtnText}>+ New Deck</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              triggerHaptic('light');
              setRefreshing(true);
              loadDecks();
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Your Study Decks</Text>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 32 }} />
        ) : decks.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>🗂️</Text>
            <Text style={[styles.emptyHeadline, { color: theme.text }]}>No Flashcard Decks Yet</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Create a deck on any Pakistani board or entry test topic, or generate one automatically from your uploaded notes.
            </Text>
          </View>
        ) : (
          decks.map((deck) => (
            <TouchableOpacity
              key={deck.id}
              activeOpacity={0.7}
              onPress={() => handleStartStudy(deck)}
              style={[styles.deckCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <View style={[styles.deckIconBox, { backgroundColor: `${theme.primary}20` }]}>
                <Text style={styles.deckIcon}>🗂️</Text>
              </View>
              <View style={styles.deckInfo}>
                <Text style={[styles.deckTitle, { color: theme.text }]}>{deck.title}</Text>
                <Text style={[styles.deckMeta, { color: theme.textMuted }]}>
                  {deck.cards?.length || deck._count?.cards || 0} cards • {deck.topic || 'General'}
                </Text>
              </View>
              <View style={[styles.studyBadge, { backgroundColor: theme.cardHover }]}>
                <Text style={[styles.studyBadgeText, { color: theme.primary }]}>Study →</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal: Create Deck */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Create AI Flashcard Deck</Text>
            <Text style={[styles.modalSub, { color: theme.textMuted }]}>
              Enter a subject and topic to generate spaced repetition cards.
            </Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Deck Title (e.g., Photosynthesis & Light Reactions)"
              placeholderTextColor={theme.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Curriculum Focus (e.g., MDCAT Biology Chapter 4)"
              placeholderTextColor={theme.textMuted}
              value={newTopic}
              onChangeText={setNewTopic}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: theme.cardHover }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={creatingDeck || !newTitle.trim()}
                onPress={handleCreateDeck}
                style={[styles.modalBtn, { backgroundColor: theme.primary, opacity: !newTitle.trim() ? 0.5 : 1 }]}
              >
                {creatingDeck ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Generate Deck</Text>
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
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  addDeckBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addDeckBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  deckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  deckIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deckIcon: {
    fontSize: 20,
  },
  deckInfo: {
    flex: 1,
  },
  deckTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  deckMeta: {
    fontSize: 12,
  },
  studyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  studyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyHeadline: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Study Styles
  studyScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  flashcard: {
    minHeight: 280,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardSideLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tapHint: {
    fontSize: 11,
  },
  cardContentBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  cardText: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    fontWeight: '600',
  },
  cardFooterRow: {
    alignItems: 'center',
  },
  cardCounterText: {
    fontSize: 12,
  },
  ratingPrompt: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 12,
  },
  ratingButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  ratingSub: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Complete Styles
  completeCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 20,
  },
  completeTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
  },
  completeSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    marginBottom: 24,
  },
  xpText: {
    fontSize: 13,
    fontWeight: '800',
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    marginBottom: 16,
  },
  modalInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 12,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
