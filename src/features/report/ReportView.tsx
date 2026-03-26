import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ReportContent } from '../../db/schema';

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {emoji} {title}
      </Text>
      {children}
    </View>
  );
}

export function ReportView({ content }: { content: ReportContent }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Snapshot */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{content.snapshot.title}</Text>
        <Text style={styles.headerSummary}>{content.snapshot.summary}</Text>
        <View style={styles.moodRow}>
          {content.snapshot.mood_palette.map((mood, i) => (
            <View key={i} style={styles.moodTag}>
              <Text style={styles.moodText}>{mood}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Patterns */}
      <Section emoji="🔄" title="浮现的模式">
        {content.patterns.recurring_themes.map((theme, i) => (
          <View key={i} style={styles.patternCard}>
            <Text style={styles.patternTheme}>{theme.theme}</Text>
            {theme.evidence.map((e, j) => (
              <Text key={j} style={styles.evidence}>「{e}」</Text>
            ))}
            <Text style={styles.insight}>{theme.insight}</Text>
          </View>
        ))}
      </Section>

      {/* Notable Moments */}
      <Section emoji="💡" title="值得留意的瞬间">
        {content.notable_moments.map((m, i) => (
          <View key={i} style={styles.momentCard}>
            <Text style={styles.momentText}>{m.moment}</Text>
            <Text style={styles.momentWhy}>{m.why_it_matters}</Text>
          </View>
        ))}
      </Section>

      {/* Growth */}
      <Section emoji="📈" title="成长轨迹">
        {content.growth_trajectory.compared_to_last_week && (
          <Text style={styles.growthCompare}>
            {content.growth_trajectory.compared_to_last_week}
          </Text>
        )}
        <Text style={styles.growthObservation}>
          {content.growth_trajectory.gentle_observations}
        </Text>
        {content.growth_trajectory.seeds_planted.length > 0 && (
          <View style={styles.seedsRow}>
            {content.growth_trajectory.seeds_planted.map((seed, i) => (
              <View key={i} style={styles.seedTag}>
                <Text style={styles.seedText}>🌱 {seed}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* Gentle Invitation */}
      <Section emoji="🌿" title="一个温柔的邀请">
        <View style={styles.invitationCard}>
          <Text style={styles.invitationLabel}>💭 反思</Text>
          <Text style={styles.invitationText}>
            {content.gentle_invitation.reflection_question}
          </Text>

          <Text style={[styles.invitationLabel, { marginTop: 16 }]}>
            🧪 小实验
          </Text>
          <Text style={styles.invitationText}>
            {content.gentle_invitation.micro_experiment}
          </Text>

          <View style={styles.affirmation}>
            <Text style={styles.affirmationText}>
              {content.gentle_invitation.affirmation}
            </Text>
          </View>
        </View>
      </Section>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F4',
  },
  contentContainer: {
    padding: 16,
  },
  header: {
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  headerSummary: {
    fontSize: 15,
    color: '#555',
    lineHeight: 24,
    marginBottom: 12,
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodTag: {
    backgroundColor: '#F0EBE5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  moodText: {
    fontSize: 13,
    color: '#6B5B4F',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#444',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  patternCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  patternTheme: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  evidence: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 4,
    paddingLeft: 8,
  },
  insight: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    marginTop: 8,
  },
  momentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#D4C5B5',
  },
  momentText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
    marginBottom: 8,
  },
  momentWhy: {
    fontSize: 13,
    color: '#777',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  growthCompare: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  growthObservation: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  seedsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seedTag: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  seedText: {
    fontSize: 13,
    color: '#2E7D32',
  },
  invitationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  invitationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  invitationText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
  },
  affirmation: {
    marginTop: 20,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
  },
  affirmationText: {
    fontSize: 15,
    color: '#5D4037',
    lineHeight: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
