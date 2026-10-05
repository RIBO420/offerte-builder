import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView, type ViewStyle } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { tekst } from '../../theme/typography';
import type { ColorScheme } from '../../theme/colors';
import { useVeldKleuren } from '../veld/BuitenModus';

interface Tab {
  key: string;
  label: string;
  badge?: number;
}

const tabListVariants = cva(
  'flex-row gap-2',
  {
    variants: {
      variant: {
        default: 'p-1',
        pills: 'px-4',
        underline: 'px-4',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type TabsVariant = NonNullable<VariantProps<typeof tabListVariants>['variant']>;

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

// Trigger per variant: segment (default), pil, of onderstreping.
function triggerStijl(k: ColorScheme, variant: TabsVariant, actief: boolean): ViewStyle {
  const basis: ViewStyle = { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: 16 };
  switch (variant) {
    case 'pills':
      return {
        ...basis,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: actief ? k.primary : k.border,
        backgroundColor: actief ? k.primary : 'transparent',
      };
    case 'underline':
      return {
        ...basis,
        paddingHorizontal: 8,
        borderBottomWidth: 2,
        borderBottomColor: actief ? k.primary : 'transparent',
      };
    default:
      return {
        ...basis,
        borderRadius: 9,
        backgroundColor: actief ? k.card : 'transparent',
        ...(actief ? { borderWidth: 1, borderColor: k.border } : { borderWidth: 1, borderColor: 'transparent' }),
      };
  }
}

function tekstKleur(k: ColorScheme, variant: TabsVariant, actief: boolean): string {
  if (!actief) return k.mutedForeground;
  return variant === 'pills' ? k.primaryForeground : k.foreground;
}

export function Tabs({ tabs, activeTab, onTabChange, variant = 'default', className }: TabsProps) {
  const kleuren = useVeldKleuren();
  const variantKey: TabsVariant = variant || 'default';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-grow-0"
      contentContainerClassName={cn(tabListVariants({ variant }), className)}
      style={variantKey === 'default' ? { backgroundColor: kleuren.muted, borderRadius: 12 } : undefined}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={triggerStijl(kleuren, variantKey, isActive)}
          >
            <Text
              style={[
                tekst.sub,
                { color: tekstKleur(kleuren, variantKey, isActive), fontWeight: isActive ? '600' : '500' },
              ]}
            >
              {tab.label}
            </Text>
            {tab.badge !== undefined && tab.badge > 0 && (
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  paddingHorizontal: 5,
                  marginLeft: 8,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: kleuren.destructive,
                }}
              >
                <Text style={[tekst.bijschrift, tekst.cijfers, { color: kleuren.destructiveForeground, fontWeight: '700' }]}>
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
