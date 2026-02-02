import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

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
        default: 'bg-muted rounded-lg p-1',
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
        pills: 'rounded-full border border-border',
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
        className: 'bg-background',
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
        className: 'bg-accent border-accent',
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
        className: 'border-b-accent',
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
        false: 'text-muted-foreground',
      },
    },
    compoundVariants: [
      // Default variant
      {
        variant: 'default',
        active: false,
        className: 'text-muted-foreground',
      },
      {
        variant: 'default',
        active: true,
        className: 'text-foreground',
      },
      // Pills variant
      {
        variant: 'pills',
        active: false,
        className: 'text-muted-foreground',
      },
      {
        variant: 'pills',
        active: true,
        className: 'text-accent-foreground',
      },
      // Underline variant
      {
        variant: 'underline',
        active: false,
        className: 'text-muted-foreground',
      },
      {
        variant: 'underline',
        active: true,
        className: 'text-foreground font-semibold',
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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-grow-0"
      contentContainerClassName={cn(tabListVariants({ variant }), className)}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            className={cn(tabTriggerVariants({ variant, active: isActive }))}
          >
            <Text className={cn(tabTextVariants({ variant, active: isActive }))}>
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
