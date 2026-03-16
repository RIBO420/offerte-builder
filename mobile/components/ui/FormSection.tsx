import React, { ReactNode, useState } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cn } from '@/lib/utils';

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
    <View
      className="rounded-lg mb-4 overflow-hidden"
      style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: '#222222' }}
    >
      <HeaderWrapper
        onPress={collapsible ? toggle : undefined}
        className="flex-row items-center justify-between py-4 px-4"
        style={{ backgroundColor: '#1A1A1A', borderBottomWidth: 1, borderBottomColor: '#222222' }}
        activeOpacity={collapsible ? 0.7 : 1}
      >
        <View className="flex-row items-center flex-1">
          {icon && (
            <View
              className="w-8 h-8 rounded-md items-center justify-center mr-3"
              style={{ backgroundColor: '#111111' }}
            >
              <Feather name={icon} size={18} color="#4ADE80" />
            </View>
          )}
          <View className="flex-1">
            <Text className="font-sans text-base font-semibold" style={{ color: '#E8E8E8' }}>{title}</Text>
            {description && (
              <Text className="font-sans text-sm mt-0.5" style={{ color: '#888888' }}>{description}</Text>
            )}
          </View>
        </View>
        {collapsible && (
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#888888"
          />
        )}
      </HeaderWrapper>
      {expanded && <View className="gap-4 px-4">{children}</View>}
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
  return (
    <View className="mb-4">
      <View className="mb-2">
        <Text className="font-sans text-sm font-medium" style={{ color: '#E8E8E8' }}>
          {label}
          {required && <Text style={{ color: '#EF4444' }}> *</Text>}
        </Text>
        {description && (
          <Text className="font-sans text-xs mt-0.5" style={{ color: '#888888' }}>{description}</Text>
        )}
      </View>
      {children}
      {error && <Text className="font-sans text-xs mt-2" style={{ color: '#EF4444' }}>{error}</Text>}
    </View>
  );
}

export function FormDivider({ label }: FormDividerProps) {
  if (label) {
    return (
      <View className="flex-row items-center my-4">
        <View className="flex-1 h-px" style={{ backgroundColor: '#1A1A1A' }} />
        <Text className="font-sans text-xs px-3 uppercase tracking-wider" style={{ color: '#888888' }}>{label}</Text>
        <View className="flex-1 h-px" style={{ backgroundColor: '#1A1A1A' }} />
      </View>
    );
  }

  return <View className="h-px my-4" style={{ backgroundColor: '#1A1A1A' }} />;
}
