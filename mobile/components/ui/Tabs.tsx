import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

interface Tab {
  key: string;
  label: string;
  badge?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  variant?: 'default' | 'pills' | 'underline';
}

interface TabsContentProps {
  children: ReactNode;
  tabKey: string;
  activeTab: string;
}

export function Tabs({ tabs, activeTab, onTabChange, variant = 'default' }: TabsProps) {
  const variantStyle = variantStyles[variant];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onTabChange(tab.key)}
          style={[
            styles.tab,
            variantStyle.tab,
            activeTab === tab.key && variantStyle.activeTab,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              variantStyle.tabText,
              activeTab === tab.key && variantStyle.activeTabText,
            ]}
          >
            {tab.label}
          </Text>
          {tab.badge !== undefined && tab.badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export function TabsContent({ children, tabKey, activeTab }: TabsContentProps) {
  if (tabKey !== activeTab) return null;
  return <View style={styles.tabContent}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tabText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  badge: {
    backgroundColor: colors.destructive,
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  badgeText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.destructiveForeground,
  },
  tabContent: {
    flex: 1,
  },
});

// Variant-specific styles
const variantStyles = {
  default: StyleSheet.create({
    tab: {
      backgroundColor: colors.muted,
      borderRadius: radius.md,
    },
    activeTab: {
      backgroundColor: colors.primary,
    },
    tabText: {
      color: colors.mutedForeground,
    },
    activeTabText: {
      color: colors.primaryForeground,
    },
  }),
  pills: StyleSheet.create({
    tab: {
      backgroundColor: 'transparent',
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    activeTab: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabText: {
      color: colors.mutedForeground,
    },
    activeTabText: {
      color: colors.primaryForeground,
    },
  }),
  underline: StyleSheet.create({
    tab: {
      backgroundColor: 'transparent',
      borderRadius: 0,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      paddingHorizontal: spacing.sm,
    },
    activeTab: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      color: colors.mutedForeground,
    },
    activeTabText: {
      color: colors.foreground,
      fontWeight: typography.fontWeight.semibold,
    },
  }),
};
