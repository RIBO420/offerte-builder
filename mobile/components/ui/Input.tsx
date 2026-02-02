import React, { useState, forwardRef, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TextInputProps,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { cn } from '@/lib/utils';

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
  idle: 'border-border',
  valid: 'border-green-500',
  invalid: 'border-destructive',
  validating: 'border-ring',
};

const FOCUS_BORDER_COLORS: Record<InputStatus, string> = {
  idle: 'border-ring',
  valid: 'border-green-500',
  invalid: 'border-destructive',
  validating: 'border-ring',
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
    const shakeAnimation = useRef(new Animated.Value(0)).current;

    // Shake animation when status becomes invalid
    useEffect(() => {
      if (status === 'invalid') {
        Animated.sequence([
          Animated.timing(shakeAnimation, {
            toValue: 10,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: -10,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: 10,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: 0,
            duration: 50,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [status, shakeAnimation]);

    const getBorderColorClass = () => {
      if (disabled) return 'border-border';
      if (isFocused) return FOCUS_BORDER_COLORS[status];
      return STATUS_BORDER_COLORS[status];
    };

    const displayMessage = error || hint;

    return (
      <View className={cn('gap-1.5 mb-4', className)}>
        {label && (
          <Text
            className={cn(
              'text-sm font-medium text-foreground',
              disabled && 'text-muted-foreground'
            )}
          >
            {label}
          </Text>
        )}

        <Animated.View
          className={cn(
            'flex-row items-center border rounded-lg px-3',
            multiline ? 'min-h-[88px] items-start py-3' : 'min-h-[44px]',
            disabled ? 'bg-muted' : 'bg-background',
            getBorderColorClass()
          )}
          style={{ transform: [{ translateX: shakeAnimation }] }}
        >
          {leftIcon && <View className="mr-2 justify-center items-center">{leftIcon}</View>}

          <TextInput
            ref={ref}
            className={cn(
              'flex-1 text-base text-foreground py-3 px-1',
              leftIcon && 'pl-1',
              rightIcon && 'pr-1',
              multiline && 'min-h-[72px]',
              disabled && 'text-muted-foreground',
              inputClassName
            )}
            placeholderTextColor="#71717a"
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
            className={cn(
              'text-xs mt-1',
              error ? 'text-destructive' : 'text-muted-foreground'
            )}
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
        <View className="w-5 h-5 rounded-full bg-green-500 justify-center items-center">
          <Text className="text-background text-xs font-bold">✓</Text>
        </View>
      );
    case 'invalid':
      return (
        <View className="w-5 h-5 rounded-full bg-destructive justify-center items-center">
          <Text className="text-background text-xs font-bold">!</Text>
        </View>
      );
    case 'validating':
      return (
        <ActivityIndicator
          size="small"
          color="#3b82f6"
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
    const feedbackColorClass =
      status === 'valid'
        ? 'text-green-500'
        : status === 'invalid'
          ? 'text-destructive'
          : 'text-muted-foreground';

    return (
      <View>
        <Input
          ref={ref}
          status={status}
          rightIcon={showStatusIcon || rightIcon ? combinedRightIcon : undefined}
          {...props}
        />
        {feedback && !props.error && !props.hint && (
          <Text className={cn('text-xs mt-1', feedbackColorClass)}>
            {feedback}
          </Text>
        )}
      </View>
    );
  }
);

InputWithFeedback.displayName = 'InputWithFeedback';
