import React from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface ChatButtonProps {
  userId?: string;
  userName?: string;
  userAvatar?: string;
  hasUnreadMessages?: boolean;
  size?: 'small' | 'medium' | 'large' | 'custom';
  style?: any;
  transparent?: boolean;
  iconSize?: number;
}

export default function ChatButton({
  userId,
  userName,
  userAvatar,
  hasUnreadMessages = false,
  size = 'medium',
  style,
  transparent = false,
  iconSize,
}: ChatButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    router.push('/chat-selection');
  };

  const getSize = () => {
    switch (size) {
      case 'small':
        return { button: 36, icon: iconSize || 18 };
      case 'large':
        return { button: 56, icon: iconSize || 28 };
      case 'custom':
        // For custom size, we'll use the style prop to determine the button size
        // and only set the icon size here
        return { button: 0, icon: iconSize || 22 };
      case 'medium':
      default:
        return { button: 48, icon: iconSize || 24 };
    }
  };

  const sizeValues = getSize();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        transparent ? styles.transparentButton : null,
        size !== 'custom' ? {
          width: sizeValues.button,
          height: sizeValues.button,
          borderRadius: sizeValues.button / 2,
        } : null,
        style,
      ]}
      onPress={handlePress}
    >
      <MessageCircle color="#FFFFFF" size={sizeValues.icon} strokeWidth={2.5} />
      {hasUnreadMessages && <View style={styles.badge} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  transparentButton: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
}); 