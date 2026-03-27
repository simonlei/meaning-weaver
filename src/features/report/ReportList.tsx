import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useDatabase } from '../../hooks/useDatabase';
import { Report, ReportContent } from '../../db/schema';
import { generateWeeklyReport } from '../../services/ai/reportGenerator';
import { ReportView } from './ReportView';

function formatWeekKey(weekKey: string): string {
  // '2026-W13' → '2026年第13周'
  const match = weekKey.match(/(\d{4})-W(\d{2})/);
  if (!match) return weekKey;
  return `${match[1]}年第${parseInt(match[2])}周`;
}

function ReportCard({
  report,
  onPress,
}: {
  report: Report;
  onPress: () => void;
}) {
  let content: ReportContent | null = null;
  try {
    content = JSON.parse(report.content);
  } catch {}

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.cardWeek}>{formatWeekKey(report.week_key)}</Text>
      {content && (
        <>
          <Text style={styles.cardTitle}>{content.snapshot.title}</Text>
          <Text style={styles.cardSummary} numberOfLines={2}>
            {content.snapshot.summary}
          </Text>
          <View style={styles.cardMoods}>
            {content.snapshot.mood_palette.map((mood, i) => (
              <Text key={i} style={styles.cardMood}>
                {mood}
              </Text>
            ))}
          </View>
        </>
      )}
      <Text style={styles.cardDate}>
        {new Date(report.generated_at).toLocaleDateString('zh-CN')}
      </Text>
    </TouchableOpacity>
  );
}

export function ReportListScreen() {
  const { repo } = useDatabase();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => repo!.getAllReports(),
    enabled: !!repo,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateWeeklyReport(repo!),
    onSuccess: (result) => {
      console.log('[Report] Generation result:', result);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (result.ok) {
        window?.alert?.('✨ 周报已生成！点击查看你的生活洞察');
      } else {
        console.warn('[Report] Generation returned error:', result.error);
        if (!result.ok && result.error.kind === 'no_api_key') {
          // 跳转到设置页让用户配置 API Key
          router.push('/(tabs)/settings');
        } else {
          // 其他错误时使用本地模板降级（fallback 已在 reportGenerator 中处理）
          window?.alert?.('周报已生成（使用了本地模板）');
        }
      }
    },
    onError: (err) => {
      console.error('[Report] Mutation error:', err);
      window?.alert?.('生成失败，请检查网络连接后重试');
    },
  });

  const handleGenerate = () => {
    if (!repo) return;
    const confirmed = window?.confirm
      ? window.confirm('将分析本周的碎片并生成生活洞察报告，确定？')
      : true;
    if (confirmed) {
      generateMutation.mutate();
    }
  };

  if (selectedReport) {
    let content: ReportContent | null = null;
    try {
      content = JSON.parse(selectedReport.content);
    } catch {}

    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSelectedReport(null)}
        >
          <Text style={styles.backText}>← 返回列表</Text>
        </TouchableOpacity>
        <Text style={styles.detailWeek}>
          {formatWeekKey(selectedReport.week_key)}
        </Text>
        {content ? (
          <ReportView content={content} />
        ) : (
          <Text style={styles.errorText}>无法解析报告内容</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Generate button */}
      <TouchableOpacity
        style={[
          styles.generateButton,
          generateMutation.isPending && styles.generateButtonDisabled,
        ]}
        onPress={handleGenerate}
        disabled={generateMutation.isPending || !repo}
      >
        {generateMutation.isPending ? (
          <View style={styles.generatingRow}>
            <ActivityIndicator color="#FFF" size="small" />
            <Text style={styles.generateText}>  AI 正在编织你的周报...</Text>
          </View>
        ) : (
          <Text style={styles.generateText}>✨ 生成本周报告</Text>
        )}
      </TouchableOpacity>

      {/* Report list */}
      {isLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator color="#6B5B4F" />
        </View>
      ) : !reports || reports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📖</Text>
          <Text style={styles.emptyTitle}>还没有周报</Text>
          <Text style={styles.emptyText}>
            记录几天碎片后，{'\n'}点击上方按钮生成你的第一份生活洞察报告
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onPress={() => setSelectedReport(report)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F4',
  },
  generateButton: {
    backgroundColor: '#6B5B4F',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    alignItems: 'center',
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardWeek: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cardSummary: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  cardMoods: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  cardMood: {
    fontSize: 12,
    color: '#6B5B4F',
    backgroundColor: '#F0EBE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardDate: {
    fontSize: 11,
    color: '#BBB',
  },
  backButton: {
    padding: 16,
    paddingBottom: 8,
  },
  backText: {
    fontSize: 15,
    color: '#6B5B4F',
    fontWeight: '500',
  },
  detailWeek: {
    fontSize: 13,
    color: '#999',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
});
