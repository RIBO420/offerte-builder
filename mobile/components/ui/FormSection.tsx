import React, { ReactNode, useState } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cn } from '@/lib/utils';
import { tekst } from '../../theme/typography';
import { useVeldKleuren } from '../veld/BuitenModus';

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
  const kleuren = useVeldKleuren();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = () => {
    if (!collapsible) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const HeaderWrapper = collapsible ? TouchableOpacity : View;

  return (
    <View
      className="mb-4 overflow-hidden"
      style={{ backgroundColor: kleuren.card, borderRadius: 18, borderWidth: 1, borderColor: kleuren.border }}
    >
      <HeaderWrapper
        onPress={collapsible ? toggle : undefined}
        className="flex-row items-center justify-between py-4 px-4"
        style={{ borderBottomWidth: expanded ? 1 : 0, borderBottomColor: kleuren.border }}
        activeOpacity={collapsible ? 0.7 : 1}
        accessibilityRole={collapsible ? 'button' : undefined}
        accessibilityState={collapsible ? { expanded } : undefined}
      >
        <View className="flex-row items-center flex-1">
          {icon && (
            <View
              className="w-9 h-9 items-center justify-center mr-3"
              style={{ backgroundColor: kleuren.primarySoft, borderRadius: 11 }}
            >
              <Feather name={icon} size={18} color={kleuren.primary} />
            </View>
          )}
          <View className="flex-1">
            <Text style={[tekst.kop, { color: kleuren.foreground }]}>{title}</Text>
            {description && (
              <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, marginTop: 2 }]}>{description}</Text>
            )}
          </View>
        </View>
        {collapsible && (
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={kleuren.mutedForeground}
          />
        )}
      </HeaderWrapper>
      {expanded && <View className="gap-4 px-4 pt-4">{children}</View>}
    </View>
  );
}

export function FormRow({ children, columns = 1 }: FormRowProps) {
  const childArray = React.Children.toArray(children);

  return (
    <View className="gap-3 flex-row mb-4">
      {childArray.map((child, index) => (
        <View
          key={index}
          style={{ flex: 1 / columns }}
          className={cn(index < childArray.length - 1 && 'mr-3')}
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
  const kleuren = useVeldKleuren();
  return (
    <View className="mb-4">
      <View className="mb-2">
        <Text style={[tekst.sub, { color: kleuren.foreground, fontWeight: '600' }]}>
          {label}
          {required && <Text style={{ color: kleuren.danger }}> *</Text>}
        </Text>
        {description && (
          <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, marginTop: 2 }]}>{description}</Text>
        )}
      </View>
      {children}
      {error && <Text accessibilityRole="alert" style={[tekst.voetnoot, { color: kleuren.danger, marginTop: 8 }]}>{error}</Text>}
    </View>
  );
}

export function FormDivider({ label }: FormDividerProps) {
  const kleuren = useVeldKleuren();
  if (label) {
    return (
      <View className="flex-row items-center my-4">
        <View className="flex-1 h-px" style={{ backgroundColor: kleuren.border }} />
        <Text
          style={[tekst.bijschrift, { color: kleuren.mutedForeground, paddingHorizontal: 12, textTransform: 'uppercase', letterSpacing: 0.6 }]}
        >
          {label}
        </Text>
        <View className="flex-1 h-px" style={{ backgroundColor: kleuren.border }} />
      </View>
    );
  }

  return <View className="h-px my-4" style={{ backgroundColor: kleuren.border }} />;
}
