import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TouchableWithoutFeedback,
  Animated,
  Dimensions
} from 'react-native';
import { Camera, Image as ImageIcon, File, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

interface MediaSourceModalProps {
  visible: boolean;
  onClose: () => void;
  onCameraSelect: () => void;
  onGallerySelect: () => void;
  onDocumentSelect?: () => void;
}

const MediaSourceModal: React.FC<MediaSourceModalProps> = ({
  visible,
  onClose,
  onCameraSelect,
  onGallerySelect,
  onDocumentSelect
}) => {
  const translateY = React.useRef(new Animated.Value(100)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
          
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Animated.View 
              style={[
                styles.modalContainer,
                {
                  opacity,
                  transform: [{ translateY }]
                }
              ]}
            >
              <View style={styles.header}>
                <Text style={styles.title}>Add Media</Text>
                <TouchableOpacity 
                  style={styles.closeButton} 
                  onPress={onClose}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <X size={20} color="#666" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.optionsContainer}>
                <TouchableOpacity 
                  style={styles.option} 
                  onPress={() => {
                    onClose();
                    onCameraSelect();
                  }}
                >
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                    <Camera size={28} color="#22C55E" />
                  </View>
                  <Text style={styles.optionTitle}>Take Photo</Text>
                  <Text style={styles.optionDescription}>Use your camera to take a new photo</Text>
                </TouchableOpacity>
                
                <View style={styles.divider} />
                
                <TouchableOpacity 
                  style={styles.option} 
                  onPress={() => {
                    onClose();
                    onGallerySelect();
                  }}
                >
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                    <ImageIcon size={28} color="#3B82F6" />
                  </View>
                  <Text style={styles.optionTitle}>Choose from Gallery</Text>
                  <Text style={styles.optionDescription}>Select from your existing photos and videos</Text>
                </TouchableOpacity>
                
                {onDocumentSelect && (
                  <>
                    <View style={styles.divider} />
                    
                    <TouchableOpacity 
                      style={styles.option} 
                      onPress={() => {
                        onClose();
                        onDocumentSelect();
                      }}
                    >
                      <View style={[styles.iconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                        <File size={28} color="#EF4444" />
                      </View>
                      <Text style={styles.optionTitle}>Select Document</Text>
                      <Text style={styles.optionDescription}>Choose a document or file to share</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: width - 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    paddingBottom: 20,
  },
  option: {
    padding: 20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginHorizontal: 20,
  },
});

export default MediaSourceModal; 