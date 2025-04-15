import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Users, ArrowRight, ChevronRight } from 'lucide-react-native';
import { useSupabaseClient } from '@/hooks/useSupabaseClient'; // Adjust import if needed
import { useAuth } from '@/lib/AuthContext'; // Adjust import if needed
import { getSupabaseFileUrl } from '@/services/imageservice'; // Adjust import if needed
import { getDefaultAvatar } from '@/lib/useDefaultAvatar'; // Adjust import if needed
import { chatService } from '@/services/chatService'; // Adjust import if needed

// Placeholder component for the suggested trade details screen
const SuggestedTradeDetailsScreen = () => {
  const params = useLocalSearchParams();
  const router = useRouter();
  const supabase = useSupabaseClient();
  const { user } = useAuth(); // Get current authenticated user
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  // TODO: Retrieve full item and user details based on IDs passed in params
  const { 
    item_a_id, item_b_id, item_c_id,
    user_b_id, user_c_id,
    // Optional params passed directly
    item_a_name, item_a_image,
    item_b_name, item_b_image,
    item_c_name, item_c_image,
    user_b_name, user_b_avatar,
    user_c_name, user_c_avatar
  } = params;

  // TODO: Fetch full data for items and profiles if needed

  const handleStartChat = async () => {
    if (!supabase || !user || !user_b_id || !user_c_id || !item_a_id || !item_b_id || !item_c_id) {
      Alert.alert('Error', 'Missing required information to start chat.');
      return;
    }

    setIsLoadingChat(true);

    try {
      // Ensure participant IDs are unique and include the current user
      const participantIds = [...new Set([user.id, user_b_id as string, user_c_id as string])];
      
      if (participantIds.length < 3) {
          // Should not happen if user_b_id and user_c_id are different from user.id
          console.error('Less than 3 unique participants detected', participantIds);
          throw new Error('Invalid participant setup for group chat.');
      }
      
      // Call the new service function to get or create the room
      const roomResult = await chatService.getOrCreateChatRoom(participantIds);
      
      if (!roomResult.success || !roomResult.roomId) {
          throw new Error(roomResult.error || 'Failed to initialize chat room.');
      }
      
      const roomId = roomResult.roomId;
      console.log('Using chat room ID:', roomId);

      // Check if an initial message needs to be sent (e.g., if room was just created)
      // This logic might need refinement - maybe the RPC could return if it created a new room?
      // For now, let's assume we might send it even if room exists, which is okay.
      const initialMessage = `Started chat to discuss a potential 3-way trade involving: ${item_a_name}, ${item_b_name}, and ${item_c_name}.`;
      const { error: messageError } = await chatService.sendMessage(
          roomId,
          user.id, // Send as current user
          initialMessage,
          undefined, // No media
          'system' // Mark as system message
      );
      
      if (messageError) {
          // Log error but still navigate
          console.error('Error sending initial system message:', messageError);
      }

      // Navigate to the chat screen using the obtained room ID
      router.push(`/chat?roomId=${roomId}`);

    } catch (error: any) {
      console.error('Error in handleStartChat:', error);
      Alert.alert('Error', error.message || 'Could not start or find the chat room.');
    } finally {
      setIsLoadingChat(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Suggested Trade Details', presentation: 'modal' }} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Potential 3-Way Trade</Text>
        
        {/* Placeholder for displaying item A */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Item:</Text>
          <Text>ID: {item_a_id}</Text>
          <Text>Name: {item_a_name}</Text>
          {/* Add Image component here */}
        </View>

        {/* Placeholder for displaying item B */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Item from {user_b_name || 'User B'}:</Text>
          <Text>ID: {item_b_id}</Text>
          <Text>Name: {item_b_name}</Text>
           {/* Add Image & User B Profile component here */}
        </View>

        {/* Placeholder for displaying item C */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Item from {user_c_name || 'User C'}:</Text>
          <Text>ID: {item_c_id}</Text>
          <Text>Name: {item_c_name}</Text>
           {/* Add Image & User C Profile component here */}
        </View>

        {/* TODO: Add visual representation of trade flow */}

        {/* TODO: Add 'Start Group Chat' button */}
        <View style={styles.buttonPlaceholder}>
           <Text>Start Group Chat Button Here</Text>
        </View>

        {/* Trade Flow Visual */}
        <View style={styles.flowContainer}>
          {/* Item A (You) */}
          <View style={styles.flowItemContainer}>
             <ExpoImage 
               source={{ uri: getSupabaseFileUrl(item_a_image as string) ?? undefined }}
               style={styles.flowItemImage}
             />
             <Text style={styles.flowItemLabel} numberOfLines={2}>{item_a_name}</Text>
             <Text style={styles.flowItemOwner}>(Your Item)</Text>
          </View>
          
          <ArrowRight color="#adb5bd" size={24} style={styles.flowArrow}/>

          {/* Item B */}
          <View style={styles.flowItemContainer}>
             <ExpoImage 
               source={{ uri: getSupabaseFileUrl(item_b_image as string) ?? undefined }}
               style={styles.flowItemImage}
             />
             <Text style={styles.flowItemLabel} numberOfLines={2}>{item_b_name}</Text>
              <TouchableOpacity style={styles.flowOwnerTouchable} onPress={() => router.push(`/profile/${user_b_id}`)}>
                  <ExpoImage source={{ uri: getSupabaseFileUrl(user_b_avatar as string) ?? getDefaultAvatar()}} style={styles.flowOwnerAvatar} />
                  <Text style={styles.flowItemOwner}>{user_b_name}</Text>
                  <ChevronRight color="#adb5bd" size={14} />
              </TouchableOpacity>
          </View>

          <ArrowRight color="#adb5bd" size={24} style={styles.flowArrow}/>
          
          {/* Item C */}
          <View style={styles.flowItemContainer}>
             <ExpoImage 
               source={{ uri: getSupabaseFileUrl(item_c_image as string) ?? undefined }}
               style={styles.flowItemImage}
             />
             <Text style={styles.flowItemLabel} numberOfLines={2}>{item_c_name}</Text>
              <TouchableOpacity style={styles.flowOwnerTouchable} onPress={() => router.push(`/profile/${user_c_id}`)}>
                  <ExpoImage source={{ uri: getSupabaseFileUrl(user_c_avatar as string) ?? getDefaultAvatar()}} style={styles.flowOwnerAvatar} />
                  <Text style={styles.flowItemOwner}>{user_c_name}</Text>
                  <ChevronRight color="#adb5bd" size={14} />
              </TouchableOpacity>
          </View>
        </View>

        <View style={styles.explanationContainer}>
            <Text style={styles.explanationText}>
                This suggests a trade where you give <Text style={styles.bold}>{item_a_name}</Text> to <Text style={styles.bold}>{user_b_name}</Text>, 
                {user_b_name} gives <Text style={styles.bold}>{item_b_name}</Text> to <Text style={styles.bold}>{user_c_name}</Text>, and 
                {user_c_name} gives <Text style={styles.bold}>{item_c_name}</Text> to you.
            </Text>
        </View>
        
        {/* Chat Button */}
        <TouchableOpacity 
          style={styles.chatButton}
          onPress={handleStartChat}
          disabled={isLoadingChat}
        >
          {isLoadingChat ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Users color="#FFFFFF" size={20} style={{ marginRight: 10 }}/>
              <Text style={styles.chatButtonText}>Discuss Trade with Others</Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa', // Light background
  },
  scrollContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#343a40',
  },
  section: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#495057',
  },
  buttonPlaceholder: {
     marginTop: 30,
     padding: 15,
     backgroundColor: '#e9ecef',
     borderRadius: 8,
     alignItems: 'center',
  },
  // Trade Flow Styles
  flowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  flowItemContainer: {
    alignItems: 'center',
    flex: 1,
    maxWidth: '30%',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    minHeight: 180,
  },
  flowItemImage: {
    width: '100%',
    height: 80,
    borderRadius: 6,
    marginBottom: 10,
    backgroundColor: '#e9ecef',
  },
  flowItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#343a40',
    textAlign: 'center',
    marginBottom: 6,
  },
  flowItemOwner: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
   flowOwnerTouchable: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: '#f1f3f5',
      borderWidth: 1,
      borderColor: '#dee2e6',
  },
  flowOwnerAvatar: {
      width: 18,
      height: 18,
      borderRadius: 9,
      marginRight: 5,
  },
  flowArrow: {
    marginTop: 40,
    marginHorizontal: 5,
    color: '#868e96',
  },
  // Explanation Text Styles
  explanationContainer: {
      marginVertical: 15,
      padding: 15,
      backgroundColor: '#f1f3f5',
      borderRadius: 8,
      borderLeftWidth: 4,
      borderLeftColor: '#22C55E',
  },
  explanationText: {
      fontSize: 14,
      color: '#495057',
      lineHeight: 21,
      textAlign: 'left',
  },
  bold: {
      fontWeight: 'bold',
      color: '#212529',
  },
  // Chat Button Styles
  chatButton: {
    flexDirection: 'row',
    backgroundColor: '#22C55E',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  // TODO: Add styles for images, profiles, trade flow diagram, chat button
});

export default SuggestedTradeDetailsScreen; 