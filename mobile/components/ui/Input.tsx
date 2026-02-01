import React, { useState, forwardRef, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

export type InputStatus = 'idle' | 'valid' | 'invalid' | 'validating';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  status?: InputStatus;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  disabled?: boolean;
}

const STATUS_COLORS: Record<InputStatus, string> = {
  idle: colors.border,
  valid: colors.trend.positive,
  invalid: colors.destructive,
  validating: colors.ring,
};

const FOCUS_COLORS: Record<InputStatus, string> = {
  idle: colors.ring,
  valid: colors.trend.positive,
  invalid: colors.destructive,
  validating: colors.ring,
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
      containerStyle,
      inputStyle,
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

    const getBorderColor = () => {
      if (disabled) return colors.border;
      if (isFocused) return FOCUS_COLORS[status];
      return STATUS_COLORS[status];
    };

    const displayMessage = error || hint;
    const messageColor = error ? colors.destructive : colors.mutedForeground;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={[styles.label, disabled && styles.labelDisabled]}>
            {label}
          </Text>
        )}

        <Animated.View
          style={[
            styles.inputContainer,
            {
              borderColor: getBorderColor(),
              backgroundColor: disabled ? colors.muted : colors.background,
              transform: [{ translateX: shakeAnimation }],
            },
            multiline && styles.inputContainerMultiline,
            inputStyle,
          ]}
        >
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

          <TextInput
            ref={ref}
            style={[
              styles.input,
              leftIcon && styles.inputWithLeftIcon,
              rightIcon && styles.inputWithRightIcon,
              multiline && styles.inputMultiline,
              disabled && styles.inputDisabled,
            ]}
            placeholderTextColor={colors.mutedForeground}
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

          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </Animated.View>

        {displayMessage && (
          <Text style={[styles.message, { color: messageColor }]}>
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
        <View style={[styles.statusIcon, styles.statusIconValid]}>
          <Text style={styles.statusIconText}>✓</Text>
        </View>
      );
    case 'invalid':
      return (
        <View style={[styles.statusIcon, styles.statusIconInvalid]}>
          <Text style={styles.statusIconText}>!</Text>
        </View>
      );
    case 'validating':
      return (
        <ActivityIndicator
          size="small"
          color={colors.ring}
          style={styles.statusIconSpinner}
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
      <View style={styles.feedbackIconContainer}>
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
        ? colors.trend.positive
        : status === 'invalid'
          ? colors.destructive
          : colors.mutedForeground;

    return (
      <View>
        <Input
          ref={ref}
          status={status}
          rightIcon={showStatusIcon || rightIcon ? combinedRightIcon : undefined}
          {...props}
        />
        {feedback && !props.error && !props.hint && (
          <Text style={[styles.feedbackMessage, { color: feedbackColor }]}>
            {feedback}
          </Text>
        )}
      </View>
    );
  }
);

InputWithFeedback.displayName = 'InputWithFeedback';

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  labelDisabled: {
    color: colors.mutedForeground,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44, // Minimum touch target size
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  inputContainerMultiline: {
    minHeight: 88,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.foreground,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  inputWithLeftIcon: {
    paddingLeft: spacing.xs,
  },
  inputWithRightIcon: {
    paddingRight: spacing.xs,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    color: colors.mutedForeground,
  },
  iconLeft: {
    marginRight: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconRight: {
    marginLeft: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  // Status icon styles
  statusIcon: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconValid: {
    backgroundColor: colors.trend.positive,
  },
  statusIconInvalid: {
    backgroundColor: colors.destructive,
  },
  statusIconText: {
    color: colors.background,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  statusIconSpinner: {
    width: 20,
    height: 20,
  },
  feedbackIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  feedbackMessage: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
});
