import React, { ReactNode, useEffect, useRef, createContext, useContext } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  ViewStyle,
  TextStyle,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { Button } from './Button';
import { cn } from '@/lib/utils';

// Dialog Context for compound components
interface DialogContextValue {
  onClose?: () => void;
}

const DialogContext = createContext<DialogContextValue>({});

/**
 * Hook to access dialog context from child components
 * Can be used to programmatically close the dialog from within
 */
export const useDialogContext = () => useContext(DialogContext);

// ============================================================================
// Dialog (Root)
// ============================================================================

interface DialogProps {
  children: ReactNode;
  visible: boolean;
  onClose?: () => void;
  closeOnBackdropPress?: boolean;
  animationDuration?: number;
}

/**
 * Dialog - Root modal component with animated backdrop
 * Provides context for child components and handles visibility animations
 */
export function Dialog({
  children,
  visible,
  onClose,
  closeOnBackdropPress = true,
  animationDuration = 200,
}: DialogProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: animationDuration,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: animationDuration,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: animationDuration,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim, animationDuration]);

  const handleBackdropPress = () => {
    if (closeOnBackdropPress && onClose) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <DialogContext.Provider value={{ onClose }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 justify-center items-center">
            {/* Backdrop */}
            <Animated.View
              style={{
                ...{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
                opacity: fadeAnim,
              }}
              className="bg-black/50"
            >
              <Pressable
                className="flex-1"
                onPress={handleBackdropPress}
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
              />
            </Animated.View>

            {/* Content */}
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              }}
              className="w-full items-center px-4"
              pointerEvents="box-none"
            >
              {children}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </DialogContext.Provider>
    </Modal>
  );
}

// ============================================================================
// DialogContent
// ============================================================================

interface DialogContentProps {
  children: ReactNode;
  style?: ViewStyle;
  maxWidth?: number;
}

/**
 * DialogContent - Main content container for the dialog
 * Applies card styling, shadows, and safe area padding
 */
export function DialogContent({ children, style, maxWidth }: DialogContentProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = Dimensions.get('window');

  const contentMaxWidth = maxWidth ?? Math.min(screenWidth - spacing.lg * 2, 400);

  return (
    <View
      style={[
        {
          maxWidth: contentMaxWidth,
          marginBottom: Math.max(insets.bottom, spacing.lg),
        },
        shadows.modal,
        style,
      ]}
      className="w-full bg-card rounded-2xl mx-4 overflow-hidden"
      accessible
      accessibilityViewIsModal
    >
      {children}
    </View>
  );
}

// ============================================================================
// DialogHeader
// ============================================================================

interface DialogHeaderProps {
  children: ReactNode;
  style?: ViewStyle;
}

/**
 * DialogHeader - Container for title and description
 * Provides consistent spacing at the top of the dialog
 */
export function DialogHeader({ children, style }: DialogHeaderProps) {
  return <View style={style} className="p-4 border-b border-border">{children}</View>;
}

// ============================================================================
// DialogTitle
// ============================================================================

interface DialogTitleProps {
  children: ReactNode;
  style?: TextStyle;
}

/**
 * DialogTitle - Main heading text for the dialog
 * Uses semibold font weight matching design system
 */
export function DialogTitle({ children, style }: DialogTitleProps) {
  return (
    <Text
      style={style}
      className="text-lg font-semibold text-foreground"
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}

// ============================================================================
// DialogDescription
// ============================================================================

interface DialogDescriptionProps {
  children: ReactNode;
  style?: TextStyle;
}

/**
 * DialogDescription - Secondary descriptive text
 * Muted foreground color, smaller font size
 */
export function DialogDescription({ children, style }: DialogDescriptionProps) {
  return (
    <Text style={style} className="text-sm text-muted-foreground">
      {children}
    </Text>
  );
}

// ============================================================================
// DialogBody
// ============================================================================

interface DialogBodyProps {
  children: ReactNode;
  style?: ViewStyle;
}

/**
 * DialogBody - Main content section of the dialog
 * Provides consistent padding for dialog content
 */
export function DialogBody({ children, style }: DialogBodyProps) {
  return <View style={style} className="p-4">{children}</View>;
}

// ============================================================================
// DialogFooter
// ============================================================================

interface DialogFooterProps {
  children: ReactNode;
  style?: ViewStyle;
}

/**
 * DialogFooter - Bottom section of the dialog
 * Flex row layout for action buttons
 */
export function DialogFooter({ children, style }: DialogFooterProps) {
  return <View style={style} className="p-4 border-t border-border flex-row gap-2">{children}</View>;
}

// ============================================================================
// AlertDialog (Convenience Wrapper)
// ============================================================================

interface AlertDialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmVariant?: 'primary' | 'destructive';
  closeOnBackdropPress?: boolean;
}

/**
 * AlertDialog - Pre-composed dialog for confirmations
 * Includes title, description, and confirm/cancel buttons
 */
export function AlertDialog({
  visible,
  onClose,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  confirmVariant = 'primary',
  closeOnBackdropPress = false,
}: AlertDialogProps) {
  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      closeOnBackdropPress={closeOnBackdropPress}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            title={cancelText}
            onPress={handleCancel}
            className="flex-1"
          />
          <Button
            variant={confirmVariant}
            title={confirmText}
            onPress={handleConfirm}
            className="flex-1"
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

