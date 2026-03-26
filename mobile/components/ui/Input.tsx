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
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { cn } from '@/lib/utils';
import { colors } from '../../theme/colors';

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

const STATUS_BORDER_COLORS: Record<InputStatus, string> = {
  idle: '#222222',
  valid: '#4ADE80',
  invalid: '#EF4444',
  validating: '#4ADE80',
};

const FOCUS_BORDER_COLORS: Record<InputStatus, string> = {
  idle: '#4ADE80',
  valid: '#4ADE80',
  invalid: '#EF4444',
  validating: '#4ADE80',
};

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
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const shakeX = useSharedValue(0);

    // Shake animation when status becomes invalid
    useEffect(() => {
      if (status === 'invalid') {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design
        shakeX.value = withSequence(
          withTiming(6, { duration: 50 }),
          withTiming(-6, { duration: 50 }),
          withTiming(6, { duration: 50 }),
          withTiming(0, { duration: 50 })
        );
      }
    }, [status, shakeX]);

    const shakeStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: shakeX.value }],
    }));

    const getBorderColor = () => {
      if (disabled) return '#222222';
      if (isFocused) return FOCUS_BORDER_COLORS[status];
      return STATUS_BORDER_COLORS[status];
    };

    const displayMessage = error || hint;

    return (
      <View className={cn('gap-1.5 mb-4', className)}>
        {label && (
          <Text
            className={cn(
              'text-sm font-medium',
              disabled && 'opacity-50'
            )}
            style={{ color: disabled ? '#888888' : '#E8E8E8' }}
          >
            {label}
          </Text>
        )}

        <Animated.View
          className={cn(
            'flex-row items-center rounded-lg px-3',
            multiline ? 'min-h-[88px] items-start py-3' : 'min-h-[44px]',
          )}
          style={[
            shakeStyle,
            {
              backgroundColor: disabled ? '#111111' : '#1A1A1A',
              borderWidth: 1,
              borderColor: getBorderColor(),
            },
          ]}
        >
          {leftIcon && <View className="mr-2 justify-center items-center">{leftIcon}</View>}

          <TextInput
            ref={ref}
            className={cn(
              'flex-1 text-base py-3 px-1',
              leftIcon && 'pl-1',
              rightIcon && 'pr-1',
              multiline && 'min-h-[72px]',
              inputClassName
            )}
            style={{
              color: disabled ? '#888888' : '#E8E8E8',
            }}
            placeholderTextColor={colors.inactive}
            editable={!disabled}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />

          {rightIcon && <View className="ml-2 justify-center items-center">{rightIcon}</View>}
        </Animated.View>

        {displayMessage && (
          <Text
            className="text-xs mt-1"
            style={{ color: error ? '#EF4444' : '#888888' }}
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
  switch (status) {
    case 'valid':
      return (
        <View className="w-5 h-5 rounded-full justify-center items-center" style={{ backgroundColor: '#4ADE80' }}>
          <Text className="text-xs font-bold" style={{ color: '#0A0A0A' }}>✓</Text>
        </View>
      );
    case 'invalid':
      return (
        <View className="w-5 h-5 rounded-full bg-destructive justify-center items-center">
          <Text className="text-xs font-bold" style={{ color: '#0A0A0A' }}>!</Text>
        </View>
      );
    case 'validating':
      return (
        <ActivityIndicator
          size="small"
          color="#4ADE80"
          className="w-5 h-5"
        />
      );
    default:
      return null;
  }
};

export interface InputWithFeedbackProps extends InputProps {
  feedbackMessage?: string;
}

export const InputWithFeedback = forwardRef<TextInput, InputWithFeedbackProps>(
  ({ status = 'idle', feedbackMessage, rightIcon, ...props }, ref) => {
    const showStatusIcon = status !== 'idle';

    // Combine custom right icon with status icon
    const combinedRightIcon = (
      <View className="flex-row items-center gap-2">
        {rightIcon}
        {showStatusIcon && <StatusIcon status={status} />}
      </View>
    );

    // Determine feedback message based on status
    const getFeedbackMessage = () => {
      if (feedbackMessage) return feedbackMessage;
      if (status === 'validating') return 'Validating...';
      return undefined;
    };

    const feedback = getFeedbackMessage();
    const feedbackColor =
      status === 'valid'
        ? '#4ADE80'
        : status === 'invalid'
          ? '#EF4444'
          : '#888888';

    return (
      <View>
        <Input
          ref={ref}
          status={status}
          rightIcon={showStatusIcon || rightIcon ? combinedRightIcon : undefined}
          {...props}
        />
        {feedback && !props.error && !props.hint && (
          <Text className="text-xs mt-1" style={{ color: feedbackColor }}>
            {feedback}
          </Text>
        )}
      </View>
    );
  }
);

InputWithFeedback.displayName = 'InputWithFeedback';
