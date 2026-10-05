import React, { useState, forwardRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TextInputProps,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { tekst } from '../../theme/typography';
import type { ColorScheme } from '../../theme/colors';
import { useVeldKleuren } from '../veld/BuitenModus';

export type InputStatus = 'idle' | 'valid' | 'invalid' | 'validating';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  status?: InputStatus;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

// Haarlijn in rust, primair bij focus, danger bij een fout.
function randKleur(k: ColorScheme, status: InputStatus, focus: boolean, fout: boolean, disabled: boolean): string {
  if (disabled) return k.border;
  if (fout || status === 'invalid') return k.danger;
  if (focus) return k.primary;
  if (status === 'valid') return k.success;
  return k.border;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      status = 'idle',
      leftIcon,
      rightIcon,
      className,
      inputClassName,
      disabled = false,
      multiline = false,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const kleuren = useVeldKleuren();
    const rustig = useReducedMotion();
    const [isFocused, setIsFocused] = useState(false);
    const shakeX = useSharedValue(0);

    // Korte schud zodra de status ongeldig wordt
    useEffect(() => {
      if (status === 'invalid' && !rustig) {
        shakeX.set(
          withSequence(
            withTiming(6, { duration: 50 }),
            withTiming(-6, { duration: 50 }),
            withTiming(6, { duration: 50 }),
            withTiming(0, { duration: 50 })
          )
        );
      }
    }, [status, shakeX, rustig]);

    const shakeStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: shakeX.get() }],
    }));

    const displayMessage = error || hint;

    return (
      <View className={cn('gap-1.5 mb-4', className)}>
        {label && (
          <Text
            style={[
              tekst.sub,
              { color: kleuren.foreground, fontWeight: '600', opacity: disabled ? 0.5 : 1 },
            ]}
          >
            {label}
          </Text>
        )}

        <Animated.View
          style={[
            shakeStyle,
            {
              flexDirection: 'row',
              alignItems: multiline ? 'flex-start' : 'center',
              minHeight: multiline ? 96 : 48,
              paddingHorizontal: 12,
              paddingVertical: multiline ? 4 : 0,
              borderRadius: 12,
              backgroundColor: kleuren.input,
              borderWidth: 1,
              borderColor: randKleur(kleuren, status, isFocused, !!error, disabled),
              opacity: disabled ? 0.6 : 1,
              transitionProperty: 'borderColor',
              transitionDuration: 120,
            },
          ]}
        >
          {leftIcon && <View style={{ marginRight: 8, justifyContent: 'center', alignItems: 'center' }}>{leftIcon}</View>}

          <TextInput
            ref={ref}
            className={cn(inputClassName)}
            style={[
              tekst.callout,
              {
                flex: 1,
                // Geen lineHeight op een TextInput: iOS verschuift dan de cursor.
                lineHeight: undefined,
                color: kleuren.foreground,
                paddingVertical: 12,
                paddingHorizontal: 4,
                minHeight: multiline ? 88 : undefined,
              },
            ]}
            placeholderTextColor={kleuren.mutedForeground}
            selectionColor={kleuren.primary}
            editable={!disabled}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            {...props}
          />

          {rightIcon && <View style={{ marginLeft: 8, justifyContent: 'center', alignItems: 'center' }}>{rightIcon}</View>}
        </Animated.View>

        {displayMessage && (
          <Text
            accessibilityRole={error ? 'alert' : undefined}
            style={[tekst.voetnoot, { color: error ? kleuren.danger : kleuren.mutedForeground }]}
          >
            {displayMessage}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

// Status icons for InputWithFeedback
const StatusIcon: React.FC<{ status: InputStatus }> = ({ status }) => {
  const kleuren = useVeldKleuren();
  const rondje = { width: 20, height: 20, borderRadius: 10, justifyContent: 'center' as const, alignItems: 'center' as const };
  switch (status) {
    case 'valid':
      return (
        <View style={[rondje, { backgroundColor: kleuren.success }]}>
          <Check size={13} color={kleuren.card} strokeWidth={3} />
        </View>
      );
    case 'invalid':
      return (
        <View style={[rondje, { backgroundColor: kleuren.danger }]}>
          <X size={13} color={kleuren.card} strokeWidth={3} />
        </View>
      );
    case 'validating':
      return <ActivityIndicator size="small" color={kleuren.primary} />;
    default:
      return null;
  }
};

export interface InputWithFeedbackProps extends InputProps {
  feedbackMessage?: string;
}

export const InputWithFeedback = forwardRef<TextInput, InputWithFeedbackProps>(
  ({ status = 'idle', feedbackMessage, rightIcon, ...props }, ref) => {
    const kleuren = useVeldKleuren();
    const showStatusIcon = status !== 'idle';

    // Combine custom right icon with status icon
    const combinedRightIcon = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {rightIcon}
        {showStatusIcon && <StatusIcon status={status} />}
      </View>
    );

    // Determine feedback message based on status
    const getFeedbackMessage = () => {
      if (feedbackMessage) return feedbackMessage;
      if (status === 'validating') return 'Controleren…';
      return undefined;
    };

    const feedback = getFeedbackMessage();
    const feedbackColor =
      status === 'valid'
        ? kleuren.success
        : status === 'invalid'
          ? kleuren.danger
          : kleuren.mutedForeground;

    return (
      <View>
        <Input
          ref={ref}
          status={status}
          rightIcon={showStatusIcon || rightIcon ? combinedRightIcon : undefined}
          {...props}
        />
        {feedback && !props.error && !props.hint && (
          <Text style={[tekst.voetnoot, { color: feedbackColor, marginTop: 4 }]}>
            {feedback}
          </Text>
        )}
      </View>
    );
  }
);

InputWithFeedback.displayName = 'InputWithFeedback';
