import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { colors } from '../../theme/colors';

interface Tab {
  key: string;
  label: string;
  badge?: number;
}

const tabListVariants = cva(
  'flex-row px-4 gap-2',
  {
    variants: {
      variant: {
        default: 'rounded-lg p-1',
        pills: '',
        underline: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const tabTriggerVariants = cva(
  'flex-row items-center py-2 px-4',
  {
    variants: {
      variant: {
        default: 'rounded-md',
        pills: 'rounded-full',
        underline: 'rounded-none border-b-2 border-b-transparent px-2',
      },
      active: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      // Default variant
      {
        variant: 'default',
        active: false,
        className: 'bg-transparent',
      },
      {
        variant: 'default',
        active: true,
        className: '',
      },
      // Pills variant
      {
        variant: 'pills',
        active: false,
        className: 'bg-transparent',
      },
      {
        variant: 'pills',
        active: true,
        className: '',
      },
      // Underline variant
      {
        variant: 'underline',
        active: false,
        className: 'bg-transparent',
      },
      {
        variant: 'underline',
        active: true,
        className: '',
      },
    ],
    defaultVariants: {
      variant: 'default',
      active: false,
    },
  }
);

const tabTextVariants = cva(
  'font-sans text-sm font-medium',
  {
    variants: {
      variant: {
        default: '',
        pills: '',
        underline: '',
      },
      active: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      // Default variant
      {
        variant: 'default',
        active: false,
        className: '',
      },
      {
        variant: 'default',
        active: true,
        className: '',
      },
      // Pills variant
      {
        variant: 'pills',
        active: false,
        className: '',
      },
      {
        variant: 'pills',
        active: true,
        className: '',
      },
      // Underline variant
      {
        variant: 'underline',
        active: false,
        className: '',
      },
      {
        variant: 'underline',
        active: true,
        className: 'font-semibold',
      },
    ],
    defaultVariants: {
      variant: 'default',
      active: false,
    },
  }
);

interface TabsProps extends VariantProps<typeof tabListVariants> {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}

interface TabsContentProps {
  children: ReactNode;
  tabKey: string;
  activeTab: string;
}

export function Tabs({ tabs, activeTab, onTabChange, variant = 'default', className }: TabsProps) {
  const getTabListBgStyle = () => {
    if (variant === 'default') return { backgroundColor: '#1A1A1A' };
    return {};
  };

  const getActiveTriggerStyle = (isActive: boolean) => {
    if (!isActive) return {};
    switch (variant) {
      case 'default':
        return { backgroundColor: '#111111' };
      case 'pills':
        return { backgroundColor: '#4ADE80', borderWidth: 1, borderColor: '#4ADE80' };
      case 'underline':
        return { borderBottomWidth: 2, borderBottomColor: '#4ADE80' };
      default:
        return {};
    }
  };

  const getInactiveTriggerStyle = () => {
    if (variant === 'pills') return { borderWidth: 1, borderColor: '#222222' };
    return {};
  };

  const getTextColor = (isActive: boolean) => {
    if (!isActive) return colors.inactive;
    switch (variant) {
      case 'pills':
        return '#0A0A0A';
      default:
        return '#E8E8E8';
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-grow-0"
      contentContainerClassName={cn(tabListVariants({ variant }), className)}
      style={getTabListBgStyle()}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            className={cn(tabTriggerVariants({ variant, active: isActive }))}
            style={isActive ? getActiveTriggerStyle(isActive) : getInactiveTriggerStyle()}
          >
            <Text
              className={cn(tabTextVariants({ variant, active: isActive }))}
              style={{ color: getTextColor(isActive) }}
            >
              {tab.label}
            </Text>
            {tab.badge !== undefined && tab.badge > 0 && (
              <View className="bg-destructive rounded-full min-w-[18px] h-[18px] px-1 items-center justify-center ml-2">
                <Text className="font-sans text-xs font-semibold text-destructive-foreground">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export function TabsContent({ children, tabKey, activeTab }: TabsContentProps) {
  if (tabKey !== activeTab) return null;
  return <View className="flex-1">{children}</View>;
}
