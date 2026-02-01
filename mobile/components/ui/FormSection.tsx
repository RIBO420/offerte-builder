import React, { ReactNode, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FormSectionProps {
  title: string;
  description?: string;
  icon?: keyof typeof Feather.glyphMap;
  children: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

interface FormRowProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
}

interface FieldGroupProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

interface FormDividerProps {
  label?: string;
}

export function FormSection({
  title,
  description,
  icon,
  children,
  collapsible = false,
  defaultExpanded = true,
}: FormSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = () => {
    if (!collapsible) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const HeaderWrapper = collapsible ? TouchableOpacity : View;

  return (
    <View style={styles.section}>
      <HeaderWrapper
        onPress={collapsible ? toggle : undefined}
        style={styles.sectionHeader}
        activeOpacity={collapsible ? 0.7 : 1}
      >
        <View style={styles.sectionTitleRow}>
          {icon && (
            <View style={styles.iconContainer}>
              <Feather name={icon} size={18} color={colors.primary} />
            </View>
          )}
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {description && (
              <Text style={styles.sectionDescription}>{description}</Text>
            )}
          </View>
        </View>
        {collapsible && (
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.mutedForeground}
          />
        )}
      </HeaderWrapper>
      {expanded && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}

export function FormRow({ children, columns = 1 }: FormRowProps) {
  const childArray = React.Children.toArray(children);

  return (
    <View style={styles.row}>
      {childArray.map((child, index) => (
        <View
          key={index}
          style={[
            styles.rowColumn,
            { flex: 1 / columns },
            index < childArray.length - 1 && { marginRight: spacing.sm },
          ]}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

export function FieldGroup({
  label,
  description,
  error,
  required,
  children,
}: FieldGroupProps) {
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        {description && (
          <Text style={styles.fieldDescription}>{description}</Text>
        )}
      </View>
      {children}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function FormDivider({ label }: FormDividerProps) {
  if (label) {
    return (
      <View style={styles.dividerWithLabel}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>{label}</Text>
        <View style={styles.dividerLine} />
      </View>
    );
  }

  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.muted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.foreground,
  },
  sectionDescription: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  sectionContent: {
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  rowColumn: {
    flex: 1,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  labelContainer: {
    marginBottom: spacing.xs,
  },
  label: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.foreground,
  },
  required: {
    color: colors.destructive,
  },
  fieldDescription: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  error: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: colors.destructive,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  dividerWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    paddingHorizontal: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
